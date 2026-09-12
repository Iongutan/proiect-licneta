"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/ui/Sidebar";
import VehicleBlueprintSVG, { VehicleBlueprintType } from "@/components/logistics/VehicleBlueprintSVG";
import {
  STANDARD_PALLETS,
  PrecisionPallet,
  canPlacePallet,
  calculateTotalPayload,
  StandardPalletType,
} from "@/lib/pallet-positioning";
import {
  Plus,
  Truck,
  Check,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Radio,
  Scale,
  DollarSign,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  X,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

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

  // PROMPT K6: Flux Constructor Stepper Pas-cu-Pas (4 Pași)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Pasul 1: Marcă, model, înmatriculare, transportator, șofer
  const [stepPlate, setStepPlate] = useState("");
  const [stepModel, setStepModel] = useState("");
  const [stepCarrier, setStepCarrier] = useState("TransMold Express SRL");
  const [stepDriver, setStepDriver] = useState("");
  const [stepPhone, setStepPhone] = useState("");

  // Pasul 2: Tip caroserie
  const [stepType, setStepType] = useState<VehicleBlueprintType>("SEMI_CURTAINSIDE_33");
  const [stepHasReefer, setStepHasReefer] = useState(false);

  // Pasul 3: Dimensiuni interior, capacitate, sarcină maximă, tarif/km (K12)
  const [stepLengthCm, setStepLengthCm] = useState(1360);
  const [stepWidthCm, setStepWidthCm] = useState(245);
  const [stepHeightCm, setStepHeightCm] = useState(270);
  const [stepMaxPayloadKg, setStepMaxPayloadKg] = useState(24000);
  const [stepTotalPallets, setStepTotalPallets] = useState(33);
  const [stepPricePerKm, setStepPricePerKm] = useState(18.5);

  // Pasul 4: Dispozitiv GPS
  const [stepGpsTrackerId, setStepGpsTrackerId] = useState("");
  const [stepGpsProtocol, setStepGpsProtocol] = useState("TELTONIKA_FMB920");

  // PROMPT K7: Stare Constructor Avansat de Poziționare Paleți 2D cu Verificare Coliziuni
  const [activeFormatTool, setActiveFormatTool] = useState<StandardPalletType>("EUR_120x80");
  const [precisionPallets, setPrecisionPallets] = useState<PrecisionPallet[]>([
    { id: "p-1", palletNumber: 1, format: "EUR_120x80", x: 20, y: 20, width: 120, length: 80, weightKg: 750, status: "OCCUPIED" },
    { id: "p-2", palletNumber: 2, format: "EUR_120x80", x: 20, y: 110, width: 120, length: 80, weightKg: 680, status: "OCCUPIED" },
    { id: "p-3", palletNumber: 3, format: "EUR_120x80", x: 150, y: 20, width: 120, length: 80, weightKg: 820, status: "OCCUPIED" },
    { id: "p-4", palletNumber: 4, format: "EUR_120x80", x: 150, y: 110, width: 120, length: 80, weightKg: 710, status: "OCCUPIED" },
    { id: "p-5", palletNumber: 5, format: "ISO_100x120", x: 280, y: 20, width: 100, length: 120, weightKg: 950, status: "FREE" },
  ]);
  const [collisionWarning, setCollisionWarning] = useState<string | null>(null);

  const currentVehicleDimensions = {
    lengthCm: stepLengthCm || 1360,
    widthCm: stepWidthCm || 245,
    heightCm: stepHeightCm || 270,
    maxPayloadKg: stepMaxPayloadKg || 24000,
  };

  const payloadSummary = calculateTotalPayload(precisionPallets, currentVehicleDimensions.maxPayloadKg);

  const handleAddPalletAt = (xCm: number, yCm: number) => {
    const spec = STANDARD_PALLETS[activeFormatTool] || STANDARD_PALLETS.EUR_120x80;
    const newP: PrecisionPallet = {
      id: `p-${Date.now()}`,
      palletNumber: precisionPallets.length + 1,
      format: activeFormatTool,
      x: Math.max(0, Math.min(xCm, currentVehicleDimensions.lengthCm - spec.width)),
      y: Math.max(0, Math.min(yCm, currentVehicleDimensions.widthCm - spec.length)),
      width: spec.width,
      length: spec.length,
      weightKg: spec.defaultWeightKg,
      status: "OCCUPIED",
    };

    const check = canPlacePallet(precisionPallets, newP, currentVehicleDimensions);
    if (!check.allowed) {
      setCollisionWarning(check.reason || "Coliziune / Suprapunere detectată!");
      setTimeout(() => setCollisionWarning(null), 3000);
      return;
    }

    setCollisionWarning(null);
    setPrecisionPallets((prev) => [...prev, newP]);
  };

  const handleCompleteWizard = () => {
    if (!stepGpsTrackerId.trim()) {
      alert("Introduceți identificatorul dispozitivului GPS.");
      return;
    }

    const newId = `vh-${Date.now()}`;
    const newVh: FleetVehicle = {
      id: newId,
      plate: stepPlate || "CAN 777",
      model: stepModel || "Mercedes-Benz Actros",
      vehicleType: stepType,
      carrierName: stepCarrier,
      driverName: stepDriver || "Șofer Desemnat",
      driverPhone: stepPhone || "+373 69 000 000",
      pricePerKm: stepPricePerKm || 18.5,
      hasConditioner: stepHasReefer,
      totalPallets: stepTotalPallets || 33,
      occupiedPallets: 0,
      gpsSensorId: stepGpsTrackerId,
      isVerifiedANTA: true,
      destinationScope: "INTERN",
      currentRoute: "Chișinău ➔ Rezina",
      status: "AVAILABLE",
    };

    setFleet((prev) => [newVh, ...prev]);

    // Sincronizare cu localStorage pentru hartă (Prompt K6)
    try {
      const existing = localStorage.getItem("optifleet_available_trucks");
      const currentList = existing ? JSON.parse(existing) : [];
      const mapTruck = {
        id: newId,
        plate: newVh.plate,
        model: newVh.model,
        vehicleType: newVh.vehicleType,
        carrierName: newVh.carrierName,
        carrierPhone: newVh.driverPhone,
        driverName: newVh.driverName,
        pricePerKm: newVh.pricePerKm,
        hasConditioner: newVh.hasConditioner,
        totalPallets: newVh.totalPallets,
        freePallets: newVh.totalPallets,
        isVerifiedANTA: true,
        gpsTrackerId: newVh.gpsSensorId,
        currentRaion: "chisinau",
        destinationScope: "INTERN",
        availableNow: true,
        speedKmH: 74,
        fuelLevelPercent: 92,
        lat: 47.025 + (Math.random() - 0.5) * 0.04,
        lon: 28.85 + (Math.random() - 0.5) * 0.04,
        layoutOrientation: "2_WIDE",
      };
      localStorage.setItem("optifleet_available_trucks", JSON.stringify([mapTruck, ...currentList]));
    } catch {}

    setIsWizardOpen(false);
  };

  const totalSlotsCount = layoutOrientation === "3_LONG" ? 33 : 26;
  const totalOccupiedCount = palletSlots.slice(0, totalSlotsCount).filter(Boolean).length;
  const maxPayloadKg = 24000;
  const totalLoadedWeightKg = totalOccupiedCount * palletWeightKg;

  // Distribuție greutate față / spate
  const halfSlots = Math.floor(totalSlotsCount / 2);
  const frontOccupied = palletSlots.slice(0, halfSlots).filter(Boolean).length;
  const frontWeightRatio = totalOccupiedCount > 0 
    ? Math.round((frontOccupied / totalOccupiedCount) * 100) 
    : 50;
  const isAxleBalanced = Math.abs(frontWeightRatio - 50) <= 15;

  const togglePalletSlot = (idx: number) => {
    setPalletSlots((prev) => {
      const copy = [...prev];
      copy[idx] = !copy[idx];
      return copy;
    });
  };

  const balancePalletsZigZag = () => {
    setPalletSlots((prev) =>
      prev.map((_, i) => i % 2 === 0)
    );
  };

  const fillAllPallets = () => {
    setPalletSlots(Array(33).fill(true));
  };

  const clearAllPallets = () => {
    setPalletSlots(Array(33).fill(false));
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
                setWizardStep(1);
                setIsWizardOpen(true);
              }}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Constructor Vehicul</span>
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

        {/* ─── PROMPT K6: BUTON MARE CIRCULAR CU "+" ─── */}
        <button
          onClick={() => {
            setWizardStep(1);
            setIsWizardOpen(true);
          }}
          title="Constructor Vehicul Nou (4 Pași)"
          className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl flex items-center justify-center hover:scale-108 transition-all z-30 group cursor-pointer border-2 border-white focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* ─── PROMPT K6: CONSTRUCTOR VEHICUL ÎN 4 PAȘI (STEPPER) ─── */}
        {isWizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
              {/* Header Wizard cu Stepper Tabs */}
              <div className="p-5 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                      +
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-slate-900">
                        Constructor Vehicul Nou · Flotă B2B
                      </h2>
                      <p className="text-xs text-slate-500">
                        Pasul {wizardStep} din 4:{" "}
                        {wizardStep === 1
                          ? "Identificare & Șasiu"
                          : wizardStep === 2
                          ? "Caroserie & Echipare"
                          : wizardStep === 3
                          ? "Dimensiuni & Sarcină Utilă"
                          : "Conectivitate Telematică GPS"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsWizardOpen(false)}
                    className="w-8 h-8 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Stepper Progres Pills */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { step: 1, label: "1. Marcă & Model" },
                    { step: 2, label: "2. Caroserie" },
                    { step: 3, label: "3. Capacitate" },
                    { step: 4, label: "4. GPS & ANTA" },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className={`py-1.5 px-2 rounded-md text-[11px] font-semibold text-center transition-all ${
                        wizardStep === item.step
                          ? "bg-blue-600 text-white shadow-xs"
                          : wizardStep > item.step
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-white text-slate-400 border border-slate-200"
                      }`}
                    >
                      {wizardStep > item.step ? `✓ ${item.label.split(". ")[1]}` : item.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Corpul Pasului Activ */}
              <div className="p-5 flex flex-col gap-4">
                {/* PASUL 1: Marcă, Model, Număr Înmatriculare, Șofer */}
                {wizardStep === 1 && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Număr Înmatriculare: *
                        </label>
                        <input
                          type="text"
                          placeholder="CAN 001 / BLL 450"
                          value={stepPlate}
                          onChange={(e) => setStepPlate(e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Marcă & Model Vehicul: *
                        </label>
                        <input
                          type="text"
                          placeholder="Mercedes-Benz Actros 1845 / Scania R500"
                          value={stepModel}
                          onChange={(e) => setStepModel(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nume Șofer:
                        </label>
                        <input
                          type="text"
                          placeholder="Ion Popescu"
                          value={stepDriver}
                          onChange={(e) => setStepDriver(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Telefon Contact Șofer:
                        </label>
                        <input
                          type="text"
                          placeholder="+373 69 112 334"
                          value={stepPhone}
                          onChange={(e) => setStepPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Companie Transportatoare:
                      </label>
                      <input
                        type="text"
                        value={stepCarrier}
                        onChange={(e) => setStepCarrier(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* PASUL 2: Tip Caroserie */}
                {wizardStep === 2 && (
                  <div className="flex flex-col gap-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Selectați Tipul Remorcii / Suprastructurii:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        {
                          id: "SEMI_CURTAINSIDE_33" as const,
                          name: "TIR Semiremorcă Prelată",
                          desc: "13.6m · 33 Euro-Paleți Standard",
                          pallets: 33,
                        },
                        {
                          id: "SEMI_REEFER_33" as const,
                          name: "Semiremorcă Frigorifică",
                          desc: "-20°C / +4°C · Schmitz / Krone",
                          pallets: 33,
                        },
                        {
                          id: "MACHINERY_LOWBED" as const,
                          name: "Trailă Utilaje / Mașini Mari",
                          desc: "Platformă joasă agabaritică",
                          pallets: 0,
                        },
                        {
                          id: "ROAD_TRAIN_40" as const,
                          name: "Tren Rutier Tandem",
                          desc: "2 remorci · 40 Euro-Paleți",
                          pallets: 40,
                        },
                        {
                          id: "RIGID_BOX_18" as const,
                          name: "Camion Rigid Solo cu Lift",
                          desc: "Distribuție urbană / regională",
                          pallets: 18,
                        },
                        {
                          id: "VAN_CARGO_4" as const,
                          name: "Dubă 3.5t Express",
                          desc: "4 Euro-Paleți · Tranzit rapid",
                          pallets: 4,
                        },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setStepType(opt.id);
                            setStepTotalPallets(opt.pallets);
                          }}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            stepType === opt.id
                              ? "border-blue-600 bg-blue-50/50 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="font-bold text-xs text-slate-900">{opt.name}</div>
                          <div className="text-[11px] text-slate-500 mt-1">{opt.desc}</div>
                        </div>
                      ))}
                    </div>

                    {/* Previzualizare CAD schiță */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Schiță Tehnică Schelet:
                      </span>
                      <VehicleBlueprintSVG type={stepType} hasConditioner={stepHasReefer} className="w-full h-24" />
                    </div>
                  </div>
                )}

                {/* PASUL 3: Dimensiuni Interioare, Sarcina Maximă, Preț per KM (K12) */}
                {wizardStep === 3 && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Lungime Interior (cm):
                        </label>
                        <input
                          type="number"
                          value={stepLengthCm}
                          onChange={(e) => setStepLengthCm(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Lățime Interior (cm):
                        </label>
                        <input
                          type="number"
                          value={stepWidthCm}
                          onChange={(e) => setStepWidthCm(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Înălțime Utilă (cm):
                        </label>
                        <input
                          type="number"
                          value={stepHeightCm}
                          onChange={(e) => setStepHeightCm(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Sarcină Maximă (kg):
                        </label>
                        <input
                          type="number"
                          value={stepMaxPayloadKg}
                          onChange={(e) => setStepMaxPayloadKg(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Capacitate Paleți:
                        </label>
                        <input
                          type="number"
                          value={stepTotalPallets}
                          onChange={(e) => setStepTotalPallets(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        {/* PROMPT K12: Preț per km configurabil */}
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tarif Bază per KM (MDL):
                        </label>
                        <input
                          type="number"
                          step={0.5}
                          value={stepPricePerKm}
                          onChange={(e) => setStepPricePerKm(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px] text-slate-700">
                      💡 <strong>Tariful per km ({stepPricePerKm} MDL/km)</strong> va fi utilizat la Prompt K12 ca bază automată pentru calculul costului de transport estimat la negocierea contractelor B2B.
                    </div>
                  </div>
                )}

                {/* PASUL 4: Conectare Dispozitiv GPS Telematic */}
                {wizardStep === 4 && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Identificator Unic Dispozitiv GPS (IMEI / Tracker ID): *
                      </label>
                      <input
                        type="text"
                        placeholder="Teltonika FMB920-884192 / TK103"
                        value={stepGpsTrackerId}
                        onChange={(e) => setStepGpsTrackerId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Protocol Telematic Suportat:
                      </label>
                      <select
                        value={stepGpsProtocol}
                        onChange={(e) => setStepGpsProtocol(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none"
                      >
                        <option value="TELTONIKA_FMB920">Teltonika FMB920 / FMB640 (TCP/UDP Binary)</option>
                        <option value="CONCOX_GT06">Concox GT06 / WeTrack (TCP Text)</option>
                        <option value="API_WIALON">Conexiune directă API Wialon / FleetComplete</option>
                      </select>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping shrink-0" />
                      <span>
                        La salvare, vehiculul se va conecta la serverul Axum/Rust prin canalul <code>/ws/vehicle/:id</code> și va apărea instantaneu pe harta Moldovei cu pictograma de locator și paleți!
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Navigare Stepper */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (wizardStep > 1) setWizardStep((prev) => (prev - 1) as any);
                    else setIsWizardOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {wizardStep === 1 ? "Anulează" : "← Pasul Anterior"}
                </button>

                {wizardStep < 4 ? (
                  <button
                    onClick={() => {
                      if (wizardStep === 1 && (!stepPlate || !stepModel)) {
                        alert("Completați numărul de înmatriculare și modelul vehiculului.");
                        return;
                      }
                      setWizardStep((prev) => (prev + 1) as any);
                    }}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Continuă spre Pasul {wizardStep + 1}</span>
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCompleteWizard}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>✓ Finalizează și Conectează la Hartă</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
