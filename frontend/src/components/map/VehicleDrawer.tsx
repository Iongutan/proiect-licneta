"use client";

// K5 — detaliul vehiculului: stare, contract activ, grad de ocupare, planul de
// încărcare (live), cursa și ora de trecere. K8 — cererea de paleți pe vehicul.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TruckCargo2D from "@/components/logistics/TruckCargo2D";
import VehicleSide from "@/components/logistics/VehicleBlueprintSVG";
import type { Booking, FreightRequest, MapVehicle, TripMatch, VehicleLoad } from "@/lib/db-types";
import { DISTRICTS, districtById, districtName } from "@/lib/districts";
import { fmtDateTime, fmtKg, fmtMdl, fmtRelative, fmtTime, toLocalInput } from "@/lib/format";
import type { Floor } from "@/lib/pallet-positioning";
import type { SearchIntent } from "@/lib/search-intent";
import { errorMessage, dbBrowser } from "@/lib/db-browser";
import { BODY_SPECS } from "@/lib/vehicle-catalog";

interface Props {
  vehicle: MapVehicle;
  match: TripMatch | null;
  intent: SearchIntent | null;
  companyId: string | null;
  companyVerified: boolean;
  canShip: boolean;
}

function roadKm(a?: string | null, b?: string | null): number | null {
  const x = districtById(a);
  const y = districtById(b);
  if (!x || !y) return null;
  const R = 6371;
  const dLat = ((y.lat - x.lat) * Math.PI) / 180;
  const dLon = ((y.lon - x.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((x.lat * Math.PI) / 180) * Math.cos((y.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3);
}

export default function VehicleDrawer({ vehicle, match, intent, companyId, companyVerified, canShip }: Props) {
  const [loads, setLoads] = useState<VehicleLoad[]>([]);
  const [myContract, setMyContract] = useState<Booking | null>(null);

  useEffect(() => {
    const db = dbBrowser();
    let active = true;
    const fetchLoads = () =>
      db.from("vehicle_loads").select("*").eq("vehicle_id", vehicle.id)
        .then(({ data }) => active && setLoads((data ?? []) as VehicleLoad[]));
    fetchLoads();
    // Contractele vizibile sunt doar cele în care firma mea e parte (RLS).
    db.from("bookings").select("*").eq("vehicle_id", vehicle.id).in("status", ["CONTRACTED", "IN_TRANSIT"])
      .order("updated_at", { ascending: false }).limit(1)
      .then(({ data }) => active && setMyContract((data?.[0] as Booking) ?? null));

    const channel = db
      .channel(`loads:${vehicle.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicle_loads", filter: `vehicle_id=eq.${vehicle.id}` }, fetchLoads)
      .subscribe();
    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, [vehicle.id]);

  const floor: Floor = {
    bodyType: vehicle.body_type, lengthCm: vehicle.cargo_length_cm, widthCm: vehicle.cargo_width_cm,
    maxPayloadKg: vehicle.max_payload_kg, palletCapacity: vehicle.pallet_capacity,
  };
  const used = vehicle.pallet_capacity - vehicle.free_pallets;
  const pct = vehicle.pallet_capacity ? Math.round((used / vehicle.pallet_capacity) * 100) : 0;
  const status = vehicle.free_pallets <= 0 && vehicle.pallet_capacity > 0 ? { t: "Ocupat", c: "badge-warn" }
    : vehicle.status === "ON_ROUTE" ? { t: "În cursă", c: "badge-accent" } : { t: "Disponibil", c: "badge-ok" };
  const own = vehicle.company_id === companyId;
  const spec = BODY_SPECS[vehicle.body_type];

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="kbd-plate">{vehicle.plate}</span>
          <span className={`badge ${status.c}`}>{status.t}</span>
        </div>
        <h2 className="t-subtitle mt-2">{vehicle.make_model}</h2>
        <p className="t-small">{vehicle.company_name} · {spec.label}{vehicle.has_reefer ? " · frigorific" : ""}</p>
      </div>

      {myContract ? (
        <div className="alert alert-info">
          Contract activ cu firma ta, acceptat la {fmtDateTime(myContract.shipper_signed_at && myContract.carrier_signed_at
            ? (myContract.shipper_signed_at > myContract.carrier_signed_at ? myContract.shipper_signed_at : myContract.carrier_signed_at)
            : myContract.updated_at)}.{" "}
          <Link href={`/bookings/${myContract.id}`} className="underline">Deschide</Link>
        </div>
      ) : vehicle.booked_pallets > 0 ? (
        <p className="t-small">{vehicle.booked_pallets} {spec.placeUnit} rezervate prin contracte active.</p>
      ) : null}

      {vehicle.pallet_capacity > 0 && (
        <div>
          <div className="flex justify-between text-xs">
            <span className="t-label">Ocupare</span>
            <span className="t-num">{used} / {vehicle.pallet_capacity} {spec.placeUnit} · <strong className="text-accent-strong">{vehicle.free_pallets} libere</strong></span>
          </div>
          <div className="mt-1 flex h-2 overflow-hidden rounded bg-line" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Grad de ocupare">
            <div className="bg-accent" style={{ width: `${(vehicle.occupied_pallets / vehicle.pallet_capacity) * 100}%` }} />
            <div className="bg-[#93c5fd]" style={{ width: `${(vehicle.booked_pallets / vehicle.pallet_capacity) * 100}%` }} />
          </div>
          <div className="mt-1 t-small">{fmtKg(vehicle.occupied_weight_kg + vehicle.booked_weight_kg)} din {fmtKg(vehicle.max_payload_kg)}</div>
        </div>
      )}

      <div className="rounded-md border border-line p-2">
        <VehicleSide
          type={vehicle.body_type} cargoLengthCm={vehicle.cargo_length_cm} cargoWidthCm={vehicle.cargo_width_cm}
          pallets={spec.loadMode === "FLOOR" ? loads.map((l) => ({ xCm: l.x_cm, lengthCm: l.length_cm, yCm: l.y_cm, reserved: l.status === "RESERVED" })) : undefined}
          occupied={used}
          className="h-20 w-full"
        />
        {spec.loadMode === "FLOOR" && vehicle.pallet_capacity > 0 && (
          <TruckCargo2D
            floor={floor}
            pallets={loads.map((l) => ({ id: l.id, x: l.x_cm, y: l.y_cm, length: l.length_cm, width: l.width_cm, format: l.format, weightKg: l.weight_kg, bookingId: l.booking_id }))}
            selectedId={null}
            onSelect={() => undefined}
            readOnly
            className="mt-2 w-full"
          />
        )}
      </div>

      <dl className="space-y-1.5 text-[13px]">
        {spec.needsArea ? (
          <Row k="Zonă deservită" v={vehicle.service_district_ids.map(districtName).join(", ")} />
        ) : (
          <Row k="Cursă" v={vehicle.trip_origin_id ? `${districtName(vehicle.trip_origin_id)} → ${districtName(vehicle.trip_destination_id)}` : "fără cursă planificată"} />
        )}
        {vehicle.trip_departure_at && <Row k="Plecare" v={fmtDateTime(vehicle.trip_departure_at)} />}
        {match?.eta_origin && <Row k={`Trece prin ${intent?.origin?.name ?? "A"}`} v={`${fmtTime(match.eta_origin)} (${fmtRelative(match.eta_origin)})`} />}
        {match?.eta_destination && <Row k={`Ajunge la ${intent?.destination?.name ?? "B"}`} v={fmtTime(match.eta_destination)} />}
        <Row k="Acum" v={`${districtName(vehicle.district_id)}${vehicle.speed_kmh ? `, ${vehicle.speed_kmh} km/h` : ""}`} />
        <Row k="GPS" v={vehicle.position_at ? fmtDateTime(vehicle.position_at) : "fără semnal"} />
        <Row k="Tarif" v={vehicle.price_per_km ? `${vehicle.price_per_km} MDL/km` : "la negociere"} />
      </dl>

      {own ? (
        <Link href={`/fleet/${vehicle.id}`} className="btn btn-secondary w-full">Configurează unitatea</Link>
      ) : canShip && vehicle.pallet_capacity > 0 ? (
        <RequestPallets vehicle={vehicle} intent={intent} verified={companyVerified} companyId={companyId} />
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>;
}

// ─── K8: cerere de paleți pe acest vehicul ────────────────────────────────
function RequestPallets({ vehicle, intent, verified, companyId }: { vehicle: MapVehicle; intent: SearchIntent | null; verified: boolean; companyId: string | null }) {
  const [open, setOpen] = useState(false);
  const [pallets, setPallets] = useState(Math.min(Math.max(intent?.pallets ?? 1, 1), Math.max(vehicle.free_pallets, 1)));
  const [weight, setWeight] = useState(pallets * 500);
  const [pickup, setPickup] = useState(intent?.origin?.id ?? vehicle.trip_origin_id ?? vehicle.district_id ?? "");
  const [dropoff, setDropoff] = useState(intent?.destination?.id ?? vehicle.trip_destination_id ?? "");
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 2 * 3600_000)));
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");
  const [myRequests, setMyRequests] = useState<FreightRequest[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !companyId) return;
    dbBrowser().from("freight_requests").select("*").eq("company_id", companyId).eq("status", "OPEN").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setMyRequests((data ?? []) as FreightRequest[]));
  }, [open, companyId]);

  const km = roadKm(pickup, dropoff);
  const estimate = useMemo(() => {
    if (!vehicle.price_per_km || !km) return null;
    const share = Math.min(1, pallets / Math.max(vehicle.pallet_capacity, 1) + 0.25);
    return Math.max(Math.round(vehicle.price_per_km * km * share), 300);
  }, [vehicle.price_per_km, vehicle.pallet_capacity, km, pallets]);

  if (!verified) {
    return <div className="alert alert-warn">Poți cere paleți după ce firma ta e verificată. <Link href="/account" className="underline">Detalii</Link></div>;
  }
  if (done) {
    return <div className="alert alert-info">Cererea a fost trimisă; transportatorul a primit o notificare. <Link href={`/bookings/${done}`} className="underline">Deschide negocierea</Link></div>;
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(true)} disabled={vehicle.free_pallets <= 0}>
        {vehicle.free_pallets > 0 ? "Cere locuri" : "Nu mai are locuri libere"}
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pallets < 1 || pallets > vehicle.free_pallets) return setError(`Între 1 și ${vehicle.free_pallets} ${BODY_SPECS[vehicle.body_type].placeUnit}.`);
    if (!pickup || !dropoff) return setError("Alege locul de preluare și de livrare.");
    const p = price.trim() === "" ? null : Number(price);
    if (p !== null && (!Number.isFinite(p) || p < 0)) return setError("Preț invalid.");
    setPending(true);
    setError(null);
    const { data, error: rpcError } = await dbBrowser().rpc("propose_booking", {
      p_vehicle: vehicle.id, p_pallets: pallets, p_weight_kg: weight, p_pickup: pickup, p_dropoff: dropoff,
      p_pickup_at: new Date(when).toISOString(), p_price: p, p_request: requestId || null, p_message: message.trim() || null,
    });
    setPending(false);
    if (rpcError) return setError(errorMessage(rpcError));
    setDone(data as string);
  };

  const sorted = [...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro"));
  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-line p-3">
      <div className="t-label">Cerere de locuri</div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <label className="field"><span className="t-label">Paleți</span>
          <input type="number" className="input t-num" min={1} max={vehicle.free_pallets} value={pallets}
            onChange={(e) => { const n = Math.round(Number(e.target.value)); setPallets(n); setWeight(n * 500); }} />
        </label>
        <label className="field"><span className="t-label">Greutate totală (kg)</span>
          <input type="number" className="input t-num" min={1} value={weight} onChange={(e) => setWeight(Math.round(Number(e.target.value)))} />
        </label>
        <label className="field"><span className="t-label">Preluare</span>
          <select className="select" value={pickup} onChange={(e) => setPickup(e.target.value)}>
            <option value="">—</option>{sorted.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field"><span className="t-label">Livrare</span>
          <select className="select" value={dropoff} onChange={(e) => setDropoff(e.target.value)}>
            <option value="">—</option>{sorted.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field col-span-2"><span className="t-label">Preluare la</span>
          <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label className="field col-span-2"><span className="t-label">Preț propus (MDL)</span>
          <input className="input t-num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))}
            placeholder={estimate ? `automat: ${fmtMdl(estimate)} (${km} km)` : "lasă gol pentru negociere"} />
        </label>
        {myRequests.length > 0 && (
          <label className="field col-span-2"><span className="t-label">Leagă de cererea mea (opțional)</span>
            <select className="select" value={requestId} onChange={(e) => setRequestId(e.target.value)}>
              <option value="">—</option>
              {myRequests.map((r) => <option key={r.id} value={r.id}>{districtName(r.origin_district_id)} → {districtName(r.destination_district_id)}, {r.pallets} pal.</option>)}
            </select>
          </label>
        )}
        <label className="field col-span-2"><span className="t-label">Mesaj</span>
          <textarea className="textarea" rows={2} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tipul mărfii, standardul paleților, condiții de încărcare…" />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Renunță</button>
        <button type="submit" className="btn btn-primary flex-1" disabled={pending}>{pending ? "Se trimite…" : "Trimite cererea"}</button>
      </div>
    </form>
  );
}
