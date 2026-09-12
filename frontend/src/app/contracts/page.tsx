"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/ui/Sidebar";
import { DigitalContract } from "@/lib/api-client";
import { INITIAL_DIGITAL_CONTRACTS } from "@/lib/kyc-data";
import { getCompanyLegalProfile, formatIdno } from "@/lib/idno-validator";
import {
  validateContractPathB,
  confirmContractPathACompletion,
  canAccessDeliveryPhoto,
  reserveVehicleCapacityAtomic,
  calculateEstimatedRoutePrice,
} from "@/lib/contracts-engine";
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Camera,
  MessageSquare,
  Send,
  Lock,
  MapPin,
  ExternalLink,
  Plus,
  Radio,
  Building2,
  UserCheck,
  Sparkles,
} from "lucide-react";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<DigitalContract[]>([]);
  const [selectedContract, setSelectedContract] = useState<DigitalContract | null>(null);
  const [filterPath, setFilterPath] = useState<"ALL" | "PATH_A" | "PATH_B">("ALL");
  const [activeDetailTab, setActiveDetailTab] = useState<"DOCUMENT" | "NEGOTIATION" | "PHOTO">("DOCUMENT");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Formular semnare
  const [signerName, setSignerName] = useState("Vasile Cojocaru (Administrator)");
  const [isSigning, setIsSigning] = useState(false);

  // State Calea B Disclaimer Checkbox
  const [pathBDisclaimerChecked, setPathBDisclaimerChecked] = useState(false);

  // State Chat Negociere (Prompt K8)
  const [chatInput, setChatInput] = useState("");
  const [proposedPriceInput, setProposedPriceInput] = useState<number | "">("");

  // State Modal Creare Contract Nou (Prompt K6, K8, K9, K12)
  const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);
  const [newPath, setNewPath] = useState<"PATH_A_PLATFORM" | "PATH_B_DIRECT">("PATH_A_PLATFORM");
  const [newShipperIdno, setNewShipperIdno] = useState("1003600012345");
  const [newShipperName, setNewShipperName] = useState("TechMold SRL");
  const [newCarrierIdno, setNewCarrierIdno] = useState("1004600034567");
  const [newCarrierName, setNewCarrierName] = useState("TransMoldova Express Î.I.");
  const [newCorridor, setNewCorridor] = useState("Chișinău (M5) ➔ Bălți");
  const [newGoods, setNewGoods] = useState("Produse alimentare ambalate pe paleți");
  const [newPallets, setNewPallets] = useState(4);
  const [newDistanceKm, setNewDistanceKm] = useState(140);
  const [newPricePerKm, setNewPricePerKm] = useState(18.5);
  const [newDisclaimerChecked, setNewDisclaimerChecked] = useState(false);

  // Încărcare contracte din localStorage sau fallback inițial
  useEffect(() => {
    try {
      const stored = localStorage.getItem("optifleet_contracts");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setContracts(parsed);
          setSelectedContract(parsed[0]);
          return;
        }
      }
    } catch {}
    setContracts(INITIAL_DIGITAL_CONTRACTS);
    setSelectedContract(INITIAL_DIGITAL_CONTRACTS[0]);
  }, []);

  const saveContractsState = (newList: DigitalContract[]) => {
    setContracts(newList);
    try {
      localStorage.setItem("optifleet_contracts", JSON.stringify(newList));
    } catch {}
  };

  const active = selectedContract || contracts[0];

  // Filtrare contracte
  const filteredContracts = contracts.filter((ctr) => {
    if (filterPath === "PATH_A") return (ctr.contract_path || "PATH_A_PLATFORM") === "PATH_A_PLATFORM";
    if (filterPath === "PATH_B") return ctr.contract_path === "PATH_B_DIRECT";
    return true;
  });

  // ─── PROMPT K9: SEMNARE DIGITALĂ SHA-256 ──────────────────────────────────
  const handleSignContract = () => {
    if (!active) return;
    setIsSigning(true);
    setTimeout(() => {
      const now = new Date().toISOString();
      const updated: DigitalContract = {
        ...active,
        status: "ACCEPTED",
        accepted_at: now,
        accepted_by: signerName,
        accepted_ip: "185.108.128.45",
      };
      const newList = contracts.map((c) => (c.id === updated.id ? updated : c));
      saveContractsState(newList);
      setSelectedContract(updated);
      setIsSigning(false);
      setToastMsg("Contractul a fost semnat digital și securizat criptografic cu amprentă SHA-256.");
      setTimeout(() => setToastMsg(null), 4500);
    }, 400);
  };

  // ─── PROMPT K9: CONFIRMARE CALEA B (CU DISCLAIMER OBLIGATORIU) ────────────
  const handleConfirmPathB = () => {
    if (!active) return;
    const check = validateContractPathB({ disclaimer_accepted: pathBDisclaimerChecked });
    if (!check.allowed) {
      alert(check.error);
      return;
    }

    const updated: DigitalContract = {
      ...active,
      disclaimer_accepted: true,
      disclaimer_accepted_at: new Date().toISOString(),
      status: "DELIVERED",
      is_fully_completed: true,
    };
    const newList = contracts.map((c) => (c.id === updated.id ? updated : c));
    saveContractsState(newList);
    setSelectedContract(updated);
    setToastMsg("Înțelegerea directă (Calea B) a fost finalizată și consemnată în audit_log.");
    setTimeout(() => setToastMsg(null), 4500);
  };

  // ─── PROMPT K9: CONFIRMARE BILATERALĂ CALEA A ─────────────────────────────
  const handleBilateralConfirm = (party: "SHIPPER" | "CARRIER") => {
    if (!active) return;
    const res = confirmContractPathACompletion(
      active as any,
      party,
      party === "SHIPPER" ? "Expeditor Marfă" : "Transportator Auto"
    );

    const newList = contracts.map((c) => (c.id === res.contract.id ? (res.contract as DigitalContract) : c));
    saveContractsState(newList);
    setSelectedContract(res.contract as DigitalContract);

    // PROMPT K10: Dacă este complet bilateral, eliberăm / actualizăm capacitatea vehiculului
    if (res.isCompleted) {
      try {
        const storedTrucks = localStorage.getItem("optifleet_available_trucks");
        if (storedTrucks) {
          const trucks = JSON.parse(storedTrucks);
          if (Array.isArray(trucks) && active.vehicle_id) {
            const updatedTrucks = trucks.map((t) => {
              if (t.id === active.vehicle_id) {
                return {
                  ...t,
                  freePallets: Math.min(t.totalPallets, t.freePallets + (active.pallet_count || 3)),
                };
              }
              return t;
            });
            localStorage.setItem("optifleet_available_trucks", JSON.stringify(updatedTrucks));
          }
        }
      } catch {}
    }

    setToastMsg(res.message);
    setTimeout(() => setToastMsg(null), 5000);
  };

  // ─── PROMPT K8: TRANSMITERE MESAJ NEGOCIERE ───────────────────────────────
  const handleSendNegotiationMessage = (role: "SHIPPER" | "CARRIER") => {
    if (!active || !chatInput.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender_company_name: role === "SHIPPER" ? active.sme_company_name : active.carrier_company_name,
      sender_role: role,
      message: chatInput.trim(),
      proposed_price_mdl: proposedPriceInput ? Number(proposedPriceInput) : undefined,
      created_at: new Date().toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" }),
    };

    const existingMessages = active.negotiation_messages || [];
    const updatedContract: DigitalContract = {
      ...active,
      total_price_mdl: proposedPriceInput ? Number(proposedPriceInput) : active.total_price_mdl,
      negotiation_messages: [...existingMessages, newMsg],
    };

    const newList = contracts.map((c) => (c.id === updatedContract.id ? updatedContract : c));
    saveContractsState(newList);
    setSelectedContract(updatedContract);
    setChatInput("");
    setProposedPriceInput("");

    setToastMsg("Mesajul de negociere a fost expediat instant către partener.");
    setTimeout(() => setToastMsg(null), 3000);
  };

  // ─── PROMPT K11: ÎNCĂRCARE DOVADĂ FOTO LIVRARE (STIL AMAZON) ─────────────
  const handleUploadPhotoProof = () => {
    if (!active) return;
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const photoProof = {
      id: `photo-${Date.now()}`,
      url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80",
      file_name: `dovada_livrare_${active.contract_number}.jpg`,
      timestamp: now,
      gps_lat: 47.0245,
      gps_lon: 28.8522,
      uploaded_by: "Șofer Partener (Dispozitiv Mobil)",
      company_idno: active.carrier_idno,
    };

    const updatedContract: DigitalContract = {
      ...active,
      delivery_photo: photoProof,
    };

    const newList = contracts.map((c) => (c.id === updatedContract.id ? updatedContract : c));
    saveContractsState(newList);
    setSelectedContract(updatedContract);
    setToastMsg("Fotografia dovadă de livrare a fost asociată securizat comenzii.");
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ─── PROMPT K6 / K10 / K12: CREARE CONTRACT NOU ───────────────────────────
  const handleCreateNewContract = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPath === "PATH_B_DIRECT" && !newDisclaimerChecked) {
      alert("Pentru Calea B este obligatoriu să bifați căsuța de exonerare de răspundere a platformei.");
      return;
    }

    // Auto-populare profil legal din IDNO (Prompt K12)
    const shipperProfile = getCompanyLegalProfile(newShipperIdno, newShipperName);
    const carrierProfile = getCompanyLegalProfile(newCarrierIdno, newCarrierName);

    // Calcul tarif cursă bazat pe preț/km × distanță (Prompt K12)
    const estimated = calculateEstimatedRoutePrice(newPricePerKm, newDistanceKm);

    // Verificare atomică capacitate camion (Prompt K10)
    let assignedTruckId = "vh-1";
    try {
      const storedTrucks = localStorage.getItem("optifleet_available_trucks");
      if (storedTrucks) {
        const trucks = JSON.parse(storedTrucks);
        if (Array.isArray(trucks) && trucks.length > 0) {
          const availableTruck = trucks.find((t) => t.freePallets >= newPallets) || trucks[0];
          assignedTruckId = availableTruck.id;
          const reserveRes = reserveVehicleCapacityAtomic(availableTruck, newPallets);
          if (reserveRes.success) {
            const updatedTrucks = trucks.map((t) =>
              t.id === availableTruck.id ? { ...t, freePallets: reserveRes.newFreePallets } : t
            );
            localStorage.setItem("optifleet_available_trucks", JSON.stringify(updatedTrucks));
          }
        }
      }
    } catch {}

    const now = new Date().toISOString();
    const newCtr: DigitalContract = {
      id: `ctr-${Date.now()}`,
      contract_number: `CTR-MD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicle_id: assignedTruckId,
      sme_company_name: shipperProfile.companyName,
      sme_idno: shipperProfile.idno,
      sme_legal_form: shipperProfile.legalForm,
      carrier_company_name: carrierProfile.companyName,
      carrier_idno: carrierProfile.idno,
      carrier_legal_form: carrierProfile.legalForm,
      corridor: newCorridor,
      goods_description: newGoods,
      volume_m3: +(newPallets * 0.96).toFixed(1),
      weight_kg: newPallets * 650,
      pallet_count: newPallets,
      distance_km: newDistanceKm,
      price_per_km: newPricePerKm,
      total_price_mdl: estimated.totalEstimatedMdl,
      standard_price_mdl: Math.round(estimated.totalEstimatedMdl * 1.35),
      discount_saved_mdl: Math.round(estimated.totalEstimatedMdl * 0.35),
      content_hash: `sha256-${Math.random().toString(36).substring(2)}${Date.now()}`,
      status: "PENDING_SIGNATURE",
      created_at: now,
      contract_path: newPath,
      disclaimer_accepted: newPath === "PATH_B_DIRECT" ? newDisclaimerChecked : true,
      disclaimer_accepted_at: newPath === "PATH_B_DIRECT" ? now : undefined,
      shipper_confirmed: false,
      carrier_confirmed: false,
      is_fully_completed: false,
      gps_tracking_active: newPath === "PATH_A_PLATFORM",
      legal_clauses: [
        "1. Prezentul acord este încheiat conform Codului Transporturilor Rutiere nr. 150/2014 al Republicii Moldova.",
        "2. Părțile își asumă respectarea normelor de siguranță a mărfii și a integrității ambalajelor.",
        newPath === "PATH_A_PLATFORM"
          ? "3. Platforma OptiFleet asigură monitorizarea GPS pe toată durata cursei și confirmarea bilaterală."
          : "3. Înțelegere directă (Calea B): Părțile convin nemedierea de către platformă, conform exonerării de răspundere acceptate.",
      ],
      negotiation_messages: [],
    };

    const newList = [newCtr, ...contracts];
    saveContractsState(newList);
    setSelectedContract(newCtr);
    setIsNewContractModalOpen(false);
    setToastMsg(`Acordul ${newCtr.contract_number} a fost generat cu succes.`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/contracts" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-5">
        {/* ─── Header Minimalist & Buton Acțiune ─────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Contracte & Acorduri B2B</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                Calea A & Calea B
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Validare conform Codului Civil al RM nr. 1107/2002 & Codului Transporturilor Rutiere nr. 150/2014
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsNewContractModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Creare Acord Nou</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Printează / PDF
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="text-emerald-700 font-bold hover:text-emerald-900">
              ✕
            </button>
          </div>
        )}

        {/* ─── Filtre Calea A / Calea B ─────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterPath("ALL")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              filterPath === "ALL"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Toate ({contracts.length})
          </button>
          <button
            onClick={() => setFilterPath("PATH_A")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              filterPath === "PATH_A"
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Calea A: Platformă SHA-256</span>
          </button>
          <button
            onClick={() => setFilterPath("PATH_B")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              filterPath === "PATH_B"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Calea B: Înțelegere Directă</span>
          </button>
        </div>

        {/* ─── Grid Principal: Listă Stânga + Detaliu Dreapta ──────────────── */}
        <div className="grid grid-cols-12 gap-5 items-start">
          {/* Coloana Stânga: Listă Contracte (4 coloane) */}
          <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Acorduri Înregistrate ({filteredContracts.length})
            </div>

            {filteredContracts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Niciun contract în această categorie.</div>
            ) : (
              filteredContracts.map((ctr) => {
                const isSelected = active?.id === ctr.id;
                const isPathA = (ctr.contract_path || "PATH_A_PLATFORM") === "PATH_A_PLATFORM";
                return (
                  <div
                    key={ctr.id}
                    onClick={() => {
                      setSelectedContract(ctr);
                      setActiveDetailTab("DOCUMENT");
                      setPathBDisclaimerChecked(false);
                    }}
                    className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900 font-mono">{ctr.contract_number}</span>
                      {isPathA ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          CALEA A
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          CALEA B (DIRECT)
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-800">{ctr.corridor}</div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>
                        {ctr.sme_company_name} ➔ {ctr.carrier_company_name}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {ctr.total_price_mdl.toLocaleString()} MDL
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ctr.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800"
                            : ctr.status === "ACCEPTED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ctr.status === "DELIVERED"
                          ? "✓ Livrat & Confirmat"
                          : ctr.status === "ACCEPTED"
                          ? "Semnat Digital"
                          : "În așteptare"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Coloana Dreapta: Vizualizare & Acțiuni (8 coloane) */}
          {active && (
            <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col gap-5">
              {/* Header Contract Selectat */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{active.contract_number}</span>
                    {active.contract_path === "PATH_B_DIRECT" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Înțelegere Directă (Nemediere)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Contract Platformă SHA-256
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Coridor: <strong>{active.corridor}</strong> · Marfă: {active.goods_description}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Valoare Decontată:</div>
                  <div className="text-xl font-bold text-blue-600 font-mono">
                    {active.total_price_mdl.toLocaleString()} MDL
                  </div>
                  {active.price_per_km && active.distance_km && (
                    <div className="text-[11px] text-slate-400">
                      {active.distance_km} km × {active.price_per_km} MDL/km
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-Taburi: Document, Negociere, Dovadă Foto */}
              <div className="flex border-b border-slate-200 gap-4">
                <button
                  onClick={() => setActiveDetailTab("DOCUMENT")}
                  className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                    activeDetailTab === "DOCUMENT"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Document & Clauze</span>
                </button>

                <button
                  onClick={() => setActiveDetailTab("NEGOTIATION")}
                  className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                    activeDetailTab === "NEGOTIATION"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Negociere & Chat ({active.negotiation_messages?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveDetailTab("PHOTO")}
                  className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                    activeDetailTab === "PHOTO"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Dovadă Foto Livrare</span>
                  {active.delivery_photo && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </button>
              </div>

              {/* ─── TAB 1: DOCUMENT CONTRACT & CLAUZE LEGALE ──────────────── */}
              {activeDetailTab === "DOCUMENT" && (
                <div className="space-y-4 text-xs">
                  {/* Criptografie SHA-256 */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono">
                    <div className="text-[11px] font-sans font-medium text-slate-500 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Amprentă Criptografică Document (SHA-256 Imutabil):</span>
                    </div>
                    <div className="text-blue-700 font-bold break-all text-[11px]">
                      {active.content_hash}
                    </div>
                  </div>

                  {/* PROMPT K12: Părți Contractuale cu Profil Legal detectat automat (SRL / Î.I.) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                          EXPEDITOR (BENEFICIAR MARFĂ)
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          {active.sme_legal_form || "SRL"}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{active.sme_company_name}</div>
                      <div className="text-slate-500 font-mono mt-0.5">IDNO: {formatIdno(active.sme_idno)}</div>
                      <div className="text-slate-500 text-[11px] mt-1">
                        Volum rezervat: <strong>{active.pallet_count || 3} paleți ({active.weight_kg} kg)</strong>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                          TRANSPORTATOR (CĂRĂUȘ AUTO)
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          {active.carrier_legal_form || "Î.I."}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{active.carrier_company_name}</div>
                      <div className="text-slate-500 font-mono mt-0.5">IDNO: {formatIdno(active.carrier_idno)}</div>
                      <div className="text-slate-500 text-[11px] mt-1">
                        Vehicul Alocat: <strong>{active.vehicle_id || "CAN 001 (Actros 1845)"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Monitorizare GPS pe durata cursei (Prompt K9 Calea A) */}
                  {active.contract_path !== "PATH_B_DIRECT" ? (
                    <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <div>
                          <div className="font-bold text-emerald-900">Acces GPS Activ în Timp Real</div>
                          <div className="text-[11px] text-emerald-700">
                            Expeditorul deține dreptul de localizare directă pe toată durata cursei conform Căii A.
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold">
                        Poziție: 47.025° N, 28.850° E
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs">
                      Monitorizarea automată GPS prin platformă nu este inclusă în Calea B (Înțelegere directă).
                    </div>
                  )}

                  {/* Clauze Legale */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                    <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Clauze Obligatorii:
                    </div>
                    {active.legal_clauses?.map((clause, idx) => (
                      <p key={idx} className="text-slate-600 text-[11px] leading-relaxed">
                        {clause}
                      </p>
                    ))}
                  </div>

                  {/* ─── PROMPT K9: ZONĂ SPECIFICĂ CALEA B (AVERTISMENT MANDATORIU) ─── */}
                  {active.contract_path === "PATH_B_DIRECT" && (
                    <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/80 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-amber-900 text-sm">
                            AVERTISMENT OBLIGATORIU PRIVIND ÎNȚELEGEREA DIRECTĂ:
                          </div>
                          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                            <strong>Platforma NU își asumă răspunderea</strong> pentru marfa transportată prin
                            această înțelegere directă. Toate riscurile privind integritatea mărfii, plata și
                            respectarea termenelor revin exclusiv părților semnatare, conform Codului Civil al RM.
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-amber-200 flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="disclaimerCheck"
                          checked={pathBDisclaimerChecked || active.disclaimer_accepted}
                          disabled={active.disclaimer_accepted}
                          onChange={(e) => setPathBDisclaimerChecked(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <label
                          htmlFor="disclaimerCheck"
                          className="text-xs font-semibold text-slate-800 cursor-pointer select-none"
                        >
                          Confirm că înțeleg și accept că platforma este exonerată de orice răspundere
                          asupra mărfii sau tranzacției.
                        </label>
                      </div>

                      {!active.disclaimer_accepted && (
                        <button
                          onClick={handleConfirmPathB}
                          disabled={!pathBDisclaimerChecked}
                          className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                            pathBDisclaimerChecked
                              ? "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          Asumă Clauza de Exonerare și Finalizează Înțelegerea Directă
                        </button>
                      )}

                      {active.disclaimer_accepted && (
                        <div className="text-[11px] text-amber-900 font-mono">
                          ✓ Asumată și consemnată în audit_log la:{" "}
                          <strong>{active.disclaimer_accepted_at || active.created_at}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── PROMPT K9: ZONĂ SPECIFICĂ CALEA A (CONFIRMARE BILATERALĂ) ─── */}
                  {active.contract_path !== "PATH_B_DIRECT" && (
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-blue-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-blue-700" />
                          <span>Mecanism de Confirmare Bilaterală a Livrării:</span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                            active.is_fully_completed
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {active.is_fully_completed
                            ? "✓ Livrare Confirmată Bilateral"
                            : "În curs de recepție"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Status Expeditor */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between gap-2">
                          <div>
                            <div className="text-[11px] text-slate-500 font-medium">1. Expeditor (Beneficiar):</div>
                            <div className="font-bold text-slate-900 text-xs mt-0.5">
                              {active.shipper_confirmed ? (
                                <span className="text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Recepție Confirmată ({active.shipper_confirmed_at?.slice(0, 16) || "Astăzi"})
                                </span>
                              ) : (
                                <span className="text-amber-700">Se așteaptă confirmarea recepției</span>
                              )}
                            </div>
                          </div>
                          {!active.shipper_confirmed && (
                            <button
                              onClick={() => handleBilateralConfirm("SHIPPER")}
                              className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              Confirmă Recepția ca Expeditor
                            </button>
                          )}
                        </div>

                        {/* Status Transportator */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between gap-2">
                          <div>
                            <div className="text-[11px] text-slate-500 font-medium">2. Transportator (Cărăuș):</div>
                            <div className="font-bold text-slate-900 text-xs mt-0.5">
                              {active.carrier_confirmed ? (
                                <span className="text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Predare Confirmată ({active.carrier_confirmed_at?.slice(0, 16) || "Astăzi"})
                                </span>
                              ) : (
                                <span className="text-amber-700">Se așteaptă confirmarea predării</span>
                              )}
                            </div>
                          </div>
                          {!active.carrier_confirmed && (
                            <button
                              onClick={() => handleBilateralConfirm("CARRIER")}
                              className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              Confirmă Predarea ca Transportator
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Buton Semnare dacă nu este deja semnat */}
                  {active.status === "PENDING_SIGNATURE" && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-xs text-slate-600 font-medium whitespace-nowrap">Semnatar:</label>
                        <input
                          type="text"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded text-xs w-full sm:w-64 font-medium focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <button
                        onClick={handleSignContract}
                        disabled={isSigning}
                        className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{isSigning ? "Se semnează..." : "Semnează Digital (SHA-256)"}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB 2: PROMPT K8 — NEGOCIERE & MESAGERIE DIRECTĂ IN-APP ──── */}
              {activeDetailTab === "NEGOTIATION" && (
                <div className="flex flex-col gap-4">
                  <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-blue-900">Canal Direct de Negociere Marketplace:</span>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Discutați detaliile cursei direct între {active.sme_company_name} și{" "}
                        {active.carrier_company_name}.
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-700">
                      Tarif Curent: {active.total_price_mdl.toLocaleString()} MDL
                    </span>
                  </div>

                  {/* Mesaje */}
                  <div className="border border-slate-200 rounded-xl p-4 min-h-[220px] max-h-[320px] overflow-y-auto space-y-3 bg-slate-50/40">
                    {!active.negotiation_messages || active.negotiation_messages.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        Niciun mesaj anterior. Începeți negocierea prin trimiterea unei oferte mai jos.
                      </div>
                    ) : (
                      active.negotiation_messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            m.sender_role === "SHIPPER" ? "items-start" : "items-end"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                              m.sender_role === "SHIPPER"
                                ? "bg-white border border-slate-200 text-slate-800 shadow-2xs"
                                : "bg-blue-600 text-white shadow-xs"
                            }`}
                          >
                            <div className="font-bold text-[10px] opacity-80 mb-1 flex items-center gap-1">
                              <span>{m.sender_company_name}</span>
                              <span>({m.sender_role === "SHIPPER" ? "Expeditor" : "Transportator"})</span>
                            </div>
                            <div>{m.message}</div>
                            {m.proposed_price_mdl && (
                              <div
                                className={`mt-2 pt-1.5 border-t text-[11px] font-bold flex items-center justify-between ${
                                  m.sender_role === "SHIPPER"
                                    ? "border-slate-100 text-blue-600"
                                    : "border-blue-500 text-blue-100"
                                }`}
                              >
                                <span>Preț Propus:</span>
                                <span>{m.proposed_price_mdl.toLocaleString()} MDL</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5 px-1">{m.created_at}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input Mesaj & Preț */}
                  <div className="p-3 border border-slate-200 rounded-xl bg-white flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Scrieți mesajul către partener (ex: Se poate preluare la ora 11:00?)..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                      />
                      <input
                        type="number"
                        placeholder="Preț propus MDL"
                        value={proposedPriceInput}
                        onChange={(e) => setProposedPriceInput(e.target.value ? Number(e.target.value) : "")}
                        className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        Mesajul este transmis prin canal securizat și notificat pe telefon/email.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSendNegotiationMessage("SHIPPER")}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          Trimite ca Expeditor
                        </button>
                        <button
                          onClick={() => handleSendNegotiationMessage("CARRIER")}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Trimite ca Transportator</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── TAB 3: PROMPT K11 — DOVADĂ FOTO LIVRARE (STIL AMAZON) ───── */}
              {activeDetailTab === "PHOTO" && (
                <div className="space-y-4 text-xs">
                  {/* Banner de Securitate K11 */}
                  <div className="p-3.5 rounded-lg bg-slate-900 text-white flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Acces Restricționat K11: Vizibil Strict Părților Implicate</div>
                        <div className="text-[11px] text-slate-300">
                          Doar <strong>{active.sme_company_name}</strong> și{" "}
                          <strong>{active.carrier_company_name}</strong> au permisiunea de a vizualiza dovada foto.
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[10px] border border-slate-700">
                      IDNO_MATCH: 100%
                    </span>
                  </div>

                  {active.delivery_photo ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      {/* Imagine */}
                      <div className="relative h-64 bg-slate-100 flex items-center justify-center overflow-hidden">
                        <img
                          src={active.delivery_photo.url}
                          alt="Dovadă livrare marfă"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-2.5 py-1 rounded text-[10px] font-bold font-mono">
                          ✓ DOVADĂ LIVRARE VALIDATĂ
                        </div>
                      </div>

                      {/* Metadate Foto Livrare */}
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border-t border-slate-200">
                        <div>
                          <div className="text-[11px] text-slate-500 font-medium">Data & Ora Încărcării:</div>
                          <div className="font-bold text-slate-900 font-mono mt-0.5">
                            {active.delivery_photo.timestamp}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-500 font-medium">Coordonate GPS Rampă:</div>
                          <div className="font-bold text-blue-700 font-mono mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>
                              {active.delivery_photo.gps_lat}° N, {active.delivery_photo.gps_lon}° E
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-500 font-medium">Autor Încărcare:</div>
                          <div className="font-bold text-slate-900 mt-0.5">
                            {active.delivery_photo.uploaded_by}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Nu a fost încărcată nicio fotografie</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-md">
                          Șoferul sau dispecerul transportatorului trebuie să captureze o fotografie a mărfii descărcate
                          la rampă înainte de confirmarea finală.
                        </p>
                      </div>
                      <button
                        onClick={handleUploadPhotoProof}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Simulează Încărcare Foto Rampă (Camera GPS)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── MODAL CREARE ACORD NOU (PROMPT K9 & K12) ──────────────────────── */}
        {isNewContractModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-8">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Constructor Acord / Contract B2B Nou</h3>
                  <p className="text-xs text-slate-500">
                    Alegeți calea legală și configurați detaliile expediției
                  </p>
                </div>
                <button
                  onClick={() => setIsNewContractModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateNewContract} className="p-5 flex flex-col gap-4 text-xs">
                {/* Opțiuni Calea A vs Calea B */}
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-slate-800">Selectați Calea Contractuală:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewPath("PATH_A_PLATFORM")}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        newPath === "PATH_A_PLATFORM"
                          ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-bold text-blue-950 flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        Calea A (Platformă)
                      </span>
                      <span className="text-[11px] text-slate-600 leading-snug">
                        Semnătură SHA-256, acces GPS live garantat, confirmare bilaterală obligatorie.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewPath("PATH_B_DIRECT")}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        newPath === "PATH_B_DIRECT"
                          ? "border-amber-600 bg-amber-50/70 ring-1 ring-amber-600"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-bold text-amber-950 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Calea B (Direct)
                      </span>
                      <span className="text-[11px] text-slate-600 leading-snug">
                        Înțelegere directă fără medierea platformei, cu exonerare explicită de răspundere.
                      </span>
                    </button>
                  </div>
                </div>

                {/* IDNO Expeditor & Transportator (Auto-detectie SRL/Î.I. Prompt K12) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      IDNO Expeditor:
                    </label>
                    <input
                      type="text"
                      required
                      value={newShipperIdno}
                      onChange={(e) => {
                        setNewShipperIdno(e.target.value);
                        const prof = getCompanyLegalProfile(e.target.value, newShipperName);
                        setNewShipperName(prof.companyName);
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold focus:outline-none focus:border-blue-600"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Detectat: {getCompanyLegalProfile(newShipperIdno, newShipperName).legalFormDescription}
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      IDNO Transportator:
                    </label>
                    <input
                      type="text"
                      required
                      value={newCarrierIdno}
                      onChange={(e) => {
                        setNewCarrierIdno(e.target.value);
                        const prof = getCompanyLegalProfile(e.target.value, newCarrierName);
                        setNewCarrierName(prof.companyName);
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold focus:outline-none focus:border-blue-600"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Detectat: {getCompanyLegalProfile(newCarrierIdno, newCarrierName).legalFormDescription}
                    </span>
                  </div>
                </div>

                {/* Detalii Cursă & Calcul Preț din Preț/km × Distanță (Prompt K12) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Traseu / Coridor:</label>
                    <input
                      type="text"
                      required
                      value={newCorridor}
                      onChange={(e) => setNewCorridor(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Număr Paleți:</label>
                    <input
                      type="number"
                      min={1}
                      max={33}
                      value={newPallets}
                      onChange={(e) => setNewPallets(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Distanță Traseu (km):</label>
                    <input
                      type="number"
                      min={10}
                      value={newDistanceKm}
                      onChange={(e) => setNewDistanceKm(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tarif Bază per km (MDL):</label>
                    <input
                      type="number"
                      step={0.5}
                      value={newPricePerKm}
                      onChange={(e) => setNewPricePerKm(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* Sumar Preț Calculat Automat */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between font-mono">
                  <span className="text-slate-600 font-sans">
                    Preț Estimat (Prompt K12): {newDistanceKm} km × {newPricePerKm} MDL =
                  </span>
                  <span className="font-bold text-blue-700 text-sm">
                    {calculateEstimatedRoutePrice(newPricePerKm, newDistanceKm).totalEstimatedMdl.toLocaleString()}{" "}
                    MDL
                  </span>
                </div>

                {/* Avertisment obligatoriu dacă e Calea B */}
                {newPath === "PATH_B_DIRECT" && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                    <div className="text-amber-900 font-bold text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Confirmare Obligatorie Exonerare:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="modalDisclaimer"
                        required
                        checked={newDisclaimerChecked}
                        onChange={(e) => setNewDisclaimerChecked(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                      />
                      <label htmlFor="modalDisclaimer" className="text-[11px] text-slate-800 cursor-pointer">
                        Platforma NU își asumă răspunderea pentru marfa transportată prin această înțelegere directă.
                      </label>
                    </div>
                  </div>
                )}

                {/* Butoane Acțiune Modal */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsNewContractModalOpen(false)}
                    className="px-3.5 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition-colors"
                  >
                    Generează Acordul
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
