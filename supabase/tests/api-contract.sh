#!/usr/bin/env bash
# Pornește Postgres (Supabase) + PostgREST local, aplică schema v2 și rulează
# testul de contract frontend ↔ API (api-contract.mjs).
# Utilizare: bash supabase/tests/api-contract.sh
set -euo pipefail
cd "$(dirname "$0")/.."
NET=optifleet-apitest
DB=optifleet-apitest-db
API=optifleet-apitest-rest
PW=local-test-only
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

cleanup() { docker rm -f "$DB" "$API" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; }
cleanup
trap cleanup EXIT
docker network create "$NET" >/dev/null
docker run -d --name "$DB" --network "$NET" -e POSTGRES_PASSWORD=$PW supabase/postgres:15.8.1.085 >/dev/null
until docker exec "$DB" pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 2; done
sleep 4

run()   { docker exec -i -e PGPASSWORD=$PW "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q -f - < "$1"; }
runsu() { docker exec -i -e PGPASSWORD=$PW "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -f - < "$1"; }
runsu tests/00_test_prelude.sql
for f in sql/0[1-9]_*.sql; do run "$f" >/dev/null; done

# auth.uid() ca în Supabase Cloud (citește și request.jwt.claims, setat de PostgREST 12)
docker exec -i -e PGPASSWORD=$PW "$DB" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1 <<SQL
create or replace function auth.uid() returns uuid language sql stable as \$\$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
\$\$;
alter role authenticator with login password '$PW';
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 's@test.md', '{"full_name":"Ana","company_name":"Expeditor Unu","legal_form":"SRL","idno":"2000000000011","company_kind":"SHIPPER","district_id":"chisinau"}'),
  ('33333333-3333-4333-8333-333333333333', 'c@test.md', '{"full_name":"Ion","company_name":"Carausul Test","legal_form":"SRL","idno":"2000000000033","company_kind":"CARRIER","district_id":"chisinau"}'),
  ('55555555-5555-4555-8555-555555555555', 'a@test.md', '{}');
insert into public.platform_admins (user_id) values ('55555555-5555-4555-8555-555555555555');
SQL

docker run -d --name "$API" --network "$NET" -p 127.0.0.1:55433:3000 \
  -e PGRST_DB_URI="postgres://authenticator:$PW@$DB:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$JWT_SECRET" -e PGRST_JWT_AUD=authenticated \
  postgrest/postgrest:v12.2.12 >/dev/null
until curl -s -o /dev/null http://127.0.0.1:55433/; do sleep 1; done

JWT_SECRET="$JWT_SECRET" PGRST_URL=http://127.0.0.1:55433 node tests/api-contract.mjs
