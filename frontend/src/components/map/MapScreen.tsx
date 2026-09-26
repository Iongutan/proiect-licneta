"use client";

import { ArrowLeft, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapVehicle, TripMatch } from "@/lib/db-types";
import { districtById, districtName } from "@/lib/districts";
import { fmtRelative, fmtTime } from "@/lib/format";
import { parseSearchIntent, type SearchIntent } from "@/lib/search-intent";
import { errorMessage, supabaseBrowser } from "@/lib/supabase";
import { BODY_SPECS } from "@/lib/vehicle-catalog";
import VehicleDrawer from "./VehicleDrawer";

const RealMoldovaMap = dynamic(() => import("./RealMoldovaMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center t-small">Se încarcă harta…</div>,
});

const MATCH_LABEL: Record<TripMatch["match_type"], string> = {
  DIRECT: "Cursă directă",
  TRANSIT: "În tranzit pe traseu",
  AT_ORIGIN: "Liber acum în raion",
  NEARBY: "Adiacent (mic ocol)",
};

interface NearMe {
  vehicle_id: string;
  plate: string;
  company_name: string;
  free_pallets: number;
  eta: string;
  distance_km: number;
  trip_origin_id: string;
  trip_destination_id: string;
}

interface Props {
  companyId: string | null;
  companyVerified: boolean;
  canShip: boolean;
  homeDistrict: string | null;
  initialSelectedId: string | null;
}

export default function MapScreen({ companyId, companyVerified, canShip, homeDistrict, initialSelectedId }: Props) {
  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [results, setResults] = useState<TripMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [routeFor, setRouteFor] = useState<{ id: string; geo: GeoJSON.LineString | null } | null>(null);
  const [nearMe, setNearMe] = useState<NearMe[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Date: vehiculele vizibile (RLS) + actualizări live (K10) ──
  const refreshVehicle = useCallback(async (id: string) => {
    const { data } = await supabaseBrowser().from("vehicles_map").select("*").eq("id", id).maybeSingle();
    setVehicles((prev) => {
      const rest = prev.filter((v) => v.id !== id);
      return data ? [...rest, data as MapVehicle] : rest;
    });
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let active = true;
    supabase.from("vehicles_map").select("*").in("status", ["AVAILABLE", "ON_ROUTE"]).limit(5000)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setNotice(errorMessage(error));
        else setVehicles((data ?? []) as MapVehicle[]);
      });

    // Coalescență: multe poziții GPS pe secundă → o singură reîncărcare per vehicul.
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queue = (id: string | undefined) => {
      if (!id) return;
      pending.add(id);
      timer ??= setTimeout(() => {
        const ids = [...pending];
        pending.clear();
        timer = null;
        ids.forEach(refreshVehicle);
      }, 800);
    };
    const channel = supabase
      .channel("map-vehicles")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, (p) =>
        queue(((p.new as { id?: string })?.id ?? (p.old as { id?: string })?.id)))
      .subscribe();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refreshVehicle]);

  // K4.4: sugestii proactive — vehicule cu locuri care trec pe lângă sediu
  useEffect(() => {
    if (!canShip || !companyId) return;
    supabaseBrowser().rpc("vehicles_passing_near_me", { p_radius_km: 15, p_min_free: 1 })
      .then(({ data }) => data && setNearMe(data as NearMe[]));
  }, [canShip, companyId]);

  // Traseul vehiculului selectat
  useEffect(() => {
    if (!selectedId) return;
    const supabase = supabaseBrowser();
    // Vehiculul poate lipsi din lista inițială (ex. deschis din pagina unui contract).
    supabase.from("vehicles_map").select("*").eq("id", selectedId).maybeSingle().then(({ data }) => {
      if (data) setVehicles((prev) => [...prev.filter((v) => v.id !== selectedId), data as MapVehicle]);
    });
    supabase.rpc("vehicle_route", { p_vehicle: selectedId })
      .then(({ data }) => setRouteFor({ id: selectedId, geo: (data as GeoJSON.LineString | null) ?? null }));
  }, [selectedId]);
  const route = routeFor && routeFor.id === selectedId ? routeFor.geo : null;

  // ── Căutare (K4) ──
  const runSearch = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setFocused(false);
    setSelectedId(null);
    setNotice(null);
    let parsed = parseSearchIntent(text);

    if (!parsed.origin && !parsed.destination) {
      // Rezervă: interpretare cu Qwen3 local (dacă rulează).
      const res = await fetch("/api/intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: text }) }).catch(() => null);
      const ai = res?.ok ? await res.json() : null;
      if (ai && (ai.origin || ai.destination)) {
        parsed = {
          origin: districtById(ai.origin), destination: districtById(ai.destination),
          pallets: ai.pallets ?? parsed.pallets, withTransit: ai.withTransit || parsed.withTransit, bodyType: parsed.bodyType,
        };
      } else {
        setIntent(parsed);
        setResults(null);
        setNotice("Nu am recunoscut localitățile. Încearcă de exemplu „Chișinău - Rezina” sau „3 paleți din Bălți spre Cahul”.");
        return;
      }
    }

    setIntent(parsed);
    setSearching(true);
    const { data, error } = await supabaseBrowser().rpc("search_trips", {
      p_origin: parsed.origin?.id ?? null,
      p_destination: parsed.destination?.id ?? null,
      p_min_free: parsed.pallets ?? 0,
      // Căutarea arată mereu și vehiculele în tranzit; „cu tranzit” le pune în față pe cele adiacente.
      p_with_transit: true,
      p_body_type: parsed.bodyType ?? null,
      p_corridor_km: parsed.withTransit ? 25 : 15,
    });
    setSearching(false);
    if (error) {
      setNotice(errorMessage(error));
      setResults(null);
      return;
    }
    setResults((data ?? []) as TripMatch[]);
  };

  const clearSearch = () => {
    setQuery("");
    setIntent(null);
    setResults(null);
    setNotice(null);
    setSelectedId(null);
  };

  const highlightIds = useMemo(() => (results ? new Set(results.map((r) => r.vehicle_id)) : null), [results]);
  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const selectedMatch = results?.find((r) => r.vehicle_id === selectedId) ?? null;
  const centered = !query && !results && !focused && !selectedId;
  const panelOpen = Boolean(results || selectedId || notice);

  return (
    <div className="relative h-screen overflow-hidden">
      <RealMoldovaMap
        vehicles={vehicles}
        selectedId={selectedId}
        highlightIds={highlightIds}
        route={route}
        origin={intent?.origin ?? null}
        destination={intent?.destination ?? null}
        focusDistrictId={homeDistrict}
        onSelectVehicle={setSelectedId}
      />

      {/* K2: bara de căutare, centrată vertical la intrare; urcă după interacțiune */}
      <div
        className={`pointer-events-none absolute left-0 z-[500] flex justify-center px-4 transition-all duration-300 ${panelOpen ? "right-[400px]" : "right-0"} ${centered ? "top-1/2 -translate-y-1/2" : "top-4"}`}
      >
        <form
          className="pointer-events-auto relative w-full max-w-xl"
          onSubmit={(e) => { e.preventDefault(); runSearch(query); inputRef.current?.blur(); }}
          role="search"
        >
          <div className="card flex items-center gap-2 px-3 shadow-md focus-within:border-accent">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Ex: Chișinău - Rezina, cu tranzit"
              aria-label="Caută o cursă"
              className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              maxLength={300}
            />
            {query && (
              <button type="button" onClick={clearSearch} className="btn btn-ghost btn-sm px-2" aria-label="Șterge căutarea"><X className="h-4 w-4" /></button>
            )}
          </div>
          {focused && !query && nearMe.length > 0 && (
            <div className="card absolute left-0 right-0 top-14 overflow-hidden shadow-md">
              <div className="border-b border-line px-3 py-2 t-label">Trec pe lângă sediul tău în următoarele 24 h</div>
              {nearMe.map((n) => (
                <button key={n.vehicle_id} type="button" onMouseDown={() => setSelectedId(n.vehicle_id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-canvas">
                  <span className="text-[13px]"><span className="kbd-plate mr-2">{n.plate}</span>{districtName(n.trip_origin_id)} → {districtName(n.trip_destination_id)}</span>
                  <span className="t-small whitespace-nowrap">{n.free_pallets} libere · ~{fmtTime(n.eta)}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Panou dreapta: rezultate (K4) sau detaliu vehicul (K5) */}
      {panelOpen && (
        <aside className="absolute inset-y-0 right-0 z-[600] flex w-[400px] flex-col border-l border-line bg-surface">
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
                  <ArrowLeft className="h-4 w-4" /> {results ? "Rezultate" : "Închide"}
                </button>
              </div>
              <VehicleDrawer
                vehicle={selected}
                match={selectedMatch}
                intent={intent}
                companyId={companyId}
                companyVerified={companyVerified}
                canShip={canShip}
              />
            </>
          ) : (
            <SearchResults intent={intent} results={results} searching={searching} notice={notice} vehicles={vehicles} onPick={setSelectedId} onClose={clearSearch} />
          )}
        </aside>
      )}
    </div>
  );
}

function SearchResults({ intent, results, searching, notice, vehicles, onPick, onClose }: {
  intent: SearchIntent | null; results: TripMatch[] | null; searching: boolean; notice: string | null;
  vehicles: MapVehicle[]; onPick: (id: string) => void; onClose: () => void;
}) {
  const groups = (["DIRECT", "TRANSIT", "AT_ORIGIN", "NEARBY"] as const)
    .map((t) => ({ type: t, rows: (results ?? []).filter((r) => r.match_type === t) }))
    .filter((g) => g.rows.length);
  // K10: capacitatea afișată vine din lista live, nu din instantaneul căutării.
  const liveFree = (id: string, fallback: number) => vehicles.find((v) => v.id === id)?.free_pallets ?? fallback;

  return (
    <>
      <div className="flex items-start justify-between border-b border-line px-4 py-3">
        <div>
          <div className="t-subtitle">
            {intent?.origin?.name ?? "Oriunde"} → {intent?.destination?.name ?? "oriunde"}
          </div>
          <div className="t-small">
            {intent?.pallets ? `mai mult de ${intent.pallets} paleți liberi` : "orice capacitate"}
            {intent?.bodyType ? ` · ${BODY_SPECS[intent.bodyType].short}` : ""}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm px-2" onClick={onClose} aria-label="Închide"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notice && <div className="alert alert-warn m-3">{notice}</div>}
        {searching && <p className="p-4 t-small">Se caută…</p>}
        {results && !searching && results.length === 0 && (
          <p className="p-4 t-small">Niciun vehicul pe acest traseu acum. Poți posta o cerere în „Comenzile mele” — transportatorii o văd în bursă.</p>
        )}
        {groups.map((g) => (
          <section key={g.type}>
            <h3 className="sticky top-0 border-b border-line bg-canvas px-4 py-1.5 t-label">{MATCH_LABEL[g.type]} · {g.rows.length}</h3>
            <ul>
              {g.rows.map((r) => (
                <li key={r.vehicle_id}>
                  <button type="button" onClick={() => onPick(r.vehicle_id)} className="w-full border-b border-line px-4 py-3 text-left hover:bg-canvas">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><span className="kbd-plate">{r.plate}</span><span className="text-[13px] font-medium">{r.company_name}</span></span>
                      <span className="t-num text-[13px] font-semibold text-accent-strong">{liveFree(r.vehicle_id, r.free_pallets)} libere</span>
                    </div>
                    <div className="mt-1 t-small">
                      {BODY_SPECS[r.body_type].short}
                      {r.trip_origin_id && ` · ${districtName(r.trip_origin_id)} → ${districtName(r.trip_destination_id)}`}
                      {r.price_per_km ? ` · ${r.price_per_km} MDL/km` : ""}
                    </div>
                    {r.eta_origin && (
                      <div className="mt-1 text-xs text-ink-2">
                        Trece prin {intent?.origin?.name ?? "punctul A"} la <strong>{fmtTime(r.eta_origin)}</strong> ({fmtRelative(r.eta_origin)})
                        {r.match_type !== "DIRECT" && r.offset_km > 0 ? ` · ocol ~${r.offset_km} km` : ""}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

