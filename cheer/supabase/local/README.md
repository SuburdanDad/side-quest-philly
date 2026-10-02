# Local Supabase stack (for end-to-end tests, no cloud project needed)

Runs the same software as production, locally in Docker:

| Service | Image | Port |
|---|---|---|
| Postgres | `supabase/postgres:17.6.1.084` (same build as the cloud) | 54322 |
| Auth (anonymous sign-ins on, meet-day rate limit) | `supabase/gotrue:v2.180.0` | via gateway |
| Data API | `postgrest/postgrest:v12.2.12` | via gateway |
| Gateway (`/auth/v1`, `/rest/v1`) | `nginx:1.27-alpine` | 54321 |

Needs Docker Desktop running and Node 22.6+. No `psql` needed: the scripts use the one inside the database container.

```bash
npm run local:up              # start + apply migrations + write .env.local
npm run local:practice        # practice meet starting in 2 min; prints parent + operator links
npm run local:down            # stop
supabase/local/up.sh          # start + apply migrations + write .env.local
supabase/local/up.sh --reset  # wipe the local DB first
npm run dev                   # app now runs in live mode against the local stack
docker compose -f supabase/local/docker-compose.yml down   # stop
```

The DB test suite can also target this real image:
`JUDGEY_TEST_DATABASE_URL=postgres://postgres:judgey-local-db@localhost:54322/postgres npm run test:db`

Everything here is **local-only**: the JWT secret and keys are public dev values.
Production keys come from the Supabase dashboard (see `docs/meet-day-runbook.md`).
Realtime, Storage and Studio are intentionally left out (Judgey v1 polls).

## Live end-to-end test

```bash
supabase/local/up.sh
npm run build && npx next start -p 3024     # build after .env.local exists
npm run test:e2e:live                       # 3 browser phones + 12 scripted voters
```

It resets an `e2e-practice` meet (demo roster, first routine 6 minutes ago) and
checks the whole loop: local-first check-in, crowd confirmation, vote, own-team
block, server-side rule enforcement against direct API calls, operator mode,
division reveal and offline behaviour.
