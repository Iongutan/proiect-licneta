"use client";

// K6 — constructorul unic al flotei. Același flux pentru orice unitate:
// camion, vagon de tren, dronă. Utilizatorul scrie ce adaugă („vagon de
// tren”), alege tipul, iar restul formularului se adaptează din catalog
// (etichete, limite, zonă deservită). Fiecare pas se validează înainte de a
// trece mai departe; limitele sunt aceleași ca în baza de date.

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import VehicleSide from "@/components/logistics/VehicleBlueprintSVG";
import type { BodyType, Ownership } from "@/lib/db-types";
import { DISTRICTS } from "@/lib/districts";
import { geometricCapacity } from "@/lib/pallet-positioning";
import { errorMessage, dbBrowser } from "@/lib/db-browser";
import {
  BODY_SPECS, GPS_PROTOCOLS, MODE_LABEL, OWNERSHIP_LABEL, capacityErrors, findBodyTypes, idPatternFor, normalizeUnitId,
} from "@/lib/vehicle-catalog";
import DistrictAreaPicker from "./DistrictAreaPicker";

interface Draft {
  query: string;
  bodyType: BodyType;
  plate: string;
  makeModel: string;
  crewName: string;
  crewPhone: string;
  ownership: Ownership;
  ownershipUntil: string;
  hasReefer: boolean;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  payloadKg: number;
  pallets: number;
  pricePerKm: string;
  area: string[];
  gpsProtocol: (typeof GPS_PROTOCOLS)[number]["id"];
  gpsDeviceId: string;
  districtId: string;
}

const STEPS = ["Tip", "Identificare", "Capacitate", "GPS"] as const;

function stepErrors(step: number, d: Draft): Record<string, string> {
  const spec = BODY_SPECS[d.bodyType];
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!idPatternFor(d.bodyType).test(d.plate.trim())) e.plate = `${spec.idLabel} invalid (ex. ${spec.idPlaceholder}).`;
    if (d.makeModel.trim().length < 2) e.makeModel = "Marca și modelul.";
    if (d.crewPhone && !/^\+?[0-9 ()-]{6,20}$/.test(d.crewPhone)) e.crewPhone = "Telefon invalid.";
  }
  if (step === 2) {
    const max = spec.loadMode === "FLOOR" ? geometricCapacity({ bodyType: d.bodyType, lengthCm: d.lengthCm, widthCm: d.widthCm }) : undefined;
    Object.assign(e, capacityErrors(d.bodyType, {
      lengthCm: d.lengthCm, widthCm: d.widthCm, heightCm: d.heightCm, payloadKg: d.payloadKg, places: d.pallets,
    }, max));
    const price = d.pricePerKm.trim() === "" ? null : Number(d.pricePerKm);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 500)) e.pricePerKm = "0–500 MDL/km.";
    if (spec.needsArea && d.area.length === 0) e.area = "Alege cel puțin un raion în care operează.";
  }
  if (step === 3) {
    if (d.gpsProtocol !== "MANUAL" && d.gpsDeviceId.trim().length < 4) e.gpsDeviceId = "ID-ul/IMEI-ul trackerului.";
    if (!d.districtId) e.districtId = "Unde se află acum unitatea.";
  }
  return e;
}

export default function VehicleWizard({ companyId, homeDistrict, onClose, onCreated }: {
  companyId: string;
  homeDistrict: string | null;
  onClose: () => void;
  onCreated: (vehicleId: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(() => {
    const s = BODY_SPECS.CURTAINSIDE;
    return {
      query: "", bodyType: s.type, plate: "", makeModel: "", crewName: "", crewPhone: "",
      ownership: "OWNED", ownershipUntil: "", hasReefer: s.reefer,
      lengthCm: s.lengthCm, widthCm: s.widthCm, heightCm: s.heightCm, payloadKg: s.payloadKg, pallets: s.pallets,
      pricePerKm: "", area: homeDistrict ? [homeDistrict] : [], gpsProtocol: "TELTONIKA", gpsDeviceId: "", districtId: homeDistrict ?? "",
    };
  });

  const spec = BODY_SPECS[d.bodyType];
  const errors = stepErrors(step, d);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const matches = useMemo(() => findBodyTypes(d.query), [d.query]);
  const maxPallets = useMemo(() => geometricCapacity({ bodyType: d.bodyType, lengthCm: d.lengthCm, widthCm: d.widthCm }), [d.bodyType, d.lengthCm, d.widthCm]);

  const chooseBody = (type: BodyType) => {
    const s = BODY_SPECS[type];
    setD((prev) => ({
      ...prev, bodyType: type, hasReefer: s.reefer, lengthCm: s.lengthCm, widthCm: s.widthCm, heightCm: s.heightCm,
      payloadKg: s.payloadKg, pallets: s.pallets, plate: normalizeUnitId(type, prev.plate),
      gpsProtocol: s.mode === "ROAD" ? prev.gpsProtocol : prev.gpsProtocol === "TELTONIKA" ? "MANUAL" : prev.gpsProtocol,
    }));
  };

  const next = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    setTouched(false);
    setStep((s) => s + 1);
  };

  const finish = async () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    setPending(true);
    setError(null);
    const db = dbBrowser();
    const district = DISTRICTS.find((x) => x.id === d.districtId);
    const { data, error: insertError } = await db
      .from("vehicles")
      .insert({
        company_id: companyId,
        plate: d.plate.trim(),
        make_model: d.makeModel.trim(),
        body_type: d.bodyType,
        cargo_length_cm: d.lengthCm,
        cargo_width_cm: d.widthCm,
        cargo_height_cm: d.heightCm,
        max_payload_kg: d.payloadKg,
        pallet_capacity: d.pallets,
        has_reefer: d.hasReefer,
        price_per_km: d.pricePerKm.trim() === "" ? null : Number(d.pricePerKm),
        ownership: d.ownership,
        ownership_until: d.ownership !== "OWNED" && d.ownershipUntil ? d.ownershipUntil : null,
        service_district_ids: spec.needsArea ? d.area : [],
        gps_protocol: d.gpsProtocol,
        gps_device_id: d.gpsProtocol === "MANUAL" ? null : d.gpsDeviceId.trim(),
        district_id: d.districtId,
        // Poziția inițială = centrul raionului; trackerul o actualizează apoi.
        position: district ? `SRID=4326;POINT(${district.lon} ${district.lat})` : null,
        position_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError || !data) {
      setPending(false);
      setError(insertError?.code === "23505" ? `Există deja o unitate cu acest ${spec.idLabel.toLowerCase()}.` : errorMessage(insertError));
      return;
    }
    if (spec.hasCrew && (d.crewName.trim() || d.crewPhone.trim())) {
      await db.from("vehicle_private").insert({
        vehicle_id: data.id, driver_name: d.crewName.trim() || null, driver_phone: d.crewPhone.trim() || null,
      });
    }
    onCreated(data.id);
  };

  const err = (k: string) => (touched ? errors[k] : undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <div className="card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="wizard-title" className="t-subtitle">{step === 0 ? "Adaugă în flotă" : `Adaugă în flotă · ${spec.label}`}</h2>
            <ol className="mt-2 flex gap-4 text-xs">
              {STEPS.map((label, i) => (
                <li key={label} className={i === step ? "font-semibold text-accent-strong" : i < step ? "text-ink-2" : "text-muted"}>
                  {i + 1}. {label}
                </li>
              ))}
            </ol>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm px-2" aria-label="Închide"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          {step === 0 && (
            <>
              <div className="field">
                <label className="t-label" htmlFor="unit-query">Ce adaugi?</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="unit-query"
                    className="input w-full pl-8"
                    autoFocus
                    value={d.query}
                    placeholder="ex. vagon de tren, dronă, frigorific, dubă"
                    onChange={(e) => {
                      const q = e.target.value;
                      const first = findBodyTypes(q)[0];
                      setD((prev) => ({ ...prev, query: q }));
                      if (q.trim() && first && first !== d.bodyType) chooseBody(first);
                    }}
                  />
                </div>
                <span className="field-hint">Toate unitățile — rutiere, feroviare sau aeriene — stau în aceeași flotă a firmei.</span>
              </div>
              {matches.length === 0 ? (
                <p className="t-small">Niciun tip nu se potrivește cu „{d.query}”. Încearcă „camion”, „vagon” sau „dronă”.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {matches.map((t) => {
                    const s = BODY_SPECS[t];
                    const active = d.bodyType === t;
                    return (
                      <button key={t} type="button" onClick={() => chooseBody(t)} aria-pressed={active}
                        className={`rounded-md border p-3 text-left ${active ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}>
                        <VehicleSide type={t} cargoLengthCm={s.lengthCm} cargoWidthCm={s.widthCm} occupied={0} className="h-12 w-full" />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">{s.label}</span>
                          <span className="badge">{MODE_LABEL[s.mode]}</span>
                        </div>
                        <div className="t-small">{s.description}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              {spec.mode === "ROAD" && d.bodyType !== "REEFER" && d.bodyType !== "LOWBED" && (
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="accent-[var(--color-accent)]" checked={d.hasReefer} onChange={(e) => set("hasReefer", e.target.checked)} />
                  Are agregat frigorific / izotermă
                </label>
              )}
            </>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              <Input label={spec.idLabel} error={err("plate")} value={d.plate} onChange={(v) => set("plate", normalizeUnitId(d.bodyType, v))} placeholder={spec.idPlaceholder} mono />
              <Input label="Marcă și model" error={err("makeModel")} value={d.makeModel} onChange={(v) => set("makeModel", v)} placeholder={spec.modelPlaceholder} />
              {spec.hasCrew && (
                <>
                  <Input label={`${spec.crewLabel} (opțional)`} value={d.crewName} onChange={(v) => set("crewName", v)} />
                  <Input label={`Telefon ${spec.crewLabel.toLowerCase()} (opțional)`} error={err("crewPhone")} value={d.crewPhone} onChange={(v) => set("crewPhone", v)} placeholder="+373 69 000 000" hint="Vizibil doar partenerilor cu contract activ." />
                </>
              )}
              <div className="field">
                <label className="t-label" htmlFor="ownership">Deținere</label>
                <select id="ownership" className="select" value={d.ownership} onChange={(e) => set("ownership", e.target.value as Ownership)}>
                  {Object.entries(OWNERSHIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {d.ownership !== "OWNED" ? (
                <div className="field">
                  <label className="t-label" htmlFor="ownership-until">Până la (opțional)</label>
                  <input id="ownership-until" type="date" className="input" value={d.ownershipUntil} onChange={(e) => set("ownershipUntil", e.target.value)} />
                </div>
              ) : <div />}
            </div>
          )}

          {step === 2 && (
            <>
              <VehicleSide type={d.bodyType} cargoLengthCm={d.lengthCm} cargoWidthCm={d.widthCm} occupied={0} className="h-24 w-full" />
              <div className="grid grid-cols-3 gap-3">
                <NumberInput label="Lungime interioară (cm)" error={err("lengthCm")} value={d.lengthCm} onChange={(v) => set("lengthCm", v)} />
                <NumberInput label="Lățime interioară (cm)" error={err("widthCm")} value={d.widthCm} onChange={(v) => set("widthCm", v)} />
                <NumberInput label="Înălțime utilă (cm)" error={err("heightCm")} value={d.heightCm} onChange={(v) => set("heightCm", v)} />
                <NumberInput label="Sarcină maximă (kg)" error={err("payloadKg")} value={d.payloadKg} onChange={(v) => set("payloadKg", v)} />
                <NumberInput label={`Locuri (${spec.placeUnit})`} error={err("places")} value={d.pallets} onChange={(v) => set("pallets", v)}
                  hint={spec.loadMode === "NONE" ? "Fără paleți." : spec.loadMode === "FLOOR" ? `Încap maxim ${maxPallets} EUR 120×80.` : "Locurile ocupate se declară apoi ca număr."} />
                <Input label="Preț per km (MDL, opțional)" error={err("pricePerKm")} value={d.pricePerKm} onChange={(v) => set("pricePerKm", v.replace(",", "."))}
                  hint="Baza ofertei automate: preț/km × distanță." />
              </div>
              {spec.needsArea && <DistrictAreaPicker value={d.area} onChange={(v) => set("area", v)} error={err("area")} />}
            </>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="t-label" htmlFor="gps-protocol">Tracker GPS</label>
                <select id="gps-protocol" className="select" value={d.gpsProtocol} onChange={(e) => set("gpsProtocol", e.target.value as Draft["gpsProtocol"])}>
                  {GPS_PROTOCOLS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              {d.gpsProtocol !== "MANUAL" ? (
                <Input label="ID / IMEI tracker" error={err("gpsDeviceId")} value={d.gpsDeviceId} onChange={(v) => set("gpsDeviceId", v.slice(0, 64))} mono />
              ) : <div />}
              <div className="field col-span-2">
                <label className="t-label" htmlFor="district">{spec.needsArea ? "Baza de decolare (raion)" : "Unde se află acum"}</label>
                <select id="district" className="select" value={d.districtId} onChange={(e) => set("districtId", e.target.value)} aria-invalid={Boolean(err("districtId"))}>
                  <option value="">Alege raionul…</option>
                  {[...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro")).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                {err("districtId") && <span className="field-error">{err("districtId")}</span>}
              </div>
              <p className="col-span-2 t-small">
                După salvare poți genera tokenul de conectare pentru tracker din pagina unității. Până la prima poziție GPS, unitatea apare în centrul raionului ales.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-line px-5 py-3">
          <button type="button" className="btn btn-ghost" onClick={() => (step ? setStep(step - 1) : onClose())}>
            {step ? "Înapoi" : "Anulează"}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next} disabled={step === 0 && matches.length === 0}>Continuă</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={finish} disabled={pending}>{pending ? "Se salvează…" : "Adaugă în flotă"}</button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, error, hint, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; placeholder?: string; mono?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="field">
      <label className="t-label" htmlFor={id}>{label}</label>
      <input id={id} className={`input ${mono ? "font-mono" : ""}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} />
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

function NumberInput({ label, value, onChange, error, hint }: { label: string; value: number; onChange: (v: number) => void; error?: string; hint?: string }) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="field">
      <label className="t-label" htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="numeric" className="input t-num" value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Math.round(Number(e.target.value)))} aria-invalid={Boolean(error)} />
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
