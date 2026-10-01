# Judgey Backend Spec v2 (real phones share taps and votes)

Status: APPROVED FOR BUILD (v2, after a 65-agent design review that kept 41 findings
and folded them in below) · Target: the real meet ~early Dec 2026

This spec is the **contract** between three parts that are built in parallel:
pure TS domain logic (`src/`), the database (`supabase/`), and the client
(`lib/`, `components/`, `app/`). Names, signatures, constants and JSON shapes
below are binding. If one part needs to deviate, update this file first.

## 1. Goals and non-goals

1. Real phones at the same meet share **"took the mat" taps** (so ETAs and voting
   windows match for everyone) and **votes** (so Crowd Favorites are real).
2. **The ETA never depends on signing in.** The running order, confirmed starts
   and the public board are readable without a session. A failed or
   rate-limited sign-in only blocks tapping and voting, and those retry in the background.
3. The server enforces every rule a cheater would want to bend: tap
   sequencing, own-team block, voting window, one ballot per identity per
   routine, star range, valid shout-outs, and **only the top half (max 5) of
   revealed teams ever leaves the database**.
4. One bad tap pair, a scratched team or an empty section can't wreck a
   mat, and a trusted **operator** can fix any start in one tap.
5. Works on bad arena signal: cached running order, last-known starts, tap
   outbox with bounded backdating, ballot grace.
6. Cheap and quota-safe at ~500 phones, ~100 routines and ~30k ballots per day: **no
   Realtime in v1**. Clients poll one small snapshot RPC.
7. Demo mode keeps working with zero config. Everything lives in `cheer/`.

Non-goals for v1: accounts/login UI, athlete-level data (minors), free-text
fields of any kind (no comments or nicknames; shout-outs are a fixed enum),
push notifications (follow-up: Web Push), Realtime (follow-up: private
Broadcast from the DB), a producer admin UI (meets come from the CSV import
script).

## 2. Rules and constants (`src/rules.ts`; SQL mirrors them exactly)

```ts
export const RULES = {
  earlyTapMinutes: 45,      // taps earlier than scheduledAt - 45 min are rejected ('too-early')
  minTaps: 2,               // default; per-meet override meets.min_taps / Meet.minTaps
  clusterSeconds: 120,      // a confirmation needs minTaps distinct taps within 120 s of each other
  freezeSeconds: 90,        // taps later than (confirming tap + 90 s) are ignored
  maxTapAgeSeconds: 120,    // client-reported tap age is clamped to [0, 120] s
  minGapSeconds: 120,       // no new routine on a mat within 120 s of the anchor's start ('too-soon')
  tapLookahead: 2,          // next 2 unconfirmed routines after the anchor are tappable
  tapLookbehind: 2,         // up to 2 skipped routines just before the anchor stay tappable (swaps)
  votingWindowMinutes: 10,  // UI window: [start, start + 10 min]
  ballotGraceSeconds: 60,   // server still accepts ballots until start + 10 min + 60 s
  routineMinutes: 3,        // on-mat display length
  breakExtraMinutes: 5,     // a schedule gap > usualGap + 5 min is a break that absorbs positive drift
  priorVotes: 10, priorStarSum: 35, // Bayesian prior: 10 votes averaging 3.5 stars
  minVotes: 5,              // to qualify for the board
  topN: 5,                  // board shows min(topN, floor(qualifying / 2)) teams
  recapMinVotes: 10,        // recaps show the vote count only at >= 10
  revealFallbackMinutes: 90,// a division reveals 90 min after its last scheduled routine at the latest
  maxHomeTeams: 10,
} as const;
```

Definitions (identical in TS and SQL; all times are **integer epoch ms** in TS;
SQL truncates every stored time to milliseconds with `date_trunc('milliseconds', …)`):

- **Anchor of a mat:** the confirmed (non-scratched) routine with the latest
  `scheduledAt` on that mat. Drift = anchor.start − anchor.scheduledAt (0 if no anchor).
- **Confirmed start** (`confirmedStart`): take the routine's taps with
  `at >= scheduledAt − earlyTapMinutes`, keep the **first tap per identity**, and sort by
  `at` (ties broken by identity id, `C` collation). Scan `j = minTaps−1 … n−1` and take
  the first `j` with `t[j] − t[j−minTaps+1] <= clusterSeconds`; call `i = j−minTaps+1`
  and `c = t[j]` (the confirming tap). If none exists, the routine is unconfirmed.
  The **counted taps** are those with `t[i] <= at <= c + freezeSeconds`. Start = their
  median: odd → middle; even → `Math.floor((a + b + 1) / 2)` of the two middles
  (integer ms; equals `Math.round` for positive values).
- **Operator starts override crowd starts.** An operator start is stored as-is.
- **Tappable** (`tapRejection` returns null) for routine R on mat M at `now`:
  1. R exists → else `'unknown-team'`; R not scratched → else `'scratched'`.
  2. `now >= R.scheduledAt − earlyTapMinutes` → else `'too-early'`.
  3. Candidates = the next `tapLookahead` unconfirmed non-scratched routines after
     the anchor in scheduled order (the first `tapLookahead` if there is no anchor),
     **plus** R itself if it is the anchor (more confirmations), **plus** up to
     `tapLookbehind` unconfirmed non-scratched routines immediately before the
     anchor (late or swapped teams). R ∉ candidates → `'not-next'`.
  4. If R is not the anchor and the anchor exists: `now >= anchor.start + minGapSeconds`
     → else `'too-soon'`.
  5. (Server only) If R is confirmed by the crowd and `now > c + freezeSeconds + maxTapAgeSeconds`
     → `'already-confirmed'`; operator-set routines also return `'already-confirmed'`.
- **Status of a routine** (`Eta.status`): `'scratched'`; confirmed → `'on-mat'`
  while `now < start + routineMinutes`, else `'done'`; unconfirmed and scheduled
  before the anchor → `'skipped'` (no countdown, no alerts); otherwise `'upcoming'`.
- **Estimated start** (`estimateStarts`): confirmed → its start. For unconfirmed,
  non-scratched routines after the anchor, walk forward from the anchor in scheduled order:
  `usualGap` = median of consecutive scheduled gaps on that mat (non-scratched;
  even count → floor mean of the two middles). For each next slot k with gap `g = sched(k) − sched(k−1)`:
  if `g > usualGap + breakExtraMinutes` (a break) **and** the running drift
  `est(k−1) − sched(k−1) > 0` → `est(k) = max(sched(k), est(k−1) + usualGap)`;
  otherwise `est(k) = est(k−1) + g`. With no anchor, `est = sched`.
  Skipped routines estimate `= sched`. Scratched → none.
- **Voting:** open in the UI for `now ∈ [start, start + window]`; the server accepts
  until `start + window + grace`. A routine is **closed** when
  `start + window + grace < now`.
- **Own-team block:** keyed on `everHomeTeamIds`, the monotonic union of every
  team the identity has ever followed in this meet. `homeTeamIds` (used for ETAs
  and alerts) can be edited freely. When check-in *newly* adds a team the identity
  already voted for, that ballot is deleted (and un-counted) in the same
  transaction. This is a fairness nudge, not a security boundary (a second browser
  defeats it), and the spec says so.
- **Division reveal:** division D is revealed at `now` when, for every
  non-scratched routine r in D, r is **closed**, or r is **skipped** and some
  later-scheduled confirmed routine on r's mat is closed, **or** when
  `now > max(scheduledAt in D) + revealFallbackMinutes`.
- **Board:** qualifying = teams in revealed divisions with `votes >= minVotes`.
  Sort by exact rating `(priorStarSum + starSum) / (priorVotes + votes)`, compared
  with **integer cross-multiplication** (never floats), then votes desc, then
  teamId asc (byte order / `collate "C"`). Show the first
  `min(topN, floor(qualifying / 2))`. Published rating = tenths, rounded half-up
  with integers: `floor((2·10·(35+starSum) + (10+votes)) / (2·(10+votes))) / 10`.
  Award winner per shout-out = among qualifying teams with count > 0, highest share
  `count / votes` (cross-multiplied), then votes desc, then teamId asc; `null` if none.
- **Recaps** (for the caller's *current* `homeTeamIds`, closed teams only):
  `{ teamId, votes: votes >= recapMinVotes ? votes : null, awards: {nonzero counts only},
  rank: 1-based position on the shown board or null }`. Anyone can follow any team,
  so recaps are effectively public; they're designed to be harmless (no averages, no
  small counts, no zeros).

## 3. Pure TS API (owned by `src/`, consumed by demo, client and parity tests)

```ts
// src/types.ts (additions)
export type RoutineStatus = 'scheduled' | 'scratched';
export interface Slot { teamId: string; mat: string; scheduledAt: Timestamp; status?: RoutineStatus }
export interface Meet { …existing…; minTaps?: number }
export interface FanProfile { deviceId: string; homeTeamIds: string[]; everHomeTeamIds: string[] }

// src/schedule.ts
export type Starts = Map<string, Timestamp>;                 // teamId → confirmed start
export function confirmedStart(slot: Slot, taps: MatTap[], minTaps?: number): Timestamp | undefined;
export function confirmedStarts(meet: Meet, taps: MatTap[]): Starts;   // skips scratched; uses meet.minTaps
export function anchorOf(meet: Meet, starts: Starts, mat: string): Slot | undefined;
export function matDrift(meet: Meet, starts: Starts, mat: string): number;   // ms
export function estimateStarts(meet: Meet, starts: Starts): Map<string, Timestamp>;
export type TapRejection = 'unknown-team' | 'scratched' | 'too-early' | 'not-next' | 'too-soon';
export function tapRejection(meet: Meet, starts: Starts, teamId: string, now: Timestamp): TapRejection | null;
export interface Eta { teamId: string; scheduledAt: Timestamp; estimatedAt: Timestamp; driftMinutes: number;
  status: 'upcoming' | 'on-mat' | 'done' | 'skipped' | 'scratched' }
export function etaFor(meet: Meet, starts: Starts, teamId: string, now: Timestamp): Eta | undefined;
export function dueAlerts(eta: Eta, now: Timestamp, leads?: Minutes[]): Minutes[];  // [] unless 'upcoming'

// src/board.ts
export interface RoutineRow { slot: Slot; team: Team; eta: Eta; startedAt?: Timestamp;
  votingOpen: boolean; votingClosesAt?: Timestamp; tappable: boolean }
export interface MatBoard { mat: string; driftMinutes: number; lastConfirmedAt?: Timestamp;
  rows: RoutineRow[]; onMat?: RoutineRow; upNext?: RoutineRow; tapCandidates: RoutineRow[] }
export function buildBoards(meet: Meet, starts: Starts, now: Timestamp): MatBoard[];
export function findRow(boards: MatBoard[], teamId: string): RoutineRow | undefined;

// src/voting.ts (changes)
// TeamTally gains integer starSum; averageStars = starSum / votes; tie-breaks per §2.
export type BallotReason = 'not-checked-in' | 'own-team' | 'window-closed' | 'already-voted' | 'invalid';
export function validateBallot(ballot: Ballot, ctx: { profile: FanProfile | null;
  teamStartedAt: Timestamp | undefined; existing: Ballot[] }): BallotError | null; // uses castAt vs window+grace
export function applyCheckIn(prev: FanProfile | null, deviceId: string, nextHome: string[],
  myBallots: Ballot[]): { profile: FanProfile; removedBallotTeamIds: string[] };
export const BALLOT_MESSAGES: Record<BallotReason, string>;   // friendly copy (own-team = OWN_TEAM_MESSAGE)

// src/results.ts (new)
export interface BoardEntry { teamId: string; votes: number; rating: number }  // rating in tenths/10
export interface MeetBoard { top: BoardEntry[]; awards: Record<Award, string | null>;
  revealedDivisions: string[]; pendingDivisions: string[] }   // divisions sorted asc (C order)
export interface Recap { teamId: string; votes: number | null; awards: Partial<Record<Award, number>>; rank: number | null }
export function isClosed(start: Timestamp | undefined, now: Timestamp): boolean;
export function divisionReveal(meet: Meet, starts: Starts, now: Timestamp): { revealed: string[]; pending: string[] };
export function computeBoard(meet: Meet, starts: Starts, ballots: Ballot[], now: Timestamp): MeetBoard;
export function computeRecaps(meet: Meet, starts: Starts, ballots: Ballot[], homeTeamIds: string[],
  now: Timestamp, board: MeetBoard): Recap[];
```

The demo crowd (`src/demo/crowd.ts`) must produce taps and ballots that satisfy these
rules: taps go only on tappable routines, and ballots fall inside the window.

## 4. Database (`supabase/migrations/`, Postgres 17 on Supabase; tested locally on 16)

Schemas: `public` (API surface: tables readable per §5, plus the RPCs in §6) and
`judgey_private` (helpers, counters, operator secrets; **not exposed**,
`revoke all on schema judgey_private from public, anon, authenticated`).
`pgcrypto` lives in `extensions` (Supabase default); use `extensions.crypt` and `extensions.gen_salt`.

```sql
public.meets(id text pk check (id ~ '^[a-z0-9-]{3,64}$'), name text not null, venue text not null default '',
  city text not null default '', time_zone text not null, starts_at timestamptz not null,
  mats text[] not null, min_taps int not null default 2 check (min_taps between 2 and 5),
  schedule_version int not null default 1, created_at timestamptz not null default now())
public.routines(meet_id text references meets on delete cascade, team_id text check (team_id ~ '^[a-z0-9-]{1,80}$'),
  team_name text not null, gym text not null, division text not null, mat text not null,
  scheduled_at timestamptz not null, status text not null default 'scheduled' check (status in ('scheduled','scratched')),
  primary key (meet_id, team_id))
public.routine_starts(meet_id, team_id, primary key (meet_id, team_id), foreign key → routines,
  started_at timestamptz not null, source text not null check (source in ('crowd','operator')),
  confirmed_at timestamptz,            -- the confirming tap's time c (crowd only)
  confirmations int not null default 0, updated_at timestamptz not null default now())
public.fans(meet_id → meets, user_id uuid, primary key (meet_id, user_id),
  home_team_ids text[] not null default '{}', ever_home_team_ids text[] not null default '{}',
  checked_in_at timestamptz not null default now(), updated_at timestamptz not null default now())
public.taps(meet_id, team_id → routines, user_id uuid, at timestamptz not null, primary key (meet_id, team_id, user_id))
public.ballots(meet_id, team_id → routines, user_id uuid, primary key (meet_id, team_id, user_id),
  stars smallint not null check (stars between 1 and 5),
  awards text[] not null default '{}' check (awards <@ array['stunts','tumbling','spirit','dance']::text[]),
  cast_at timestamptz not null)
public.visits(meet_id → meets, user_id uuid, bucket timestamptz, src text check (src ~ '^[a-z0-9-]{1,32}$'),
  primary key (meet_id, user_id, bucket))          -- 15-min buckets, for measuring the test day
judgey_private.team_tallies(meet_id, team_id pk → routines, votes int, star_sum int,
  stunts int, tumbling int, spirit int, dance int)  -- all not null default 0; maintained by cast_ballot/check_in
judgey_private.operator_codes(meet_id pk → meets, code_hash text not null)
judgey_private.meet_operators(meet_id → meets, user_id uuid, primary key (meet_id, user_id))
judgey_private.operator_attempts(meet_id, user_id, attempts int, primary key (meet_id, user_id))
```

## 5. Security and grants (explicit, independent of Supabase's 2026 default-privilege modes)

The first migration, before any CREATE:
```sql
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
```
After each CREATE: `revoke all on table public.X from anon, authenticated;` or
`revoke all on function public.f(<args>) from public, anon, authenticated;`, then
exactly these grants:

| Object | anon | authenticated |
|---|---|---|
| `meets`, `routines`, `routine_starts` | `select` | `select` |
| `fans`, `taps`, `ballots`, `visits` | — | `select` (RLS: own rows only) |
| `meet_snapshot(text,int)` | execute | execute |
| `my_state`, `check_in`, `tap_mat`, `cast_ballot`, `touch`, `claim_operator`, `op_set_start`, `op_set_status` | — | execute |
| everything in `judgey_private` | — | — |

- RLS is enabled on every public table. Policies: `select` using `true` on
  meets/routines/routine_starts (to anon, authenticated); `select` using
  `user_id = (select auth.uid())` on fans/taps/ballots/visits (to authenticated).
  **No insert/update/delete policies anywhere.**
- Every function: `security definer`, `set search_path = ''`, fully qualified names.
  Write RPCs are `volatile` (POST); `meet_snapshot` is `stable`.
- NULL safety: every parameter is coalesced or rejected; boolean checks are wrapped
  in `coalesce(…, false)`.
- Supabase advisor lints 0028/0029 are **expected** on exactly the RPCs listed above
  (they're intentional public endpoints that validate their inputs). Any other advisor
  finding blocks launch.
- Tests run the whole DB suite in **both** modes: (a) no default privileges, and
  (b) legacy Supabase default grants (`grant all on tables / execute on functions to
  anon, authenticated, service_role`). In both modes they assert exact ACLs with
  `has_table_privilege`/`has_function_privilege` (including TRUNCATE) for every
  table and function in `public` and `judgey_private`.

## 6. RPCs (all JSON in camelCase, times as integer epoch ms)

`auth.uid()` is required for everything except `meet_snapshot`; without it, raise
`'not-authenticated'` (SQLSTATE 28000).

### `meet_snapshot(p_meet text, p_have_version int default 0) → json` (stable, anon)
```
{ serverNow, meetId, scheduleVersion,
  schedule: null | { meet: { id, name, venue, city, timeZone, startsAt, mats, minTaps },
                     routines: [{ teamId, teamName, gym, division, mat, scheduledAt, status }] },
                     -- included only when p_have_version <> scheduleVersion
  starts: [{ teamId, startedAt, source }],
  board: MeetBoard }                       -- from judgey_private.team_tallies, rules §2
```
Unknown meet → `null`. Polled every 15 s ± 3 s jitter while visible.

### `my_state(p_meet text) → json` (authenticated)
`{ serverNow, fan: null | { homeTeamIds, everHomeTeamIds }, tappedTeamIds: [], ballots: [{ teamId, stars, awards }], recaps: Recap[], isOperator }`

### `check_in(p_meet text, p_home_team_ids text[]) → json`
Dedupe; null or empty → `{}`; more than `maxHomeTeams` → `{ok:false, reason:'too-many'}`;
an unknown or scratched id → `{ok:false, reason:'unknown-team'}`; unknown meet →
`{ok:false, reason:'unknown-meet'}`. Lock the fans row (`for update`; insert if
missing). `ever = ever ∪ new`. For teams newly added to `ever` that the caller
already has a ballot for: delete those ballots and decrement `team_tallies`.
Upsert. Returns `{ ok:true, fan:{homeTeamIds, everHomeTeamIds}, removedBallotTeamIds }`.

### `tap_mat(p_meet text, p_team text, p_age_ms int default 0) → json`
`at = date_trunc('milliseconds', now() − clamp(coalesce(p_age_ms,0), 0, 120000) ms)`.
Lock the routine row (`select … for no key update`; it serializes taps per routine
without blocking ballot FK checks). Check `tapRejection` rules §2 against `at`
(server version, including `'already-confirmed'`). Insert the tap `on conflict do nothing`
(idempotent retries). Then `judgey_private.recompute_start(meet, team)`, which
applies the confirmedStart algorithm over the routine's taps and upserts or deletes
`routine_starts` (source 'crowd'; never touches operator rows).
Returns `{ ok, reason?, confirmed, startedAt? }`.

### `cast_ballot(p_meet text, p_team text, p_stars numeric, p_awards text[] default '{}') → json`
Lock the fans row `for share`. Reasons in order:
`'not-checked-in'` (no fans row) → `'own-team'` (team ∈ ever_home_team_ids) →
`'window-closed'` (no start, or `now() ∉ [start, start + window + grace]`) →
`'already-voted'` → `'invalid'` (stars null / non-integer / outside 1..5; awards null,
containing null, or outside the enum). Normalize awards (distinct, sorted). Insert
`on conflict do nothing` (a lost race returns `'already-voted'`); on insert, increment
`team_tallies`. Returns `{ ok, reason? }`.

### `touch(p_meet text, p_src text default null) → void`
Insert into `visits` the 15-minute bucket of now() `on conflict do nothing`. Invalid
src → null.

### Operator path (the meet-day safety net)
- `claim_operator(p_meet text, p_code text) → json {ok, reason?}`: at most 10 attempts
  per (meet, uid) (`'locked'`); `extensions.crypt(p_code, code_hash) = code_hash` →
  insert into meet_operators. Reasons `'bad-code'`, `'locked'`, `'unknown-meet'`.
- `op_set_start(p_meet text, p_team text, p_started_at_ms bigint) → json`: operator only
  (`'not-operator'`). Non-null → upsert routine_starts with source 'operator'. Null →
  delete the routine_starts row **and** that routine's taps (so the crowd can
  re-confirm cleanly). Ballots and tallies are untouched.
- `op_set_status(p_meet text, p_team text, p_status text) → json`: operator only;
  'scheduled' or 'scratched'; bumps `meets.schedule_version`.
- Client operator mode is unlocked with `/?meet=<id>&op=<code>`. The code is claimed
  once, then removed from the URL (`history.replaceState`) and never stored. It shows
  "Start now", "Clear" and "Scratch/Unscratch" on every row.

## 7. Import (`scripts/import-meet.ts`): never hand-write rows

`node --experimental-strip-types scripts/import-meet.ts --meet <id> --name "<name>"
--date 2026-12-05 --tz America/New_York [--venue] [--city] [--min-taps 3]
[--operator-code <code>] [--write-ids] running-order.csv > meet.sql`

- CSV columns: `mat,time,gym,team,division[,team_id]`. `time` is local wall-clock
  time (`9:04 AM` or `09:04`), converted with an `Intl.DateTimeFormat` offset lookup for
  `--tz`, **never** `new Date(bareString)`.
- Validates and prints a summary to stderr: per-mat first/last time and count,
  duplicate team ids, times not increasing within a mat, times outside 06:00–22:00
  local. Any error → non-zero exit and no SQL.
- `team_id` = given, else a slug of `gym-team` (deduped). `--write-ids` writes the
  ids back into the CSV so they stay stable across revisions.
- Emits idempotent SQL: upsert the meet (bump `schedule_version`), upsert routines;
  routines present in the DB but missing from the CSV → `status = 'scratched'` (never
  deleted). With `--operator-code`: upsert `judgey_private.operator_codes`
  using `extensions.crypt(code, extensions.gen_salt('bf'))`.
- `--demo --start <ISO with offset>` emits the demo roster shifted to that start (for
  practice meets). It refuses an ISO string without an explicit offset.

## 8. Client (`lib/`, `components/`, `app/`)

- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new-style
  `sb_publishable_…` keys; read with literal `process.env.X` so Next inlines them), optional
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. `isLiveEnabled = Boolean(url && key)`. Commit
  `.env.example`. With nothing set, the app is demo-only.
- `lib/supabase.ts`: lazy browser client. A custom `fetch` makes a 429 from
  `/auth/v1/*` reject instead of resolving, so auth-js treats it as retryable and
  never drops the session. `ensureSession()` runs anonymous sign-in once (with a
  Turnstile token when the site key is set) and retries 429s/network errors with
  exponential backoff and jitter. On an unexpected `SIGNED_OUT`, it signs in again and
  silently re-syncs the cached check-in.
- **Local-first check-in:** picking teams writes `{meetId, homeTeamIds}` to the
  device store and unblocks the UI immediately. `check_in` syncs in the background
  and retries. The UI never blocks on auth.
- `lib/sources/live.ts`: per-meet external store. On mount it hydrates from the
  localStorage cache `judgey_live_<meetId>` (schedule, starts, board, my state,
  fetchedAt), then polls `meet_snapshot` (15 s ± 3 s while visible; immediately on
  visible/online and after own actions), and calls `my_state` on load, after actions,
  every 60 s, and when a home team's window closes. Clock offset from `serverNow`
  (`offset = serverNow − (sent + received) / 2`); `now = Date.now() + offset`.
  Freshness: "Live" if the last success was under 30 s ago, otherwise "Updated h:mm";
  "Offline · last known times" on failures. Never a blank screen.
- **Tap outbox** (device store): `{meetId, teamId, tappedAt}`, at most one per
  routine. It sends `p_age_ms = Date.now() − tappedAt` on each attempt, retries
  every 5 s plus on visible/online, and is dropped after 120 s with a visible note.
  Button states: "<Team> just took the mat" → "Sending…" → "Sent! Waiting for another
  fan" → "No signal, retrying…" / "Couldn't send". The button ignores clicks for
  1.5 s after the up-next team changes. A "Someone else on the mat?" disclosure lists
  the other `tapCandidates`.
- `lib/sources/demo.ts`: today's demo, rebuilt on the new pure API
  (`confirmedStarts`, `computeBoard`, `computeRecaps`, `applyCheckIn`, `tapRejection`).
- `useMeet()` returns one `MeetView` for both modes (always call both source hooks
  and select by mode; never call hooks conditionally):
  `{ mode, meet, now, ready, freshness, starts, boards, teamById, checkedIn,
  homeTeamIds, myTappedTeamIds, pendingTaps, myBallots: Map<teamId,{stars,awards}>,
  board: MeetBoard, recaps: Recap[], isOperator, dismissedAlerts,
  actions: { checkIn, tap, vote(): Promise<BallotError|null>, dismissAlert, op? } }`.
- Routes: the vote route is dynamic (no `DEMO_MEET` / `notFound` / `generateStaticParams`);
  the team is resolved on the client from `MeetView.meet`. Check-in reads `?meet=`
  (QR and group-chat links), `?src=` (first-touch, stored) and `?op=`. With no meet
  param it offers the demo meet. The meet picker / `listed` flag is cut.
- UI copy: the bell row says "Keep Judgey open for 60/20/5 heads-ups", and the
  absolute ETA is as prominent as the countdown. Skipped rows show "Not seen on the mat
  yet. Moved or scratched?". The mat chip shows "last confirmed h:mm" when the anchor is
  more than 20 min old. A "Send to another parent" share button (`&src=share`). Favorites
  shows "<Division> results land after its last routine" for pending divisions. Check-in
  privacy line: "Anonymous. No names. Deleted 30 days after the meet." Demo clock UI only
  in demo mode.

## 9. Measuring the test day and retention

- `visits` via `touch(meet, src)` on load and on visible after more than 15 min hidden.
  Post-meet queries in `docs/meet-day-runbook.md`: parents with ≥2 visit buckets
  and home teams; first-touch `src = 'share'` count; taps per routine; time-to-confirm
  distribution.
- Retention: `judgey_private.purge_meet(meet)` deletes fans/taps/ballots/visits
  for a meet (it keeps meets, routines, routine_starts, team_tallies aggregates). The runbook
  schedules it plus `delete from auth.users where is_anonymous and created_at < now()
  − interval '30 days'` 30 days after the meet.

## 10. Testing

- `npm test`: node:test over pure TS (rules §2: cluster, freeze, tap gate incl.
  swaps/skips/scratches, break-absorbing estimates, reveal, board half-rule and
  integer ordering, recaps, applyCheckIn, validateBallot with grace).
- `npm run test:db` (skips unless `JUDGEY_TEST_DATABASE_URL` is set): creates a
  throwaway DB per mode, loads `supabase/tests/bootstrap.sql` (Supabase shims: roles
  `anon`/`authenticated`/`service_role`; `auth.uid()` copied verbatim
  (`coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid`);
  `extensions` schema with pgcrypto), applies the migrations in order, and runs
  every RPC as different users (`set role authenticated` plus `request.jwt.claims`
  with `sub`, `role`, `is_anonymous`). It covers every reason code, RLS isolation, ACLs,
  NULL inputs, concurrency (two connections tapping one routine at once → confirmed;
  check_in vs cast_ballot), and **parity**: randomized fixtures run through both
  `judgey_private.recompute_start` and TS `confirmedStart`, and through `meet_snapshot.board`
  and TS `computeBoard`, which must be deep-equal.
- Local: `JUDGEY_TEST_DATABASE_URL=postgres://judgey_test:judgey@localhost:5432/postgres npm run test:db`.
- Launch gate (after provisioning): migrations applied, advisors clean except the
  expected 0028/0029, auth config raised (`rate_limit_anonymous_users` ≥ 2000/h,
  `rate_limit_token_refresh` raised, JWT expiry ≥ 12 h, anonymous sign-ins on,
  Turnstile on), and a two-browser live check.

## 11. Meet-day ops (summary; full steps in `docs/meet-day-runbook.md`)

1. Import the running order CSV with `--operator-code`, then apply the SQL.
2. Founder and one helper per mat open `/?meet=<id>&op=<code>` before doors open.
3. Share `/?meet=<id>&src=qr` (poster) and `&src=groupchat`. Tell parents to open
   it before entering the arena.
4. During the meet, operators tap "Start now" if the crowd is quiet, and "Clear" or
   "Scratch" when something goes wrong.
