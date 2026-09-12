"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { VehicleBlueprintType, getVehicleSvgString, PlacedPallet } from "@/components/logistics/VehicleBlueprintSVG";
import { computeClusterView, getClusterLevel, ClusterLevel } from "@/lib/clustering";

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
  customPallets?: PlacedPallet[];
  layoutOrientation?: "2_WIDE" | "3_LONG";
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
  onSelectTruck?: (truck: AvailableTruck) => void;
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
  onSelectTruck,
  onSetRouteStart,
  onSetRouteEnd,
  activeRoute,
  startDistrict,
  endDistrict,
}: RealMoldovaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(8);

  const regionalMarkersRef = useRef<L.Marker[]>([]);
  const districtMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const truckMarkersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);

  // Callback-uri globale pentru interacțiunea din DOM-ul Leaflet
  useEffect(() => {
    (window as any).__optifleet_select_truck = (truckId: string) => {
      const t = availableTrucks.find((item) => item.id === truckId);
      if (t && onSelectTruck) onSelectTruck(t);
    };

    (window as any).__optifleet_set_start = (districtId: string) => {
      const d = districts.find((item) => item.id === districtId);
      if (d && onSetRouteStart) onSetRouteStart(d);
    };

    (window as any).__optifleet_set_end = (districtId: string) => {
      const d = districts.find((item) => item.id === districtId);
      if (d && onSetRouteEnd) onSetRouteEnd(d);
    };

    return () => {
      delete (window as any).__optifleet_select_truck;
      delete (window as any).__optifleet_set_start;
      delete (window as any).__optifleet_set_end;
    };
  }, [availableTrucks, districts, onSelectTruck, onSetRouteStart, onSetRouteEnd]);

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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap · OptiFleet B2B Moldova",
    }).addTo(map);

    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

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
                map.flyTo([matched.lat, matched.lon], 11, { duration: 0.5 });
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

  // 3. CLUSTERING VIZUAL PE 3 NIVELURI DE ZOOM (Prompt K3)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const clusterView = computeClusterView(availableTrucks, currentZoom);

    // Curățare markeri existenți
    regionalMarkersRef.current.forEach((m) => m.remove());
    regionalMarkersRef.current = [];

    Object.values(districtMarkersRef.current).forEach((m) => m.remove());
    districtMarkersRef.current = {};

    truckMarkersRef.current.forEach((m) => m.remove());
    truckMarkersRef.current = [];

    // ── NIVEL 1: Zoom Mic (< 8) -> Cercuri Agregate Macro-Regiuni ──
    if (clusterView.level === "REGIONAL" && clusterView.regionalClusters) {
      clusterView.regionalClusters.forEach((reg) => {
        const clusterIcon = L.divIcon({
          className: "regional-cluster-marker",
          html: `
            <div class="regional-cluster-badge" title="Clic pentru a mări Regiunea ${reg.name}">
              <span class="regional-cluster-count">${reg.totalTrucks} camioane</span>
              <span>${reg.name}</span>
              <span class="regional-cluster-sub">(${reg.freePallets} paleți liberi)</span>
            </div>
          `,
          iconSize: [200, 36],
          iconAnchor: [100, 18],
        });

        const marker = L.marker([reg.lat, reg.lon], { icon: clusterIcon, zIndexOffset: 200 }).addTo(map);
        marker.on("click", () => {
          map.flyTo([reg.lat, reg.lon], 9, { duration: 0.6 });
        });

        regionalMarkersRef.current.push(marker);
      });
      return;
    }

    // ── NIVEL 2: Zoom Mediu (8 - 10) -> Subgrupe pe Raioane Individuale ──
    if (clusterView.level === "DISTRICT") {
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
          iconSize: [120, 26],
          iconAnchor: [60, 13],
        });

        const marker = L.marker([dist.lat, dist.lon], { icon: labelIcon, zIndexOffset: 100 }).addTo(map);
        marker.on("click", () => {
          onSelectDistrict(dist);
          map.flyTo([dist.lat, dist.lon], 11, { duration: 0.5 });
        });

        districtMarkersRef.current[dist.id] = marker;
      });
      return;
    }

    // ── NIVEL 3: Zoom Mare (> 10) -> Vehicule Individuale ca Markeri Line-Art ──
    if (clusterView.level === "VEHICLE") {
      const activeTrucks = availableTrucks.filter(
        (t) => !selectedDistrict || t.currentRaion === selectedDistrict.id || selectedDistrict.id === "chisinau"
      );

      activeTrucks.forEach((t) => {
        const isGpsActive = Boolean(t.gpsTrackerId) && t.speedKmH >= 0;
        const occupiedPallets = Math.max(0, t.totalPallets - t.freePallets);

        const svgString = getVehicleSvgString(
          t.vehicleType,
          t.hasConditioner,
          "#0f172a",
          "left",
          t.customPallets,
          occupiedPallets,
          t.layoutOrientation || "2_WIDE"
        );

        const locatorHtml = `
          <div class="truck-map-locator" onclick="window.__optifleet_select_truck('${t.id}')" title="Clic pentru a inspecta vehiculul ${t.plate}">
            <div class="truck-locator-badge">
              <div class="truck-svg-holder">
                ${svgString}
              </div>
              <div class="truck-locator-footer">
                <span class="locator-plate">${t.plate}</span>
                <span class="${isGpsActive ? "locator-gps-active" : "locator-gps-inactive"}">
                  GPS ${isGpsActive ? "●" : "✗"}
                </span>
                <span style="color: #2563eb; font-weight: 700;">
                  ${t.totalPallets > 0 ? `${t.freePallets} liberi` : "Utilaj"}
                </span>
              </div>
            </div>
            <div class="truck-locator-stem"></div>
            <div class="truck-locator-anchor-circle">
              <div class="pulse-center-dot"></div>
            </div>
          </div>
        `;

        const truckIcon = L.divIcon({
          className: "truck-map-marker",
          html: locatorHtml,
          iconSize: [142, 68],
          iconAnchor: [71, 68],
        });

        const truckMarker = L.marker([t.lat, t.lon], { icon: truckIcon, zIndexOffset: 500 }).addTo(map);
        truckMarkersRef.current.push(truckMarker);
      });
    }
  }, [availableTrucks, currentZoom, districts, selectedDistrict, onSelectDistrict]);

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
