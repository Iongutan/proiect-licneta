"use client";

import { ArrowLeft, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import TruckCargo2D from "@/components/logistics/TruckCargo2D";
import VehicleSide from "@/components/logistics/VehicleBlueprintSVG";
import type { Booking, MapVehicle, Ownership, PalletFormat, VehicleLoad } from "@/lib/db-types";
import { DISTRICTS, districtById, districtName } from "@/lib/districts";
import { fmtDate, fmtDateTime, fmtKg, toLocalInput } from "@/lib/format";
import {
  PALLET_SPECS, findFreeSpot, layoutTotals, validateLayout, type Floor, type Pallet,
} from "@/lib/pallet-positioning";
import { errorMessage, dbBrowser } from "@/lib/db-browser";
import { BODY_SPECS, MODE_LABEL, OWNERSHIP_LABEL } from "@/lib/vehicle-catalog";
import DistrictAreaPicker from "./DistrictAreaPicker";
import { STATUS_LABEL } from "./FleetList";

const toPallet = (l: VehicleLoad): Pallet => ({
  id: l.id, x: l.x_cm, y: l.y_cm, length: l.length_cm, width: l.width_cm,
  format: l.format, weightKg: l.weight_kg, bookingId: l.booking_id, label: l.label,
});

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

export default function VehicleDetail({ vehicleId, companyId, isCompanyAdmin }: { vehicleId: string; companyId: string; isCompanyAdmin: boolean }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<MapVehicle | null>(null);
  const [saved, setSaved] = useState<Pallet[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [contracts, setContracts] = useState<Booking[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Unealta de adăugare
  const [format, setFormat] = useState<PalletFormat>("EUR");
  const [custom, setCustom] = useState({ length: 120, width: 120 });
  const [weight, setWeight] = useState(500);
  const [forBooking, setForBooking] = useState<string>("");

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    const db = dbBrowser();
    Promise.all([
      db.from("vehicles_map").select("*").eq("id", vehicleId).maybeSingle(),
      db.from("vehicle_loads").select("*").eq("vehicle_id", vehicleId).order("x_cm").order("y_cm"),
      db.from("bookings").select("*").eq("vehicle_id", vehicleId).in("status", ["CONTRACTED", "IN_TRANSIT"]),
    ]).then(([{ data: v, error }, { data: rows }, { data: bookings }]) => {
      if (!active) return;
      if (error) return setMessage({ kind: "error", text: errorMessage(error) });
      setVehicle((v as MapVehicle) ?? null);
      const ps = ((rows ?? []) as VehicleLoad[]).map(toPallet);
      setSaved(ps);
      setPallets(ps);
      setContracts((bookings ?? []) as Booking[]);
    });
    return () => {
      active = false;
    };
  }, [vehicleId, version]);

  const floor: Floor | null = useMemo(() => vehicle && {
    bodyType: vehicle.body_type, lengthCm: vehicle.cargo_length_cm, widthCm: vehicle.cargo_width_cm,
    maxPayloadKg: vehicle.max_payload_kg, palletCapacity: vehicle.pallet_capacity,
  }, [vehicle]);

  if (vehicle === null) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-6">
        <Link href="/fleet" className="btn btn-ghost btn-sm mb-3"><ArrowLeft className="h-4 w-4" /> Flota</Link>
        {message ? <div className="alert alert-error">{message.text}</div> : <p className="t-small">Se încarcă…</p>}
      </main>
    );
  }
  if (!floor) return null;

  const owner = vehicle.company_id === companyId;
  const spec = BODY_SPECS[vehicle.body_type];
  const dirty = JSON.stringify(pallets) !== JSON.stringify(saved);
  const totals = layoutTotals(pallets, floor, vehicle.booked_pallets, vehicle.booked_weight_kg);
  const layoutError = validateLayout(pallets, floor, vehicle.booked_pallets, vehicle.booked_weight_kg);
  const selected = pallets.find((p) => p.id === selectedId) ?? null;
  const flash = (kind: "error" | "info", text: string) => setMessage({ kind, text });

  const dims = () => (format === "CUSTOM" ? { length: custom.length, width: custom.width } : { length: PALLET_SPECS[format].lengthCm, width: PALLET_SPECS[format].widthCm });

  const addAt = (x?: number, y?: number) => {
    const { length, width } = dims();
    const spot = x === undefined || y === undefined
      ? findFreeSpot(pallets, floor, length, width)
      : { x: Math.max(0, Math.min(x - length / 2, floor.lengthCm - length)), y: Math.max(0, Math.min(y - width / 2, floor.widthCm - width)), length, width };
    if (!spot) return flash("error", "Nu mai e loc liber pentru acest palet.");
    const candidate: Pallet = { id: newId(), ...spot, format, weightKg: weight, bookingId: forBooking || null };
    const err = validateLayout([...pallets, candidate], floor, vehicle.booked_pallets, vehicle.booked_weight_kg);
    if (err && !err.startsWith("Capacitate") && !err.startsWith("Sarcină")) return flash("error", err.replace(/^Paletul #\d+: /, ""));
    setPallets([...pallets, candidate]);
    setSelectedId(candidate.id);
    setMessage(err ? { kind: "error", text: err } : null);
  };

  const fill = () => {
    const { length, width } = dims();
    const next = [...pallets];
    const room = floor.palletCapacity - vehicle.booked_pallets;
    while (next.filter((p) => !p.bookingId).length < room) {
      const spot = findFreeSpot(next, floor, length, width);
      if (!spot) break;
      next.push({ id: newId(), ...spot, format, weightKg: weight, bookingId: null });
    }
    setPallets(next);
  };

  const save = async () => {
    if (layoutError) return flash("error", layoutError);
    setSaving(true);
    const { error } = await dbBrowser().rpc("save_vehicle_layout", {
      p_vehicle: vehicle.id,
      p_items: pallets.map((p) => ({
        x_cm: Math.round(p.x), y_cm: Math.round(p.y), length_cm: Math.round(p.length), width_cm: Math.round(p.width),
        format: p.format, weight_kg: Math.round(p.weightKg), booking_id: p.bookingId ?? null, label: p.label ?? null,
      })),
    });
    setSaving(false);
    if (error) return flash("error", errorMessage(error));
    flash("info", "Planul de încărcare a fost salvat. Locurile libere s-au actualizat în bursă.");
    load();
  };

  const updateSelected = (patch: Partial<Pallet>) => setPallets((ps) => ps.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/fleet" className="btn btn-ghost btn-sm -ml-2 mb-1"><ArrowLeft className="h-4 w-4" /> Flota</Link>
          <div className="flex items-center gap-3">
            <span className="kbd-plate text-sm">{vehicle.plate}</span>
            <h1 className="t-title">{vehicle.make_model}</h1>
            <span className={`badge ${STATUS_LABEL[vehicle.status].cls}`}>{STATUS_LABEL[vehicle.status].text}</span>
          </div>
          <p className="t-small mt-1">
            {spec.label} ({MODE_LABEL[spec.mode].toLowerCase()}) · {vehicle.cargo_length_cm}×{vehicle.cargo_width_cm}×{vehicle.cargo_height_cm} cm · {fmtKg(vehicle.max_payload_kg)} · {vehicle.company_name}
            {vehicle.ownership !== "OWNED" && ` · ${OWNERSHIP_LABEL[vehicle.ownership].toLowerCase()}${vehicle.ownership_until ? ` până la ${fmtDate(vehicle.ownership_until)}` : ""}`}
          </p>
        </div>
        {owner && <VehicleSettings vehicle={vehicle} onChanged={load} onDeleted={() => router.replace("/fleet")} />}
      </div>

      {message && <div className={`alert ${message.kind === "error" ? "alert-error" : "alert-info"}`} role="status">{message.text}</div>}

      <section className="card p-4">
        <VehicleSide
          type={vehicle.body_type} cargoLengthCm={vehicle.cargo_length_cm} cargoWidthCm={vehicle.cargo_width_cm}
          pallets={spec.loadMode === "FLOOR" ? pallets.map((p) => ({ xCm: p.x, lengthCm: p.length, yCm: p.y, reserved: Boolean(p.bookingId) })) : undefined}
          occupied={vehicle.occupied_pallets + vehicle.booked_pallets}
          className="mx-auto h-28 w-full max-w-3xl"
          title={`Vedere laterală ${vehicle.plate}`}
        />
      </section>

      {spec.loadMode === "NONE" ? (
        <section className="card p-4 t-small">Trailele transportă utilaje, fără plan de paleți. Capacitatea se negociază per cursă.</section>
      ) : spec.loadMode === "COUNT" ? (
        <OccupancyPanel vehicle={vehicle} readOnly={!owner} onChanged={load} />
      ) : (
        <section className="card">
          <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
            <div className="field">
              <label className="t-label" htmlFor="fmt">Palet</label>
              <select id="fmt" className="select w-44" value={format} onChange={(e) => setFormat(e.target.value as PalletFormat)} disabled={!owner}>
                <option value="EUR">{PALLET_SPECS.EUR.label}</option>
                <option value="INDUSTRIAL">{PALLET_SPECS.INDUSTRIAL.label}</option>
                <option value="CUSTOM">Dimensiuni proprii</option>
              </select>
            </div>
            {format === "CUSTOM" && (
              <>
                <NumberField label="Lungime (cm)" value={custom.length} onChange={(v) => setCustom({ ...custom, length: v })} min={40} max={400} />
                <NumberField label="Lățime (cm)" value={custom.width} onChange={(v) => setCustom({ ...custom, width: v })} min={40} max={260} />
              </>
            )}
            <NumberField label="Greutate (kg)" value={weight} onChange={setWeight} min={1} max={2500} />
            {contracts.length > 0 && (
              <div className="field">
                <label className="t-label" htmlFor="for-booking">Marfă</label>
                <select id="for-booking" className="select w-56" value={forBooking} onChange={(e) => setForBooking(e.target.value)}>
                  <option value="">proprie (ocupă loc)</option>
                  {contracts.map((b) => <option key={b.id} value={b.id}>rezervată: contract {b.id.slice(0, 8)} ({b.pallets} pal.)</option>)}
                </select>
              </div>
            )}
            {owner && (
              <div className="ml-auto flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => addAt()}>Adaugă palet</button>
                <button type="button" className="btn btn-secondary" onClick={fill}>Umple locurile</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setPallets(pallets.filter((p) => p.bookingId)); setSelectedId(null); }}>Golește</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setPallets(saved); setSelectedId(null); }} disabled={!dirty}>Renunță</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving || Boolean(layoutError)}>{saving ? "Se salvează…" : "Salvează planul"}</button>
              </div>
            )}
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_260px]">
            <div>
              <TruckCargo2D
                floor={floor}
                pallets={pallets}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={owner ? setPallets : undefined}
                onFloorClick={owner ? (x, y) => addAt(x, y) : undefined}
                onReject={(reason) => flash("error", reason)}
                readOnly={!owner}
                className="w-full rounded-md border border-line bg-surface"
              />
              {owner && <p className="t-small mt-2">Clic pe podea = palet nou acolo · trage pentru mutare (pas 5 cm) · săgeți = mutare fină (Shift: 1 cm) · R = rotire · Delete = scoatere.</p>}
            </div>

            <aside className="space-y-4">
              <Stats
                rows={[
                  ["Paleți proprii", `${totals.ownPallets}`],
                  ["Rezervați prin contract", `${vehicle.booked_pallets}`],
                  ["Locuri libere", `${Math.max(0, floor.palletCapacity - totals.ownPallets - vehicle.booked_pallets)} / ${floor.palletCapacity}`],
                ]}
              />
              <div>
                <div className="flex justify-between text-xs"><span className="t-label">Sarcină</span><span className="t-num">{fmtKg(totals.totalWeightKg)} / {fmtKg(floor.maxPayloadKg)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-line" role="meter" aria-valuemin={0} aria-valuemax={floor.maxPayloadKg} aria-valuenow={totals.totalWeightKg} aria-label="Sarcină">
                  <div className={`h-full ${totals.isOverweight ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.min(100, (totals.totalWeightKg / floor.maxPayloadKg) * 100)}%` }} />
                </div>
                {totals.isOverweight && <p className="field-error mt-1">Sarcina maximă e depășită.</p>}
              </div>
              {layoutError && !totals.isOverweight && <p className="field-error">{layoutError}</p>}

              {selected && owner ? (
                <div className="space-y-3 rounded-md border border-line p-3">
                  <div className="flex items-center justify-between">
                    <span className="t-label">Palet #{pallets.indexOf(selected) + 1}</span>
                    <span className="t-small t-num">x {selected.x} · y {selected.y} cm</span>
                  </div>
                  <NumberField label="Greutate (kg)" value={selected.weightKg} onChange={(v) => updateSelected({ weightKg: v })} min={1} max={2500} />
                  <div className="field">
                    <label className="t-label" htmlFor="pal-label">Etichetă</label>
                    <input id="pal-label" className="input" maxLength={60} value={selected.label ?? ""} onChange={(e) => updateSelected({ label: e.target.value })} placeholder="ex. vin, fragil" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      const rotated = { ...selected, length: selected.width, width: selected.length };
                      const err = validateLayout(pallets.map((p) => (p.id === selected.id ? rotated : p)), floor);
                      if (err && /suprapune|iese|cuplaj/.test(err)) return flash("error", err.replace(/^Paletul #\d+: /, ""));
                      updateSelected({ length: selected.width, width: selected.length });
                    }}><RotateCw className="h-3.5 w-3.5" /> Rotește</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => { setPallets(pallets.filter((p) => p.id !== selected.id)); setSelectedId(null); }}>
                      <Trash2 className="h-3.5 w-3.5" /> Scoate
                    </button>
                  </div>
                </div>
              ) : (
                <p className="t-small">Selectează un palet pentru a-i schimba greutatea sau eticheta.</p>
              )}
            </aside>
          </div>
        </section>
      )}

      {owner && spec.needsArea && <AreaPanel vehicle={vehicle} onChanged={load} />}
      {owner && !spec.needsArea && <TripPlanner vehicle={vehicle} onChanged={load} />}
      {owner && <GpsPanel vehicle={vehicle} canIssue={isCompanyAdmin} onChanged={load} />}
    </main>
  );
}

function Stats({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="space-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="t-num font-medium">{v}</dd></div>
      ))}
    </dl>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const id = `nf-${label.replace(/\W+/g, "")}`;
  return (
    <div className="field">
      <label className="t-label" htmlFor={id}>{label}</label>
      <input id={id} type="number" className="input t-num w-28" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || min))))} />
    </div>
  );
}

// ─── Setări: stare, listare în bursă, preț, ștergere ──────────────────────
function VehicleSettings({ vehicle, onChanged, onDeleted }: { vehicle: MapVehicle; onChanged: () => void; onDeleted: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const update = async (patch: Record<string, unknown>) => {
    const { error: e } = await dbBrowser().from("vehicles").update(patch).eq("id", vehicle.id);
    if (e) setError(errorMessage(e));
    else onChanged();
  };
  const remove = async () => {
    if (!confirm(`Ștergi definitiv ${BODY_SPECS[vehicle.body_type].short.toLowerCase()} ${vehicle.plate} din flotă?`)) return;
    const { error: e, count } = await dbBrowser().from("vehicles").delete({ count: "exact" }).eq("id", vehicle.id);
    if (e || !count) setError(e ? errorMessage(e) : "Unitatea are rezervări active și nu poate fi ștearsă.");
    else onDeleted();
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select className="select w-36" value={vehicle.status} onChange={(e) => update({ status: e.target.value })} aria-label="Starea unității">
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
        </select>
        <select className="select w-32" value={vehicle.ownership} aria-label="Deținere"
          onChange={(e) => update(e.target.value === "OWNED" ? { ownership: "OWNED", ownership_until: null } : { ownership: e.target.value as Ownership })}>
          {Object.entries(OWNERSHIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {vehicle.ownership !== "OWNED" && (
          <input type="date" className="input w-40" aria-label="Deținut până la" value={vehicle.ownership_until ?? ""}
            onChange={(e) => update({ ownership_until: e.target.value || null })} />
        )}
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" className="accent-[var(--color-accent)]" checked={vehicle.is_listed} onChange={(e) => update({ is_listed: e.target.checked })} />
          În bursă
        </label>
        <button type="button" className="btn btn-danger btn-sm" onClick={remove}>Șterge</button>
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

// ─── Cursa planificată (pentru potrivirea în tranzit, K4) ─────────────────
function TripPlanner({ vehicle, onChanged }: { vehicle: MapVehicle; onChanged: () => void }) {
  const [origin, setOrigin] = useState(vehicle.trip_origin_id ?? vehicle.district_id ?? "");
  const [destination, setDestination] = useState(vehicle.trip_destination_id ?? "");
  const [departure, setDeparture] = useState(() => toLocalInput(vehicle.trip_departure_at ? new Date(vehicle.trip_departure_at) : new Date(Date.now() + 3600_000)));
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const sorted = useMemo(() => [...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro")), []);

  const save = async () => {
    const o = districtById(origin);
    const d = districtById(destination);
    if (!o || !d || o.id === d.id) return setStatus({ kind: "error", text: "Alege două raioane diferite." });
    setPending(true);
    setStatus(null);
    let route: { geometry: unknown; distanceKm: number; durationMin: number } | null = null;
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: { lat: o.lat, lon: o.lon }, to: { lat: d.lat, lon: d.lon } }),
      });
      if (res.ok) route = await res.json();
    } catch {
      // Fără OSRM: baza de date folosește linia dreaptă între raioane.
    }
    const { error } = await dbBrowser().rpc("set_vehicle_trip", {
      p_vehicle: vehicle.id, p_origin: o.id, p_destination: d.id, p_departure: new Date(departure).toISOString(),
      p_route: route?.geometry ?? null, p_distance_km: route?.distanceKm ?? null, p_duration_min: route?.durationMin ?? null,
    });
    setPending(false);
    if (error) return setStatus({ kind: "error", text: errorMessage(error) });
    setStatus({ kind: "info", text: route ? `Traseu salvat: ${route.distanceKm} km, ~${route.durationMin} min.` : "Traseu salvat (estimare în linie dreaptă — OSRM nu rulează)." });
    onChanged();
  };

  const clear = async () => {
    const { error } = await dbBrowser().rpc("clear_vehicle_trip", { p_vehicle: vehicle.id });
    if (error) setStatus({ kind: "error", text: errorMessage(error) });
    else onChanged();
  };

  return (
    <section className="card p-4">
      <h2 className="t-subtitle">Cursa planificată</h2>
      <p className="t-small mb-3">Expeditorii găsesc vehiculul și când caută un segment de pe traseu (ex. Chișinău → Orhei pe o cursă Chișinău → Rezina), cu ora estimată de trecere.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="field">
          <label className="t-label" htmlFor="trip-o">Plecare</label>
          <select id="trip-o" className="select w-44" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">—</option>{sorted.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="t-label" htmlFor="trip-d">Destinație</label>
          <select id="trip-d" className="select w-44" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">—</option>{sorted.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="t-label" htmlFor="trip-t">Ora plecării</label>
          <input id="trip-t" type="datetime-local" className="input w-52" value={departure} onChange={(e) => setDeparture(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Se calculează traseul…" : "Salvează cursa"}</button>
        {vehicle.trip_origin_id && <button type="button" className="btn btn-ghost" onClick={clear}>Fără cursă</button>}
      </div>
      {vehicle.trip_origin_id && (
        <p className="mt-3 text-[13px]">
          Acum: <strong>{districtName(vehicle.trip_origin_id)} → {districtName(vehicle.trip_destination_id)}</strong>, plecare {fmtDateTime(vehicle.trip_departure_at)}
          {vehicle.trip_distance_km ? ` · ${vehicle.trip_distance_km} km` : ""}{vehicle.trip_duration_min ? ` · ~${Math.round(vehicle.trip_duration_min / 6) / 10} h` : ""}
        </p>
      )}
      {status && <div className={`alert mt-3 ${status.kind === "error" ? "alert-error" : "alert-info"}`}>{status.text}</div>}
    </section>
  );
}

// ─── GPS: token de dispozitiv + poziție manuală ───────────────────────────
function GpsPanel({ vehicle, canIssue, onChanged }: { vehicle: MapVehicle; canIssue: boolean; onChanged: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(vehicle.district_id ?? "");

  const issue = async () => {
    if (!confirm("Un token nou îl invalidează pe cel vechi. Continui?")) return;
    const { data, error: e } = await dbBrowser().rpc("issue_device_token", { p_vehicle: vehicle.id });
    if (e) setError(errorMessage(e));
    else setToken(data as string);
  };

  const setManualPosition = async () => {
    const d = districtById(manual);
    if (!d) return;
    const { error: e } = await dbBrowser().from("vehicles").update({
      position: `SRID=4326;POINT(${d.lon} ${d.lat})`, district_id: d.id, position_at: new Date().toISOString(), speed_kmh: 0,
    }).eq("id", vehicle.id);
    if (e) setError(errorMessage(e));
    else onChanged();
  };

  return (
    <section className="card p-4">
      <h2 className="t-subtitle">GPS</h2>
      <p className="t-small mb-3">
        Ultima poziție: {vehicle.position_at ? `${fmtDateTime(vehicle.position_at)}, ${districtName(vehicle.district_id)}` : "niciuna"}
        {vehicle.gps_device_id ? ` · tracker ${vehicle.gps_device_id}` : ""}
      </p>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="t-label mb-1">Tracker automat</div>
          {canIssue ? <button type="button" className="btn btn-secondary" onClick={issue}>Generează token de conectare</button> : <p className="t-small">Doar administratorul firmei poate genera tokenul.</p>}
        </div>
        <div className="flex items-end gap-2">
          <div className="field">
            <label className="t-label" htmlFor="manual-pos">Poziție manuală</label>
            <select id="manual-pos" className="select w-44" value={manual} onChange={(e) => setManual(e.target.value)}>
              {[...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro")).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-secondary" onClick={setManualPosition}>Setează</button>
        </div>
      </div>
      {token && (
        <div className="alert alert-warn mt-4 space-y-2">
          <p><strong>Copiază tokenul acum — nu va mai fi afișat.</strong> Trackerul (sau aplicația șoferului) trimite poziția la:</p>
          <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-[11px] text-ink">{`POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/telemetry
Authorization: Bearer ${token}
Content-Type: application/json

{"lat": 47.0105, "lon": 28.8638, "speed_kmh": 62, "heading": 90}`}</pre>
        </div>
      )}
    </section>
  );
}

// ─── Vagon / dronă: locuri ocupate declarate în bloc (fără plan de podea) ──
function OccupancyPanel({ vehicle, readOnly, onChanged }: { vehicle: MapVehicle; readOnly: boolean; onChanged: () => void }) {
  const spec = BODY_SPECS[vehicle.body_type];
  const room = vehicle.pallet_capacity - vehicle.booked_pallets;
  const [places, setPlaces] = useState(vehicle.occupied_pallets);
  const [weight, setWeight] = useState(vehicle.occupied_weight_kg);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const dirty = places !== vehicle.occupied_pallets || weight !== vehicle.occupied_weight_kg;
  const clamp = (v: number) => Math.max(0, Math.min(room, Math.round(v) || 0));
  const overweight = weight + vehicle.booked_weight_kg > vehicle.max_payload_kg;
  const free = Math.max(0, room - places);

  const save = async () => {
    setPending(true);
    setStatus(null);
    const { error } = await dbBrowser().rpc("set_vehicle_occupancy", { p_vehicle: vehicle.id, p_places: places, p_weight_kg: places ? weight : 0 });
    setPending(false);
    if (error) return setStatus({ kind: "error", text: errorMessage(error) });
    setStatus({ kind: "info", text: `Salvat: ${free} ${spec.placeUnit} libere apar acum în bursă.` });
    onChanged();
  };

  return (
    <section className="card p-4">
      <h2 className="t-subtitle">Locuri ocupate</h2>
      <p className="t-small mb-3">
        Declari câte {spec.placeUnit} sunt deja ocupate cu marfă proprie; restul apar libere în bursă. Locurile rezervate prin contract se adaugă automat.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="field">
          <label className="t-label" htmlFor="occ-places">Ocupate ({spec.placeUnit})</label>
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlaces(clamp(places - 1))} disabled={readOnly || places <= 0} aria-label="Unul mai puțin">−</button>
            <input id="occ-places" type="number" className="input t-num w-20 text-center" min={0} max={room} value={places} disabled={readOnly}
              onChange={(e) => setPlaces(clamp(Number(e.target.value)))} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlaces(clamp(places + 1))} disabled={readOnly || places >= room} aria-label="Unul în plus">+</button>
          </div>
        </div>
        <div className="field">
          <label className="t-label" htmlFor="occ-weight">Greutatea lor (kg)</label>
          <input id="occ-weight" type="number" className="input t-num w-32" min={0} max={vehicle.max_payload_kg} value={places ? weight : 0} disabled={readOnly || places === 0}
            onChange={(e) => setWeight(Math.max(0, Math.round(Number(e.target.value)) || 0))} aria-invalid={overweight} />
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => { setPlaces(0); setWeight(0); }}>Golește</button>
            <button type="button" className="btn btn-ghost" onClick={() => setPlaces(room)}>Plin</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || pending || overweight}>{pending ? "Se salvează…" : "Salvează"}</button>
          </div>
        )}
      </div>
      <div className="mt-4 max-w-xl">
        <div className="flex justify-between text-xs">
          <span className="t-label">Libere</span>
          <span className="t-num">{free} / {vehicle.pallet_capacity} {spec.placeUnit}{vehicle.booked_pallets > 0 ? ` · ${vehicle.booked_pallets} rezervate` : ""}</span>
        </div>
        <div className="mt-1 flex h-2 overflow-hidden rounded bg-line" role="meter" aria-label="Ocupare" aria-valuemin={0}
          aria-valuemax={vehicle.pallet_capacity} aria-valuenow={places + vehicle.booked_pallets}>
          <div className="h-full bg-accent" style={{ width: `${(places / Math.max(1, vehicle.pallet_capacity)) * 100}%` }} />
          <div className="h-full bg-[#93c5fd]" style={{ width: `${(vehicle.booked_pallets / Math.max(1, vehicle.pallet_capacity)) * 100}%` }} />
        </div>
        {overweight && <p className="field-error mt-1">Sarcina maximă ({fmtKg(vehicle.max_payload_kg)}) e depășită.</p>}
      </div>
      {status && <div className={`alert mt-3 ${status.kind === "error" ? "alert-error" : "alert-info"}`} role="status">{status.text}</div>}
    </section>
  );
}

// ─── Dronă: zona deservită (în loc de cursă A→B) ──────────────────────────
function AreaPanel({ vehicle, onChanged }: { vehicle: MapVehicle; onChanged: () => void }) {
  const [area, setArea] = useState<string[]>(vehicle.service_district_ids);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const dirty = area.join() !== vehicle.service_district_ids.join();

  const save = async () => {
    if (!area.length) return setStatus({ kind: "error", text: "Alege cel puțin un raion." });
    setPending(true);
    setStatus(null);
    const { error } = await dbBrowser().from("vehicles").update({ service_district_ids: area }).eq("id", vehicle.id);
    setPending(false);
    if (error) return setStatus({ kind: "error", text: errorMessage(error) });
    setStatus({ kind: "info", text: "Zona a fost salvată. Expeditorii din aceste raioane găsesc drona la căutare." });
    onChanged();
  };

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="t-subtitle">Zona deservită</h2>
          <p className="t-small">O căutare A → B găsește drona dacă ambele raioane sunt în zona ei.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || pending}>{pending ? "Se salvează…" : "Salvează zona"}</button>
      </div>
      <DistrictAreaPicker value={area} onChange={setArea} />
      {status && <div className={`alert mt-3 ${status.kind === "error" ? "alert-error" : "alert-info"}`} role="status">{status.text}</div>}
    </section>
  );
}
