"use client";

import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import { useOrders } from "@/hooks/use-orders";
import type { Order } from "@/lib/api-client";

export default function OrdersPage() {
  const { orders, isLoading, error, refetch, cancelOrder } = useOrders();
  const [filter, setFilter] = useState<Order["status"] | "ALL">("ALL");
  const [showNew, setShowNew] = useState(false);

  const filtered = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  const renderBadge = (status: Order["status"]) => {
    switch (status) {
      case "PENDING":
        return <span className="badge-amber">În așteptare</span>;
      case "CLUSTERED":
        return <span className="badge-blue">Grupat (GroupLog)</span>;
      case "ASSIGNED":
        return <span className="badge-blue">Alocat</span>;
      case "IN_TRANSIT":
        return <span className="badge-blue">În tranzit</span>;
      case "DELIVERED":
        return <span className="badge-green">Livrat</span>;
      case "CANCELLED":
      default:
        return <span className="badge-gray">Anulat</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/orders" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-5">
        {/* Header Minimalist */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Comenzi de Marfă B2B</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestionare expediții, volume în m³, greutate și grupaj inteligent în Moldova
            </p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs">
            + Comandă Nouă
          </button>
        </div>

        {/* Filtre Status */}
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "PENDING", "CLUSTERED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                filter === s
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {s === "ALL" ? `Toate (${orders.length})` : `${s} (${orders.filter((o) => o.status === s).length})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error} — <button onClick={refetch} className="underline font-bold">Reîncearcă</button>
          </div>
        )}

        {/* Tabel Comenzi */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Se încarcă comenzile...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-800 text-sm mb-1">Nicio comandă găsită</p>
              <p className="text-xs text-slate-500">Creați o comandă nouă pentru a începe grupajul.</p>
              <button onClick={() => setShowNew(true)} className="btn-primary text-xs mt-3">
                + Comandă nouă
              </button>
            </div>
          ) : (
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Companie / ID</th>
                  <th>Status</th>
                  <th>Volum & Masă</th>
                  <th>Traseu (Pickup ➔ Dropoff)</th>
                  <th>Fereastră Livrare</th>
                  <th>Economie Grupaj</th>
                  <th>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div className="font-semibold text-slate-900">{order.company_name ?? "Companie IMM"}</div>
                      <div className="font-mono text-[11px] text-slate-400">{order.id?.slice(0, 8)}…</div>
                    </td>
                    <td>{renderBadge(order.status)}</td>
                    <td>
                      <div className="font-medium text-slate-900">{order.volume_m3} m³</div>
                      <div className="text-xs text-slate-500">{order.weight_kg} kg</div>
                    </td>
                    <td>
                      <div className="text-xs text-slate-800">{order.pickup_address ?? "Chișinău"}</div>
                      <div className="text-xs text-slate-500">➔ {order.dropoff_address ?? "Bălți"}</div>
                    </td>
                    <td>
                      <div className="text-xs text-slate-700">
                        {new Date(order.delivery_window_start).toLocaleDateString("ro-MD", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                    </td>
                    <td>
                      <span className="font-bold text-blue-600">
                        {order.estimated_discount_pct ? `~${Math.round(order.estimated_discount_pct)}%` : "—"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/contracts?order=${order.id}`}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200 font-semibold"
                        >
                          Acord / Contract
                        </a>
                        {order.status === "PENDING" && (
                          <button
                            onClick={() => {
                              if (confirm("Anulați comanda?")) cancelOrder(order.id);
                            }}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200"
                          >
                            Anulează
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal Comandă Nouă */}
      {showNew && <NewOrderModal onClose={() => setShowNew(false)} onCreated={refetch} />}
    </div>
  );
}

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    company_name: "TechMold Logistics SRL",
    volume_m3: "3.2",
    weight_kg: "750",
    pickup_address: "str. Uzinelor 14, Chișinău",
    dropoff_address: "str. Decebal 101, Bălți",
    pickup_lat: "47.0105",
    pickup_lon: "28.8638",
    dropoff_lat: "47.7540",
    dropoff_lon: "27.9261",
    instructions: "Descărcare rampă depozit Bălți",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const now = new Date();
      const start = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
      const end = new Date(now.getTime() + 8 * 3600 * 1000).toISOString();

      const { apiClient } = await import("@/lib/api-client");
      await apiClient.createOrder({
        company_name: form.company_name,
        volume_m3: parseFloat(form.volume_m3),
        weight_kg: parseFloat(form.weight_kg),
        pickup_lat: parseFloat(form.pickup_lat),
        pickup_lon: parseFloat(form.pickup_lon),
        dropoff_lat: parseFloat(form.dropoff_lat),
        dropoff_lon: parseFloat(form.dropoff_lon),
        pickup_address: form.pickup_address,
        dropoff_address: form.dropoff_address,
        delivery_window_start: start,
        delivery_window_end: end,
        special_instructions: form.instructions,
      });

      onCreated();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Eroare la salvarea comenzii");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h2 className="text-base font-bold text-slate-900">Creare Comandă B2B</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        {err && <div className="p-2.5 rounded bg-red-50 text-red-700 text-xs border border-red-200 mb-3">{err}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 mb-1 block">Companie Expeditoare:</label>
            <input
              type="text"
              required
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="input-clean text-xs py-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 mb-1 block">Volum (m³):</label>
              <input
                type="number"
                step="0.1"
                required
                value={form.volume_m3}
                onChange={(e) => setForm({ ...form, volume_m3: e.target.value })}
                className="input-clean text-xs py-1.5"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 mb-1 block">Greutate (kg):</label>
              <input
                type="number"
                required
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                className="input-clean text-xs py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 mb-1 block">Adresă Preluare (Chișinău):</label>
            <input
              type="text"
              required
              value={form.pickup_address}
              onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
              className="input-clean text-xs py-1.5"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 mb-1 block">Adresă Livrare (Bălți / Cahul):</label>
            <input
              type="text"
              required
              value={form.dropoff_address}
              onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
              className="input-clean text-xs py-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Anulează
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs">
              {loading ? "Se salvează..." : "Salvează Comanda"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
