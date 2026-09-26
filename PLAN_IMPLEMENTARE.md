# OptiFleet — plan de implementare

Două etape: **A. acum**, totul local pe laptop (teză + cererea de grant ODA), și **B. viitor**, după ce platforma are clienți.
Regula care rămâne în ambele: fără abonamente obligatorii, datele stau la noi, securitatea se verifică la fiecare pas prin teste.

---

## De ce rămâne Docker (și de ce nu te încurcă)

Baza de date este **PostgreSQL**, un program-server. În jurul ei rulează încă 10 programe gratuite (Supabase self-hosted): login, API, actualizări live, fișiere, panou de administrare. Docker Desktop le pornește pe toate deodată, izolate și la versiunea exactă.

**Fără Docker** s-ar putea instala doar PostgreSQL direct în Windows. Login-ul, API-ul, actualizările live și stocarea fișierelor ar trebui însă rescrise de mână, ceea ce înseamnă săptămâni de muncă și mai mult risc de securitate, pentru zero beneficiu. De aceea Docker rămâne, dar e ascuns în spatele unui singur buton.

**Ce trebuie să ții minte:** nimic. Dublu-clic pe `OptiFleet.cmd` și platforma pornește.

| Acțiune | Cum |
|---|---|
| Pornire | dublu-clic pe **`OptiFleet.cmd`** (pornește Docker, baza de date și aplicația, apoi deschide browserul) |
| Oprire | `OptiFleet.cmd stop` (datele rămân) |
| Backup | `OptiFleet.cmd backup` → `infra\local\backups\` (copiază periodic pe un disc extern) |
| Baza de date în browser | http://localhost:8000 (utilizator și parolă în `infra\local\.credentials`) |
| Baza de date într-o aplicație Windows | **pgAdmin 4** (gratuit, pgadmin.org), cu datele de mai jos |

**Conectarea din pgAdmin** (Register → Server):
- Host `127.0.0.1`, port `5432`, baza de date `postgres`;
- utilizator `postgres.optifleet`;
- parola: valoarea din `POSTGRES=` din `infra\local\.credentials` (textul dintre `postgres.optifleet:` și `@`).

Opțional, în Docker Desktop → Settings → General → „Start Docker Desktop when you sign in”, ca să pornească singur.

---

## A. ACUM — local, pentru teză și grantul ODA

### A.0 Gata ✅
- Baza de date locală (Postgres 17) cu securitate pe rânduri (RLS), testată automat: 47 de aserțiuni SQL și 45 de verificări de API.
- Aplicația web: hartă cu căutare în tranzit și ora de trecere, flotă cu desene pe tipuri de vehicule, plan de paleți la scară, cereri pentru expeditorii fără mașini, negociere, contract cu SHA-256 și cele două căi, dovadă foto la livrare, administrare KYC.
- Serviciul ML (grupaj DBSCAN, rute CVRP) și OSRM pentru trasee reale.
- Pornire, oprire și backup dintr-un singur fișier; testat în browser real, cu login.

### A.1 Test automat complet în browser (repetabil)
Parcursul expeditor → transportator → contract → livrare, rulat automat, cu capturi de ecran pentru teză.

### A.2 Harta live la scară mare
- Pozițiile GPS trimise pe „celule” de hartă (Realtime Broadcast): fiecare utilizator primește doar zona pe care o vede.
- Hartă desenată pe placa video (MapLibre GL) și fundal din fișier local (PMTiles Moldova), deci funcționează și fără internet la prezentare.
- Poziția curentă separată de istoric (istoric pe zile, curățat automat).
- **Simulator de camioane** pe drumuri reale (1.000 → 10.000 → 50.000) și **test de încărcare k6**, cu grafice pentru teză și dosar.
- *Tu:* `winget install k6`.

### A.3 Încredere și piață (baza de date e deja gata; rămâne interfața)
Recenzii după livrare, scorul firmei, prețul de referință pe coridor, alerte pentru drumul gol la întoarcere, documente ANTA/CMR la KYC, termen de plată.

### A.4 Analistul AI local (Qwen3, gratuit, pe placa ta video)
- Potriviri pentru drumul gol de întoarcere.
- Semnale anti-fraudă în negocieri (plată în afara platformei, ocolirea platformei).
- Expirarea licențelor, plăți întârziate, raport zilnic pentru admin.
- Căutare „inteligentă” în date (embeddings `bge-m3`). *Tu:* `ollama pull bge-m3`.

### A.5 Asistentul hibrid pentru clienți
Claude (API) înțelege întrebarea → funcții fixe caută în baza ta → AI-ul local analizează → Claude formulează răspunsul.
- **Protecții:** datele de contact sunt anonimizate înainte de API, există un plafon lunar de cost, iar dacă API-ul nu e disponibil răspunde AI-ul local.
- *Tu:* cheia API Anthropic și alegerea modelului (singurul cost opțional, per mesaj).

### A.6 Verificarea telefonului firmei
Firma își confirmă numărul, gratuit, printr-un bot Telegram (contactul trimis de Telegram e verificat) sau prin apel de la admin. Șoferii nu au cont: au doar tokenul GPS al vehiculului.

### A.7 Documente pentru teză și ODA
Analiza pieței și a concurenților (Lardi-Trans, Trans.eu, Timocom, Uber Freight, lecția Convoy), cu surse; arhitectura; securitatea; rezultatele testelor de încărcare.

---

## B. VIITOR — după lansare

| Etapă | Ce | Când |
|---|---|---|
| B.1 Server dedicat | Ubuntu Server, 64 GB RAM, SSD NVMe + disc de backup, UPS; același `setup.sh` | primii clienți reali |
| B.2 Acces public sigur | domeniu + HTTPS (Caddy/Let's Encrypt sau Cloudflare Tunnel), firewall, SSH doar cu cheie, disc criptat | odată cu B.1 |
| B.3 Email | server SMTP pentru confirmări și notificări | odată cu B.1 |
| B.4 Aplicație pentru șofer | aplicație mobilă simplă: GPS + poză la livrare, fără cont (token) | după B.1 |
| B.5 AI mai puternic | GPU de 24 GB (32B local), apoi mai multe plăci / servere dacă volumul o cere | după impact pe piață |
| B.6 Disponibilitate | mutare în datacenter local, replică a bazei de date, backup în altă locație | când căderile devin costisitoare |
| B.7 Semnătură calificată | integrare MSign pentru contractele mari | la cererea clienților |
| B.8 Export UE | e-CMR, rute internaționale | după piața internă |
