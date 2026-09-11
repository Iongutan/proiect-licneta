"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/ui/Sidebar";
import VehicleBlueprintSVG, { VehicleBlueprintType } from "@/components/logistics/VehicleBlueprintSVG";

export interface FleetVehicle {
  id: string;
  plate: string;
  model: string;
  vehicleType: VehicleBlueprintType;
  carrierName: string;
  driverName: string;
  driverPhone: string;
  pricePerKm: number;
  hasConditioner: boolean;
  totalPallets: number;
  occupiedPallets: number;
  gpsSensorId: string;
  isVerifiedANTA: boolean;
  destinationScope: "INTERN" | "INTERNATIONAL";
  currentRoute: string;
  status: "AVAILABLE" | "ON_ROUTE" | "MAINTENANCE";
}

const INITIAL_FLEET: FleetVehicle[] = [
  {
    id: "vh-1",
    plate: "CAN 001",
    model: "Mercedes-Benz Actros 1845 (TIR Prelată)",
    vehicleType: "SEMI_CURTAINSIDE_33",
    carrierName: "TransMold Express SRL",
    driverName: "Ion Popescu",
    driverPhone: "+373 69 112 233",
    pricePerKm: 18.5,
    hasConditioner: false,
    totalPallets: 33,
    occupiedPallets: 21,
    gpsSensorId: "GPS-TK-8812 (Teltonika 4G)",
    isVerifiedANTA: true,
    destinationScope: "INTERNATIONAL",
    currentRoute: "Chișinău ➔ București / Iași",
    status: "AVAILABLE",
  },
  {
    id: "vh-2",
    plate: "TRL 901",
    model: "Scania R500 6x4 (Trailă Utilaje & Mașini)",
    vehicleType: "MACHINERY_LOWBED",
    carrierName: "AgroTrans Heavy Haulage SRL",
    driverName: "Dumitru Vangheli",
    driverPhone: "+373 68 990 112",
    pricePerKm: 32.0,
    hasConditioner: false,
    totalPallets: 0, // Agabaritic / Mașini mari
    occupiedPallets: 0,
    gpsSensorId: "GPS-TK-9950 (Heavy Duty)",
    isVerifiedANTA: true,
    destinationScope: "INTERN",
    currentRoute: "Bălți ➔ Chișinău (Transport Tractoare)",
    status: "ON_ROUTE",
  },
  {
    id: "vh-3",
    plate: "FRG 404",
    model: "Volvo FH 500 (Frigorific Schmitz -20°C)",
    vehicleType: "SEMI_REEFER_33",
    carrierName: "ColdChain Moldova SRL",
    driverName: "Sergiu Moraru",
    driverPhone: "+373 79 332 110",
    pricePerKm: 21.5,
    hasConditioner: true,
    totalPallets: 33,
    occupiedPallets: 26,
    gpsSensorId: "GPS-TK-4411 (Temp Sensor)",
    isVerifiedANTA: true,
    destinationScope: "INTERNATIONAL",
    currentRoute: "Orhei ➔ Chișinău ➔ Brașov",
    status: "AVAILABLE",
  },
  {
    id: "vh-4",
    plate: "BST 102",
    model: "MAN TGX 18.500 (Tren Rutier Tandem)",
    vehicleType: "ROAD_TRAIN_40",
    carrierName: "LogiSpeed Moldova SA",
    driverName: "Gheorghe Rusu",
    driverPhone: "+373 78 334 455",
    pricePerKm: 22.0,
    hasConditioner: false,
    totalPallets: 40,
    occupiedPallets: 28,
    gpsSensorId: "GPS-TK-9041 (Teltonika)",
    isVerifiedANTA: true,
    destinationScope: "INTERNATIONAL",
    currentRoute: "Bălți ➔ Suceava ➔ Budapesta",
    status: "ON_ROUTE",
  },
  {
    id: "vh-5",
    plate: "CHL 501",
    model: "DAF CF 450 (Rigid 18t cu Lift)",
    vehicleType: "RIGID_BOX_18",
    carrierName: "SudTrans Agro SRL",
    driverName: "Nicolae Ceban",
    driverPhone: "+373 79 223 344",
    pricePerKm: 15.0,
    hasConditioner: false,
    totalPallets: 18,
    occupiedPallets: 10,
    gpsSensorId: "GPS-TK-3301",
    isVerifiedANTA: true,
    destinationScope: "INTERN",
    currentRoute: "Cahul ➔ Chișinău",
    status: "AVAILABLE",
  },
  {
    id: "vh-6",
    plate: "ORH 301",
    model: "Mercedes-Benz Sprinter 316 (Dubă Express)",
    vehicleType: "VAN_CARGO_4",
    carrierName: "OrheiTrans Rapid SRL",
    driverName: "Mihai Cojocaru",
    driverPhone: "+373 60 445 566",
    pricePerKm: 11.0,
    hasConditioner: false,
    totalPallets: 4,
    occupiedPallets: 2,
    gpsSensorId: "GPS-MV-5520",
    isVerifiedANTA: true,
    destinationScope: "INTERN",
    currentRoute: "Orhei ➔ Chișinău",
    status: "AVAILABLE",
  },
];

export default function FleetPage() {
  const [fleet, setFleet] = useState<FleetVehicle[]>(INITIAL_FLEET);
  const [activeTab, setActiveTab] = useState<"CATALOG" | "CONFIGURATOR">("CATALOG");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [scopeFilter, setScopeFilter] = useState<string>("ALL");

  // State Configurator Interactiv de Paleți
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("vh-1");
  const [layoutOrientation, setLayoutOrientation] = useState<"2_WIDE" | "3_LONG">("3_LONG");
  const [palletWeightKg, setPalletWeightKg] = useState<number>(650);
  
  // Vector boolean pentru 33 poziții de paleți (true = ocupat, false = liber)
  const [palletSlots, setPalletSlots] = useState<boolean[]>(
    Array.from({ length: 33 }, (_, i) => i < 21) // 21 ocupați inițial
  );

  // Modal Adăugare Vehicul
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formPlate, setFormPlate] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formType, setFormType] = useState<VehicleBlueprintType>("SEMI_CURTAINSIDE_33");
  const [formCarrier, setFormCarrier] = useState("TransMold Express SRL");
  const [formDriver, setFormDriver] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPrice, setFormPrice] = useState(18.5);
  const [formConditioner, setFormConditioner] = useState(false);
  const [formPallets, setFormPallets] = useState(33);
  const [formGps, setFormGps] = useState("GPS-TK-");
  const [formScope, setFormScope] = useState<"INTERN" | "INTERNATIONAL">("INTERN");
  const [formRoute, setFormRoute] = useState("Chișinău ➔ Bălți");

  // Calcule pentru Configuratorul Interactiv
  const totalOccupiedCount = palletSlots.filter(Boolean).length;
  const totalSlotsCount = layoutOrientation === "3_LONG" ? 33 : 32;
  const totalLoadedWeightKg = totalOccupiedCount * palletWeightKg;
  const maxPayloadKg = 24000;
  const weightPercentage = Math.round((totalLoadedWeightKg / maxPayloadKg) * 100);

  // Estimare distribuție sarcini pe axe (față/spate)
  const frontSlots = palletSlots.slice(0, Math.floor(totalSlotsCount / 2)).filter(Boolean).length;
  const rearSlots = palletSlots.slice(Math.floor(totalSlotsCount / 2)).filter(Boolean).length;
  const frontWeightRatio = totalOccupiedCount > 0 ? Math.round((frontSlots / totalOccupiedCount) * 100) : 50;
  const isAxleBalanced = frontWeightRatio >= 40 && frontWeightRatio <= 60;

  const togglePalletSlot = (index: number) => {
    setPalletSlots((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const fillAllPallets = () => {
    setPalletSlots(Array(33).fill(true));
  };

  const clearAllPallets = () => {
    setPalletSlots(Array(33).fill(false));
  };

  const balancePalletsZigZag = () => {
    // Umplere echilibrată față-spate alternativ
    const next = Array(33).fill(false);
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        next[Math.floor(i / 2)] = true; // Față
      } else {
        next[32 - Math.floor(i / 2)] = true; // Spate
      }
    }
    setPalletSlots(next);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const newVh: FleetVehicle = {
      id: `vh-${Date.now()}`,
      plate: formPlate || "CAN 999",
      model: formModel || "Autovehicul Marfă",
      vehicleType: formType,
      carrierName: formCarrier,
      driverName: formDriver || "Șofer Alocat",
      driverPhone: formPhone || "+373 69 111 222",
      pricePerKm: Number(formPrice),
      hasConditioner: formConditioner,
      totalPallets: formType === "MACHINERY_LOWBED" ? 0 : Number(formPallets),
      occupiedPallets: 0,
      gpsSensorId: formGps,
      isVerifiedANTA: true,
      destinationScope: formScope,
      currentRoute: formRoute,
      status: "AVAILABLE",
    };

    setFleet((prev) => [newVh, ...prev]);
    setIsModalOpen(false);
  };

  const filteredFleet = fleet.filter((vh) => {
    if (filterType !== "ALL" && vh.vehicleType !== filterType) return false;
    if (scopeFilter !== "ALL" && vh.destinationScope !== scopeFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/fleet" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-6">
        {/* Header Minimalist */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Gestiune Flotă & Configurator Remorci 2D
              </h1>
              <span className="badge-blue font-bold">B2B Logistic</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configurarea vehiculelor de transport (prelate, frigorifice, traile utilaje grele, autotrenuri) și simularea aranjării paleților
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("CATALOG")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "CATALOG"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Catalog Flotă (3 Coloane)
              </button>
              <button
                onClick={() => setActiveTab("CONFIGURATOR")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "CONFIGURATOR"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Aranjament Manual Paleți
              </button>
            </div>

            <button
              onClick={() => {
                setFormPlate("");
                setFormModel("");
                setFormType("SEMI_CURTAINSIDE_33");
                setFormGps(`GPS-TK-${Math.floor(1000 + Math.random() * 9000)}`);
                setIsModalOpen(true);
              }}
              className="btn-primary text-xs"
            >
              + Adaugă Vehicul Nou
            </button>
          </div>
        </div>

        {/* ─── TAB 1: CATALOG FLOTĂ PE 3 COLOANE ───────────────────────────── */}
        {activeTab === "CATALOG" && (
          <>
            {/* Bare de Filtrare Minimaliste */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 mr-1">Tip Remorcă:</span>
                {[
                  { id: "ALL", label: "Toate Modelele" },
                  { id: "SEMI_CURTAINSIDE_33", label: "Prelată Standard (33p)" },
                  { id: "SEMI_REEFER_33", label: "Frigorific (33p)" },
                  { id: "MACHINERY_LOWBED", label: "Trailă Utilaje / Mașini Mari" },
                  { id: "ROAD_TRAIN_40", label: "Tren Rutier (40p)" },
                  { id: "RIGID_BOX_18", label: "Camion Rigid (18p)" },
                  { id: "VAN_CARGO_4", label: "Dubă 3.5t (4p)" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                      filterType === f.id
                        ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Destinație:</span>
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 rounded-md px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="ALL">Toate Destinațiile</option>
                  <option value="INTERN">Intern Moldova</option>
                  <option value="INTERNATIONAL">Export România / UE</option>
                </select>
              </div>
            </div>

            {/* Grid-ul Principal de 3 COLOANE */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFleet.map((vh) => (
                <div
                  key={vh.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col"
                >
                  {/* Zona Schiță Tehnică CAD */}
                  <div className="bg-slate-50/70 border-b border-slate-100 p-3 flex flex-col items-center justify-center relative">
                    <div className="w-full">
                      <VehicleBlueprintSVG
                        type={vh.vehicleType}
                        hasConditioner={vh.hasConditioner}
                        className="w-full h-28"
                      />
                    </div>

                    {/* Badge-uri de colț */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="font-mono text-xs font-bold bg-white text-slate-800 border border-slate-300 px-2 py-0.5 rounded shadow-2xs">
                        {vh.plate}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {vh.isVerifiedANTA && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          ✓ ANTA
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          vh.status === "AVAILABLE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : vh.status === "ON_ROUTE"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {vh.status === "AVAILABLE"
                          ? "Disponibil"
                          : vh.status === "ON_ROUTE"
                          ? "Pe Traseu"
                          : "Mentenanță"}
                      </span>
                    </div>
                  </div>

                  {/* Informații Tehnice & Comerciale */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900 tracking-tight">{vh.model}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{vh.carrierName}</div>

                      {/* Specificații */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Capacitate:</span>
                          <span className="font-semibold text-slate-800">
                            {vh.totalPallets > 0 ? `${vh.totalPallets} Euro-Paleți` : "Agabaritic / Mașini"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Tarif mediu:</span>
                          <span className="font-bold text-blue-700">{vh.pricePerKm} MDL / km</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Senzor GPS:</span>
                          <span className="font-mono text-[11px] text-slate-700">{vh.gpsSensorId}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Rută Curentă:</span>
                          <span className="font-medium text-slate-700 truncate block" title={vh.currentRoute}>
                            {vh.currentRoute}
                          </span>
                        </div>
                      </div>

                      {/* Telefon șofer */}
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                        <span>Șofer: {vh.driverName}</span>
                        <span className="font-mono text-slate-800">{vh.driverPhone}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedVehicleId(vh.id);
                          setActiveTab("CONFIGURATOR");
                        }}
                        className="flex-1 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all text-center"
                      >
                        Configurează Paleți
                      </button>
                      <Link
                        href="/map"
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all"
                      >
                        Localizează GPS
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── TAB 2: CONFIGURATOR INTERACTIV DE ARANJARE PALEȚI ───────────── */}
        {activeTab === "CONFIGURATOR" && (
          <div className="flex flex-col gap-6">
            {/* Bara de control configurator */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Selectare Camion din Flotă:
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-600"
                  >
                    {fleet.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} — {v.model} ({v.totalPallets > 0 ? `${v.totalPallets} Paleți` : "Agabaritic"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Aranjament Paleți:
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                    <button
                      onClick={() => setLayoutOrientation("3_LONG")}
                      className={`px-3 py-1 rounded-md transition-all ${
                        layoutOrientation === "3_LONG"
                          ? "bg-white text-blue-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      3 de-a lungul (11 col × 3 = 33 paleți)
                    </button>
                    <button
                      onClick={() => setLayoutOrientation("2_WIDE")}
                      className={`px-3 py-1 rounded-md transition-all ${
                        layoutOrientation === "2_WIDE"
                          ? "bg-white text-blue-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      2 de-a latul (16 col × 2 = 32 paleți)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Greutate per Palet (kg):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={100}
                      max={1200}
                      step={50}
                      value={palletWeightKg}
                      onChange={(e) => setPalletWeightKg(Number(e.target.value))}
                      className="w-24 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">kg</span>
                  </div>
                </div>
              </div>

              {/* Butoane Acțiuni Rapide */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={balancePalletsZigZag}
                  className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all"
                >
                  Echilibrare pe Axe
                </button>
                <button
                  onClick={fillAllPallets}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all"
                >
                  Încarcă Tot
                </button>
                <button
                  onClick={clearAllPallets}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all"
                >
                  Golește Remorca
                </button>
              </div>
            </div>

            {/* Panoul de Schemă 2D Interactivă a Remorcii */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Plan Podea Semiremorcă (Vedere de Sus - Floorplan 2D)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Faceți clic pe orice slot pentru a încărca sau descărca manual un palet
                  </p>
                </div>

                {/* Indicator Echilibru Sarcină */}
                <div className="flex items-center gap-3">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                      isAxleBalanced
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isAxleBalanced ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {isAxleBalanced
                      ? "Echilibru Axe: Optim (Fără risc amenzi)"
                      : "Echilibru Axe: Dezechilibrat (Ajustați încărcarea)"}
                  </div>
                </div>
              </div>

              {/* Rampa Vizuală de Încărcare (Interior Remorcă 13.6m) */}
              <div className="border-2 border-slate-300 rounded-xl p-4 bg-slate-50 flex items-center gap-3 overflow-x-auto">
                {/* Cabina Tractor (Față Remorcă) */}
                <div className="w-16 h-48 bg-slate-800 text-white rounded-lg flex flex-col items-center justify-center p-2 text-center shrink-0 shadow-xs">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">FAȚĂ</span>
                  <span className="text-xs font-bold mt-1">CABINĂ</span>
                  <span className="text-[9px] text-blue-400 mt-2 font-mono">
                    {frontWeightRatio}% masă
                  </span>
                </div>

                {/* Podea Compartiment Mărfuri */}
                <div className="flex-1 min-w-[680px]">
                  <div
                    className={`grid gap-1.5 ${
                      layoutOrientation === "3_LONG"
                        ? "grid-rows-3 grid-flow-col"
                        : "grid-rows-2 grid-flow-col"
                    }`}
                  >
                    {palletSlots.slice(0, totalSlotsCount).map((isOccupied, idx) => (
                      <button
                        key={idx}
                        onClick={() => togglePalletSlot(idx)}
                        className={`h-14 rounded-md border flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                          isOccupied
                            ? "bg-blue-600 border-blue-700 text-white shadow-xs hover:bg-blue-700"
                            : "bg-white border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:bg-blue-50/40"
                        }`}
                      >
                        {isOccupied ? (
                          <>
                            <span className="text-[10px] font-bold tracking-tight">P-{idx + 1}</span>
                            <span className="text-[9px] opacity-80 font-mono">{palletWeightKg} kg</span>
                          </>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">+ LIBER</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Riglă dimensiune podea */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono border-t border-slate-200 pt-1.5">
                    <span>0.0 m (Față)</span>
                    <span>Lungime Utilă: 13.60 m · Lățime: 2.45 m</span>
                    <span>13.6 m (Uși Spate)</span>
                  </div>
                </div>

                {/* Uși Spate Rampa */}
                <div className="w-16 h-48 bg-slate-200 text-slate-700 rounded-lg flex flex-col items-center justify-center p-2 text-center shrink-0 border border-slate-300">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">SPATE</span>
                  <span className="text-xs font-bold mt-1">UȘI RAMPĂ</span>
                  <span className="text-[9px] text-slate-500 mt-2 font-mono">
                    {100 - frontWeightRatio}% masă
                  </span>
                </div>
              </div>

              {/* Statistici & Calcule Tehnice Reale */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Paleți Încărcați:</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {totalOccupiedCount}{" "}
                    <span className="text-xs font-normal text-slate-500">/ {totalSlotsCount} locuri</span>
                  </div>
                  <div className="text-xs text-blue-600 font-semibold mt-1">
                    {totalSlotsCount - totalOccupiedCount} poziții rămase libere
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Masă Totală Marfă:</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {(totalLoadedWeightKg / 1000).toFixed(1)}{" "}
                    <span className="text-xs font-normal text-slate-500">/ 24.0 tone</span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono mt-1">
                    {totalLoadedWeightKg.toLocaleString()} kg încărcați
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Grad Utilizare Volum:</div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">
                    {Math.round((totalOccupiedCount / totalSlotsCount) * 100)}%
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.round((totalOccupiedCount / totalSlotsCount) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Capacitate Restantă:</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">
                    {((maxPayloadKg - totalLoadedWeightKg) / 1000).toFixed(1)}{" "}
                    <span className="text-xs font-normal text-slate-500">tone disponibile</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Potențial consolidare GroupLog
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL ADĂUGARE VEHICUL NOU ─────────────────────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Înregistrare Vehicul Nou în Flotă</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveVehicle} className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Număr Înmatriculare (MD/RO):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="CAN 001"
                      value={formPlate}
                      onChange={(e) => setFormPlate(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Model / Șasiu:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Mercedes Actros / Scania R500"
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tip Remorcă / Caroserie:
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as VehicleBlueprintType;
                      setFormType(t);
                      if (t === "MACHINERY_LOWBED") setFormPallets(0);
                      else if (t === "VAN_CARGO_4") setFormPallets(4);
                      else if (t === "RIGID_BOX_18") setFormPallets(18);
                      else if (t === "ROAD_TRAIN_40") setFormPallets(40);
                      else setFormPallets(33);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-600"
                  >
                    <option value="SEMI_CURTAINSIDE_33">TIR Semiremorcă Prelată (13.6m · 33 Euro-Paleți)</option>
                    <option value="SEMI_REEFER_33">Semiremorcă Frigorifică (-20°C / +4°C · 33 Euro-Paleți)</option>
                    <option value="MACHINERY_LOWBED">Trailă Utilaje Grele / Mașini Mari (Agabaritic 45t)</option>
                    <option value="ROAD_TRAIN_40">Tren Rutier Tandem (2 Remorci · 40 Euro-Paleți)</option>
                    <option value="RIGID_BOX_18">Camion Rigid Solo cu Lift Hidraulic (18 Euro-Paleți)</option>
                    <option value="VAN_CARGO_4">Dubă / Furgonetă Express 3.5t (4 Euro-Paleți)</option>
                  </select>
                </div>

                {/* Previzualizare Schiță CAD */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">PREVIZUALIZARE CAD:</span>
                  <VehicleBlueprintSVG type={formType} hasConditioner={formConditioner} className="w-full h-24" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tarif per KM (MDL):
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ID Senzor Telematic GPS:
                    </label>
                    <input
                      type="text"
                      required
                      value={formGps}
                      onChange={(e) => setFormGps(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nume Șofer:
                    </label>
                    <input
                      type="text"
                      placeholder="Ion Rusu"
                      value={formDriver}
                      onChange={(e) => setFormDriver(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Telefon Șofer:
                    </label>
                    <input
                      type="text"
                      placeholder="+373 69 000 000"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formConditioner}
                      onChange={(e) => setFormConditioner(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                    <span>Agregat Frigorific Activ</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      Salvează Vehiculul
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
