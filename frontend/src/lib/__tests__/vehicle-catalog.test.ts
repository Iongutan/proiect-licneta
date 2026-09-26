import { describe, expect, it } from "vitest";
import { geometricCapacity } from "../pallet-positioning";
import {
  BODY_SPECS, BODY_TYPES, capacityErrors, findBodyTypes, idPatternFor, normalizeUnitId,
} from "../vehicle-catalog";

describe("flota unică — căutarea tipului după text", () => {
  it("„vagon de tren” găsește vagonul, nu trenul rutier", () => {
    expect(findBodyTypes("vagon de tren")[0]).toBe("RAIL_WAGON");
    expect(findBodyTypes("Vagon")[0]).toBe("RAIL_WAGON");
  });

  it("găsește drona cu sau fără diacritice", () => {
    expect(findBodyTypes("dronă")[0]).toBe("DRONE");
    expect(findBodyTypes("drona")[0]).toBe("DRONE");
  });

  it("camioanele rămân accesibile", () => {
    expect(findBodyTypes("frigo")[0]).toBe("REEFER");
    expect(findBodyTypes("tir")[0]).toBe("CURTAINSIDE");
    expect(findBodyTypes("tren rutier")[0]).toBe("ROAD_TRAIN");
  });

  it("text gol = toate tipurile; text fără sens = niciunul", () => {
    expect(findBodyTypes("  ")).toEqual(BODY_TYPES);
    expect(findBodyTypes("submarin")).toEqual([]);
  });
});

describe("flota unică — limite pe tip (oglinda constraint-ului SQL)", () => {
  const dims = (t: keyof typeof BODY_SPECS) => {
    const s = BODY_SPECS[t];
    return { lengthCm: s.lengthCm, widthCm: s.widthCm, heightCm: s.heightCm, payloadKg: s.payloadKg, places: s.pallets };
  };

  it("valorile implicite ale fiecărui tip sunt valide", () => {
    for (const t of BODY_TYPES) {
      const max = BODY_SPECS[t].loadMode === "FLOOR" ? geometricCapacity({ bodyType: t, ...dims(t) }) : undefined;
      expect(capacityErrors(t, dims(t), max)).toEqual({});
    }
  });

  it("drona nu poate avea sarcina unui camion", () => {
    expect(capacityErrors("DRONE", { ...dims("DRONE"), payloadKg: 2000 }).payloadKg).toBeDefined();
  });

  it("vagonul acceptă 60 t, camionul nu", () => {
    expect(capacityErrors("RAIL_WAGON", { ...dims("RAIL_WAGON"), payloadKg: 60000 }).payloadKg).toBeUndefined();
    expect(capacityErrors("CURTAINSIDE", { ...dims("CURTAINSIDE"), payloadKg: 60000 }).payloadKg).toBeDefined();
  });

  it("identificator: nr. UIC de vagon e valid, dar nu ca număr auto", () => {
    const uic = normalizeUnitId("RAIL_WAGON", "31 53 2458 123-4");
    expect(uic).toBe("31 53 2458 123-4");
    expect(idPatternFor("RAIL_WAGON").test(uic)).toBe(true);
    expect(idPatternFor("CURTAINSIDE").test(uic)).toBe(false);
    expect(normalizeUnitId("VAN", "31 53 2458 123-4").length).toBeLessThanOrEqual(12);
  });

  it("drona deservește o zonă, vagonul declară locurile în bloc", () => {
    expect(BODY_SPECS.DRONE.needsArea).toBe(true);
    expect(BODY_SPECS.DRONE.loadMode).toBe("COUNT");
    expect(BODY_SPECS.RAIL_WAGON.loadMode).toBe("COUNT");
    expect(BODY_TYPES.filter((t) => BODY_SPECS[t].mode === "ROAD").every((t) => BODY_SPECS[t].loadMode !== "COUNT")).toBe(true);
  });
});
