"use client";

import React from "react";

export type VehicleBlueprintType =
  | "SEMI_CURTAINSIDE_33" // TIR Standard Semiremorcă Prelată/Box 13.6m (33 paleți)
  | "SEMI_REEFER_33"      // Semiremorcă Frigorifică cu Agregat (33 paleți)
  | "MACHINERY_LOWBED"    // Autospecială / Trailă Utilaje Mari & Mașini
  | "RIGID_BOX_18"        // Camion Rigid Solo 18t cu Lift Hidraulic (18 paleți)
  | "ROAD_TRAIN_40"       // Tren Rutier Tandem (Camion + Remorcă, 40 paleți)
  | "VAN_CARGO_4";        // Furgonetă / Dubă Express 3.5t (4 paleți)

export type PalletFormatType = "EURO_2" | "EURO_3" | "ISO_1000" | "OVERSIZED_DOUBLE";

export interface PlacedPallet {
  id: string;
  col: number; // 0..9 (sau 0..12)
  row: number; // 0..2
  format: PalletFormatType;
  label?: string;
}

interface VehicleBlueprintSVGProps {
  type?: VehicleBlueprintType | string;
  hasConditioner?: boolean;
  className?: string;
  strokeColor?: string;
  facing?: "left" | "right";
  pallets?: PlacedPallet[];
  occupiedPalletsCount?: number;
  layoutOrientation?: "2_WIDE" | "3_LONG";
}

/**
 * Generează stringul SVG cu paleți albaștri desenați direct în interiorul caroseriei
 * Stil: Line-Art tehnic curat, exact ca în schița furnizată de utilizator.
 */
export function getVehicleSvgString(
  type: string = "SEMI_CURTAINSIDE_33",
  hasConditioner: boolean = false,
  strokeColor: string = "#0f172a",
  facing: "left" | "right" = "left",
  pallets?: PlacedPallet[],
  occupiedPalletsCount: number = 21,
  layoutOrientation: "2_WIDE" | "3_LONG" = "2_WIDE"
): string {
  // Construire dreptunghiuri albastre pentru paleți poziționați în interiorul remorcii
  // Interior remorcă (când e orientat spre stânga): x=158 .. 458, y=36 .. 102
  let palletsSvg = "";

  if (type === "MACHINERY_LOWBED" || type === "UTILITY_TRUCK") {
    // Pentru utilaje agabaritice: desenăm un bloc de echipament/mașină mare albastră pe platformă
    palletsSvg = `
      <g>
        <rect x="156" y="66" width="130" height="38" rx="2" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />
        <rect x="296" y="66" width="100" height="38" rx="2" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />
      </g>
    `;
  } else if (pallets && pallets.length > 0) {
    // Paleți individuali configurați manual de utilizator
    palletsSvg = pallets
      .map((p) => {
        const colWidth = 28;
        const colGap = 2;
        const x = 160 + p.col * (colWidth + colGap);

        if (p.format === "OVERSIZED_DOUBLE") {
          // Ocupă 2 coloane și toată înălțimea
          return `<rect x="${x}" y="36" width="${colWidth * 2 + colGap}" height="66" rx="2" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />`;
        } else if (p.format === "EURO_3") {
          // 3 rânduri de-a lungul
          const h = 20;
          const y = 36 + p.row * (h + 3);
          return `<rect x="${x}" y="${y}" width="${colWidth}" height="${h}" rx="1.5" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />`;
        } else {
          // EURO_2 sau ISO_1000: 2 rânduri de-a latul (exact ca în schița din imagine!)
          const h = 31;
          const y = 36 + p.row * (h + 4);
          return `<rect x="${x}" y="${y}" width="${colWidth}" height="${h}" rx="1.5" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />`;
        }
      })
      .join("");
  } else {
    // Generare automată a paleților ocupați din față spre spate (exact ca în exemplul din imagine)
    const is3Rows = layoutOrientation === "3_LONG";
    const rowsCount = is3Rows ? 3 : 2;
    const rowHeight = is3Rows ? 20 : 31;
    const rowGap = is3Rows ? 3 : 4;
    const colWidth = 28;
    const colGap = 2;

    const totalSlots = rowsCount * 10;
    const occupied = Math.min(occupiedPalletsCount, totalSlots);
    const rects: string[] = [];

    let count = 0;
    for (let c = 0; c < 10; c++) {
      for (let r = 0; r < rowsCount; r++) {
        if (count < occupied) {
          const x = 160 + c * (colWidth + colGap);
          const y = 36 + r * (rowHeight + rowGap);
          rects.push(
            `<rect x="${x}" y="${y}" width="${colWidth}" height="${rowHeight}" rx="1.5" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />`
          );
          count++;
        }
      }
    }
    palletsSvg = rects.join("");
  }

  // 1. Schiță AUTOSPECIALĂ / UTILITAR (desenul de jos din imaginea utilizatorului)
  if (type === "MACHINERY_LOWBED" || type === "UTILITY_TRUCK") {
    const rawSvg = `
      <path d="M 60 106 L 38 106 Q 34 106 34 100 L 34 50 Q 34 44 42 44 L 140 44 L 140 54 L 410 54 Q 418 54 418 60 L 418 106 L 398 106" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#ffffff" />
      <rect x="30" y="98" width="8" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <rect x="36" y="80" width="6" height="8" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 44 50 L 76 50 L 76 74 L 44 74 Z" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 82 50 L 128 50 L 128 74 L 82 74 Z" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 76 74 L 76 106 L 132 106 L 132 74" stroke="${strokeColor}" stroke-width="1.5" fill="none" />
      <line x1="120" y1="84" x2="128" y2="84" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" />
      
      <!-- Compartimente marfă / dulapuri -->
      <rect x="146" y="60" width="80" height="46" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <line x1="146" y1="75" x2="226" y2="75" stroke="${strokeColor}" stroke-width="1.5" />
      <line x1="146" y1="90" x2="226" y2="90" stroke="${strokeColor}" stroke-width="1.5" />
      <rect x="234" y="60" width="168" height="46" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <line x1="234" y1="75" x2="402" y2="75" stroke="${strokeColor}" stroke-width="1.5" />
      <line x1="234" y1="90" x2="402" y2="90" stroke="${strokeColor}" stroke-width="1.5" />
      <line x1="318" y1="60" x2="318" y2="106" stroke="${strokeColor}" stroke-width="1.5" />

      <!-- Scară metalică pe acoperiș -->
      <rect x="210" y="34" width="180" height="16" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 210 50 L 222 34 L 234 50 L 246 34 L 258 50 L 270 34 L 282 50 L 294 34 L 306 50 L 318 34 L 330 50 L 342 34 L 354 50 L 366 34 L 378 50 L 390 34" stroke="${strokeColor}" stroke-width="1.5" fill="none" />
      <rect x="76" y="36" width="34" height="8" rx="2" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <rect x="412" y="98" width="10" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />

      <!-- Roți duble concentrice -->
      <g transform="translate(80, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
      <g transform="translate(328, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
      <g transform="translate(372, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
    `;

    return `<svg viewBox="0 0 460 140" style="width:100%; height:100%;" fill="none" xmlns="http://www.w3.org/2000/svg">${rawSvg}</svg>`;
  }

  // 2. Schiță STANDARD TIR / FRIGO (Tractor în stânga, semiremorcă în dreapta cu paleți albaștri plasați în interior)
  return `
    <svg viewBox="0 0 500 140" style="width:100%; height:100%;" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Corpul Semiremorcii (dreptunghi alb cu contur negru) -->
      <rect x="154" y="32" width="310" height="74" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <rect x="150" y="106" width="316" height="5" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />

      <!-- PALEȚII ALBAȘTRI DESENAȚI DIRECT ÎN INTERIORUL CAROSERIEI (Exact ca în schița trimisă!) -->
      ${palletsSvg}

      <!-- Agregat Frigo Schmitz / ThermoKing dacă vehiculul are agregat -->
      ${
        hasConditioner || type === "SEMI_REEFER_33"
          ? `<rect x="156" y="36" width="14" height="28" rx="1" stroke="${strokeColor}" stroke-width="1.5" fill="#ffffff" /><circle cx="163" cy="50" r="4" stroke="${strokeColor}" stroke-width="1.5" />`
          : ""
      }

      <!-- Cabina Cap Tractor (în stânga, cu bot aerodinamic orientat spre stânga, exact ca în schiță!) -->
      <path d="M 144 106 L 144 46 Q 134 36 110 34 L 100 34 Q 82 38 68 58 L 58 74 L 48 74 Q 44 74 44 82 L 44 106 L 66 106" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#ffffff" />

      <!-- Geam lateral și parbriz tractor -->
      <path d="M 110 46 L 80 46 L 68 70 L 110 70 Z" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />

      <!-- Ușă șofer cu treaptă -->
      <path d="M 116 70 L 116 106 L 70 106 L 70 70" stroke="${strokeColor}" stroke-width="1.5" fill="none" />
      <line x1="110" y1="80" x2="106" y2="80" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" />
      <rect x="114" y="98" width="8" height="6" stroke="${strokeColor}" stroke-width="1.5" fill="#ffffff" />

      <!-- Bumper Față Tractor -->
      <rect x="40" y="96" width="10" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />

      <!-- Bumper Spate Semiremorcă -->
      <rect x="464" y="96" width="8" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />

      <!-- Roțile cu duble cercuri concentrice (ca în imagine) -->
      <!-- Roată Direcție Tractor (față stânga) -->
      <g transform="translate(68, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>

      <!-- Tandem Roți Motrice Tractor (sub șa) -->
      <g transform="translate(168, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>
      <g transform="translate(210, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>

      <!-- Tandem Dublu Roți Semiremorcă Spate -->
      <g transform="translate(378, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>
      <g transform="translate(420, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>
    </svg>
  `;
}

export default function VehicleBlueprintSVG({
  type = "SEMI_CURTAINSIDE_33",
  hasConditioner = false,
  className = "w-full h-24",
  strokeColor = "#0f172a",
  facing = "left",
  pallets,
  occupiedPalletsCount = 21,
  layoutOrientation = "2_WIDE",
}: VehicleBlueprintSVGProps) {
  const svgHtml = getVehicleSvgString(
    type,
    hasConditioner,
    strokeColor,
    facing,
    pallets,
    occupiedPalletsCount,
    layoutOrientation
  );

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
