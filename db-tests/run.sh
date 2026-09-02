#!/bin/bash
# Load every migration into a throwaway database, then assert what the triggers
# and policies actually do. See README.md.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
FUTSAL="${FUTSAL_DIR:-$HERE/..}"
BILL="${BILL_DIR:-$HERE/../../Billiards_MyaThida/supabase}"
GAME="${GAME_DIR:-$HERE/../../MyaThida_Game/supabase}"

PGHOST="${PGHOST:-/tmp}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
DB="${TEST_DB:-myathida_test}"
export PGHOST PGPORT PGUSER

PSQL="psql -v ON_ERROR_STOP=1 -q"

psql -q -c "drop database if exists $DB" postgres
psql -q -c "create database $DB" postgres

run() {
  if [ ! -f "$1" ]; then echo "  MISSING $1"; return 1; fi
  if $PSQL -d "$DB" -f "$1" > /tmp/mig.log 2>&1; then
    echo "  ok    $(basename "$1")"
  else
    echo "  FAIL  $(basename "$1")"
    grep -E "ERROR|FATAL" /tmp/mig.log | head -3 | sed 's/^/          /'
    return 1
  fi
}

echo "== scaffold =="
run "$HERE/00-scaffold.sql" || exit 1

# The order matters and is not alphabetical: billiards and game both refuse to
# load until app-access-migration.sql has run, which is the guard doing its job.
echo "== futsal base =="
for f in supabase-setup.sql supabase-superadmin-migration.sql handle-new-user-trigger-fix.sql \
         supabase-multilingual-rewards.sql soft-delete-rewards-migration.sql \
         point-adjustment-migration.sql redemption-requests-migration.sql \
         redemption-cost-snapshot-migration.sql profiles-updated-at-migration.sql; do
  run "$FUTSAL/$f" || exit 1
done

echo "== shared identity =="
run "$FUTSAL/app-access-migration.sql" || exit 1

echo "== the other two businesses =="
run "$BILL/billiards-schema-migration.sql" || exit 1
run "$GAME/game-schema-migration.sql"      || exit 1
run "$GAME/game-profile-migration.sql"     || exit 1
run "$GAME/game-corrections-migration.sql" || exit 1

echo "== portal and audit =="
for f in app-access-grants-migration.sql admin-provisioning-migration.sql \
         audit-log-migration.sql audit-money-migration.sql audit-catalogue-migration.sql; do
  run "$FUTSAL/$f" || exit 1
done

echo
echo "== assertions =="
for f in 90-access.sql 91-catalogue.sql 92-integrity.sql; do
  psql -d "$DB" -q -f "$HERE/$f" 2>&1 | grep -E "^psql.*ERROR|FATAL" | head -5
done

echo
psql -d "$DB" -tA -F' | ' -c \
  "select case when ok then 'PASS' else 'FAIL' end, label, case when ok then '' else detail end
     from _results order by ok, ctid"
echo
psql -d "$DB" -tA -c \
  "select format('%s passed, %s failed', count(*) filter (where ok), count(*) filter (where not ok)) from _results"
psql -d "$DB" -tA -c "select count(*) from _results where not ok" | grep -q '^0$'
