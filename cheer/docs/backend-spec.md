# Judgey Backend Spec (v1: real phones share taps and votes)

Status: DRAFT for design review · Owner: cheer/ · Target: the real meet ~early Dec 2026

## Goals

1. Real phones at the same meet share **"took the mat" taps** (so ETAs and voting
   windows are the same for everyone) and **votes** (so Crowd Favorites are real).
2. Server is the source of truth for every rule a cheater would want to bend:
   own-team block, voting window, one ballot per person per routine, star range,
   valid shout-outs, and **only top-5 results ever leave the database**.
3. Demo mode keeps working with zero config (no env vars → demo only).
4. Cheap at meet scale: ~500 phones, ~100 routines, ~30k ballots per meet day.
   Realtime volume must stay well inside Supabase Pro quotas.
5. Portable: everything lives in `cheer/` (migrations, tests, scripts) so the
   folder can move to its own repo unchanged.

Non-goals (v1): accounts/login UI, athlete-level data (minors), producer admin
UI (meets are seeded by script), offline write queue (follow-up), push
notifications (follow-up).

## Platform

- Supabase project **Judgey** (us-east-1), Postgres 17, Realtime, Auth.
- **Identity = Supabase anonymous auth** (`supabase.auth.signInAnonymously()`).
  Every phone gets a real `auth.uid()` without a login screen; RLS keys off it.
  GoTrue rate-limits anonymous sign-ins per IP, which makes ballot stuffing
  much harder than client-minted device ids. Requires the dashboard toggle
  *Authentication → Sign In / Providers → Allow anonymous sign-ins*.
  (Hardening before going wide: Turnstile captcha on anonymous sign-in.)
- Client: `@supabase/supabase-js` v2 in the browser only, using
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key).
  No server routes, no service-role key in the app.

## Data model (`public` schema, dedicated project)

```
meets            id text PK (slug ^[a-z0-9-]{3,64}$), name, venue, city,
                 time_zone (IANA), starts_at timestamptz, mats text[],
                 listed boolean default true, created_at
routines         (meet_id → meets, team_id text) PK, team_name, gym, division,
                 mat text, scheduled_at timestamptz
                 -- v1: one routine per team per meet. Two-day events = two meets.
fans             (meet_id, user_id uuid) PK, home_team_ids text[] default '{}',
                 checked_in_at, updated_at
taps             (meet_id, team_id, user_id) PK, at timestamptz default now()
                 -- one tap per person per routine; first tap wins (matches TS)
routine_starts   (meet_id, team_id) PK, started_at timestamptz,
                 confirmations int, updated_at
                 -- DERIVED from taps; the only table on the realtime publication
ballots          (meet_id, team_id, user_id) PK, stars smallint 1..5,
                 awards text[] ⊆ {stunts,tumbling,spirit,dance} (deduped),
                 cast_at timestamptz default now()
```

FKs: routines→meets, fans/taps/ballots/routine_starts → routines(meet_id, team_id)
where a team is referenced (fans.home_team_ids validated in the RPC).
Indexes for the hot paths: taps by (meet_id, team_id), ballots by (meet_id, team_id).

## Security (RLS on every table)

| Table | anon | authenticated |
|---|---|---|
| meets, routines, routine_starts | select | select |
| fans, taps, ballots | — | select **own rows only** (`user_id = auth.uid()`) |

- **No insert/update/delete policies anywhere.** All writes go through
  `SECURITY DEFINER` RPCs with `set search_path = ''` and fully qualified names.
  Also `revoke insert, update, delete` on all tables from anon/authenticated.
- Nobody can read anyone else's ballots, taps or check-ins. Aggregates leave the
  DB only through `meet_results()` and only as top-5 + shout-out winners +
  the caller's own home-team recaps.
- `revoke execute ... from public` on every function, then grant explicitly:
  write RPCs → `authenticated`; `meet_results` → `anon, authenticated`;
  admin/seed functions → nobody (run as postgres/service role via migration
  tooling).
- Note: anonymous users have role `authenticated` in Supabase (with
  `is_anonymous` claim). That's intended here: every Judgey user is anonymous.

## RPCs (the rules, mirrored from `src/voting.ts` / `src/schedule.ts`)

All time comparisons use the **server's `now()`**; client clocks are never trusted.
Constants (keep in sync with TS): early-tap cutoff 45 min before scheduled,
min 2 distinct taps to confirm, voting window 10 min after confirmed start,
Bayesian prior 10 votes @ 3.5, min 5 votes to qualify, top 5.

### `check_in(p_meet text, p_home_team_ids text[]) → json`
- Requires `auth.uid()`. Meet must exist. Every id must be a routine in that
  meet; dedupe; max 10.
- **Anti-exploit:** once the caller has cast any ballot in this meet, they may
  add home teams but not remove any (prevents "un-follow my team, vote, re-follow").
- Upsert `fans`. Returns the saved profile.

### `tap_mat(p_meet text, p_team text) → json { confirmed, started_at, confirmations, reason? }`
- Requires `auth.uid()` and a `fans` row for the meet (must be checked in).
- Routine must exist. Reject with `reason: 'too-early'` if
  `now() < scheduled_at - 45 min`; `'too-late'` if `now() > scheduled_at + 6 h`.
- **Concurrency:** `SELECT ... FROM routines ... FOR UPDATE` first, so taps on
  the same routine serialize. (Without this, two simultaneous first taps each
  see count = 1 and the routine never confirms.)
- Insert tap `on conflict do nothing`.
- Recompute over that routine's taps with `at >= scheduled_at - 45 min`:
  if distinct users ≥ 2 → `started_at = percentile_cont(0.5)` of tap times
  (odd → middle, even → mean of the two middles; matches TS), truncated to ms;
  upsert `routine_starts` only if the value or count changed.

### `cast_ballot(p_meet text, p_team text, p_stars int, p_awards text[]) → json { ok, reason? }`
Reasons are the same codes as TS `BallotError.reason`, checked in this order:
1. not checked in → `'not-checked-in'` (new code; client sends user to check-in)
2. team ∈ caller's `home_team_ids` → `'own-team'`
3. no `routine_starts` row, or `now()` outside `[started_at, started_at + 10 min]` → `'window-closed'`
4. caller already has a ballot for this routine → `'already-voted'`
5. stars not integer 1..5, or any award not in the allowed set → `'invalid'`
Insert with `on conflict do nothing`; a lost race also returns `'already-voted'`.

### `meet_results(p_meet text) → json`
```
{ top:    [{ teamId, votes, rating }]            -- ≤ 5, rating desc, votes desc, teamId asc
  awards: { stunts|tumbling|spirit|dance: { teamId, votes, count } | null }
  recaps: [{ teamId, votes, awards: {stunts,tumbling,spirit,dance}, rank|null }]
  closedTeamIds: [teamId] }
```
- Only ballots for routines whose window has **closed**
  (`started_at + 10 min < now()`) count.
- `rating = (10*3.5 + sum(stars)) / (10 + votes)`; qualify with `votes ≥ 5`.
- Award winner = highest share `count/votes` among qualifying teams with
  `count > 0`; tie-break votes desc, teamId asc (TS `awardWinner` updated to the
  same tie-break).
- `recaps` only for the caller's own `home_team_ids` (empty for anon/unchecked).
  No averages in recaps (positive by design).

### Seeding (admin only)
- `scripts/meet-sql.ts` generates idempotent SQL (`insert ... on conflict do update`)
  from a `Meet` object (demo roster or, later, a parsed running order), with
  `--id`, `--name`, `--start <ISO>`, `--slot-minutes`. Never hand-write rows.
  Run it via the Supabase SQL editor / MCP as the postgres role.

## Realtime & freshness

- Publication `supabase_realtime` includes **only `routine_starts`**.
  Clients subscribe to `postgres_changes` (`INSERT`/`UPDATE`,
  `filter: meet_id=eq.<id>`). ~100 routines × a few updates × 500 phones
  ≈ 100–200k messages per meet day (taps/ballots never broadcast).
- Results are pulled, not pushed: `meet_results` on load, every 30 s while
  visible, and right after any voting window closes.
- Phones sleep and lose sockets in arenas: on `visibilitychange → visible` and
  `online`, refetch everything (starts, my rows, results) and resubscribe.
  Show a small "Reconnecting…" chip while the channel isn't `SUBSCRIBED`.

## Client architecture

- `src/schedule.ts` / `src/board.ts`: refactor to work from
  `Starts = Map<teamId, Timestamp>` (confirmed starts). `confirmedStarts(slots, taps)`
  derives them from taps (used by demo + tests); live mode gets them from
  `routine_starts`. `matDrift`, `etaFor`, `buildBoards` take `starts`.
- `src/results.ts`: `MeetResults` type (= `meet_results` JSON shape) and
  `computeResults(ballots, closedTeamIds, homeTeamIds)` built on `voting.ts`,
  so demo and live render through the same type.
- `lib/supabase.ts`: lazy browser client + `ensureSession()` (anonymous sign-in
  once, session persisted by supabase-js). `isLiveEnabled` = both env vars set.
- `lib/sources/demo.ts` and `lib/sources/live.ts` both produce one `MeetView`:
  `{ mode, meet, now, ready, status, error?, starts, boards, checkedIn,
  homeTeamIds, myTaps:Set, myBallots:Map, results, actions:{ checkIn, tap, vote } }`.
  `useMeet()` picks the source from the device store's `meetId`
  (`'demo'` → demo; anything else → live).
- `lib/store.ts` (localStorage) keeps device-level state only: selected `meetId`,
  demo-mode taps/ballots/check-in, dismissed alerts, demo clock.
- Check-in page: meet picker (listed live meets from Supabase when configured,
  plus the demo meet). `/?meet=<id>` preselects (for QR codes).
- Errors map to the existing friendly copy (`OWN_TEAM_MESSAGE`, etc.).

## Testing

- `test/*.test.ts` (node:test) keeps covering pure TS.
- `test/db.test.ts`: runs only when `JUDGEY_TEST_DATABASE_URL` is set (skips
  otherwise). Creates a throwaway database, loads `supabase/tests/bootstrap.sql`
  (Supabase shims: roles `anon`/`authenticated`/`service_role`, `auth.uid()`
  reading `request.jwt.claims`, `supabase_realtime` publication), applies every
  migration in order, then exercises each RPC as different users via
  `set local role authenticated; set local request.jwt.claims = '{"sub": ...}'`.
  Covers every rejection reason, RLS isolation (can't read others' rows,
  can't write tables directly), concurrency of confirmations, median parity
  with TS `confirmedStart`, results parity with TS `computeResults` on the same
  ballots, and top-5-only output.
- Local: `JUDGEY_TEST_DATABASE_URL=postgres://judgey_test:judgey@localhost:5432/postgres npm run test:db`.
- After provisioning: `get_advisors` (security + performance) must be clean,
  then a two-browser live check (two anonymous users, shared confirm, vote,
  own-team block, results).
