/**
 * OptiFleet B2B — Visual Clustering Engine (Prompt K3)
 * Implements 3-level Google Maps style progressive clustering:
 *  - Zoom < 8:  Macro-regional aggregate bubbles (Nord, Centru, Sud)
 *  - Zoom 8-10: District-level vehicle counters (Rezina, Soroca, Chișinău etc.)
 *  - Zoom > 10: Individual vehicle line-art markers with pallet status
 */

import Supercluster from "supercluster";

export interface AvailableTruck {
  id: string;
  plate: string;
  currentRaion: string;
  lat: number;
  lon: number;
  freePallets: number;
  totalPallets: number;
  [key: string]: any;
}

export interface MacroRegionCluster {
  id: "nord" | "centru" | "sud";
  name: string;
  lat: number;
  lon: number;
  totalTrucks: number;
  freePallets: number;
  districtIds: string[];
}

export const MACRO_REGIONS: Record<string, { name: string; lat: number; lon: number; districts: string[] }> = {
  nord: {
    name: "Regiunea Nord",
    lat: 47.95,
    lon: 27.75,
    districts: ["balti", "soroca", "edinet", "drochia", "falesti", "briceni"],
  },
  centru: {
    name: "Regiunea Centru",
    lat: 47.15,
    lon: 28.75,
    districts: ["chisinau", "orhei", "ungheni", "hincesti", "straseni", "ialoveni", "rezina", "anenii_noi"],
  },
  sud: {
    name: "Regiunea Sud & Găgăuzia",
    lat: 46.25,
    lon: 28.55,
    districts: ["cahul", "causeni", "comrat", "cimislia", "taraclia", "stefan_voda"],
  },
};

export type ClusterLevel = "REGIONAL" | "DISTRICT" | "VEHICLE";

export interface ClusterOutput {
  level: ClusterLevel;
  zoom: number;
  regionalClusters?: MacroRegionCluster[];
  districtCounts?: Record<string, { count: number; trucks: AvailableTruck[] }>;
  vehicleList?: AvailableTruck[];
}

export function createSuperclusterIndex(trucks: AvailableTruck[]): Supercluster {
  const index = new Supercluster({
    radius: 65,
    maxZoom: 10,
    minZoom: 0,
  });

  const geoJsonPoints = trucks.map((truck) => ({
    type: "Feature" as const,
    properties: {
      cluster: false,
      truckId: truck.id,
      plate: truck.plate,
      currentRaion: truck.currentRaion,
      freePallets: truck.freePallets,
      totalPallets: truck.totalPallets,
    },
    geometry: {
      type: "Point" as const,
      coordinates: [truck.lon, truck.lat],
    },
  }));

  index.load(geoJsonPoints);
  return index;
}

export function getClusterLevel(zoom: number): ClusterLevel {
  if (zoom < 8) return "REGIONAL";
  if (zoom <= 10) return "DISTRICT";
  return "VEHICLE";
}

export function computeClusterView(trucks: AvailableTruck[], zoom: number): ClusterOutput {
  const level = getClusterLevel(zoom);

  if (level === "REGIONAL") {
    // Calculăm totalurile pe cele 3 macro-regiuni ale Moldovei
    const regionalClusters: MacroRegionCluster[] = (
      Object.entries(MACRO_REGIONS) as [
        "nord" | "centru" | "sud",
        (typeof MACRO_REGIONS)[keyof typeof MACRO_REGIONS]
      ][]
    ).map(([id, reg]) => {
      const regTrucks = trucks.filter((t) => reg.districts.includes(t.currentRaion));
      const totalTrucks = regTrucks.length;
      const freePallets = regTrucks.reduce((sum, t) => sum + (t.freePallets || 0), 0);

      return {
        id,
        name: reg.name,
        lat: reg.lat,
        lon: reg.lon,
        totalTrucks,
        freePallets,
        districtIds: reg.districts,
      };
    });

    return {
      level,
      zoom,
      regionalClusters,
    };
  }

  if (level === "DISTRICT") {
    const districtCounts: Record<string, { count: number; trucks: AvailableTruck[] }> = {};

    trucks.forEach((t) => {
      const dId = t.currentRaion || "chisinau";
      if (!districtCounts[dId]) {
        districtCounts[dId] = { count: 0, trucks: [] };
      }
      districtCounts[dId].count++;
      districtCounts[dId].trucks.push(t);
    });

    return {
      level,
      zoom,
      districtCounts,
    };
  }

  // Zoom > 10: Vehicule individuale
  return {
    level,
    zoom,
    vehicleList: trucks,
  };
}
