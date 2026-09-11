// OptiFleet & GroupLog B2B — Date Demonstrative Scenariul Moldova
// Utilizate pentru Vercel Demo Mode și fallback când backend-ul local este offline

export interface DemoOrder {
  id: string;
  company_name: string;
  status: "PENDING" | "CLUSTERED" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  volume_m3: number;
  weight_kg: number;
  pickup_address: string;
  pickup_lat: number;
  pickup_lon: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lon: number;
  delivery_window_start: string;
  delivery_window_end: string;
  cluster_id?: string;
  cluster_name?: string;
  estimated_discount_pct?: number;
  created_at: string;
}

export interface DemoVehicle {
  id: string;
  license_plate: string;
  model: string;
  capacity_m3: number;
  max_weight_kg: number;
  current_volume_used_m3: number;
  current_weight_used_kg: number;
  status: "AVAILABLE" | "ON_ROUTE" | "MAINTENANCE" | "OFFLINE";
  current_city: string;
  current_lat: number;
  current_lon: number;
  driver_name: string;
  phone: string;
}

export interface DemoCluster {
  id: string;
  name: string;
  corridor: string;
  vehicle_assigned?: string;
  total_volume_m3: number;
  total_weight_kg: number;
  orders_count: number;
  orders_ids: string[];
  total_standard_cost_mdl: number;
  group_discounted_cost_mdl: number;
  total_saved_mdl: number;
  avg_discount_pct: number;
  status: "FORMING" | "OPTIMIZED" | "DISPATCHED" | "COMPLETED";
}

export const MOLDOVA_HUBS = [
  { name: "Chișinău (Hub Central)", lat: 47.0105, lon: 28.8638, type: "MAIN_DEPOT", count: 42 },
  { name: "Bălți (Hub Nord)", lat: 47.754, lon: 27.9261, type: "REGIONAL_HUB", count: 18 },
  { name: "Cahul (Hub Sud)", lat: 45.9075, lon: 28.1944, type: "REGIONAL_HUB", count: 12 },
  { name: "Orhei", lat: 47.3831, lon: 28.8239, type: "TRANSIT_POINT", count: 9 },
  { name: "Ungheni", lat: 47.2058, lon: 27.7958, type: "TRANSIT_POINT", count: 7 },
  { name: "Comrat (UTA Găgăuzia)", lat: 46.3, lon: 28.65, type: "TRANSIT_POINT", count: 5 },
];

export const INITIAL_DEMO_ORDERS: DemoOrder[] = [
  {
    id: "ord_md_001",
    company_name: "TechMold SRL",
    status: "CLUSTERED",
    volume_m3: 2.4,
    weight_kg: 450,
    pickup_address: "str. Uzinelor 12, Chișinău",
    pickup_lat: 47.0035,
    pickup_lon: 28.8892,
    dropoff_address: "str. Decebal 13, Bălți",
    dropoff_lat: 47.7612,
    dropoff_lon: 27.9214,
    delivery_window_start: new Date(Date.now() + 3600000).toISOString(),
    delivery_window_end: new Date(Date.now() + 28800000).toISOString(),
    cluster_id: "cl_nord_01",
    cluster_name: "Coridor Nord: Chișinău → Bălți",
    estimated_discount_pct: 54.5,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "ord_md_002",
    company_name: "AgroSupply SA",
    status: "CLUSTERED",
    volume_m3: 5.1,
    weight_kg: 1200,
    pickup_address: "str. Calea Basarabiei 8, Chișinău",
    pickup_lat: 47.0091,
    pickup_lon: 28.8654,
    dropoff_address: "str. Ștefan cel Mare 45, Bălți",
    dropoff_lat: 47.7554,
    dropoff_lon: 27.9302,
    delivery_window_start: new Date(Date.now() + 7200000).toISOString(),
    delivery_window_end: new Date(Date.now() + 32400000).toISOString(),
    cluster_id: "cl_nord_01",
    cluster_name: "Coridor Nord: Chișinău → Bălți",
    estimated_discount_pct: 61.2,
    created_at: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: "ord_md_003",
    company_name: "Vinăria Purcari (Depozit)",
    status: "CLUSTERED",
    volume_m3: 3.8,
    weight_kg: 950,
    pickup_address: "bd. Dacia 58, Chișinău (Aeroport)",
    pickup_lat: 46.9421,
    pickup_lon: 28.921,
    dropoff_address: "str. Vasile Lupu 18, Orhei",
    dropoff_lat: 47.3789,
    dropoff_lon: 28.8256,
    delivery_window_start: new Date(Date.now() + 5400000).toISOString(),
    delivery_window_end: new Date(Date.now() + 25200000).toISOString(),
    cluster_id: "cl_nord_01",
    cluster_name: "Coridor Nord: Chișinău → Bălți",
    estimated_discount_pct: 58.0,
    created_at: new Date(Date.now() - 4800000).toISOString(),
  },
  {
    id: "ord_md_004",
    company_name: "MoldovaRetail Distribution",
    status: "IN_TRANSIT",
    volume_m3: 4.2,
    weight_kg: 1100,
    pickup_address: "str. Mesager 1, Chișinău",
    pickup_lat: 47.0381,
    pickup_lon: 28.8091,
    dropoff_address: "str. 31 August 4, Cahul",
    dropoff_lat: 45.9012,
    dropoff_lon: 28.1978,
    delivery_window_start: new Date(Date.now() - 3600000).toISOString(),
    delivery_window_end: new Date(Date.now() + 14400000).toISOString(),
    cluster_id: "cl_sud_02",
    cluster_name: "Coridor Sud: Chișinău → Cahul",
    estimated_discount_pct: 48.5,
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "ord_md_005",
    company_name: "SudAgro Comercial",
    status: "IN_TRANSIT",
    volume_m3: 3.5,
    weight_kg: 850,
    pickup_address: "str. Industrială 3, Chișinău",
    pickup_lat: 47.0189,
    pickup_lon: 28.8741,
    dropoff_address: "str. Republicii 22, Cahul",
    dropoff_lat: 45.9123,
    dropoff_lon: 28.1895,
    delivery_window_start: new Date(Date.now() - 3600000).toISOString(),
    delivery_window_end: new Date(Date.now() + 14400000).toISOString(),
    cluster_id: "cl_sud_02",
    cluster_name: "Coridor Sud: Chișinău → Cahul",
    estimated_discount_pct: 44.0,
    created_at: new Date(Date.now() - 9000000).toISOString(),
  },
  {
    id: "ord_md_006",
    company_name: "Farmacia Familiei Logistics",
    status: "PENDING",
    volume_m3: 1.5,
    weight_kg: 280,
    pickup_address: "str. Petricani 17, Chișinău",
    pickup_lat: 47.0512,
    pickup_lon: 28.8354,
    dropoff_address: "str. Națională 10, Ungheni",
    dropoff_lat: 47.2084,
    dropoff_lon: 27.7981,
    delivery_window_start: new Date(Date.now() + 10800000).toISOString(),
    delivery_window_end: new Date(Date.now() + 39600000).toISOString(),
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "ord_md_007",
    company_name: "ProFood SRL",
    status: "DELIVERED",
    volume_m3: 3.2,
    weight_kg: 720,
    pickup_address: "str. Alba Iulia 75, Chișinău",
    pickup_lat: 47.0398,
    pickup_lon: 28.7654,
    dropoff_address: "bd. Mircea cel Bătrân 14, Chișinău",
    dropoff_lat: 47.0421,
    dropoff_lon: 28.8891,
    delivery_window_start: new Date(Date.now() - 86400000).toISOString(),
    delivery_window_end: new Date(Date.now() - 72000000).toISOString(),
    cluster_id: "cl_urban_03",
    cluster_name: "Chișinău Urban Express",
    estimated_discount_pct: 62.0,
    created_at: new Date(Date.now() - 95000000).toISOString(),
  },
  {
    id: "ord_md_008",
    company_name: "NordLact Distribution",
    status: "PENDING",
    volume_m3: 2.8,
    weight_kg: 620,
    pickup_address: "str. Industriilor 5, Bălți",
    pickup_lat: 47.7491,
    pickup_lon: 27.9152,
    dropoff_address: "str. Sarmizegetusa 15, Chișinău",
    dropoff_lat: 46.9921,
    dropoff_lon: 28.8712,
    delivery_window_start: new Date(Date.now() + 14400000).toISOString(),
    delivery_window_end: new Date(Date.now() + 43200000).toISOString(),
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
];

export const INITIAL_DEMO_VEHICLES: DemoVehicle[] = [
  {
    id: "veh_01",
    license_plate: "C-AA 101",
    model: "Mercedes-Benz Sprinter 316 CDI",
    capacity_m3: 14.0,
    max_weight_kg: 1800,
    current_volume_used_m3: 5.4,
    current_weight_used_kg: 720,
    status: "AVAILABLE",
    current_city: "Chișinău",
    current_lat: 47.0105,
    current_lon: 28.8638,
    driver_name: "Ion Rotaru",
    phone: "+373 69 112 233",
  },
  {
    id: "veh_02",
    license_plate: "B-BB 202",
    model: "MAN TGL 8.190 Box Truck",
    capacity_m3: 32.0,
    max_weight_kg: 4500,
    current_volume_used_m3: 11.3,
    current_weight_used_kg: 2600,
    status: "ON_ROUTE",
    current_city: "Orhei (în tranzit spre Bălți)",
    current_lat: 47.3831,
    current_lon: 28.8239,
    driver_name: "Vasile Cojocaru",
    phone: "+373 68 445 566",
  },
  {
    id: "veh_03",
    license_plate: "C-CC 303",
    model: "Iveco Daily 35S15",
    capacity_m3: 18.0,
    max_weight_kg: 2200,
    current_volume_used_m3: 7.7,
    current_weight_used_kg: 1950,
    status: "ON_ROUTE",
    current_city: "Hîncești (în tranzit spre Cahul)",
    current_lat: 46.8286,
    current_lon: 28.5917,
    driver_name: "Mihai Sandu",
    phone: "+373 60 778 899",
  },
  {
    id: "veh_04",
    license_plate: "C-DD 404",
    model: "Volvo FL 250 Rigid Truck",
    capacity_m3: 40.0,
    max_weight_kg: 6000,
    current_volume_used_m3: 0.0,
    current_weight_used_kg: 0,
    status: "AVAILABLE",
    current_city: "Bălți",
    current_lat: 47.754,
    current_lon: 27.9261,
    driver_name: "Andrei Moraru",
    phone: "+373 79 334 455",
  },
  {
    id: "veh_05",
    license_plate: "C-EE 505",
    model: "Renault Master dCi 150",
    capacity_m3: 12.5,
    max_weight_kg: 1500,
    current_volume_used_m3: 0.0,
    current_weight_used_kg: 0,
    status: "MAINTENANCE",
    current_city: "Chișinău Service Centru",
    current_lat: 47.025,
    current_lon: 28.845,
    driver_name: "Radu Grosu",
    phone: "+373 69 990 011",
  },
];

export const INITIAL_DEMO_CLUSTERS: DemoCluster[] = [
  {
    id: "cl_nord_01",
    name: "Coridor Nord: Chișinău ➔ Orhei ➔ Bălți",
    corridor: "Traseul M5 / R6 (131.8 km)",
    vehicle_assigned: "MAN TGL 8.190 (B-BB 202)",
    total_volume_m3: 11.3,
    total_weight_kg: 2600,
    orders_count: 3,
    orders_ids: ["ord_md_001", "ord_md_002", "ord_md_003"],
    total_standard_cost_mdl: 6800,
    group_discounted_cost_mdl: 2960,
    total_saved_mdl: 3840,
    avg_discount_pct: 57.9,
    status: "OPTIMIZED",
  },
  {
    id: "cl_sud_02",
    name: "Coridor Sud: Chișinău ➔ Hîncești ➔ Cahul",
    corridor: "Traseul R3 / E584 (168.4 km)",
    vehicle_assigned: "Iveco Daily 35S15 (C-CC 303)",
    total_volume_m3: 7.7,
    total_weight_kg: 1950,
    orders_count: 2,
    orders_ids: ["ord_md_004", "ord_md_005"],
    total_standard_cost_mdl: 5400,
    group_discounted_cost_mdl: 2750,
    total_saved_mdl: 2650,
    avg_discount_pct: 46.3,
    status: "DISPATCHED",
  },
  {
    id: "cl_urban_03",
    name: "Chișinău Urban Express",
    corridor: "Centru ➔ Botanica ➔ Ciocana",
    vehicle_assigned: "Mercedes Sprinter (C-AA 101)",
    total_volume_m3: 5.4,
    total_weight_kg: 720,
    orders_count: 3,
    orders_ids: ["ord_md_007"],
    total_standard_cost_mdl: 3200,
    group_discounted_cost_mdl: 1220,
    total_saved_mdl: 1980,
    avg_discount_pct: 62.0,
    status: "COMPLETED",
  },
];
