#!/usr/bin/env bash
# Start the local Supabase-compatible stack, apply cheer/supabase/migrations,
# and write cheer/.env.local so `npm run dev` talks to it.
# Usage: supabase/local/up.sh [--reset]   (--reset wipes the local database first)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CHEER="$(cd "$HERE/../.." && pwd)"
COMPOSE=(docker compose -f "$HERE/docker-compose.yml")

if [[ "${1:-}" == "--reset" ]]; then "${COMPOSE[@]}" down -v; fi
"${COMPOSE[@]}" up -d --wait db
"${COMPOSE[@]}" up -d

# Uses your psql if you have one; otherwise the one inside the db container.
if command -v psql >/dev/null 2>&1; then
  export PGPASSWORD=judgey-local-db
  PSQL=(psql -h localhost -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
else
  PSQL=("${COMPOSE[@]}" exec -T -e PGPASSWORD=judgey-local-db db psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
fi
"${PSQL[@]}" -c "create table if not exists public._judgey_local_migrations (name text primary key, applied_at timestamptz default now())" \
  -c "revoke all on public._judgey_local_migrations from anon, authenticated"
for f in "$CHEER"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  if [[ "$("${PSQL[@]}" -tAc "select 1 from public._judgey_local_migrations where name = '$name'")" != "1" ]]; then
    echo "applying $name"
    "${PSQL[@]}" -1 -f - < "$f"
    "${PSQL[@]}" -c "insert into public._judgey_local_migrations(name) values ('$name')"
  fi
done
"${PSQL[@]}" -c "notify pgrst, 'reload schema'"

node "$HERE/keys.mjs" | grep -v '^#' | grep -v SERVICE > "$CHEER/.env.local"
echo "wrote $CHEER/.env.local; gateway http://localhost:54321, db postgres://postgres:judgey-local-db@localhost:54322/postgres"
