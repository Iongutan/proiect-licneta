import { describe, expect, it } from "vitest";
import { parseSearchIntent } from "../search-intent";

describe("K4 — parser de intenție", () => {
  it("„Chișinău - Rezina, cu tranzit”", () => {
    const i = parseSearchIntent("Chișinău - Rezina, cu tranzit");
    expect(i.origin?.id).toBe("chisinau");
    expect(i.destination?.id).toBe("rezina");
    expect(i.withTransit).toBe(true);
  });

  it("fără diacritice și cuvinte de legătură", () => {
    const i = parseSearchIntent("de la chisinau spre soldanesti");
    expect([i.origin?.id, i.destination?.id]).toEqual(["chisinau", "soldanesti"]);
    expect(i.withTransit).toBe(false);
  });

  it("„am 3 paleți la Bălți” = marfa e la Bălți, cere >3 locuri", () => {
    const i = parseSearchIntent("am 3 paleți la Bălți");
    expect(i.origin?.id).toBe("balti");
    expect(i.destination).toBeUndefined();
    expect(i.pallets).toBe(3);
  });

  it("destinația marcată cu „spre”, originea din rest", () => {
    const i = parseSearchIntent("5 paleti spre Cahul din Orhei frigorific");
    expect(i.origin?.id).toBe("orhei");
    expect(i.destination?.id).toBe("cahul");
    expect(i.pallets).toBe(5);
    expect(i.bodyType).toBe("REEFER");
  });

  it("nume din două cuvinte și alias", () => {
    const i = parseSearchIntent("Anenii Noi prin Chisinau spre Tiraspol");
    expect(i.origin?.id).toBe("anenii_noi");
    expect(i.destination?.id).toBe("stinga_nistrului");
    expect(i.withTransit).toBe(true);
  });

  it("un singur loc fără marcaj = destinație", () => {
    const i = parseSearchIntent("Soroca");
    expect(i.destination?.id).toBe("soroca");
    expect(i.origin).toBeUndefined();
  });

  it("text fără locuri", () => {
    const i = parseSearchIntent("ceva fără sens");
    expect(i.origin).toBeUndefined();
    expect(i.destination).toBeUndefined();
  });
});
