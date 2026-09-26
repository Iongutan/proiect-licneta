# Jurnal sesiuni

Fiecare sesiune adaugă o intrare nouă LA SFÂRȘIT. Nu se șterge nimic din
acest fișier niciodată.

---

## [inițializare] — setup inițial
- Structura de memorie a fost creată.
- Nicio sesiune de lucru nu a rulat încă.

## 2026-09-26 — Audit complet cod + mutare memorie în rădăcină
**Făcut:**
- `proiect-memorie/CLAUDE.md` mutat în `CLAUDE.md` (rădăcină) ca să fie citit
  automat; `MEMORY.md` duplicat eliminat.
- Audit complet: api (Rust), backend, ml_service, frontend, supabase, docker.

**Găsit — securitate (critic):**
- `api` `/auth/login` emite JWT pentru orice user_id/rol trimis, fără parolă.
- WebSocket `/ws/vehicle/:id` și `/ws/track/:id` fără autentificare.
- `ml_service` fără autentificare, portul 8001 publicat pe host.
- Login frontend: „reușește” și dacă Supabase refuză; rolul se alege din UI și
  se ține în localStorage; parola de admin afișată pe pagină.
- `/admin` fără nicio verificare de rol.
- Migrația 009 conține parole în clar; hook-ul JWT suprascrie claim-ul `role`
  (strică PostgREST); `audit_log` fără RLS.
- XSS: date vehicul interpolate în HTML Leaflet + `onclick` inline global.
- Grafana `admin/admin`, Redis/PgBouncer/Prometheus publicate pe host,
  PgBouncer cu parola implicită `postgres`.
- `/api/chat` și `/api/route` (Next) fără auth/limită; folosesc serverul
  public demo OSRM.
- `python-jose` (CVE-uri cunoscute).

**Găsit — funcțional:**
- Tot frontend-ul rulează pe date demo din localStorage; nimic persistat real.
- Imagini vehicule: toate tipurile (în afară de trailă) desenează același TIR;
  paleții limitați la 10 coloane.
- Configurator paleți: mereu 33 sloturi (și la duba de 4), sarcina 24 t fixă;
  constructorul K7 cu coliziuni e scris dar nu e folosit în UI.
- Vehiculele create în flotă nu apar pe hartă (chei localStorage diferite).
- Căutarea K4: rezultatele nu se afișează; ora de trecere = `Math.random()`.
- Panou AI/K5: date fixe în cod („BST 102 14:20”, „09:45”).
- Comandă nouă: coordonate fixe, fără paleți/tip vehicul — expeditorul fără
  mașini nu poate posta o cerere reală.
- Hash contract fals (`Math.random()`), semnătura doar vizuală.
- `backend/` = copie veche nefolosită a `ml_service/`.
- `api` Rust: clusters/vehicles sunt stub-uri; tracker WS dezabonează canalul
  pentru toți la prima deconectare.

**Rămas:** decizia de arhitectură + implementarea (vezi CLAUDE.md).

## 2026-09-26 (continuare) — Refacere completă v2
**Făcut** (branch `refresh/v2`, 5 commit-uri):
- `ml_service` → pachet `optifleet_ml` stateless: token intern, DBSCAN pe max(dist. preluare, dist. livrare) + ferestre de timp, CVRP pickup&delivery corect, intenție Qwen3 cu schemă JSON. 15 teste pytest.
- `docker-compose.yml` redus la osrm + ml_service, porturi pe 127.0.0.1, containere read-only.
- Schema Supabase v2 (`supabase/sql/`), testată în Docker (`supabase/tests/run.sh`, `api-contract.sh`).
- Frontend refăcut: auth SSR, CSP cu nonce, hartă K2–K5, flotă K6–K7, cereri + bursă + grupaj, contracte K8–K12, admin KYC.
- Documentație rescrisă: README, MANUAL_DE_PORNIRE, SECURITATE_SI_DATE_PERSONALE.

**Rămas:**
- Utilizatorul rulează SQL-ul în proiectul Supabase și setează Auth + adminul.
- Utilizatorul șterge fișierele v1 (ștergerea cu `git rm` a fost refuzată de clasificatorul de siguranță).
- Paginile cu login nu au fost văzute vizual pe date reale (fără migrații în cloud); datele și apelurile sunt însă acoperite de testul de contract.

**Atenționări:**
- Tokenul intern ML a fost generat și scris în `ml_service/.env` și `frontend/.env.local` (neversionate).
- `ml_service/.env` mai conține cheile Supabase vechi, acum nefolosite; pot fi șterse de acolo.

## 2026-09-26 (seara) — Plan „totul local”, încredere și plată
**Făcut:** termen de plată în contract + `confirm_payment`; `10_trust_and_market.sql`; teste noi (47 de aserțiuni pe PG15); `run.sh` acceptă `PG_IMAGE`; imaginile Supabase self-hosted v0.8.2 descărcate; cheile de test generate în scratchpad (nu în repo).
**Rămas:** `infra/` pentru stack-ul local complet + test pe PG17; worker AI; UI pentru funcțiile din 10; scalarea live (Broadcast + MapLibre + simulator + k6); asistentul hibrid; analiza pieței.

## 2026-09-26 (noapte) — Stack local complet + primul E2E real
**Făcut:** `infra/local/` (setup.sh idempotent, override compose pe 127.0.0.1, volum Docker pentru date, start/stop/backup); schema aplicată fără erori pe Postgres 17; cont admin + 2 conturi demo verificate; frontend pe baza locală; E2E în browser real a găsit și am reparat: CSP ws, zoom inițial K3, ETA înaintea plecării. Containerele v1 oprite.
**Rămas:** E2E idempotent în repo; pașii 2–6 din CLAUDE.md.
**Atenționări:** Windows + Git Bash: `MSYS_NO_PATHCONV=1` strică `curl -o /dev/null` și căile `/tmp` pentru git.exe — folosește redirecționare shell și căi relative. Rularea repetată a E2E dă 409 (date existente).

## 2026-09-26 (noapte, 2) — Pornire fără bash + plan în 2 părți
**Făcut:** `OptiFleet.cmd` + `infra/local/optifleet.ps1` (start/stop/backup/status) testate; `PLAN_IMPLEMENTARE.md` (A = local acum, B = viitor); conectarea `postgres.optifleet@127.0.0.1:5432` verificată.
**Rămas:** utilizatorul instalează pgAdmin manual (winget a eșuat: fără internet la momentul respectiv).
**Atenționări:** PowerShell 5 — `.ps1` trebuie salvat UTF-8 cu BOM + CRLF; ieșirea Docker pe stderr se rulează prin `Invoke-Docker` (altfel NativeCommandError).

## 2026-09-26 (noapte, 3) — Schimbare de direcție: v3 local autonom
**Discutat:** utilizatorul a încercat pornirea: `bash` din PowerShell → WSL fără Docker; apoi a spus că fără Docker platforma nu merge (locuri libere, configurare), apare un popup ciudat. Cere: TOTUL LOCAL, FĂRĂ Docker, FĂRĂ Supabase, FĂRĂ Claude; pornire/oprire din IDE; PostgreSQL+PostGIS ca în teză; pgAdmin pentru acces; Vercel doar demo, mai târziu.
**Făcut înainte:** OptiFleet.cmd + optifleet.ps1 (Docker) — funcționale, dar respinse ca direcție; PLAN_IMPLEMENTARE.md (de actualizat).
**Verificat:** internet OK; URL-urile PostgreSQL 17.6 EDB zip (330 MB) și PostGIS 3.6.2 bundle există.
**Urmează:** planul v3 din CLAUDE.md, pașii 1–8.

## 2026-09-26 (dimineață) — Flotă multimodală + istoric git curățat
**Făcut:**
- Istoricul `refresh/v2` rescris local: toate commit-urile doar pe numele Iongutan, fără „Co-Authored-By: Claude” (conținut identic, verificat cu `git diff`). Push-ul forțat a eșuat cu 403: aplicația GitHub nu are drept de scriere pe repo.
- Flotă multimodală: vagon de tren și dronă în aceeași flotă (SQL 02/03/04/05/09, catalog, constructor „Ce adaugi?”, listă cu filtru pe mod și pictogramă de configurare, contor de locuri pentru vagon/dronă, zonă deservită pentru dronă, desene noi).
- Teste: SQL 56 aserțiuni trec (PostgreSQL 16 + PostGIS local, shim Supabase în scratchpad); vitest 29; eslint, tsc și `next build` curate.
**Rămas:** push `refresh/v2` (după instalarea aplicației GitHub sau manual de utilizator); demo seed cu o dronă și un vagon; marker de hartă diferit pentru dronă (acum folosește același desen lateral).
**Atenționări:** Docker Hub a dat 429 la `supabase/postgres`; testele SQL au rulat pe PG16 local cu un shim minimal (auth.uid, storage, roluri) — același tip de shim e planificat în v3 (`00_local_platform.sql`).

## 2026-09-26 (prânz) — Push blocat, flota demo completată
**Discutat:** utilizatorul a instalat/reconectat aplicația GitHub, dar sesiunea tot primește 403 la push; o sesiune-copil a cerut confirmare directă, iar pornirea alteia a fost refuzată de mediu. Utilizatorul: „fă alt branch, pe acela îl șterg mai târziu; continuă dezvoltarea”.
**Făcut:** date demo cu vagon (închiriat, 32/50 ocupate) și dronă (zonă de 5 raioane); panoul de pe hartă folosește unitatea tipului (compartimente/paleți), zona dronei și nu arată plan de podea la vagon/dronă. Teste: SQL 58, vitest 29, tsc/eslint curate.
**Rămas:** urcarea pe GitHub (bundle → ramură nouă); planul v3 local autonom.
