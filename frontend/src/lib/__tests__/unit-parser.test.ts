import { describe, expect, it } from "vitest";
import { parseUnitDescription } from "../unit-parser";

describe("asistentul flotei — descriere liberă → ciornă", () => {
  it("„am un frigider” → semiremorcă frigorifică, restul din catalog și din firmă", () => {
    const r = parseUnitDescription("am un frigider", "orhei")!;
    expect(r.draft.bodyType).toBe("REEFER");
    expect(r.draft.hasReefer).toBe(true);
    expect(r.draft.pallets).toBe(33);
    expect(r.draft.districtId).toBe("orhei");
    expect(r.understood.district).toBe(false);
  });

  it("extrage marcă, număr, paleți, tone, preț și raion", () => {
    const r = parseUnitDescription("Am un frigider Volvo FH 500, CAN 123, 30 de paleți, 22 t, 21 lei/km, e la Bălți", "chisinau")!;
    expect(r.draft).toMatchObject({
      bodyType: "REEFER", makeModel: "Volvo FH 500", plate: "CAN 123", pallets: 30, payloadKg: 22000, pricePerKm: "21", districtId: "balti",
    });
    expect(r.understood).toMatchObject({ plate: true, model: true, places: true, payload: true, price: true, district: true });
  });

  it("vagon de tren închiriat, cu număr UIC", () => {
    const r = parseUnitDescription("am închiriat un vagon de tren 31 53 2458 123-4 cu 40 locuri la Ungheni", null)!;
    expect(r.draft).toMatchObject({ bodyType: "RAIL_WAGON", ownership: "RENTED", plate: "31 53 2458 123-4", pallets: 40, districtId: "ungheni" });
  });

  it("dronă: raioanele menționate devin zona deservită", () => {
    const r = parseUnitDescription("drona DJI FlyCart pentru Ialoveni și Strășeni, 2 compartimente, 30 kg", "chisinau")!;
    expect(r.draft).toMatchObject({ bodyType: "DRONE", pallets: 2, payloadKg: 30, area: ["ialoveni", "straseni"] });
  });

  it("limitele tipului se respectă (drona nu primește 20 t)", () => {
    expect(parseUnitDescription("dronă de 20 t", null)!.draft.payloadKg).toBe(500);
  });

  it("text fără un tip recunoscut → nimic", () => {
    expect(parseUnitDescription("bună ziua", null)).toBeNull();
  });
});
