-- Judgey core schema: tables, row-level security and grants.
-- Contract: docs/backend-spec.md §4 (tables) and §5 (security).
--
-- Grants are explicit after every CREATE, so the result is identical whether
-- or not the project still has Supabase's legacy default privileges (the DB
-- tests run both modes and assert exact ACLs).
--
-- Index plan (keeps meet_snapshot cheap; it is polled by every phone):
--   routines, routine_starts, team_tallies: primary key (meet_id, team_id), so a
--     snapshot is three index range scans on meet_id. It never reads ballots or taps.
--   routines (meet_id, mat, scheduled_at, team_id): the per-mat walk in the tap gate.
--   taps / ballots (meet_id, user_id): my_state and the own-rows RLS policy.
-- Every team_id and division column is collate "C" so ordering is byte order,
-- matching compareIds() in src/rules.ts.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

grant usage on schema public to anon, authenticated;

create schema judgey_private;
revoke all on schema judgey_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public tables (the API surface; read-only to clients, written by RPCs only)

create table public.meets (
  id text primary key check (id ~ '^[a-z0-9-]{3,64}$'),
  name text not null,
  venue text not null default '',
  city text not null default '',
  time_zone text not null,
  starts_at timestamptz not null,
  mats text[] not null,
  min_taps int not null default 2 check (min_taps between 2 and 5),
  schedule_version int not null default 1,
  created_at timestamptz not null default date_trunc('milliseconds', now())
);
revoke all on table public.meets from anon, authenticated;
grant select on table public.meets to anon, authenticated;

create table public.routines (
  meet_id text not null references public.meets on delete cascade,
  team_id text collate "C" not null check (team_id ~ '^[a-z0-9-]{1,80}$'),
  team_name text not null,
  gym text not null,
  division text collate "C" not null,
  mat text not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'scratched')),
  primary key (meet_id, team_id)
);
create index routines_mat_order on public.routines (meet_id, mat, scheduled_at, team_id);
revoke all on table public.routines from anon, authenticated;
grant select on table public.routines to anon, authenticated;

create table public.routine_starts (
  meet_id text not null,
  team_id text collate "C" not null,
  started_at timestamptz not null,
  source text not null check (source in ('crowd', 'operator')),
  -- The confirming tap's time c (crowd only); the freeze and 'already-confirmed' key on it.
  confirmed_at timestamptz,
  -- Counted taps behind a crowd start (0 for operator starts).
  confirmations int not null default 0,
  updated_at timestamptz not null default date_trunc('milliseconds', now()),
  primary key (meet_id, team_id),
  foreign key (meet_id, team_id) references public.routines on delete cascade
);
revoke all on table public.routine_starts from anon, authenticated;
grant select on table public.routine_starts to anon, authenticated;

create table public.fans (
  meet_id text not null references public.meets on delete cascade,
  user_id uuid not null,
  home_team_ids text[] not null default '{}',
  -- Monotonic union of every team ever followed here; the own-team block keys on it.
  ever_home_team_ids text[] not null default '{}',
  checked_in_at timestamptz not null default date_trunc('milliseconds', now()),
  updated_at timestamptz not null default date_trunc('milliseconds', now()),
  primary key (meet_id, user_id)
);
revoke all on table public.fans from anon, authenticated;
grant select on table public.fans to authenticated;

create table public.taps (
  meet_id text not null,
  team_id text collate "C" not null,
  user_id uuid not null,
  at timestamptz not null,
  primary key (meet_id, team_id, user_id),
  foreign key (meet_id, team_id) references public.routines on delete cascade
);
create index taps_by_user on public.taps (meet_id, user_id);
revoke all on table public.taps from anon, authenticated;
grant select on table public.taps to authenticated;

create table public.ballots (
  meet_id text not null,
  team_id text collate "C" not null,
  user_id uuid not null,
  stars smallint not null check (stars between 1 and 5),
  awards text[] not null default '{}'
    check (awards <@ array['stunts', 'tumbling', 'spirit', 'dance']::text[]),
  cast_at timestamptz not null,
  primary key (meet_id, team_id, user_id),
  foreign key (meet_id, team_id) references public.routines on delete cascade
);
create index ballots_by_user on public.ballots (meet_id, user_id);
revoke all on table public.ballots from anon, authenticated;
grant select on table public.ballots to authenticated;

-- 15-minute buckets of app opens, for measuring the test day (§9).
create table public.visits (
  meet_id text not null references public.meets on delete cascade,
  user_id uuid not null,
  bucket timestamptz not null,
  src text check (src ~ '^[a-z0-9-]{1,32}$'),
  primary key (meet_id, user_id, bucket)
);
revoke all on table public.visits from anon, authenticated;
grant select on table public.visits to authenticated;

-- Row-level security: public schedule data for everyone, own rows only for the
-- rest. No insert/update/delete policies anywhere: every write goes through an RPC.
alter table public.meets enable row level security;
alter table public.routines enable row level security;
alter table public.routine_starts enable row level security;
alter table public.fans enable row level security;
alter table public.taps enable row level security;
alter table public.ballots enable row level security;
alter table public.visits enable row level security;

create policy meets_public_read on public.meets
  for select to anon, authenticated using (true);
create policy routines_public_read on public.routines
  for select to anon, authenticated using (true);
create policy routine_starts_public_read on public.routine_starts
  for select to anon, authenticated using (true);
create policy fans_own_rows on public.fans
  for select to authenticated using (user_id = (select auth.uid()));
create policy taps_own_rows on public.taps
  for select to authenticated using (user_id = (select auth.uid()));
create policy ballots_own_rows on public.ballots
  for select to authenticated using (user_id = (select auth.uid()));
create policy visits_own_rows on public.visits
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Private tables. Never exposed: no schema usage and no grants for the API
-- roles. (No RLS here on purpose: with zero policies it would only trip the
-- advisor's rls_enabled_no_policy lint without adding protection.)

-- Running ballot counters per routine, maintained in the same transaction as
-- every ballot insert (cast_ballot) and delete (check_in).
create table judgey_private.team_tallies (
  meet_id text not null,
  team_id text collate "C" not null,
  votes int not null default 0,
  star_sum int not null default 0,
  stunts int not null default 0,
  tumbling int not null default 0,
  spirit int not null default 0,
  dance int not null default 0,
  primary key (meet_id, team_id),
  foreign key (meet_id, team_id) references public.routines on delete cascade,
  check (votes >= 0 and star_sum >= 0 and stunts >= 0 and tumbling >= 0 and spirit >= 0 and dance >= 0)
);

create table judgey_private.operator_codes (
  meet_id text primary key references public.meets on delete cascade,
  code_hash text not null
);

create table judgey_private.meet_operators (
  meet_id text not null references public.meets on delete cascade,
  user_id uuid not null,
  primary key (meet_id, user_id)
);

create table judgey_private.operator_attempts (
  meet_id text not null references public.meets on delete cascade,
  user_id uuid not null,
  attempts int not null default 0,
  primary key (meet_id, user_id)
);

revoke all on all tables in schema judgey_private from public, anon, authenticated;
