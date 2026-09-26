// Asistentul din „Flota mea”: înțelege o descriere liberă a unei unități de
// transport („am un frigider Volvo cu 33 de paleți, 22 t, e la Bălți”) și
// produce o ciornă de formular. Rulează local, determinist, fără servicii
// externe; ce nu apare în text rămâne la valorile tipice ale tipului și la
// datele firmei (raionul sediului).

import type { BodyType, Ownership } from "./db-types";
import { normalizeText } from "./districts";
import { findPlaces } from "./search-intent";
import { BODY_SPECS, BODY_TYPES, normalizeUnitId } from "./vehicle-catalog";

export interface UnitDraft {
  bodyType: BodyType;
  plate: string;
  makeModel: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  payloadKg: number;
  pallets: number;
  hasReefer: boolean;
  pricePerKm: string;
  ownership: Ownership;
  districtId: string;
  area: string[];
}

/** Ce a înțeles asistentul din text (pentru a-i arăta utilizatorului). */
export interface Understood {
  type: boolean;
  plate: boolean;
  model: boolean;
  places: boolean;
  payload: boolean;
  price: boolean;
  ownership: boolean;
  district: boolean;
}

const BRANDS = [
  "mercedes-benz", "mercedes", "volvo", "scania", "man", "daf", "iveco", "renault", "ford", "volkswagen", "vw",
  "isuzu", "hyundai", "kamaz", "maz", "gaz", "fiat", "peugeot", "citroen", "opel", "schmitz", "krone", "kogel",
  "dji", "habbins",
];

/** Cel mai specific tip menționat: câștigă cuvântul-cheie cel mai lung găsit în text. */
function detectType(text: string): BodyType | null {
  let best: { type: BodyType; len: number } | null = null;
  for (const type of BODY_TYPES) {
    for (const kw of BODY_SPECS[type].keywords.map(normalizeText)) {
      if (new RegExp(`(^| )${kw}( |$)`).test(text) && (!best || kw.length > best.len)) best = { type, len: kw.length };
    }
  }
  return best?.type ?? null;
}

function detectModel(original: string): string | null {
  const words = original.replace(/[,.;:!?()]/g, " ").split(/\s+/).filter(Boolean);
  const i = words.findIndex((w) => BRANDS.includes(w.toLowerCase()));
  if (i < 0) return null;
  const out = [words[i]];
  // Modelul: până la două cuvinte după marcă, cât timp arată a model (litere/cifre, fără unități).
  for (const w of words.slice(i + 1, i + 3)) {
    if (!/^[A-Za-z0-9-]{1,12}$/.test(w) || /^(cu|de|si|și|la|in|în|e|are|pe|paleti|paleți|tone|t|kg|lei)$/i.test(w)) break;
    out.push(w);
  }
  const cap = (w: string) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1));
  return out.map((w, k) => (k === 0 ? cap(w) : w)).join(" ");
}

function detectPlate(original: string, type: BodyType, model: string | null): string | null {
  const up = original.toUpperCase();
  if (BODY_SPECS[type].mode === "RAIL") {
    const uic = up.match(/\b(\d{2}\s?\d{2}\s?\d{4}\s?\d{3}-?\d)\b/);
    if (uic) return normalizeUnitId(type, uic[1]);
  }
  // Numere MD: „CAN 001”, „C AB 123”, „ABC123”; serii de drone „UAS 0042”.
  // Se sare peste ce face parte din model („Volvo FH 500”) și peste unități.
  const inModel = model?.toUpperCase() ?? "";
  for (const m of up.matchAll(/\b([A-Z]{1,3}\s?[A-Z]{0,2}\s?\d{3,4})\b/g)) {
    if (/^(EUR|KG|MDL|LEI)\b/.test(m[1]) || inModel.includes(m[1])) continue;
    return normalizeUnitId(type, m[1]);
  }
  return null;
}

export function parseUnitDescription(input: string, homeDistrict: string | null): { draft: UnitDraft; understood: Understood } | null {
  const text = normalizeText(input);
  if (text.length < 3) return null;
  const type = detectType(text);
  if (!type) return null;
  const spec = BODY_SPECS[type];

  const places = text.match(/\b(\d{1,3})\s*(de\s+)?(europaleti|paleti|palet|locuri|loc|compartimente|compartiment|colete)\b/);
  const tons = text.match(/\b(\d{1,3}(?: \d)?)\s*(t|tone|tona)\b/);
  const kg = text.match(/\b(\d{1,5})\s*kg\b/);
  const price = text.match(/\b(\d{1,3}(?: \d{1,2})?)\s*(lei|mdl)\s*(pe|\/)?\s*km\b/);
  const ownership: Ownership | null = /\b(inchiriat\w*|chirie|arenda\w*)\b/.test(text) ? "RENTED"
    : /\bleasing\b/.test(text) ? "LEASED" : null;
  const hits = findPlaces(text).map((h) => h.district.id).filter((id, i, a) => a.indexOf(id) === i);
  const model = detectModel(input);
  const plate = detectPlate(input, type, model);

  const clamp = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v));
  const payloadKg = tons ? Math.round(Number(tons[1].replace(" ", ".")) * 1000) : kg ? Number(kg[1]) : spec.payloadKg;
  const draft: UnitDraft = {
    bodyType: type,
    plate: plate ?? "",
    makeModel: model ?? "",
    lengthCm: spec.lengthCm,
    widthCm: spec.widthCm,
    heightCm: spec.heightCm,
    payloadKg: clamp(payloadKg, spec.limits.payloadKg),
    pallets: places ? clamp(Number(places[1]), spec.limits.places) : spec.pallets,
    hasReefer: spec.reefer || /\b(frigo\w*|frigider|izoterm\w*|refrigera\w*)\b/.test(text),
    pricePerKm: price ? price[1].replace(" ", ".") : "",
    ownership: ownership ?? "OWNED",
    districtId: hits[0] ?? homeDistrict ?? "",
    area: spec.needsArea ? (hits.length ? hits : homeDistrict ? [homeDistrict] : []) : [],
  };
  return {
    draft,
    understood: {
      type: true, plate: Boolean(plate), model: Boolean(model), places: Boolean(places),
      payload: Boolean(tons || kg), price: Boolean(price), ownership: Boolean(ownership), district: hits.length > 0,
    },
  };
}
