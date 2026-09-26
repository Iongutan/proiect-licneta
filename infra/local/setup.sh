#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# OptiFleet — instalare locală completă (Supabase self-hosted + schema)
#
# Rulează din Git Bash (Windows) sau bash (Linux/macOS), cu Docker pornit:
#     bash infra/local/setup.sh            # instalare
#     bash infra/local/setup.sh --demo     # + date demo și două conturi de test
#
# Ce face (idempotent — se poate rula din nou fără să strice nimic):
#   1. descarcă configurația oficială Supabase self-hosted (versiune fixată)
#   2. generează TOATE secretele aleator (nimic implicit, nimic în git)
#   3. pornește serviciile, doar pe 127.0.0.1
#   4. aplică schema OptiFleet (supabase/sql)
#   5. creează contul de administrator al platformei
#   6. scrie frontend/.env.local pentru baza locală
# Credențialele se salvează în infra/local/.credentials (ignorat de git).
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SUPABASE_REF="self-hosted/v0.8.2"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
STACK="$HERE/supabase"
CREDS="$HERE/.credentials"
DEMO=0
[[ "${1:-}" == "--demo" ]] && DEMO=1

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mEROARE:\033[0m %s\n' "$*" >&2; exit 1; }
# Git Bash pe Windows convertește căile Unix din argumente; le dezactivăm pentru docker.
export MSYS_NO_PATHCONV=1
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }
rand_hex() { openssl rand -hex "$1"; }
env_set() { # env_set KEY VALUE — înlocuiește sau adaugă o linie în .env
  local k="$1" v="$2" f="$STACK/.env"
  if grep -q "^${k}=" "$f"; then
    awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  else
    printf '%s=%s\n' "$k" "$v" >> "$f"
  fi
}
env_get() { grep -E "^$1=" "$STACK/.env" | head -1 | cut -d= -f2-; }

command -v docker >/dev/null || die "Docker nu e instalat."
docker info >/dev/null 2>&1 || die "Docker nu rulează. Pornește Docker Desktop."
command -v git >/dev/null || die "Git nu e instalat."
command -v openssl >/dev/null || die "openssl lipsește (vine cu Git Bash)."

# ── 1. Configurația oficială, versiune fixată ─────────────────────────────
if [[ ! -f "$STACK/docker-compose.yml" ]]; then
  log "Descarc Supabase self-hosted ($SUPABASE_REF)…"
  # Căi relative: pe Windows, git.exe nu înțelege căile /tmp din Git Bash.
  ( cd "$HERE" && rm -rf .src     && git -c core.autocrlf=false -c advice.detachedHead=false clone -q --depth 1 --branch "$SUPABASE_REF"          --filter=blob:none --sparse https://github.com/supabase/supabase .src     && git -C .src sparse-checkout set docker )
  [[ -f "$HERE/.src/docker/docker-compose.yml" ]] || die "Descărcarea configurației Supabase a eșuat."
  mkdir -p "$STACK"
  cp -r "$HERE/.src/docker/." "$STACK/"
  rm -rf "$HERE/.src"
fi
cp "$HERE/docker-compose.optifleet.yml" "$STACK/docker-compose.optifleet.yml"

# ── 2. Secrete ────────────────────────────────────────────────────────────
if [[ ! -f "$STACK/.env" ]]; then
  log "Generez secretele…"
  cp "$STACK/.env.example" "$STACK/.env"
  # Scripturile oficiale au nevoie de openssl + jq + node; le rulăm în containere,
  # ca să funcționeze identic pe Windows și pe Linux.
  docker run --rm -v "$(host_path "$STACK"):/w" -w /w alpine:3.20 \
    sh -c "apk add -q openssl jq >/dev/null && sh utils/generate-keys.sh --update-env >/dev/null"
  docker run --rm -v "$(host_path "$STACK"):/w" -w /w node:22-alpine \
    sh -c "apk add -q openssl jq >/dev/null && sh utils/add-new-auth-keys.sh --update-env >/dev/null"
  env_set POSTGRES_PASSWORD "$(rand_hex 24)"
  env_set DASHBOARD_USERNAME "optifleet"
  env_set DASHBOARD_PASSWORD "$(rand_hex 16)"
  env_set POOLER_TENANT_ID "optifleet"
fi
grep -q "your-super-secret\|this_password_is_insecure" "$STACK/.env" && die "Au rămas secrete implicite în .env."
[[ -n "$(env_get SUPABASE_PUBLISHABLE_KEY)" ]] || die "Cheia publishable nu a fost generată."

env_set COMPOSE_PATH_SEPARATOR ":"
env_set COMPOSE_FILE "docker-compose.yml:docker-compose.optifleet.yml"
env_set SUPABASE_PUBLIC_URL "http://localhost:8000"
env_set API_EXTERNAL_URL "http://localhost:8000/auth/v1"
env_set SITE_URL "http://localhost:3000"
env_set ADDITIONAL_REDIRECT_URLS "http://localhost:3000/auth/callback"
env_set ENABLE_PHONE_SIGNUP "false"
# Local nu există server de email: conturile se activează direct; accesul la
# rezervări/contracte rămâne blocat până la verificarea firmei de către admin (KYC).
env_set ENABLE_EMAIL_AUTOCONFIRM "true"
env_set OPENAI_API_KEY ""
chmod 600 "$STACK/.env" 2>/dev/null || true

# ── 3. Pornire ────────────────────────────────────────────────────────────
log "Pornesc serviciile (prima dată durează câteva minute)…"
( cd "$STACK" && docker compose up -d --quiet-pull )

log "Aștept ca baza de date, autentificarea și stocarea să fie gata…"
for i in $(seq 1 120); do
  ready=1
  for svc in supabase-db supabase-auth supabase-storage supabase-rest; do
    state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$svc" 2>/dev/null || echo missing)"
    [[ "$state" == "healthy" || "$state" == "running" ]] || ready=0
  done
  [[ $ready == 1 ]] && docker exec supabase-db psql -U postgres -tAc "select 1 from pg_tables where schemaname='storage' and tablename='buckets'" 2>/dev/null | grep -q 1 && break
  sleep 3
  [[ $i == 120 ]] && die "Serviciile nu au pornit în 6 minute. Verifică: cd infra/local/supabase && docker compose ps"
done

log "Aștept gateway-ul API (localhost:8000)…"
for i in $(seq 1 100); do
  # Redirecționare prin shell (nu „-o /dev/null”: curl.exe pe Windows nu înțelege calea).
  curl -fsS "http://127.0.0.1:8000/auth/v1/health"     -H "apikey: $(env_get SUPABASE_PUBLISHABLE_KEY)" >/dev/null 2>&1 && break
  sleep 3
  [[ $i == 100 ]] && die "Gateway-ul nu răspunde. Verifică: cd infra/local/supabase && docker compose ps"
done

# ── 4. Schema OptiFleet ───────────────────────────────────────────────────
psql_db() { docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
if psql_db -tAc "select to_regclass('public.vehicles') is not null" | grep -q t; then
  log "Schema OptiFleet există deja — nu o reaplic."
else
  log "Aplic schema OptiFleet…"
  for f in "$ROOT"/supabase/sql/0[1-9]_*.sql "$ROOT"/supabase/sql/1[0-9]_*.sql; do
    name="$(basename "$f")"
    [[ "$name" == 08_seed_demo.sql && $DEMO == 0 ]] && continue
    printf '   %s\n' "$name"
    psql_db < "$f" >/dev/null
  done
fi

# ── 5. Conturi ────────────────────────────────────────────────────────────
SECRET_KEY="$(env_get SUPABASE_SECRET_KEY)"
create_user() { # create_user EMAIL PAROLA METADATA_JSON → întoarce id-ul
  curl -fsS -X POST "http://127.0.0.1:8000/auth/v1/admin/users" \
    -H "apikey: $SECRET_KEY" -H "Authorization: Bearer $SECRET_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"email_confirm\":true,\"user_metadata\":$3}" \
    | sed -E 's/.*"id":"([0-9a-f-]{36})".*/\1/'
}

if [[ ! -f "$CREDS" ]]; then
  log "Creez contul de administrator al platformei…"
  ADMIN_PW="$(rand_hex 12)"
  admin_id="$(create_user "admin@optifleet.local" "$ADMIN_PW" '{}')"
  [[ "$admin_id" =~ ^[0-9a-f-]{36}$ ]] || die "Contul de admin nu a putut fi creat."
  psql_db -c "insert into public.platform_admins (user_id) values ('$admin_id') on conflict do nothing" >/dev/null
  {
    echo "# OptiFleet — credențiale locale (NU le trimite nimănui, NU le pune în git)"
    echo "STUDIO_URL=http://localhost:8000"
    echo "STUDIO_USER=$(env_get DASHBOARD_USERNAME)"
    echo "STUDIO_PASSWORD=$(env_get DASHBOARD_PASSWORD)"
    echo "POSTGRES=postgres://postgres.optifleet:$(env_get POSTGRES_PASSWORD)@127.0.0.1:5432/postgres"
    echo "ADMIN_EMAIL=admin@optifleet.local"
    echo "ADMIN_PASSWORD=$ADMIN_PW"
  } > "$CREDS"
  chmod 600 "$CREDS" 2>/dev/null || true
fi

if [[ $DEMO == 1 ]] && ! grep -q "^DEMO_CARRIER_EMAIL" "$CREDS"; then
  log "Creez conturile demo (transportator + expeditor)…"
  CPW="$(rand_hex 12)"; SPW="$(rand_hex 12)"
  cid="$(create_user "transportator@optifleet.local" "$CPW" '{"full_name":"Ion Dispecer","company_name":"Demo Transport","legal_form":"SRL","idno":"1003600999991","company_kind":"CARRIER","district_id":"chisinau"}')"
  sid="$(create_user "expeditor@optifleet.local" "$SPW" '{"full_name":"Ana Logistică","company_name":"Demo Marfă","legal_form":"SRL","idno":"1003600999992","company_kind":"SHIPPER","district_id":"balti"}')"
  [[ "$cid" =~ ^[0-9a-f-]{36}$ && "$sid" =~ ^[0-9a-f-]{36}$ ]] || die "Conturile demo nu au putut fi create."
  psql_db -c "update public.companies set kyc_status = 'VERIFIED', verified_at = now()
              where id in (select company_id from public.profiles where id in ('$cid', '$sid'))" >/dev/null
  {
    echo "DEMO_CARRIER_EMAIL=transportator@optifleet.local"
    echo "DEMO_CARRIER_PASSWORD=$CPW"
    echo "DEMO_SHIPPER_EMAIL=expeditor@optifleet.local"
    echo "DEMO_SHIPPER_PASSWORD=$SPW"
  } >> "$CREDS"
fi

# ── 6. Frontend ───────────────────────────────────────────────────────────
FE="$ROOT/frontend/.env.local"
if [[ -f "$FE" ]] && ! grep -q "localhost:8000" "$FE"; then
  cp "$FE" "$FE.cloud-backup"
  log "Am păstrat configurația veche în frontend/.env.local.cloud-backup"
fi
ML_TOKEN="$( (grep -E '^ML_SERVICE_TOKEN=' "$FE" 2>/dev/null || true) | cut -d= -f2-)"
[[ ${#ML_TOKEN} -ge 32 ]] || ML_TOKEN="$(rand_hex 32)"
cat > "$FE" <<EOF
# Generat de infra/local/setup.sh — baza de date LOCALĂ (Supabase self-hosted)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$(env_get SUPABASE_PUBLISHABLE_KEY)
ML_SERVICE_URL=http://127.0.0.1:8001
ML_SERVICE_TOKEN=$ML_TOKEN
OSRM_URL=http://127.0.0.1:5000
EOF
chmod 600 "$FE" 2>/dev/null || true
if [[ -f "$ROOT/ml_service/.env" ]] && grep -q "^INTERNAL_API_TOKEN=" "$ROOT/ml_service/.env"; then
  awk -v v="$ML_TOKEN" 'BEGIN{FS=OFS="="} $1=="INTERNAL_API_TOKEN"{print $1"="v; next}{print}' "$ROOT/ml_service/.env" > "$ROOT/ml_service/.env.tmp" \
    && mv "$ROOT/ml_service/.env.tmp" "$ROOT/ml_service/.env"
else
  printf 'ENVIRONMENT=development\nINTERNAL_API_TOKEN=%s\nOLLAMA_MODEL=qwen3:14b\n' "$ML_TOKEN" > "$ROOT/ml_service/.env"
fi

log "Gata."
cat <<EOF

  Panou bază de date (Supabase Studio): http://localhost:8000
  Aplicația:  npm --prefix frontend run dev  →  http://localhost:3000
  Parolele sunt în:  infra/local/.credentials

  Oprire:  bash infra/local/stop.sh      Backup:  bash infra/local/backup.sh
EOF
