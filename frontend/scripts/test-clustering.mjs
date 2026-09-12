/**
 * Automated Snapshot Test for Multi-Level Visual Clustering (Prompt K3)
 * Tests behavior at:
 *  - Zoom 7 (< 8): Macro-regional clusters
 *  - Zoom 9 (8-10): District-level clusters
 *  - Zoom 12 (> 10): Individual vehicle markers
 */

import { computeClusterView, MACRO_REGIONS, createSuperclusterIndex } from "../src/lib/clustering.ts";

const mockTrucks = [
  { id: "trk-01", plate: "CAN 001", currentRaion: "chisinau", lat: 47.02, lon: 28.85, freePallets: 12, totalPallets: 33 },
  { id: "trk-02", plate: "CAN 002", currentRaion: "chisinau", lat: 47.01, lon: 28.86, freePallets: 5, totalPallets: 33 },
  { id: "trk-03", plate: "ORH 101", currentRaion: "orhei", lat: 47.38, lon: 28.82, freePallets: 8, totalPallets: 33 },
  { id: "trk-04", plate: "RZN 201", currentRaion: "rezina", lat: 47.74, lon: 28.96, freePallets: 15, totalPallets: 33 },
  { id: "trk-05", plate: "BLT 301", currentRaion: "balti", lat: 47.76, lon: 27.92, freePallets: 20, totalPallets: 33 },
  { id: "trk-06", plate: "SRC 401", currentRaion: "soroca", lat: 48.15, lon: 28.29, freePallets: 4, totalPallets: 33 },
  { id: "trk-07", plate: "CHL 501", currentRaion: "cahul", lat: 45.90, lon: 28.19, freePallets: 10, totalPallets: 33 },
  { id: "trk-08", plate: "CMR 601", currentRaion: "comrat", lat: 46.30, lon: 28.65, freePallets: 6, totalPallets: 33 },
];

console.log("=== TEST SNAPSHOT: Prompt K3 Visual Clustering ===");

// 1. Test Zoom Mic (< 8)
const zoomLow = 7;
const viewLow = computeClusterView(mockTrucks, zoomLow);
console.log(`\n[Zoom ${zoomLow}] Nivel detectat: ${viewLow.level}`);
if (viewLow.level !== "REGIONAL") throw new Error("Așteptat REGIONAL la zoom < 8");
console.log("Snapshot Agregare Macro-Regiuni:");
viewLow.regionalClusters.forEach((reg) => {
  console.log(`  - ${reg.name} (${reg.id}): ${reg.totalTrucks} camioane, ${reg.freePallets} paleți liberi`);
});

const totalRegionalTrucks = viewLow.regionalClusters.reduce((s, r) => s + r.totalTrucks, 0);
if (totalRegionalTrucks !== mockTrucks.length) {
  throw new Error(`Total camioane regional (${totalRegionalTrucks}) diferă de total flotă (${mockTrucks.length})`);
}
console.log(`  ✔ Validare: ${totalRegionalTrucks}/${mockTrucks.length} camioane agregate corect.`);

// 2. Test Zoom Mediu (8 - 10)
const zoomMid = 9;
const viewMid = computeClusterView(mockTrucks, zoomMid);
console.log(`\n[Zoom ${zoomMid}] Nivel detectat: ${viewMid.level}`);
if (viewMid.level !== "DISTRICT") throw new Error("Așteptat DISTRICT la zoom 8-10");
console.log("Snapshot Agregare Raioane:");
Object.entries(viewMid.districtCounts).forEach(([dId, dData]) => {
  console.log(`  - Raion [${dId}]: ${dData.count} camioane`);
});
if (viewMid.districtCounts["chisinau"].count !== 2) {
  throw new Error("Chișinău ar trebui să aibă 2 camioane");
}
if (viewMid.districtCounts["balti"].count !== 1) {
  throw new Error("Bălți ar trebui să aibă 1 camion");
}
console.log("  ✔ Validare: Numerele pe raioane sunt exacte, fără salturi.");

// 3. Test Zoom Mare (> 10)
const zoomHigh = 12;
const viewHigh = computeClusterView(mockTrucks, zoomHigh);
console.log(`\n[Zoom ${zoomHigh}] Nivel detectat: ${viewHigh.level}`);
if (viewHigh.level !== "VEHICLE") throw new Error("Așteptat VEHICLE la zoom > 10");
console.log(`Snapshot Markeri Individuali: ${viewHigh.vehicleList.length} vehicule redate ca markeri individuali.`);
if (viewHigh.vehicleList.length !== mockTrucks.length) {
  throw new Error("Număr incorect de markeri individuali");
}
console.log("  ✔ Validare: Toate mașinile sunt redate individual.");

// 4. Test Supercluster Index
const scIndex = createSuperclusterIndex(mockTrucks);
const clusters = scIndex.getClusters([26.5, 45.5, 30.0, 48.5], 7);
console.log(`\n[Supercluster API] Generat ${clusters.length} clustere native GeoJSON la zoom 7.`);

console.log("\n>>> TOATE TESTELE DE CLUSTERING K3 AU TRECUT CU SUCCES! <<<\n");
