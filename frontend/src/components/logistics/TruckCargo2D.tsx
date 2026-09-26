"use client";

// K7 — editorul planului de încărcare, vedere de sus la scară (1 unitate SVG = 1 cm).
// Trage paleții cu mouse-ul/degetul (lipire la 5 cm), săgeți = mutare fină,
// R = rotire, Delete = scoatere. Coliziunile și ieșirea din caroserie sunt
// semnalate imediat; poziția invalidă nu e acceptată.

import { useCallback, useMemo, useRef, useState } from "react";
import { checkPlacement, couplingX, snap, type Floor, type Pallet } from "@/lib/pallet-positioning";

interface Props {
  floor: Floor;
  pallets: Pallet[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange?: (next: Pallet[]) => void;
  /** Clic pe podea liberă (în cm), pentru adăugarea unui palet. */
  onFloorClick?: (xCm: number, yCm: number) => void;
  onReject?: (reason: string) => void;
  readOnly?: boolean;
  className?: string;
}

const MARGIN = { left: 70, right: 50, top: 34, bottom: 44 };

export default function TruckCargo2D({ floor, pallets, selectedId, onSelect, onChange, onFloorClick, onReject, readOnly, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ pallet: Pallet; ok: boolean } | null>(null);

  const width = floor.lengthCm + MARGIN.left + MARGIN.right;
  const height = floor.widthCm + MARGIN.top + MARGIN.bottom;
  const cx = couplingX(floor);

  const toCm = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x - MARGIN.left, y: p.y - MARGIN.top };
  }, []);

  const commit = (candidate: Pallet) => {
    const res = checkPlacement(pallets, candidate, floor);
    if (!res.ok) {
      onReject?.(res.reason);
      return false;
    }
    onChange?.(pallets.map((p) => (p.id === candidate.id ? candidate : p)));
    return true;
  };

  const onPointerDown = (e: React.PointerEvent, pallet: Pallet) => {
    e.stopPropagation();
    onSelect(pallet.id);
    if (readOnly) return;
    const at = toCm(e.clientX, e.clientY);
    drag.current = { id: pallet.id, dx: at.x - pallet.x, dy: at.y - pallet.y, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const pallet = pallets.find((p) => p.id === d.id);
    if (!pallet) return;
    const at = toCm(e.clientX, e.clientY);
    const moved: Pallet = { ...pallet, x: snap(at.x - d.dx), y: snap(at.y - d.dy) };
    if (moved.x === pallet.x && moved.y === pallet.y && !d.moved) return;
    d.moved = true;
    setGhost({ pallet: moved, ok: checkPlacement(pallets, moved, floor).ok });
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved && ghost) commit(ghost.pallet);
    setGhost(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly || !selectedId) return;
    const pallet = pallets.find((p) => p.id === selectedId);
    if (!pallet) return;
    const step = e.shiftKey ? 1 : 5;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      commit({ ...pallet, x: pallet.x + dx, y: pallet.y + dy });
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      commit({ ...pallet, length: pallet.width, width: pallet.length });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onChange?.(pallets.filter((p) => p.id !== pallet.id));
      onSelect(null);
    } else if (e.key === "Escape") {
      onSelect(null);
    }
  };

  const floorClick = (e: React.MouseEvent) => {
    if (readOnly || !onFloorClick) return;
    const at = toCm(e.clientX, e.clientY);
    if (at.x < 0 || at.y < 0 || at.x > floor.lengthCm || at.y > floor.widthCm) return;
    onSelect(null);
    onFloorClick(snap(at.x), snap(at.y));
  };

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m <= floor.lengthCm; m += 100) out.push(m);
    return out;
  }, [floor.lengthCm]);

  const numbered = pallets.map((p, i) => ({ p, n: i + 1 }));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={`touch-none select-none outline-none ${className ?? ""}`}
      tabIndex={0}
      role="application"
      aria-label="Plan de încărcare, vedere de sus. Săgeți: mutare; R: rotire; Delete: scoatere."
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Cabina și ușile */}
      <rect x={6} y={MARGIN.top + floor.widthCm * 0.12} width={MARGIN.left - 18} height={floor.widthCm * 0.76} rx={10} fill="#fff" stroke="#0f172a" strokeWidth={2} />
      <text x={6 + (MARGIN.left - 18) / 2} y={MARGIN.top + floor.widthCm / 2 + 5} textAnchor="middle" fontSize={14} fill="#64748b">cabină</text>
      <text x={MARGIN.left + floor.lengthCm + 10} y={MARGIN.top + floor.widthCm / 2} fontSize={14} fill="#64748b" transform={`rotate(90 ${MARGIN.left + floor.lengthCm + 10} ${MARGIN.top + floor.widthCm / 2})`} textAnchor="middle">uși</text>

      <g transform={`translate(${MARGIN.left} ${MARGIN.top})`}>
        {/* Podeaua */}
        <rect x={0} y={0} width={floor.lengthCm} height={floor.widthCm} fill="#f8fafc" stroke="#0f172a" strokeWidth={3} onClick={floorClick} className={readOnly ? "" : "cursor-crosshair"} />
        {Array.from({ length: Math.floor(floor.lengthCm / 20) }, (_, i) => (
          <line key={`gx${i}`} x1={(i + 1) * 20} x2={(i + 1) * 20} y1={0} y2={floor.widthCm} stroke={(i + 1) % 5 === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} pointerEvents="none" />
        ))}
        {Array.from({ length: Math.floor(floor.widthCm / 20) }, (_, i) => (
          <line key={`gy${i}`} x1={0} x2={floor.lengthCm} y1={(i + 1) * 20} y2={(i + 1) * 20} stroke="#f1f5f9" strokeWidth={1} pointerEvents="none" />
        ))}

        {cx !== null && (
          <g pointerEvents="none">
            <line x1={cx} x2={cx} y1={-12} y2={floor.widthCm + 12} stroke="#b45309" strokeWidth={3} strokeDasharray="10 6" />
            <text x={cx / 2} y={-10} textAnchor="middle" fontSize={14} fill="#64748b">camion</text>
            <text x={cx + (floor.lengthCm - cx) / 2} y={-10} textAnchor="middle" fontSize={14} fill="#64748b">remorcă</text>
          </g>
        )}

        {/* Riglă (metri) */}
        {ticks.map((m) => (
          <g key={`t${m}`} pointerEvents="none">
            <line x1={m} x2={m} y1={floor.widthCm} y2={floor.widthCm + 10} stroke="#64748b" strokeWidth={1.5} />
            <text x={m} y={floor.widthCm + 28} textAnchor="middle" fontSize={14} fill="#64748b">{m / 100} m</text>
          </g>
        ))}

        {/* Paleți */}
        {numbered.map(({ p, n }) => {
          const selected = p.id === selectedId;
          const dragging = ghost?.pallet.id === p.id;
          return (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y})`}
              onPointerDown={(e) => onPointerDown(e, p)}
              className={readOnly ? "cursor-pointer" : "cursor-grab"}
              opacity={dragging ? 0.35 : 1}
            >
              <PalletShape pallet={p} selected={selected} number={n} />
            </g>
          );
        })}

        {ghost && (
          <g transform={`translate(${ghost.pallet.x} ${ghost.pallet.y})`} pointerEvents="none">
            <rect width={ghost.pallet.length} height={ghost.pallet.width} fill={ghost.ok ? "rgba(37,99,235,0.25)" : "rgba(185,28,28,0.2)"} stroke={ghost.ok ? "#2563eb" : "#b91c1c"} strokeWidth={3} strokeDasharray="8 5" />
          </g>
        )}
      </g>
    </svg>
  );
}

function PalletShape({ pallet, selected, number }: { pallet: Pallet; selected: boolean; number: number }) {
  const reserved = Boolean(pallet.bookingId);
  const { length: L, width: W } = pallet;
  const boards = L >= W ? [0.12, 0.5, 0.88].map((f) => ({ x: L * f - 5, y: 3, w: 10, h: W - 6 })) : [0.12, 0.5, 0.88].map((f) => ({ x: 3, y: W * f - 5, w: L - 6, h: 10 }));
  return (
    <>
      <rect width={L} height={W} rx={2} fill={reserved ? "#dbeafe" : "#2563eb"} stroke={selected ? "#0f172a" : reserved ? "#2563eb" : "#1e3a8a"} strokeWidth={selected ? 4 : 2} />
      {boards.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={reserved ? "#bfdbfe" : "#1d4ed8"} pointerEvents="none" />)}
      <text x={L / 2} y={W / 2 - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill={reserved ? "#1d4ed8" : "#fff"} pointerEvents="none">{number}</text>
      <text x={L / 2} y={W / 2 + 18} textAnchor="middle" fontSize={14} fill={reserved ? "#1d4ed8" : "#dbeafe"} pointerEvents="none">{pallet.weightKg} kg</text>
    </>
  );
}
