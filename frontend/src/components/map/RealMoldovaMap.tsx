"use client";

// Harta Moldovei (Leaflet + OpenStreetMap) cu agregare pe 3 niveluri (K3).
// Securitate: markerii sunt construiți din date escapate (escapeHtml) și din
// SVG-uri numerice; click-urile se leagă prin evenimente Leaflet, nu prin
// atribute onclick sau funcții globale pe window.

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { approximatePallets, vehicleSvgMarkup } from "@/components/logistics/vehicle-drawing";
import { aggregateByDistrict, aggregateByRegion, levelForZoom, vehiclePoints, STACK_MAX_ZOOM } from "@/lib/clustering";
import type { MapVehicle } from "@/lib/db-types";
import { normalizeText, type District } from "@/lib/districts";

const MOLDOVA_CENTER: L.LatLngTuple = [47.2, 28.5];
const MOLDOVA_BOUNDS = L.latLngBounds([45.35, 26.4], [48.6, 30.3]);

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const shapeToDistrictId = (shapeName: string) => {
  const id = normalizeText(shapeName).replace(/ /g, "_");
  return id === "transnistria" ? "stinga_nistrului" : id;
};

interface Props {
  vehicles: MapVehicle[];
  selectedId: string | null;
  /** Vehiculele din rezultatele căutării (restul se estompează). */
  highlightIds: Set<string> | null;
  route: GeoJSON.LineString | null;
  origin: District | null;
  destination: District | null;
  focusDistrictId: string | null;
  onSelectVehicle: (id: string) => void;
}

export default function RealMoldovaMap({ vehicles, selectedId, highlightIds, route, origin, destination, focusDistrictId, onSelectVehicle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const bordersRef = useRef<L.GeoJSON | null>(null);
  const selectRef = useRef(onSelectVehicle);
  const [view, setView] = useState({ zoom: 7, bounds: [26.4, 45.35, 30.3, 48.6] as [number, number, number, number] });

  useEffect(() => {
    selectRef.current = onSelectVehicle;
  }, [onSelectVehicle]);

  // Inițializare (o singură dată)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: MOLDOVA_CENTER, zoom: 7, minZoom: 6, maxZoom: 17,
      maxBounds: MOLDOVA_BOUNDS.pad(0.6), zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    overlayRef.current = L.layerGroup().addTo(map);

    const sync = () => {
      const b = map.getBounds();
      setView({ zoom: map.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    };
    map.on("moveend zoomend", sync);
    sync();

    // Limitele raioanelor (o singură încărcare, fișier static)
    const controller = new AbortController();
    fetch("/data/moldova-districts.geojson", { signal: controller.signal })
      .then((r) => r.json())
      .then((geo: GeoJSON.FeatureCollection) => {
        bordersRef.current = L.geoJSON(geo, {
          interactive: false,
          style: () => ({ color: "#94a3b8", weight: 1, fillColor: "#2563eb", fillOpacity: 0 }),
        }).addTo(map);
        bordersRef.current.bringToBack();
      })
      .catch(() => undefined);

    mapRef.current = map;
    return () => {
      controller.abort();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Evidențierea raioanelor A/B
  useEffect(() => {
    bordersRef.current?.setStyle((feature) => {
      const id = shapeToDistrictId(String(feature?.properties?.shapeName ?? ""));
      const active = id === origin?.id || id === destination?.id || id === focusDistrictId;
      return { color: active ? "#2563eb" : "#94a3b8", weight: active ? 2 : 1, fillColor: "#2563eb", fillOpacity: active ? 0.06 : 0 };
    });
  }, [origin, destination, focusDistrictId, vehicles.length]);

  // Markeri pe nivelul de zoom curent (K3)
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const level = levelForZoom(view.zoom);

    if (level === "REGION" || level === "DISTRICT") {
      const bubbles = level === "REGION" ? aggregateByRegion(vehicles) : aggregateByDistrict(vehicles);
      for (const b of bubbles) {
        const html = level === "REGION"
          ? `<div class="of-bubble" style="width:${58 + Math.min(b.vehicles, 60)}px;height:${58 + Math.min(b.vehicles, 60)}px"><strong>${b.vehicles}</strong><span>${escapeHtml(b.label)}</span></div>`
          : `<div class="of-district">${escapeHtml(b.label)}<b>${b.vehicles}</b></div>`;
        const size = level === "REGION" ? 58 + Math.min(b.vehicles, 60) : 120;
        const marker = L.marker([b.lat, b.lon], {
          icon: L.divIcon({ className: "", html, iconSize: level === "REGION" ? [size, size] : undefined, iconAnchor: level === "REGION" ? [size / 2, size / 2] : [40, 12] }),
          keyboard: true, title: `${b.label}: ${b.vehicles} vehicule, ${b.freePallets} paleți liberi`,
        });
        marker.on("click", () => map.flyTo([b.lat, b.lon], level === "REGION" ? 9 : 11, { duration: 0.5 }));
        layer.addLayer(marker);
      }
      return;
    }

    for (const p of vehiclePoints(vehicles, view.zoom, view.bounds)) {
      if (p.kind === "stack") {
        const marker = L.marker([p.lat, p.lon], {
          icon: L.divIcon({ className: "", html: `<div class="of-stack">${p.count}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
          title: `${p.count} vehicule`,
        });
        marker.on("click", () => map.flyTo([p.lat, p.lon], Math.min(p.expansionZoom, STACK_MAX_ZOOM + 1), { duration: 0.4 }));
        layer.addLayer(marker);
        continue;
      }
      const v = p.item;
      const dim = highlightIds && !highlightIds.has(v.id);
      const occupied = v.pallet_capacity - v.free_pallets;
      const svg = vehicleSvgMarkup(v.body_type, approximatePallets(v.body_type, occupied, v.cargo_length_cm, v.cargo_width_cm), v.cargo_length_cm, 1.1);
      const gpsFresh = v.position_at && Date.now() - new Date(v.position_at).getTime() < 30 * 60_000;
      const html = `<div class="of-truck${v.id === selectedId ? " is-selected" : ""}" style="opacity:${dim ? 0.35 : 1}">
        <div class="of-truck-card">${svg}<span class="plate">${escapeHtml(v.plate)}</span>
        <span class="free">${v.pallet_capacity ? `${v.free_pallets} libere` : "utilaj"}</span>${gpsFresh ? "" : '<span class="gps-off">GPS vechi</span>'}</div>
        <div class="of-truck-pin"></div></div>`;
      const marker = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: "", html, iconSize: [190, 44], iconAnchor: [95, 44] }),
        title: `${v.plate} — ${v.make_model}`, keyboard: true, zIndexOffset: v.id === selectedId ? 1000 : dim ? 0 : 500,
      });
      marker.on("click", () => selectRef.current(v.id));
      layer.addLayer(marker);
    }
  }, [vehicles, view, selectedId, highlightIds]);

  // Traseul vehiculului selectat + punctele A/B ale căutării
  useEffect(() => {
    const map = mapRef.current;
    const layer = overlayRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    if (route) {
      const latlngs = route.coordinates.map(([lon, lat]) => [lat, lon] as L.LatLngTuple);
      L.polyline(latlngs, { color: "#2563eb", weight: 4, opacity: 0.85 }).addTo(layer);
      bounds.push(...latlngs);
    }
    for (const [d, color, label] of [[origin, "#15803d", "A"], [destination, "#b91c1c", "B"]] as const) {
      if (!d) continue;
      L.marker([d.lat, d.lon], {
        icon: L.divIcon({ className: "", html: `<div class="of-place" style="background:${color}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] }),
        title: `${label}: ${d.name}`, interactive: false,
      }).addTo(layer);
      bounds.push([d.lat, d.lon]);
    }
    if (bounds.length >= 2) map.flyToBounds(L.latLngBounds(bounds), { padding: [80, 80], maxZoom: 11, duration: 0.6 });
    else if (bounds.length === 1) map.flyTo(bounds[0], 10, { duration: 0.6 });
  }, [route, origin, destination]);

  return <div ref={containerRef} className="h-full w-full" />;
}
