// Vedere laterală a vehiculului, cu paleții încărcați desenați la scară.
import type { BodyType } from "@/lib/db-types";
import { COLORS, WHEEL_GROUND, approximatePallets, projectPallets, vehicleDrawing, type SidePallet } from "./vehicle-drawing";

export interface VehicleSideProps {
  type: BodyType;
  cargoLengthCm: number;
  cargoWidthCm: number;
  /** Plan exact (vehicle_loads). Dacă lipsește, se aproximează din `occupied`. */
  pallets?: SidePallet[];
  occupied?: number;
  className?: string;
  title?: string;
}

export default function VehicleSide({ type, cargoLengthCm, cargoWidthCm, pallets, occupied = 0, className, title }: VehicleSideProps) {
  const d = vehicleDrawing(type);
  const load = pallets ?? approximatePallets(type, occupied, cargoLengthCm, cargoWidthCm);
  const rects = projectPallets(d, load, cargoLengthCm);
  const stroke = { stroke: COLORS.INK, strokeWidth: 1.6, strokeLinejoin: "round" as const };

  return (
    <svg viewBox={`0 0 ${d.width} ${d.height}`} className={className} role="img" aria-label={title ?? "Schița vehiculului"}>
      {title && <title>{title}</title>}
      <line x1={4} x2={d.width - 4} y1={WHEEL_GROUND + 0.5} y2={WHEEL_GROUND + 0.5} stroke="#e2e8f0" strokeWidth={1} />
      {d.shapes.map((p, i) => <path key={`s${i}`} d={p} fill="#fff" {...stroke} />)}
      {d.faint.map((p, i) => <path key={`f${i}`} d={p} fill="none" stroke={COLORS.FAINT} strokeWidth={1} />)}
      {rects.map((r, i) => (
        <g key={`p${i}`}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h - 4} rx={1} fill={r.reserved ? COLORS.PALLET_RESERVED : COLORS.PALLET} />
          <rect x={r.x} y={r.y + r.h - 4} width={r.w} height={4} fill={COLORS.PALLET_BASE} />
        </g>
      ))}
      {d.load.map((p, i) => <path key={`l${i}`} d={p} fill="#dbeafe" {...stroke} />)}
      {d.details.map((p, i) => <path key={`d${i}`} d={p} fill="none" {...stroke} />)}
      {d.wheels.map((w, i) => (
        <g key={`w${i}`}>
          <circle cx={w.cx} cy={WHEEL_GROUND - w.r} r={w.r} fill="#fff" {...stroke} />
          <circle cx={w.cx} cy={WHEEL_GROUND - w.r} r={w.r * 0.45} fill="none" {...stroke} />
        </g>
      ))}
    </svg>
  );
}
