import { describe, expect, it } from "vitest";
import {
  checkPlacement, findFreeSpot, freeSlots, geometricCapacity, layoutTotals, validateLayout,
  type Floor, type Pallet,
} from "../pallet-positioning";
import { BODY_SPECS, BODY_TYPES } from "../vehicle-catalog";

const TIR: Floor = { bodyType: "CURTAINSIDE", lengthCm: 1360, widthCm: 245, maxPayloadKg: 24000, palletCapacity: 33 };
const TRAIN: Floor = { bodyType: "ROAD_TRAIN", lengthCm: 1540, widthCm: 248, maxPayloadKg: 24000, palletCapacity: 36 };

const eur = (id: string, x: number, y: number, weightKg = 500): Pallet =>
  ({ id, x, y, length: 120, width: 80, format: "EUR", weightKg });

describe("K7 — plasare paleți", () => {
  it("respinge doi paleți suprapuși", () => {
    const res = checkPlacement([eur("a", 0, 0)], eur("b", 60, 40), TIR);
    expect(res).toEqual({ ok: false, reason: "Se suprapune cu alt palet." });
  });

  it("acceptă paleți lipiți (fără spațiu între ei)", () => {
    expect(checkPlacement([eur("a", 0, 0)], eur("b", 120, 0), TIR).ok).toBe(true);
    expect(checkPlacement([eur("a", 0, 0)], eur("b", 0, 80), TIR).ok).toBe(true);
  });

  it("respinge ieșirea din caroserie", () => {
    expect(checkPlacement([], eur("a", 1300, 0), TIR).ok).toBe(false);
    expect(checkPlacement([], eur("a", 0, 200), TIR).ok).toBe(false);
  });

  it("tren rutier: niciun palet peste cuplaj", () => {
    expect(checkPlacement([], eur("a", 700, 0), TRAIN).ok).toBe(false);
    expect(checkPlacement([], eur("a", 770, 0), TRAIN).ok).toBe(true);
  });

  it("greutatea totală = suma paleților; semnalează depășirea sarcinii", () => {
    const pallets = [eur("a", 0, 0, 900), eur("b", 120, 0, 1100)];
    expect(layoutTotals(pallets, TIR).totalWeightKg).toBe(2000);
    const heavy = { ...TIR, maxPayloadKg: 1500 };
    expect(layoutTotals(pallets, heavy).isOverweight).toBe(true);
    expect(validateLayout(pallets, heavy)).toMatch(/Sarcină depășită/);
  });

  it("capacitatea ține cont de paleții deja rezervați prin contract", () => {
    const pallets = Array.from({ length: 31 }, (_, k) => eur(`p${k}`, Math.floor(k / 3) * 120, (k % 3) * 80));
    expect(validateLayout(pallets, TIR, 2)).toBeNull();
    expect(validateLayout(pallets, TIR, 3)).toMatch(/Capacitate depășită/);
  });

  it("plasarea automată umple 33 de EUR pe un TIR fără suprapuneri", () => {
    const placed: Pallet[] = [];
    for (let k = 0; k < 33; k++) {
      const spot = findFreeSpot(placed, TIR, 120, 80);
      expect(spot).not.toBeNull();
      placed.push({ id: `p${k}`, ...spot!, format: "EUR", weightKg: 400 });
    }
    expect(validateLayout(placed, TIR)).toBeNull();
  });

  it("capacitatea implicită din catalog încape geometric", () => {
    for (const type of BODY_TYPES.filter((t) => BODY_SPECS[t].loadMode !== "COUNT")) {
      const s = BODY_SPECS[type];
      expect(s.pallets).toBeLessThanOrEqual(geometricCapacity({ bodyType: type, lengthCm: s.lengthCm, widthCm: s.widthCm }));
    }
  });
});

describe("locuri libere pe podea", () => {
  it("TIR gol: 33 de locuri EUR, fără suprapuneri", () => {
    const slots = freeSlots([], TIR, 120, 80, 33);
    expect(slots).toHaveLength(33);
    const asPallets = slots.map((s, i) => ({ id: String(i), ...s, format: "EUR" as const, weightKg: 1 }));
    expect(validateLayout(asPallets, TIR)).toBeNull();
  });

  it("se oprește la capacitatea rămasă, nu la ce încape geometric", () => {
    expect(freeSlots([eur("a", 0, 0), eur("b", 0, 80)], TIR, 120, 80, 5)).toHaveLength(5);
  });

  it("tren rutier: niciun loc liber peste cuplaj", () => {
    const cx = TRAIN.lengthCm / 2;
    for (const s of freeSlots([], TRAIN, 120, 80, 36)) expect(s.x < cx && s.x + s.length > cx).toBe(false);
  });
});
