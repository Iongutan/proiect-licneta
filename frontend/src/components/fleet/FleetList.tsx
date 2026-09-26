"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import VehicleSide from "@/components/logistics/VehicleBlueprintSVG";
import type { MapVehicle, VehicleLoad } from "@/lib/db-types";
import { districtName } from "@/lib/districts";
import { fmtDateTime, fmtKg } from "@/lib/format";
import { errorMessage, supabaseBrowser } from "@/lib/supabase";
import { BODY_SPECS } from "@/lib/vehicle-catalog";
import VehicleWizard from "./VehicleWizard";

export const STATUS_LABEL: Record<MapVehicle["status"], { text: string; cls: string }> = {
  AVAILABLE: { text: "Disponibil", cls: "badge-ok" },
  ON_ROUTE: { text: "În cursă", cls: "badge-accent" },
  MAINTENANCE: { text: "Service", cls: "badge-warn" },
  OFFLINE: { text: "Inactiv", cls: "" },
};

async function fetchFleet(companyId: string): Promise<{ vehicles: MapVehicle[]; loads: Record<string, VehicleLoad[]> } | { error: string }> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("vehicles_map").select("*").eq("company_id", companyId).order("plate");
  if (error) return { error: errorMessage(error) };
  const vehicles = (data ?? []) as MapVehicle[];
  const loads: Record<string, VehicleLoad[]> = {};
  if (vehicles.length) {
    const { data: rows } = await supabase.from("vehicle_loads").select("*").in("vehicle_id", vehicles.map((v) => v.id));
    for (const r of (rows ?? []) as VehicleLoad[]) (loads[r.vehicle_id] ??= []).push(r);
  }
  return { vehicles, loads };
}

export default function FleetList({ companyId, homeDistrict }: { companyId: string; homeDistrict: string | null }) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<MapVehicle[] | null>(null);
  const [loads, setLoads] = useState<Record<string, VehicleLoad[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchFleet(companyId).then((res) => {
      if (!active) return;
      if ("error" in res) setError(res.error);
      else {
        setVehicles(res.vehicles);
        setLoads(res.loads);
      }
    });
    return () => {
      active = false;
    };
  }, [companyId]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="t-title">Flota mea</h1>
          <p className="t-small">Vehiculele listate apar în bursă cu locurile libere; planul de încărcare se editează pe pagina fiecărui vehicul.</p>
        </div>
      </header>

      {error && <div className="alert alert-error mb-4">{error}</div>}
      {vehicles === null && !error && <p className="t-small">Se încarcă…</p>}

      {vehicles?.length === 0 && (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <VehicleSide type="CURTAINSIDE" cargoLengthCm={1360} cargoWidthCm={245} occupied={0} className="h-20 w-80" />
          <h2 className="t-subtitle mt-4">Niciun vehicul încă</h2>
          <p className="t-small mt-1 max-w-sm">Adaugă primul vehicul cu butonul „+”. Îți cerem tipul caroseriei, dimensiunile, sarcina și trackerul GPS.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles?.map((v) => {
          const status = STATUS_LABEL[v.status];
          const vl = loads[v.id] ?? [];
          return (
            <Link key={v.id} href={`/fleet/${v.id}`} className="card flex flex-col hover:border-line-strong">
              <div className="border-b border-line bg-canvas px-4 pb-2 pt-3">
                <VehicleSide
                  type={v.body_type}
                  cargoLengthCm={v.cargo_length_cm}
                  cargoWidthCm={v.cargo_width_cm}
                  pallets={vl.map((l) => ({ xCm: l.x_cm, lengthCm: l.length_cm, yCm: l.y_cm, reserved: l.status === "RESERVED" }))}
                  className="h-20 w-full"
                  title={`${v.make_model}, ${v.plate}`}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="kbd-plate">{v.plate}</span>
                  <span className={`badge ${status.cls}`}>{status.text}</span>
                </div>
                <div>
                  <div className="text-[13px] font-medium">{v.make_model}</div>
                  <div className="t-small">{BODY_SPECS[v.body_type].label} · {fmtKg(v.max_payload_kg)}</div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted">Locuri libere</dt>
                  <dd className="t-num text-right font-medium">{v.pallet_capacity ? `${v.free_pallets} / ${v.pallet_capacity}` : "—"}</dd>
                  <dt className="text-muted">Preț</dt>
                  <dd className="text-right">{v.price_per_km ? `${v.price_per_km} MDL/km` : "la negociere"}</dd>
                  <dt className="text-muted">Cursă</dt>
                  <dd className="truncate text-right">{v.trip_origin_id ? `${districtName(v.trip_origin_id)} → ${districtName(v.trip_destination_id)}` : "—"}</dd>
                  <dt className="text-muted">GPS</dt>
                  <dd className="text-right">{v.position_at ? fmtDateTime(v.position_at) : "fără semnal"}</dd>
                </dl>
                {!v.is_listed && <span className="badge self-start">Ascuns din bursă</span>}
                <div className="t-small">
                  Acum: {districtName(v.district_id)}
                  {v.booked_pallets > 0 && ` · ${v.booked_pallets} paleți rezervați prin contract`}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* K6: buton mare, circular, cu „+” */}
      <button
        type="button"
        onClick={() => setWizardOpen(true)}
        className="fixed bottom-8 right-8 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-lg ring-4 ring-white hover:bg-accent-strong"
        aria-label="Adaugă vehicul"
        title="Adaugă vehicul"
      >
        <Plus className="h-8 w-8" strokeWidth={2} />
      </button>

      {wizardOpen && (
        <VehicleWizard
          companyId={companyId}
          homeDistrict={homeDistrict}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => {
            setWizardOpen(false);
            router.push(`/fleet/${id}`);
          }}
        />
      )}
    </main>
  );
}
