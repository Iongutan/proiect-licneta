"use client";

import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import Link from "next/link";
import { useOrders } from "@/hooks/use-orders";
import { useClusters } from "@/hooks/use-clusters";
import { useAppStatus } from "@/hooks/use-app-status";

export default function DashboardPage() {
  const { orders, refetch: refetchOrders } = useOrders();
  const { clusters, runClustering } = useClusters();
  const { isLive } = useAppStatus();
  const [clusteringLoading, setClusteringLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const pendingOrders = orders.filter((o) => o.status === "PENDING").length;
  const clusteredOrders = orders.filter((o) => o.status === "CLUSTERED" || o.status === "ASSIGNED" || o.status === "IN_TRANSIT").length;

  const handleConfirmGrouping = async () => {
    setClusteringLoading(true);
    try {
      const res = await runClustering();
      await refetchOrders();
      setSuccessBanner(`Gruparea a fost confirmată! Au fost create ${res.clustersCreated} grupuri cu o economie estimată de ${res.totalSavedMdl.toLocaleString()} MDL.`);
      setTimeout(() => setSuccessBanner(null), 6000);
    } catch {
      setSuccessBanner("Eroare la optimizarea grupării.");
      setTimeout(() => setSuccessBanner(null), 4000);
    } finally {
      setClusteringLoading(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="badge-amber">În așteptare</span>;
      case "CLUSTERED":
      case "ASSIGNED":
      case "IN_TRANSIT":
        return <span className="badge-blue">Grupat</span>;
      case "DELIVERED":
        return <span className="badge-green">Livrat</span>;
      default:
        return <span className="badge-gray">Anulat</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/dashboard" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-5">
        {/* Header Minimalist */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Panou de Control B2B — OptiFleet</h1>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                isLive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
              }`}>
                {isLive ? "● Server Rust Conectat" : "○ Mod Moldova Activ"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              OptiFleet & GroupLog — Sistem B2B de optimizare logistică, expediție și rutare în Republica Moldova
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/orders" className="btn-secondary text-xs">
              + Comandă nouă
            </Link>
            <Link href="/map" className="btn-primary text-xs">
              Hartă Moldova & Camioane 2D
            </Link>
          </div>
        </div>

        {successBanner && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>✓ {successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 font-bold">✕</button>
          </div>
        )}

        {/* 4 Carduri Statistici */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
            <div className="text-xs text-slate-500 font-medium">Comenzi Înregistrate</div>
            <div className="text-[11px] text-blue-600 mt-1 font-semibold">
              {pendingOrders} în așteptare / {clusteredOrders} grupate
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-blue-600">{clusters.length}</div>
            <div className="text-xs text-slate-500 font-medium">Grupuri Formate (GroupLog)</div>
            <div className="text-[11px] text-slate-600 mt-1 font-medium">Reduceri de până la 62%</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-emerald-600">8,470 MDL</div>
            <div className="text-xs text-slate-500 font-medium">Economii Totale Generate</div>
            <div className="text-[11px] text-emerald-700 mt-1 font-semibold">Cost optimizat vs individual</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-slate-900">420 kg</div>
            <div className="text-xs text-slate-500 font-medium">Emisii CO₂ Reduse</div>
            <div className="text-[11px] text-slate-600 mt-1 font-medium">Prin eliminarea curselor în gol</div>
          </div>
        </div>

        {/* Acțiune DBSCAN + CVRP Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-blue-950">Motor de Grupaj Automat (DBSCAN + Google OR-Tools)</h2>
            <p className="text-xs text-blue-700 mt-0.5">
              Grupează automat comenzile din aceeași zonă geografică și generează rute optimizate pentru camioane.
            </p>
          </div>
          <button
            onClick={handleConfirmGrouping}
            disabled={clusteringLoading}
            className="btn-primary text-xs"
          >
            {clusteringLoading ? "Se optimizează..." : "Rulează Grupajul (GroupLog)"}
          </button>
        </div>

        {/* Tabel Comenzi Recente */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Comenzi Recente</h2>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline font-medium">
              Vezi toate comenzile →
            </Link>
          </div>

          <table className="table-clean">
            <thead>
              <tr>
                <th>Companie</th>
                <th>Status</th>
                <th>Volum & Greutate</th>
                <th>Traseu</th>
                <th>Fereastră Livrare</th>
                <th>Economie</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 6).map((order) => (
                <tr key={order.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{order.company_name ?? "Companie IMM"}</div>
                    <div className="font-mono text-[10px] text-slate-400">{order.id?.slice(0, 8)}…</div>
                  </td>
                  <td>{renderStatus(order.status)}</td>
                  <td>
                    <span className="font-medium">{order.volume_m3} m³</span>
                    <span className="text-slate-400 text-xs"> / {order.weight_kg} kg</span>
                  </td>
                  <td className="text-xs text-slate-600">
                    {order.pickup_address ?? "Chișinău"} ➔ {order.dropoff_address ?? "Bălți"}
                  </td>
                  <td className="text-xs text-slate-600">
                    {new Date(order.delivery_window_start).toLocaleDateString("ro-MD", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td className="font-bold text-blue-600">
                    {order.estimated_discount_pct ? `~${Math.round(order.estimated_discount_pct)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
