"use client";

import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import TruckCargo2D from "@/components/logistics/TruckCargo2D";
import { useClusters } from "@/hooks/use-clusters";

export default function ClustersPage() {
  const { clusters, isLoading, error, runClustering, refetch } = useClusters();
  const [running, setRunning] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string>(clusters[0]?.id ?? "cl-nord");

  const handleRunClustering = async () => {
    setRunning(true);
    try {
      const res = await runClustering();
      setToastMsg(`Algoritmul DBSCAN + CVRP a format grupurile! Economie estimată: ${res.totalSavedMdl.toLocaleString()} MDL.`);
      setTimeout(() => setToastMsg(null), 5000);
    } catch {
      setToastMsg("Eroare la execuția clustering-ului.");
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setRunning(false);
    }
  };

  const totalSavedAllMdl = clusters.reduce((sum, c) => sum + (c.total_saved_mdl || 0), 0);
  const avgDiscount = clusters.length
    ? Math.round(clusters.reduce((sum, c) => sum + (c.avg_discount_pct || 0), 0) / clusters.length)
    : 0;

  const currentCluster = clusters.find((c) => c.id === selectedClusterId) ?? clusters[0];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/clusters" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-5">
        {/* Header Minimalist */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Grupuri Logistice (GroupLog Moldova)</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Optimizare prin DBSCAN & Google OR-Tools · Gruparea comenzilor pe coridoare geografice
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={refetch} className="btn-secondary text-xs">
              ↻ Reîmprospătează
            </button>
            <button
              onClick={handleRunClustering}
              disabled={running}
              className="btn-primary text-xs"
            >
              {running ? "Se optimizează..." : "Rulează DBSCAN + CVRP"}
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>✓ {toastMsg}</span>
            <button onClick={() => setToastMsg(null)} className="text-emerald-600 font-bold">✕</button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* 4 Carduri KPI */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-emerald-600">{totalSavedAllMdl.toLocaleString()} MDL</div>
            <div className="text-xs text-slate-500 font-medium">Economii Totale IMM-uri</div>
            <div className="text-[11px] text-slate-400 mt-1">Față de curse individuale</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-blue-600">{avgDiscount}%</div>
            <div className="text-xs text-slate-500 font-medium">Discount Mediu de Grup</div>
            <div className="text-[11px] text-slate-400 mt-1">Până la 62% pe rute urbane</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-slate-900">{clusters.length}</div>
            <div className="text-xs text-slate-500 font-medium">Coridoare Formate</div>
            <div className="text-[11px] text-slate-400 mt-1">Nord, Sud, Centru</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-slate-900">
              {clusters.reduce((s, c) => s + c.orders_count, 0)}
            </div>
            <div className="text-xs text-slate-500 font-medium">Comenzi Consolidate</div>
            <div className="text-[11px] text-emerald-600 mt-1 font-semibold">100% capacitate alocată</div>
          </div>
        </div>

        {/* ─── VIZUALIZARE 2D CAMION PENTRU GRUPUL SELECTAT ─────────────────────── */}
        {currentCluster && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Încărcătură Camion 2D: {currentCluster.name} ({currentCluster.corridor})
                </h2>
                <p className="text-xs text-slate-500">
                  Vehicul alocat: <strong className="text-slate-800">{currentCluster.vehicle_assigned ?? "MAN TGL 12.250"}</strong> · Reducere tarif: <strong className="text-blue-600">-{currentCluster.avg_discount_pct}%</strong>
                </p>
              </div>
              <span className="badge-blue font-mono">{currentCluster.total_volume_m3} m³ / {currentCluster.total_weight_kg} kg</span>
            </div>

            <TruckCargo2D
              licensePlate={currentCluster.vehicle_assigned ?? "CAN 001"}
              modelName="Mercedes-Benz Actros 1845 (TIR 13.6m)"
              hasConditioner={true}
              carrierName="TransMold Express SRL"
              driverName="Ion Popescu"
              totalPalletsCapacity={33}
              occupiedCount={19}
            />
          </div>
        )}

        {/* Lista Grupurilor */}
        <div className="grid grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-3 text-center py-6 text-slate-400 text-xs">Se încarcă grupurile...</div>
          ) : (
            clusters.map((c) => {
              const isSelected = (currentCluster?.id === c.id);

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClusterId(c.id)}
                  className={`bg-white rounded-lg p-4 border transition-all cursor-pointer shadow-xs ${
                    isSelected ? "border-blue-600 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900">{c.name}</span>
                    <span className="badge-blue font-bold">-{c.avg_discount_pct}%</span>
                  </div>

                  <div className="text-xs text-slate-500 mb-3">{c.corridor}</div>

                  <div className="flex flex-col gap-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span>Comenzi:</span>
                      <strong>{c.orders_count} firme</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Volum total:</span>
                      <strong>{c.total_volume_m3} m³</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Economie grupaj:</span>
                      <strong className="text-emerald-600">+{c.total_saved_mdl.toLocaleString()} MDL</strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
