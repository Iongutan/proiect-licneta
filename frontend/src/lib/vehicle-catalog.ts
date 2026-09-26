// Catalogul tipurilor de unități din flotă: camioane (K6), vagon de tren, dronă.
// Un singur registru pentru toată flota — constructorul, lista și pagina de
// configurare citesc de aici tot ce diferă între tipuri (etichete, limite,
// cum se declară locurile ocupate). Limitele sunt aceleași ca în
// supabase/sql/02_tables.sql (constraint vehicles_limits_by_type).

import type { BodyType, TransportMode } from "./db-types";

/** FLOOR = plan de podea palet cu palet (K7); COUNT = număr de locuri, în bloc; NONE = fără locuri. */
export type LoadMode = "FLOOR" | "COUNT" | "NONE";

export interface Range {
  min: number;
  max: number;
}

export interface BodySpec {
  type: BodyType;
  mode: TransportMode;
  label: string;
  short: string;
  description: string;
  /** Cuvinte după care utilizatorul găsește tipul în constructor („vagon de tren”, „drona”). */
  keywords: string[];
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  payloadKg: number;
  pallets: number;
  reefer: boolean;
  loadMode: LoadMode;
  /** Cum se numește identificatorul unității și un exemplu. */
  idLabel: string;
  idPlaceholder: string;
  modelPlaceholder: string;
  /** Unitatea de capacitate: „paleți” sau „compartimente”. */
  placeUnit: string;
  /** Unitatea deservește o zonă de raioane (dronă), nu doar curse A→B. */
  needsArea: boolean;
  /** Are sens un șofer/operator cu telefon. */
  hasCrew: boolean;
  crewLabel: string;
  limits: { lengthCm: Range; widthCm: Range; heightCm: Range; payloadKg: Range; places: Range };
}

const ROAD_LIMITS = {
  lengthCm: { min: 150, max: 2000 },
  widthCm: { min: 100, max: 260 },
  heightCm: { min: 80, max: 320 },
  payloadKg: { min: 300, max: 44000 },
  places: { min: 1, max: 66 },
};

const ROAD = {
  mode: "ROAD" as const,
  loadMode: "FLOOR" as const,
  idLabel: "Număr de înmatriculare",
  idPlaceholder: "CAN 001",
  placeUnit: "paleți",
  needsArea: false,
  hasCrew: true,
  crewLabel: "Șofer",
  limits: ROAD_LIMITS,
};

export const BODY_SPECS: Record<BodyType, BodySpec> = {
  VAN: {
    ...ROAD, type: "VAN", label: "Dubă 3,5 t", short: "Dubă",
    description: "Distribuție urbană și regională, 4–6 paleți.",
    keywords: ["duba", "dubita", "van", "furgon", "sprinter"],
    modelPlaceholder: "Mercedes-Benz Sprinter 316",
    lengthCm: 420, widthCm: 178, heightCm: 190, payloadKg: 1300, pallets: 5, reefer: false,
  },
  RIGID: {
    ...ROAD, type: "RIGID", label: "Camion rigid", short: "Rigid",
    description: "Camion solo 7,2 m, de regulă cu lift hidraulic.",
    keywords: ["camion", "rigid", "camion solo", "lift"],
    modelPlaceholder: "DAF CF 450",
    lengthCm: 720, widthCm: 248, heightCm: 250, payloadKg: 10000, pallets: 18, reefer: false,
  },
  CURTAINSIDE: {
    ...ROAD, type: "CURTAINSIDE", label: "Semiremorcă prelată", short: "Prelată",
    description: "TIR standard 13,6 m, încărcare laterală.",
    keywords: ["tir", "prelata", "semiremorca", "fura"],
    modelPlaceholder: "Mercedes-Benz Actros 1845",
    lengthCm: 1360, widthCm: 245, heightCm: 270, payloadKg: 24000, pallets: 33, reefer: false,
  },
  REEFER: {
    ...ROAD, type: "REEFER", label: "Semiremorcă frigorifică", short: "Frigorific",
    description: "Agregat frigorific, temperatură controlată.",
    keywords: ["frigorific", "frigider", "frigo", "izoterma", "reefer"],
    modelPlaceholder: "Volvo FH 500 + Schmitz",
    lengthCm: 1340, widthCm: 246, heightCm: 260, payloadKg: 22000, pallets: 33, reefer: true,
  },
  ROAD_TRAIN: {
    ...ROAD, type: "ROAD_TRAIN", label: "Tren rutier", short: "Tren rutier",
    description: "Camion + remorcă, două caroserii de 7,7 m.",
    keywords: ["tren rutier", "autotren", "remorca", "tandem"],
    modelPlaceholder: "MAN TGX 18.500 tandem",
    lengthCm: 1540, widthCm: 248, heightCm: 300, payloadKg: 24000, pallets: 36, reefer: false,
  },
  LOWBED: {
    ...ROAD, type: "LOWBED", label: "Trailă platformă joasă", short: "Trailă",
    description: "Utilaje și încărcături agabaritice, fără paleți.",
    keywords: ["traila", "platforma joasa", "utilaje", "agabaritic", "lowbed"],
    modelPlaceholder: "Scania R500 + Goldhofer",
    loadMode: "NONE",
    limits: { ...ROAD_LIMITS, places: { min: 0, max: 0 } },
    lengthCm: 1300, widthCm: 255, heightCm: 300, payloadKg: 30000, pallets: 0, reefer: false,
  },
  RAIL_WAGON: {
    type: "RAIL_WAGON", mode: "RAIL", label: "Vagon de tren", short: "Vagon",
    description: "Vagon acoperit, propriu sau închiriat de la CFM; locurile libere se declară în bloc.",
    keywords: ["vagon", "vagon de tren", "tren", "cfm", "cale ferata", "feroviar", "habbins"],
    modelPlaceholder: "Vagon acoperit Habbins",
    lengthCm: 2200, widthCm: 280, heightCm: 260, payloadKg: 60000, pallets: 50, reefer: false,
    loadMode: "COUNT",
    idLabel: "Număr vagon",
    idPlaceholder: "31 53 2458 123-4",
    placeUnit: "paleți",
    needsArea: false,
    hasCrew: false,
    crewLabel: "Responsabil",
    limits: {
      lengthCm: { min: 1000, max: 2800 },
      widthCm: { min: 200, max: 320 },
      heightCm: { min: 150, max: 350 },
      payloadKg: { min: 5000, max: 90000 },
      places: { min: 1, max: 80 },
    },
  },
  DRONE: {
    type: "DRONE", mode: "AIR", label: "Dronă de transport", short: "Dronă",
    description: "Livrări ușoare într-o zonă de raioane; compartimente, nu paleți.",
    keywords: ["drona", "dronă", "drone", "uav", "multicopter", "aerian"],
    modelPlaceholder: "DJI FlyCart 30",
    lengthCm: 70, widthCm: 50, heightCm: 40, payloadKg: 30, pallets: 1, reefer: false,
    loadMode: "COUNT",
    idLabel: "Serie / nr. înregistrare",
    idPlaceholder: "MDA-UAS-0042",
    placeUnit: "compartimente",
    needsArea: true,
    hasCrew: true,
    crewLabel: "Operator",
    limits: {
      lengthCm: { min: 10, max: 200 },
      widthCm: { min: 10, max: 200 },
      heightCm: { min: 5, max: 150 },
      payloadKg: { min: 1, max: 500 },
      places: { min: 1, max: 20 },
    },
  },
};

export const BODY_TYPES = Object.keys(BODY_SPECS) as BodyType[];

export const MODE_LABEL: Record<TransportMode, string> = {
  ROAD: "Rutier",
  RAIL: "Feroviar",
  AIR: "Aerian",
};

export const OWNERSHIP_LABEL = {
  OWNED: "Proprietate",
  LEASED: "Leasing",
  RENTED: "Închiriat",
} as const;

export const GPS_PROTOCOLS = [
  { id: "TELTONIKA", label: "Teltonika (FMB920/FMB640)" },
  { id: "CONCOX", label: "Concox GT06 / WeTrack" },
  { id: "WIALON", label: "Integrare Wialon" },
  { id: "MANUAL", label: "Fără tracker — poziție manuală" },
] as const;

/** Numere de înmatriculare MD: litere/cifre, 4–12 caractere, ex. „CAN 001”, „C AB 123”. */
export const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{2,11}$/;
/** Identificator pentru vagon/dronă: până la 20 de caractere (nr. UIC are 16 cu spații). */
export const UNIT_ID_PATTERN = /^[A-Z0-9][A-Z0-9 -]{2,19}$/;

export function idPatternFor(type: BodyType): RegExp {
  return BODY_SPECS[type].mode === "ROAD" ? PLATE_PATTERN : UNIT_ID_PATTERN;
}

export function normalizePlate(raw: string, maxLength = 12): string {
  return raw.toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/\s+/g, " ").trimStart().slice(0, maxLength);
}

export function normalizeUnitId(type: BodyType, raw: string): string {
  return normalizePlate(raw, BODY_SPECS[type].mode === "ROAD" ? 12 : 20);
}

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Găsește tipurile potrivite pentru ce scrie utilizatorul („vagon de tren”,
 * „dronă”, „frigo”). Ordinea: potrivire exactă a unui cuvânt-cheie, apoi
 * cuvânt-cheie care începe cu textul, apoi text conținut în etichetă.
 */
export function findBodyTypes(query: string): BodyType[] {
  const q = fold(query);
  if (!q) return BODY_TYPES;
  const score = (s: BodySpec): number => {
    const words = [...s.keywords, s.label, s.short].map(fold);
    if (words.some((w) => w === q)) return 3;
    if (words.some((w) => w.startsWith(q) || q.startsWith(w))) return 2;
    if (words.some((w) => w.includes(q))) return 1;
    return 0;
  };
  return BODY_TYPES.map((t) => ({ t, s: score(BODY_SPECS[t]) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

export interface UnitDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  payloadKg: number;
  places: number;
}

/** Erori de capacitate pentru un tip, pe câmpuri (aceleași limite ca în baza de date). */
export function capacityErrors(type: BodyType, d: UnitDimensions, geometricMax?: number): Partial<Record<keyof UnitDimensions, string>> {
  const { limits, placeUnit, loadMode } = BODY_SPECS[type];
  const e: Partial<Record<keyof UnitDimensions, string>> = {};
  const out = (v: number, r: Range) => !Number.isFinite(v) || v < r.min || v > r.max;
  const fmt = (r: Range, unit: string) => `${r.min.toLocaleString("ro-MD")}–${r.max.toLocaleString("ro-MD")} ${unit}.`;
  if (out(d.lengthCm, limits.lengthCm)) e.lengthCm = fmt(limits.lengthCm, "cm");
  if (out(d.widthCm, limits.widthCm)) e.widthCm = fmt(limits.widthCm, "cm");
  if (out(d.heightCm, limits.heightCm)) e.heightCm = fmt(limits.heightCm, "cm");
  if (out(d.payloadKg, limits.payloadKg)) e.payloadKg = fmt(limits.payloadKg, "kg");
  if (loadMode === "NONE") {
    if (d.places !== 0) e.places = "Acest tip nu transportă paleți.";
  } else {
    const max = loadMode === "FLOOR" && geometricMax !== undefined ? Math.min(limits.places.max, geometricMax) : limits.places.max;
    if (!Number.isInteger(d.places) || d.places < limits.places.min || d.places > max)
      e.places = `${limits.places.min}–${max} ${placeUnit}${loadMode === "FLOOR" ? " (maxim geometric pe podea)" : ""}.`;
  }
  return e;
}
