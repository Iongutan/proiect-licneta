/**
 * OptiFleet B2B — 2D Precision Pallet Positioning & Collision Engine (Prompt K7)
 * Implements bird's eye view pallet placement, strict bounding box collision detection,
 * EUR / Industrial / Custom formats, and total payload weight summation.
 */

export type StandardPalletType = "EUR_80x120" | "EUR_120x80" | "ISO_100x120" | "CUSTOM";

export interface PrecisionPallet {
  id: string;
  palletNumber?: number;
  format: StandardPalletType;
  x: number; // cm from front-left
  y: number; // cm from front-left
  width: number; // cm (transversal)
  length: number; // cm (longitudinal)
  weightKg: number;
  cargoType?: string;
  status: "FREE" | "OCCUPIED" | "RESERVED";
}

export interface VehicleDimensions {
  lengthCm: number; // e.g. 1360 cm (13.6m)
  widthCm: number; // e.g. 245 cm
  heightCm: number; // e.g. 270 cm
  maxPayloadKg: number; // e.g. 24000 kg
}

export const STANDARD_PALLETS: Record<string, { name: string; width: number; length: number; defaultWeightKg: number }> = {
  EUR_80x120: {
    name: "EUR-Paletă 80x120cm (De-a lungul)",
    width: 80,
    length: 120,
    defaultWeightKg: 650,
  },
  EUR_120x80: {
    name: "EUR-Paletă 120x80cm (De-a latul)",
    width: 120,
    length: 80,
    defaultWeightKg: 650,
  },
  ISO_100x120: {
    name: "Paletă Industrială ISO 100x120cm",
    width: 100,
    length: 120,
    defaultWeightKg: 850,
  },
};

/**
 * Verifică dacă 2 dreptunghiuri de paleți se suprapun (AABB 2D collision test)
 */
export function doPalletsOverlap(a: { x: number; y: number; width: number; length: number }, b: { x: number; y: number; width: number; length: number }): boolean {
  const noOverlap =
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.length <= b.y ||
    b.y + b.length <= a.y;

  return !noOverlap;
}

/**
 * Validare plasare palet:
 *  1. Verifică încadrarea în interiorul remorcii
 *  2. Verifică absența oricărei suprapuneri cu paleții deja plasați
 */
export function canPlacePallet(
  existingPallets: PrecisionPallet[],
  newPallet: PrecisionPallet,
  dimensions: VehicleDimensions,
  ignoreId?: string
): { allowed: boolean; reason?: string } {
  // 1. Verificare margini remorcă
  if (newPallet.x < 0 || newPallet.y < 0) {
    return { allowed: false, reason: "Coordonatele nu pot fi negative." };
  }

  if (newPallet.x + newPallet.width > dimensions.lengthCm) {
    return {
      allowed: false,
      reason: `Paletul depășește lungimea remorcii (${newPallet.x + newPallet.width}cm > ${dimensions.lengthCm}cm).`,
    };
  }

  if (newPallet.y + newPallet.length > dimensions.widthCm) {
    return {
      allowed: false,
      reason: `Paletul depășește lățimea remorcii (${newPallet.y + newPallet.length}cm > ${dimensions.widthCm}cm).`,
    };
  }

  // 2. Verificare suprapunere cu paleți existenți
  for (const existing of existingPallets) {
    if (ignoreId && existing.id === ignoreId) continue;
    if (doPalletsOverlap(newPallet, existing)) {
      return {
        allowed: false,
        reason: `Suprapunere detectată cu paletul #${existing.palletNumber || existing.id}.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Calculează sarcina totală a mărfii plasate și verifică depășirea sarcinii maxime
 */
export function calculateTotalPayload(
  pallets: PrecisionPallet[],
  maxPayloadKg: number
): {
  totalWeightKg: number;
  maxPayloadKg: number;
  remainingPayloadKg: number;
  isOverweight: boolean;
  occupancyPercent: number;
} {
  const totalWeightKg = pallets.reduce((sum, p) => sum + (p.weightKg || 0), 0);
  const remainingPayloadKg = Math.max(0, maxPayloadKg - totalWeightKg);
  const isOverweight = totalWeightKg > maxPayloadKg;
  const occupancyPercent = maxPayloadKg > 0 ? Math.min(100, Math.round((totalWeightKg / maxPayloadKg) * 100)) : 0;

  return {
    totalWeightKg,
    maxPayloadKg,
    remainingPayloadKg,
    isOverweight,
    occupancyPercent,
  };
}
