/**
 * Automated Test for Prompt K7:
 * 1. Placement of two overlapping pallets is strictly rejected.
 * 2. Total payload weight is calculated correctly from the sum of placed pallets.
 * 3. Overweight warning triggers when sum exceeds maxPayloadKg.
 */

import {
  canPlacePallet,
  calculateTotalPayload,
  doPalletsOverlap,
} from "../src/lib/pallet-positioning.ts";

console.log("=== TEST SUITE: Prompt K7 Precision Pallet Positioning ===");

const dimensions = {
  lengthCm: 1360, // 13.6m
  widthCm: 245,   // 2.45m
  heightCm: 270,
  maxPayloadKg: 24000, // 24 tone
};

// 1. Plasăm primul palet la (x: 10, y: 10) de 120x80cm
const pallet1 = {
  id: "plt-1",
  palletNumber: 1,
  format: "EUR_120x80",
  x: 10,
  y: 10,
  width: 120,
  length: 80,
  weightKg: 750,
  status: "OCCUPIED",
};

const check1 = canPlacePallet([], pallet1, dimensions);
console.log("Plasare Palet 1 în remorcă goală:", check1);
if (!check1.allowed) throw new Error("Paletul 1 ar fi trebuit acceptat");
console.log("  ✔ Test 1 passed: Primul palet a fost plasat cu succes.");

// 2. Încercăm să plasăm un al doilea palet care se SUPRAPUNE peste primul:
// Palet 1 este de la x=10 la x=130, y=10 la y=90.
// Palet 2 la x=50, y=30 (suprapunere directă!)
const overlappingPallet = {
  id: "plt-2-conflict",
  palletNumber: 2,
  format: "EUR_120x80",
  x: 50,
  y: 30,
  width: 120,
  length: 80,
  weightKg: 650,
  status: "FREE",
};

const checkConflict = canPlacePallet([pallet1], overlappingPallet, dimensions);
console.log("Plasare Palet 2 (suprapus peste Palet 1):", checkConflict);
if (checkConflict.allowed) {
  throw new Error("EROARE: Paletul suprapus a fost ACCEPTAT, dar trebuia RESPINS!");
}
console.log("  ✔ Test 2 passed: Suprapunerea a fost respinsă conform cerinței (" + checkConflict.reason + ")");

// 3. Plasăm un al doilea palet ADIACENT, FĂRĂ suprapunere:
// x=10, y=95 (la 5cm distanță de primul)
const validAdjacentPallet = {
  id: "plt-2-valid",
  palletNumber: 2,
  format: "EUR_120x80",
  x: 10,
  y: 95,
  width: 120,
  length: 80,
  weightKg: 850,
  status: "OCCUPIED",
};

const checkAdjacent = canPlacePallet([pallet1], validAdjacentPallet, dimensions);
console.log("Plasare Palet 2 adiacent:", checkAdjacent);
if (!checkAdjacent.allowed) throw new Error("Paletul adiacent ar fi trebuit acceptat");
console.log("  ✔ Test 3 passed: Paletul adiacent valid a fost acceptat.");

// 4. Test Calcul Greutate Totală și Sarcina Maximă
const placedPallets = [pallet1, validAdjacentPallet];
const payloadCalc = calculateTotalPayload(placedPallets, dimensions.maxPayloadKg);
console.log("\nCalcul Sarcină Mărfuri:", payloadCalc);

const expectedSum = 750 + 850; // 1600 kg
if (payloadCalc.totalWeightKg !== expectedSum) {
  throw new Error(`Greutate incorectă: așteptat ${expectedSum} kg, calculat ${payloadCalc.totalWeightKg} kg`);
}
if (payloadCalc.isOverweight) {
  throw new Error("1600 kg nu trebuia să depășească 24000 kg");
}
console.log(`  ✔ Test 4 passed: Greutate totală exactă: ${payloadCalc.totalWeightKg} kg.`);

// 5. Test Depășire Sarcină Maximă (Overweight Warning)
const heavyPallets = [
  { ...pallet1, weightKg: 15000 },
  { ...validAdjacentPallet, weightKg: 10000 }, // Total = 25000 kg > 24000 kg
];
const overweightCalc = calculateTotalPayload(heavyPallets, dimensions.maxPayloadKg);
console.log("Calcul Sarcină Excesivă:", overweightCalc);
if (!overweightCalc.isOverweight) {
  throw new Error("Așteptat isOverweight === true pentru 25000 kg > 24000 kg");
}
console.log("  ✔ Test 5 passed: Avertizarea de supraîncărcare s-a declanșat corect!");

console.log("\n>>> TOATE TESTELE DE CONSTRUCTOR PALEȚI K7 AU TRECUT CU SUCCES! <<<\n");
