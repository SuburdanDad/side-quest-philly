# Meet-day runbook

How to take Judgey from zero to a live meet and back to nothing: provisioning,
importing the running order, operators, the day itself, measuring it, and
deleting what we promised to delete. The contract behind all of this is
[`backend-spec.md`](backend-spec.md) (§7 import, §9 measurement and retention,
§10 launch gate, §11 meet-day ops).

Commands run from `cheer/`. `$DB_URL` is the project's **session pooler**
connection string (Dashboard → Connect → Session pooler,
`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`),
used only from a laptop, never in the app. Session mode speaks plain Postgres
(transactions, `\gset`, temp tables) and works over **IPv4**. The "Direct
connection" (`db.<ref>.supabase.co`) is IPv6-only unless the project buys the IPv4
add-on, and many home and venue networks are IPv4-only: don't use it on meet morning.

## Timeline

| When | What |
|---|---|
| T−2 weeks | Provision the project, apply migrations, set auth, deploy to Vercel, run the launch gate |
| T−1 week | Import the running order (`--write-ids`), rehearse with a practice meet |
| T−1 day | Re-import the final running order, set the operator code, print QR posters |
| Day of | Operators claim, posters up, watch the mats, fix starts |
| T+1 day | Run the measurement queries and save the results |
| T+30 days | Purge the meet and old anonymous users |

## 1. Provisioning (once)

1. **Create the Supabase project.** Region close to the venue (us-east-1 for
   Philadelphia). Postgres 17. Use a paid plan for meet week: free projects
   pause when idle and have tighter limits.
2. **Apply the migrations** with this psql loop, and only this loop (it is the
   one migration path: `cheer/supabase` has no CLI `config.toml`, so don't mix in
   `supabase db push`, whose history table wouldn't know about these files). It
   applies each new file in name order, in one transaction together with the row
   that records it, exactly like `supabase/local/up.sh` does locally, so on later
   releases you just run it again:

   ```bash
   psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
     -c "create schema if not exists judgey_ops" \
     -c "revoke all on schema judgey_ops from public, anon, authenticated" \
     -c "create table if not exists judgey_ops.applied_migrations (name text primary key, applied_at timestamptz not null default now())"
   for f in supabase/migrations/*.sql; do
     name="$(basename "$f")"
     [ "$(psql "$DB_URL" -tAc "select 1 from judgey_ops.applied_migrations where name = '$name'")" = 1 ] && continue
     echo "applying $name"
     psql "$DB_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f" \
       -c "insert into judgey_ops.applied_migrations (name) values ('$name')" || break
   done
   psql "$DB_URL" -tAc "select name from judgey_ops.applied_migrations order by name"
   ```

   The last line must list every file in `supabase/migrations/`.
3. **Data API.** Settings → Data API → exposed schemas: `public` only. Never
   expose `judgey_private` (or `judgey_ops`). **Remove `graphql_public`** from the
   list: the migrations drop the `pg_graphql` extension (nothing uses
   `/graphql/v1`, and it raises advisor lints 0026/0027 on every readable table),
   so that schema has nothing behind it.
4. **Auth settings** (Authentication in the dashboard):
   - Sign In / Providers → **Allow anonymous sign-ins: on.** Every phone is an
     anonymous user; there is no login UI.
   - Rate Limits → **anonymous sign-ins ≥ 2000 per hour**
     (`rate_limit_anonymous_users`). A whole arena on one venue Wi-Fi shares one IP.
   - Rate Limits → **token refreshes raised** (`rate_limit_token_refresh`, e.g.
     1800 per 5 min) for the same reason.
   - Sessions / JWT → **JWT expiry ≥ 12 h** (`jwt_exp` 43200): a meet day is long
     and arena signal is bad, so refreshes should be rare.
   - Attack Protection → **CAPTCHA: Cloudflare Turnstile on**, with the Turnstile
     secret key. The site key goes to Vercel (below). In the Cloudflare Turnstile
     widget, the **hostname list** must include the production domain and any
     preview domain you'll use for the two-browser check, or sign-in fails there.

   Why Turnstile matters: every vote rule is "one per **identity**", and an
   identity is a free anonymous sign-in. Ballot stuffing (many identities voting
   for one team) and operator-code guessing from fresh identities are limited only
   by how hard it is to mint identities: Turnstile plus the anonymous sign-in rate
   limit. Crowd Favorites is a fan-engagement feature, not an integrity-grade
   result. The launch gate below checks Turnstile is actually enforced, and §4 has
   a query to spot and void a burst.

   The same settings through the Management API, if you prefer a script:

   ```bash
   curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
     -d '{"external_anonymous_users_enabled": true, "rate_limit_anonymous_users": 2000,
          "rate_limit_token_refresh": 1800, "jwt_exp": 43200,
          "security_captcha_enabled": true, "security_captcha_provider": "turnstile",
          "security_captcha_secret": "'"$TURNSTILE_SECRET"'"}'
   ```

5. **Vercel project** (separate from the Side Quest app at the repo root):
   - Add New → Project → import the same Git repo. **Root Directory: `cheer`**.
     Framework preset Next.js; build and install commands default
     (`npm run build`, `npm install`).
   - Settings → Build and Deployment → **Node.js version 22.x** (the app needs ≥ 22.6).
   - Settings → Git → **Ignored Build Step**: run `git diff --quiet HEAD^ HEAD -- .`
     (it runs inside `cheer/`, so commits that touch only the root app skip this
     project; and the root project should ignore `cheer/` the same way).
   - `next.config.ts` pins `turbopack.root` and `outputFileTracingRoot` to `cheer/`,
     so the repo's second lockfile doesn't make Next pick the parent as the
     workspace root (no "inferred your workspace root" warning in the build log).
   - **Env vars** (Production and Preview), then redeploy, because
     `NEXT_PUBLIC_*` values are inlined at build time:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the `sb_publishable_…` key
     - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the Turnstile site key

   The app needs no secret key. Never put the `sb_secret_…`/service-role key in Vercel.
6. **Launch gate** (spec §10). All of these must hold before the meet:
   - Migrations applied (the `judgey_ops.applied_migrations` list above matches
     `supabase/migrations/`, nothing skipped), and
     `select count(*) from pg_extension where extname = 'pg_graphql';` returns 0.
   - Data API exposed schemas are exactly `public` (no `graphql_public`).
   - Advisors (Dashboard → Advisors → Security and Performance) are clean
     **except** lints 0028/0029 on exactly the public RPCs (`meet_snapshot` for
     anon; `my_state`, `check_in`, `tap_mat`, `cast_ballot`, `touch`,
     `claim_operator`, `op_set_start`, `op_set_status` for authenticated). Those
     are intentional endpoints that validate their inputs. Anything else blocks launch,
     except "unused index" (0005, INFO) on a project that has not had traffic yet.
     In particular 0026/0027 (`pg_graphql_*_table_exposed`) must not appear; if they
     do, `pg_graphql` is still installed.
   - Auth settings above are applied.
   - **Turnstile is enforced, not just switched on.** An anonymous sign-in
     without a captcha token must be refused by the real project:

     ```bash
     curl -sS -w '\nHTTP %{http_code}\n' -X POST "https://<ref>.supabase.co/auth/v1/signup" \
       -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{}'
     ```

     Pass: an HTTP 4xx whose message mentions captcha. Fail (launch blocked): HTTP
     200 with an `access_token`, meaning anyone can mint identities freely. (The
     local rehearsal stack has no captcha and returns 200, so this can only be
     checked on the real project.)
   - The DB suite passes against the real Supabase image (see "Rehearsal").
   - A **two-browser live check** on the deployed site with a practice meet: two
     browsers (one private window) both tap the up-next team, the start confirms
     in both within ~15 s, a vote from the second browser counts, and the
     own-team block works.

### Rehearsal on your laptop

`supabase/local/up.sh` runs the same Postgres/Auth/PostgREST locally and applies
the migrations (see `supabase/local/README.md`). The DB tests run against it too:

```bash
JUDGEY_TEST_DATABASE_URL=postgres://postgres:judgey-local-db@localhost:54322/postgres npm run test:db
```

## 2. Importing the running order

Never hand-write rows: the importer validates the schedule and emits idempotent SQL.

1. Turn the producer's running order (PDF) into a CSV with the header
   `mat,time,gym,team,division` (optional `team_id`). `time` is the **local**
   wall-clock time as printed (`9:04 AM` or `09:04`). `mat` is just the mat's
   label, like `1`, `2` or `A` (the app prints "Mat" itself; a leading "Mat" in
   the cell is dropped, so `Mat 1` and `1` are the same mat). Quoted fields, a BOM
   and Excel's CRLF line endings are all fine. Spell each division exactly the same
   way on every row.
2. Run the importer (it prints a summary and any errors to stderr, SQL to stdout):

   ```bash
   npm run -s import:meet -- --meet riverside-2026 --name "Riverside Invitational" \
     --date 2026-12-05 --tz America/New_York --venue "Hall B" --city "Philadelphia, PA" \
     --operator --write-ids running-order.csv > meet.sql
   ```

   - `--operator` generates a random operator code and prints it to stderr
     (`operator code (generated): …`); see §3. Omit it on later revisions to keep
     the current code.
   - Check the summary against the PDF: per-mat first/last time and count, divisions.
   - Errors exit non-zero and write no SQL: duplicate team ids, times not
     increasing within a mat, times outside 6:00 AM–10:00 PM local, unparseable
     times, a time skipped by DST, an **unterminated quote** (reported with the
     line where it opened), a line break inside a mat/time/gym/team/division
     cell, two spellings of one division or mat that differ only in case or
     spacing (both spellings and line numbers are printed), a mat label longer
     than 16 characters or a gym/team/division longer than 80, and a weak
     `--operator-code`. Fix the CSV and re-run. Runs of spaces inside names are
     collapsed to one.
   - A warning (not an error) names any gym + team listed twice: fine if they
     really compete twice, otherwise delete the duplicate row.
   - `--write-ids` writes the generated `team_id`s back into the CSV. Keep that
     CSV: later revisions must reuse the same ids or teams get scratched and re-added.
   - `--min-taps 3` raises the crowd confirmation threshold for a big, noisy meet
     (default 2).
3. Apply it: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f meet.sql` (or paste it into the
   SQL editor). It is one transaction and safe to apply twice.
4. Check it: `select public.meet_snapshot('riverside-2026', 0);` shows the
   schedule, and the app at `/?meet=riverside-2026` shows the running order.
5. **Delete `meet.sql`** when it contains an operator code. Never commit it.

**Revisions** (a team added, moved or dropped): edit the CSV and re-run the same
command, then apply. Routines that are no longer in the CSV become `scratched`
(never deleted, so their taps and ballots stay), and every import bumps
`schedule_version` so phones refetch the schedule on their next poll.

> **The CSV is the truth, including for scratches.** A re-import puts every
> routine still listed in the CSV back to `scheduled`, **including teams an
> operator scratched today**. Before a meet-day re-import, list them and delete
> those rows from the CSV (or scratch them again in the app right after):
>
> ```sql
> select team_id, team_name from public.routines where meet_id = '<id>' and status = 'scratched';
> ```
>
> The SQL also tells you: applying it prints
> `NOTICE: Re-import UN-SCRATCHES: <team ids> …` for every routine it brings back.

**Practice meet** (rehearsals, the two-browser check): the demo roster shifted
to any start. The start must carry an explicit offset:

```bash
npm run -s import:meet -- --demo --start 2026-11-15T19:00-05:00 \
  --meet practice-1115 --name "Practice night" --operator > practice.sql
```

## 3. Operators (the meet-day safety net)

Operators can set a start by hand ("Start now"), clear a bad one ("Clear", which
also drops that routine's taps so the crowd can re-confirm) and scratch or
unscratch a routine.

1. Import with `--operator`: the importer generates a 20-character random code
   (`xxxxx-xxxxx-xxxxx-xxxxx`, 100 bits) and prints it to stderr. Only its bcrypt
   hash is stored. Anyone can mint anonymous identities, and the 10-attempt cap is
   per identity, so the code's randomness is what actually stops guessing (the
   meet-wide `'slow-down'` after 30 wrong codes a minute only slows it).
   `--operator-code <code>` sets your own instead, but it must be at least 16
   characters and is refused if it is repetitive, contains the meet id or name, or
   contains a stock password fragment.
2. Re-importing with `--operator` (or a new `--operator-code`) rotates the code;
   people who already claimed stay operators. Re-importing without either keeps
   the current code.
3. Before doors open, the founder and one helper per mat open
   `https://<site>/?meet=<id>&op=<code>` **on the phone they will use all day**.
   The app claims the code once and removes it from the URL. Share the link in
   person or by direct message, never in a group chat or on a poster.
4. Each identity gets 10 wrong attempts per meet, then `locked`. To unlock a
   helper who fat-fingered it:
   `delete from judgey_private.operator_attempts where meet_id = '<id>';`
5. To revoke everyone: `delete from judgey_private.meet_operators where meet_id = '<id>';`
   then rotate the code.

## 4. Day-of checklist

**Before doors (T−60 min)**
- [ ] `select public.meet_snapshot('<id>', 0);` returns the final schedule.
- [ ] Operators have claimed (`select count(*) from judgey_private.meet_operators where meet_id = '<id>';`).
- [ ] QR posters point to `/?meet=<id>&src=qr`; the group-chat message uses
      `/?meet=<id>&src=groupchat`. Tell parents to open it **before** entering the arena.
- [ ] Supabase dashboard open on a laptop: API requests, Auth logs (watch for 429s).

**During the meet**
- [ ] A mat chip says "last confirmed h:mm" from 20+ min ago → the crowd is quiet:
      an operator taps "Start now" when the next team goes on.
- [ ] A start is wrong (griefers, a swap nobody tapped) → "Clear", then "Start now".
- [ ] A team withdraws → "Scratch". Unscratch if it was a mistake. If you
      re-import later today, delete that team's row from the CSV first (a re-import
      un-scratches every listed team; see §2 Revisions).
- [ ] Before announcing awards (and whenever a team's votes jump oddly), run the
      ballot-stuffing check below.
- Quick look at every mat's latest start:

  ```sql
  select distinct on (r.mat) r.mat, r.team_name, s.source, s.started_at at time zone m.time_zone as started
  from public.routines r join public.routine_starts s using (meet_id, team_id)
  join public.meets m on m.id = r.meet_id
  where r.meet_id = '<id>' and r.status = 'scheduled'
  order by r.mat, r.scheduled_at desc;
  ```

### Ballot-stuffing check (operator-run admin SQL)

One ballot per identity is only as strong as anonymous sign-in friction (§1,
Turnstile). The tell of stuffing is a **burst**: many identities created within
the same minute or two, each casting its first and only action seconds later,
all for one team, with no taps. Honest parents vote for several teams over the
day and tap mats. Run this as `postgres` in the SQL editor or psql (`\set meet '<id>'`):

```sql
-- Bursts: fresh identities (ballot < 120 s after sign-in) with no taps that voted
-- for exactly one team at this meet, grouped by team and minute of sign-in.
with fresh as (
  select b.team_id, b.user_id, b.stars, b.cast_at, u.created_at
  from public.ballots b
  join auth.users u on u.id = b.user_id
  where b.meet_id = :'meet' and u.is_anonymous
    and b.cast_at - u.created_at < interval '120 seconds'
    and not exists (select 1 from public.taps t where t.meet_id = b.meet_id and t.user_id = b.user_id)
    and not exists (select 1 from public.ballots o
                    where o.meet_id = b.meet_id and o.user_id = b.user_id and o.team_id <> b.team_id)
)
select team_id, date_trunc('minute', created_at) as minute, count(*) as fresh_voters,
       round(avg(stars), 1) as avg_stars
from fresh group by 1, 2 having count(*) >= 5 order by fresh_voters desc;
```

A handful of rows at doors-open is normal. A team with a big burst of 5-star
fresh voters in one minute, out of line with its other votes, is suspect: it is
a human judgement call, so look before voiding. To void one burst (deletes those
ballots and un-counts them from `team_tallies` in the same transaction, like
`check_in` does), set the team and the burst's minute from the row above:

```sql
\set team '<team_id>'
\set minute '<minute from the burst row, e.g. 2026-12-05 15:42:00+00>'
begin;
create temp table suspect on commit drop as
select b.team_id, b.user_id
from public.ballots b join auth.users u on u.id = b.user_id
where b.meet_id = :'meet' and b.team_id = :'team' and u.is_anonymous
  and date_trunc('minute', u.created_at) = :'minute'
  and b.cast_at - u.created_at < interval '120 seconds'
  and not exists (select 1 from public.taps t where t.meet_id = b.meet_id and t.user_id = b.user_id)
  and not exists (select 1 from public.ballots o
                  where o.meet_id = b.meet_id and o.user_id = b.user_id and o.team_id <> b.team_id);
select count(*) as to_void from suspect;   -- must match fresh_voters; else rollback;
with gone as (
  delete from public.ballots b using suspect s
  where b.meet_id = :'meet' and b.team_id = s.team_id and b.user_id = s.user_id
  returning b.team_id, b.stars, b.awards
), per_team as (
  select team_id, count(*) as n, sum(stars) as stars,
         count(*) filter (where 'stunts' = any (awards)) as stunts,
         count(*) filter (where 'tumbling' = any (awards)) as tumbling,
         count(*) filter (where 'spirit' = any (awards)) as spirit,
         count(*) filter (where 'dance' = any (awards)) as dance
  from gone group by team_id
)
update judgey_private.team_tallies t
set votes = t.votes - p.n, star_sum = t.star_sum - p.stars, stunts = t.stunts - p.stunts,
    tumbling = t.tumbling - p.tumbling, spirit = t.spirit - p.spirit, dance = t.dance - p.dance
from per_team p
where t.meet_id = :'meet' and t.team_id = p.team_id;
commit;
```

The board and awards update on the next snapshot poll. Those identities can
still vote for other teams; this is cleanup, not a ban.

**If something breaks:** ETAs never depend on sign-in. If Auth is rate-limited,
the running order and confirmed starts still load; taps and votes retry in the
background. If the database is unreachable, phones keep showing the last known
times. Operators can fix starts afterwards.

## 5. After the meet: measurement (spec §9)

Run these **before** the purge (it deletes the rows they read), and save the
output. `\set meet '<id>'` in psql first.

Parents who came back (2+ visit buckets) and followed a team:

```sql
select count(*) as returning_parents
from (
  select v.user_id
  from public.visits v
  join public.fans f on f.meet_id = v.meet_id and f.user_id = v.user_id
  where v.meet_id = :'meet' and cardinality(f.ever_home_team_ids) > 0
  group by v.user_id
  having count(distinct v.bucket) >= 2
) parents;
```

First-touch source (did anyone share it unprompted? look for `share`):

```sql
select coalesce(src, '(none)') as first_src, count(*) as people
from (
  select distinct on (user_id) user_id, src
  from public.visits where meet_id = :'meet'
  order by user_id, bucket
) first_touch
group by 1 order by 2 desc;
```

Taps per routine and how each start was set:

```sql
select r.mat, r.scheduled_at at time zone m.time_zone as scheduled, r.team_name, r.status,
       count(t.user_id) as taps, s.source, s.confirmations
from public.routines r
join public.meets m on m.id = r.meet_id
left join public.taps t on t.meet_id = r.meet_id and t.team_id = r.team_id
left join public.routine_starts s on s.meet_id = r.meet_id and s.team_id = r.team_id
where r.meet_id = :'meet'
group by r.mat, r.scheduled_at, m.time_zone, r.team_name, r.status, s.source, s.confirmations
order by r.mat, r.scheduled_at;
```

Time to confirm (from the crowd's start to the confirming tap), and coverage:

```sql
select count(*) filter (where s.source = 'crowd') as crowd_confirmed,
       count(*) filter (where s.source = 'operator') as operator_set,
       count(*) filter (where s.team_id is null and r.status = 'scheduled') as never_confirmed,
       percentile_cont(array[0.5, 0.9, 0.99]) within group (
         order by extract(epoch from s.confirmed_at - s.started_at))
         filter (where s.source = 'crowd') as confirm_seconds_p50_p90_p99
from public.routines r
left join public.routine_starts s on s.meet_id = r.meet_id and s.team_id = r.team_id
where r.meet_id = :'meet';
```

Voting volume (aggregates survive the purge):

```sql
select count(*) as routines_with_votes, sum(votes) as ballots, max(votes) as most_votes
from judgey_private.team_tallies where meet_id = :'meet' and votes > 0;
```

The premise to prove: at least 15 returning parents, and at least one `share` first touch.

## 6. Retention (30 days after the meet)

The check-in screen promises "Deleted 30 days after the meet". On (or any time
after) T+30 days, run this as one transaction (psql: `\set meet '<id>'` first).
The cutoff is anchored to the **meet**, not to the moment it runs: local midnight
at the end of the meet's last scheduled day, in the meet's time zone. (A rolling
`created_at < now() - interval '30 days'` run once on T+30 would keep everyone who
signed in later in the day than the job ran, which is most of the crowd, along
with their session IP and user-agent rows, which cascade from `auth.users`.)

```sql
begin;
-- The end of meet day, in the meet's zone (e.g. 2026-12-06 05:00:00+00).
select ((max(r.scheduled_at) at time zone m.time_zone)::date + 1)::timestamp at time zone m.time_zone
       as meet_day_end
from public.routines r join public.meets m on m.id = r.meet_id
where r.meet_id = :'meet' group by m.time_zone \gset
-- 1) Every anonymous identity that touched this meet (before purge_meet removes fans/visits).
delete from auth.users u where u.is_anonymous and (
  exists (select 1 from public.visits v where v.meet_id = :'meet' and v.user_id = u.id)
  or exists (select 1 from public.fans f where f.meet_id = :'meet' and f.user_id = u.id));
-- 2) Any other anonymous identity created up to the end of meet day (fixed cutoff).
delete from auth.users where is_anonymous and created_at < :'meet_day_end';
-- 3) The meet's personal rows: fans, taps, ballots, visits, operator rows.
select judgey_private.purge_meet(:'meet');
-- Check: must be 0.
select count(*) as must_be_0 from auth.users where is_anonymous and created_at < :'meet_day_end';
commit;
```

`purge_meet` keeps the meet, its routines, the confirmed starts and the
`team_tallies` aggregates (no identities). Deleting an `auth.users` row also
deletes its sessions and refresh tokens. A parent who reuses one phone across
meets loses that identity at the first meet's purge and simply gets a new one;
their rows at a later meet go with that meet's purge. Identities first created
after meet day (a late recap view) are swept by the next meet's step 2; after the
season's last meet, run step 2 once more a month later.

Put a calendar reminder on the meet date + 30 days when you import, or schedule
it with pg_cron (enable the `pg_cron` extension first: Database → Extensions).
pg_cron schedules are in **UTC**, and because the cutoff is fixed the time of day
no longer matters. The job body is one command, so it runs as one transaction:

```sql
select cron.schedule('purge-<id>', '7 14 4 1 *',   -- 14:07 UTC on the date 30 days out
  $$delete from auth.users u where u.is_anonymous and (
      exists (select 1 from public.visits v where v.meet_id = '<id>' and v.user_id = u.id)
      or exists (select 1 from public.fans f where f.meet_id = '<id>' and f.user_id = u.id));
    delete from auth.users where is_anonymous and created_at < (
      select ((max(r.scheduled_at) at time zone m.time_zone)::date + 1)::timestamp at time zone m.time_zone
      from public.routines r join public.meets m on m.id = r.meet_id
      where r.meet_id = '<id>' group by m.time_zone);
    select judgey_private.purge_meet('<id>');$$);
```

Afterwards check `select * from cron.job_run_details order by start_time desc limit 5;`
(status `succeeded`) and the must-be-0 count above, then
`select cron.unschedule('purge-<id>');`.
