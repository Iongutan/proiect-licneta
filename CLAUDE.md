# OptiFleet B2B — instrucțiuni permanente pentru Claude Code

Proiect de licență UTM (Ion Guțan, TI-233). Documentația de produs e în
`materiale/` — sursa principală pentru funcționalitate este
`materiale/viziune-si-prompturi-K-optifleet.md` (prompturile K1–K12), iar
pentru securitate `materiale/audit-securitate-scalare-optifleet.md` (J1–J10).

## Memoria proiectului

Memoria trăiește în acest fișier (starea curentă) și în `proiect-memorie/memory/`:

| Fișier | Conținut | Regulă |
|---|---|---|
| `CLAUDE.md` → „MEMORIE — stare curentă” | ce e gata, ce e în lucru, pașii următori | se **rescrie** complet |
| `proiect-memorie/memory/log.md` | jurnal sesiuni | **append-only**, nu se șterge nimic |
| `proiect-memorie/memory/decisions.md` | decizii de arhitectură | append |
| `proiect-memorie/memory/resurse.md` | pachete/librării evaluate | append |

La ÎNCEPUTUL fiecărei sesiuni:
1. Citește „MEMORIE — stare curentă” de mai jos și ultimele intrări din `log.md`.
2. Confirmă într-o propoziție de unde reiei (ex: „Am reluat de la X, urma Y”).

Pe parcursul lucrului:
- Înainte de a instala un pachet nou, verifică `resurse.md` — poate a fost deja evaluat sau respins.
- Pachet util găsit → adaugă-l în `resurse.md` (link + 1 linie + dată).
- Decizie de arhitectură → notează imediat în `decisions.md`.

ÎNAINTE de a încheia sesiunea (obligatoriu — un garant, nu opțional). Se
rulează și când utilizatorul scrie „salvează memoria” sau „schimb contul”:
1. Rescrie complet „MEMORIE — stare curentă” cu stadiul real.
2. Adaugă o intrare nouă în `log.md`: dată/oră, ce s-a făcut, ce a rămas, atenționări.
3. Confirmă explicit că fișierele au fost scrise — nu presupune.

Reguli generale:
- Limba de lucru: română; termeni tehnici în engleză unde e cazul.
- Niciun secret (parole, chei, JWT secret) în cod, migrații sau documentație.

---

# MEMORIE — stare curentă

_Ultima actualizare: 2026-09-26 (branch `refresh/v2`, ne-unit cu main)_

## ⚠️ Stare GitHub (de verificat la începutul sesiunii)
- Pe GitHub, `refresh/v2` e încă varianta VECHE (cap 2dc81f9, cu trailere „Co-Authored-By: Claude”).
- Local există istoricul curățat (doar Iongutan) + commit-urile de flotă multimodală. Sesiunile cloud primesc 403 la
  `git push` pe acest repo; utilizatorul urcă din `refresh-v2.bundle` pe o ramură NOUĂ (a cerut „alt branch”;
  `refresh/v2` o șterge el mai târziu). Dacă ramura nouă există, continuă pe ea.

## ⚠️ DECIZIA ACTUALĂ A UTILIZATORULUI (cea mai recentă, are prioritate)
**TOTUL ABSOLUT LOCAL, AUTONOM, FĂRĂ Docker, FĂRĂ Supabase, FĂRĂ Claude API.**
- Proiectul se pornește din IDE (F5 / `npm run dev`) → merge; se oprește → se oprește TOT (inclusiv baza de date).
- Fără ferestre/popup-uri străine (utilizatorul s-a plâns de o fereastră ciudată și că fără Docker nimic nu mergea:
  locurile libere nu se vedeau, nu se putea configura).
- Fidel tezei: PostgreSQL + PostGIS. Acces la date printr-o aplicație normală (pgAdmin).
- Vercel: doar eventual un demo de prezentare, mai târziu — NU prioritate.
- Stabil, sigur, optimizat, fără „încărcări” inutile.

## Planul v3 „local autonom” (în lucru)
1. **Runtime portabil:** `npm run setup` descarcă PostgreSQL 17.6 Windows zip (EDB, conține și pgAdmin, ~330 MB,
   URL verificat: get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip) + PostGIS bundle
   (download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17-3.6.2x64.zip) în `.runtime/` (gitignored);
   initdb în `.data/pg`, doar 127.0.0.1, parole aleatoare în `.data/credentials.json` (gitignored).
2. **Pornire/oprire:** script Node care pornește `postgres.exe` ca proces COPIL (nu pg_ctl detașat) + `next dev`;
   la oprirea din IDE se opresc amândouă.
3. **Shim SQL** (`00_local_platform.sql`): rolurile anon/authenticated, schema `auth` (users, sessions, uid()),
   schema `storage` (buckets, objects, foldername), publicația realtime → fișierele `supabase/sql/01–10` rămân
   aproape neschimbate (RLS, RPC, teste).
4. **Înlocuiri în Next.js:** auth propriu (parole scrypt din Node crypto — fără module native, pentru că Windows
   blochează binarele .node, vezi SWC; sesiuni în DB, cookie httpOnly); `/api/db` (client tip PostgREST: tabele/coloane
   validate din catalog, valori parametrizate, rulat ca `authenticated` cu `request.jwt.claim.sub` → RLS);
   `/api/rpc/[fn]` cu listă albă; fișiere pe disc cu verificare prin `storage.objects` + RLS; timp real prin
   SSE + LISTEN/NOTIFY (evenimentele trimit doar id-uri; clientul reîncarcă prin RLS).
5. Grupaj DBSCAN portat în TypeScript (fără Python). OSRM/ML/Ollama = opționale, nu obligatorii.
6. `devIndicators: false` în next.config (fără popup de dezvoltare).
7. Teste: SQL pe runtime-ul portabil (fără Docker), apoi E2E în browser.
8. De curățat după: `infra/local` (Docker), dependențele `@supabase/*`, `docker-compose.yml`, `ml_service` devine opțional.

## Ce s-a făcut până acum (istoric scurt)
- **Flotă multimodală (o singură flotă a SRL-ului, o singură interfață):** tipuri noi `RAIL_WAGON` (vagon de tren,
  propriu/închiriat) și `DRONE` (deservește o zonă de raioane) în același tabel `vehicles`, cu `transport_mode` derivat,
  `ownership` (+ `ownership_until`), `service_district_ids`; limite pe tip în `vehicles_limits_by_type`.
  Constructorul pornește cu „Ce adaugi?” (scrii „vagon de tren” → tipul potrivit); vagonul și drona declară locurile
  ocupate ca număr (`set_vehicle_occupancy`), camioanele păstrează planul K7; `search_trips` întoarce `IN_AREA` pentru drone.
  Catalogul unic: `frontend/src/lib/vehicle-catalog.ts` — un tip nou = o intrare acolo + desen + valoare în CHECK-urile SQL.
  Date demo: vagon închiriat `31 53 2458 017-2` (Ungheni, 18 libere din 50) și dronă `MDA-UAS-0042` (TransMold, zona Chișinău).
- v2: Next.js 16 + schema SQL v2 (RLS, RPC, K1–K12, încredere/piață în 10_trust_and_market.sql), desene vehicule,
  plan paleți K7, căutare cu tranzit K4, contracte K9 cu SHA-256, dovadă foto K11. Teste: vitest 20, SQL 47, contract API 45.
- Varianta Supabase self-hosted în Docker (`infra/local`, `OptiFleet.cmd`) funcționează, DAR utilizatorul NU o vrea
  (Docker = dependență). Stack-ul Docker local încă există pe PC; containerele v1 vechi sunt oprite.
- `PLAN_IMPLEMENTARE.md` (A acum / B viitor) — trebuie actualizat pentru v3 (fără Docker/Supabase/Claude).

## Decizii de produs confirmate (rămân valabile)
- Șoferii NU au cont; doar firma. Verificare telefon la nivel de firmă (idee gratuită: bot Telegram / apel admin).
- AI hibrid cu Claude = amânat/opțional (utilizatorul acum nu vrea Claude). AI local Qwen3 (Ollama) = opțional.
- Scalare viitoare: Broadcast pe celule, MapLibre GL, PMTiles local, istoric GPS partiționat, simulator + k6.
- Server dedicat / datacenter / GPU-uri multiple = etapa B (viitor).

## Note importante / capcane cunoscute
- Git: commit-urile se fac doar pe numele utilizatorului (Iongutan <ion.gutan@isa.utm.md>), fără rânduri
  „Co-Authored-By”/„Claude-Session” în mesaje (cerință explicită).
- Pe acest PC: Turbopack nu pornește (binar SWC nativ refuzat de Windows) → `--webpack`; evită module native .node.
- `bash` din PowerShell pornește WSL (fără Docker) — scripturile pentru utilizator trebuie să fie Node sau .cmd/.ps1.
- PowerShell 5: `.ps1` în UTF-8 cu BOM + CRLF; Git Bash: `MSYS_NO_PATHCONV` strică `curl -o /dev/null` și /tmp pentru git.exe.
- Rolul aplicației NU stă în claim-ul JWT `role`; se citește din `profiles` / `platform_admins`.
- IDNO: se validează doar formatul (13 cifre); algoritmul de control nu e confirmat.
- Tokenuri ML generate în `ml_service/.env` și `frontend/.env.local` (neversionate).
- Repo-ul e pe GitHub (`Iongutan/proiect-licneta`); parolele v1 au fost în istoric → nu le refolosi.
