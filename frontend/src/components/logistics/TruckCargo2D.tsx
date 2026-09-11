"use client";

import React, { useState } from "react";

export interface PalletItem {
  id: string;
  palletNumber: number;
  orderCode?: string;
  clientName?: string;
  destination?: string;
  weightKg?: number;
  isOccupied: boolean;
}

export interface TruckCargo2DProps {
  licensePlate?: string;
  modelName?: string;
  hasConditioner?: boolean;
  carrierName?: string;
  driverName?: string;
  totalPalletsCapacity?: number; // Standard 33 Euro-Paleți
  occupiedCount?: number;
  onPalletClick?: (pallet: PalletItem) => void;
}

export default function TruckCargo2D({
  licensePlate = "CAN 001",
  modelName = "Mercedes-Benz Actros 1845 (TIR 13.6m)",
  hasConditioner = true,
  carrierName = "TransMold Express SRL",
  driverName = "Ion Popescu",
  totalPalletsCapacity = 33,
  occupiedCount = 21,
  onPalletClick,
}: TruckCargo2DProps) {
  // Mod așezare paleți: "2_WIDE" (2 de-a latul) sau "3_LONG" (3 de-a lungul)
  const [layoutMode, setLayoutMode] = useState<"2_WIDE" | "3_LONG">("3_LONG");
  const [selectedPallet, setSelectedPallet] = useState<PalletItem | null>(null);

  // Generare listă de 33 de euro-paleți
  const demoDestinations = ["Bălți", "Orhei", "Ungheni", "Chișinău", "Cahul"];
  const demoClients = [
    "TechMold SRL",
    "MoldFood SA",
    "AgroNord SRL",
    "Vitis Moldova",
    "ElectroGrup SA",
    "TransTextil SRL",
  ];

  const pallets: PalletItem[] = Array.from({ length: totalPalletsCapacity }, (_, idx) => {
    const isOccupied = idx < occupiedCount;
    return {
      id: `plt-${idx + 1}`,
      palletNumber: idx + 1,
      isOccupied,
      orderCode: isOccupied ? `CMD-${101 + (idx % 8)}` : undefined,
      clientName: isOccupied ? demoClients[idx % demoClients.length] : undefined,
      destination: isOccupied ? demoDestinations[idx % demoDestinations.length] : undefined,
      weightKg: isOccupied ? 450 + (idx * 35) % 300 : undefined,
    };
  });

  const freeCount = totalPalletsCapacity - occupiedCount;
  const occupancyRate = Math.round((occupiedCount / totalPalletsCapacity) * 100);

  const handleSelect = (pallet: PalletItem) => {
    setSelectedPallet(pallet);
    if (onPalletClick) onPalletClick(pallet);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      {/* Header Info Camion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-slate-900">{modelName}</span>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
              {licensePlate}
            </span>
            {hasConditioner ? (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                Frigorific cu Condiționer (+4°C)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                Prelată Standard
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Transportator: <strong className="text-slate-700">{carrierName}</strong> · Șofer:{" "}
            <span className="text-slate-700">{driverName}</span>
          </div>
        </div>

        {/* Butoane Schimbare Mod Așezare */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Așezare în Remorcă:</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={() => setLayoutMode("3_LONG")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                layoutMode === "3_LONG"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              3 de-a lungul (11 col × 3)
            </button>
            <button
              onClick={() => setLayoutMode("2_WIDE")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                layoutMode === "2_WIDE"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2 de-a latul (16 col × 2)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Capacitate & Grad de Ocupare */}
      <div className="grid grid-cols-3 gap-3 my-4">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Capacitate Totală</div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{totalPalletsCapacity} Euro-Paleți</div>
          <div className="text-[11px] text-slate-500">Standard TIR 13.6 m (86 m³)</div>
        </div>

        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Paleți Ocupați</div>
          <div className="text-lg font-bold text-blue-800 mt-0.5">
            {occupiedCount} <span className="text-xs font-normal text-blue-600">({occupancyRate}%)</span>
          </div>
          <div className="text-[11px] text-blue-600">Comenzi consolidate activ</div>
        </div>

        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Paleți Disponibili</div>
          <div className="text-lg font-bold text-emerald-800 mt-0.5">{freeCount} Poziții Libere</div>
          <div className="text-[11px] text-emerald-600">Disponibil pentru grupaj imediat</div>
        </div>
      </div>

      {/* ─── SCHEMA REALĂ PODEA CAMION (PLAN 2D PALEȚI) ─── */}
      <div className="bg-slate-100 border-2 border-slate-300 rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-2 font-semibold">
          <span>← Spate Remorcă (Uși Încărcare)</span>
          <span className="text-slate-400">Podea Semiremorcă 13.60 m × 2.45 m</span>
          <span>Față Remorcă (Spre Cabină) →</span>
        </div>

        {/* Grila de Paleți */}
        <div
          className={`grid gap-2 min-w-[700px] select-none ${
            layoutMode === "3_LONG" ? "grid-rows-3 grid-flow-col" : "grid-rows-2 grid-flow-col"
          }`}
        >
          {pallets.map((plt) => {
            const isSelected = selectedPallet?.id === plt.id;
            return (
              <div
                key={plt.id}
                onClick={() => handleSelect(plt)}
                className={`h-16 rounded-lg border-2 transition-all cursor-pointer flex flex-col items-center justify-center p-1 text-center ${
                  plt.isOccupied
                    ? isSelected
                      ? "bg-blue-700 border-slate-900 text-white shadow-md ring-2 ring-blue-400"
                      : "bg-blue-600 hover:bg-blue-700 border-blue-800 text-white shadow-xs"
                    : isSelected
                    ? "bg-blue-100 border-blue-600 text-blue-800 ring-2 ring-blue-300"
                    : "bg-white hover:bg-blue-50 border-dashed border-blue-300 text-blue-600"
                }`}
              >
                <span className="font-mono font-bold text-xs tracking-wider">
                  #{plt.palletNumber.toString().padStart(2, "0")}
                </span>
                {plt.isOccupied ? (
                  <>
                    <span className="text-[10px] font-semibold opacity-95 leading-tight truncate max-w-[80px]">
                      {plt.orderCode}
                    </span>
                    <span className="text-[9px] opacity-80 leading-tight truncate max-w-[80px]">
                      {plt.weightKg} kg
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-600">+ LIBER</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legendă Simplificată */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block border border-blue-700"></span>
              Palet Ocupat ({occupiedCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-white border-2 border-dashed border-blue-300 inline-block"></span>
              Palet Liber Disponibil ({freeCount})
            </span>
          </div>
          <span className="text-slate-500 font-medium">
            Dimensiune palet: 1200 mm × 800 mm (Standard EPAL / EUR 1)
          </span>
        </div>
      </div>

      {/* Detalii Palet Selectat (Afișat Curat Inline, FĂRĂ NICIUN POPUP AIUREA) */}
      {selectedPallet && (
        <div className="mt-4 p-3.5 rounded-lg bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900 text-sm">
              Palet #{selectedPallet.palletNumber.toString().padStart(2, "0")}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                selectedPallet.isOccupied
                  ? "bg-blue-600 text-white"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {selectedPallet.isOccupied ? "OCUPAT" : "LIBER PENTRU REZERVARE"}
            </span>
            {selectedPallet.isOccupied && (
              <span className="text-slate-700">
                Comandă: <strong className="text-slate-900">{selectedPallet.orderCode}</strong> · Client:{" "}
                <strong className="text-slate-900">{selectedPallet.clientName}</strong> · Destinație:{" "}
                <strong className="text-blue-700">{selectedPallet.destination}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono font-bold text-slate-700">
            {selectedPallet.isOccupied ? (
              <span>Greutate: {selectedPallet.weightKg} kg</span>
            ) : (
              <span className="text-emerald-700 font-semibold">Până la 750 kg / palet</span>
            )}
            <button
              onClick={() => setSelectedPallet(null)}
              className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-600 font-sans font-normal text-xs"
            >
              Închide detalii
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
