# Manual de pornire — OptiFleet B2B v2

Pașii de mai jos duc platforma de la zero până la un parcurs complet funcțional. Trebuie făcuți o singură dată, cu excepția pasului 6.

## 0. Ce îți trebuie

| Unealtă | Pentru ce | Obligatoriu |
|---|---|---|
| Node.js 20.9+ (testat pe 24) | frontend | da |
| Un proiect Supabase (supabase.com) | baza de date, autentificare, fișiere, timp real | da |
| Docker Desktop | OSRM (trasee reale), ml_service (grupaj DBSCAN), teste SQL | recomandat |
| Ollama + `qwen3:14b` | interpretarea căutărilor pe care parserul nu le înțelege | opțional |

## 1. Schema bazei de date

În **Supabase → SQL Editor** rulează fișierele din `supabase/sql/`, **în ordine**, fiecare într-o interogare separată:

| Fișier | Ce face |
|---|---|
| `00_reset_old_schema.sql` | **Doar dacă** proiectul are tabelele din v1. Le șterge definitiv, împreună cu cele 3 conturi demo vechi, ale căror parole au ajuns în git. |
| `01_extensions.sql` | PostGIS, pgcrypto, întărirea schemei `public` |
| `02_tables.sql` | tabelele |
| `03_functions_core.sql` | identitate, jurnal, notificări, crearea firmei la înregistrare |
| `04_rls_and_grants.sql` | Row Level Security și drepturile pe coloane |
| `05_business_rpc.sql` | flotă, căutare, rezervări, contracte, livrare, KYC |
| `06_storage_realtime.sql` | bucket-ul privat pentru poze și Realtime |
| `07_seed_districts.sql` | cele 37 de raioane |
| `08_seed_demo.sql` | *opțional*: 12 firme demo, 10 vehicule pe coridoare reale, 4 cereri |
| `09_views.sql` | view-urile pentru hartă |

Dacă ai rulat înainte hook-ul din v1: **Authentication → Hooks → „Custom Access Token”** → dezactivează-l.

## 2. Setări de autentificare (Supabase → Authentication)

- **Sign In / Providers → Email**: „Confirm email” ON.
- **Policies / Passwords**: lungime minimă **10**; activează **Leaked password protection**, dacă planul permite.
- **URL Configuration**: Site URL `http://localhost:3000`; la Redirect URLs adaugă `http://localhost:3000/auth/callback`, plus domeniul de producție, dacă ai unul.
- **Rate limits**: lasă valorile implicite (limitează încercările de login și înregistrare).

## 3. Contul de administrator al platformei

Administratorul verifică firmele (KYC) și vede jurnalul. **Nu se creează din aplicație.**

1. **Authentication → Users → Add user → Create new user**: email-ul tău și o parolă puternică, cu „Auto Confirm User” bifat.
2. În SQL Editor:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'emailul-tau@exemplu.md';
   ```

## 4. Frontend

```bash
cd frontend
cp .env.example .env.local      # pe Windows: copy .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

În `.env.local` completează:
- `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, din **Project Settings → API Keys**. Pune cheia *publishable* (`sb_publishable_…`), **niciodată** pe cea secretă; aplicația refuză să pornească dacă primește cheia secretă.
- `ML_SERVICE_TOKEN`: același secret ca `INTERNAL_API_TOKEN` din `ml_service/.env` (pasul 5). Se generează cu `openssl rand -hex 32`.

> Pe acest calculator scripturile folosesc `--webpack`: binarul nativ Turbopack (SWC) nu se încarcă pe Windows-ul actual.

## 5. Servicii Docker (opțional, recomandat)

```bash
# o singură dată: datele de rutare pentru Moldova (~5 minute)
bash osrm/setup.sh

cp ml_service/.env.example ml_service/.env    # completează INTERNAL_API_TOKEN
docker compose up -d                          # osrm :5000 și ml_service :8001, doar pe 127.0.0.1
```

Fără Docker aplicația funcționează în continuare. Traseele devin linii drepte între raioane, iar gruparea DBSCAN afișează „serviciul nu rulează”.

Pentru interpretarea căutărilor cu AI local: instalează Ollama, apoi `ollama pull qwen3:14b`.

## 6. Parcursul de verificare (pentru prezentare)

1. **Administrator** → `/admin` → „Reîmprospătează cursele demo”. Cele 10 vehicule demo pornesc acum pe hartă.
2. **Înregistrează un transportator** (`/register` → „Sunt transportator”). Adminul îl verifică în `/admin`.
3. Transportatorul → **Flota mea** → butonul **„+”** → constructorul în 4 pași. Apoi, în pagina vehiculului:
   - plasează paleții pe plan (trage, R pentru rotire, Delete pentru ștergere), apoi „Salvează planul”;
   - setează cursa, de exemplu Chișinău → Rezina;
   - generează tokenul GPS.
4. **Înregistrează un expeditor** („Am marfă de transportat”). Adminul îl verifică.
5. Expeditorul → **Hartă** → caută „Chișinău - Orhei cu tranzit”. Apar vehiculele directe și cele în tranzit, cu ora de trecere. Deschide vehiculul → „Cere locuri”.
6. Expeditorul → **Comenzile mele** → „+” → publică o cerere cu locația pe hartă, paleții și tipul vehiculului. Transportatorul o vede în **Bursa de marfă** și face o ofertă.
7. **Contracte**: negociați prețul, acceptați-l, alegeți calea A (contract cu SHA-256, semnat de ambii) sau calea B (fereastra de exonerare). Transportatorul pornește cursa, fotografiază marfa, iar ambii confirmă livrarea.

Poziție GPS simulată (tokenul din pagina vehiculului):
```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"lat":47.38,"lon":28.82,"speed_kmh":62,"heading":20}'
```

## 7. Teste

```bash
npm --prefix frontend test                       # unit (vitest)
npm --prefix frontend run typecheck && npm --prefix frontend run lint
bash supabase/tests/run.sh                       # schema + RLS + fluxuri (Docker)
bash supabase/tests/api-contract.sh              # apelurile interfeței prin PostgREST (Docker)
docker compose run --rm ml_service python -m pytest -q
```

## 8. Producție (Vercel + Supabase)

- Vercel: Root Directory `frontend`, Build Command `npm run build`. Variabile: cele din `.env.example`, iar `ML_SERVICE_URL`/`OSRM_URL` indică serverele tale (HTTPS).
- Supabase: adaugă domeniul Vercel la Site URL și la Redirect URLs.
- `ml_service` și OSRM rulează pe un server cu Docker. Expune-le **doar** prin HTTPS și către IP-urile Vercel, sau printr-un tunel; `ml_service` cere tokenul oricum.
