// Desenele laterale ale vehiculelor (line-art), descrise o singură dată ca date.
// Aceeași descriere e randată de <VehicleSide> (React) și de vehicleSvgMarkup()
// (string pentru markerii Leaflet). Markup-ul conține DOAR numere și constante —
// niciun text venit de la utilizator — deci nu poate injecta HTML.
//
// Vehiculul privește spre stânga: cabina la x mic, ușile de încărcare la x mare.

import type { BodyType } from "@/lib/db-types";

export interface CargoBox {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

export interface Drawing {
  width: number;
  height: number;
  /** Contururi pline (alb cu linie). */
  shapes: string[];
  /** Linii de detaliu (fără umplere). */
  details: string[];
  /** Linii fine (prelată, panouri). */
  faint: string[];
  /** Încărcătură desenată (utilaj pe trailă). */
  load: string[];
  wheels: Array<{ cx: number; r: number }>;
  /** Interiorul caroseriei; tren rutier = două caroserii (camion, remorcă). */
  boxes: CargoBox[];
}

const GROUND = 132;

function tractorCab(): Pick<Drawing, "shapes" | "details"> {
  return {
    shapes: [
      "M20 110 V62 Q20 46 36 43 L94 40 Q100 40 100 46 V110 Z",
      "M12 98 h12 v14 h-12 Z",
    ],
    details: [
      "M24 66 L34 47",
      "M46 50 h40 v18 h-40 Z",
      "M42 72 V108",
      "M20 110 H134",
    ],
  };
}

function van(): Drawing {
  return {
    width: 300, height: 150,
    shapes: ["M16 112 V72 Q16 60 27 55 L62 35 Q69 31 79 31 H272 Q282 31 282 41 V112 Z", "M10 100 h10 v12 h-10 Z"],
    details: ["M64 38 L34 60 H84 V38 Z", "M92 36 V110", "M16 112 H282", "M272 36 V110"],
    faint: ["M92 70 H272"],
    load: [],
    wheels: [{ cx: 60, r: 13 }, { cx: 238, r: 13 }],
    boxes: [{ x0: 96, x1: 268, top: 38, bottom: 106 }],
  };
}

function rigid(): Drawing {
  const cab = tractorCab();
  return {
    width: 410, height: 150,
    shapes: [...cab.shapes, "M104 28 H392 V104 H104 Z", "M104 104 H392 V110 H104 Z", "M392 90 h8 v20 h-8 Z"],
    details: [...cab.details, "M20 110 H392"],
    faint: ["M104 36 H392", "M104 96 H392"],
    load: [],
    wheels: [{ cx: 54, r: 15 }, { cx: 318, r: 15 }, { cx: 352, r: 15 }],
    boxes: [{ x0: 108, x1: 388, top: 34, bottom: 100 }],
  };
}

function semi(type: "CURTAINSIDE" | "REEFER"): Drawing {
  const cab = tractorCab();
  const faint =
    type === "CURTAINSIDE"
      ? Array.from({ length: 13 }, (_, i) => `M${140 + i * 28} 30 V102`).concat("M108 32 H500")
      : ["M108 36 H500", "M108 96 H500"];
  return {
    width: 520, height: 150,
    shapes: [
      ...cab.shapes,
      "M108 26 H504 V104 H108 Z",
      "M108 104 H504 V110 H108 Z",
      ...(type === "REEFER" ? ["M96 34 h12 v40 h-12 Z"] : []),
    ],
    details: [...cab.details, ...(type === "REEFER" ? ["M99 40 h6", "M99 46 h6", "M99 52 h6", "M99 58 h6", "M99 64 h6"] : [])],
    faint,
    load: [],
    wheels: [{ cx: 54, r: 15 }, { cx: 118, r: 15 }, { cx: 404, r: 15 }, { cx: 438, r: 15 }, { cx: 472, r: 15 }],
    boxes: [{ x0: 112, x1: 500, top: 32, bottom: 100 }],
  };
}

function roadTrain(): Drawing {
  const cab = tractorCab();
  return {
    width: 530, height: 150,
    shapes: [
      ...cab.shapes,
      "M104 28 H292 V104 H104 Z", "M104 104 H292 V110 H104 Z",
      "M318 28 H512 V104 H318 Z", "M318 104 H512 V110 H318 Z",
    ],
    details: [...cab.details, "M20 110 H292", "M292 108 H318"],
    faint: ["M104 36 H292", "M318 36 H512"],
    load: [],
    wheels: [{ cx: 54, r: 15 }, { cx: 228, r: 15 }, { cx: 262, r: 15 }, { cx: 364, r: 15 }, { cx: 470, r: 15 }],
    boxes: [
      { x0: 108, x1: 288, top: 34, bottom: 100 },
      { x0: 322, x1: 508, top: 34, bottom: 100 },
    ],
  };
}

function lowbed(): Drawing {
  const cab = tractorCab();
  return {
    width: 520, height: 150,
    shapes: [...cab.shapes, "M104 70 H176 L196 96 H500 V106 H104 Z"],
    details: [...cab.details],
    faint: [],
    load: [
      "M236 82 h150 a7 7 0 0 1 0 14 h-150 a7 7 0 0 1 0 -14 Z",
      "M258 56 h92 v26 h-92 Z",
      "M312 40 h34 v16 h-34 Z",
      "M262 62 L218 36 L198 74 L214 80 L226 52 L258 70",
    ],
    wheels: [{ cx: 54, r: 15 }, { cx: 118, r: 15 }, { cx: 420, r: 13 }, { cx: 450, r: 13 }, { cx: 480, r: 13 }],
    boxes: [],
  };
}

export function vehicleDrawing(type: BodyType): Drawing {
  switch (type) {
    case "VAN": return van();
    case "RIGID": return rigid();
    case "CURTAINSIDE": return semi("CURTAINSIDE");
    case "REEFER": return semi("REEFER");
    case "ROAD_TRAIN": return roadTrain();
    case "LOWBED": return lowbed();
  }
}

// ─── Paleți proiectați în vedere laterală ─────────────────────────────────

export interface SidePallet {
  xCm: number;
  lengthCm: number;
  yCm: number;
  reserved?: boolean;
}

export interface PalletRect {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  reserved: boolean;
}

/** Plasează paleții (cm) în caroseria desenului; rândurile transversale dau adâncime. */
export function projectPallets(drawing: Drawing, pallets: SidePallet[], cargoLengthCm: number): PalletRect[] {
  if (!drawing.boxes.length || cargoLengthCm <= 0) return [];
  const perBox = cargoLengthCm / drawing.boxes.length;
  return pallets
    .map((p) => {
      const idx = Math.min(drawing.boxes.length - 1, Math.floor(p.xCm / perBox));
      const box = drawing.boxes[idx];
      const scale = (box.x1 - box.x0) / perBox;
      const row = Math.min(2, Math.max(0, Math.round(p.yCm / 80)));
      const h = (box.bottom - box.top) * 0.58;
      return {
        x: box.x0 + (p.xCm - idx * perBox) * scale + row * 2.5,
        y: box.bottom - h - row * 2.5,
        w: Math.max(3, p.lengthCm * scale - 1.5),
        h,
        row,
        reserved: Boolean(p.reserved),
      };
    })
    .sort((a, b) => b.row - a.row);
}

/** Când nu avem planul exact (ex. marker), umplem de la cabină spre uși. */
export function approximatePallets(type: BodyType, occupied: number, cargoLengthCm: number, cargoWidthCm: number): SidePallet[] {
  if (type === "LOWBED" || occupied <= 0) return [];
  const across = Math.max(1, Math.floor(cargoWidthCm / 80));
  const half = type === "ROAD_TRAIN" ? cargoLengthCm / 2 : cargoLengthCm;
  const perBoxCols = Math.max(1, Math.floor(half / 120));
  return Array.from({ length: occupied }, (_, k) => {
    const col = Math.floor(k / across);
    const box = type === "ROAD_TRAIN" ? Math.floor(col / perBoxCols) : 0;
    return { xCm: box * half + (col % perBoxCols) * 120, lengthCm: 120, yCm: (k % across) * 80 };
  });
}

const INK = "#0f172a";
const FAINT = "#94a3b8";
const PALLET = "#2563eb";
const PALLET_RESERVED = "#93c5fd";
const PALLET_BASE = "#1e3a8a";

/** SVG ca string (pentru markeri). Conține exclusiv valori numerice și constante. */
export function vehicleSvgMarkup(type: BodyType, pallets: SidePallet[], cargoLengthCm: number, strokeWidth = 1.4): string {
  const d = vehicleDrawing(type);
  const n = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
  const stroke = `stroke="${INK}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" stroke-linejoin="round"`;
  const parts: string[] = [];
  parts.push(...d.shapes.map((p) => `<path d="${p}" fill="#fff" ${stroke}/>`));
  parts.push(...d.faint.map((p) => `<path d="${p}" fill="none" stroke="${FAINT}" stroke-width="1" vector-effect="non-scaling-stroke"/>`));
  for (const r of projectPallets(d, pallets, cargoLengthCm)) {
    parts.push(`<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h - 4)}" rx="1" fill="${r.reserved ? PALLET_RESERVED : PALLET}"/>`);
    parts.push(`<rect x="${n(r.x)}" y="${n(r.y + r.h - 4)}" width="${n(r.w)}" height="4" fill="${PALLET_BASE}"/>`);
  }
  parts.push(...d.load.map((p) => `<path d="${p}" fill="#dbeafe" ${stroke}/>`));
  parts.push(...d.details.map((p) => `<path d="${p}" fill="none" ${stroke}/>`));
  for (const w of d.wheels) {
    const cy = GROUND - w.r;
    parts.push(`<circle cx="${w.cx}" cy="${cy}" r="${w.r}" fill="#fff" ${stroke}/>`);
    parts.push(`<circle cx="${w.cx}" cy="${cy}" r="${n(w.r * 0.45)}" fill="none" ${stroke}/>`);
  }
  return `<svg viewBox="0 0 ${d.width} ${d.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join("")}</svg>`;
}

export const WHEEL_GROUND = GROUND;
export const COLORS = { INK, FAINT, PALLET, PALLET_RESERVED, PALLET_BASE };
