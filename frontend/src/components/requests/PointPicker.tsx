"use client";

// Alegerea punctului exact de preluare/livrare: clic pe hartă sau tragerea
// pinului. Implicit, centrul raionului ales.

import L from "leaflet";
import { useEffect, useRef } from "react";

export interface LatLon {
  lat: number;
  lon: number;
}

export default function PointPicker({ value, center, onChange, color }: { value: LatLon | null; center: LatLon; onChange: (p: LatLon) => void; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const changeRef = useRef(onChange);

  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: [center.lat, center.lon], zoom: 11, zoomControl: true, attributionControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    const icon = L.divIcon({ className: "", html: `<div class="of-place" style="background:${color}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
    const marker = L.marker([center.lat, center.lon], { icon, draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      changeRef.current({ lat: p.lat, lon: p.lng });
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      changeRef.current({ lat: e.latlng.lat, lon: e.latlng.lng });
    });
    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Harta se creează o singură dată; mutările vin din efectul de mai jos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target = value ?? center;
    markerRef.current?.setLatLng([target.lat, target.lon]);
    if (!value) mapRef.current?.setView([center.lat, center.lon], 11);
  }, [value, center]);

  return <div ref={ref} className="h-44 w-full overflow-hidden rounded-md border border-line" />;
}
