-- Judgey RPCs: the only way clients write (docs/backend-spec.md §6).
-- JSON is camelCase, times are integer epoch ms. Every function is security
-- definer with an empty search_path, validates its inputs (NULL included), and
-- gets exactly the grants in the §5 table after an explicit revoke.
-- Reasons are returned as {ok:false, reason}; only a missing session raises
-- ('not-authenticated', SQLSTATE 28000).

-- Public, anonymous, polled every ~15 s: schedule (only when the caller's copy
-- is stale), effective starts and the public board. Unknown meet → null.
create function public.meet_snapshot(p_meet text, p_have_version int default 0) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  m public.meets%rowtype;
  v_now_ms bigint := judgey_private.ms(date_trunc('milliseconds', now()));
begin
  select * into m from public.meets where id = p_meet;
  if not found then
    return null;
  end if;
  return json_build_object(
    'serverNow', v_now_ms,
    'meetId', m.id,
    'scheduleVersion', m.schedule_version,
    'schedule', case when coalesce(p_have_version, 0) <> m.schedule_version then json_build_object(
      'meet', json_build_object(
        'id', m.id, 'name', m.name, 'venue', m.venue, 'city', m.city, 'timeZone', m.time_zone,
        'startsAt', judgey_private.ms(m.starts_at), 'mats', m.mats, 'minTaps', m.min_taps),
      'routines', coalesce((
        select json_agg(json_build_object(
                 'teamId', r.team_id, 'teamName', r.team_name, 'gym', r.gym, 'division', r.division,
                 'mat', r.mat, 'scheduledAt', judgey_private.ms(r.scheduled_at), 'status', r.status)
               order by r.scheduled_at, r.mat, r.team_id)
        from public.routines r where r.meet_id = m.id), '[]'::json))
    end,
    'starts', coalesce((
      select json_agg(json_build_object(
               'teamId', s.team_id, 'startedAt', judgey_private.ms(s.started_at), 'source', s.source)
             order by s.team_id)
      from public.routine_starts s
      join public.routines r on r.meet_id = s.meet_id and r.team_id = s.team_id
      where s.meet_id = m.id and r.status = 'scheduled'), '[]'::json),
    'board', judgey_private.board(m.id, v_now_ms));
end;
$$;
revoke all on function public.meet_snapshot(text, int) from public, anon, authenticated;
grant execute on function public.meet_snapshot(text, int) to anon, authenticated;

-- Everything private to the caller at this meet, plus recaps for the teams they
-- follow right now.
create function public.my_state(p_meet text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_now_ms bigint := judgey_private.ms(date_trunc('milliseconds', now()));
  f public.fans%rowtype;
begin
  select * into f from public.fans where meet_id = p_meet and user_id = v_uid;
  return json_build_object(
    'serverNow', v_now_ms,
    'fan', case when f.user_id is not null then json_build_object(
      'homeTeamIds', f.home_team_ids, 'everHomeTeamIds', f.ever_home_team_ids) end,
    'tappedTeamIds', coalesce((
      select json_agg(t.team_id order by t.at, t.team_id)
      from public.taps t where t.meet_id = p_meet and t.user_id = v_uid), '[]'::json),
    'ballots', coalesce((
      select json_agg(json_build_object('teamId', b.team_id, 'stars', b.stars, 'awards', b.awards)
                      order by b.cast_at, b.team_id)
      from public.ballots b where b.meet_id = p_meet and b.user_id = v_uid), '[]'::json),
    'recaps', case when f.user_id is null or cardinality(f.home_team_ids) = 0 then '[]'::json
                   else judgey_private.recaps(p_meet, f.home_team_ids, v_now_ms,
                                              judgey_private.board(p_meet, v_now_ms)) end,
    'isOperator', judgey_private.is_operator(p_meet, v_uid));
end;
$$;
revoke all on function public.my_state(text) from public, anon, authenticated;
grant execute on function public.my_state(text) to authenticated;

-- "Which squad are you here to see?" Mirrors applyCheckIn/checkInRejection in
-- src/voting.ts. ever = ever ∪ home ∪ new; a team newly added to ever that the
-- caller already voted for loses that ballot (and its tallies) in this transaction.
create function public.check_in(p_meet text, p_home_team_ids text[]) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_ids text[];
  f public.fans%rowtype;
  v_before text[];
  v_added text[];
  v_removed text[];
begin
  if not exists (select 1 from public.meets where id = p_meet) then
    return json_build_object('ok', false, 'reason', 'unknown-meet');
  end if;

  -- Dedupe, keeping first-seen order; null or empty means "just here to cheer".
  select coalesce(array_agg(d.id order by d.ord), '{}') into v_ids
  from (select u.id, min(u.ord) as ord
        from unnest(coalesce(p_home_team_ids, '{}')) with ordinality u(id, ord)
        group by u.id) d;
  if cardinality(v_ids) > 10 then                                  -- RULES.maxHomeTeams
    return json_build_object('ok', false, 'reason', 'too-many');
  end if;
  if exists (select 1 from unnest(v_ids) x(id)
             where x.id is null or not exists (
               select 1 from public.routines r
               where r.meet_id = p_meet and r.team_id = x.id and r.status = 'scheduled')) then
    return json_build_object('ok', false, 'reason', 'unknown-team');
  end if;

  -- Lock (creating if missing) the caller's row; cast_ballot holds it 'for share'.
  insert into public.fans (meet_id, user_id) values (p_meet, v_uid) on conflict do nothing;
  select * into f from public.fans where meet_id = p_meet and user_id = v_uid for update;

  select coalesce(array_agg(b.id order by b.ord), '{}') into v_before
  from (select u.id, min(u.ord) as ord
        from unnest(f.ever_home_team_ids || f.home_team_ids) with ordinality u(id, ord)
        group by u.id) b;
  v_added := array(select x.id from unnest(v_ids) with ordinality x(id, ord)
                   where x.id <> all (v_before) order by x.ord);

  if cardinality(v_added) > 0 then
    -- Lock the counters in a fixed order before touching them (no deadlocks).
    perform 1 from judgey_private.team_tallies t
    where t.meet_id = p_meet and t.team_id = any (v_added)
    order by t.team_id
    for update;
    with gone as (
      delete from public.ballots b
      where b.meet_id = p_meet and b.user_id = v_uid and b.team_id = any (v_added)
      returning b.team_id, b.stars, b.awards
    ), uncount as (
      update judgey_private.team_tallies t
      set votes = t.votes - 1,
          star_sum = t.star_sum - g.stars,
          stunts = t.stunts - ('stunts' = any (g.awards))::int,
          tumbling = t.tumbling - ('tumbling' = any (g.awards))::int,
          spirit = t.spirit - ('spirit' = any (g.awards))::int,
          dance = t.dance - ('dance' = any (g.awards))::int
      from gone g
      where t.meet_id = p_meet and t.team_id = g.team_id
    )
    select coalesce(array_agg(g.team_id order by g.team_id), '{}') into v_removed from gone g;
  end if;

  update public.fans
  set home_team_ids = v_ids, ever_home_team_ids = v_before || v_added,
      updated_at = date_trunc('milliseconds', now())
  where meet_id = p_meet and user_id = v_uid;

  return json_build_object(
    'ok', true,
    'fan', json_build_object('homeTeamIds', v_ids, 'everHomeTeamIds', v_before || v_added),
    'removedBallotTeamIds', coalesce(v_removed, '{}'));
end;
$$;
revoke all on function public.check_in(text, text[]) from public, anon, authenticated;
grant execute on function public.check_in(text, text[]) to authenticated;

-- "They just took the mat." The tap time is now() minus the client's reported
-- age (clamped to [0, maxTapAgeSeconds]); the gate runs against that time.
-- The routine row lock serializes taps per routine without blocking the ballot
-- FK checks (those take KEY SHARE).
create function public.tap_mat(p_meet text, p_team text, p_age_ms int default 0) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_at timestamptz := date_trunc('milliseconds',
    now() - least(greatest(coalesce(p_age_ms, 0), 0), 120000) * interval '1 millisecond');  -- RULES.maxTapAgeSeconds
  v_reason text;
  v_start timestamptz;
begin
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

-- 1-5 stars and optional shout-outs, once per routine, inside the voting window
-- (plus grace). Same checks, same order, as validateBallot in src/voting.ts.
create function public.cast_ballot(p_meet text, p_team text, p_stars numeric, p_awards text[] default '{}')
returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_now timestamptz := date_trunc('milliseconds', now());
  f public.fans%rowtype;
  v_start_ms bigint;
  v_awards text[];
begin
  -- Shared lock: a concurrent check_in (FOR UPDATE) waits for this ballot, then removes it if needed.
  select * into f from public.fans where meet_id = p_meet and user_id = v_uid for share;
  if not found then
    return json_build_object('ok', false, 'reason', 'not-checked-in');
  end if;
  if coalesce(p_team = any (f.ever_home_team_ids) or p_team = any (f.home_team_ids), false) then
    return json_build_object('ok', false, 'reason', 'own-team');
  end if;

  select judgey_private.ms(s.started_at) into v_start_ms
  from public.routine_starts s
  join public.routines r on r.meet_id = s.meet_id and r.team_id = s.team_id
  where s.meet_id = p_meet and s.team_id = p_team and r.status = 'scheduled';
  if not coalesce(judgey_private.ms(v_now) between v_start_ms and v_start_ms + 660000, false) then  -- window 10 min + grace 60 s
    return json_build_object('ok', false, 'reason', 'window-closed');
  end if;

  if exists (select 1 from public.ballots b
             where b.meet_id = p_meet and b.team_id = p_team and b.user_id = v_uid) then
    return json_build_object('ok', false, 'reason', 'already-voted');
  end if;

  if not coalesce(p_stars = trunc(p_stars) and p_stars between 1 and 5, false)
     or p_awards is null
     or exists (select 1 from unnest(p_awards) a(award)
                where a.award is null or a.award not in ('stunts', 'tumbling', 'spirit', 'dance')) then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;
  v_awards := array(select distinct a.award from unnest(p_awards) a(award) order by a.award);

  insert into public.ballots (meet_id, team_id, user_id, stars, awards, cast_at)
  values (p_meet, p_team, v_uid, p_stars::smallint, v_awards, v_now)
  on conflict do nothing;
  if not found then                            -- lost a race with our own retry
    return json_build_object('ok', false, 'reason', 'already-voted');
  end if;

  insert into judgey_private.team_tallies as t
    (meet_id, team_id, votes, star_sum, stunts, tumbling, spirit, dance)
  values (p_meet, p_team, 1, p_stars::int,
          ('stunts' = any (v_awards))::int, ('tumbling' = any (v_awards))::int,
          ('spirit' = any (v_awards))::int, ('dance' = any (v_awards))::int)
  on conflict (meet_id, team_id) do update
    set votes = t.votes + 1,
        star_sum = t.star_sum + excluded.star_sum,
        stunts = t.stunts + excluded.stunts,
        tumbling = t.tumbling + excluded.tumbling,
        spirit = t.spirit + excluded.spirit,
        dance = t.dance + excluded.dance;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.cast_ballot(text, text, numeric, text[]) from public, anon, authenticated;
grant execute on function public.cast_ballot(text, text, numeric, text[]) to authenticated;

-- One row per 15-minute bucket the caller had the app open (first src wins).
create function public.touch(p_meet text, p_src text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
begin
  if not exists (select 1 from public.meets where id = p_meet) then
    return;
  end if;
  insert into public.visits (meet_id, user_id, bucket, src)
  values (p_meet, v_uid,
          date_bin('15 minutes', now(), timestamptz '2000-01-01 00:00:00+00'),
          case when coalesce(p_src ~ '^[a-z0-9-]{1,32}$', false) then p_src end)
  on conflict do nothing;
end;
$$;
revoke all on function public.touch(text, text) from public, anon, authenticated;
grant execute on function public.touch(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Operator path: the meet-day safety net.

-- Trade the meet's operator code for operator rights. At most 10 failed
-- attempts per (meet, identity); after that even the right code is 'locked'.
create function public.claim_operator(p_meet text, p_code text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_attempts int;
  v_hash text;
begin
  if not exists (select 1 from public.meets where id = p_meet) then
    return json_build_object('ok', false, 'reason', 'unknown-meet');
  end if;
  insert into judgey_private.operator_attempts (meet_id, user_id)
  values (p_meet, v_uid) on conflict do nothing;
  select o.attempts into v_attempts from judgey_private.operator_attempts o
  where o.meet_id = p_meet and o.user_id = v_uid for update;
  if v_attempts >= 10 then
    return json_build_object('ok', false, 'reason', 'locked');
  end if;

  select c.code_hash into v_hash from judgey_private.operator_codes c where c.meet_id = p_meet;
  if coalesce(extensions.crypt(p_code, v_hash) = v_hash, false) then
    insert into judgey_private.meet_operators (meet_id, user_id)
    values (p_meet, v_uid) on conflict do nothing;
    return json_build_object('ok', true);
  end if;

  update judgey_private.operator_attempts o set attempts = o.attempts + 1
  where o.meet_id = p_meet and o.user_id = v_uid;
  return json_build_object('ok', false, 'reason', 'bad-code');
end;
$$;
revoke all on function public.claim_operator(text, text) from public, anon, authenticated;
grant execute on function public.claim_operator(text, text) to authenticated;

-- Set a start by hand ("Start now"), or clear it (null) together with that
-- routine's taps so the crowd can re-confirm cleanly. Ballots stay.
create function public.op_set_start(p_meet text, p_team text, p_started_at_ms bigint) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
begin
  if not judgey_private.is_operator(p_meet, v_uid) then
    return json_build_object('ok', false, 'reason', 'not-operator');
  end if;
  perform 1 from public.routines r where r.meet_id = p_meet and r.team_id = p_team for no key update;
  if not found then
    return json_build_object('ok', false, 'reason', 'unknown-team');
  end if;

  if p_started_at_ms is null then
    delete from public.routine_starts s where s.meet_id = p_meet and s.team_id = p_team;
    delete from public.taps t where t.meet_id = p_meet and t.team_id = p_team;
  else
    insert into public.routine_starts as s
      (meet_id, team_id, started_at, source, confirmed_at, confirmations, updated_at)
    values (p_meet, p_team, judgey_private.from_ms(p_started_at_ms), 'operator', null, 0, date_trunc('milliseconds', now()))
    on conflict (meet_id, team_id) do update
      set started_at = excluded.started_at, source = 'operator', confirmed_at = null,
          confirmations = 0, updated_at = excluded.updated_at;
  end if;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.op_set_start(text, text, bigint) from public, anon, authenticated;
grant execute on function public.op_set_start(text, text, bigint) to authenticated;

-- Scratch or unscratch a routine. A change bumps schedule_version so every
-- phone refetches the running order on its next snapshot.
create function public.op_set_status(p_meet text, p_team text, p_status text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := judgey_private.caller();
  v_old text;
begin
  if not judgey_private.is_operator(p_meet, v_uid) then
    return json_build_object('ok', false, 'reason', 'not-operator');
  end if;
  if not coalesce(p_status in ('scheduled', 'scratched'), false) then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;
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
