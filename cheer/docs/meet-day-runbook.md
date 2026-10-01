# Meet-day runbook

How to take Judgey from zero to a live meet and back to nothing: provisioning,
importing the running order, operators, the day itself, measuring it, and
deleting what we promised to delete. The contract behind all of this is
[`backend-spec.md`](backend-spec.md) (§7 import, §9 measurement and retention,
§10 launch gate, §11 meet-day ops).

Commands run from `cheer/`. `$DB_URL` is the project's **direct** Postgres
connection string (Dashboard → Connect → Direct connection), used only from a
laptop, never in the app.

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
2. **Apply the migrations**, in name order, each in one transaction:

   ```bash
   for f in supabase/migrations/*.sql; do
     psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f "$f" || break
   done
   ```

   (With the Supabase CLI set up for this folder, `supabase db push` does the same
   and records the history.) Re-run only new files on later releases.
3. **Data API.** Settings → Data API → exposed schemas: `public` only. Never
   expose `judgey_private`.
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
     secret key. The site key goes to Vercel (below).

   The same settings through the Management API, if you prefer a script:

   ```bash
   curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
     -d '{"external_anonymous_users_enabled": true, "rate_limit_anonymous_users": 2000,
          "rate_limit_token_refresh": 1800, "jwt_exp": 43200,
          "security_captcha_enabled": true, "security_captcha_provider": "turnstile",
          "security_captcha_secret": "'"$TURNSTILE_SECRET"'"}'
   ```

5. **Vercel env vars** (Production and Preview), then redeploy, because
   `NEXT_PUBLIC_*` values are inlined at build time:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the `sb_publishable_…` key
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the Turnstile site key

   The app needs no secret key. Never put the `sb_secret_…`/service-role key in Vercel.
6. **Launch gate** (spec §10). All of these must hold before the meet:
   - Migrations applied (the list above, nothing skipped).
   - Advisors (Dashboard → Advisors → Security and Performance) are clean
     **except** lints 0028/0029 on exactly the public RPCs (`meet_snapshot` for
     anon; `my_state`, `check_in`, `tap_mat`, `cast_ballot`, `touch`,
     `claim_operator`, `op_set_start`, `op_set_status` for authenticated). Those
     are intentional endpoints that validate their inputs. Anything else blocks launch,
     except "unused index" (0005, INFO) on a project that has not had traffic yet.
   - Auth settings above are applied.
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
   wall-clock time as printed (`9:04 AM` or `09:04`). Quoted fields, a BOM and
   Excel's CRLF line endings are all fine.
2. Run the importer (it prints a summary and any errors to stderr, SQL to stdout):

   ```bash
   npm run -s import:meet -- --meet riverside-2026 --name "Riverside Invitational" \
     --date 2026-12-05 --tz America/New_York --venue "Hall B" --city "Philadelphia, PA" \
     --operator-code "$OPERATOR_CODE" --write-ids running-order.csv > meet.sql
   ```

   - Check the summary against the PDF: per-mat first/last time and count, divisions.
   - Errors (duplicate team ids, times not increasing within a mat, times outside
     6:00 AM–10:00 PM local, unparseable times, a time skipped by DST) exit non-zero
     and write no SQL. Fix the CSV and re-run.
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

**Practice meet** (rehearsals, the two-browser check): the demo roster shifted
to any start. The start must carry an explicit offset:

```bash
npm run -s import:meet -- --demo --start 2026-11-15T19:00-05:00 \
  --meet practice-1115 --name "Practice night" --operator-code "$OPERATOR_CODE" > practice.sql
```

## 3. Operators (the meet-day safety net)

Operators can set a start by hand ("Start now"), clear a bad one ("Clear", which
also drops that routine's taps so the crowd can re-confirm) and scratch or
unscratch a routine.

1. Generate a code of at least 12 random characters, e.g.
   `openssl rand -base64 12 | tr -d '/+='`. Only its bcrypt hash is stored.
2. Pass it to the import with `--operator-code` (re-importing with a new code
   rotates it; people who already claimed stay operators).
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
- [ ] A team withdraws → "Scratch". Unscratch if it was a mistake.
- Quick look at every mat's latest start:

  ```sql
  select distinct on (r.mat) r.mat, r.team_name, s.source, s.started_at at time zone m.time_zone as started
  from public.routines r join public.routine_starts s using (meet_id, team_id)
  join public.meets m on m.id = r.meet_id
  where r.meet_id = '<id>' and r.status = 'scheduled'
  order by r.mat, r.scheduled_at desc;
  ```

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

The check-in screen promises "Deleted 30 days after the meet". On T+30 days,
in the SQL editor:

```sql
select judgey_private.purge_meet('<id>');   -- fans, taps, ballots, visits, operator rows
delete from auth.users where is_anonymous and created_at < now() - interval '30 days';
```

`purge_meet` keeps the meet, its routines, the confirmed starts and the
`team_tallies` aggregates (no identities). Put a calendar reminder on the meet
date + 30 days when you import, or schedule it with pg_cron (enable the `pg_cron`
extension first: Database → Extensions):

```sql
select cron.schedule('purge-<id>', '0 9 4 1 *',   -- pick the date 30 days out
  $$select judgey_private.purge_meet('<id>');
    delete from auth.users where is_anonymous and created_at < now() - interval '30 days'$$);
```

(Unschedule it afterwards with `select cron.unschedule('purge-<id>');`.)
