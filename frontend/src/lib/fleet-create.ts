"use client";

// Crearea unei unități de transport — folosită de constructorul pas cu pas și
// de asistentul din „Flota mea”, ca ambele să scrie exact la fel în baza de date.

import type { BodyType, Ownership } from "./db-types";
import { dbBrowser, errorMessage } from "./db-browser";
import { DISTRICTS } from "./districts";
import { BODY_SPECS } from "./vehicle-catalog";

export interface NewUnit {
  bodyType: BodyType;
  plate: string;
  makeModel: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  payloadKg: number;
  pallets: number;
  hasReefer: boolean;
  pricePerKm: string;
  ownership: Ownership;
  ownershipUntil?: string;
  area: string[];
  gpsProtocol: "TELTONIKA" | "CONCOX" | "WIALON" | "MANUAL";
  gpsDeviceId: string;
  districtId: string;
  crewName?: string;
  crewPhone?: string;
}

export async function createUnit(companyId: string, u: NewUnit): Promise<{ id: string } | { error: string }> {
  const spec = BODY_SPECS[u.bodyType];
  const db = dbBrowser();
  const district = DISTRICTS.find((x) => x.id === u.districtId);
  const { data, error } = await db
    .from("vehicles")
    .insert({
      company_id: companyId,
      plate: u.plate.trim(),
      make_model: u.makeModel.trim(),
      body_type: u.bodyType,
      cargo_length_cm: u.lengthCm,
      cargo_width_cm: u.widthCm,
      cargo_height_cm: u.heightCm,
      max_payload_kg: u.payloadKg,
      pallet_capacity: u.pallets,
      has_reefer: u.hasReefer,
      price_per_km: u.pricePerKm.trim() === "" ? null : Number(u.pricePerKm),
      ownership: u.ownership,
      ownership_until: u.ownership !== "OWNED" && u.ownershipUntil ? u.ownershipUntil : null,
      service_district_ids: spec.needsArea ? u.area : [],
      gps_protocol: u.gpsProtocol,
      gps_device_id: u.gpsProtocol === "MANUAL" ? null : u.gpsDeviceId.trim(),
      district_id: u.districtId,
      // Poziția inițială = centrul raionului; trackerul o actualizează apoi.
      position: district ? `SRID=4326;POINT(${district.lon} ${district.lat})` : null,
      position_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.code === "23505" ? `Există deja o unitate cu acest ${spec.idLabel.toLowerCase()}.` : errorMessage(error) };
  }
  if (spec.hasCrew && (u.crewName?.trim() || u.crewPhone?.trim())) {
    await db.from("vehicle_private").insert({
      vehicle_id: data.id, driver_name: u.crewName?.trim() || null, driver_phone: u.crewPhone?.trim() || null,
    });
  }
  return { id: data.id as string };
}
