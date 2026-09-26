"use client";

// Cererea de transport a expeditorului fără mașini: de unde, unde, câți paleți,
// ce greutate, ce tip de vehicul și câte vehicule, în ce interval.

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { BodyType } from "@/lib/db-types";
import { DISTRICTS, districtById } from "@/lib/districts";
import { toLocalInput } from "@/lib/format";
import { errorMessage, supabaseBrowser } from "@/lib/supabase";
import { BODY_SPECS, BODY_TYPES } from "@/lib/vehicle-catalog";
import type { LatLon } from "./PointPicker";

const PointPicker = dynamic(() => import("./PointPicker"), { ssr: false, loading: () => <div className="h-44 rounded-md border border-line bg-canvas" /> });

interface Place {
  districtId: string;
  address: string;
  point: LatLon | null;
}

export default function NewRequestForm({ companyId, homeDistrict, onClose, onCreated }: {
  companyId: string;
  homeDistrict: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [origin, setOrigin] = useState<Place>({ districtId: homeDistrict ?? "", address: "", point: null });
  const [destination, setDestination] = useState<Place>({ districtId: "", address: "", point: null });
  const [pallets, setPallets] = useState(4);
  const [format, setFormat] = useState<"EUR" | "INDUSTRIAL" | "MIXED">("EUR");
  const [weight, setWeight] = useState(2000);
  const [bodyType, setBodyType] = useState<BodyType | "">("");
  const [reefer, setReefer] = useState(false);
  const [vehiclesNeeded, setVehiclesNeeded] = useState(1);
  const [readyFrom, setReadyFrom] = useState(() => toLocalInput(new Date(Date.now() + 3 * 3600_000)));
  const [deliverBy, setDeliverBy] = useState(() => toLocalInput(new Date(Date.now() + 27 * 3600_000)));
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!origin.districtId) e.origin = "Alege raionul de preluare.";
    if (!destination.districtId) e.destination = "Alege raionul de livrare.";
    if (!Number.isInteger(pallets) || pallets < 1 || pallets > 66) e.pallets = "1–66 paleți.";
    if (!Number.isInteger(weight) || weight < 1 || weight > 44000) e.weight = "1–44 000 kg.";
    if (!Number.isInteger(vehiclesNeeded) || vehiclesNeeded < 1 || vehiclesNeeded > 20) e.vehicles = "1–20.";
    const a = new Date(readyFrom).getTime();
    const b = new Date(deliverBy).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) e.window = "Termenul de livrare trebuie să fie după data de preluare.";
    if (budget.trim() && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) e.budget = "Buget invalid.";
    return e;
  }, [origin.districtId, destination.districtId, pallets, weight, vehiclesNeeded, readyFrom, deliverBy, budget]);

  const show = (k: string) => (touched ? errors[k] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    if (new Date(deliverBy).getTime() < Date.now()) return setError("Termenul de livrare e în trecut.");
    const o = districtById(origin.districtId)!;
    const d = districtById(destination.districtId)!;
    const op = origin.point ?? { lat: o.lat, lon: o.lon };
    const dp = destination.point ?? { lat: d.lat, lon: d.lon };
    setPending(true);
    setError(null);
    const { error: insertError } = await supabaseBrowser().from("freight_requests").insert({
      company_id: companyId,
      origin_district_id: o.id,
      origin_address: origin.address.trim() || null,
      origin_point: `SRID=4326;POINT(${op.lon} ${op.lat})`,
      destination_district_id: d.id,
      destination_address: destination.address.trim() || null,
      destination_point: `SRID=4326;POINT(${dp.lon} ${dp.lat})`,
      pallets,
      pallet_format: format,
      weight_kg: weight,
      body_type: bodyType || null,
      needs_reefer: reefer || bodyType === "REEFER",
      vehicles_needed: vehiclesNeeded,
      ready_from: new Date(readyFrom).toISOString(),
      deliver_by: new Date(deliverBy).toISOString(),
      cargo_description: description.trim() || null,
      budget_mdl: budget.trim() ? Number(budget) : null,
    });
    setPending(false);
    if (insertError) return setError(errorMessage(insertError));
    onCreated();
  };

  const sorted = useMemo(() => [...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro")), []);

  const placeFields = (label: string, place: Place, set: (p: Place) => void, err: string | undefined, color: string) => {
    const d = districtById(place.districtId);
    return (
      <fieldset className="space-y-2">
        <legend className="t-label mb-1">{label}</legend>
        <div className="grid grid-cols-2 gap-2">
          <select className="select" value={place.districtId} onChange={(e) => set({ ...place, districtId: e.target.value, point: null })} aria-invalid={Boolean(err)} aria-label={`${label}: raion`}>
            <option value="">Raionul…</option>
            {sorted.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <input className="input" maxLength={300} value={place.address} onChange={(e) => set({ ...place, address: e.target.value })} placeholder="Adresa (stradă, nr., depozit)" aria-label={`${label}: adresă`} />
        </div>
        {err && <span className="field-error">{err}</span>}
        {d && (
          <>
            <PointPicker value={place.point} center={d} onChange={(p) => set({ ...place, point: p })} color={color} />
            <span className="field-hint">{place.point ? "Punct exact ales pe hartă." : "Clic pe hartă pentru locul exact (opțional)."}</span>
          </>
        )}
      </fieldset>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="req-title">
      <form onSubmit={submit} noValidate className="card flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden shadow-xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="req-title" className="t-subtitle">Cerere de transport</h2>
            <p className="t-small">Transportatorii verificați o văd în bursă și îți trimit oferte.</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm px-2" aria-label="Închide"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-5 md:grid-cols-2">
          {error && <div className="alert alert-error md:col-span-2">{error}</div>}
          {placeFields("De unde (preluare)", origin, setOrigin, show("origin"), "#15803d")}
          {placeFields("Unde (livrare)", destination, setDestination, show("destination"), "#b91c1c")}

          <fieldset className="grid grid-cols-3 gap-2 md:col-span-2">
            <legend className="t-label mb-1">Marfa</legend>
            <label className="field"><span className="t-small">Paleți</span>
              <input type="number" className="input t-num" min={1} max={66} value={pallets} onChange={(e) => setPallets(Math.round(Number(e.target.value)))} aria-invalid={Boolean(show("pallets"))} />
              {show("pallets") && <span className="field-error">{show("pallets")}</span>}
            </label>
            <label className="field"><span className="t-small">Standard</span>
              <select className="select" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                <option value="EUR">EUR 120×80</option>
                <option value="INDUSTRIAL">Industrial 120×100</option>
                <option value="MIXED">Mixt / altele</option>
              </select>
            </label>
            <label className="field"><span className="t-small">Greutate totală (kg)</span>
              <input type="number" className="input t-num" min={1} value={weight} onChange={(e) => setWeight(Math.round(Number(e.target.value)))} aria-invalid={Boolean(show("weight"))} />
              {show("weight") && <span className="field-error">{show("weight")}</span>}
            </label>
            <label className="field col-span-3"><span className="t-small">Descriere (opțional)</span>
              <input className="input" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex. vin îmbuteliat, fragil, stivuibil pe 2 niveluri" />
            </label>
          </fieldset>

          <fieldset className="grid grid-cols-3 gap-2 md:col-span-2">
            <legend className="t-label mb-1">Vehicule necesare</legend>
            <label className="field col-span-2"><span className="t-small">Tip caroserie</span>
              <select className="select" value={bodyType} onChange={(e) => setBodyType(e.target.value as BodyType | "")}>
                <option value="">Oricare potrivit</option>
                {BODY_TYPES.filter((t) => t !== "LOWBED").map((t) => <option key={t} value={t}>{BODY_SPECS[t].label}</option>)}
              </select>
            </label>
            <label className="field"><span className="t-small">Câte vehicule</span>
              <input type="number" className="input t-num" min={1} max={20} value={vehiclesNeeded} onChange={(e) => setVehiclesNeeded(Math.round(Number(e.target.value)))} aria-invalid={Boolean(show("vehicles"))} />
            </label>
            <label className="col-span-3 flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="accent-[var(--color-accent)]" checked={reefer || bodyType === "REEFER"} disabled={bodyType === "REEFER"} onChange={(e) => setReefer(e.target.checked)} />
              Necesită temperatură controlată
            </label>
          </fieldset>

          <fieldset className="grid grid-cols-3 gap-2 md:col-span-2">
            <legend className="t-label mb-1">Când și cât</legend>
            <label className="field"><span className="t-small">Gata de preluare</span>
              <input type="datetime-local" className="input" value={readyFrom} onChange={(e) => setReadyFrom(e.target.value)} />
            </label>
            <label className="field"><span className="t-small">Livrare până la</span>
              <input type="datetime-local" className="input" value={deliverBy} onChange={(e) => setDeliverBy(e.target.value)} aria-invalid={Boolean(show("window"))} />
            </label>
            <label className="field"><span className="t-small">Buget (MDL, opțional)</span>
              <input className="input t-num" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(",", "."))} aria-invalid={Boolean(show("budget"))} />
            </label>
            {show("window") && <span className="field-error col-span-3">{show("window")}</span>}
          </fieldset>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Anulează</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Se publică…" : "Publică cererea"}</button>
        </footer>
      </form>
    </div>
  );
}
