// K3 — agregarea vehiculelor pe hartă, pe trei niveluri de zoom:
//   zoom < 8     → câte un cerc pe regiune (Nord / Centru / Sud)
//   zoom 8–10    → câte un număr pe raion
//   zoom ≥ 11    → vehicule individuale; cele suprapuse (ex. în Chișinău)
//                  sunt grupate cu supercluster până se separă la zoom mare
// Regiunea/raionul vin din vehicle.district_id (setat de GPS în baza de date).

import Supercluster from "supercluster";
import { DISTRICTS, REGIONS, districtById, type Region } from "./districts";

export type ClusterLevel = "REGION" | "DISTRICT" | "VEHICLE";

export const REGION_MAX_ZOOM = 7;
export const DISTRICT_MAX_ZOOM = 10;
/** Peste acest zoom fiecare vehicul apare separat (supercluster nu mai grupează). */
export const STACK_MAX_ZOOM = 15;

export function levelForZoom(zoom: number): ClusterLevel {
  if (zoom <= REGION_MAX_ZOOM) return "REGION";
  if (zoom <= DISTRICT_MAX_ZOOM) return "DISTRICT";
  return "VEHICLE";
}

export interface Locatable {
  id: string;
  lat: number | null;
  lon: number | null;
  district_id: string | null;
  free_pallets: number;
}

export interface AreaBubble {
  key: string;
  label: string;
  lat: number;
  lon: number;
  vehicles: number;
  freePallets: number;
}

export function aggregateByRegion<T extends Locatable>(items: T[]): AreaBubble[] {
  const acc = new Map<Region, AreaBubble>();
  for (const it of items) {
    const region = districtById(it.district_id)?.region;
    if (!region) continue;
    const r = REGIONS[region];
    const bubble = acc.get(region) ?? { key: region, label: r.name, lat: r.lat, lon: r.lon, vehicles: 0, freePallets: 0 };
    bubble.vehicles += 1;
    bubble.freePallets += Math.max(it.free_pallets, 0);
    acc.set(region, bubble);
  }
  return [...acc.values()];
}

export function aggregateByDistrict<T extends Locatable>(items: T[]): AreaBubble[] {
  const acc = new Map<string, AreaBubble>();
  for (const it of items) {
    const d = districtById(it.district_id);
    if (!d) continue;
    const bubble = acc.get(d.id) ?? { key: d.id, label: d.name, lat: d.lat, lon: d.lon, vehicles: 0, freePallets: 0 };
    bubble.vehicles += 1;
    bubble.freePallets += Math.max(it.free_pallets, 0);
    acc.set(d.id, bubble);
  }
  return [...acc.values()];
}

export type VehiclePoint<T> =
  | { kind: "vehicle"; item: T; lat: number; lon: number }
  | { kind: "stack"; id: number; count: number; lat: number; lon: number; expansionZoom: number };

/** Nivelul 3: vehicule individuale; cele aflate practic în același loc se grupează. */
export function vehiclePoints<T extends Locatable>(
  items: T[],
  zoom: number,
  bounds: [number, number, number, number],
): VehiclePoint<T>[] {
  const located = items.filter((i): i is T & { lat: number; lon: number } => i.lat !== null && i.lon !== null);
  const index = new Supercluster<{ idx: number }>({ radius: 70, minZoom: DISTRICT_MAX_ZOOM + 1, maxZoom: STACK_MAX_ZOOM });
  index.load(located.map((it, idx) => ({
    type: "Feature",
    properties: { idx },
    geometry: { type: "Point", coordinates: [it.lon, it.lat] },
  })));
  return index.getClusters(bounds, Math.round(zoom)).map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; idx?: number };
    if (props.cluster && props.cluster_id !== undefined) {
      return {
        kind: "stack", id: props.cluster_id, count: props.point_count ?? 0, lat, lon,
        expansionZoom: index.getClusterExpansionZoom(props.cluster_id),
      };
    }
    return { kind: "vehicle", item: located[props.idx as number], lat, lon };
  });
}

export const ALL_DISTRICT_IDS = DISTRICTS.map((d) => d.id);
