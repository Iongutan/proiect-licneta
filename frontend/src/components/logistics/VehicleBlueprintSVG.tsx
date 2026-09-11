"use client";

import React from "react";

export type VehicleBlueprintType =
  | "SEMI_CURTAINSIDE_33" // TIR Standard Semiremorcă Prelată/Box 13.6m (33 paleți)
  | "SEMI_REEFER_33"      // Semiremorcă Frigorifică cu Agregat (33 paleți)
  | "MACHINERY_LOWBED"    // Autospecială / Trailă Utilaje Mari & Mașini
  | "RIGID_BOX_18"        // Camion Rigid Solo 18t cu Lift Hidraulic (18 paleți)
  | "ROAD_TRAIN_40"       // Tren Rutier Tandem (Camion + Remorcă, 40 paleți)
  | "VAN_CARGO_4";        // Furgonetă / Dubă Express 3.5t (4 paleți)

interface VehicleBlueprintSVGProps {
  type?: VehicleBlueprintType | string;
  hasConditioner?: boolean;
  className?: string;
  strokeColor?: string;
}

export function getVehicleSvgString(
  type: string = "SEMI_CURTAINSIDE_33",
  hasConditioner: boolean = false,
  strokeColor: string = "#0f172a"
): string {
  if (type === "MACHINERY_LOWBED" || type === "UTILITY_TRUCK") {
    return `<svg viewBox="0 0 460 140" style="width:100%; height:100%;" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 60 106 L 38 106 Q 34 106 34 100 L 34 50 Q 34 44 42 44 L 140 44 L 140 54 L 410 54 Q 418 54 418 60 L 418 106 L 398 106" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#ffffff" />
      <rect x="30" y="98" width="8" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <rect x="36" y="80" width="6" height="8" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 44 50 L 76 50 L 76 74 L 44 74 Z" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 82 50 L 128 50 L 128 74 L 82 74 Z" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 76 74 L 76 106 L 132 106 L 132 74" stroke="${strokeColor}" stroke-width="1.5" fill="none" />
      <line x1="120" y1="84" x2="128" y2="84" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" />
      <rect x="146" y="60" width="80" height="46" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <line x1="146" y1="75" x2="226" y2="75" stroke="${strokeColor}" stroke-width="1.5" />
      <line x1="146" y1="90" x2="226" y2="90" stroke="${strokeColor}" stroke-width="1.5" />
      <rect x="234" y="60" width="168" height="46" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <line x1="234" y1="75" x2="402" y2="75" stroke="${strokeColor}" stroke-width="1.5" />
      <line x1="234" y1="90" x2="402" y2="90" stroke="${strokeColor}" stroke-width="1.5" />
      <line x1="318" y1="60" x2="318" y2="106" stroke="${strokeColor}" stroke-width="1.5" />
      <rect x="210" y="34" width="180" height="16" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 210 50 L 222 34 L 234 50 L 246 34 L 258 50 L 270 34 L 282 50 L 294 34 L 306 50 L 318 34 L 330 50 L 342 34 L 354 50 L 366 34 L 378 50 L 390 34" stroke="${strokeColor}" stroke-width="1.5" fill="none" />
      <rect x="76" y="36" width="34" height="8" rx="2" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <rect x="412" y="98" width="10" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <g transform="translate(80, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>
      <g transform="translate(328, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>
      <g transform="translate(372, 106)">
        <circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
        <circle cx="0" cy="0" r="3" fill="${strokeColor}" />
      </g>
    </svg>`;
  }

  if (type === "SEMI_REEFER_33" || (type === "SEMI_CURTAINSIDE_33" && hasConditioner)) {
    return `<svg viewBox="0 0 500 140" style="width:100%; height:100%;" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="36" y="32" width="310" height="74" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <rect x="330" y="36" width="16" height="32" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <circle cx="338" cy="52" r="5" stroke="${strokeColor}" stroke-width="1.5" />
      <rect x="30" y="106" width="316" height="5" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 356 106 L 356 46 Q 366 36 390 34 L 400 34 Q 418 38 432 58 L 442 74 L 452 74 Q 456 74 456 82 L 456 106 L 434 106" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 390 46 L 420 46 L 432 70 L 390 70 Z" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <path d="M 384 70 L 384 106 L 430 106 L 430 70" stroke="${strokeColor}" stroke-width="1.5" fill="none" />
      <rect x="450" y="96" width="10" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
      <g transform="translate(80, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
      <g transform="translate(122, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
      <g transform="translate(290, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
      <g transform="translate(332, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
      <g transform="translate(432, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
    </svg>`;
  }

  // Default SEMI_CURTAINSIDE_33 (identic cu desenul 1 din schiță)
  return `<svg viewBox="0 0 500 140" style="width:100%; height:100%;" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="36" y="32" width="310" height="74" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
    <rect x="30" y="106" width="316" height="5" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
    <path d="M 356 106 L 356 46 Q 366 36 390 34 L 400 34 Q 418 38 432 58 L 442 74 L 452 74 Q 456 74 456 82 L 456 106 L 434 106" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
    <path d="M 390 46 L 420 46 L 432 70 L 390 70 Z" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
    <path d="M 384 70 L 384 106 L 430 106 L 430 70" stroke="${strokeColor}" stroke-width="1.5" fill="none" />
    <rect x="450" y="96" width="10" height="12" rx="1" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" />
    <g transform="translate(80, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
    <g transform="translate(122, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
    <g transform="translate(290, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
    <g transform="translate(332, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
    <g transform="translate(432, 106)"><circle cx="0" cy="0" r="18" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="9" stroke="${strokeColor}" stroke-width="2" fill="#ffffff" /><circle cx="0" cy="0" r="3" fill="${strokeColor}" /></g>
  </svg>`;
}

export default function VehicleBlueprintSVG({
  type = "SEMI_CURTAINSIDE_33",
  hasConditioner = false,
  className = "w-full h-24",
  strokeColor = "#0f172a",
}: VehicleBlueprintSVGProps) {
  // Stil Line-Art autentic (exact ca în schița tehnică de mână trimisă de utilizator)
  const lineStyle = {
    stroke: strokeColor,
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "#ffffff",
  };

  const lineStyleThin = {
    stroke: strokeColor,
    strokeWidth: "1.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  // ─── 1. AUTOSPECIALĂ / CAMION UTILITAR / UTILAJE GRELE (Stil desen 2 din schiță) ────
  if (type === "MACHINERY_LOWBED" || type === "UTILITY_TRUCK") {
    return (
      <svg viewBox="0 0 460 140" className={className} fill="none">
        {/* Cabina & Caroserie Monobloc */}
        <path
          d="M 60 106 L 38 106 Q 34 106 34 100 L 34 50 Q 34 44 42 44 L 140 44 L 140 54 L 410 54 Q 418 54 418 60 L 418 106 L 398 106"
          {...lineStyle}
        />

        {/* Bumper Față & Far */}
        <rect x="30" y="98" width="8" height="12" rx="1" {...lineStyle} />
        <rect x="36" y="80" width="6" height="8" rx="1" {...lineStyle} />

        {/* Parbriz & Geam lateral șofer */}
        <path d="M 44 50 L 76 50 L 76 74 L 44 74 Z" {...lineStyle} />
        <path d="M 82 50 L 128 50 L 128 74 L 82 74 Z" {...lineStyle} />

        {/* Ușă șofer cu mâner */}
        <path d="M 76 74 L 76 106 L 132 106 L 132 74" {...lineStyleThin} />
        <line x1="120" y1="84" x2="128" y2="84" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

        {/* Compartimente / Dulapuri laterale de echipament (roll-up lockers ca în imagine) */}
        <rect x="146" y="60" width="80" height="46" {...lineStyle} />
        <line x1="146" y1="75" x2="226" y2="75" {...lineStyleThin} />
        <line x1="146" y1="90" x2="226" y2="90" {...lineStyleThin} />

        <rect x="234" y="60" width="168" height="46" {...lineStyle} />
        <line x1="234" y1="75" x2="402" y2="75" {...lineStyleThin} />
        <line x1="234" y1="90" x2="402" y2="90" {...lineStyleThin} />
        <line x1="318" y1="60" x2="318" y2="106" {...lineStyleThin} />

        {/* Suport & Scară metalică pe acoperiș (ca în imaginea de jos) */}
        <rect x="210" y="34" width="180" height="16" {...lineStyle} />
        {/* Trepte diagonale scară (zig-zag / zăbrele) */}
        <path
          d="M 210 50 L 222 34 L 234 50 L 246 34 L 258 50 L 270 34 L 282 50 L 294 34 L 306 50 L 318 34 L 330 50 L 342 34 L 354 50 L 366 34 L 378 50 L 390 34"
          {...lineStyleThin}
        />

        {/* Girofar / Sistem avertizare deasupra cabinei */}
        <rect x="76" y="36" width="34" height="8" rx="2" {...lineStyle} />
        <line x1="84" y1="36" x2="84" y2="30" stroke={strokeColor} strokeWidth="2" />
        <line x1="102" y1="36" x2="102" y2="30" stroke={strokeColor} strokeWidth="2" />
        <line x1="78" y1="30" x2="108" y2="30" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

        {/* Bumper Spate */}
        <rect x="412" y="98" width="10" height="12" rx="1" {...lineStyle} />

        {/* Roți: 1 Față + Tandem Dublu Spate (Cercuri duble concentrice ca în schiță) */}
        {/* Roată Față */}
        <g transform="translate(80, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>

        {/* Roți Spate Tandem Osie 1 */}
        <g transform="translate(328, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>

        {/* Roți Spate Tandem Osie 2 */}
        <g transform="translate(372, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
      </svg>
    );
  }

  // ─── 2. SEMIREMORCĂ FRIGORIFICĂ (SEMI_REEFER_33) ──────────────────────────────
  if (type === "SEMI_REEFER_33" || (type === "SEMI_CURTAINSIDE_33" && hasConditioner)) {
    return (
      <svg viewBox="0 0 500 140" className={className} fill="none">
        {/* Semiremorcă Frigo (Box închis cu agregat) */}
        <rect x="36" y="32" width="310" height="74" {...lineStyle} />

        {/* Agregat Frigo Schmitz / ThermoKing pe peretele frontal */}
        <rect x="330" y="36" width="16" height="32" rx="1" {...lineStyle} />
        <circle cx="338" cy="52" r="5" {...lineStyleThin} />
        <line x1="334" y1="52" x2="342" y2="52" stroke={strokeColor} strokeWidth="1.5" />

        {/* Șasiu & Bumper Semiremorcă */}
        <rect x="30" y="106" width="316" height="5" {...lineStyle} />

        {/* Cabina Cap Tractor (în dreapta, stil desen 1) */}
        <path
          d="M 356 106 L 356 46 Q 366 36 390 34 L 400 34 Q 418 38 432 58 L 442 74 L 452 74 Q 456 74 456 82 L 456 106 L 434 106"
          {...lineStyle}
        />

        {/* Geam lateral și parbriz tractor */}
        <path d="M 390 46 L 420 46 L 432 70 L 390 70 Z" {...lineStyle} />

        {/* Ușă șofer cu treaptă */}
        <path d="M 384 70 L 384 106 L 430 106 L 430 70" {...lineStyleThin} />
        <line x1="390" y1="80" x2="394" y2="80" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        <rect x="378" y="98" width="8" height="6" {...lineStyle} />

        {/* Bumper Față */}
        <rect x="450" y="96" width="10" height="12" rx="1" {...lineStyle} />

        {/* Bumper Spate Semiremorcă */}
        <rect x="28" y="96" width="8" height="12" rx="1" {...lineStyle} />

        {/* Roți Semiremorcă (Tandem 2 osii ca în schița userului) */}
        <g transform="translate(80, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(122, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>

        {/* Roți Cap Tractor (Tandem spate tractor + steer față) */}
        <g transform="translate(290, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(332, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(432, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
      </svg>
    );
  }

  // ─── 3. CAMION RIGID SOLO CU LIFT (RIGID_BOX_18) ──────────────────────────────
  if (type === "RIGID_BOX_18") {
    return (
      <svg viewBox="0 0 450 140" className={className} fill="none">
        {/* Cutie cargo rigidă */}
        <rect x="40" y="36" width="260" height="70" {...lineStyle} />

        {/* Lift hidraulic spate pliat */}
        <rect x="32" y="42" width="8" height="64" {...lineStyle} />
        <line x1="32" y1="102" x2="24" y2="106" stroke={strokeColor} strokeWidth="2" />

        {/* Cabină integrată */}
        <path
          d="M 300 106 L 300 46 Q 312 36 336 34 L 348 34 Q 366 38 380 58 L 390 74 L 402 74 Q 406 74 406 82 L 406 106 L 384 106"
          {...lineStyle}
        />
        <path d="M 336 46 L 368 46 L 380 70 L 336 70 Z" {...lineStyle} />
        <path d="M 330 70 L 330 106 L 378 106 L 378 70" {...lineStyleThin} />
        <line x1="336" y1="80" x2="340" y2="80" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

        {/* Bumper Față */}
        <rect x="402" y="96" width="8" height="12" rx="1" {...lineStyle} />

        {/* Roți Spate Tandem & Roată Față */}
        <g transform="translate(190, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(232, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(378, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
      </svg>
    );
  }

  // ─── 4. TREN RUTIER TANDEM (ROAD_TRAIN_40) ───────────────────────────────────
  if (type === "ROAD_TRAIN_40") {
    return (
      <svg viewBox="0 0 520 140" className={className} fill="none">
        {/* Remorca 1 */}
        <rect x="30" y="38" width="160" height="68" {...lineStyle} />
        {/* Dispozitiv tractare / Proțap */}
        <rect x="190" y="96" width="22" height="6" {...lineStyle} />
        {/* Remorca 2 / Camion */}
        <rect x="212" y="38" width="160" height="68" {...lineStyle} />

        {/* Cabină cap */}
        <path
          d="M 372 106 L 372 48 Q 382 38 406 36 L 416 36 Q 434 40 448 60 L 458 76 L 470 76 Q 474 76 474 84 L 474 106 L 452 106"
          {...lineStyle}
        />
        <path d="M 406 48 L 436 48 L 448 72 L 406 72 Z" {...lineStyle} />

        {/* Roți Remorca 1 */}
        <g transform="translate(68, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(150, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>

        {/* Roți Remorca 2 & Față */}
        <g transform="translate(250, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(332, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(446, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
      </svg>
    );
  }

  // ─── 5. DUBĂ EXPRESS 3.5T (VAN_CARGO_4) ──────────────────────────────────────
  if (type === "VAN_CARGO_4") {
    return (
      <svg viewBox="0 0 380 140" className={className} fill="none">
        <path
          d="M 42 106 L 36 106 Q 30 106 30 96 L 30 50 Q 30 42 40 42 L 230 42 Q 248 42 266 56 L 290 74 L 320 74 Q 328 74 328 82 L 328 106 L 306 106"
          {...lineStyle}
        />
        {/* Geam lateral șofer */}
        <path d="M 232 50 L 260 50 L 284 72 L 232 72 Z" {...lineStyle} />
        {/* Ușă culisantă marfă */}
        <line x1="126" y1="44" x2="126" y2="106" {...lineStyleThin} />
        <line x1="220" y1="44" x2="220" y2="106" {...lineStyleThin} />

        {/* Bumper Față */}
        <rect x="324" y="96" width="8" height="12" rx="1" {...lineStyle} />

        {/* Roți */}
        <g transform="translate(86, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
        <g transform="translate(270, 106)">
          <circle cx="0" cy="0" r="18" {...lineStyle} />
          <circle cx="0" cy="0" r="9" {...lineStyle} />
          <circle cx="0" cy="0" r="3" fill={strokeColor} />
        </g>
      </svg>
    );
  }

  // ─── 6. DEFAULT: TIR STANDARD PRELATĂ / BOX (EXACT DESENUL 1 DIN IMAGINEA UTILIZATORULUI) ────
  return (
    <svg viewBox="0 0 500 140" className={className} fill="none">
      {/* Corp Semiremorcă Box / Prelată dreptunghiulară (ca în desenul 1 din schiță) */}
      <rect x="36" y="32" width="310" height="74" {...lineStyle} />

      {/* Șasiu inferior orizontal al semiremorcii */}
      <rect x="30" y="106" width="316" height="5" {...lineStyle} />

      {/* Cabina Cap Tractor (poziționată în dreapta, exact ca în desenul 1) */}
      <path
        d="M 356 106 L 356 46 Q 366 36 390 34 L 400 34 Q 418 38 432 58 L 442 74 L 452 74 Q 456 74 456 82 L 456 106 L 434 106"
        {...lineStyle}
      />

      {/* Geam lateral și parbriz cabină */}
      <path d="M 390 46 L 420 46 L 432 70 L 390 70 Z" {...lineStyle} />

      {/* Ușă șofer cu linie verticală și treaptă */}
      <path d="M 384 70 L 384 106 L 430 106 L 430 70" {...lineStyleThin} />
      <line x1="390" y1="80" x2="394" y2="80" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
      <rect x="378" y="98" width="8" height="6" {...lineStyle} />

      {/* Bumper Față */}
      <rect x="450" y="96" width="10" height="12" rx="1" {...lineStyle} />

      {/* Bumper Spate Semiremorcă */}
      <rect x="28" y="96" width="8" height="12" rx="1" {...lineStyle} />

      {/* ─── Roțile cu duble cercuri concentrice (ca în imagine) ─── */}
      {/* 1. Roți Semiremorcă (Tandem 2 osii stânga) */}
      <g transform="translate(80, 106)">
        <circle cx="0" cy="0" r="18" {...lineStyle} />
        <circle cx="0" cy="0" r="9" {...lineStyle} />
        <circle cx="0" cy="0" r="3" fill={strokeColor} />
      </g>
      <g transform="translate(122, 106)">
        <circle cx="0" cy="0" r="18" {...lineStyle} />
        <circle cx="0" cy="0" r="9" {...lineStyle} />
        <circle cx="0" cy="0" r="3" fill={strokeColor} />
      </g>

      {/* 2. Roți Cap Tractor (Tandem 2 osii motrice sub șa) */}
      <g transform="translate(290, 106)">
        <circle cx="0" cy="0" r="18" {...lineStyle} />
        <circle cx="0" cy="0" r="9" {...lineStyle} />
        <circle cx="0" cy="0" r="3" fill={strokeColor} />
      </g>
      <g transform="translate(332, 106)">
        <circle cx="0" cy="0" r="18" {...lineStyle} />
        <circle cx="0" cy="0" r="9" {...lineStyle} />
        <circle cx="0" cy="0" r="3" fill={strokeColor} />
      </g>

      {/* 3. Roată Direcție Tractor (față dreapta) */}
      <g transform="translate(432, 106)">
        <circle cx="0" cy="0" r="18" {...lineStyle} />
        <circle cx="0" cy="0" r="9" {...lineStyle} />
        <circle cx="0" cy="0" r="3" fill={strokeColor} />
      </g>
    </svg>
  );
}
