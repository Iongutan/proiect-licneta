// K7 — geometria planului de încărcare (vedere de sus), în centimetri.
// Aceleași reguli sunt verificate și de save_vehicle_layout() în baza de date;
// aici servesc pentru feedback instant în editor.
//
// Sistem de coordonate: x = de-a lungul caroseriei, de la peretele cabinei
// spre uși; y = transversal, de la stânga. length = pe x, width = pe y.

import type { BodyType, PalletFormat } from "./db-types";

export interface PalletSpec {
  format: PalletFormat;
  label: string;
  lengthCm: number;
  widthCm: number;
  defaultWeightKg: number;
}

export const PALLET_SPECS: Record<Exclude<PalletFormat, "CUSTOM">, PalletSpec> = {
  EUR: { format: "EUR", label: "EUR 120×80", lengthCm: 120, widthCm: 80, defaultWeightKg: 500 },
  INDUSTRIAL: { format: "INDUSTRIAL", label: "Industrial 120×100", lengthCm: 120, widthCm: 100, defaultWeightKg: 700 },
};

export interface Pallet {
  id: string;
  x: number;
  y: number;
  length: number;
  width: number;
  format: PalletFormat;
  weightKg: number;
  bookingId?: string | null;
  label?: string | null;
}

export interface Floor {
  bodyType: BodyType;
  lengthCm: number;
  widthCm: number;
  maxPayloadKg: number;
  palletCapacity: number;
}

export type PlacementCheck = { ok: true } | { ok: false; reason: string };

export const SNAP_CM = 5;
export const snap = (v: number, step = SNAP_CM) => Math.round(v / step) * step;

/** Tren rutier: podeaua e împărțită în două caroserii egale; cuplajul e la jumătate. */
export function couplingX(floor: Floor): number | null {
  return floor.bodyType === "ROAD_TRAIN" ? Math.floor(floor.lengthCm / 2) : null;
}

export function overlaps(a: Pick<Pallet, "x" | "y" | "length" | "width">, b: Pick<Pallet, "x" | "y" | "length" | "width">): boolean {
  return a.x < b.x + b.length && b.x < a.x + a.length && a.y < b.y + b.width && b.y < a.y + a.width;
}

export function checkPlacement(existing: Pallet[], candidate: Pallet, floor: Floor): PlacementCheck {
  if (candidate.x < 0 || candidate.y < 0 || candidate.x + candidate.length > floor.lengthCm || candidate.y + candidate.width > floor.widthCm) {
    return { ok: false, reason: `Paletul iese din caroserie (${floor.lengthCm}×${floor.widthCm} cm).` };
  }
  const cx = couplingX(floor);
  if (cx !== null && candidate.x < cx && candidate.x + candidate.length > cx) {
    return { ok: false, reason: "Paletul trece peste cuplajul dintre camion și remorcă." };
  }
  const hit = existing.find((p) => p.id !== candidate.id && overlaps(p, candidate));
  if (hit) return { ok: false, reason: "Se suprapune cu alt palet." };
  return { ok: true };
}

export interface LayoutTotals {
  ownPallets: number;
  reservedPallets: number;
  ownWeightKg: number;
  totalWeightKg: number;
  isOverweight: boolean;
  isOverCapacity: boolean;
}

/** bookedPallets/bookedWeightKg = rezervări contractate (plasate sau nu pe plan). */
export function layoutTotals(pallets: Pallet[], floor: Floor, bookedPallets = 0, bookedWeightKg = 0): LayoutTotals {
  const own = pallets.filter((p) => !p.bookingId);
  const ownWeightKg = own.reduce((s, p) => s + p.weightKg, 0);
  const totalWeightKg = ownWeightKg + bookedWeightKg;
  return {
    ownPallets: own.length,
    reservedPallets: pallets.length - own.length,
    ownWeightKg,
    totalWeightKg,
    isOverweight: totalWeightKg > floor.maxPayloadKg,
    isOverCapacity: own.length + bookedPallets > floor.palletCapacity,
  };
}

/** Prima eroare a unui plan întreg, sau null dacă planul e valid. */
export function validateLayout(pallets: Pallet[], floor: Floor, bookedPallets = 0, bookedWeightKg = 0): string | null {
  for (let i = 0; i < pallets.length; i++) {
    const check = checkPlacement(pallets.slice(0, i), pallets[i], floor);
    if (!check.ok) return `Paletul #${i + 1}: ${check.reason}`;
  }
  const t = layoutTotals(pallets, floor, bookedPallets, bookedWeightKg);
  if (t.isOverCapacity) return `Capacitate depășită: ${t.ownPallets} + ${bookedPallets} rezervați > ${floor.palletCapacity} locuri.`;
  if (t.isOverweight) return `Sarcină depășită: ${t.totalWeightKg} kg > ${floor.maxPayloadKg} kg.`;
  return null;
}

/**
 * Plasare automată „bottom-left”: încearcă pozițiile lipite de pereți sau de
 * paleții existenți, de la cabină spre uși, în ambele orientări.
 */
export function findFreeSpot(existing: Pallet[], floor: Floor, lengthCm: number, widthCm: number): { x: number; y: number; length: number; width: number } | null {
  const xs = [...new Set([0, ...existing.map((p) => p.x + p.length), couplingX(floor) ?? 0])].sort((a, b) => a - b);
  const ys = [...new Set([0, ...existing.map((p) => p.y + p.width)])].sort((a, b) => a - b);
  const orientations = lengthCm === widthCm ? [[lengthCm, widthCm]] : [[lengthCm, widthCm], [widthCm, lengthCm]];
  for (const x of xs) {
    for (const [length, width] of orientations) {
      for (const y of ys) {
        const candidate: Pallet = { id: "__probe__", x, y, length, width, format: "CUSTOM", weightKg: 0 };
        if (checkPlacement(existing, candidate, floor).ok) return { x, y, length, width };
      }
    }
  }
  return null;
}

/** Câți paleți de un format încap geometric pe podea (pentru a sugera capacitatea). */
export function geometricCapacity(floor: Pick<Floor, "bodyType" | "lengthCm" | "widthCm">, spec: Pick<PalletSpec, "lengthCm" | "widthCm"> = PALLET_SPECS.EUR): number {
  const fit = (L: number, W: number) =>
    Math.max(
      Math.floor(L / spec.lengthCm) * Math.floor(W / spec.widthCm),
      Math.floor(L / spec.widthCm) * Math.floor(W / spec.lengthCm),
    );
  if (floor.bodyType === "LOWBED") return 0;
  if (floor.bodyType === "ROAD_TRAIN") return 2 * fit(Math.floor(floor.lengthCm / 2), floor.widthCm);
  return fit(floor.lengthCm, floor.widthCm);
}
