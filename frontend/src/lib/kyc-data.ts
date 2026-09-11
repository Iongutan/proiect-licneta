// OptiFleet B2B — Modele și Date de Test pentru Securitate, KYC, Contracte Digitale și Modul Financiar
// Conform standardelor comerciale B2B și Legislației Republicii Moldova (ANTA, ASP, Legea 133/2011)

export interface CompanyKyc {
  id: string;
  company_name: string;
  legal_type: "SRL" | "II" | "SA";
  idno: string;
  idno_valid: boolean;
  anta_license_number?: string;
  anta_license_valid?: boolean;
  anta_license_expiry?: string;
  address: string;
  city: string;
  admin_name: string;
  phone: string;
  email: string;
  role_type: "SME" | "CARRIER" | "SUPPLIER";
  documents: Array<{
    id: string;
    doc_type: "ASP_EXTRACT" | "ANTA_LICENSE" | "CMR_INSURANCE" | "ADMIN_ID";
    file_name: string;
    file_size_kb: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    uploaded_at: string;
  }>;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  rejection_reason?: string;
  verified_at?: string;
  created_at: string;
}

export interface DigitalContract {
  id: string;
  contract_number: string;
  order_id?: string;
  cluster_id?: string;
  sme_company_name: string;
  sme_idno: string;
  carrier_company_name: string;
  carrier_idno: string;
  corridor: string;
  goods_description: string;
  volume_m3: number;
  weight_kg: number;
  total_price_mdl: number;
  standard_price_mdl: number;
  discount_saved_mdl: number;
  content_hash: string; // SHA-256 hash al clauzelor
  status: "PENDING_SIGNATURE" | "ACCEPTED" | "CANCELLED";
  created_at: string;
  accepted_at?: string;
  accepted_by?: string;
  accepted_ip?: string;
  legal_clauses: string[];
}

export interface Invoice {
  id: string;
  invoice_number: string;
  company_name: string;
  company_idno: string;
  company_type: "SME" | "CARRIER";
  order_or_cluster_id: string;
  service_description: string;
  total_amount_mdl: number;
  carrier_payout_mdl: number;
  platform_fee_mdl: number; // Comision OptiFleet (6%)
  status: "PAID" | "PENDING_PAYMENT" | "OVERDUE";
  issue_date: string;
  due_date: string;
  paid_at?: string;
  payment_method?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address: string;
  status: "SUCCESS" | "WARNING" | "BLOCKED";
}

// ─── Seturi Inițiale de Date Demonstrative ─────────────────────────────────

export const INITIAL_KYC_COMPANIES: CompanyKyc[] = [
  {
    id: "kyc_001",
    company_name: "TransMoldova Express Î.I.",
    legal_type: "II",
    idno: "1004600034567",
    idno_valid: true,
    anta_license_number: "ANTA-MD-2024-8841",
    anta_license_valid: true,
    anta_license_expiry: "2027-04-15",
    address: "str. Industriilor 4, Bălți",
    city: "Bălți",
    admin_name: "Vasile Cojocaru",
    phone: "+373 68 445 566",
    email: "vasile.cojocaru@transmoldova.md",
    role_type: "CARRIER",
    documents: [
      { id: "doc_101", doc_type: "ASP_EXTRACT", file_name: "extras_asp_transmoldova.pdf", file_size_kb: 420, status: "PENDING", uploaded_at: "2026-09-10T14:30:00Z" },
      { id: "doc_102", doc_type: "ANTA_LICENSE", file_name: "licenta_anta_transport.pdf", file_size_kb: 680, status: "PENDING", uploaded_at: "2026-09-10T14:32:00Z" },
    ],
    status: "PENDING_VERIFICATION",
    created_at: "2026-09-10T14:28:00Z",
  },
  {
    id: "kyc_002",
    company_name: "NordLact Distribution SRL",
    legal_type: "SRL",
    idno: "1005600045678",
    idno_valid: true,
    address: "str. Ștefan cel Mare 102, Bălți",
    city: "Bălți",
    admin_name: "Ecaterina Rusu",
    phone: "+373 69 554 433",
    email: "office@nordlact.md",
    role_type: "SME",
    documents: [
      { id: "doc_103", doc_type: "ASP_EXTRACT", file_name: "certificat_inregistrare_nordlact.pdf", file_size_kb: 510, status: "PENDING", uploaded_at: "2026-09-11T09:15:00Z" },
      { id: "doc_104", doc_type: "ADMIN_ID", file_name: "buletin_administrator_rusu.pdf", file_size_kb: 340, status: "PENDING", uploaded_at: "2026-09-11T09:16:00Z" },
    ],
    status: "PENDING_VERIFICATION",
    created_at: "2026-09-11T09:10:00Z",
  },
  {
    id: "kyc_003",
    company_name: "TechMold Logistics SRL",
    legal_type: "SRL",
    idno: "1003600012345",
    idno_valid: true,
    anta_license_number: "ANTA-MD-2023-1029",
    anta_license_valid: true,
    anta_license_expiry: "2028-11-20",
    address: "str. Uzinelor 14, Chișinău",
    city: "Chișinău",
    admin_name: "Mihail Dumitru",
    phone: "+373 69 112 233",
    email: "logistica@techmold.md",
    role_type: "CARRIER",
    documents: [
      { id: "doc_105", doc_type: "ASP_EXTRACT", file_name: "extras_techmold.pdf", file_size_kb: 450, status: "APPROVED", uploaded_at: "2026-08-01T10:00:00Z" },
      { id: "doc_106", doc_type: "ANTA_LICENSE", file_name: "licenta_anta_techmold.pdf", file_size_kb: 720, status: "APPROVED", uploaded_at: "2026-08-01T10:02:00Z" },
      { id: "doc_107", doc_type: "CMR_INSURANCE", file_name: "asigurare_cmr_valida.pdf", file_size_kb: 890, status: "APPROVED", uploaded_at: "2026-08-01T10:05:00Z" },
    ],
    status: "VERIFIED",
    verified_at: "2026-08-02T11:00:00Z",
    created_at: "2026-08-01T09:45:00Z",
  },
  {
    id: "kyc_004",
    company_name: "AgroSupply SA",
    legal_type: "SA",
    idno: "1002600023456",
    idno_valid: true,
    address: "str. Calea Basarabiei 8, Chișinău",
    city: "Chișinău",
    admin_name: "Gheorghe Cebotari",
    phone: "+373 60 332 211",
    email: "achizitii@agrosupply.md",
    role_type: "SME",
    documents: [
      { id: "doc_108", doc_type: "ASP_EXTRACT", file_name: "extras_registru_agrosupply.pdf", file_size_kb: 590, status: "APPROVED", uploaded_at: "2026-08-15T12:00:00Z" },
    ],
    status: "VERIFIED",
    verified_at: "2026-08-15T16:20:00Z",
    created_at: "2026-08-15T11:30:00Z",
  },
  {
    id: "kyc_005",
    company_name: "SudAgro Comercial SRL",
    legal_type: "SRL",
    idno: "1007600067890",
    idno_valid: true,
    address: "str. Republicii 22, Cahul",
    city: "Cahul",
    admin_name: "Alexandru Moraru",
    phone: "+373 79 889 900",
    email: "contact@sudagro.md",
    role_type: "SME",
    documents: [
      { id: "doc_109", doc_type: "ASP_EXTRACT", file_name: "extras_sudagro.pdf", file_size_kb: 390, status: "APPROVED", uploaded_at: "2026-08-20T10:00:00Z" },
    ],
    status: "VERIFIED",
    verified_at: "2026-08-21T09:00:00Z",
    created_at: "2026-08-20T09:40:00Z",
  },
];

export const INITIAL_DIGITAL_CONTRACTS: DigitalContract[] = [
  {
    id: "ctr_001",
    contract_number: "CTR-MD-2026-0812",
    order_id: "ord_md_001",
    cluster_id: "cl_nord_01",
    sme_company_name: "TechMold SRL",
    sme_idno: "1003600012345",
    carrier_company_name: "TransMoldova Express Î.I.",
    carrier_idno: "1004600034567",
    corridor: "Chișinău (M5) ➔ Bălți",
    goods_description: "Componente electronice și piese industriale (3 paleți standard)",
    volume_m3: 2.4,
    weight_kg: 450,
    total_price_mdl: 1450,
    standard_price_mdl: 3200,
    discount_saved_mdl: 1750,
    content_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    status: "ACCEPTED",
    created_at: "2026-09-10T16:00:00Z",
    accepted_at: "2026-09-10T16:15:22Z",
    accepted_by: "Vasile Cojocaru (Administrator)",
    accepted_ip: "185.108.128.45",
    legal_clauses: [
      "1. Părțile convin executarea transportului conform Codului Transporturilor Rutiere al RM nr. 150/2014.",
      "2. Transportatorul garantează deținerea poliței de asigurare a mărfii CMR valabilă pe teritoriul RM.",
      "3. Tariful este fixat conform ofertei de grupare GroupLog și nu poate fi modificat unilateral.",
      "4. Confirmarea recepției mărfii se efectuează digital prin geolocalizare GPS și cod PIN unic la destinație.",
    ],
  },
  {
    id: "ctr_002",
    contract_number: "CTR-MD-2026-0813",
    order_id: "ord_md_002",
    cluster_id: "cl_nord_01",
    sme_company_name: "AgroSupply SA",
    sme_idno: "1002600023456",
    carrier_company_name: "TransMoldova Express Î.I.",
    carrier_idno: "1004600034567",
    corridor: "Chișinău (M5) ➔ Bălți",
    goods_description: "Semințe hibrid și ambalaje biodegradabile",
    volume_m3: 5.1,
    weight_kg: 1200,
    total_price_mdl: 2200,
    standard_price_mdl: 5400,
    discount_saved_mdl: 3200,
    content_hash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    status: "PENDING_SIGNATURE",
    created_at: "2026-09-11T10:00:00Z",
    legal_clauses: [
      "1. Părțile convin executarea transportului conform Codului Transporturilor Rutiere al RM nr. 150/2014.",
      "2. Transportatorul garantează deținerea poliței de asigurare a mărfii CMR valabilă pe teritoriul RM.",
      "3. Tariful este fixat conform ofertei de grupare GroupLog și nu poate fi modificat unilateral.",
      "4. Confirmarea recepției mărfii se efectuează digital prin geolocalizare GPS și cod PIN unic la destinație.",
    ],
  },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv_001",
    invoice_number: "FACT-2026-0041",
    company_name: "TechMold SRL",
    company_idno: "1003600012345",
    company_type: "SME",
    order_or_cluster_id: "ord_md_001",
    service_description: "Serviciu transport marfă grupată Chișinău - Bălți",
    total_amount_mdl: 1450,
    carrier_payout_mdl: 1363,
    platform_fee_mdl: 87, // 6%
    status: "PAID",
    issue_date: "2026-09-08",
    due_date: "2026-09-15",
    paid_at: "2026-09-09 11:24",
    payment_method: "TRANSFER_BANCAR_IBAN",
  },
  {
    id: "inv_002",
    invoice_number: "FACT-2026-0042",
    company_name: "Vinăria Purcari (Depozit)",
    company_idno: "1003600056789",
    company_type: "SME",
    order_or_cluster_id: "ord_md_003",
    service_description: "Serviciu transport marfă paletizată Chișinău - Orhei",
    total_amount_mdl: 1850,
    carrier_payout_mdl: 1739,
    platform_fee_mdl: 111,
    status: "PAID",
    issue_date: "2026-09-09",
    due_date: "2026-09-16",
    paid_at: "2026-09-10 14:10",
    payment_method: "CARD_MASTERCARD_VISA",
  },
  {
    id: "inv_003",
    invoice_number: "FACT-2026-0043",
    company_name: "AgroSupply SA",
    company_idno: "1002600023456",
    company_type: "SME",
    order_or_cluster_id: "ord_md_002",
    service_description: "Serviciu transport consolidat Bălți (cl_nord_01)",
    total_amount_mdl: 2200,
    carrier_payout_mdl: 2068,
    platform_fee_mdl: 132,
    status: "PENDING_PAYMENT",
    issue_date: "2026-09-10",
    due_date: "2026-09-17",
  },
  {
    id: "inv_004",
    invoice_number: "FACT-2026-0038",
    company_name: "SudAgro Comercial SRL",
    company_idno: "1007600067890",
    company_type: "SME",
    order_or_cluster_id: "ord_md_005",
    service_description: "Serviciu transport individual Chișinău - Cahul",
    total_amount_mdl: 2750,
    carrier_payout_mdl: 2585,
    platform_fee_mdl: 165,
    status: "OVERDUE", // Neachitat / Restant (depășit termenul)
    issue_date: "2026-08-25",
    due_date: "2026-09-01",
  },
  {
    id: "inv_005",
    invoice_number: "FACT-2026-0039",
    company_name: "Farmacia Familiei Logistics",
    company_idno: "1008600078901",
    company_type: "SME",
    order_or_cluster_id: "ord_md_006",
    service_description: "Serviciu curierat Ungheni produse farmaceutice",
    total_amount_mdl: 950,
    carrier_payout_mdl: 893,
    platform_fee_mdl: 57,
    status: "PENDING_PAYMENT",
    issue_date: "2026-09-11",
    due_date: "2026-09-18",
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "log_01",
    timestamp: "2026-09-11 15:10:22",
    actor_name: "Administrator Sistem",
    actor_email: "admin@optifleet.md",
    actor_role: "SUPER_ADMIN",
    action: "KYC_APPROVE_COMPANY",
    entity_type: "company",
    entity_id: "kyc_003",
    ip_address: "188.138.1.10",
    status: "SUCCESS",
  },
  {
    id: "log_02",
    timestamp: "2026-09-11 14:05:18",
    actor_name: "Vasile Cojocaru",
    actor_email: "vasile.cojocaru@transmoldova.md",
    actor_role: "CARRIER_ADMIN",
    action: "CONTRACT_DIGITAL_ACCEPT",
    entity_type: "contract",
    entity_id: "ctr_001",
    ip_address: "185.108.128.45",
    status: "SUCCESS",
  },
  {
    id: "log_03",
    timestamp: "2026-09-11 12:44:02",
    actor_name: "Sistem Automat",
    actor_email: "system@optifleet.md",
    actor_role: "SYSTEM",
    action: "DBSCAN_CVRP_CLUSTER_OPTIMIZED",
    entity_type: "cluster",
    entity_id: "cl_nord_01",
    ip_address: "127.0.0.1",
    status: "SUCCESS",
  },
  {
    id: "log_04",
    timestamp: "2026-09-11 10:12:40",
    actor_name: "Utilizator Anonim",
    actor_email: "unknown@scanner.io",
    actor_role: "ANONYMOUS",
    action: "BLOCKED_SQL_INJECTION_ATTEMPT",
    entity_type: "auth",
    entity_id: "none",
    ip_address: "45.154.255.89",
    status: "BLOCKED",
  },
];
