"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { VehicleBlueprintType } from "@/components/logistics/VehicleBlueprintSVG";

export interface AvailableTruck {
  id: string;
  plate: string;
  model: string;
  vehicleType: VehicleBlueprintType;
  carrierName: string;
  carrierPhone: string;
  driverName: string;
  pricePerKm: number; // MDL / km
  hasConditioner: boolean;
  totalPallets: number;
  freePallets: number;
  isVerifiedANTA: boolean;
  gpsTrackerId: string;
  currentRaion: string;
  destinationScope: "INTERN" | "INTERNATIONAL";
  availableNow: boolean;
  speedKmH: number;
  fuelLevelPercent: number;
  temperatureCelsius?: number;
  lat: number;
  lon: number;
}

export interface DistrictInfo {
  id: string;
  name: string;
  type: "MUNICIPIU" | "RAION" | "AUTONOMIE";
  lat: number;
  lon: number;
  trucksCount: number;
  activeOrdersCount: number;
}

export interface CalculatedRoute {
  id: string;
  name: string;
  distanceKm: number;
  durationMinutes: number;
  durationFormatted: string;
  coordinates: [number, number][]; // [lat, lng]
  summaryRoad: string;
  fuelLiters: number;
  estimatedCostMdl: number;
}

interface RealMoldovaMapProps {
  districts: DistrictInfo[];
  selectedDistrict: DistrictInfo;
  availableTrucks: AvailableTruck[];
  onSelectDistrict: (district: DistrictInfo) => void;
  onSelectTruck?: (truck: AvailableTruck) => void;
  scopeFilter?: "ALL" | "INTERN" | "INTERNATIONAL";
  activeRoutes?: CalculatedRoute[];
  selectedRouteId?: string;
  onSelectRouteId?: (id: string) => void;
  startDistrict?: DistrictInfo;
  endDistrict?: DistrictInfo;
}

export default function RealMoldovaMap({
  districts,
  selectedDistrict,
  availableTrucks,
  onSelectDistrict,
  onSelectTruck,
  scopeFilter = "ALL",
  activeRoutes = [],
  selectedRouteId,
  onSelectRouteId,
  startDistrict,
  endDistrict,
}: RealMoldovaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const districtMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const truckMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const routePolylinesRef = useRef<L.Polyline[]>([]);
  const routeMarkersRef = useRef<L.Marker[]>([]);

  // Inițializare Hartă Leaflet cu OpenStreetMap Real
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const center: L.LatLngExpression = [47.0105, 28.8638]; // Chișinău

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 8,
      minZoom: 7,
      maxZoom: 16,
      zoomControl: true,
    });

    // Dale OpenStreetMap standard curate
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap · OptiFleet GPS Moldova",
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Randare Rute Reale OSRM (Google Maps Style)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Curățare polilinii și markeri vechi
    routePolylinesRef.current.forEach((p) => p.remove());
    routePolylinesRef.current = [];
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    if (activeRoutes.length > 0) {
      // 1. Randează poliliniile rutelor (Alternativa mai întâi, apoi Traseul Activ)
      const nonSelected = activeRoutes.filter((r) => r.id !== selectedRouteId);
      const selected = activeRoutes.find((r) => r.id === selectedRouteId) || activeRoutes[0];

      // Ruta alternativă (linie gri / albastru deschis punctat)
      nonSelected.forEach((r) => {
        const poly = L.polyline(r.coordinates, {
          color: "#94a3b8",
          weight: 5,
          opacity: 0.7,
          dashArray: "6 8",
        }).addTo(map);

        poly.on("click", () => {
          if (onSelectRouteId) onSelectRouteId(r.id);
        });

        routePolylinesRef.current.push(poly);
      });

      // Ruta principală selectată (linie albastră solidă tip Google Maps)
      if (selected && selected.coordinates.length > 0) {
        // Linie de bordură pentru efect de umbră Google Maps
        const shadowPoly = L.polyline(selected.coordinates, {
          color: "#1e40af",
          weight: 8,
          opacity: 0.3,
        }).addTo(map);
        routePolylinesRef.current.push(shadowPoly);

        const activePoly = L.polyline(selected.coordinates, {
          color: "#2563eb",
          weight: 6,
          opacity: 0.95,
        }).addTo(map);

        activePoly.on("click", () => {
          if (onSelectRouteId) onSelectRouteId(selected.id);
        });

        routePolylinesRef.current.push(activePoly);

        // Zoom automat pe traseul calculat
        const bounds = activePoly.getBounds();
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }

      // 2. Markere Origine (A - Verde) și Destinație (B - Roșu) tip Google Maps
      if (startDistrict) {
        const pinA = L.divIcon({
          className: "gmaps-pin-a",
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#16a34a;color:#ffffff;font-weight:bold;font-size:14px;box-shadow:0 3px 8px rgba(0,0,0,0.35);border:2px solid #ffffff;">
              A
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const mStart = L.marker([startDistrict.lat, startDistrict.lon], { icon: pinA }).addTo(map);
        routeMarkersRef.current.push(mStart);
      }

      if (endDistrict) {
        const pinB = L.divIcon({
          className: "gmaps-pin-b",
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#dc2626;color:#ffffff;font-weight:bold;font-size:14px;box-shadow:0 3px 8px rgba(0,0,0,0.35);border:2px solid #ffffff;">
              B
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const mEnd = L.marker([endDistrict.lat, endDistrict.lon], { icon: pinB }).addTo(map);
        routeMarkersRef.current.push(mEnd);
      }
    }
  }, [activeRoutes, selectedRouteId, startDistrict, endDistrict, onSelectRouteId]);

  // Randare Markere Raioane Administrative
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(districtMarkersRef.current).forEach((m) => m.remove());
    districtMarkersRef.current = {};

    districts.forEach((dist) => {
      const isSelected = dist.id === selectedDistrict.id;

      const icon = L.divIcon({
        className: "district-pin",
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: pointer;
          ">
            <div style="
              width: ${isSelected ? "22px" : "14px"};
              height: ${isSelected ? "22px" : "14px"};
              border-radius: 50%;
              background: ${isSelected ? "#2563eb" : "#475569"};
              border: 2px solid #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
            ">
              ${isSelected ? '<div style="width:6px;height:6px;border-radius:50%;background:#ffffff;"></div>' : ""}
            </div>
            <div style="
              position: absolute;
              top: ${isSelected ? "24px" : "16px"};
              left: 50%;
              transform: translateX(-50%);
              background: ${isSelected ? "#1e40af" : "#ffffff"};
              color: ${isSelected ? "#ffffff" : "#0f172a"};
              border: 1px solid ${isSelected ? "#1e40af" : "#cbd5e1"};
              font-weight: ${isSelected ? "bold" : "600"};
              font-size: 11px;
              padding: 2px 6px;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.12);
              white-space: nowrap;
              pointer-events: none;
            ">
              ${dist.name} (${dist.trucksCount})
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([dist.lat, dist.lon], { icon }).addTo(map);

      marker.on("click", () => {
        onSelectDistrict(dist);
        map.flyTo([dist.lat, dist.lon], 10, { duration: 0.8 });
      });

      districtMarkersRef.current[dist.id] = marker;
    });
  }, [districts, selectedDistrict, onSelectDistrict]);

  // Randare Camioane Live pe Hartă cu Statut GPS
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(truckMarkersRef.current).forEach((m) => m.remove());
    truckMarkersRef.current = {};

    const filtered = availableTrucks.filter((t) => {
      if (scopeFilter === "ALL") return true;
      return t.destinationScope === scopeFilter;
    });

    filtered.forEach((truck) => {
      const isMoving = truck.speedKmH > 0;
      const truckIcon = L.divIcon({
        className: "truck-marker",
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 4px;
            background: #ffffff;
            border: 1.5px solid ${isMoving ? "#16a34a" : "#2563eb"};
            padding: 3px 6px;
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            cursor: pointer;
            white-space: nowrap;
          ">
            <span style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${isMoving ? "#16a34a" : "#3b82f6"};
            "></span>
            <span style="font-family: monospace; font-size: 11px; font-weight: bold; color: #0f172a;">
              ${truck.plate}
            </span>
            <span style="font-size: 10px; color: ${isMoving ? "#15803d" : "#64748b"}; font-weight: 600;">
              ${isMoving ? `${truck.speedKmH} km/h` : "Parcat"}
            </span>
          </div>
        `,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });

      const marker = L.marker([truck.lat, truck.lon], { icon: truckIcon }).addTo(map);

      marker.on("click", () => {
        if (onSelectTruck) onSelectTruck(truck);
      });

      truckMarkersRef.current[truck.id] = marker;
    });
  }, [availableTrucks, scopeFilter, onSelectTruck]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Buton Re-centrare Hartă Moldova */}
      <button
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([47.0105, 28.8638], 8, { duration: 0.8 });
          }
        }}
        className="absolute bottom-6 right-6 z-10 bg-white/95 hover:bg-white text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg shadow-md border border-slate-200 transition-all flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
        Centrare Republica Moldova
      </button>
    </div>
  );
}
