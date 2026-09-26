# OptiFleet — manual de pornire (v3, totul local)

Aplicația rulează în întregime pe calculatorul tău: **PostgreSQL + PostGIS** (baza de
date din teză) și **Next.js** (interfața și serverul). Fără Docker, fără Supabase,
fără servicii în cloud. Pornești aplicația → pornește și baza; o oprești → se opresc amândouă.

## Prima dată

Ai nevoie doar de **Node.js 22+** (https://nodejs.org) și de VS Code.

```bash
npm run setup
```

- instalează dependențele aplicației (`frontend/node_modules`);
- **Windows:** descarcă o singură dată PostgreSQL 17 (cu pgAdmin inclus) și PostGIS în
  `.runtime/` (~400 MB, nu intră în git);
- **Linux/macOS:** folosește PostgreSQL-ul sistemului (ex. `sudo apt install postgresql-16 postgresql-16-postgis-3`);
- creează baza în `.data/pg`, accesibilă doar de pe `127.0.0.1:5433`, cu parole aleatoare
  salvate în `.data/credentials.json` (nu intră în git).

## Zi de zi

| Ce vrei | Cum |
|---|---|
| Pornești tot | **F5** în VS Code, sau `npm run dev` |
| Oprești tot | **Stop** (Shift+F5) în VS Code, sau Ctrl+C în terminal |
| Deschizi aplicația | http://127.0.0.1:3000 |
| Te uiți în baza de date | pgAdmin → server nou: host `127.0.0.1`, port `5433`, baza `optifleet`, utilizator `postgres`, parola = `superPassword` din `.data/credentials.json` |
| Faci un cont administrator | te înregistrezi normal, apoi `npm run admin -- email@firma.md` |
| Copie de siguranță | `npm run backup` → `.data/backups/` |
| Baza a rămas pornită (ex. după o închidere forțată) | `npm run stop` |
| Ștergi tot și o iei de la zero | `npm run reset -- --yes` |

La fiecare pornire, schema se aplică automat din `db/platform/` și `supabase/sql/01–10`
(fișierele deja aplicate sunt sărite). Datele demo (`08_seed_demo.sql`) **nu** se încarcă:
fiecare firmă își adaugă singură flota și cererile.

## Teste

```bash
npm test          # teste unitare + typecheck + lint (frontend)
npm run test:db   # testele SQL (RLS, rezervări, contracte, flotă) pe o bază separată
npm run e2e       # flux complet în browser, cu aplicația pornită (npm run dev)
```

## Cum e construită (pe scurt)

- `frontend/scripts/optifleet.mjs` pornește `postgres` ca proces-copil, aplică migrațiile,
  apoi pornește Next.js; la oprire le închide pe amândouă.
- Next.js se conectează ca rolul `optifleet_app` și rulează fiecare cerere a unui
  utilizator ca rolul `authenticated`, cu id-ul lui → aceleași reguli RLS din
  `supabase/sql/04_rls_and_grants.sql` decid ce vede și ce poate modifica fiecare firmă.
- Conturi: parole cu scrypt, sesiuni în `auth.sessions`, cookie httpOnly.
- Fișiere (poze de la livrare, documente KYC): pe disc în `.data/storage/`, cu acces verificat prin RLS.
- Timp real (hartă, notificări, negociere): PostgreSQL `LISTEN/NOTIFY` → Server-Sent Events;
  fiecare utilizator primește doar rândurile pe care are voie să le vadă.
- Serviciile de rutare (OSRM) și grupaj (ml_service) sunt **opționale**: fără ele, traseele
  se estimează în linie dreaptă, iar restul platformei funcționează normal.
