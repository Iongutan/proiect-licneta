// Tipuri pentru schema Supabase v2 (supabase/sql/02_tables.sql).
// Coloanele geografice vin prin PostgREST ca GeoJSON sau EWKB hex — de aceea
// le citim prin coloane calculate în interogări (lat/lon) sau le ignorăm.

export type BodyType = "VAN" | "RIGID" | "CURTAINSIDE" | "REEFER" | "ROAD_TRAIN" | "LOWBED" | "RAIL_WAGON" | "DRONE";
export type TransportMode = "ROAD" | "RAIL" | "AIR";
export type Ownership = "OWNED" | "LEASED" | "RENTED";
export type CompanyKind = "SHIPPER" | "CARRIER" | "BOTH";
export type LegalForm = "SRL" | "II" | "SA" | "GT" | "ALTA";
export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type VehicleStatus = "AVAILABLE" | "ON_ROUTE" | "MAINTENANCE" | "OFFLINE";
export type RequestStatus = "OPEN" | "BOOKED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
export type BookingStatus =
  | "NEGOTIATING" | "AGREED" | "CONTRACTED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "REJECTED";
export type ContractPath = "PLATFORM" | "DIRECT";
export type PalletFormat = "EUR" | "INDUSTRIAL" | "CUSTOM";
export type Side = "SHIPPER" | "CARRIER";

export interface Company {
  id: string;
  name: string;
  legal_form: LegalForm;
  idno: string;
  kind: CompanyKind;
  district_id: string | null;
  address: string | null;
  phone: string | null;
  kyc_status: KycStatus;
  kyc_note: string | null;
  verified_at: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  company_id: string;
  full_name: string | null;
  company_role: "ADMIN" | "MEMBER" | "DRIVER";
}

export interface Vehicle {
  id: string;
  company_id: string;
  plate: string;
  make_model: string;
  body_type: BodyType;
  cargo_length_cm: number;
  cargo_width_cm: number;
  cargo_height_cm: number;
  max_payload_kg: number;
  pallet_capacity: number;
  has_reefer: boolean;
  price_per_km: number | null;
  gps_device_id: string | null;
  gps_protocol: "TELTONIKA" | "CONCOX" | "WIALON" | "MANUAL";
  status: VehicleStatus;
  is_listed: boolean;
  district_id: string | null;
  speed_kmh: number | null;
  heading: number | null;
  position_at: string | null;
  trip_origin_id: string | null;
  trip_destination_id: string | null;
  trip_departure_at: string | null;
  trip_distance_km: number | null;
  trip_duration_min: number | null;
  occupied_pallets: number;
  occupied_weight_kg: number;
  booked_pallets: number;
  booked_weight_kg: number;
  free_pallets: number;
  updated_at: string;
  transport_mode: TransportMode;
  ownership: Ownership;
  ownership_until: string | null;
  service_district_ids: string[];
}

/** Rândul din vehicles_map (vezi fetchMapVehicles): vehicul + coordonate + firmă. */
export interface MapVehicle extends Vehicle {
  lat: number | null;
  lon: number | null;
  company_name: string;
}

export interface VehicleLoad {
  id: string;
  vehicle_id: string;
  x_cm: number;
  y_cm: number;
  length_cm: number;
  width_cm: number;
  format: PalletFormat;
  weight_kg: number;
  status: "OCCUPIED" | "RESERVED";
  booking_id: string | null;
  label: string | null;
}

export interface FreightRequest {
  id: string;
  company_id: string;
  origin_district_id: string;
  origin_address: string | null;
  destination_district_id: string;
  destination_address: string | null;
  pallets: number;
  pallet_format: "EUR" | "INDUSTRIAL" | "MIXED";
  weight_kg: number;
  body_type: BodyType | null;
  needs_reefer: boolean;
  vehicles_needed: number;
  ready_from: string;
  deliver_by: string;
  cargo_description: string | null;
  budget_mdl: number | null;
  status: RequestStatus;
  created_at: string;
}

export interface Booking {
  id: string;
  vehicle_id: string;
  request_id: string | null;
  shipper_company_id: string;
  carrier_company_id: string;
  initiated_by: Side;
  pallets: number;
  weight_kg: number;
  pickup_district_id: string;
  dropoff_district_id: string;
  pickup_at: string | null;
  price_mdl: number | null;
  price_proposed_by: Side | null;
  status: BookingStatus;
  path: ContractPath | null;
  disclaimer_accepted_at: string | null;
  contract_snapshot: ContractSnapshot | null;
  contract_hash: string | null;
  shipper_signed_at: string | null;
  carrier_signed_at: string | null;
  capacity_reserved: boolean;
  shipper_delivery_confirmed_at: string | null;
  carrier_delivery_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractParty {
  name: string;
  legal_form: LegalForm;
  idno: string;
  address: string | null;
}

export interface ContractSnapshot {
  template: string;
  booking_id: string;
  issued_at: string;
  shipper: ContractParty;
  carrier: ContractParty;
  vehicle: { plate: string; make_model: string; body_type: BodyType };
  cargo: { pallets: number; weight_kg: number };
  route: { pickup: string; dropoff: string; pickup_at: string | null };
  price_mdl: number;
  clauses: string[];
}

export interface BookingMessage {
  id: string;
  booking_id: string;
  sender_company_id: string;
  body: string;
  price_mdl: number | null;
  created_at: string;
}

export interface DeliveryProof {
  id: string;
  booking_id: string;
  storage_path: string;
  lat: number | null;
  lon: number | null;
  taken_at: string;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface TripMatch {
  vehicle_id: string;
  match_type: "DIRECT" | "TRANSIT" | "NEARBY" | "AT_ORIGIN" | "IN_AREA";
  eta_origin: string | null;
  eta_destination: string | null;
  offset_km: number;
  plate: string;
  make_model: string;
  body_type: BodyType;
  company_id: string;
  company_name: string;
  free_pallets: number;
  pallet_capacity: number;
  price_per_km: number | null;
  lat: number | null;
  lon: number | null;
  trip_origin_id: string | null;
  trip_destination_id: string | null;
  trip_departure_at: string | null;
}
