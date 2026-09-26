"use client";

// Paletarul editorului K7: tipurile de paleți ca „piese” care se trag pe podea
// (sau se aleg cu clic, apoi clic pe un loc liber). Fiecare piesă e desenată la
// scară, ca diferența dintre EUR și industrial să se vadă, nu doar să se citească.

import type { PalletFormat } from "@/lib/db-types";
import { PALLET_SPECS } from "@/lib/pallet-positioning";
import { writeDraggedPallet } from "@/components/logistics/pallet-drag";

export interface PaletteChoice {
  format: PalletFormat;
  length: number;
  width: number;
}

const SCALE = 0.4; // px per cm în miniatură

export default function PalletPalette({ value, custom, onChange, onCustomChange, disabled }: {
  value: PalletFormat;
  custom: { length: number; width: number };
  onChange: (format: PalletFormat) => void;
  onCustomChange: (dims: { length: number; width: number }) => void;
  disabled?: boolean;
}) {
  const items: Array<PaletteChoice & { label: string }> = [
    { format: "EUR", length: PALLET_SPECS.EUR.lengthCm, width: PALLET_SPECS.EUR.widthCm, label: "EUR" },
    { format: "INDUSTRIAL", length: PALLET_SPECS.INDUSTRIAL.lengthCm, width: PALLET_SPECS.INDUSTRIAL.widthCm, label: "Industrial" },
    { format: "CUSTOM", length: custom.length, width: custom.width, label: "Dimensiuni proprii" },
  ];

  return (
    <div className="flex flex-wrap items-end gap-2" role="radiogroup" aria-label="Tip de palet">
      {items.map((it) => {
        const active = value === it.format;
        return (
          <button
            key={it.format}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            draggable={!disabled}
            onClick={() => onChange(it.format)}
            onDragStart={(e) => {
              onChange(it.format);
              writeDraggedPallet(e.dataTransfer, it.format, it.length, it.width);
            }}
            title="Trage pe podea sau alege, apoi clic pe un loc liber"
            className={`flex cursor-grab items-center gap-2.5 rounded-md border px-2.5 py-2 text-left active:cursor-grabbing ${active ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}
          >
            <svg width={Math.min(it.length, 160) * SCALE + 2} height={Math.min(it.width, 160) * SCALE + 2} aria-hidden="true">
              <rect x={1} y={1} width={Math.min(it.length, 160) * SCALE} height={Math.min(it.width, 160) * SCALE} rx={1.5} fill="#2563eb" stroke="#1e3a8a" />
            </svg>
            <span>
              <span className="block text-[13px] font-medium">{it.label}</span>
              <span className="block t-small t-num">{it.length}×{it.width} cm</span>
            </span>
          </button>
        );
      })}
      {value === "CUSTOM" && (
        <div className="flex items-end gap-2">
          <Dim label="Lungime" value={custom.length} max={400} onChange={(length) => onCustomChange({ ...custom, length })} />
          <Dim label="Lățime" value={custom.width} max={260} onChange={(width) => onCustomChange({ ...custom, width })} />
        </div>
      )}
    </div>
  );
}

function Dim({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const id = `pal-${label}`;
  return (
    <div className="field">
      <label className="t-label" htmlFor={id}>{label} (cm)</label>
      <input id={id} type="number" className="input t-num w-24" min={40} max={max} value={value}
        onChange={(e) => onChange(Math.max(40, Math.min(max, Math.round(Number(e.target.value)) || 40)))} />
    </div>
  );
}
