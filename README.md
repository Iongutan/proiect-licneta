# OptiFleet B2B

Bursă B2B de transport marfă pentru IMM-urile din Republica Moldova. Proiect de licență la UTM, FCIM (Ion Guțan, TI-233).

Platforma leagă două tipuri de firme:
- **expeditori fără flotă**, care caută camioane ce merg sau doar trec pe traseul lor și rezervă câțiva paleți;
- **transportatori**, care își listează vehiculele cu locurile libere și răspund cererilor din bursă.

Parcursul complet: căutare → negociere → contract (prin platformă sau direct) → cursă urmărită prin GPS → dovadă foto → confirmarea livrării.

## Arhitectură

```
Browser ──► Next.js 16 (frontend/)          proxy.ts: sesiune + CSP cu nonce
              │  cheia publishable + JWT-ul utilizatorului
              ▼
          Supabase (cloud)                  Auth · Postgres/PostGIS · RLS · Realtime · Storage
              ▲  RPC-uri SECURITY DEFINER (supabase/sql/05_business_rpc.sql)
              │
Next.js route handlers ──► ml_service (Docker, intern, token)   DBSCAN · CVRP · Qwen3
                      └──► OSRM (Docker, intern)                trasee pe drumurile Moldovei
```

- **Baza de date e sursa de adevăr pentru securitate.** Fiecare rând e protejat prin Row Level Security, iar clientul poate scrie doar coloanele permise explicit. Tranzițiile de stare (rezervare, semnare, livrare, KYC) trec exclusiv prin funcții RPC care verifică apelantul și scriu jurnalul de audit.
- **`ml_service` nu are acces la baza de date.** Primește date deja filtrate prin RLS de serverul Next.js și întoarce doar rezultate de calcul.
- Detaliile sunt în [SECURITATE_SI_DATE_PERSONALE.md](SECURITATE_SI_DATE_PERSONALE.md).

## Funcționalități (prompturile K din `materiale/`)

| K | Unde |
|---|---|
| K1 Design propriu, numele firmei în antet | `app/globals.css`, `components/ui/Sidebar.tsx` |
| K2 Bară laterală + căutare centrată | `components/map/MapScreen.tsx` |
| K3 Agregare pe regiune → raion → vehicul | `lib/clustering.ts`, `components/map/RealMoldovaMap.tsx` |
| K4 Căutare cu tranzit, ora de trecere, filtru strict de capacitate, sugestii proactive | `lib/search-intent.ts`, `search_trips()`, `vehicles_passing_near_me()` |
| K5 Panoul vehiculului, cu actualizare live | `components/map/VehicleDrawer.tsx` |
| K6 Constructorul de vehicul (butonul „+”) | `components/fleet/VehicleWizard.tsx` |
| K7 Plan de paleți la scară, drag-and-drop, coliziuni | `components/logistics/TruckCargo2D.tsx`, `save_vehicle_layout()` |
| K8 Cerere de paleți + negociere în platformă | `VehicleDrawer`, `components/bookings/BookingDetail.tsx` |
| K9 Contract: calea A (platformă) sau calea B (directă, cu exonerare) | `choose_contract_path()`, `sign_booking()` |
| K10 Capacitate live, fără suprarezervare | `_reserve_capacity()` (blocare de rând), Realtime |
| K11 Dovadă foto la livrare, vizibilă doar părților | bucket privat `delivery-proofs`, `record_delivery_proof()` |
| K12 Preț/km, contract completat automat din profilul legal | `propose_booking()`, `choose_contract_path()` |

Tot aici: cererile expeditorilor fără mașini (`components/requests/`), grupaj DBSCAN (`ml_service`), tokenuri GPS pentru trackere (`/api/telemetry`) și verificarea KYC de către administrator (`/admin`).

## Pornire rapidă

Pașii detaliați sunt în [MANUAL_DE_PORNIRE.md](MANUAL_DE_PORNIRE.md). Pe scurt:

0. **Local (recomandat):** o dată `bash infra/local/setup.sh --demo` din Git Bash, apoi dublu-clic pe `OptiFleet.cmd`. Planul complet: [PLAN_IMPLEMENTARE.md](PLAN_IMPLEMENTARE.md).
1. **Supabase Cloud (alternativ)**: rulează în SQL Editor, în ordine, fișierele `supabase/sql/01_…` → `09_…` (plus `00_…` o singură dată, dacă proiectul are schema veche).
2. **Frontend**: `cp frontend/.env.example frontend/.env.local` și completează valorile, apoi `npm --prefix frontend install` și `npm --prefix frontend run dev` → http://localhost:3000
3. **Opțional**: `docker compose up -d` pentru OSRM (trasee reale) și `ml_service` (grupaj DBSCAN, Qwen3).

## Teste

| Comandă | Ce verifică |
|---|---|
| `npm --prefix frontend test` | parser de căutare, geometria paleților, agregarea hărții, sincronizarea raioanelor cu SQL |
| `npm --prefix frontend run typecheck` / `run lint` / `run build` | TypeScript, ESLint (reguli React Compiler), build de producție |
| `bash supabase/tests/run.sh` | schema pe un Postgres Supabase local: RLS, drepturi pe coloane, K4, K7–K11, GPS (38 de aserțiuni + atacuri care trebuie să eșueze) |
| `bash supabase/tests/api-contract.sh` | aceleași apeluri PostgREST/RPC ca interfața, ca utilizatori reali (45 de verificări) |
| `docker compose run --rm ml_service python -m pytest -q` | DBSCAN, CVRP, autentificarea internă |

## Structura

```
frontend/            Next.js 16 (App Router), Tailwind 4, Leaflet, Supabase SSR
  src/proxy.ts       sesiune + redirect + Content-Security-Policy
  src/app/           pagini: map, fleet, requests, bookings, account, admin, login, register
  src/components/    hartă, flotă, cereri, contracte, desene vehicule
  src/lib/           logică pură (testată), clienți Supabase, validări
supabase/sql/        schema v2, rulată în ordine
supabase/tests/      teste SQL și testul de contract API (Docker)
ml_service/          FastAPI intern: optifleet_ml/ (grouping, routing, intent)
osrm/                setup.sh + date OSRM pentru Moldova
materiale/           documentația tezei și prompturile J/K
CLAUDE.md            memoria proiectului (vezi proiect-memorie/memory/)
```

## Curățenie (fișiere din v1 care pot fi șterse)

Nu mai sunt folosite. Fie au fost înlocuite de stub-uri, fie nu mai sunt referite de nimic:

```
api/  backend/  nginx.conf  monitoring/  supabase/migrations/
ml_service/app/  ml_service/worker.py
frontend/src/hooks/  frontend/src/lib/api-client.ts  frontend/src/lib/demo-data.ts
frontend/src/lib/kyc-data.ts  frontend/src/lib/contracts-engine.ts
frontend/src/app/{orders,contracts,clusters,verification,dashboard,chat}/  frontend/src/app/api/chat/
frontend/scripts/  frontend/.env.local.example  api/.env  backend/.env.example
```
