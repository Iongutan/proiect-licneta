"use client";

import React from "react";

export type VehicleBlueprintType =
  | "SEMI_CURTAINSIDE_33" // TIR Standard Semiremorcă Prelată 13.6m (33 paleți)
  | "SEMI_REEFER_33"      // Semiremorcă Frigorifică cu Agregat (33 paleți)
  | "MACHINERY_LOWBED"    // Trailă / Platformă Transport Mașini Mari & Utilaje Agabaritice
  | "RIGID_BOX_18"        // Camion Rigid Solo 18t cu Lift Hidraulic (18 paleți)
  | "ROAD_TRAIN_40"       // Tren Rutier Tandem (Camion + Remorcă, 40 paleți)
  | "VAN_CARGO_4";        // Furgonetă / Dubă Express 3.5t (4 paleți)

interface VehicleBlueprintSVGProps {
  type?: VehicleBlueprintType | string;
  hasConditioner?: boolean;
  className?: string;
  strokeColor?: string;
}

export default function VehicleBlueprintSVG({
  type = "SEMI_CURTAINSIDE_33",
  hasConditioner = false,
  className = "w-full h-32",
  strokeColor = "#334155",
}: VehicleBlueprintSVGProps) {
  // Stil tehnic CAD curat: linii fine, fără detalii încărcate
  const strokeMain = {
    stroke: strokeColor,
    strokeWidth: "1.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const strokeThin = {
    stroke: "#64748b",
    strokeWidth: "1",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  // ─── 1. PLATFORMĂ / TRAILĂ UTILAJE GRELE & MAȘINI MARI (MACHINERY_LOWBED) ────
  if (type === "MACHINERY_LOWBED") {
    return (
      <svg viewBox="0 0 520 130" className={className} fill="none">
        {/* Linia de referință a solului */}
        <line x1="10" y1="115" x2="510" y2="115" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

        {/* Cap tractor Heavy-Duty 6x4 */}
        <path d="M 20 108 L 18 78 L 28 42 L 68 34 L 98 34 L 98 108 Z" fill="#f8fafc" {...strokeMain} />
        {/* Geam cabină */}
        <path d="M 32 46 L 64 38 L 90 38 L 90 68 L 26 68 Z" fill="#e2e8f0" {...strokeThin} />
        {/* Grilă și eșapament vertical */}
        <line x1="20" y1="85" x2="20" y2="105" stroke="#94a3b8" strokeWidth="2" />
        <line x1="94" y1="18" x2="94" y2="34" stroke="#475569" strokeWidth="2.5" />

        {/* Gât de lebădă (Gooseneck) trailă */}
        <path d="M 98 90 L 125 90 L 140 102 L 400 102 L 415 88 L 485 88 L 485 108 L 105 108" fill="#f1f5f9" {...strokeMain} />

        {/* Cale joasă de încărcare utilaje (Drop deck) */}
        <rect x="140" y="98" width="260" height="4" fill="#64748b" />

        {/* Schiță simbolică utilaj transportat (Tractor / Mașină mare) */}
        <g stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3">
          <rect x="160" y="55" width="110" height="42" rx="2" />
          <circle cx="185" cy="95" r="14" />
          <circle cx="245" cy="95" r="18" />
          <rect x="290" y="65" width="95" height="32" rx="2" />
          <circle cx="315" cy="95" r="12" />
          <circle cx="365" cy="95" r="12" />
        </g>

        {/* Rampe rabatabile în spate pentru urcare mașini/utilaje */}
        <path d="M 485 88 L 505 50 L 508 52 L 488 95 Z" fill="#475569" stroke="#334155" strokeWidth="1" />

        {/* Roți Cap Tractor (1 față + 2 spate osie tandem) */}
        <circle cx="50" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="50" cy="108" r="6" fill="#94a3b8" />
        <circle cx="85" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="85" cy="108" r="6" fill="#94a3b8" />

        {/* Roți trailă (3 osii spate cu gardă mică la sol) */}
        <circle cx="425" cy="108" r="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="425" cy="108" r="5" fill="#94a3b8" />
        <circle cx="452" cy="108" r="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="452" cy="108" r="5" fill="#94a3b8" />
        <circle cx="479" cy="108" r="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="479" cy="108" r="5" fill="#94a3b8" />

        {/* Etichetă cotă tehnică CAD */}
        <text x="270" y="44" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" letterSpacing="0.05em">
          TRAILĂ AGABARITICĂ · PLATFORMĂ UTILAJE & MAȘINI MARI (45T)
        </text>
      </svg>
    );
  }

  // ─── 2. SEMIREMORCĂ FRIGORIFICĂ CU AGREGAT THERMOKING (SEMI_REEFER_33) ───────
  if (type === "SEMI_REEFER_33" || (type === "SEMI_TRAILER_33" && hasConditioner)) {
    return (
      <svg viewBox="0 0 520 130" className={className} fill="none">
        <line x1="10" y1="115" x2="510" y2="115" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

        {/* Cap tractor */}
        <path d="M 25 108 L 22 80 L 32 44 L 68 36 L 95 36 L 95 108 Z" fill="#f8fafc" {...strokeMain} />
        <path d="M 36 48 L 66 40 L 88 40 L 88 68 L 30 68 Z" fill="#e2e8f0" {...strokeThin} />

        {/* Corp semiremorcă izotermă */}
        <rect x="105" y="28" width="395" height="80" rx="2" fill="#f8fafc" {...strokeMain} />

        {/* Agregat Frigorific ThermoKing pe panoul frontal */}
        <rect x="108" y="34" width="22" height="34" rx="2" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1" />
        <circle cx="119" cy="51" r="6" fill="#1e293b" />
        <line x1="115" y1="51" x2="123" y2="51" stroke="#ffffff" strokeWidth="1.5" />
        <rect x="111" y="37" width="16" height="4" fill="#93c5fd" />

        {/* Panouri izoterme longitudinale curate */}
        <line x1="105" y1="68" x2="500" y2="68" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="235" y1="28" x2="235" y2="108" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="365" y1="28" x2="365" y2="108" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />

        {/* Protecție laterală roți */}
        <rect x="145" y="103" width="180" height="3" fill="#64748b" />

        {/* Roți Tractor */}
        <circle cx="55" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="55" cy="108" r="6" fill="#94a3b8" />
        <circle cx="95" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="95" cy="108" r="6" fill="#94a3b8" />

        {/* Triplă osie semiremorcă */}
        <circle cx="395" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="395" cy="108" r="6" fill="#94a3b8" />
        <circle cx="433" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="433" cy="108" r="6" fill="#94a3b8" />
        <circle cx="471" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="471" cy="108" r="6" fill="#94a3b8" />

        <text x="300" y="20" textAnchor="middle" fill="#2563eb" fontSize="9" fontWeight="700" letterSpacing="0.05em">
          FRIGORIFIC (REEFER) · 33 EURO-PALEȚI · AGREGAT -20°C / +4°C
        </text>
      </svg>
    );
  }

  // ─── 3. CAMION RIGID SOLO CU LIFT HIDRAULIC (RIGID_BOX_18) ───────────────────
  if (type === "RIGID_BOX_18" || type === "RIGID_MEDIUM") {
    return (
      <svg viewBox="0 0 450 130" className={className} fill="none">
        <line x1="10" y1="115" x2="440" y2="115" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

        {/* Cabina Șofer */}
        <path d="M 25 108 L 20 84 L 35 50 L 75 38 L 105 38 L 105 108 Z" fill="#f8fafc" {...strokeMain} />
        <path d="M 38 52 L 73 42 L 95 42 L 95 70 L 33 70 Z" fill="#e2e8f0" {...strokeThin} />

        {/* Cutie Marfă Rigidă */}
        <rect x="110" y="30" width="300" height="78" rx="2" fill="#f8fafc" {...strokeMain} />

        {/* Panou lift hidraulic spate (Tail lift rabatabil) */}
        <rect x="410" y="32" width="6" height="74" fill="#475569" />
        <line x1="416" y1="104" x2="425" y2="108" stroke="#f59e0b" strokeWidth="2" />

        {/* Linii panou */}
        <line x1="210" y1="30" x2="210" y2="108" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="310" y1="30" x2="310" y2="108" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />

        {/* Roată Față */}
        <circle cx="65" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="65" cy="108" r="6" fill="#94a3b8" />

        {/* Roți Spate Tandem */}
        <circle cx="335" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="335" cy="108" r="6" fill="#94a3b8" />
        <circle cx="375" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="375" cy="108" r="6" fill="#94a3b8" />

        <text x="260" y="22" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" letterSpacing="0.05em">
          CAMION RIGID 18T · 18 EURO-PALEȚI (CU LIFT HIDRAULIC)
        </text>
      </svg>
    );
  }

  // ─── 4. TREN RUTIER TANDEM (ROAD_TRAIN_40) ───────────────────────────────────
  if (type === "ROAD_TRAIN_40" || type === "ROAD_TRAIN_2_TRAILERS") {
    return (
      <svg viewBox="0 0 540 130" className={className} fill="none">
        <line x1="10" y1="115" x2="530" y2="115" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

        {/* Cap tractor */}
        <path d="M 20 108 L 18 80 L 28 46 L 60 38 L 85 38 L 85 108 Z" fill="#f8fafc" {...strokeMain} />
        <path d="M 30 50 L 58 42 L 78 42 L 78 68 L 25 68 Z" fill="#e2e8f0" {...strokeThin} />

        {/* Remorca 1 */}
        <rect x="90" y="32" width="190" height="76" rx="2" fill="#f8fafc" {...strokeMain} />

        {/* Dispozitiv tractare / Cârlig proțap */}
        <rect x="280" y="100" width="25" height="5" fill="#334155" />
        <line x1="280" y1="102" x2="305" y2="102" stroke="#f59e0b" strokeWidth="2" />

        {/* Remorca 2 (Tandem) */}
        <rect x="305" y="32" width="215" height="76" rx="2" fill="#f8fafc" {...strokeMain} />

        {/* Roți Remorca 1 */}
        <circle cx="50" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="215" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="255" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />

        {/* Roți Remorca 2 */}
        <circle cx="335" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="455" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="495" cy="108" r="15" fill="#1e293b" stroke="#475569" strokeWidth="2" />

        <text x="300" y="22" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" letterSpacing="0.05em">
          TREN RUTIER (TANDEM) · 40 EURO-PALEȚI (DOUĂ REMORCI)
        </text>
      </svg>
    );
  }

  // ─── 5. FURGONETĂ / DUBĂ EXPRESS 3.5T (VAN_CARGO_4) ──────────────────────────
  if (type === "VAN_CARGO_4" || type === "MINIVAN_2_3") {
    return (
      <svg viewBox="0 0 380 130" className={className} fill="none">
        <line x1="10" y1="115" x2="370" y2="115" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

        {/* Profil Dubă Express */}
        <path
          d="M 35 108 L 28 108 Q 22 98 22 85 L 22 75 L 50 56 L 90 38 L 340 38 Q 355 38 355 52 L 355 108 L 315 108"
          fill="#f8fafc"
          {...strokeMain}
        />
        {/* Geam lateral */}
        <path d="M 55 58 L 88 43 L 130 43 L 130 70 L 50 70 Z" fill="#e2e8f0" {...strokeThin} />

        {/* Linii uși laterale & spate */}
        <line x1="145" y1="45" x2="145" y2="108" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="250" y1="45" x2="250" y2="108" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />

        {/* Roți */}
        <circle cx="85" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="85" cy="108" r="6" fill="#94a3b8" />
        <circle cx="285" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <circle cx="285" cy="108" r="6" fill="#94a3b8" />

        <text x="210" y="24" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" letterSpacing="0.05em">
          DUBĂ EXPRESS 3.5T · 3-4 EURO-PALEȚI (1.2T UTIL)
        </text>
      </svg>
    );
  }

  // ─── 6. DEFAULT: TIR STANDARD PRELATĂ 13.6M (SEMI_CURTAINSIDE_33) ─────────────
  return (
    <svg viewBox="0 0 520 130" className={className} fill="none">
      <line x1="10" y1="115" x2="510" y2="115" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />

      {/* Cap tractor */}
      <path d="M 25 108 L 22 80 L 32 44 L 68 36 L 95 36 L 95 108 Z" fill="#f8fafc" {...strokeMain} />
      <path d="M 36 48 L 66 40 L 88 40 L 88 68 L 30 68 Z" fill="#e2e8f0" {...strokeThin} />

      {/* Rezervor & șasiu tractor */}
      <rect x="75" y="96" width="26" height="11" rx="2" fill="#64748b" />

      {/* Semiremorcă Standard Prelată 13.6m */}
      <rect x="105" y="26" width="395" height="82" rx="2" fill="#f8fafc" {...strokeMain} />

      {/* Montanți verticali prelată (Curtainside pillars) */}
      <line x1="185" y1="26" x2="185" y2="108" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="265" y1="26" x2="265" y2="108" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="345" y1="26" x2="345" y2="108" stroke="#cbd5e1" strokeWidth="1" />
      <line x1="425" y1="26" x2="425" y2="108" stroke="#cbd5e1" strokeWidth="1" />

      {/* Protecție laterală bicicliști */}
      <rect x="145" y="103" width="180" height="3" fill="#64748b" />

      {/* Roți Tractor */}
      <circle cx="55" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx="55" cy="108" r="6" fill="#94a3b8" />
      <circle cx="95" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx="95" cy="108" r="6" fill="#94a3b8" />

      {/* Triplă osie semiremorcă */}
      <circle cx="395" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx="395" cy="108" r="6" fill="#94a3b8" />
      <circle cx="433" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx="433" cy="108" r="6" fill="#94a3b8" />
      <circle cx="471" cy="108" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx="471" cy="108" r="6" fill="#94a3b8" />

      <text x="300" y="20" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" letterSpacing="0.05em">
        SEMIREMORCĂ PRELATĂ 13.60M · 33 EURO-PALEȚI (86 M³ · 24T)
      </text>
    </svg>
  );
}
