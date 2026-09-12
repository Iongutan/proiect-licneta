// OptiFleet B2B — GoF Architecture & Repository Pattern (TypeScript)
// Adapter Pattern + Proxy Pattern + Fallback Pattern pentru Vercel & Live API

import {
  INITIAL_DEMO_ORDERS,
  INITIAL_DEMO_VEHICLES,
  INITIAL_DEMO_CLUSTERS,
  DemoOrder,
  DemoVehicle,
  DemoCluster,
} from "./demo-data";
import {
  CompanyKyc,
  DigitalContract,
  Invoice,
  AuditLogEntry,
  INITIAL_KYC_COMPANIES,
  INITIAL_DIGITAL_CONTRACTS,
  INITIAL_INVOICES,
  INITIAL_AUDIT_LOGS,
} from "./kyc-data";

export type { CompanyKyc, DigitalContract, Invoice, AuditLogEntry };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// ─── Interfaces (Interface Segregation Principle) ───────────────────────────

export interface Order {
  id: string;
  company_name?: string;
  status: "PENDING" | "CLUSTERED" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  volume_m3: number;
  weight_kg: number;
  pickup_address?: string;
  pickup_lat?: number;
  pickup_lon?: number;
  dropoff_address?: string;
  dropoff_lat?: number;
  dropoff_lon?: number;
  delivery_window_start: string;
  delivery_window_end: string;
  cluster_id?: string;
  cluster_name?: string;
  estimated_discount_pct?: number;
  created_at: string;
}

export interface CreateOrderDto {
  company_name?: string;
  volume_m3: number;
  weight_kg: number;
  pickup_lat: number;
  pickup_lon: number;
  dropoff_lat: number;
  dropoff_lon: number;
  pickup_address?: string;
  dropoff_address?: string;
  delivery_window_start: string;
  delivery_window_end: string;
  special_instructions?: string;
}

export interface Vehicle {
  id: string;
  license_plate: string;
  model?: string;
  capacity_m3: number;
  max_weight_kg: number;
  current_volume_used_m3?: number;
  current_weight_used_kg?: number;
  status: "AVAILABLE" | "ON_ROUTE" | "MAINTENANCE" | "OFFLINE";
  current_city?: string;
  current_lat?: number;
  current_lon?: number;
  driver_name?: string;
  phone?: string;
}

export interface Cluster {
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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Repository Interface (Dependency Inversion Principle) ─────────────────

export interface IOrderRepository {
  listOrders(params?: { limit?: number; offset?: number }): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  createOrder(dto: CreateOrderDto): Promise<Order>;
  cancelOrder(id: string): Promise<void>;
  clusterOrders(): Promise<{ clustersCreated: number; totalSavedMdl: number }>;
}

export interface IVehicleRepository {
  listVehicles(): Promise<Vehicle[]>;
}

export interface IClusterRepository {
  listClusters(): Promise<Cluster[]>;
}

export interface IChatService {
  chatStream(messages: ChatMessage[]): AsyncGenerator<string>;
}

export interface IAdminRepository {
  listKycRequests(): Promise<CompanyKyc[]>;
  reviewKyc(id: string, status: "VERIFIED" | "REJECTED", reason?: string): Promise<void>;
  submitKyc(data: Partial<CompanyKyc>): Promise<CompanyKyc>;
  listContracts(): Promise<DigitalContract[]>;
  acceptContract(id: string, acceptedBy: string): Promise<DigitalContract>;
  listInvoices(): Promise<Invoice[]>;
  markInvoicePaid(id: string, method?: string): Promise<void>;
  listAuditLogs(): Promise<AuditLogEntry[]>;
}

// ─── 1. Remote API Adapter (Axum Rust Backend) ─────────────────────────────

export class RemoteApiAdapter
  implements
    IOrderRepository,
    IVehicleRepository,
    IClusterRepository,
    IChatService,
    IAdminRepository {
  // PROMPT J4: Access token-ul se păstrează STRICT în memorie (variabilă JS).
  // Refresh token-ul este securizat într-un cookie httpOnly, inaccesibil din JS.
  private token: string | null = null;
  private isRefreshing: Promise<string | null> | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
  }

  /**
   * PROMPT J4: Reînnoiește access token-ul folosind cookie-ul httpOnly securizat.
   * Endpoint-ul /api/v1/auth/refresh citește automat cookie-ul httpOnly și emite un nou token.
   */
  async refreshAccessToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return this.isRefreshing;
    }

    this.isRefreshing = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // trimite cookie-ul httpOnly refresh_token
        });

        if (!response.ok) {
          this.token = null;
          return null;
        }

        const data = await response.json();
        if (data.access_token) {
          this.token = data.access_token;
          return data.access_token;
        }
        return null;
      } catch (err) {
        console.warn("Autorefresh token failed:", err);
        return null;
      } finally {
        this.isRefreshing = null;
      }
    })();

    return this.isRefreshing;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, isRetry: boolean = false): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: "include", // suport pentru cookies securizate
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    if (response.status === 401 && !isRetry && !endpoint.includes("/auth/")) {
      // Token expirat — încearcă reînnoirea transparentă via cookie httpOnly
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        return this.request<T>(endpoint, options, true);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: "Request failed" } }));
      throw new ApiError(response.status, errorData.error?.code ?? "API_ERROR", errorData.error?.message ?? "Request failed");
    }

    return response.json();
  }

  async listOrders(params?: { limit?: number; offset?: number }): Promise<Order[]> {
    const qs = params ? new URLSearchParams(params as unknown as Record<string, string>).toString() : "";
    return this.request<Order[]>(`/orders${qs ? `?${qs}` : ""}`);
  }

  async getOrder(id: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}`);
  }

  async createOrder(data: CreateOrderDto): Promise<Order> {
    return this.request<Order>("/orders", { method: "POST", body: JSON.stringify(data) });
  }

  async cancelOrder(id: string): Promise<void> {
    return this.request<void>(`/orders/${id}/cancel`, { method: "POST" });
  }

  async clusterOrders(): Promise<{ clustersCreated: number; totalSavedMdl: number }> {
    return this.request<{ clustersCreated: number; totalSavedMdl: number }>("/clusters/run", { method: "POST" });
  }

  async listVehicles(): Promise<Vehicle[]> {
    return this.request<Vehicle[]>("/vehicles");
  }

  async listClusters(): Promise<Cluster[]> {
    return this.request<Cluster[]>("/clusters");
  }

  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
    const token = this.getToken();
    const response = await fetch(`${API_BASE}/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new ApiError(response.status, "CHAT_ERROR", "Chat stream failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) yield parsed.content;
          } catch {
            // Ignoră linii SSE parțiale
          }
        }
      }
    }
  }

  // ─── Admin, KYC, Contracte & Finanțe ──────────────────────────────────────
  async listKycRequests(): Promise<CompanyKyc[]> {
    return this.request<CompanyKyc[]>("/admin/kyc");
  }

  async reviewKyc(id: string, status: "VERIFIED" | "REJECTED", reason?: string): Promise<void> {
    return this.request<void>(`/admin/kyc/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
  }

  async submitKyc(data: Partial<CompanyKyc>): Promise<CompanyKyc> {
    return this.request<CompanyKyc>("/companies/verify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async listContracts(): Promise<DigitalContract[]> {
    return this.request<DigitalContract[]>("/contracts");
  }

  async acceptContract(id: string, acceptedBy: string): Promise<DigitalContract> {
    return this.request<DigitalContract>(`/contracts/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({ accepted_by: acceptedBy }),
    });
  }

  async listInvoices(): Promise<Invoice[]> {
    return this.request<Invoice[]>("/invoices");
  }

  async markInvoicePaid(id: string, method?: string): Promise<void> {
    return this.request<void>(`/invoices/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ payment_method: method }),
    });
  }

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    return this.request<AuditLogEntry[]>("/admin/audit-logs");
  }
}

// ─── 2. Demo Local Storage Adapter (Moldova Demo Mode / Vercel Fallback) ───

export class DemoLocalAdapter
  implements
    IOrderRepository,
    IVehicleRepository,
    IClusterRepository,
    IChatService,
    IAdminRepository {
  private getStoredOrders(): Order[] {
    if (typeof window === "undefined") return INITIAL_DEMO_ORDERS;
    const item = localStorage.getItem("optifleet_demo_orders");
    if (!item) {
      localStorage.setItem("optifleet_demo_orders", JSON.stringify(INITIAL_DEMO_ORDERS));
      return INITIAL_DEMO_ORDERS;
    }
    try {
      return JSON.parse(item);
    } catch {
      return INITIAL_DEMO_ORDERS;
    }
  }

  private saveStoredOrders(orders: Order[]) {
    if (typeof window !== "undefined") {
      localStorage.setItem("optifleet_demo_orders", JSON.stringify(orders));
    }
  }

  // ─── KYC Storage ──────────────────────────────────────────────────────────
  private getStoredKyc(): CompanyKyc[] {
    if (typeof window === "undefined") return INITIAL_KYC_COMPANIES;
    const item = localStorage.getItem("optifleet_kyc_companies");
    if (!item) {
      localStorage.setItem("optifleet_kyc_companies", JSON.stringify(INITIAL_KYC_COMPANIES));
      return INITIAL_KYC_COMPANIES;
    }
    try { return JSON.parse(item); } catch { return INITIAL_KYC_COMPANIES; }
  }

  private saveStoredKyc(companies: CompanyKyc[]) {
    if (typeof window !== "undefined") {
      localStorage.setItem("optifleet_kyc_companies", JSON.stringify(companies));
    }
  }

  // ─── Contracts Storage ────────────────────────────────────────────────────
  private getStoredContracts(): DigitalContract[] {
    if (typeof window === "undefined") return INITIAL_DIGITAL_CONTRACTS;
    const item = localStorage.getItem("optifleet_contracts");
    if (!item) {
      localStorage.setItem("optifleet_contracts", JSON.stringify(INITIAL_DIGITAL_CONTRACTS));
      return INITIAL_DIGITAL_CONTRACTS;
    }
    try { return JSON.parse(item); } catch { return INITIAL_DIGITAL_CONTRACTS; }
  }

  private saveStoredContracts(contracts: DigitalContract[]) {
    if (typeof window !== "undefined") {
      localStorage.setItem("optifleet_contracts", JSON.stringify(contracts));
    }
  }

  // ─── Invoices Storage ─────────────────────────────────────────────────────
  private getStoredInvoices(): Invoice[] {
    if (typeof window === "undefined") return INITIAL_INVOICES;
    const item = localStorage.getItem("optifleet_invoices");
    if (!item) {
      localStorage.setItem("optifleet_invoices", JSON.stringify(INITIAL_INVOICES));
      return INITIAL_INVOICES;
    }
    try { return JSON.parse(item); } catch { return INITIAL_INVOICES; }
  }

  private saveStoredInvoices(invoices: Invoice[]) {
    if (typeof window !== "undefined") {
      localStorage.setItem("optifleet_invoices", JSON.stringify(invoices));
    }
  }

  // ─── Audit Logs Storage ───────────────────────────────────────────────────
  private getStoredAuditLogs(): AuditLogEntry[] {
    if (typeof window === "undefined") return INITIAL_AUDIT_LOGS;
    const item = localStorage.getItem("optifleet_audit_logs");
    if (!item) {
      localStorage.setItem("optifleet_audit_logs", JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    try { return JSON.parse(item); } catch { return INITIAL_AUDIT_LOGS; }
  }

  private saveStoredAuditLogs(logs: AuditLogEntry[]) {
    if (typeof window !== "undefined") {
      localStorage.setItem("optifleet_audit_logs", JSON.stringify(logs));
    }
  }

  async listOrders(_params?: { limit?: number; offset?: number }): Promise<Order[]> {
    await new Promise((r) => setTimeout(r, 150)); // Simulează un I/O rapid și fluid
    return this.getStoredOrders();
  }

  async getOrder(id: string): Promise<Order | null> {
    const orders = this.getStoredOrders();
    return orders.find((o) => o.id === id) ?? null;
  }

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    await new Promise((r) => setTimeout(r, 250));
    const orders = this.getStoredOrders();

    // Calcul estimativ discount bazat pe volum și rută (DBSCAN / GroupLog strategy)
    const discount = Math.min(62, Math.round(20 + dto.volume_m3 * 6 + Math.random() * 8));

    const newOrder: Order = {
      id: `ord_md_${Date.now().toString().slice(-4)}`,
      company_name: dto.company_name || "IMM Moldova Client",
      status: "CLUSTERED",
      volume_m3: dto.volume_m3,
      weight_kg: dto.weight_kg,
      pickup_address: dto.pickup_address || "Chișinău, Hub Central",
      pickup_lat: dto.pickup_lat,
      pickup_lon: dto.pickup_lon,
      dropoff_address: dto.dropoff_address || "Destinație Moldova",
      dropoff_lat: dto.dropoff_lat,
      dropoff_lon: dto.dropoff_lon,
      delivery_window_start: dto.delivery_window_start,
      delivery_window_end: dto.delivery_window_end,
      cluster_id: "cl_nord_01",
      cluster_name: "Coridor Nord: Chișinău → Bălți",
      estimated_discount_pct: discount,
      created_at: new Date().toISOString(),
    };

    orders.unshift(newOrder);
    this.saveStoredOrders(orders);
    return newOrder;
  }

  async cancelOrder(id: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));
    const orders = this.getStoredOrders().map((o) =>
      o.id === id ? { ...o, status: "CANCELLED" as const } : o
    );
    this.saveStoredOrders(orders);
  }

  async clusterOrders(): Promise<{ clustersCreated: number; totalSavedMdl: number }> {
    await new Promise((r) => setTimeout(r, 400));
    const orders = this.getStoredOrders();
    let updatedCount = 0;
    const updated = orders.map((o) => {
      if (o.status === "PENDING") {
        updatedCount++;
        return {
          ...o,
          status: "CLUSTERED" as const,
          cluster_id: "cl_nord_01",
          cluster_name: "Grupare Automată DBSCAN",
          estimated_discount_pct: 58.4,
        };
      }
      return o;
    });
    this.saveStoredOrders(updated);
    return { clustersCreated: 3, totalSavedMdl: 8470 };
  }

  async listVehicles(): Promise<Vehicle[]> {
    await new Promise((r) => setTimeout(r, 100));
    return INITIAL_DEMO_VEHICLES;
  }

  async listClusters(): Promise<Cluster[]> {
    await new Promise((r) => setTimeout(r, 100));
    return INITIAL_DEMO_CLUSTERS;
  }

  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || "";

    let reply = "Bună ziua! Sunt Asistentul AI OptiFleet dedicat optimizării logisticii în Moldova. Cu ce vă pot fi de folos astăzi?";

    if (lastMsg.includes("comenzi") || lastMsg.includes("activ")) {
      reply = "În acest moment aveți **8 comenzi înregistrate** în sistem pe rutele principale (Chișinău, Bălți, Orhei, Cahul). Dintre acestea, 6 sunt grupate prin DBSCAN și beneficiază de reduceri de tarif între **44% și 62%**.";
    } else if (lastMsg.includes("economi") || lastMsg.includes("discount") || lastMsg.includes("pret")) {
      reply = "Prin algoritmul de clustering **GroupLog (DBSCAN + CVRP)**, economia cumulată estimată astăzi pe coridoarele Moldova este de **8,470 MDL** (reducere medie de **56.8%** față de transportul individual LTL).";
    } else if (lastMsg.includes("flota") || lastMsg.includes("vehicul") || lastMsg.includes("masin")) {
      reply = "Flota disponibilă cuprinde **5 vehicule**: 2 în tranzit (MAN TGL pe M5 spre Bălți și Iveco Daily spre Cahul), 2 disponibile în Chișinău și Bălți, și 1 în mentenanță programată.";
    } else if (lastMsg.includes("bălți") || lastMsg.includes("balti") || lastMsg.includes("chisinau")) {
      reply = "Traseul **Chișinău ➔ Bălți (131.8 km)** prin M5 are în prezent un grup optimizat de 3 comenzi (11.3 m³ încărcare dintr-o capacitate de 32 m³), reducând amprenta de CO₂ cu 42 kg.";
    }

    // Simulează streaming cuvânt cu cuvânt pentru efect realist
    const tokens = reply.split(" ");
    for (const token of tokens) {
      await new Promise((r) => setTimeout(r, 35));
      yield token + " ";
    }
  }

  resetDemoData() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("optifleet_demo_orders");
      localStorage.removeItem("optifleet_kyc_companies");
      localStorage.removeItem("optifleet_contracts");
      localStorage.removeItem("optifleet_invoices");
      localStorage.removeItem("optifleet_audit_logs");
    }
  }

  // ─── Admin, KYC, Contracte & Finanțe ──────────────────────────────────────
  async listKycRequests(): Promise<CompanyKyc[]> {
    await new Promise((r) => setTimeout(r, 100));
    return this.getStoredKyc();
  }

  async reviewKyc(id: string, status: "VERIFIED" | "REJECTED", reason?: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));
    const list = this.getStoredKyc();
    const updated = list.map((c) =>
      c.id === id
        ? {
            ...c,
            status,
            rejection_reason: reason,
            verified_at: status === "VERIFIED" ? new Date().toISOString() : undefined,
          }
        : c
    );
    this.saveStoredKyc(updated);

    const logs = this.getStoredAuditLogs();
    logs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      actor_name: "Administrator Sistem",
      actor_email: "admin@optifleet.md",
      actor_role: "SUPER_ADMIN",
      action: `KYC_${status}`,
      entity_type: "company",
      entity_id: id,
      ip_address: "188.138.1.10",
      status: "SUCCESS",
    });
    this.saveStoredAuditLogs(logs);
  }

  async submitKyc(data: Partial<CompanyKyc>): Promise<CompanyKyc> {
    await new Promise((r) => setTimeout(r, 200));
    const list = this.getStoredKyc();
    const newKyc: CompanyKyc = {
      id: `kyc_${Date.now().toString().slice(-4)}`,
      company_name: data.company_name || "Companie Nouă SRL",
      legal_type: data.legal_type || "SRL",
      idno: data.idno || "1003600000000",
      idno_valid: true,
      anta_license_number: data.anta_license_number,
      anta_license_valid: !!data.anta_license_number,
      anta_license_expiry: "2027-12-31",
      address: data.address || "Chișinău, Republica Moldova",
      city: data.city || "Chișinău",
      admin_name: data.admin_name || "Administrator",
      phone: data.phone || "+373 60 000 000",
      email: data.email || "contact@firma.md",
      role_type: data.role_type || "SME",
      documents: [
        {
          id: `doc_${Date.now()}`,
          doc_type: "ASP_EXTRACT",
          file_name: "certificat_inregistrare.pdf",
          file_size_kb: 450,
          status: "PENDING",
          uploaded_at: new Date().toISOString(),
        },
      ],
      status: "PENDING_VERIFICATION",
      created_at: new Date().toISOString(),
    };
    list.unshift(newKyc);
    this.saveStoredKyc(list);
    return newKyc;
  }

  async listContracts(): Promise<DigitalContract[]> {
    await new Promise((r) => setTimeout(r, 100));
    return this.getStoredContracts();
  }

  async acceptContract(id: string, acceptedBy: string): Promise<DigitalContract> {
    await new Promise((r) => setTimeout(r, 150));
    const list = this.getStoredContracts();
    let acceptedContract: DigitalContract | null = null;
    const updated = list.map((c) => {
      if (c.id === id) {
        acceptedContract = {
          ...c,
          status: "ACCEPTED" as const,
          accepted_at: new Date().toISOString(),
          accepted_by: acceptedBy,
          accepted_ip: "185.108.128.45",
        };
        return acceptedContract;
      }
      return c;
    });
    this.saveStoredContracts(updated);

    const logs = this.getStoredAuditLogs();
    logs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      actor_name: acceptedBy,
      actor_email: "operator@transport.md",
      actor_role: "CARRIER_ADMIN",
      action: "CONTRACT_DIGITAL_ACCEPT",
      entity_type: "contract",
      entity_id: id,
      ip_address: "185.108.128.45",
      status: "SUCCESS",
    });
    this.saveStoredAuditLogs(logs);

    return acceptedContract || list[0];
  }

  async listInvoices(): Promise<Invoice[]> {
    await new Promise((r) => setTimeout(r, 100));
    return this.getStoredInvoices();
  }

  async markInvoicePaid(id: string, method = "TRANSFER_BANCAR_IBAN"): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));
    const list = this.getStoredInvoices();
    const updated = list.map((inv) =>
      inv.id === id
        ? {
            ...inv,
            status: "PAID" as const,
            paid_at: new Date().toISOString().replace("T", " ").slice(0, 16),
            payment_method: method,
          }
        : inv
    );
    this.saveStoredInvoices(updated);
  }

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    await new Promise((r) => setTimeout(r, 100));
    return this.getStoredAuditLogs();
  }
}

// ─── 3. Smart Service Proxy (Proxy & Fallback Pattern) ───────────────────────

export class SmartServiceProxy
  implements
    IOrderRepository,
    IVehicleRepository,
    IClusterRepository,
    IChatService,
    IAdminRepository {
  private remote = new RemoteApiAdapter();
  private demo = new DemoLocalAdapter();
  private mode: "auto" | "live" | "demo" = "auto";
  private isLiveAvailable: boolean | null = null;
  private listeners: Array<(status: { isLive: boolean; mode: string }) => void> = [];

  constructor() {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("optifleet_app_mode");
      if (savedMode === "live" || savedMode === "demo" || savedMode === "auto") {
        this.mode = savedMode;
      }
    }
  }

  setMode(mode: "auto" | "live" | "demo") {
    this.mode = mode;
    if (typeof window !== "undefined") {
      localStorage.setItem("optifleet_app_mode", mode);
    }
    this.notifyListeners();
  }

  setToken(token: string | null) {
    this.remote.setToken(token);
  }

  getToken(): string | null {
    return this.remote.getToken();
  }

  clearToken() {
    this.remote.clearToken();
  }

  async refreshAccessToken(): Promise<string | null> {
    return this.remote.refreshAccessToken();
  }

  getMode() {
    return this.mode;
  }

  getIsLive() {
    return this.isLiveAvailable ?? false;
  }

  subscribe(listener: (status: { isLive: boolean; mode: string }) => void) {
    this.listeners.push(listener);
    listener({ isLive: this.isLiveAvailable ?? false, mode: this.mode });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l({ isLive: this.isLiveAvailable ?? false, mode: this.mode }));
  }

  async checkBackendHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      const ok = res.ok;
      this.isLiveAvailable = ok;
      this.notifyListeners();
      return ok;
    } catch {
      this.isLiveAvailable = false;
      this.notifyListeners();
      return false;
    }
  }

  private async executeWithFallback<T>(
    remoteCall: () => Promise<T>,
    demoCall: () => Promise<T>
  ): Promise<T> {
    if (this.mode === "demo") return demoCall();
    if (this.mode === "live") return remoteCall();

    try {
      const result = await remoteCall();
      if (!this.isLiveAvailable) {
        this.isLiveAvailable = true;
        this.notifyListeners();
      }
      return result;
    } catch (err: any) {
      console.warn("Backend remote indisponibil, se activează Demo Fallback:", err.message);
      this.isLiveAvailable = false;
      this.notifyListeners();
      return demoCall();
    }
  }

  // ─── Order Repository Implementation ───────────────────────────────────────

  async listOrders(params?: { limit?: number; offset?: number }): Promise<Order[]> {
    return this.executeWithFallback(
      () => this.remote.listOrders(params),
      () => this.demo.listOrders(params)
    );
  }

  async getOrder(id: string): Promise<Order | null> {
    return this.executeWithFallback(
      () => this.remote.getOrder(id),
      () => this.demo.getOrder(id)
    );
  }

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    return this.executeWithFallback(
      () => this.remote.createOrder(dto),
      () => this.demo.createOrder(dto)
    );
  }

  async cancelOrder(id: string): Promise<void> {
    return this.executeWithFallback(
      () => this.remote.cancelOrder(id),
      () => this.demo.cancelOrder(id)
    );
  }

  async clusterOrders(): Promise<{ clustersCreated: number; totalSavedMdl: number }> {
    return this.executeWithFallback(
      () => this.remote.clusterOrders(),
      () => this.demo.clusterOrders()
    );
  }

  // ─── Vehicle & Cluster Repository ──────────────────────────────────────────

  async listVehicles(): Promise<Vehicle[]> {
    return this.executeWithFallback(
      () => this.remote.listVehicles(),
      () => this.demo.listVehicles()
    );
  }

  async listClusters(): Promise<Cluster[]> {
    return this.executeWithFallback(
      () => this.remote.listClusters(),
      () => this.demo.listClusters()
    );
  }

  // ─── Admin, KYC, Contracte & Finanțe ──────────────────────────────────────

  async listKycRequests(): Promise<CompanyKyc[]> {
    return this.executeWithFallback(
      () => this.remote.listKycRequests(),
      () => this.demo.listKycRequests()
    );
  }

  async reviewKyc(id: string, status: "VERIFIED" | "REJECTED", reason?: string): Promise<void> {
    return this.executeWithFallback(
      () => this.remote.reviewKyc(id, status, reason),
      () => this.demo.reviewKyc(id, status, reason)
    );
  }

  async submitKyc(data: Partial<CompanyKyc>): Promise<CompanyKyc> {
    return this.executeWithFallback(
      () => this.remote.submitKyc(data),
      () => this.demo.submitKyc(data)
    );
  }

  async listContracts(): Promise<DigitalContract[]> {
    return this.executeWithFallback(
      () => this.remote.listContracts(),
      () => this.demo.listContracts()
    );
  }

  async acceptContract(id: string, acceptedBy: string): Promise<DigitalContract> {
    return this.executeWithFallback(
      () => this.remote.acceptContract(id, acceptedBy),
      () => this.demo.acceptContract(id, acceptedBy)
    );
  }

  async listInvoices(): Promise<Invoice[]> {
    return this.executeWithFallback(
      () => this.remote.listInvoices(),
      () => this.demo.listInvoices()
    );
  }

  async markInvoicePaid(id: string, method?: string): Promise<void> {
    return this.executeWithFallback(
      () => this.remote.markInvoicePaid(id, method),
      () => this.demo.markInvoicePaid(id, method)
    );
  }

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    return this.executeWithFallback(
      () => this.remote.listAuditLogs(),
      () => this.demo.listAuditLogs()
    );
  }

  // ─── Chat Service ─────────────────────────────────────────────────────────

  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
    if (this.mode === "demo") {
      yield* this.demo.chatStream(messages);
      return;
    }

    try {
      yield* this.remote.chatStream(messages);
    } catch (err) {
      console.warn("Chat remote eșuat, comutare pe demo chat stream:", err);
      yield* this.demo.chatStream(messages);
    }
  }

  resetDemo() {
    this.demo.resetDemoData();
  }
}

// ─── Singleton Export (GoF Singleton Pattern) ────────────────────────────────

export const apiClient = new SmartServiceProxy();
