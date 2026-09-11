"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { VehicleBlueprintType, getVehicleSvgString } from "@/components/logistics/VehicleBlueprintSVG";

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

// Normalizare nume pentru potrivire exactă cu GeoJSON
function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(mun|raionul|uta)\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
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
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const districtMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const truckMarkersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);

  // Callback-uri globale pentru butoanele de rutare din carduri
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

  // 1. Inițializare Hartă Leaflet
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

    // Dale OpenStreetMap standard
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap · OptiFleet B2B Moldova",
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Încărcare Bariere Teritoriale (GeoJSON Poligoane Raioane Moldova)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    fetch("/data/moldova-districts.geojson")
      .then((res) => res.json())
      .then((geoData) => {
        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.remove();
        }

        const geoLayer = L.geoJSON(geoData, {
          style: (feature) => {
            const shapeName = feature?.properties?.shapeName || "";
            const normShape = normalizeName(shapeName);
            const isSelected =
              selectedDistrict &&
              (normalizeName(selectedDistrict.name).includes(normShape) ||
                normShape.includes(normalizeName(selectedDistrict.name)) ||
                (normShape === "gagauzia" && selectedDistrict.id === "comrat"));

            return {
              color: isSelected ? "#2563eb" : "#94a3b8",
              weight: isSelected ? 2.5 : 1,
              fillColor: isSelected ? "#3b82f6" : "#ffffff",
              fillOpacity: isSelected ? 0.15 : 0.02,
            };
          },
          onEachFeature: (feature, layer) => {
            const shapeName = feature?.properties?.shapeName || "";
            layer.on("click", () => {
              const normShape = normalizeName(shapeName);
              const matched = districts.find(
                (d) =>
                  normalizeName(d.name).includes(normShape) ||
                  normShape.includes(normalizeName(d.name)) ||
                  (normShape === "gagauzia" && d.id === "comrat")
              );
              if (matched) {
                onSelectDistrict(matched);
                map.flyTo([matched.lat, matched.lon], 10, { duration: 0.5 });
              }
            });
          },
        }).addTo(map);

        geoJsonLayerRef.current = geoLayer;
      })
      .catch((err) => {
        console.warn("Nu s-a putut încărca moldova-districts.geojson:", err);
      });
  }, [districts, selectedDistrict, onSelectDistrict]);

  // Actualizare stil barieră teritorială la schimbarea raionului selectat
  useEffect(() => {
    const geoLayer = geoJsonLayerRef.current;
    const map = mapInstanceRef.current;
    if (!geoLayer || !map) return;

    geoLayer.setStyle((feature) => {
      const shapeName = feature?.properties?.shapeName || "";
      const normShape = normalizeName(shapeName);
      const isSelected =
        selectedDistrict &&
        (normalizeName(selectedDistrict.name).includes(normShape) ||
          normShape.includes(normalizeName(selectedDistrict.name)) ||
          (normShape === "gagauzia" && selectedDistrict.id === "comrat"));

      return {
        color: isSelected ? "#2563eb" : "#94a3b8",
        weight: isSelected ? 2.5 : 1,
        fillColor: isSelected ? "#3b82f6" : "#ffffff",
        fillOpacity: isSelected ? 0.16 : 0.02,
      };
    });
  }, [selectedDistrict]);

  // 3. Etichete Denumiri Raioane
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(districtMarkersRef.current).forEach((m) => m.remove());
    districtMarkersRef.current = {};

    districts.forEach((dist) => {
      const isSelected = selectedDistrict?.id === dist.id;

      const trucksInDistrict = availableTrucks.filter(
        (t) => t.currentRaion === dist.id || (dist.id === "chisinau" && t.currentRaion === "chisinau")
      );

      const labelIcon = L.divIcon({
        className: "clean-district-label",
        html: `
          <div class="clean-district-pill ${isSelected ? "is-selected" : ""}">
            <span>${dist.name}</span>
            <span class="count">${trucksInDistrict.length}</span>
          </div>
        `,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });

      const marker = L.marker([dist.lat, dist.lon], { icon: labelIcon, zIndexOffset: 100 }).addTo(map);

      marker.on("click", () => {
        onSelectDistrict(dist);
        map.flyTo([dist.lat, dist.lon], 10, { duration: 0.5 });
      });

      districtMarkersRef.current[dist.id] = marker;
    });
  }, [districts, selectedDistrict, availableTrucks, onSelectDistrict]);

  // 4. Mașinile pe hartă cu schița line-art (SVG), punctele albastre de paleți și GPS ✓ / ✗
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Curățare markeri mașini existenți
    truckMarkersRef.current.forEach((m) => m.remove());
    truckMarkersRef.current = [];

    // Afișăm mașinile din raionul selectat (sau toate dacă Chișinău e activ)
    const activeTrucks = availableTrucks.filter(
      (t) => t.currentRaion === selectedDistrict?.id || selectedDistrict?.id === "chisinau"
    );

    activeTrucks.forEach((t) => {
      const isGpsActive = Boolean(t.gpsTrackerId) && t.speedKmH >= 0;
      const isMoving = t.speedKmH > 0;
      const occupiedPallets = Math.max(0, t.totalPallets - t.freePallets);

      // Generare puncte albastre pentru paleți (Exact cum a cerut utilizatorul)
      let dotsHtml = "";
      if (t.totalPallets > 0) {
        const dots = [];
        for (let i = 0; i < t.totalPallets; i++) {
          if (i < occupiedPallets) {
            dots.push('<span class="pallet-dot-occupied" title="Palet Ocupat"></span>');
          } else {
            dots.push('<span class="pallet-dot-free" title="Loc Palet Liber"></span>');
          }
        }
        dotsHtml = `<div class="pallets-dots-grid">${dots.join("")}</div>`;
      } else {
        dotsHtml = '<div style="font-size:10px; font-weight:600; color:#475569; margin:2px 0;">Platformă Agabaritică (Utilaje Mari & Mașini)</div>';
      }

      // Schiță tehnică line-art extrasă exact ca în imaginea utilizatorului
      const svgString = getVehicleSvgString(t.vehicleType, t.hasConditioner, "#0f172a");

      const cardHtml = `
        <div class="truck-map-card">
          <!-- Desen tehnic Line-Art SVG (exact ca în schița din imagine) -->
          <div class="truck-svg-box">
            ${svgString}
          </div>

          <!-- Header Camion: Număr & Model -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
            <span style="font-family: monospace; font-weight: 800; font-size: 11px; color: #0f172a; background: #f8fafc; border: 1px solid #cbd5e1; padding: 1px 5px; border-radius: 3px;">
              ${t.plate}
            </span>
            <span style="font-weight: 700; font-size: 11px; color: #1d4ed8;">
              ${t.pricePerKm} MDL/km
            </span>
          </div>

          <div style="font-size: 11px; font-weight: 600; color: #1e293b; line-height: 1.2; margin-bottom: 3px;">
            ${t.model}
          </div>

          <!-- Puncte Albastre Paleți (Grad de încărcare) -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 4px 6px; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; font-weight: 600; color: #334155;">
              <span>Capacitate Marfă:</span>
              <span style="color: #2563eb;">${t.totalPallets > 0 ? `${occupiedPallets} ocupate · ${t.freePallets} libere` : 'Agabaritic'}</span>
            </div>
            ${dotsHtml}
          </div>

          <!-- Statut GPS: ✓ sau ✗ (Exact cum a cerut utilizatorul) -->
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
            <div style="font-weight: 800; display: inline-flex; items-center; gap: 4px;">
              ${
                isGpsActive
                  ? `<span style="color: #15803d;">GPS: ✓</span> <span style="font-weight: 500; font-size: 10px; color: #16a34a;">(${isMoving ? t.speedKmH + ' km/h' : 'Staționează'})</span>`
                  : `<span style="color: #dc2626;">GPS: ✗</span> <span style="font-weight: 500; font-size: 10px; color: #ef4444;">(Inactiv)</span>`
              }
            </div>
            <span style="font-size: 10px; color: #64748b; font-weight: 500;">
              ${t.carrierName.split(' ')[0]}
            </span>
          </div>

          <!-- Butoane rapide rutare -->
          <div style="display: flex; gap: 4px; margin-top: 5px; padding-top: 4px; border-top: 1px solid #f1f5f9;">
            <button
              onclick="window.__optifleet_set_start('${t.currentRaion}')"
              style="flex: 1; padding: 3px 0; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 3px; font-size: 10px; font-weight: 600; color: #15803d; cursor: pointer;"
              title="Setează ca plecare (A)"
            >
              Plecare (A)
            </button>
            <button
              onclick="window.__optifleet_set_end('${t.currentRaion}')"
              style="flex: 1; padding: 3px 0; background: #fef2f2; border: 1px solid #fecaca; border-radius: 3px; font-size: 10px; font-weight: 600; color: #b91c1c; cursor: pointer;"
              title="Setează ca sosire (B)"
            >
              Sosire (B)
            </button>
          </div>
        </div>
      `;

      const truckIcon = L.divIcon({
        className: "truck-map-marker",
        html: cardHtml,
        iconSize: [255, 175],
        iconAnchor: [127, 87],
      });

      const truckMarker = L.marker([t.lat, t.lon], { icon: truckIcon, zIndexOffset: 500 }).addTo(map);
      truckMarkersRef.current.push(truckMarker);
    });
  }, [availableTrucks, selectedDistrict]);

  // 5. Traseu Rutier Real (OSRM Polyline)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    if (activeRoute && Array.isArray(activeRoute.coordinates) && activeRoute.coordinates.length > 0) {
      const polyline = L.polyline(activeRoute.coordinates, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);

      polylineRef.current = polyline;

      if (startDistrict) {
        const iconA = L.divIcon({
          className: "clean-district-label",
          html: `
            <div style="background: #16a34a; color: #ffffff; border: 2px solid #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
              A
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const markerA = L.marker([startDistrict.lat, startDistrict.lon], { icon: iconA, zIndexOffset: 1000 }).addTo(map);
        routeMarkersRef.current.push(markerA);
      }

      if (endDistrict) {
        const iconB = L.divIcon({
          className: "clean-district-label",
          html: `
            <div style="background: #dc2626; color: #ffffff; border: 2px solid #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
              B
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const markerB = L.marker([endDistrict.lat, endDistrict.lon], { icon: iconB, zIndexOffset: 1000 }).addTo(map);
        routeMarkersRef.current.push(markerB);
      }

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
