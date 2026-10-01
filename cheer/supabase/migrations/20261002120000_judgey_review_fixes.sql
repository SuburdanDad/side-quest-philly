-- Judgey review fixes (docs/backend-spec.md §4-§6). Applied after the three
-- 20261001 migrations; never edit those, add a new file instead.
--
--  1. claim_operator: a meet-wide failure budget on top of the per-identity cap.
--  2. op_set_start: a non-null start on a routine that already has one is
--     'already-started' (Clear first).
--  3. pg_graphql is dropped: nothing uses /graphql/v1 and it trips advisor lints
--     0026/0027 on every readable table.
--  4. routines text columns: no CR/LF, bounded lengths.
--  5. One lock per mat (transaction advisory lock) taken by tap_mat, op_set_start
--     and op_set_status before any row lock, so the tap gate is serialized per mat.
--  6. op_set_status locks the meets row before the routine row (the importer's order).
--
-- Every replaced function keeps security definer, an empty search_path and the
-- exact §5 grants (re-applied below after an explicit revoke).

-- ---------------------------------------------------------------------------
-- 3. No GraphQL endpoint.
drop extension if exists pg_graphql;

-- ---------------------------------------------------------------------------
-- 4. Column hardening. Added NOT VALID and then validated, so a database that
-- already holds a bad row (a local stack with review data) still migrates; it
-- keeps the constraint for every new or updated row and says which one failed.
alter table public.routines
  add constraint routines_mat_shape
    check (char_length(mat) between 1 and 16 and mat !~ '[\r\n]') not valid,
  add constraint routines_team_name_shape
    check (char_length(team_name) between 1 and 80 and team_name !~ '[\r\n]') not valid,
  add constraint routines_gym_shape
    check (char_length(gym) <= 80 and gym !~ '[\r\n]') not valid,
  add constraint routines_division_shape
    check (char_length(division) <= 80 and division !~ '[\r\n]') not valid;

do $$
declare
  v_name text;
begin
  foreach v_name in array array['routines_mat_shape', 'routines_team_name_shape',
                                'routines_gym_shape', 'routines_division_shape'] loop
    begin
      execute format('alter table public.routines validate constraint %I', v_name);
    exception when check_violation then
      raise warning 'existing public.routines rows violate %; it is enforced for new rows only', v_name;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Meet-wide operator-code failure budget: the times of the meet's failed
-- claims in the last minute (at most 30 kept). Holds no identity.
create table judgey_private.operator_failures (
  meet_id text primary key references public.meets on delete cascade,
  recent timestamptz[] not null default '{}'
);
revoke all on table judgey_private.operator_failures from public, anon, authenticated;

-- 5. The per-mat gate lock. Meet ids match ^[a-z0-9-]{3,64}$, so '/' separates
-- unambiguously.
create function judgey_private.lock_mat(p_meet text, p_mat text) returns void
language sql volatile security definer set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('judgey-mat/' || p_meet || '/' || p_mat, 0));
$$;
revoke all on function judgey_private.lock_mat(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trade the meet's operator code for operator rights. Two limits, checked
-- before the code:
--   per identity: after 10 wrong codes at a meet, even the right code is 'locked';
--   per meet:     after 30 wrong codes from anyone in the last 60 s, every claim
--                 is 'slow-down' until the oldest of them is a minute old.
-- 'slow-down' answers are not counted anywhere, so the meet-wide pause ends at
-- most a minute after the guessing stops. Existing operators keep their rights.
create or replace function public.claim_operator(p_meet text, p_code text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_now timestamptz := date_trunc('milliseconds', now());
  v_attempts int;
  v_recent timestamptz[];
  v_hash text;
begin
  if not exists (select 1 from public.meets where id = p_meet) then
    return json_build_object('ok', false, 'reason', 'unknown-meet');
  end if;
  -- Lock order: the caller's attempts row, then the meet's budget row.
  insert into judgey_private.operator_attempts (meet_id, user_id)
  values (p_meet, v_uid) on conflict do nothing;
  select o.attempts into v_attempts from judgey_private.operator_attempts o
  where o.meet_id = p_meet and o.user_id = v_uid for update;
  if v_attempts >= 10 then
    return json_build_object('ok', false, 'reason', 'locked');
  end if;

  insert into judgey_private.operator_failures (meet_id) values (p_meet) on conflict do nothing;
  select array(select t from unnest(f.recent) u(t) where t > v_now - interval '1 minute' order by t)
  into v_recent
  from judgey_private.operator_failures f where f.meet_id = p_meet for update;
  if cardinality(v_recent) >= 30 then
    return json_build_object('ok', false, 'reason', 'slow-down');
  end if;

  select c.code_hash into v_hash from judgey_private.operator_codes c where c.meet_id = p_meet;
  if coalesce(extensions.crypt(p_code, v_hash) = v_hash, false) then
    insert into judgey_private.meet_operators (meet_id, user_id)
    values (p_meet, v_uid) on conflict do nothing;
    return json_build_object('ok', true);
  end if;

  update judgey_private.operator_attempts o set attempts = o.attempts + 1
  where o.meet_id = p_meet and o.user_id = v_uid;
  update judgey_private.operator_failures f set recent = v_recent || v_now
  where f.meet_id = p_meet;
  return json_build_object('ok', false, 'reason', 'bad-code');
end;
$$;
revoke all on function public.claim_operator(text, text) from public, anon, authenticated;
grant execute on function public.claim_operator(text, text) to authenticated;

-- "They just took the mat." Unchanged rules; now serialized per mat (lock_mat,
-- then the routine row) so two taps confirming different routines of one mat
-- see each other and the 'too-soon' / 'not-next' gate holds.
create or replace function public.tap_mat(p_meet text, p_team text, p_age_ms int default 0) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_at timestamptz := date_trunc('milliseconds',
    now() - least(greatest(coalesce(p_age_ms, 0), 0), 120000) * interval '1 millisecond');  -- RULES.maxTapAgeSeconds
  v_mat text;
  v_reason text;
  v_start timestamptz;
begin
  select r.mat into v_mat from public.routines r where r.meet_id = p_meet and r.team_id = p_team;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown-team', 'confirmed', false);
  end if;
  perform judgey_private.lock_mat(p_meet, v_mat);
  perform 1 from public.routines r where r.meet_id = p_meet and r.team_id = p_team for no key update;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown-team', 'confirmed', false);
  end if;

  v_reason := judgey_private.tap_rejection(p_meet, p_team, judgey_private.ms(v_at),
                                           judgey_private.ms(date_trunc('milliseconds', now())));
  if v_reason is null then
    insert into public.taps (meet_id, team_id, user_id, at)
    values (p_meet, p_team, v_uid, v_at)
    on conflict do nothing;                    -- idempotent retries from the outbox
    perform judgey_private.recompute_start(p_meet, p_team);
  end if;

  select s.started_at into v_start
  from public.routine_starts s
  join public.routines r on r.meet_id = s.meet_id and r.team_id = s.team_id
  where s.meet_id = p_meet and s.team_id = p_team and r.status = 'scheduled';
  return json_strip_nulls(json_build_object(
    'ok', v_reason is null,
    'reason', v_reason,
    'confirmed', v_start is not null,
    'startedAt', judgey_private.ms(v_start)));
end;
$$;
revoke all on function public.tap_mat(text, text, int) from public, anon, authenticated;
grant execute on function public.tap_mat(text, text, int) to authenticated;

-- Set a start by hand ("Start now"), or clear it (null) together with that
-- routine's taps so the crowd can re-confirm cleanly. Ballots stay. A start
-- never silently replaces another one: a routine that already has a start
-- (crowd or operator) answers 'already-started'; the operator Clears first.
create or replace function public.op_set_start(p_meet text, p_team text, p_started_at_ms bigint) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_mat text;
begin
  if not judgey_private.is_operator(p_meet, v_uid) then
    return json_build_object('ok', false, 'reason', 'not-operator');
  end if;
  select r.mat into v_mat from public.routines r where r.meet_id = p_meet and r.team_id = p_team;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown-team');
  end if;
  perform judgey_private.lock_mat(p_meet, v_mat);
  perform 1 from public.routines r where r.meet_id = p_meet and r.team_id = p_team for no key update;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown-team');
  end if;

  if p_started_at_ms is null then
    delete from public.routine_starts s where s.meet_id = p_meet and s.team_id = p_team;
    delete from public.taps t where t.meet_id = p_meet and t.team_id = p_team;
  else
    if exists (select 1 from public.routine_starts s where s.meet_id = p_meet and s.team_id = p_team) then
      return json_build_object('ok', false, 'reason', 'already-started');
    end if;
    insert into public.routine_starts
      (meet_id, team_id, started_at, source, confirmed_at, confirmations, updated_at)
    values (p_meet, p_team, judgey_private.from_ms(p_started_at_ms), 'operator', null, 0,
            date_trunc('milliseconds', now()));
  end if;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.op_set_start(text, text, bigint) from public, anon, authenticated;
grant execute on function public.op_set_start(text, text, bigint) to authenticated;

-- Scratch or unscratch a routine. A change bumps schedule_version so every
-- phone refetches the running order on its next snapshot. Lock order: the mat,
-- then the meets row, then the routine row (the importer locks meets first, too).
create or replace function public.op_set_status(p_meet text, p_team text, p_status text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_mat text;
  v_old text;
begin
  if not judgey_private.is_operator(p_meet, v_uid) then
    return json_build_object('ok', false, 'reason', 'not-operator');
  end if;
  if not coalesce(p_status in ('scheduled', 'scratched'), false) then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;
  select r.mat into v_mat from public.routines r where r.meet_id = p_meet and r.team_id = p_team;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown-team');
  end if;
  perform judgey_private.lock_mat(p_meet, v_mat);
  perform 1 from public.meets m where m.id = p_meet for no key update;
  select r.status into v_old from public.routines r
  where r.meet_id = p_meet and r.team_id = p_team for no key update;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown-team');
  end if;

  if v_old <> p_status then
    update public.routines r set status = p_status where r.meet_id = p_meet and r.team_id = p_team;
    update public.meets m set schedule_version = m.schedule_version + 1 where m.id = p_meet;
  end if;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.op_set_status(text, text, text) from public, anon, authenticated;
grant execute on function public.op_set_status(text, text, text) to authenticated;
