// Tragerea unui tip de palet din paletar pe podea (HTML5 drag & drop).
// Tipul și dimensiunile merg în „tipul” datelor trase, singurul lucru pe care
// browserul îl arată în timpul tragerii (conținutul e disponibil doar la drop).

import type { PalletFormat } from "@/lib/db-types";

const PREFIX = "x-optifleet-pallet/";

export function writeDraggedPallet(dt: DataTransfer, format: PalletFormat, length: number, width: number) {
  dt.setData(`${PREFIX}${format.toLowerCase()}/${Math.round(length)}/${Math.round(width)}`, "1");
  dt.effectAllowed = "copy";
}

export function readDraggedPallet(dt: DataTransfer): { format: PalletFormat; length: number; width: number } | null {
  const type = [...dt.types].find((t) => t.startsWith(PREFIX));
  const m = type?.slice(PREFIX.length).match(/^(eur|industrial|custom)\/(\d{2,3})\/(\d{2,3})$/);
  if (!m) return null;
  return { format: m[1].toUpperCase() as PalletFormat, length: Number(m[2]), width: Number(m[3]) };
}
