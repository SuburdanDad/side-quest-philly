-- Judgey private helpers: the §2 algorithms in SQL, mirroring src/schedule.ts,
-- src/voting.ts and src/results.ts exactly (test/db/parity.test.ts proves it).
-- Constants are RULES from src/rules.ts, inlined and named in comments.
-- Everything works in integer epoch ms, like the TS.
--
-- "Effective starts": a routine_starts row counts only while its routine is not
-- scratched, matching confirmedStarts(), which skips scratched slots.

-- timestamptz → epoch ms (stored times are already truncated to ms).
create function judgey_private.ms(p_ts timestamptz) returns bigint
language sql immutable security definer set search_path = '' as $$
  select floor(extract(epoch from p_ts) * 1000)::bigint
$$;

-- epoch ms → timestamptz (exact: µs fit a double up to year 2255).
create function judgey_private.from_ms(p_ms bigint) returns timestamptz
language sql immutable security definer set search_path = '' as $$
  select timestamptz 'epoch' + p_ms * interval '1 millisecond'
$$;

-- The caller's auth.uid(), or SQLSTATE 28000 'not-authenticated'.
create function judgey_private.caller() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not-authenticated' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

create function judgey_private.is_operator(p_meet text, p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from judgey_private.meet_operators o where o.meet_id = p_meet and o.user_id = p_uid
  )
$$;

-- confirmedStart over one routine's tap times (one per identity).
-- Keep taps at or after scheduledAt - earlyTapMinutes, sort, find the first j with
-- t[j] - t[j-minTaps+1] <= clusterSeconds; c = t[j] confirms. The start is the
-- median of taps in [t[i], c + freezeSeconds]; even count → floor((a + b + 1) / 2).
create function judgey_private.crowd_start(
  p_times bigint[], p_scheduled_ms bigint, p_min_taps int,
  out started_ms bigint, out confirmed_ms bigint, out confirmations int
)
language plpgsql immutable security definer set search_path = '' as $$
declare
  t bigint[];
  counted bigint[];
  k int := greatest(coalesce(p_min_taps, 2), 1);
  n int;
  i int;
  m int;
begin
  select coalesce(array_agg(x order by x), '{}') into t
  from unnest(p_times) x
  where x >= p_scheduled_ms - 45 * 60000;          -- RULES.earlyTapMinutes
  n := cardinality(t);

  for j in k .. n loop                             -- 1-based: t[i] .. t[j] holds k taps
    i := j - k + 1;
    if t[j] - t[i] <= 120000 then                  -- RULES.clusterSeconds
      select array_agg(x order by x) into counted
      from unnest(t) x
      where x >= t[i] and x <= t[j] + 90000;       -- RULES.freezeSeconds
      m := cardinality(counted);
      started_ms := case when m % 2 = 1 then counted[(m + 1) / 2]
                         else floor((counted[m / 2] + counted[m / 2 + 1] + 1)::numeric / 2)::bigint end;
      confirmed_ms := t[j];
      confirmations := m;
      return;
    end if;
  end loop;
end;
$$;

-- Re-derive one routine's crowd start from its taps and upsert or delete the
-- routine_starts row. Operator rows are never touched.
create function judgey_private.recompute_start(p_meet text, p_team text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_scheduled_ms bigint;
  v_min_taps int;
  v_times bigint[];
  c record;
begin
  select judgey_private.ms(r.scheduled_at), m.min_taps into v_scheduled_ms, v_min_taps
  from public.routines r join public.meets m on m.id = r.meet_id
  where r.meet_id = p_meet and r.team_id = p_team;
  if not found then
    return;
  end if;
  if exists (select 1 from public.routine_starts s
             where s.meet_id = p_meet and s.team_id = p_team and s.source = 'operator') then
    return;
  end if;

  select array_agg(judgey_private.ms(tp.at)) into v_times
  from public.taps tp where tp.meet_id = p_meet and tp.team_id = p_team;
  select * into c from judgey_private.crowd_start(v_times, v_scheduled_ms, v_min_taps);

  if c.started_ms is null then
    delete from public.routine_starts s
    where s.meet_id = p_meet and s.team_id = p_team and s.source = 'crowd';
  else
    insert into public.routine_starts as s
      (meet_id, team_id, started_at, source, confirmed_at, confirmations, updated_at)
    values (p_meet, p_team, judgey_private.from_ms(c.started_ms), 'crowd',
            judgey_private.from_ms(c.confirmed_ms), c.confirmations, date_trunc('milliseconds', now()))
    on conflict (meet_id, team_id) do update
      set started_at = excluded.started_at, confirmed_at = excluded.confirmed_at,
          confirmations = excluded.confirmations, updated_at = excluded.updated_at
      where s.source = 'crowd'
        and (s.started_at, s.confirmed_at, s.confirmations)
            is distinct from (excluded.started_at, excluded.confirmed_at, excluded.confirmations);
  end if;
end;
$$;

-- tapRejection (src/schedule.ts) plus the server-only rule 5. Rules 1-4 are
-- judged at the tap time p_at_ms; 'already-confirmed' at server time p_now_ms.
create function judgey_private.tap_rejection(p_meet text, p_team text, p_at_ms bigint, p_now_ms bigint)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  a record;
  v_has_anchor boolean;
  v_candidate boolean;
  s record;
begin
  -- 1. exists, not scratched
  select ro.mat, ro.status, ro.scheduled_at into r
  from public.routines ro where ro.meet_id = p_meet and ro.team_id = p_team;
  if not found then
    return 'unknown-team';
  end if;
  if r.status = 'scratched' then
    return 'scratched';
  end if;

  -- 2. not before scheduledAt - earlyTapMinutes
  if p_at_ms < judgey_private.ms(r.scheduled_at) - 45 * 60000 then
    return 'too-early';
  end if;

  -- 3. candidates around the mat's anchor (latest-scheduled confirmed routine)
  select ro.team_id, ro.scheduled_at, judgey_private.ms(st.started_at) as start_ms into a
  from public.routines ro
  join public.routine_starts st on st.meet_id = ro.meet_id and st.team_id = ro.team_id
  where ro.meet_id = p_meet and ro.mat = r.mat and ro.status = 'scheduled'
  order by ro.scheduled_at desc, ro.team_id desc
  limit 1;
  v_has_anchor := found;

  with mat as (
    select ro.team_id, ro.scheduled_at, st.team_id is null as unconfirmed
    from public.routines ro
    left join public.routine_starts st on st.meet_id = ro.meet_id and st.team_id = ro.team_id
    where ro.meet_id = p_meet and ro.mat = r.mat and ro.status = 'scheduled'
  ), ahead as (                                    -- RULES.tapLookahead
    select m.team_id from mat m
    where m.unconfirmed
      and (not v_has_anchor or (m.scheduled_at, m.team_id) > (a.scheduled_at, a.team_id))
    order by m.scheduled_at, m.team_id
    limit 2
  ), behind as (                                   -- RULES.tapLookbehind: nearest unconfirmed before the anchor
    select m.team_id from mat m
    where v_has_anchor and m.unconfirmed
      and (m.scheduled_at, m.team_id) < (a.scheduled_at, a.team_id)
    order by m.scheduled_at desc, m.team_id desc
    limit 2
  )
  select exists (select 1 from ahead where team_id = p_team)
      or exists (select 1 from behind where team_id = p_team)
      or coalesce(v_has_anchor and a.team_id = p_team, false)
  into v_candidate;
  if not v_candidate then
    return 'not-next';
  end if;

  -- 4. a new routine needs minGapSeconds after the anchor's start
  if v_has_anchor and a.team_id <> p_team and p_at_ms < a.start_ms + 120000 then  -- RULES.minGapSeconds
    return 'too-soon';
  end if;

  -- 5. (server) operator starts are final; crowd starts stop taking taps once
  --    no backdated tap could still land inside the freeze.
  select st.source, judgey_private.ms(st.confirmed_at) as confirmed_ms into s
  from public.routine_starts st where st.meet_id = p_meet and st.team_id = p_team;
  if found and (s.source = 'operator'
                or p_now_ms > coalesce(s.confirmed_ms, 0) + 90000 + 120000) then  -- freezeSeconds + maxTapAgeSeconds
    return 'already-confirmed';
  end if;
  return null;
end;
$$;

-- divisionReveal (src/results.ts): a division is revealed when each of its
-- non-scratched routines is closed (start + window + grace < now), or skipped
-- with a later confirmed routine on its mat already closed; or, at the latest,
-- revealFallbackMinutes after its last scheduled routine (scratched included).
create function judgey_private.division_reveal(
  p_meet text, p_now_ms bigint, out revealed text[], out pending text[]
)
language sql stable security definer set search_path = '' as $$
  with r as (
    select ro.team_id, ro.mat, ro.division, ro.status, ro.scheduled_at,
           case when ro.status = 'scheduled' then judgey_private.ms(st.started_at) end as start_ms
    from public.routines ro
    left join public.routine_starts st on st.meet_id = ro.meet_id and st.team_id = ro.team_id
    where ro.meet_id = p_meet
  ), anchor as (
    select distinct on (r.mat) r.mat, r.scheduled_at, r.team_id
    from r where r.start_ms is not null
    order by r.mat, r.scheduled_at desc, r.team_id desc
  ), state as (
    select r.*,
           coalesce(r.start_ms + 660000 < p_now_ms, false) as closed,  -- votingWindow 10 min + grace 60 s
           coalesce(r.status = 'scheduled' and r.start_ms is null
                    and (r.scheduled_at, r.team_id) < (a.scheduled_at, a.team_id), false) as skipped
    from r left join anchor a on a.mat = r.mat
  ), done as (
    select x.division, x.scheduled_at,
           x.status = 'scratched' or x.closed
             or (x.skipped and exists (
                   select 1 from state l
                   where l.mat = x.mat and l.closed
                     and (l.scheduled_at, l.team_id) > (x.scheduled_at, x.team_id))) as finished
    from state x
  ), d as (
    select done.division,
           bool_and(done.finished)
             or p_now_ms > judgey_private.ms(max(done.scheduled_at)) + 90 * 60000 as is_revealed  -- RULES.revealFallbackMinutes
    from done group by done.division
  )
  select coalesce(array_agg(d.division order by d.division) filter (where d.is_revealed), '{}'),
         coalesce(array_agg(d.division order by d.division) filter (where not d.is_revealed), '{}')
  from d
$$;

-- computeBoard (src/results.ts) from team_tallies: no ballot scan.
-- Qualifying = teams in revealed divisions with votes >= minVotes. Order:
-- (priorStarSum + starSum) / (priorVotes + votes) desc by integer
-- cross-multiplication, then votes desc, then team_id (collate "C"). Shows
-- min(topN, floor(qualifying / 2)). Award winners: highest count / votes share
-- (cross-multiplied), then votes desc, then team_id; null if no qualifying team has one.
create function judgey_private.board(p_meet text, p_now_ms bigint) returns json
language sql stable security definer set search_path = '' as $$
  with rv as (
    select * from judgey_private.division_reveal(p_meet, p_now_ms)
  ), q as (
    select t.team_id, t.votes::bigint as votes, t.star_sum::bigint as star_sum,
           t.stunts, t.tumbling, t.spirit, t.dance
    from judgey_private.team_tallies t
    join public.routines ro on ro.meet_id = t.meet_id and ro.team_id = t.team_id
    cross join rv
    where t.meet_id = p_meet
      and t.votes >= 5                                            -- RULES.minVotes
      and ro.division = any (rv.revealed)
  ), ranked as (
    -- pos = how many teams beat this one, counted only up to topN (nobody past
    -- that is ever shown), which keeps the pairwise comparison cheap.
    select a.team_id, a.votes, a.star_sum,
           (select count(*) from (
              select 1 from q b
              where (35 + b.star_sum) * (10 + a.votes) > (35 + a.star_sum) * (10 + b.votes)  -- priorStarSum, priorVotes
                 or ((35 + b.star_sum) * (10 + a.votes) = (35 + a.star_sum) * (10 + b.votes)
                     and (b.votes > a.votes or (b.votes = a.votes and b.team_id < a.team_id)))
              limit 5) better) as pos                                        -- RULES.topN
    from q a
  ), shown as (
    select * from ranked
    where pos < least(5, (select count(*) from q) / 2)           -- RULES.topN, half rule
  ), shout as (
    select q.team_id, q.votes, x.award, x.n::bigint as n
    from q cross join lateral (values ('stunts', q.stunts), ('tumbling', q.tumbling),
                                      ('spirit', q.spirit), ('dance', q.dance)) x(award, n)
    where x.n > 0
  ), winners as (
    select a.award, a.team_id from shout a
    where not exists (
      select 1 from shout b
      where b.award = a.award
        and (b.n * a.votes > a.n * b.votes
             or (b.n * a.votes = a.n * b.votes
                 and (b.votes > a.votes or (b.votes = a.votes and b.team_id < a.team_id)))))
  )
  select json_build_object(
    'top', coalesce((
      select json_agg(json_build_object(
               'teamId', s.team_id,
               'votes', s.votes,
               -- tenths, half-up, integers only: floor((2·10·(35+sum) + (10+votes)) / (2·(10+votes))) / 10
               'rating', round(((20 * (35 + s.star_sum) + (10 + s.votes)) / (2 * (10 + s.votes)))::numeric / 10, 1))
             order by s.pos)
      from shown s), '[]'::json),
    'awards', json_build_object(
      'stunts', (select w.team_id from winners w where w.award = 'stunts'),
      'tumbling', (select w.team_id from winners w where w.award = 'tumbling'),
      'spirit', (select w.team_id from winners w where w.award = 'spirit'),
      'dance', (select w.team_id from winners w where w.award = 'dance')),
    'revealedDivisions', (select to_json(rv.revealed) from rv),
    'pendingDivisions', (select to_json(rv.pending) from rv))
$$;

-- computeRecaps (src/results.ts): the caller's current home teams (deduped, in
-- order) whose voting is closed. Votes hidden below recapMinVotes; non-zero
-- shout-outs only; rank = 1-based place on the shown board.
create function judgey_private.recaps(p_meet text, p_home text[], p_now_ms bigint, p_board json) returns json
language sql stable security definer set search_path = '' as $$
  with home as (
    select h.team_id, min(h.ord) as ord
    from unnest(coalesce(p_home, '{}')) with ordinality h(team_id, ord)
    where h.team_id is not null
    group by h.team_id
  )
  select coalesce(json_agg(json_build_object(
           'teamId', ro.team_id,
           'votes', case when t.votes >= 10 then t.votes end,      -- RULES.recapMinVotes
           'awards', (select coalesce(json_object_agg(x.award, x.n order by x.k), '{}'::json)
                      from (values (1, 'stunts', t.stunts), (2, 'tumbling', t.tumbling),
                                   (3, 'spirit', t.spirit), (4, 'dance', t.dance)) x(k, award, n)
                      where x.n > 0),
           'rank', (select e.ord::int
                    from json_array_elements(p_board -> 'top') with ordinality e(entry, ord)
                    where e.entry ->> 'teamId' = ro.team_id))
         order by home.ord), '[]'::json)
  from home
  join public.routines ro on ro.meet_id = p_meet and ro.team_id = home.team_id and ro.status = 'scheduled'
  join public.routine_starts st on st.meet_id = ro.meet_id and st.team_id = ro.team_id
  left join judgey_private.team_tallies t on t.meet_id = ro.meet_id and t.team_id = ro.team_id
  where judgey_private.ms(st.started_at) + 660000 < p_now_ms           -- closed: window + grace
$$;

-- Retention (§9): drop everything tied to an identity for one meet, keeping the
-- running order, starts and aggregate tallies. Run 30 days after the meet.
create function judgey_private.purge_meet(p_meet text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_fans int;
  v_taps int;
  v_ballots int;
  v_visits int;
begin
  delete from public.fans where meet_id = p_meet;
  get diagnostics v_fans = row_count;
  delete from public.taps where meet_id = p_meet;
  get diagnostics v_taps = row_count;
  delete from public.ballots where meet_id = p_meet;
  get diagnostics v_ballots = row_count;
  delete from public.visits where meet_id = p_meet;
  get diagnostics v_visits = row_count;
  delete from judgey_private.meet_operators where meet_id = p_meet;
  delete from judgey_private.operator_attempts where meet_id = p_meet;
  delete from judgey_private.operator_codes where meet_id = p_meet;
  return json_build_object('fans', v_fans, 'taps', v_taps, 'ballots', v_ballots, 'visits', v_visits);
end;
$$;

-- Nobody but the owner may call a private helper (functions default to PUBLIC execute).
revoke all on all functions in schema judgey_private from public, anon, authenticated;
