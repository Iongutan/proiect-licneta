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
  coordinates: [number, number][]; // [lat, lng] array
  summaryRoad: string;
  fuelLiters: number;
  estimatedCostMdl: number;
}

interface RealMoldovaMapProps {
  districts: DistrictInfo[];
  selectedDistrict: DistrictInfo | null;
  availableTrucks: AvailableTruck[];
  onSelectDistrict: (district: DistrictInfo) => void;
  onSetRouteStart?: (district: DistrictInfo) => void;
  onSetRouteEnd?: (district: DistrictInfo) => void;
  activeRoute?: CalculatedRoute | null;
  startDistrict?: DistrictInfo | null;
  endDistrict?: DistrictInfo | null;
}

export default function RealMoldovaMap({
  districts,
  selectedDistrict,
  availableTrucks,
  onSelectDistrict,
  onSetRouteStart,
  onSetRouteEnd,
  activeRoute,
  startDistrict,
  endDistrict,
}: RealMoldovaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);

  // Asigurăm disponibilitatea callback-urilor globale pentru butoanele din popup Leaflet
  useEffect(() => {
    (window as any).__optifleet_set_start = (districtId: string) => {
      const d = districts.find((item) => item.id === districtId);
      if (d && onSetRouteStart) onSetRouteStart(d);
    };

    (window as any).__optifleet_set_end = (districtId: string) => {
      const d = districts.find((item) => item.id === districtId);
      if (d && onSetRouteEnd) onSetRouteEnd(d);
    };

    return () => {
      delete (window as any).__optifleet_set_start;
      delete (window as any).__optifleet_set_end;
    };
  }, [districts, onSetRouteStart, onSetRouteEnd]);

  // 1. Inițializare Hartă Leaflet (Curată, simplă, fără elemente AI)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const center: L.LatLngExpression = [47.15, 28.5]; // Centrat pe Republica Moldova

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
      attribution: "© OpenStreetMap · OptiFleet Moldova",
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Etichete Raioane (Doar denumirile raioanelor interactive)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Curățare markeri existenți
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    districts.forEach((dist) => {
      const isSelected = selectedDistrict?.id === dist.id;

      // Camioanele asociate acestui raion
      const trucksInThisDistrict = availableTrucks.filter(
        (t) => t.currentRaion === dist.id || (dist.id === "chisinau" && t.currentRaion === "chisinau")
      );

      // Etichetă simplă, de mână: Doar denumirea la raion interactivă
      const labelIcon = L.divIcon({
        className: "clean-district-label",
        html: `
          <div class="clean-district-pill ${isSelected ? "is-selected" : ""}">
            <span>${dist.name}</span>
            <span class="count">${trucksInThisDistrict.length}</span>
          </div>
        `,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });

      const marker = L.marker([dist.lat, dist.lon], { icon: labelIcon }).addTo(map);

      // Construire popup curat: arată camioanele, pictograme mici și GPS activ/inactiv
      const trucksListHtml =
        trucksInThisDistrict.length > 0
          ? trucksInThisDistrict
              .map((t) => {
                const isMoving = t.speedKmH > 0;
                const isGpsActive = t.speedKmH >= 0 && Boolean(t.gpsTrackerId);

                return `
                <div style="border: 1px solid #e2e8f0; background: #ffffff; border-radius: 6px; padding: 7px 9px; margin-bottom: 6px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="display: flex; items-center: center; gap: 5px; font-weight: 700; font-size: 11px; color: #0f172a;">
                      <span style="font-size: 13px;">🚚</span>
                      <span style="background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-family: monospace; border: 1px solid #cbd5e1;">${t.plate}</span>
                    </span>
                    <span style="font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; color: ${isGpsActive ? "#15803d" : "#64748b"};">
                      <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isGpsActive ? (isMoving ? "#16a34a" : "#2563eb") : "#94a3b8"};"></span>
                      ${isGpsActive ? (isMoving ? `GPS Activ (${t.speedKmH} km/h)` : "GPS Activ (Staționează)") : "GPS Inactiv"}
                    </span>
                  </div>

                  <div style="font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 2px;">
                    ${t.model}
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 4px;">
                    <span style="font-weight: 600; color: #2563eb;">
                      ${t.totalPallets > 0 ? `${t.freePallets} paleți liberi` : "Trailă Utilaje Mari"}
                    </span>
                    <span style="font-weight: 700; color: #0f172a;">
                      ${t.pricePerKm} MDL/km
                    </span>
                  </div>

                  <div style="font-size: 10px; color: #475569; margin-top: 3px;">
                    ${t.carrierName} · <a href="tel:${t.carrierPhone}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${t.carrierPhone}</a>
                  </div>
                </div>
              `;
              })
              .join("")
          : `
            <div style="color: #64748b; font-size: 11px; padding: 12px 0; text-align: center;">
              Niciun camion staționat momentan în acest raion.
            </div>
          `;

      const popupHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 280px; max-height: 340px; overflow-y: auto; padding: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <div>
              <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${dist.name}</div>
              <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">${dist.type}</div>
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 6px; border-radius: 4px;">
              ${trucksInThisDistrict.length} camioane
            </span>
          </div>

          <div>${trucksListHtml}</div>

          <div style="display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
            <button
              onclick="window.__optifleet_set_start('${dist.id}')"
              style="flex: 1; padding: 5px 0; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 11px; font-weight: 600; color: #15803d; cursor: pointer;"
              title="Setează ca punct de plecare (A)"
            >
              Plecare (A)
            </button>
            <button
              onclick="window.__optifleet_set_end('${dist.id}')"
              style="flex: 1; padding: 5px 0; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; font-size: 11px; font-weight: 600; color: #b91c1c; cursor: pointer;"
              title="Setează ca punct de destinație (B)"
            >
              Sosire (B)
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: true,
        autoPan: true,
        offset: [0, -10],
      });

      marker.on("click", () => {
        onSelectDistrict(dist);
        marker.openPopup();
      });

      markersRef.current[dist.id] = marker;
    });
  }, [districts, selectedDistrict, availableTrucks, onSelectDistrict]);

  // 3. Render Rută Reală (Polyline pe drumurile naționale din Moldova)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Curățare traseu anterior
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Curățare markeri rută A și B
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    // Dacă avem o rută activă calculată cu puncte de geometrie
    if (activeRoute && Array.isArray(activeRoute.coordinates) && activeRoute.coordinates.length > 0) {
      // 1. Desenare linie rutieră reală
      const polyline = L.polyline(activeRoute.coordinates, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);

      polylineRef.current = polyline;

      // 2. Adăugare Marker Plecare (A)
      if (startDistrict) {
        const iconA = L.divIcon({
          className: "clean-district-label",
          html: `
            <div style="background: #16a34a; color: #ffffff; border: 2px solid #ffffff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
              A
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const markerA = L.marker([startDistrict.lat, startDistrict.lon], { icon: iconA, zIndexOffset: 1000 }).addTo(map);
        routeMarkersRef.current.push(markerA);
      }

      // 3. Adăugare Marker Destinație (B)
      if (endDistrict) {
        const iconB = L.divIcon({
          className: "clean-district-label",
          html: `
            <div style="background: #dc2626; color: #ffffff; border: 2px solid #ffffff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
              B
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const markerB = L.marker([endDistrict.lat, endDistrict.lon], { icon: iconB, zIndexOffset: 1000 }).addTo(map);
        routeMarkersRef.current.push(markerB);
      }

      // 4. Încadrare automată a rutei pe ecran
      map.fitBounds(polyline.getBounds(), {
        padding: [60, 60],
        maxZoom: 13,
      });
    }
  }, [activeRoute, startDistrict, endDistrict]);

  return (
    <div className="relative w-full h-full bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Buton Re-centrare Hartă Moldova */}
      <button
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([47.15, 28.5], 8, { duration: 0.5 });
          }
        }}
        className="absolute bottom-5 right-5 z-10 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm border border-slate-300 transition-colors flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
        Centrare Moldova
      </button>
    </div>
  );
}
