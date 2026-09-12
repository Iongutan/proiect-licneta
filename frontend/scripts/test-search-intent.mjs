/**
 * Automated Test for Prompt K4:
 * 1. Intent Parser ("Chișinău Rezina cu tranzit", "am 3 paleți la Bălți")
 * 2. Transit route matching: returns direct AND transit vehicles
 * 3. Strict capacity filtering: freePallets > requestedQuantity (excludes <= requested)
 */

import { parseSearchIntent, matchTruckRoutes } from "../src/lib/search-intent.ts";

console.log("=== TEST SUITE: Prompt K4 Search Engine & Transit Matching ===");

// 1. Test Intent Parsing
const q1 = "Chișinău - Rezina cu tranzit";
const intent1 = parseSearchIntent(q1);
console.log(`\nQuery: "${q1}"`);
console.log("Parsed intent:", intent1);

if (intent1.origin !== "chisinau") throw new Error("Origine greșită: așteptat chisinau, primit " + intent1.origin);
if (intent1.destination !== "rezina") throw new Error("Destinație greșită: așteptat rezina, primit " + intent1.destination);
if (intent1.withTransit !== true) throw new Error("Așteptat withTransit === true");
console.log("  ✔ Test 1 passed: Intent extras corect (Chișinău -> Rezina, withTransit=true)");

const q2 = "am 3 paleți la Bălți";
const intent2 = parseSearchIntent(q2);
console.log(`\nQuery: "${q2}"`);
console.log("Parsed intent:", intent2);

if (intent2.requestedQuantity !== 3) throw new Error("Cantitate greșită: așteptat 3, primit " + intent2.requestedQuantity);
if (intent2.origin !== "balti") throw new Error("Origine greșită: așteptat balti, primit " + intent2.origin);
console.log("  ✔ Test 2 passed: Cantitate extrasă corect (3 paleți, Bălți)");

// 1b. Teste specifice pentru raioanele mici menționate de utilizator (Cantemir, Leova, Șoldănești)
const q3 = "Chișinău - Cantemir cu tranzit";
const intent3 = parseSearchIntent(q3);
if (intent3.origin !== "chisinau" || intent3.destination !== "cantemir" || !intent3.withTransit) {
  throw new Error("Eșec parsare rută Cantemir: " + JSON.stringify(intent3));
}
console.log("  ✔ Test 3 passed: Rută Cantemir identificată (Chișinău ➔ Cantemir, cu tranzit)");

const q4 = "Leova spre Chișinău";
const intent4 = parseSearchIntent(q4);
if (intent4.origin !== "leova" || intent4.destination !== "chisinau") {
  throw new Error("Eșec parsare rută Leova: " + JSON.stringify(intent4));
}
console.log("  ✔ Test 4 passed: Rută Leova identificată (Leova ➔ Chișinău)");

const q5 = "4 paleți la Șoldănești";
const intent5 = parseSearchIntent(q5);
if (intent5.origin !== "soldanesti" || intent5.requestedQuantity !== 4) {
  throw new Error("Eșec parsare cerere Șoldănești: " + JSON.stringify(intent5));
}
console.log("  ✔ Test 5 passed: Cerere Șoldănești extrasă corect (4 paleți, Șoldănești)");

// 2. Test Transit Matching & Strict Capacity Filter
const mockFleet = [
  // Camion direct Chișinău -> Rezina cu 12 paleți liberi (> 3)
  {
    id: "trk-direct-12",
    plate: "CAN 101",
    currentRaion: "chisinau",
    destinationRaion: "rezina",
    freePallets: 12,
    totalPallets: 33,
    lat: 47.02,
    lon: 28.85,
  },
  // Camion direct Chișinău -> Rezina cu exact 3 paleți liberi (TREBUIE EXCLUS la căutare de 3 paleți!)
  {
    id: "trk-direct-3",
    plate: "CAN 102",
    currentRaion: "chisinau",
    destinationRaion: "rezina",
    freePallets: 3,
    totalPallets: 33,
    lat: 47.02,
    lon: 28.85,
  },
  // Camion direct Chișinău -> Rezina cu doar 1 palet liber (TREBUIE EXCLUS)
  {
    id: "trk-direct-1",
    plate: "CAN 103",
    currentRaion: "chisinau",
    destinationRaion: "rezina",
    freePallets: 1,
    totalPallets: 33,
    lat: 47.02,
    lon: 28.85,
  },
  // Camion în tranzit: din Anenii Noi, care trece prin Chișinău și Rezina, cu 7 paleți liberi (> 3)
  {
    id: "trk-transit-7",
    plate: "ANN 701",
    currentRaion: "anenii_noi",
    destinationRaion: "balti",
    freePallets: 7,
    totalPallets: 33,
    lat: 46.88,
    lon: 29.22,
  },
  // Camion Orhei -> Rezina cu 5 paleți liberi (> 3)
  {
    id: "trk-transit-orhei",
    plate: "ORH 301",
    currentRaion: "orhei",
    destinationRaion: "rezina",
    freePallets: 5,
    totalPallets: 33,
    lat: 47.38,
    lon: 28.82,
  },
];

// Test A: Căutare "Chișinău Rezina cu tranzit" fără cantitate
const resultsA = matchTruckRoutes(mockFleet, intent1);
console.log("\nRezultate Căutare A ('Chișinău Rezina cu tranzit'):");
console.log(`  - Directe: ${resultsA.directMatches.length} camioane`);
console.log(`  - În Tranzit: ${resultsA.transitMatches.length} camioane`);

if (resultsA.directMatches.length === 0) throw new Error("Așteptat cel puțin un camion direct");
if (resultsA.transitMatches.length === 0) throw new Error("Așteptat cel puțin un camion în tranzit");
console.log("  ✔ Test A passed: Returnează atât vehicule directe cât și vehicule în tranzit!");

// Test B: Căutare "Chișinău Rezina cu tranzit" specificând 3 paleți
// Cerință strictă: "afișează DOAR vehiculele cu capacitate disponibilă STRICT MAI MARE decât cantitatea cerută, nu egală sau mai mică"
const intentWith3Pallets = {
  ...intent1,
  requestedQuantity: 3,
};
const resultsB = matchTruckRoutes(mockFleet, intentWith3Pallets);
console.log("\nRezultate Căutare B ('Chișinău Rezina cu tranzit' cu 3 paleți):");
console.log(`  - Directe admise (> 3 paleți): ${resultsB.directMatches.length}`);
console.log(`  - Tranzit admise (> 3 paleți): ${resultsB.transitMatches.length}`);
console.log(`  - Respinse din cauza capacității (<= 3 paleți): ${resultsB.rejectedByCapacity.length}`);

// Verificare că niciun camion admis nu are freePallets <= 3
for (const m of resultsB.directMatches) {
  if (m.truck.freePallets <= 3) {
    throw new Error(`Camionul ${m.truck.plate} are ${m.truck.freePallets} paleți, dar trebuia > 3`);
  }
}
for (const m of resultsB.transitMatches) {
  if (m.truck.freePallets <= 3) {
    throw new Error(`Camionul ${m.truck.plate} are ${m.truck.freePallets} paleți, dar trebuia > 3`);
  }
}

// Verificare că trk-direct-3 (3 paleți) și trk-direct-1 (1 palet) au fost respinse
const rejectedIds = resultsB.rejectedByCapacity.map((t) => t.id);
if (!rejectedIds.includes("trk-direct-3") || !rejectedIds.includes("trk-direct-1")) {
  throw new Error("Camioanele cu capacitate <= 3 nu au fost respinse conform cerinței!");
}

console.log("  ✔ Test B passed: Filtrarea strictă pe capacitate (> 3 paleți) funcționează perfect!");

console.log("\n>>> TOATE TESTELE DE CĂUTARE ȘI TRANZIT K4 AU TRECUT CU SUCCES! <<<\n");
