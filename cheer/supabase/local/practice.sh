#!/usr/bin/env bash
# Create (or reset) a practice meet on the local stack whose first routine
# starts N minutes from now (default 2), using the demo roster.
# Usage: supabase/local/practice.sh [minutes-from-now] [meet-id]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CHEER="$(cd "$HERE/../.." && pwd)"
COMPOSE=(docker compose -f "$HERE/docker-compose.yml")
MIN="${1:-2}"
MEET="${2:-practice}"
if command -v psql >/dev/null 2>&1; then
  export PGPASSWORD=judgey-local-db
  PSQL=(psql -h localhost -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
else
  PSQL=("${COMPOSE[@]}" exec -T -e PGPASSWORD=judgey-local-db db psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
fi

START="$(node -e "const d=new Date(Date.now()+Number(process.argv[1])*60000);d.setSeconds(0,0);console.log(d.toISOString())" "$MIN")"
LOG="$(mktemp)"
SQL="$(mktemp)"
trap 'rm -f "$LOG" "$SQL"' EXIT

# The importer generates a strong operator code and prints it to stderr.
if ! (cd "$CHEER" && node --experimental-strip-types --no-warnings scripts/import-meet.ts \
  --demo --start "$START" --meet "$MEET" --name "Judgey Practice Meet" --operator) > "$SQL" 2> "$LOG"; then
  cat "$LOG" >&2
  exit 1
fi
CODE="$(sed -n 's/^operator code (generated): //p' "$LOG")"

echo "delete from public.meets where id = '$MEET';" | "${PSQL[@]}"
"${PSQL[@]}" < "$SQL"

cat <<MSG

Practice meet "$MEET" is ready (first routine at $START).
  Parent / fan:  http://localhost:3004/?meet=$MEET
  Operator:      http://localhost:3004/?meet=$MEET&op=$CODE
Open each link in its own browser window (use incognito windows to be different people).
MSG
