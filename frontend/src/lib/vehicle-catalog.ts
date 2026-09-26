// Tipuri de caroserie (K6) cu valori implicite realiste pentru Moldova/UE.
// Utilizatorul le poate ajusta în constructor; capacitatea se validează
// față de ce încape geometric pe podea.

import type { BodyType } from "./db-types";

export interface BodySpec {
  type: BodyType;
  label: string;
  short: string;
  description: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  payloadKg: number;
  pallets: number;
  reefer: boolean;
}

export const BODY_SPECS: Record<BodyType, BodySpec> = {
  VAN: {
    type: "VAN", label: "Dubă 3,5 t", short: "Dubă",
    description: "Distribuție urbană și regională, 4–6 paleți.",
    lengthCm: 420, widthCm: 178, heightCm: 190, payloadKg: 1300, pallets: 5, reefer: false,
  },
  RIGID: {
    type: "RIGID", label: "Camion rigid", short: "Rigid",
    description: "Camion solo 7,2 m, de regulă cu lift hidraulic.",
    lengthCm: 720, widthCm: 248, heightCm: 250, payloadKg: 10000, pallets: 18, reefer: false,
  },
  CURTAINSIDE: {
    type: "CURTAINSIDE", label: "Semiremorcă prelată", short: "Prelată",
    description: "TIR standard 13,6 m, încărcare laterală.",
    lengthCm: 1360, widthCm: 245, heightCm: 270, payloadKg: 24000, pallets: 33, reefer: false,
  },
  REEFER: {
    type: "REEFER", label: "Semiremorcă frigorifică", short: "Frigorific",
    description: "Agregat frigorific, temperatură controlată.",
    lengthCm: 1340, widthCm: 246, heightCm: 260, payloadKg: 22000, pallets: 33, reefer: true,
  },
  ROAD_TRAIN: {
    type: "ROAD_TRAIN", label: "Tren rutier", short: "Tren rutier",
    description: "Camion + remorcă, două caroserii de 7,7 m.",
    lengthCm: 1540, widthCm: 248, heightCm: 300, payloadKg: 24000, pallets: 36, reefer: false,
  },
  LOWBED: {
    type: "LOWBED", label: "Trailă platformă joasă", short: "Trailă",
    description: "Utilaje și încărcături agabaritice, fără paleți.",
    lengthCm: 1300, widthCm: 255, heightCm: 300, payloadKg: 30000, pallets: 0, reefer: false,
  },
};

export const BODY_TYPES = Object.keys(BODY_SPECS) as BodyType[];

export const GPS_PROTOCOLS = [
  { id: "TELTONIKA", label: "Teltonika (FMB920/FMB640)" },
  { id: "CONCOX", label: "Concox GT06 / WeTrack" },
  { id: "WIALON", label: "Integrare Wialon" },
  { id: "MANUAL", label: "Fără tracker — poziție manuală" },
] as const;

/** Numere de înmatriculare MD: litere/cifre, 4–12 caractere, ex. „CAN 001”, „C AB 123”. */
export const PLATE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{2,11}$/;

export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/\s+/g, " ").trimStart().slice(0, 12);
}
