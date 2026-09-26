import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregateByDistrict, aggregateByRegion, levelForZoom, vehiclePoints } from "../clustering";
import { DISTRICTS } from "../districts";

const v = (id: string, district: string, lat: number, lon: number, free = 5) =>
  ({ id, district_id: district, lat, lon, free_pallets: free });

const fleet = [
  v("a", "chisinau", 47.0105, 28.8638),
  v("b", "chisinau", 47.0106, 28.8639),
  v("c", "rezina", 47.7492, 28.9622, 2),
  v("d", "soroca", 48.1558, 28.2975),
  v("e", "cahul", 45.9075, 28.1944),
];

describe("K3 — agregare pe 3 niveluri", () => {
  it("pragurile de zoom", () => {
    expect([6, 7, 8, 10, 11, 14].map(levelForZoom)).toEqual(["REGION", "REGION", "DISTRICT", "DISTRICT", "VEHICLE", "VEHICLE"]);
  });

  it("zoom mic: un număr pe regiune", () => {
    const regions = Object.fromEntries(aggregateByRegion(fleet).map((b) => [b.key, b.vehicles]));
    expect(regions).toEqual({ CENTRU: 3, NORD: 1, SUD: 1 });
  });

  it("zoom mediu: separat pe raioane", () => {
    const d = Object.fromEntries(aggregateByDistrict(fleet).map((b) => [b.key, [b.vehicles, b.freePallets]]));
    expect(d).toEqual({ chisinau: [2, 10], rezina: [1, 2], soroca: [1, 5], cahul: [1, 5] });
  });

  it("zoom mare: vehiculele suprapuse se grupează, apoi se separă", () => {
    const bounds: [number, number, number, number] = [26, 45, 31, 49];
    const at11 = vehiclePoints(fleet, 11, bounds);
    expect(at11.filter((p) => p.kind === "stack")).toHaveLength(1);
    const at16 = vehiclePoints(fleet, 16, bounds);
    expect(at16.every((p) => p.kind === "vehicle")).toBe(true);
    expect(at16).toHaveLength(5);
  });
});

describe("raioane", () => {
  it("lista din frontend e identică cu seed-ul SQL", () => {
    const sql = readFileSync(join(__dirname, "../../../../supabase/sql/07_seed_districts.sql"), "utf8");
    const rows = [...sql.matchAll(/\('([a-z_]+)',\s*'([^']+)',\s*'[A-Z_]+',\s*'([A-Z]+)',\s*'SRID=4326;POINT\(([\d.]+) ([\d.]+)\)'\)/g)]
      .map(([, id, name, region, lon, lat]) => ({ id, name, region, lat: Number(lat), lon: Number(lon) }));
    expect(rows).toHaveLength(37);
    expect(DISTRICTS.map(({ id, name, region, lat, lon }) => ({ id, name, region, lat, lon }))).toEqual(rows);
  });
});
