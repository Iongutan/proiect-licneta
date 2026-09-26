# Resurse găsite (librării, repo-uri, pachete)

## Folosite / integrate în proiect
- `@supabase/ssr` 0.12 — sesiuni pe cookie-uri pentru Next.js App Router; `getClaims()` verifică JWT-ul prin JWKS (2026-09-26)
- `@supabase/supabase-js` 2.116 — client DB/Auth/Realtime/Storage (2026-09-26)
- `leaflet` 1.9 + tile-uri OpenStreetMap — harta (2026-09-26)
- `supercluster` 9 — gruparea markerilor suprapuși la zoom mare (K3) (2026-09-26)
- `vitest` 5 — teste unitare frontend (necesită `@types/node` ≥ 22) (2026-09-26)
- `lucide-react` — iconițe (set unic, folosit rar) (2026-09-26)
- Python: `fastapi`, `pydantic-settings`, `scikit-learn` (DBSCAN precomputed), `ortools` (CVRP P&D), `httpx` (2026-09-26)
- Docker: `supabase/postgres:15.8.1.085` (teste SQL), `postgrest/postgrest:v12.2.12` (test de contract), `ghcr.io/project-osrm/osrm-backend` (rutare) (2026-09-26)

## Evaluate dar respinse (ca să nu fie re-evaluate degeaba)
- `@supabase/auth-helpers-nextjs` — depreciat; înlocuit de `@supabase/ssr` (2026-09-26)
- `python-jose` — CVE-uri cunoscute; nu mai e necesar (ml_service folosește token intern) (2026-09-26)
- Serverul public OSRM (`router.project-osrm.org`) — politica lui interzice uzul în aplicații; folosim OSRM local (2026-09-26)
- Turbopack pe acest PC — binarul SWC nativ e refuzat de Windows; folosim `--webpack` (2026-09-26)
- Redis + worker de coadă pentru ML — inutil pentru calcule de sub 30 s; eliminat (2026-09-26)

## De verificat pe viitor
- Specificația oficială ASP pentru cifra de control IDNO
- MSign (semnătură electronică calificată RM) pentru contracte de valoare mare
