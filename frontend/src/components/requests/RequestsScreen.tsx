"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Booking, FreightRequest, MapVehicle, RequestStatus } from "@/lib/db-types";
import { districtName } from "@/lib/districts";
import { fmtDateTime, fmtKg, fmtMdl } from "@/lib/format";
import { errorMessage, supabaseBrowser } from "@/lib/supabase";
import { BODY_SPECS } from "@/lib/vehicle-catalog";
import NewRequestForm from "./NewRequestForm";

type Row = FreightRequest & { company_name?: string };

const STATUS: Record<RequestStatus, { t: string; c: string }> = {
  OPEN: { t: "Deschisă", c: "badge-accent" },
  BOOKED: { t: "Contractată", c: "badge-ok" },
  IN_TRANSIT: { t: "În drum", c: "badge-accent" },
  DELIVERED: { t: "Livrată", c: "badge-ok" },
  CANCELLED: { t: "Anulată", c: "" },
};

interface Group {
  shipment_ids: string[];
  pallets_total: number;
  individual_km: number;
  consolidated_km: number;
  savings_pct: number;
}

export default function RequestsScreen({ companyId, canShip, canCarry, verified, homeDistrict }: {
  companyId: string; canShip: boolean; canCarry: boolean; verified: boolean; homeDistrict: string | null;
}) {
  const [tab, setTab] = useState<"mine" | "market">(canShip ? "mine" : "market");
  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="t-title">{canShip && !canCarry ? "Comenzile mele" : canCarry && !canShip ? "Bursa de marfă" : "Cereri de transport"}</h1>
          <p className="t-small">
            {tab === "mine" ? "Postează ce ai de transportat; transportatorii verificați îți trimit oferte." : "Cererile deschise ale expeditorilor verificați. Grupajele sunt calculate cu DBSCAN pe coridoare comune."}
          </p>
        </div>
        {canShip && canCarry && (
          <div className="flex rounded-md border border-line p-0.5 text-[13px]" role="tablist">
            {(["mine", "market"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`rounded px-3 py-1 ${tab === t ? "bg-accent-soft font-medium text-accent-strong" : "text-ink-2"}`}>
                {t === "mine" ? "Cererile mele" : "Bursa"}
              </button>
            ))}
          </div>
        )}
      </header>
      {tab === "mine" ? <MyRequests companyId={companyId} homeDistrict={homeDistrict} /> : <Market companyId={companyId} verified={verified} />}
    </main>
  );
}

// ─── Expeditor: cererile proprii ──────────────────────────────────────────
function MyRequests({ companyId, homeDistrict }: { companyId: string; homeDistrict: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [offers, setOffers] = useState<Record<string, number>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true;
    const supabase = supabaseBrowser();
    Promise.all([
      supabase.from("freight_requests").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(200),
      supabase.from("bookings").select("request_id, status").eq("shipper_company_id", companyId).not("request_id", "is", null),
    ]).then(([{ data, error: e }, { data: b }]) => {
      if (!active) return;
      if (e) return setError(errorMessage(e));
      setRows((data ?? []) as Row[]);
      const counts: Record<string, number> = {};
      for (const x of (b ?? []) as Pick<Booking, "request_id" | "status">[]) {
        if (x.request_id && ["NEGOTIATING", "AGREED"].includes(x.status)) counts[x.request_id] = (counts[x.request_id] ?? 0) + 1;
      }
      setOffers(counts);
    });
    return () => {
      active = false;
    };
  }, [companyId, version]);

  const cancel = async (id: string) => {
    if (!confirm("Anulezi cererea? Negocierile deschise se închid.")) return;
    const { error: e } = await supabaseBrowser().rpc("cancel_request", { p_request: id });
    if (e) setError(errorMessage(e));
    else load();
  };

  return (
    <>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <div className="card overflow-hidden">
        {rows === null ? <p className="p-6 t-small">Se încarcă…</p> : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h2 className="t-subtitle">Nicio cerere încă</h2>
            <p className="t-small mx-auto mt-1 max-w-md">Nu ai mașini? Publică o cerere cu locul de preluare, destinația, numărul de paleți și vehiculele de care ai nevoie. Poți căuta și direct pe hartă camioane cu locuri libere.</p>
            <button type="button" className="btn btn-primary mt-4" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Cerere nouă</button>
          </div>
        ) : (
          <table className="table">
            <thead><tr><th>Traseu</th><th>Marfă</th><th>Vehicule</th><th>Interval</th><th>Stare</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{districtName(r.origin_district_id)} → {districtName(r.destination_district_id)}</div>
                    <div className="t-small">{[r.origin_address, r.destination_address].filter(Boolean).join(" → ") || "—"}</div>
                  </td>
                  <td className="t-num">{r.pallets} pal. · {fmtKg(r.weight_kg)}<div className="t-small">{r.cargo_description ?? ""}</div></td>
                  <td>{r.vehicles_needed} × {r.body_type ? BODY_SPECS[r.body_type].short : "oricare"}{r.needs_reefer ? " · frigo" : ""}</td>
                  <td className="text-xs">{fmtDateTime(r.ready_from)}<br />până {fmtDateTime(r.deliver_by)}</td>
                  <td>
                    <span className={`badge ${STATUS[r.status].c}`}>{STATUS[r.status].t}</span>
                    {offers[r.id] ? <div className="mt-1"><Link href="/bookings" className="text-xs text-accent hover:underline">{offers[r.id]} oferte</Link></div> : null}
                  </td>
                  <td className="text-right">
                    {r.status === "OPEN" && (
                      <div className="flex justify-end gap-1">
                        <Link className="btn btn-secondary btn-sm" href={`/map`}>Caută pe hartă</Link>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(r.id)}>Anulează</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button type="button" onClick={() => setFormOpen(true)} aria-label="Cerere nouă" title="Cerere nouă"
        className="fixed bottom-8 right-8 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-lg ring-4 ring-white hover:bg-accent-strong">
        <Plus className="h-8 w-8" strokeWidth={2} />
      </button>
      {formOpen && <NewRequestForm companyId={companyId} homeDistrict={homeDistrict} onClose={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); load(); }} />}
    </>
  );
}

// ─── Transportator: bursa + grupaje ───────────────────────────────────────
function Market({ companyId, verified }: { companyId: string; verified: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupNote, setGroupNote] = useState<string | null>(null);
  const [offerFor, setOfferFor] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!verified) return;
    supabaseBrowser().from("freight_requests_geo").select("*").eq("status", "OPEN").neq("company_id", companyId)
      .gte("deliver_by", new Date().toISOString()).order("ready_from").limit(300)
      .then(({ data, error: e }) => (e ? setError(errorMessage(e)) : setRows((data ?? []) as Row[])));
    fetch("/api/grouping").then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (res.ok) setGroups(body.groups ?? []);
      else setGroupNote(body.error ?? "Gruparea nu e disponibilă.");
    }).catch(() => setGroupNote("Gruparea nu e disponibilă."));
  }, [companyId, verified]);

  if (!verified) {
    return <div className="alert alert-warn">Bursa e disponibilă după verificarea firmei (KYC). <Link href="/account" className="underline">Vezi starea</Link></div>;
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));

  return (
    <div className="space-y-5">
      {error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <div className="border-b border-line px-4 py-3">
          <h2 className="t-subtitle">Grupaje sugerate</h2>
          <p className="t-small">Cereri cu preluare și livrare apropiate (≤ 15 km) și ferestre de timp compatibile, care încap împreună într-un camion.</p>
        </div>
        {groupNote && <p className="px-4 py-3 t-small">{groupNote}</p>}
        {groups?.length === 0 && <p className="px-4 py-3 t-small">Nicio combinație profitabilă acum.</p>}
        <ul>
          {groups?.map((g, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="text-[13px]">
                {g.shipment_ids.map((id) => byId.get(id)).filter(Boolean).map((r) => (
                  <div key={r!.id}>{districtName(r!.origin_district_id)} → {districtName(r!.destination_district_id)} · {r!.pallets} pal. · {r!.company_name}</div>
                ))}
              </div>
              <div className="text-right">
                <div className="t-num text-[13px] font-semibold">{g.pallets_total} paleți împreună</div>
                <div className="t-small">{g.consolidated_km} km în loc de {g.individual_km} km · −{g.savings_pct}%</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h2 className="t-subtitle">Cereri deschise</h2></div>
        {rows === null ? <p className="p-4 t-small">Se încarcă…</p> : rows.length === 0 ? <p className="p-4 t-small">Nicio cerere deschisă acum.</p> : (
          <table className="table">
            <thead><tr><th>Traseu</th><th>Marfă</th><th>Vehicul cerut</th><th>Interval</th><th>Buget</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><div className="font-medium">{districtName(r.origin_district_id)} → {districtName(r.destination_district_id)}</div><div className="t-small">{r.company_name}</div></td>
                  <td className="t-num">{r.pallets} pal. · {fmtKg(r.weight_kg)}<div className="t-small">{r.cargo_description ?? ""}</div></td>
                  <td>{r.vehicles_needed} × {r.body_type ? BODY_SPECS[r.body_type].short : "oricare"}{r.needs_reefer ? " · frigo" : ""}</td>
                  <td className="text-xs">{fmtDateTime(r.ready_from)}<br />până {fmtDateTime(r.deliver_by)}</td>
                  <td>{fmtMdl(r.budget_mdl)}</td>
                  <td className="text-right"><button type="button" className="btn btn-primary btn-sm" onClick={() => setOfferFor(r)}>Fă ofertă</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {offerFor && <OfferDialog request={offerFor} companyId={companyId} onClose={() => setOfferFor(null)} />}
    </div>
  );
}

function OfferDialog({ request, companyId, onClose }: { request: Row; companyId: string; onClose: () => void }) {
  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [price, setPrice] = useState(request.budget_mdl ? String(request.budget_mdl) : "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    supabaseBrowser().from("vehicles_map").select("*").eq("company_id", companyId).gte("free_pallets", request.pallets).order("plate")
      .then(({ data }) => {
        const list = ((data ?? []) as MapVehicle[]).filter((v) => !request.body_type || v.body_type === request.body_type)
          .filter((v) => !request.needs_reefer || v.has_reefer);
        setVehicles(list);
        setVehicleId(list[0]?.id ?? "");
      });
  }, [companyId, request]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return setError("Nu ai un vehicul potrivit cu destule locuri libere.");
    const p = price.trim() ? Number(price) : null;
    if (p !== null && (!Number.isFinite(p) || p < 0)) return setError("Preț invalid.");
    setPending(true);
    const { data, error: e2 } = await supabaseBrowser().rpc("propose_booking", {
      p_vehicle: vehicleId, p_pallets: request.pallets, p_weight_kg: request.weight_kg,
      p_pickup: request.origin_district_id, p_dropoff: request.destination_district_id,
      p_pickup_at: request.ready_from, p_price: p, p_request: request.id, p_message: message.trim() || null,
    });
    setPending(false);
    if (e2) return setError(errorMessage(e2));
    setDone(data as string);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="card w-full max-w-md space-y-3 p-5 shadow-xl">
        <h2 className="t-subtitle">Ofertă: {districtName(request.origin_district_id)} → {districtName(request.destination_district_id)}</h2>
        <p className="t-small">{request.pallets} paleți · {fmtKg(request.weight_kg)} · {request.company_name}</p>
        {error && <div className="alert alert-error">{error}</div>}
        {done ? (
          <div className="alert alert-info">Oferta a fost trimisă. <Link href={`/bookings/${done}`} className="underline">Deschide negocierea</Link></div>
        ) : (
          <>
            <label className="field"><span className="t-label">Vehicul</span>
              <select className="select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                {vehicles.length === 0 && <option value="">Niciun vehicul potrivit</option>}
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.make_model} · {v.free_pallets} libere</option>)}
              </select>
            </label>
            <label className="field"><span className="t-label">Preț (MDL)</span>
              <input className="input t-num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} placeholder="gol = preț/km × distanță" />
            </label>
            <label className="field"><span className="t-label">Mesaj</span>
              <textarea className="textarea" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Închide</button>
          {!done && <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Se trimite…" : "Trimite oferta"}</button>}
        </div>
      </form>
    </div>
  );
}
