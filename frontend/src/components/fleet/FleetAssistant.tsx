"use client";

// Asistentul din „Flota mea”: scrii ce ai („am un frigider Volvo, 30 de paleți,
// e la Bălți”), iar formularul unității se construiește chiar aici, pe pagină,
// precompletat cu ce a înțeles din text și cu ce știe platforma despre firmă
// (raionul sediului, tarifele unităților de același tip). Tu doar verifici și adaugi.

import { Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import VehicleSide from "@/components/logistics/VehicleBlueprintSVG";
import type { BodyType, MapVehicle, Ownership } from "@/lib/db-types";
import { DISTRICTS, districtName } from "@/lib/districts";
import { createUnit } from "@/lib/fleet-create";
import { geometricCapacity } from "@/lib/pallet-positioning";
import { parseUnitDescription, type Understood, type UnitDraft } from "@/lib/unit-parser";
import {
  BODY_SPECS, BODY_TYPES, MODE_LABEL, OWNERSHIP_LABEL, capacityErrors, idPatternFor, normalizeUnitId,
} from "@/lib/vehicle-catalog";
import DistrictAreaPicker from "./DistrictAreaPicker";

const EXAMPLES = [
  "am un frigider Volvo, 33 de paleți, e la Bălți",
  "am închiriat un vagon de tren cu 40 de locuri la Ungheni",
  "dronă DJI pentru Ialoveni și Strășeni, 2 compartimente",
];

const SORTED_DISTRICTS = [...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro"));

export default function FleetAssistant({ companyId, companyName, homeDistrict, fleet, onCreated }: {
  companyId: string;
  companyName: string;
  homeDistrict: string | null;
  fleet: MapVehicle[];
  onCreated: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<UnitDraft | null>(null);
  const [understood, setUnderstood] = useState<Understood | null>(null);
  const [notUnderstood, setNotUnderstood] = useState(false);
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tariful tipic al firmei pentru același tip, dacă nu e spus în text.
  const priceFor = (type: BodyType) => {
    const prices = fleet.filter((v) => v.body_type === type && v.price_per_km).map((v) => Number(v.price_per_km));
    return prices.length ? String(Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 2) / 2) : "";
  };

  const build = (input = text) => {
    const r = parseUnitDescription(input, homeDistrict);
    setTouched(false);
    setError(null);
    if (!r) {
      setDraft(null);
      setUnderstood(null);
      setNotUnderstood(true);
      return;
    }
    setNotUnderstood(false);
    setDraft({ ...r.draft, pricePerKm: r.draft.pricePerKm || priceFor(r.draft.bodyType) });
    setUnderstood(r.understood);
  };

  const set = <K extends keyof UnitDraft>(k: K, v: UnitDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const changeType = (type: BodyType) => {
    const s = BODY_SPECS[type];
    setDraft((d) => d && {
      ...d, bodyType: type, lengthCm: s.lengthCm, widthCm: s.widthCm, heightCm: s.heightCm, payloadKg: s.payloadKg,
      pallets: s.pallets, hasReefer: s.reefer, plate: normalizeUnitId(type, d.plate), pricePerKm: d.pricePerKm || priceFor(type),
      area: s.needsArea ? (d.area.length ? d.area : homeDistrict ? [homeDistrict] : []) : [],
    });
  };

  const errors = useMemo(() => {
    if (!draft) return {};
    const spec = BODY_SPECS[draft.bodyType];
    const e: Record<string, string> = {};
    if (!idPatternFor(draft.bodyType).test(draft.plate.trim())) e.plate = `Completează ${spec.idLabel.toLowerCase()} (ex. ${spec.idPlaceholder}).`;
    if (draft.makeModel.trim().length < 2) e.makeModel = "Completează marca și modelul.";
    const max = spec.loadMode === "FLOOR" ? geometricCapacity({ bodyType: draft.bodyType, lengthCm: draft.lengthCm, widthCm: draft.widthCm }) : undefined;
    Object.assign(e, capacityErrors(draft.bodyType, {
      lengthCm: draft.lengthCm, widthCm: draft.widthCm, heightCm: draft.heightCm, payloadKg: draft.payloadKg, places: draft.pallets,
    }, max));
    const price = draft.pricePerKm.trim() === "" ? null : Number(draft.pricePerKm);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 500)) e.pricePerKm = "0–500 MDL/km.";
    if (!draft.districtId) e.districtId = "Unde se află acum.";
    if (spec.needsArea && !draft.area.length) e.area = "Alege cel puțin un raion.";
    return e;
  }, [draft]);

  const add = async () => {
    if (!draft) return;
    setTouched(true);
    if (Object.keys(errors).length) return;
    setPending(true);
    setError(null);
    const res = await createUnit(companyId, { ...draft, gpsProtocol: "MANUAL", gpsDeviceId: "" });
    setPending(false);
    if ("error" in res) return setError(res.error);
    setDraft(null);
    setUnderstood(null);
    setText("");
    onCreated(res.id);
  };

  const err = (k: string) => (touched ? errors[k] : undefined);
  const spec = draft ? BODY_SPECS[draft.bodyType] : null;

  return (
    <section className="card mb-5" aria-label="Asistentul flotei">
      <form
        className="flex flex-wrap items-center gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          build();
        }}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <label htmlFor="assistant-input" className="sr-only">Descrie ce adaugi în flotă</label>
        <input
          id="assistant-input"
          className="input min-w-0 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Spune ce ai, de ex.: „${EXAMPLES[0]}”`}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={text.trim().length < 3}>Construiește</button>
      </form>

      {notUnderstood && (
        <p className="border-t border-line px-4 py-3 t-small">
          Nu am recunoscut tipul unității. Încearcă, de exemplu:{" "}
          {EXAMPLES.map((ex, i) => (
            <button key={ex} type="button" className="text-accent hover:underline" onClick={() => { setText(ex); build(ex); }}>
              „{ex}”{i < EXAMPLES.length - 1 ? ", " : ""}
            </button>
          ))}
        </p>
      )}

      {draft && spec && understood && (
        <div className="border-t border-line p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="t-subtitle">De adăugat în flota {companyName}: {spec.label.toLowerCase()}</h2>
              <p className="t-small">
                Am completat din ce ai scris; restul sunt valori tipice pentru {spec.short.toLowerCase()} și datele firmei.
                Câmpurile marcate cu punct albastru vin din text.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm px-2" onClick={() => setDraft(null)} aria-label="Renunță la ciornă"><X className="h-4 w-4" /></button>
          </div>

          {error && <div className="alert alert-error mb-3" role="alert">{error}</div>}

          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="rounded-md border border-line bg-canvas p-3">
              <VehicleSide type={draft.bodyType} cargoLengthCm={draft.lengthCm} cargoWidthCm={draft.widthCm} occupied={0} className="h-20 w-full" />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[13px] font-medium">{spec.label}</span>
                <span className="badge">{MODE_LABEL[spec.mode]}</span>
              </div>
              <p className="t-small mt-1">{draft.pallets} {spec.placeUnit} · {draft.payloadKg.toLocaleString("ro-MD")} kg · {districtName(draft.districtId)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field id="as-type" label="Tip" from>
                <select id="as-type" className="select" value={draft.bodyType} onChange={(e) => changeType(e.target.value as BodyType)}>
                  {BODY_TYPES.map((t) => <option key={t} value={t}>{BODY_SPECS[t].label}</option>)}
                </select>
              </Field>
              <Field id="as-plate" label={spec.idLabel} from={understood.plate} error={err("plate")}>
                <input id="as-plate" className="input font-mono" value={draft.plate} placeholder={spec.idPlaceholder}
                  onChange={(e) => set("plate", normalizeUnitId(draft.bodyType, e.target.value))} />
              </Field>
              <Field id="as-model" label="Marcă și model" from={understood.model} error={err("makeModel")}>
                <input id="as-model" className="input" value={draft.makeModel} placeholder={spec.modelPlaceholder} onChange={(e) => set("makeModel", e.target.value)} />
              </Field>
              <Field id="as-places" label={`Locuri (${spec.placeUnit})`} from={understood.places} error={err("places")}>
                <input id="as-places" type="number" className="input t-num" value={draft.pallets} onChange={(e) => set("pallets", Math.round(Number(e.target.value)))} />
              </Field>
              <Field id="as-payload" label="Sarcină maximă (kg)" from={understood.payload} error={err("payloadKg")}>
                <input id="as-payload" type="number" className="input t-num" value={draft.payloadKg} onChange={(e) => set("payloadKg", Math.round(Number(e.target.value)))} />
              </Field>
              <Field id="as-price" label="Preț per km (MDL)" from={understood.price} error={err("pricePerKm")}>
                <input id="as-price" className="input t-num" value={draft.pricePerKm} placeholder="la negociere" onChange={(e) => set("pricePerKm", e.target.value.replace(",", "."))} />
              </Field>
              <Field id="as-own" label="Deținere" from={understood.ownership}>
                <select id="as-own" className="select" value={draft.ownership} onChange={(e) => set("ownership", e.target.value as Ownership)}>
                  {Object.entries(OWNERSHIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field id="as-district" label={spec.needsArea ? "Baza (raion)" : "Unde se află acum"} from={understood.district} error={err("districtId")}>
                <select id="as-district" className="select" value={draft.districtId} onChange={(e) => set("districtId", e.target.value)}>
                  <option value="">Alege raionul…</option>
                  {SORTED_DISTRICTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </Field>
              {spec.mode === "ROAD" && draft.bodyType !== "LOWBED" && (
                <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
                  <input type="checkbox" className="accent-[var(--color-accent)]" checked={draft.hasReefer} onChange={(e) => set("hasReefer", e.target.checked)} />
                  Frigorific / izotermă
                </label>
              )}
            </div>
          </div>

          {spec.needsArea && (
            <div className="mt-4">
              <DistrictAreaPicker value={draft.area} onChange={(v) => set("area", v)} error={err("area")} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto t-small">Dimensiunile interioare și trackerul GPS se pot ajusta apoi din pagina unității.</span>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Renunță</button>
            <button type="button" className="btn btn-primary" onClick={add} disabled={pending}>{pending ? "Se adaugă…" : "Adaugă în flotă"}</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ id, label, from, error, children }: { id: string; label: string; from?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="t-label flex items-center gap-1.5" htmlFor={id}>
        {label}
        {from && <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" title="Completat din ce ai scris" aria-label="din text" />}
      </label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
