#!/usr/bin/env bash
# Aplică schema v2 într-un Postgres Supabase local (Docker) și rulează testele.
# Utilizare: bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=supabase/postgres:15.8.1.085
NAME=optifleet-sqltest
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=local-test-only "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
until docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 2; done
sleep 4
# Migrațiile rulează ca `postgres`, exact ca în SQL Editor-ul Supabase.
run()   { docker exec -i -e PGPASSWORD=local-test-only "$NAME" psql -U postgres       -v ON_ERROR_STOP=1 -q -f - < "$1"; }
runsu() { docker exec -i -e PGPASSWORD=local-test-only "$NAME" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -f - < "$1"; }
runsu tests/00_test_prelude.sql
for f in sql/0[1-8]_*.sql; do echo "→ $f"; run "$f"; done
run tests/10_security_and_flows.sql
