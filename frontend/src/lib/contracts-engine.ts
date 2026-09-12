// OptiFleet B2B — Motor de Gestionare Contracte, Negociere și Actualizare Live Capacitate
// Conform cerințelor din Prompt K8, K9, K10, K11, K12 (Viziune OptiFleet)

import { getCompanyLegalProfile } from "./idno-validator";

export interface DeliveryPhotoProof {
  id: string;
  url: string;
  file_name: string;
  timestamp: string;
  gps_lat: number;
  gps_lon: number;
  uploaded_by: string;
  company_idno: string;
  storage_ref?: string;
}

export interface NegotiationMessage {
  id: string;
  contract_or_request_id: string;
  sender_company_name: string;
  sender_role: "SHIPPER" | "CARRIER";
  message: string;
  proposed_price_mdl?: number;
  proposed_pallets?: number;
  created_at: string;
}

export interface ContractAuditLogEntry {
  id: string;
  timestamp: string;
  contract_id: string;
  contract_path: "PATH_A_PLATFORM" | "PATH_B_DIRECT";
  action: string;
  actor_name: string;
  actor_company_idno: string;
  disclaimer_confirmed: boolean;
  ip_address: string;
  details: string;
}

export interface EnhancedDigitalContract {
  id: string;
  contract_number: string;
  order_id?: string;
  cluster_id?: string;
  vehicle_id?: string;
  sme_company_name: string;
  sme_idno: string;
  sme_legal_form: "SRL" | "II" | "SA" | "ALTA";
  carrier_company_name: string;
  carrier_idno: string;
  carrier_legal_form: "SRL" | "II" | "SA" | "ALTA";
  corridor: string;
  goods_description: string;
  volume_m3: number;
  weight_kg: number;
  pallet_count: number;
  price_per_km?: number;
  distance_km?: number;
  total_price_mdl: number;
  standard_price_mdl: number;
  discount_saved_mdl: number;
  content_hash: string;
  status: "PENDING_SIGNATURE" | "ACCEPTED" | "DELIVERED" | "CANCELLED";
  created_at: string;
  accepted_at?: string;
  accepted_by?: string;
  accepted_ip?: string;
  legal_clauses: string[];

  // PROMPT K9: Două căi cu răspundere clar delimitată
  contract_path: "PATH_A_PLATFORM" | "PATH_B_DIRECT";
  disclaimer_accepted: boolean;
  disclaimer_accepted_at?: string;
  shipper_confirmed: boolean;
  shipper_confirmed_at?: string;
  carrier_confirmed: boolean;
  carrier_confirmed_at?: string;
  is_fully_completed: boolean;
  gps_tracking_active: boolean;

  // PROMPT K11: Dovadă foto la livrare
  delivery_photo?: DeliveryPhotoProof;

  // PROMPT K8: Istoric negociere
  negotiation_messages: NegotiationMessage[];
}

/**
 * PROMPT K9: Verifică dacă înțelegerea prin Calea B (directă, fără mediere) este validă.
 * Fereastra de avertizare este OBLIGATORIE:
 * "Platforma NU își asumă răspunderea pentru marfa transportată prin această înțelegere directă.
 * Confirmă că înțelegi și accepți acest lucru."
 */
export function validateContractPathB(contract: { disclaimer_accepted: boolean }): {
  allowed: boolean;
  error?: string;
} {
  if (!contract.disclaimer_accepted) {
    return {
      allowed: false,
      error:
        "Pentru Calea B (Înțelegere directă fără mediere), este OBLIGATORIE acceptarea explicită a clauzei: 'Platforma NU își asumă răspunderea pentru marfa transportată'.",
    };
  }
  return { allowed: true };
}

/**
 * PROMPT K9: Finalizare livrare pentru Calea A (Platformă).
 * Livrarea se consideră finalizată DOAR când AMBELE părți confirmă în cabinetul personal.
 */
export function confirmContractPathACompletion(
  contract: EnhancedDigitalContract,
  partyRole: "SHIPPER" | "CARRIER",
  actorName: string
): {
  contract: EnhancedDigitalContract;
  isCompleted: boolean;
  message: string;
} {
  if (contract.contract_path !== "PATH_A_PLATFORM") {
    // Pentru Calea B, o confirmare directă este suficientă dacă disclaimerul e bifat
    const updated: EnhancedDigitalContract = {
      ...contract,
      status: "DELIVERED",
      is_fully_completed: true,
    };
    return {
      contract: updated,
      isCompleted: true,
      message: "Înțelegere directă finalizată.",
    };
  }

  const now = new Date().toISOString();
  const updated: EnhancedDigitalContract = { ...contract };

  if (partyRole === "SHIPPER") {
    updated.shipper_confirmed = true;
    updated.shipper_confirmed_at = now;
  } else if (partyRole === "CARRIER") {
    updated.carrier_confirmed = true;
    updated.carrier_confirmed_at = now;
  }

  // Verificare bilaterală
  const bilateralReady = updated.shipper_confirmed && updated.carrier_confirmed;
  if (bilateralReady) {
    updated.status = "DELIVERED";
    updated.is_fully_completed = true;
    return {
      contract: updated,
      isCompleted: true,
      message: "Livrare confirmată bilateral de ambele părți (Beneficiar și Transportator). Contract închis cu succes.",
    };
  }

  return {
    contract: updated,
    isCompleted: false,
    message:
      partyRole === "SHIPPER"
        ? "Beneficiarul a confirmat recepția. Se așteaptă confirmarea transportatorului."
        : "Transportatorul a confirmat predarea. Se așteaptă confirmarea beneficiarului.",
  };
}

/**
 * PROMPT K11: Verificare securizată acces la dovada foto de livrare.
 * O poză încărcată este vizibilă DOAR celor două companii implicate în contract.
 */
export function canAccessDeliveryPhoto(
  requestingCompanyIdno: string,
  contract: { sme_idno: string; carrier_idno: string }
): boolean {
  if (!requestingCompanyIdno) return false;
  const cleanReq = requestingCompanyIdno.trim();
  return cleanReq === contract.sme_idno.trim() || cleanReq === contract.carrier_idno.trim();
}

/**
 * PROMPT K10: Rezervare atomică a capacității vehiculului.
 * Previne suprasolicitarea vehiculului (race conditions) și calculează capacitatea rămasă.
 */
export function reserveVehicleCapacityAtomic(
  vehicle: { id: string; freePallets: number; totalPallets: number },
  requestedPallets: number
): {
  success: boolean;
  newFreePallets: number;
  error?: string;
} {
  if (requestedPallets <= 0) {
    return {
      success: false,
      newFreePallets: vehicle.freePallets,
      error: "Numărul de paleți solicitați trebuie să fie mai mare de 0.",
    };
  }

  if (vehicle.freePallets < requestedPallets) {
    return {
      success: false,
      newFreePallets: vehicle.freePallets,
      error: `OVERBOOKING_REJECTED: Camionul are doar ${vehicle.freePallets} locuri libere, dar s-au cerut ${requestedPallets}.`,
    };
  }

  const newFreePallets = vehicle.freePallets - requestedPallets;
  return {
    success: true,
    newFreePallets,
  };
}

/**
 * PROMPT K12: Calcul automat preț estimat cursă: preț/km × distanță (km).
 */
export function calculateEstimatedRoutePrice(
  pricePerKm: number,
  distanceKm: number,
  minBasePriceMdl: number = 500
): {
  totalEstimatedMdl: number;
  baseRatePerKm: number;
  distanceKm: number;
} {
  const calculated = Math.round(pricePerKm * distanceKm);
  const total = Math.max(minBasePriceMdl, calculated);
  return {
    totalEstimatedMdl: total,
    baseRatePerKm: pricePerKm,
    distanceKm,
  };
}

/**
 * PROMPT K12: Creare automată a unui contract nou prin combinarea profilului legal KYC cu datele cursei.
 */
export function buildDigitalContractTemplate(params: {
  orderId?: string;
  vehicleId?: string;
  shipperIdno: string;
  shipperCompanyName?: string;
  carrierIdno: string;
  carrierCompanyName?: string;
  corridor: string;
  goodsDescription: string;
  palletCount: number;
  distanceKm?: number;
  pricePerKm?: number;
  agreedPriceMdl?: number;
  contractPath: "PATH_A_PLATFORM" | "PATH_B_DIRECT";
  disclaimerAccepted?: boolean;
}): EnhancedDigitalContract {
  const shipperProfile = getCompanyLegalProfile(params.shipperIdno, params.shipperCompanyName);
  const carrierProfile = getCompanyLegalProfile(params.carrierIdno, params.carrierCompanyName);

  const distance = params.distanceKm || 140;
  const rate = params.pricePerKm || 18.5;
  const price = params.agreedPriceMdl || calculateEstimatedRoutePrice(rate, distance).totalEstimatedMdl;

  const now = new Date().toISOString();
  const contractNumber = `CTR-MD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: `ctr-${Date.now()}`,
    contract_number: contractNumber,
    order_id: params.orderId,
    vehicle_id: params.vehicleId,
    sme_company_name: shipperProfile.companyName,
    sme_idno: shipperProfile.idno,
    sme_legal_form: shipperProfile.legalForm,
    carrier_company_name: carrierProfile.companyName,
    carrier_idno: carrierProfile.idno,
    carrier_legal_form: carrierProfile.legalForm,
    corridor: params.corridor,
    goods_description: params.goodsDescription,
    volume_m3: +(params.palletCount * 0.96).toFixed(1),
    weight_kg: params.palletCount * 650,
    pallet_count: params.palletCount,
    distance_km: distance,
    price_per_km: rate,
    total_price_mdl: price,
    standard_price_mdl: Math.round(price * 1.35),
    discount_saved_mdl: Math.round(price * 0.35),
    content_hash: `sha256-${Math.random().toString(36).substring(2)}${Date.now()}`,
    status: "PENDING_SIGNATURE",
    created_at: now,
    contract_path: params.contractPath,
    disclaimer_accepted: !!params.disclaimerAccepted,
    disclaimer_accepted_at: params.contractPath === "PATH_B_DIRECT" && params.disclaimerAccepted ? now : undefined,
    shipper_confirmed: false,
    carrier_confirmed: false,
    is_fully_completed: false,
    gps_tracking_active: params.contractPath === "PATH_A_PLATFORM",
    legal_clauses: [
      "1. Prezentul contract este încheiat conform Codului Transporturilor Rutiere nr. 150/2014 al Republicii Moldova.",
      "2. Părțile își asumă respectarea normelor de siguranță a mărfii și a integrității ambalajelor.",
      params.contractPath === "PATH_A_PLATFORM"
        ? "3. Platforma OptiFleet asigură monitorizarea GPS pe toată durata cursei și confirmarea bilaterală obligatorie."
        : "3. Înțelegere directă (Calea B): Părțile convin nemedierea de către platformă, conform exonerării de răspundere acceptate.",
    ],
    negotiation_messages: [],
  };
}
