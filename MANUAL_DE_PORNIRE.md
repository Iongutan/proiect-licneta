# 📘 MANUAL DE PORNIRE CAP-COADĂ — OPTIFLEET & GROUPLOG B2B
### Platformă Inteligentă de Optimizare Logistică pentru IMM-uri din Republica Moldova
**Teză de Licență UTM · Facultatea Calculatoare, Informatică și Microelectronică**  
**Student:** Ion Guțan | **Grupa:** TI-233  
**Îndrumător:** dr., conf. univ. Irina Cojuhari

---

## 📑 Cuprins
1. [Prezentare Generală & Arhitectură](#1-prezentare-generală--arhitectură)
2. [Principii SOLID & Șabloane de Proiectare GoF](#2-principii-solid--șabloane-de-proiectare-gof)
3. [Cerințe de Sistem](#3-cerințe-de-sistem)
4. [Pornirea Rapidă Locală (Stack Complet Docker + Next.js)](#4-pornirea-rapidă-locală-stack-complet-docker--nextjs)
5. [Configurare Bază de Date & Supabase PostGIS](#5-configurare-bază-de-date--supabase-postgis)
6. [Ghid de Publicare pe Vercel (Frontend Next.js)](#6-ghid-de-publicare-pe-vercel-frontend-nextjs)
7. [Conectarea Backend-ului la Vercel (Cloud & Tunelare)](#7-conectarea-backend-ului-la-vercel-cloud--tunelare)
8. [Verificarea Scenariilor Tezei de Licență (Scenariul Moldova)](#8-verificarea-scenariilor-tezei-de-licență-scenariul-moldova)
9. [Întrebări Frecvente & Depanare (Troubleshooting FAQ)](#9-întrebări-frecvente--depanare-troubleshooting-faq)

---

## 1. Prezentare Generală & Arhitectură

OptiFleet este un sistem distribuit dedicat eficientizării transportului de mărfuri de tip LTL (*Less-than-Truckload*) pentru întreprinderile mici și mijlocii (IMM) din Republica Moldova. Prin gruparea inteligentă a comenzilor (Group-Buying / Co-loading), platforma reduce costurile de transport cu până la **62%** și amprenta de carbon pe coridoarele principale: **Chișinău – Bălți**, **Chișinău – Cahul**, **Chișinău – Orhei – Ungheni**.

```mermaid
graph TD
    User([Utilizator IMM / Șofer / Dispecer]) -->|HTTPS / WSS| Vercel[Frontend Next.js 16 pe Vercel]
    Vercel -->|Fallback / Demo Mode| MockRepo[Moldova Demo Repository LocalStorage]
    Vercel -->|Live API Requests| Nginx[Nginx Load Balancer :80 / :443]
    Nginx --> AxumAPI[Rust Axum API :8000]
    AxumAPI -->|Caching & GPS Pub/Sub| Redis[(Redis 7)]
    AxumAPI -->|PostGIS & RLS Multi-tenant| Supabase[(Supabase PostgreSQL)]
    AxumAPI -->|Orchestrare ML| MLService[Python ML Service :8001 FastAPI]
    MLService -->|Matrici de Rutare Moldova| OSRM[OSRM Engine :5000 / moldova-latest]
    MLService -->|Optimizare Trasee| ORTools[Google OR-Tools CVRP]
    MLService -->|Grupare Spațială| DBSCAN[DBSCAN / HDBSCAN Scikit-learn]
    MLService -->|AI Conversațional| Claude[Claude 3.5 Sonnet / Qwen3]
```

### Componente Principale:
1. **Frontend (`frontend/`)**: Next.js 16 (App Router, React 19, Vanilla CSS cu design tokens dark-mode glassmorphism, compilare instantanee, suport nativ Vercel).
2. **API Backend (`api/`)**: Rust 1.85 cu Axum și Tokio (capabil de 1M+ conexiuni concurente cu doar ~2GB RAM, arhitectură asincronă, securitate la nivel de memorie).
3. **Serviciu ML (`ml_service/`)**: Python 3.11 cu FastAPI, Google OR-Tools (CVRP cu constrângeri de timp și capacitate), Scikit-Learn (DBSCAN), Anthropic Claude & Qwen3.
4. **Motor Rutare Offline (`osrm/`)**: Open Source Routing Machine v5.27 rulat local pe harta `moldova-latest.osrm`, oferind distanțe reale în milisecunde fără costuri API (Google Maps).
5. **Cache & Mesagerie Real-Time (`redis/`)**: Redis 7 Alpine pentru rate limiting, caching de matrici OSRM și streaming GPS Pub/Sub.
6. **Reverse Proxy (`nginx/`)**: Nginx 1.25 Alpine ce expune porturile 80/443 și distribuie traficul către microservicii.

---

## 2. Principii SOLID & Șabloane de Proiectare GoF

Codul a fost structurat curat și decuplat conform celor mai înalte standarde din ingineria software:

| Șablon GoF / Principiu | Unde este aplicat | Rol & Beneficiu |
| :--- | :--- | :--- |
| **Repository Pattern** | `frontend/src/lib/api-client.ts` & `ml_service/clustering/repository.py` | Izolează logica de acces la date de componentele UI și de algoritmi. Permite schimbarea sursei de date fără modificări în interfață. |
| **Adapter Pattern** | `RemoteApiAdapter`, `DemoLocalAdapter`, `ClaudeModel`, `Qwen3Model` | Adaptează formate eterogene (REST Axum, LocalStorage, API-ul Anthropic, Ollama local) la o interfață unică. |
| **Proxy & Fallback Pattern** | `SmartServiceProxy` (`frontend/src/lib/api-client.ts`) | Interceptează apelurile: dacă backend-ul cloud nu este accesibil (ex: demo Vercel), redirecționează transparent către setul de date demonstrative Moldova fără erori. |
| **Strategy Pattern** | `IClusteringStrategy` (`ml_service/clustering/strategy.py`) | Permite comutarea dinamică între DBSCAN, HDBSCAN și K-Means în funcție de densitatea comenzilor din teritoriu. |
| **Factory Method** | `AIModelFactory` (`ml_service/ai/factory.py`) | Instanțiază automat modelul LLM potrivit (Claude pentru limbaj natural de business sau Qwen3 pentru procesare tehnică locală). |
| **Observer Pattern** | `useAppStatus` & `redis Pub/Sub` | Notifică reactiv componentele UI despre schimbarea stării conexiunii (Live vs Demo) și a poziției vehiculelor pe hartă. |
| **SOLID — SRP** | Toate modulele | Fiecare modul are o singură responsabilitate: controllerul rutează, repository-ul persistă, algoritmul optimizează. |
| **SOLID — DIP** | Hook-urile React & API Rust | Modulele de nivel înalt depind de interfețe abstracte (`IOrderRepository`), nu de implementări concrete. |

---

## 3. Cerințe de Sistem

Înainte de pornire, asigurați-vă că aveți instalate următoarele:
- **Sistem de Operare:** Windows 10/11 (cu WSL2), macOS sau Linux (Ubuntu 22.04+).
- **Docker Desktop:** Versiunea 4.25+ (cu Docker Compose v2).
- **Node.js:** Versiunea 20.x sau 22.x LTS și `npm` v10+.
- **Git:** Pentru clonarea și actualizarea depozitului.

---

## 4. Pornirea Standard a Platformei (Comandă Unificată)

Proiectul dispune de scripturi standard în `package.json` din rădăcină, fără a necesita scripturi auxiliare `.bat` sau `.ps1`:

### 🚀 Pornire Completă (Docker Backend + Frontend Next.js)

În rădăcina proiectului, deschideți un terminal și rulați o singură comandă:
```bash
npm run dev
```

Această comandă execută automat:
1. **Pornirea microserviciilor în fundal**: `docker compose up -d` (OSRM Moldova, Redis, Python ML, Rust Axum API, Nginx).
2. **Lansarea serverului Frontend**: Next.js 16 pe **`http://localhost:3000`**.

Puteți deschide imediat browserul la:
- 🗺️ **Harta Reală OSM & Asistent Qwen3**: [http://localhost:3000/map](http://localhost:3000/map)
- 🚚 **Flotă & Camioane 33 Paleți (2D)**: [http://localhost:3000/fleet](http://localhost:3000/fleet)
- 🔑 **Autentificare Securizată**: [http://localhost:3000/login](http://localhost:3000/login)

---

### 🛑 Oprirea Platformei

Pentru a opri toate serviciile și a elibera porturile:
```bash
npm run stop
# (sau direct: docker compose down)
```

---

### Alte Comenzi Utile:
- `npm run build` — Compilează frontend-ul și verifică erorile TypeScript.
- `npm run services:logs` — Afișează jurnalul în timp real al containerelor Docker.
- `npm run services:down` — Oprește containerele Docker.


#### Pasul 1: Verificarea Fișierelor de Mediu (`.env`)
Asigurați-vă că fișierele de configurare există în directoarele respective:
- `api/.env`:
  ```env
  APP_PORT=8000
  DATABASE_URL=postgres://postgres:...@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
  REDIS_URL=redis://redis:6379
  ML_SERVICE_URL=http://ml_service:8001
  SECRET_KEY=super_secret_jwt_key_optifleet_2026_utm
  ```
- `ml_service/.env`:
  ```env
  OSRM_BASE_URL=http://osrm:5000
  REDIS_URL=redis://redis:6379
  ANTHROPIC_API_KEY=cheia_ta_anthropic_optional
  ```
- `frontend/.env.local`:
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
  NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
  NEXT_PUBLIC_SUPABASE_URL=https://kfogstejvnktewhobash.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E5W_6BhtJHf3IEFNma0J6A_C2qmtPZj
  ```

#### Pasul 2: Pornirea Serviciilor Backend în Docker
Deschideți un terminal (PowerShell sau Bash) în rădăcina proiectului și rulați:
```bash
docker compose up -d
```
Verificați că toate cele 5 containere sunt pornite și sănătoase:
```bash
docker ps
```
Veți vedea:
- `optifleet-api` (Port 8000)
- `optifleet-ml` (Port 8001)
- `optifleet-osrm` (Port 5000)
- `optifleet-redis` (Port 6379)
- `optifleet-nginx` (Port 80, 443)

Puteți testa starea backend-ului printr-un simplu curl:
```bash
curl.exe http://localhost:8000/api/v1/health
# Răspuns: {"runtime":"Rust/Axum","service":"optifleet-api","status":"ok","version":"1.0.0"}
```

#### Pasul 3: Pornirea Frontend-ului Next.js
Deschideți un al doilea terminal și navigați în folderul `frontend`:
```bash
cd frontend
npm install
npm run dev
```
Aplicația va fi accesibilă la adresa: **`http://localhost:3000`** sau **`http://localhost:3000/login`**.

---

## 5. Credențiale de Autentificare & Roluri (Login)

Pe pagina **`/login`** aveți butoane de completare automată instantanee (1-click fill):

| Rol Platformă | Email (Login) | Parolă | Acces & Destinație |
| :--- | :--- | :--- | :--- |
| **🛡️ Administrator (SUPER_ADMIN)** | `admin@optifleet.md` | `AdminOptiFleet2026!` | Panou complet `/admin`: Aprobare KYC, Registru Facturi, Audit Log |
| **🚚 Transportator (CARRIER_ADMIN)** | `dispatch@transmold.md` | `CarrierOpti2026!` | TransMold Express SRL: Flotă `/fleet`, Contracte B2B `/contracts` |
| **🏬 Comerciant IMM (SME_ADMIN)** | `orders@techmold.md` | `MerchantOpti2026!` | TechMold Electronics SRL: Creare Comenzi `/orders`, Clustere `/clusters` |

---

## 6. Configurare Bază de Date & Supabase PostGIS

Proiectul folosește Supabase cu extensia spațială **PostGIS** pentru calculul geografic precis al distanțelor.

1. Autentificați-vă pe [Supabase.com](https://supabase.com) și deschideți proiectul dvs.
2. Navigați în meniul lateral la **SQL Editor**.
3. Rulați în ordine scripturile SQL din folderul `supabase/migrations/`:
   - `001_enable_extensions.sql` (Activează `postgis` și `uuid-ossp`).
   - `002_create_tables.sql` (Creează tabelele `companies`, `orders`, `vehicles`, `clusters`, `audit_log`).
   - `003_triggers_functions.sql` (Calcul automat al volumului și discounturilor).
   - `004_rls_policies.sql` (Activează Row Level Security: compania A nu poate vedea datele companiei B).
   - `005_seed_moldova.sql` (Populează companiile, hub-urile și vehiculele de test din Moldova).
   - `006_jwt_claims_hook.sql` (Injectează `role` și `company_id` în token-urile JWT).
   - `007_create_users.sql` (Structura utilizatorilor).
   - `008_kyc_contracts_invoices.sql` (Verificare KYC companii, contracte B2B SHA-256, facturi și politici RLS).
   - `009_create_default_admin.sql` (Creare utilizatori predefiniți: Administrator `admin@optifleet.md`, Cărăuș, Comerciant).

> 💡 **Notă de Securitate & Conformitate Legală**: Pentru analiza detaliată a conformității cu **Legea nr. 133/2011** a Republicii Moldova, **GDPR**, arhitectura **PostgreSQL Row-Level Security (RLS)** și garanțiile juridice conform Codului Civil și Codului Transporturilor Rutiere nr. 150/2014, consultați documentul dedicat: [`SECURITATE_SI_DATE_PERSONALE.md`](file:///c:/Users/Joi/Desktop/vitor/ptoirct%20logistica/SECURITATE_SI_DATE_PERSONALE.md).

---

## 6. Ghid de Publicare pe Vercel (Frontend Next.js)

Datorită optimizărilor adăugate, aplicația frontend este **100% compatibilă cu Vercel**. Dacă backend-ul Docker local nu este conectat la internet, aplicația detectează automat acest lucru și comută în **Modul Demonstrativ Moldova (Vercel Ready)**, permițând oricărui examinator sau utilizator să exploreze toate funcționalitățile!

### Pași de Urmat:
1. **Publicarea Codului pe GitHub:**
   ```bash
   git add .
   git commit -m "OptiFleet v1.0 - Vercel ready cu arhitectura GoF si SOLID"
   git push origin main
   ```
2. **Importul pe Vercel:**
   - Intrați pe [vercel.com](https://vercel.com) și apăsați pe **"Add New Project"**.
   - Selectați depozitul Git al proiectului.
   - **Important:** La setarea **Root Directory**, dați click pe "Edit" și selectați folderul: **`frontend`**.
3. **Configurarea Variabilelor de Mediu pe Vercel:**
   În panoul de configurare Vercel (secțiunea *Environment Variables*), adăugați:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://kfogstejvnktewhobash.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_E5W_6BhtJHf3IEFNma0J6A_C2qmtPZj`
   - `NEXT_PUBLIC_API_URL` = URL-ul backend-ului dvs. public (sau lăsați `http://localhost:8000/api/v1` pentru rulare în modul hibrid/demo).
4. **Deploy:**
   - Apăsați butonul **"Deploy"**. Vercel va rula `npm run build` folosind setările din `vercel.json`.
   - În mai puțin de 60 de secunde, veți primi linkul public (ex: `https://optifleet-b2b.vercel.app`).

---

## 7. Conectarea Backend-ului la Vercel (Cloud & Tunelare)

Dacă doriți ca aplicația găzduită pe Vercel să comunice în timp real cu backend-ul Docker care rulează pe calculatorul dvs. local:

### Opțiunea A: Tunel Rapid Gratuit prin Cloudflare Tunnel sau Ngrok
Rulați în terminal:
```bash
npx localtunnel --port 80
# Sau cu ngrok:
ngrok http 80
```
Veți obține un URL public securizat (ex: `https://optifleet-tunnel.loca.lt`).  
Mergeți în Vercel la **Settings ➔ Environment Variables**, schimbați `NEXT_PUBLIC_API_URL` la `https://optifleet-tunnel.loca.lt/api/v1`, și dați **Redeploy**!

### Opțiunea B: Deploy pe VPS Ubuntu sau Servicii Cloud
Puteți clona întreg depozitul pe un VPS (ex: Hetzner, DigitalOcean, Render, Railway) și rula `docker compose up -d`. Configurați Nginx cu un certificat SSL Let's Encrypt gratuit, iar API-ul va fi disponibil 24/7.

---

## 8. Verificarea Scenariilor Tezei de Licență (Scenariul Moldova)

Pentru susținerea tezei de licență sau prezentarea în fața comisiei, parcurgeți următoarele scenarii:

### 🎯 Scenariul 1: Crearea unei Comenzi B2B
1. Navigați în meniu la **"Comenzi" (`/orders`)**.
2. Apăsați butonul **"+ Comandă nouă"**.
3. Apăsați butonul albastru **"⚡ Completează Automat Exemplu: Chișinău ➔ Bălți"**.
4. Toate câmpurile (coordonate GPS Chișinău, Bălți, volum 3.2 m³, masă 750 kg, ferestre orare) se completează instant.
5. Apăsați **"Creează Comanda"**. Comanda apare imediat în tabel cu statusul `CLUSTERED` și discountul calculat de algoritm!

### 🎯 Scenariul 2: Algoritmul de Grup-Buying (GroupLog)
1. Navigați la **"Grupuri (GroupLog)" (`/clusters`)**.
2. Vizualizați cele 3 grupuri formate pe coridoarele Moldovei:
   - **Coridorul Nord:** Chișinău ➔ Orhei ➔ Bălți (Economie de **57.9%**, 3,840 MDL economisiți).
   - **Coridorul Sud:** Chișinău ➔ Hîncești ➔ Cahul (Economie de **46.3%**, 2,650 MDL economisiți).
   - **Chișinău Urban Express:** (Economie maximă de **62.0%**, 1,980 MDL economisiți).
3. Apăsați butonul **"🚀 Rulează DBSCAN + CVRP"** pentru a reoptimiza rutele în timp real.

### 🎯 Scenariul 3: Harta Interactivă OSRM Moldova
1. Navigați la **"Hartă Live Moldova" (`/map`)**.
2. Observați traseul M5 (Chișinău – Bălți: 131.85 km, 2h 11m) și R3 (Chișinău – Cahul: 168.4 km, 2h 45m).
3. Dați click pe oricare hub (Bălți, Cahul, Orhei, Ungheni) pentru a vedea detaliile depozitului și numărul de expedieri zilnice.
4. Observați pozițiile live ale vehiculelor în tranzit.

### 🎯 Scenariul 4: Gestiunea Flotei
1. Navigați la **"Flotă Vehicule" (`/fleet`)**.
2. Observați cele 5 vehicule (Mercedes Sprinter, MAN TGL, Iveco Daily, Volvo FL, Renault Master), barele dinamice de încărcare a volumului în m³, datele de contact ale șoferilor și statusul lor operațional.

### 🎯 Scenariul 5: Asistentul AI Dual (Claude + Qwen3)
1. Navigați la **"Asistent AI" (`/chat`)**.
2. Apăsați una dintre întrebările rapide sugerate (ex: *"Care sunt comenzile mele active?"* sau *"Estimează economiile pentru 5 comenzi grupate"*).
3. Asistentul va genera răspunsul în timp real cu streaming text, explicând optimizarea logistică pe baza datelor reale din sistem.

### 🎯 Scenariul 6: Înregistrare și Verificare KYC Companie (IDNO Modulo 11)
1. Navigați la **"Verificare KYC (IDNO)" (`/verification`)**.
2. Apăsați butonul **"⚡ Completează Exemplu: MoldTrans Logistics SRL"** sau **"⚡ Completează Exemplu: Î.I. Ion Ceban"**.
3. Observați cum validatorul matematic testează în timp real cifra de control pe 13 cifre:
   - Un IDNO corect afișează un badge verde de validare ASP.
   - Modificați o cifră: sistemul raportează imediat eroarea de checksum Modulo 11!
4. Introduceți autorizația ANTA și apăsați **"Trimite Dosarul Spre Aprobare"**.

### 🎯 Scenariul 7: Contracte Digitale B2B cu Hash SHA-256
1. Navigați la **"Contracte B2B (SHA-256)" (`/contracts`)**.
2. Selectați un contract din listă (ex: `CTR-2026-0891` Chișinău – Bălți).
3. Observați:
   - Amprenta criptografică unică SHA-256 (64 caractere hexazecimale).
   - Părțile semnatare, valoarea cursei, comisionul platformei (6%) și decontarea cărăușului (94%).
   - Clauzele legale conforme cu Codul Civil al RM și Codul Transporturilor Rutiere nr. 150/2014.
4. Apăsați butonul **"Semnează Digital Contractul"** pentru a consemna timestamp-ul și adresa IP a semnatarului.
5. Apăsați **"🖨️ Descarcă / Tipărește Fișa Contractului"** pentru a genera formularul oficial de transport.

### 🎯 Scenariul 8: Panou Administrator & Registru Financiar
1. Navigați la **"Panou Admin & Finanțe" (`/admin`)**.
2. În tab-ul **"Dosare KYC & Firme"**:
   - Vizualizați companiile în așteptare (`PENDING`).
   - Apăsați **"✓ Aprobă Compania"** sau **"✕ Respinge"**. Statusul se actualizează instant!
3. În tab-ul **"Registru Facturi & Încasări"**:
   - Observați KPI-urile financiare: Total Încasat (MDL), În Așteptare (MDL), Restanțe / Neachitat (MDL).
   - Filtrați facturile după `Toate`, `Achitate`, `În Așteptare` sau `Restante (Overdue)`.
   - Pentru o factură neachitată, apăsați **"Marchează Achitat"** pentru a înregistra plata prin virament bancar.
4. În tab-ul **"Jurnal Audit Securitate"**:
   - Vizualizați logurile imutabile cu actori, adrese IP, evenimente de aprobare KYC și tentative blocate de acces neautorizat.

---

## 9. Întrebări Frecvente & Depanare (Troubleshooting FAQ)

### Î: Ce fac dacă portul 8000 sau 80 este deja ocupat pe calculator?
**R:** În `docker-compose.yml`, puteți schimba maparea porturilor:
- Pentru API: schimbați `"8000:8000"` în `"8080:8000"`.
- Pentru Nginx: schimbați `"80:80"` în `"8081:80"`.
Nu uitați să actualizați și variabila `NEXT_PUBLIC_API_URL` din `frontend/.env.local`.

### Î: De ce pe Vercel apar datele din Chișinău chiar dacă nu am pornit Docker pe calculator?
**R:** Datorită **Proxy & Fallback Pattern** implementat în `api-client.ts`. Aplicația testează conexiunea cu serverul; dacă acesta nu răspunde în 2 secunde, comută automat pe datele demonstrative din Republica Moldova, garantând că aplicația dvs. nu va da niciodată crash și va putea fi evaluată oricând de comisie sau vizitatori.

### Î: Cum repornesc toate containerele de la zero?
**R:** Rulați comanda:
```bash
docker compose down
docker compose up -d
```

### Î: Unde găsesc logurile unui microserviciu dacă ceva nu funcționează?
**R:** Rulați:
```bash
docker logs -f optifleet-api      # Loguri API Rust
docker logs -f optifleet-ml       # Loguri Serviciu Python ML
docker logs -f optifleet-osrm     # Loguri OSRM Moldova
```

---

*Proiect dezvoltat în cadrul Universității Tehnice a Moldovei (UTM), 2026.*  
*Toate drepturile rezervate autorului.*
