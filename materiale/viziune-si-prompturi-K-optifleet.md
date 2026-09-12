# OptiFleet B2B — Viziune Completă de Produs + Prompturi de Implementare

## PARTEA A — Viziunea, așa cum am înțeles-o (confirmă dacă e corect)

### Principii generale, peste tot
- Cod strict, curat, arhitectură corectă peste tot — nu „merge, dar e murdar"
- Interfața nu trebuie să pară „făcută de AI" — fără iconițe generice puse
  peste tot, fără efecte inutile, fără aspectul tipic de „template AI" —
  design curat, minimalist, cu personalitate, ca făcut de un designer uman
- Atenție maximă la detalii peste tot — utilizatorul nu trebuie să
  ghicească niciodată ce se întâmplă

### 1. Cont și identitate
La creare de cont, utilizatorul poate scrie și denumirea firmei — aceasta
apare sub numele platformei (în header/branding), nu doar un nume de user
generic.

### 2. Ecranul principal (harta)
- Layout: doar o bară laterală (stânga) + o bară de căutare așezată
  frumos, vertical, în centru — nimic aglomerat
- La intrare, harta arată **numărul de mașini pe regiune**, agregat —
  exact ca zoom-ul pe Google Maps: la zoom mic, vezi un număr agregat per
  zonă (nu fiecare raion listat separat, aglomerat); pe măsură ce dai
  zoom, se despart în numere mai mici, pe raioane individuale (Rezina,
  Soroca, etc.)

### 3. Căutare inteligentă de curse
- Utilizatorul scrie „Chișinău - Rezina" → apar toate mașinile din regiune
  care merg spre Rezina, care TREC prin Rezina, cu locuri libere
- AI-ul propune activ și mașini „adiacente" — ex. o mașină din Anenii Noi
  care trece prin Chișinău — arată ora aproximativă de trecere, afișat în
  dreapta ecranului
- Utilizatorul poate scrie natural, cu cuvinte cheie simple — „Chișinău
  Rezina cu tranzit" — sistemul înțelege intenția (vrea și mașinile în
  tranzit, nu doar cele directe A→B) și caută automat pe hartă
- La căutare cu cantitate specificată („am 3 paleți la Bălți") — se
  filtrează automat, arată DOAR mașinile cu mai mult de 3 locuri libere
- AI proactiv, bazat pe locație: „pe lângă tine trece un camion cu 3
  paleți liberi" — sugestie, nu doar căutare pasivă

### 4. Detaliu mașină (click pe hartă)
Click pe o mașină deschide panou cu: dacă are comandă activă, ora la care
a fost acceptată, cât de ocupată e, cum a fost configurată (aranjamentul
de paleți)

### 5. Marketplace de paleți / configurare cerere
Dintr-un „constructor" de locuri, utilizatorul poate adăuga: greutate
aproximativă per palet, ce standard. Compania căreia îi aparține
vehiculul primește notificare — companiile iau legătura, negociază preț

### 6. Constructor de vehicul
Buton „+" mare, încercuit — pornește constructorul: marcă, tip, locuri
disponibile, GPS etc. La adăugarea paleților/locurilor ocupate — un
constructor de poziționare (standard european sau nu), foarte precis,
ușor de manevrat, cu atenție mare la detalii de amplasare

### 7. Mini-contract și negociere
După ce companiile se înțeleg, se creează un mini-contract:
- Compania de marfă are mereu acces la GPS
- Alegere: (a) semnătură electronică prin platformă, urmând un șablon
  companie-la-companie, SAU (b) acceptă direct între ele, fără mediere —
  în acest caz apare o fereastră clară: **platforma NU își asumă
  răspunderea** asupra mărfii dacă aleg varianta informală
- Confirmarea livrării: ambele părți (marfă + transport) trebuie să
  aprobe în cabinetul personal, dacă au ales varianta cu document semnat
- La finalizare, capacitatea vehiculului se actualizează automat, live

### 8. Verificare/dovadă de livrare
Poză la livrare, ca la Amazon — dovadă că marfa a ajuns conform
contractului. Preț configurabil pe km la nivelul vehiculului, dacă
compania preferă asta în loc de negociere per cursă. Platforma poate
genera automat profilul legal (SRL/Î.I., deja parțial construit prin
validatorul IDNO existent) — semnare electronică sau extragere PDF la
încărcarea mărfii, ca plasă de siguranță

---

## PARTEA B — Prompturi de implementare (K1-K12)

Aplică după seriile deja existente de corecții de securitate (J1-J10).
Multe componente de bază există deja în repo (TruckCargo2D.tsx,
VehicleBlueprintSVG.tsx, idno-validator.ts, kyc-data.ts) — prompturile de
mai jos construiesc peste ele, nu de la zero.

---

### PROMPT K1 — Sistem de design uman, nu „aspect de AI"

```
Construiește un sistem de design propriu, coerent, care evită explicit
aspectul generic de aplicație "generată de AI":

1. Definește un set restrâns de token-uri de design (culori, tipografie,
   spațiere) în tailwind.config - o singură paletă de accent, folosită
   consecvent, nu culori decorative fără scop.

2. Elimină iconițe generice folosite fără sens (ex. un checkmark verde
   lângă orice, un emoji-icon lângă orice titlu) - folosește iconițe
   DOAR unde clarifică o acțiune reală (ex. GPS, adăugare, ștergere),
   dintr-un singur set consistent (Lucide, deja disponibil în proiect).

3. Tipografie: alege un singur font, cu ierarhie clară de mărimi (titlu,
   subtitlu, text, text secundar) - nu mărimi aleatorii.

4. Elimină umbre/gradient-uri/efecte decorative fără scop funcțional -
   spațiu alb generos, contrast clar între ce e important și ce nu.

5. Fiecare pagină nouă construită mai jos trebuie să respecte acest
   sistem, nu stilul implicit al componentelor de bibliotecă (shadcn/ui
   are un aspect recognoscibil "AI app" dacă e folosit nemodificat -
   personalizează-l).

Explică la final ce decizii de design ai luat și de ce evită aspectul
generic.
```

---

### PROMPT K2 — Layout principal: sidebar + bară de căutare centrată

```
Construiește layout-ul paginii principale (harta):

1. Bară laterală stângă, minimalistă - navigare principală (Hartă,
   Comenzile mele, Flota mea, Contracte, Cont)

2. Bară de căutare centrată vertical pe ecran (nu sus, lipită de margine),
   cu aspect proeminent dar simplu - un singur câmp de input, gol la
   încărcare, cu placeholder discret ("Ex: Chișinău - Rezina, cu tranzit")

3. Sub numele platformei (header), afișează denumirea firmei salvată la
   crearea contului (dacă există), font mai mic, discret

Nu suprapune alte elemente pe hartă la încărcarea inițială - simplitate
maximă la primul ecran, restul apare doar după interacțiune (căutare).
```

---

### PROMPT K3 — Hartă cu agregare pe regiuni (clustering vizual, tip Google Maps)

```
Implementează clustering vizual al mașinilor pe hartă, folosind
biblioteca "supercluster" (standard pentru exact acest caz de utilizare -
folosită de Mapbox/Uber pentru clustering de puncte pe hartă), integrată
cu Mapbox GL JS deja prezent în proiect (RealMoldovaMap.tsx).

La zoom mic: arată un cerc cu numărul agregat de mașini per regiune (nu
liste de raioane separate). La zoom mediu: desparte în subgrupe pe
raioane individuale (Rezina, Soroca, Ungheni etc., fiecare cu propriul
număr). La zoom mare: arată fiecare mașină individual, ca marker pe
hartă.

Configurează pragurile de zoom (radius, maxZoom pentru clustering) astfel
încât tranziția să fie naturală, fără să pară că "sar" numere brusc.

Scrie un test vizual/snapshot care confirmă comportamentul la cele 3
niveluri de zoom.
```

---

### PROMPT K4 — Motor de căutare inteligentă cu potrivire de tranzit

```
Implementează căutarea de curse cu înțelegere de limbaj natural și
potrivire de traseu, NU doar căutare exactă A-to-B:

1. Intent Parser (folosind pipeline-ul AI existent, Qwen local pentru
   clasificare rapidă + Claude pentru cazuri ambigue): extrage din textul
   utilizatorului: origine, destinație, cantitate specificată (ex. "3
   paleți"), și dacă a cerut explicit "cu tranzit".

2. Algoritm de potrivire de traseu (Route Matching): pentru fiecare
   vehicul cu rută planificată (din OSRM, deja integrat), verifică dacă
   segmentul căutat (ex. Chișinău → Rezina) se suprapune sau e conținut
   în ruta vehiculului - nu doar dacă vehiculul merge EXACT între cele
   două puncte. Calculează și ora aproximativă de trecere prin punctul de
   interes, pe baza vitezei medii și distanței rămase din rută.

3. Filtrare pe capacitate: dacă utilizatorul specifică o cantitate (ex.
   "3 paleți"), afișează DOAR vehiculele cu capacitate disponibilă STRICT
   MAI MARE decât cantitatea cerută, nu egală sau mai mică.

4. Sugestii proactive bazate pe proximitate: dacă utilizatorul are o
   locație salvată (a firmei), rulează periodic o verificare în fundal -
   dacă apare un vehicul cu capacitate liberă compatibilă în apropiere,
   generează o notificare (reutilizează sistemul de notificări deja
   discutat pentru platforma anterioară, sau construiește unul similar
   aici dacă nu există deja).

Scrie teste pentru: o căutare "Chișinău Rezina cu tranzit" returnează
atât vehicule directe cât și vehicule în tranzit prin acel segment; o
căutare cu cantitate specificată exclude corect vehiculele cu capacitate
insuficientă.
```

---

### PROMPT K5 — Panou de detaliu vehicul (click pe hartă)

```
La click pe un marker de vehicul de pe hartă, deschide un panou lateral
(nu modal peste tot ecranul) cu:

- Status curent (disponibil / în cursă / ocupat)
- Dacă are comandă activă: ora la care a fost acceptată comanda
- Gradul de ocupare (procent + reprezentare vizuală simplă, ex. bară de
  progres cu paleți ocupați/disponibili)
- Configurația de încărcare curentă (reutilizează TruckCargo2D.tsx /
  VehicleBlueprintSVG.tsx deja existente în proiect pentru reprezentarea
  vizuală)

Actualizează acest panou live prin WebSocket dacă vehiculul selectat își
schimbă starea cât timp panoul e deschis.
```

---

### PROMPT K6 — Constructor de vehicul (buton „+" mare)

```
Adaugă un buton mare, circular, cu "+", vizibil clar în pagina "Flota mea"
(frontend/src/app/fleet/page.tsx, deja existentă).

La apăsare, deschide un flux de constructor (stepper, pas cu pas):
1. Marcă și model vehicul
2. Tip caroserie (prelată, frigorific, izotermă etc.)
3. Capacitate: locuri/paleți disponibili, dimensiuni interior (L x l x h),
   sarcină maximă
4. GPS: conectare dispozitiv GPS (introducere ID dispozitiv sau conectare
   prin API dacă transportatorul are deja un tracker instalat)

Validează fiecare pas înainte de a permite trecerea la următorul. La
final, vehiculul apare în lista flotei și, dacă are GPS activ, pe hartă.
```

---

### PROMPT K7 — Constructor vizual de poziționare paleți (precizie mare)

```
Extinde componentele existente TruckCargo2D.tsx și VehicleBlueprintSVG.tsx
într-un constructor complet interactiv de poziționare:

1. Reprezentare 2D de sus (bird's eye view) a interiorului vehiculului,
   la scară, pe baza dimensiunilor introduse la Prompt K6.

2. Utilizatorul poate trage și plasa paleți pe acest grid, cu dimensiuni
   standard predefinite (EUR-paletă 120x80cm, paletă industrială
   120x100cm) SAU dimensiuni custom introduse manual.

3. Fiecare palet plasat: câmp pentru greutate aproximativă, tip marfă
   (opțional), status (liber/ocupat/rezervat).

4. Validare vizuală: nu permite suprapunerea paleților, avertizează dacă
   greutatea totală depășește sarcina maximă a vehiculului.

5. La salvare, configurația se leagă de vehicul și devine vizibilă în
   panoul de detaliu (Prompt K5) și disponibilă pentru căutare (Prompt K4).

Folosește o bibliotecă de drag-and-drop pe canvas potrivită (react-dnd
sau direct manipulare SVG cu coordonate, dat fiind că VehicleBlueprintSVG
e deja SVG-based).

Scrie teste pentru: plasarea a doi paleți suprapuși e respinsă;
greutatea totală calculată corect din suma paleților plasați.
```

---

### PROMPT K8 — Notificare + negociere marketplace

```
Când un utilizator configurează o cerere de paleți (din constructorul de
căutare/marketplace) pentru un vehicul specific, trimite o notificare
reală (WebSocket + persistă în tabela notifications, dacă există deja
sau creeaz-o) către compania proprietară a vehiculului.

Deschide un fir de negociere simplu (mesagerie in-app, nu doar
notificare pasivă): cele două companii pot discuta preț și detalii,
direct în platformă, într-un thread legat de acea cerere specifică.

Scrie un test care confirmă: configurarea unei cereri de paleți pe un
vehicul generează notificare instant către compania proprietară, vizibilă
fără reîncărcare de pagină.
```

---

### PROMPT K9 — Mini-contract: două căi, cu răspundere clar delimitată

```
Implementează fluxul de finalizare a înțelegerii dintre companii, cu DOUĂ
căi explicite, prezentate clar utilizatorului ca alegere:

CALEA A - Contract prin platformă:
- Generează contract dintr-un șablon (companie-la-companie), populat
  automat cu datele KYC deja existente (kyc-data.ts, idno-validator.ts)
- Semnătură electronică (amprentă SHA-256 + JWT + timestamp, deja
  documentat în SECURITATE_SI_DATE_PERSONALE.md - implementează exact
  acel mecanism deja specificat)
- Compania de marfă păstrează acces GPS pe toată durata cursei
- Livrarea se consideră finalizată DOAR când AMBELE părți confirmă în
  cabinetul personal

CALEA B - Înțelegere directă, fără mediere:
- Înainte de a permite această opțiune, afișează OBLIGATORIU o fereastră
  de avertizare clară: "Platforma NU își asumă răspunderea pentru marfa
  transportată prin această înțelegere directă. Confirmă că înțelegi și
  accepți acest lucru." - necesită confirmare explicită (checkbox + buton),
  nu doar afișare pasivă.

Salvează în audit_log (dacă există deja din discuții anterioare, sau
creează tabela) care cale a fost aleasă, cu timestamp - important pentru
orice dispută ulterioară.

Scrie teste pentru: Calea B nu poate fi finalizată fără confirmarea
explicită a avertismentului; Calea A necesită confirmare din AMBELE părți
înainte de a marca livrarea completă.
```

---

### PROMPT K10 — Actualizare live a capacității vehiculului

```
Ori de câte ori se creează, modifică, sau finalizează o înțelegere
(Prompt K9), actualizează IMEDIAT, prin WebSocket, capacitatea rămasă a
vehiculului afectat - vizibil instant în: panoul de detaliu (K5),
rezultatele de căutare (K4), harta cu clustering (K3, dacă afectează
numărul agregat de "vehicule disponibile" în regiune).

Nu permite ca două înțelegeri simultane să suprasolicite același vehicul
(condiție de cursă) - folosește un lock/verificare atomică la nivel de
bază de date la confirmarea unei rezervări de capacitate.
```

---

### PROMPT K11 — Dovadă foto de livrare (stil Amazon)

```
La finalizarea unei curse, adaugă un pas obligatoriu de confirmare cu
fotografie:

1. Șoferul/transportatorul încarcă o poză a mărfii livrate, direct din
   aplicație (cameră telefon sau upload)
2. Poza se asociază cu contractul/comanda specifică, cu timestamp și
   locație GPS automată la momentul încărcării
3. Ambele părți (marfă + transport) pot vedea poza în cabinetul personal,
   ca dovadă a stării mărfii la livrare

Stochează pozele securizat (ex. Supabase Storage cu acces restricționat
per companie implicată, nu public), nu direct în baza de date ca text/blob.

Scrie un test care confirmă: o poză încărcată e vizibilă DOAR celor două
companii implicate în acea comandă specifică, nu altor utilizatori.
```

---

### PROMPT K12 — Generare automată profil legal + preț per km configurabil

```
Extinde profilul de vehicul (Prompt K6) cu un câmp opțional "preț per
kilometru" - dacă setat, poate fi folosit ca bază de negociere automată
în loc de negociere manuală per cursă (Prompt K8 poate propune automat un
preț estimat pe baza acestui câmp × distanța rutei).

Confirmă că profilul legal al companiei (SRL/Î.I., deja detectabil din
validarea IDNO existentă, idno-validator.ts) se completează automat în
contractul generat la Prompt K9, fără să ceară utilizatorului să
reintroducă aceleași date de fiecare dată.

Explică la final cum aceste date circulă: de la înregistrare (KYC) →
profil companie → completare automată contract, fără duplicare de
introducere manuală.
```

---

## Ordinea de aplicare recomandată

**Fundație vizuală:** K1 → K2 → K3
**Căutare și interacțiune:** K4 → K5
**Configurare flotă:** K6 → K7
**Marketplace și tranzacție:** K8 → K9 → K10 → K11 → K12

Aplică DUPĂ prompturile de securitate (J1-J10) deja date — o interfață
frumoasă peste o gaură de securitate critică (cheia JWT) tot rămâne
riscantă.
