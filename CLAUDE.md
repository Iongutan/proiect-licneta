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
- Local (și în `refresh-v2.bundle` trimis utilizatorului) există istoricul curățat, doar Iongutan: 15 commit-uri peste
  main, ultimul 2672998 (paleți drag & drop + asistent). Sesiunile cloud primesc 403 la
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

## v3 „local autonom” — FUNCȚIONAL (pornire: F5 / `npm run dev`)
- `frontend/scripts/optifleet.mjs`: PostgreSQL ca proces-copil (Windows: descarcă EDB 17.6 + PostGIS în `.runtime/`;
  Linux/macOS: pachetul sistemului), `.data/pg` pe 127.0.0.1:5433, parole în `.data/credentials.json`, migrații
  urmărite în `platform.migrations` (fără 00_reset și fără 08 demo), apoi `next dev`; comenzi: dev/start/db/stop/
  status/admin/backup/reset/test-db.
- `db/platform/00_platform.sql` (roluri anon/authenticated/optifleet_app, auth.users+sessions, auth.uid(), storage,
  publicație) și `90_realtime.sql` (triggere pg_notify).
- Next.js: `lib/server/{db,auth,query,rpc,storage,realtime}.ts`, rute `/api/{auth/*,db,rpc/[fn],storage/[bucket],realtime}`;
  client `lib/db-browser.ts` / `lib/db-server.ts` cu aceeași formă from()/rpc()/channel()/storage (`lib/query-builder.ts`).
  `@supabase/*` eliminat; CSP connect-src doar 'self'; `devIndicators: false`.
- Verificat: SQL 58 aserțiuni (`npm run test:db`), vitest 38, tsc/eslint, E2E în browser (`npm run e2e`):
  înregistrare 3 firme, KYC de admin, vagon (38/50) + dronă, asistentul „am un frigider”, plan de paleți cu
  drag & drop salvat, cerere de locuri, notificare live.
- Netestat încă pe Windows real: descărcarea/dezarhivarea runtime-ului (`tar -xf` pe .zip) și oprirea la Stop din VS Code.
- De curățat: `infra/local` (Docker), `docker-compose.yml`, `OptiFleet.cmd` vechi, README (încă descrie Supabase).

## Cerințe noi ale utilizatorului
1. FĂCUT — Constructor de paleți: paletar EUR/Industrial/propriu tras cu drag & drop pe podea (`PalletPalette`,
   `pallet-drag.ts`), locuri libere punctate pe plan (`freeSlots` în pallet-positioning), legendă ocupate/rezervate/libere.
2. FĂCUT — Asistentul din „Flota mea” (`FleetAssistant`, `lib/unit-parser.ts`): „am un frigider Volvo, 30 de paleți,
   e la Bălți” → formular precompletat pe aceeași pagină (tip, nr., model, locuri, sarcină, preț, deținere, raion,
   zonă dronă); restul din catalog + datele firmei (raion sediu, tariful mediu al firmei pe același tip). Parser local.
3. De verificat UX — producătorii (expeditorii) își pun marfa ca cereri de transport (`/requests`).
4. FĂRĂ date demo: utilizatorul își introduce singur vehiculele.

## Ce s-a făcut până acum (istoric scurt)
- **Flotă multimodală (o singură flotă a SRL-ului, o singură interfață):** tipuri noi `RAIL_WAGON` (vagon de tren,
  propriu/închiriat) și `DRONE` (deservește o zonă de raioane) în același tabel `vehicles`, cu `transport_mode` derivat,
  `ownership` (+ `ownership_until`), `service_district_ids`; limite pe tip în `vehicles_limits_by_type`.
  Constructorul pornește cu „Ce adaugi?” (scrii „vagon de tren” → tipul potrivit); vagonul și drona declară locurile
  ocupate ca număr (`set_vehicle_occupancy`), camioanele păstrează planul K7; `search_trips` întoarce `IN_AREA` pentru drone.
  Catalogul unic: `frontend/src/lib/vehicle-catalog.ts` — un tip nou = o intrare acolo + desen + valoare în CHECK-urile SQL.
  `08_seed_demo.sql` conține și un vagon + o dronă, dar runner-ul local NU încarcă datele demo (doar `npm run test:db` le folosește).
- v2: Next.js 16 + schema SQL v2 (RLS, RPC, K1–K12, încredere/piață în 10_trust_and_market.sql), desene vehicule,
  plan paleți K7, căutare cu tranzit K4, contracte K9 cu SHA-256, dovadă foto K11. Teste: vitest 20, SQL 47, contract API 45.
- Varianta Supabase self-hosted în Docker (`infra/local`, `OptiFleet.cmd`) funcționează, DAR utilizatorul NU o vrea
  (Docker = dependență). Stack-ul Docker local încă există pe PC; containerele v1 vechi sunt oprite.
- `PLAN_IMPLEMENTARE.md` (A acum / B viitor) — trebuie actualizat pentru v3 (fără Docker/Supabase/Claude).

## Pașii următori
1. Verificarea UX a cererilor de marfă pentru producători (`/requests`) pe stack-ul local + un pas în E2E.
2. Curățare: `infra/local`, `docker-compose.yml`, `OptiFleet.cmd` vechi, README, `PLAN_IMPLEMENTARE.md` pentru v3.
3. Test pe Windows real (descărcarea runtime-ului, Stop din VS Code).
4. Când push-ul merge: ramura nouă `dezvoltare` din istoricul curățat.

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
