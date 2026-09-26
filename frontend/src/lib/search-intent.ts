// K4 — parser determinist pentru căutarea de curse în limbaj natural.
// Exemple: „Chișinău - Rezina, cu tranzit”, „am 3 paleți la Bălți”,
// „de la Orhei spre Cahul 5 paleti frigorific”. Dacă parserul nu găsește
// origine/destinație, UI-ul poate cere interpretarea modelului local (Qwen3).

import type { BodyType } from "./db-types";
import { DISTRICTS, normalizeText, type District } from "./districts";

export interface SearchIntent {
  origin?: District;
  destination?: District;
  pallets?: number;
  withTransit: boolean;
  bodyType?: BodyType;
}

export interface PlaceHit {
  district: District;
  start: number;
  end: number;
}

// Toate formele (nume + alias), cele mai lungi primele: „anenii noi” înaintea „anenii”.
const PLACE_FORMS: Array<{ form: string; district: District }> = DISTRICTS.flatMap((d) =>
  [normalizeText(d.name), d.id.replace(/_/g, " "), ...(d.aliases ?? [])].map((form) => ({ form, district: d })),
).sort((a, b) => b.form.length - a.form.length);

const BODY_WORDS: Array<[RegExp, BodyType]> = [
  [/\b(frigo|frigorific\w*|refrigera\w*|izoterm\w*)\b/, "REEFER"],
  [/\b(duba|dubita|van|furgon\w*)\b/, "VAN"],
  [/\b(prelata|tir|semiremorca)\b/, "CURTAINSIDE"],
  [/\b(tren rutier|autotren|remorca)\b/, "ROAD_TRAIN"],
  [/\b(trail\w*|platforma joasa|utilaj\w*|agabaritic\w*)\b/, "LOWBED"],
  [/\b(rigid|camion solo)\b/, "RIGID"],
  [/\b(vagon\w*|cale ferata|feroviar\w*)\b/, "RAIL_WAGON"],
  [/\b(drona|drone|dron)\b/, "DRONE"],
];

/** Raioanele menționate într-un text normalizat (normalizeText), în ordinea apariției. */
export function findPlaces(text: string): PlaceHit[] {
  const hits: PlaceHit[] = [];
  const taken = new Array(text.length).fill(false);
  for (const { form, district } of PLACE_FORMS) {
    const re = new RegExp(`(^| )${form.replace(/ /g, " ")}(?= |$)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index + m[1].length;
      const end = start + form.length;
      if (taken.slice(start, end).some(Boolean)) continue;
      for (let i = start; i < end; i++) taken[i] = true;
      hits.push({ district, start, end });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function parseSearchIntent(query: string): SearchIntent {
  const text = normalizeText(query);
  const withTransit = /\b(tranzit|prin|in trecere|adiacent\w*|pe drum)\b/.test(text);

  const qty = text.match(/\b(\d{1,2})\s*(paleti|palet|paletii|europaleti|locuri|loc|pal)\b/);
  const pallets = qty ? Math.min(Number(qty[1]), 66) : undefined;

  const bodyType = BODY_WORDS.find(([re]) => re.test(text))?.[1];

  const places = findPlaces(text);
  const unique = places.filter((p, i) => places.findIndex((q) => q.district.id === p.district.id) === i);

  let origin: District | undefined;
  let destination: District | undefined;

  const marked = (hit: PlaceHit, words: string) =>
    new RegExp(`\\b(${words})\\s*$`).test(text.slice(Math.max(0, hit.start - 12), hit.start));

  // „am 3 paleți la Bălți” = marfa se află la Bălți → e punctul de preluare.
  const hasCargoAt = /^(am|avem|am nevoie|sunt)\b/.test(text);

  for (const hit of unique) {
    if (!origin && marked(hit, "de la|din|de")) origin = hit.district;
    else if (!origin && hasCargoAt && marked(hit, "la|in")) origin = hit.district;
    else if (!destination && marked(hit, "spre|la|pana la|catre|in|pentru")) destination = hit.district;
  }
  const rest = unique.map((h) => h.district).filter((d) => d !== origin && d !== destination);
  if (!origin && !destination) {
    // „Chișinău - Rezina”: primul = plecare, al doilea = destinație; un singur loc = destinație
    if (rest.length >= 2) [origin, destination] = rest;
    else destination = rest[0];
  } else if (!origin && rest.length) {
    origin = rest[0];
  } else if (!destination && rest.length) {
    destination = rest[0];
  }

  return { origin, destination, pallets, withTransit, bodyType };
}
