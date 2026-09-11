"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/ui/Sidebar";
import { DistrictInfo, AvailableTruck, CalculatedRoute } from "@/components/map/RealMoldovaMap";
import VehicleBlueprintSVG, { PlacedPallet, PalletFormatType } from "@/components/logistics/VehicleBlueprintSVG";

// Import dinamic pentru Leaflet pe client
const RealMoldovaMap = dynamic(() => import("@/components/map/RealMoldovaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-600 gap-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs font-semibold text-slate-700">Se încarcă Harta Rutieră a Moldovei...</span>
    </div>
  ),
});

// Toate Raioanele și Municipalele din Republica Moldova
const ALL_DISTRICTS: DistrictInfo[] = [
  { id: "chisinau", name: "Mun. Chișinău", type: "MUNICIPIU", lat: 47.0105, lon: 28.8638, trucksCount: 18, activeOrdersCount: 42 },
  { id: "balti", name: "Mun. Bălți", type: "MUNICIPIU", lat: 47.763, lon: 27.929, trucksCount: 11, activeOrdersCount: 26 },
  { id: "orhei", name: "Raionul Orhei", type: "RAION", lat: 47.3831, lon: 28.8239, trucksCount: 7, activeOrdersCount: 14 },
  { id: "ungheni", name: "Raionul Ungheni (Vama Sculeni)", type: "RAION", lat: 47.2042, lon: 27.7981, trucksCount: 8, activeOrdersCount: 17 },
  { id: "cahul", name: "Raionul Cahul (Vama Oancea)", type: "RAION", lat: 45.9075, lon: 28.1944, trucksCount: 6, activeOrdersCount: 12 },
  { id: "hincesti", name: "Raionul Hîncești (Vama Leușeni)", type: "RAION", lat: 46.8283, lon: 28.5919, trucksCount: 9, activeOrdersCount: 19 },
  { id: "soroca", name: "Raionul Soroca", type: "RAION", lat: 48.1566, lon: 28.2975, trucksCount: 5, activeOrdersCount: 9 },
  { id: "edinet", name: "Raionul Edineț", type: "RAION", lat: 48.1681, lon: 27.305, trucksCount: 5, activeOrdersCount: 8 },
  { id: "causeni", name: "Raionul Căușeni", type: "RAION", lat: 46.6436, lon: 29.4136, trucksCount: 4, activeOrdersCount: 7 },
  { id: "straseni", name: "Raionul Strășeni", type: "RAION", lat: 47.1422, lon: 28.6089, trucksCount: 5, activeOrdersCount: 11 },
  { id: "comrat", name: "UTA Găgăuzia (Comrat)", type: "AUTONOMIE", lat: 46.3006, lon: 28.6567, trucksCount: 6, activeOrdersCount: 13 },
  { id: "falesti", name: "Raionul Fălești", type: "RAION", lat: 47.5744, lon: 27.7125, trucksCount: 3, activeOrdersCount: 5 },
  { id: "drochia", name: "Raionul Drochia", type: "RAION", lat: 48.0347, lon: 27.8158, trucksCount: 4, activeOrdersCount: 6 },
  { id: "ialoveni", name: "Raionul Ialoveni", type: "RAION", lat: 46.9431, lon: 28.7778, trucksCount: 7, activeOrdersCount: 15 },
  { id: "cimislia", name: "Raionul Cimișlia", type: "RAION", lat: 46.5208, lon: 28.7842, trucksCount: 4, activeOrdersCount: 7 },
  { id: "rezina", name: "Raionul Rezina", type: "RAION", lat: 47.7497, lon: 28.9622, trucksCount: 3, activeOrdersCount: 4 },
  { id: "anenii_noi", name: "Raionul Anenii Noi", type: "RAION", lat: 46.8817, lon: 29.2294, trucksCount: 5, activeOrdersCount: 9 },
  { id: "briceni", name: "Raionul Briceni (Vama Criva)", type: "RAION", lat: 48.3619, lon: 27.0853, trucksCount: 4, activeOrdersCount: 6 },
  { id: "taraclia", name: "Raionul Taraclia", type: "RAION", lat: 45.9006, lon: 28.6689, trucksCount: 3, activeOrdersCount: 4 },
  { id: "stefan_voda", name: "Raionul Ștefan Vodă", type: "RAION", lat: 46.5125, lon: 29.6631, trucksCount: 3, activeOrdersCount: 5 },
];

// Flota Disponibilă cu Telemetrie GPS Reală
const INITIAL_TRUCKS: AvailableTruck[] = [
  {
    id: "trk-01",
    plate: "CAN 001",
    model: "Mercedes-Benz Actros 1845 (Prelată 13.6m)",
    vehicleType: "SEMI_CURTAINSIDE_33",
    carrierName: "TransMold Express SRL",
    carrierPhone: "+373 69 112 334",
    driverName: "Ion Popescu",
    pricePerKm: 18.5,
    hasConditioner: false,
    totalPallets: 33,
    freePallets: 12,
    isVerifiedANTA: true,
    gpsTrackerId: "Teltonika FMB920",
    currentRaion: "chisinau",
    destinationScope: "INTERNATIONAL",
    availableNow: true,
    speedKmH: 76,
    fuelLevelPercent: 78,
    lat: 47.025,
    lon: 28.85,
    layoutOrientation: "2_WIDE",
  },
  {
    id: "trk-02",
    plate: "TRL 901",
    model: "Scania R500 (Autospecială / Trailă Utilaje)",
    vehicleType: "MACHINERY_LOWBED",
    carrierName: "AgroTrans Heavy Haulage SRL",
    carrierPhone: "+373 68 990 112",
    driverName: "Dumitru Vangheli",
    pricePerKm: 32.0,
    hasConditioner: false,
    totalPallets: 0,
    freePallets: 0,
    isVerifiedANTA: true,
    gpsTrackerId: "Teltonika FMB640",
    currentRaion: "balti",
    destinationScope: "INTERN",
    availableNow: true,
    speedKmH: 64,
    fuelLevelPercent: 65,
    lat: 47.77,
    lon: 27.91,
  },
  {
    id: "trk-03",
    plate: "FRG 404",
    model: "Volvo FH 500 (Frigotehnic Schmitz)",
    vehicleType: "SEMI_REEFER_33",
    carrierName: "ColdChain Moldova SRL",
    carrierPhone: "+373 79 332 110",
    driverName: "Sergiu Moraru",
    pricePerKm: 21.5,
    hasConditioner: true,
    totalPallets: 33,
    freePallets: 7,
    isVerifiedANTA: true,
    gpsTrackerId: "Teltonika FMB920 + Temp",
    currentRaion: "orhei",
    destinationScope: "INTERNATIONAL",
    availableNow: true,
    speedKmH: 0,
    fuelLevelPercent: 88,
    temperatureCelsius: 3.8,
    lat: 47.39,
    lon: 28.81,
    layoutOrientation: "2_WIDE",
  },
  {
    id: "trk-04",
    plate: "BST 102",
    model: "MAN TGX 18.500 (Tren Rutier Tandem)",
    vehicleType: "ROAD_TRAIN_40",
    carrierName: "LogiSpeed Moldova SA",
    carrierPhone: "+373 78 445 667",
    driverName: "Gheorghe Rusu",
    pricePerKm: 22.0,
    hasConditioner: false,
    totalPallets: 40,
    freePallets: 18,
    isVerifiedANTA: true,
    gpsTrackerId: "Teltonika FMB920",
    currentRaion: "anenii_noi",
    destinationScope: "INTERNATIONAL",
    availableNow: true,
    speedKmH: 82,
    fuelLevelPercent: 55,
    lat: 46.90,
    lon: 29.15,
    layoutOrientation: "2_WIDE",
  },
  {
    id: "trk-05",
    plate: "CHL 501",
    model: "DAF CF 450 (Rigid 18t cu Lift)",
    vehicleType: "RIGID_BOX_18",
    carrierName: "SudTrans Agro SRL",
    carrierPhone: "+373 79 223 344",
    driverName: "Nicolae Ceban",
    pricePerKm: 15.0,
    hasConditioner: false,
    totalPallets: 18,
    freePallets: 8,
    isVerifiedANTA: true,
    gpsTrackerId: "Teltonika FMB920",
    currentRaion: "cahul",
    destinationScope: "INTERN",
    availableNow: true,
    speedKmH: 0,
    fuelLevelPercent: 70,
    lat: 45.91,
    lon: 28.19,
    layoutOrientation: "2_WIDE",
  },
  {
    id: "trk-06",
    plate: "ORH 301",
    model: "Mercedes-Benz Sprinter 316 (Dubă Express)",
    vehicleType: "VAN_CARGO_4",
    carrierName: "OrheiTrans Rapid SRL",
    carrierPhone: "+373 60 778 990",
    driverName: "Mihai Cojocaru",
    pricePerKm: 11.0,
    hasConditioner: false,
    totalPallets: 4,
    freePallets: 2,
    isVerifiedANTA: true,
    gpsTrackerId: "GPS-MV-5520",
    currentRaion: "chisinau",
    destinationScope: "INTERN",
    availableNow: true,
    speedKmH: 45,
    fuelLevelPercent: 82,
    lat: 47.01,
    lon: 28.87,
    layoutOrientation: "2_WIDE",
  },
];

const CHAT_STORAGE_KEY = "optifleet_ai_chat_session";
const TRUCKS_STORAGE_KEY = "optifleet_custom_trucks";

export default function MapPage() {
  const [trucksList, setTrucksList] = useState<AvailableTruck[]>(INITIAL_TRUCKS);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictInfo>(ALL_DISTRICTS[0]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Stare Bară de Căutare (Sus)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  // Stare Rutare (A spre B)
  const [startDistrictId, setStartDistrictId] = useState<string>("chisinau");
  const [endDistrictId, setEndDistrictId] = useState<string>("balti");
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<CalculatedRoute | null>(null);

  // Stare Modal Configurator Interior Paleți (Clic pe camion sau pe interiorul mașinii)
  const [configTruck, setConfigTruck] = useState<AvailableTruck | null>(null);
  const [activePalletTool, setActivePalletTool] = useState<PalletFormatType>("EURO_2");
  const [editingPallets, setEditingPallets] = useState<PlacedPallet[]>([]);
  const [editingOrientation, setEditingOrientation] = useState<"2_WIDE" | "3_LONG">("2_WIDE");

  // Stare Panou Dreapta: "Gândurile la Inteligență" (AI Reasoning & Copilot)
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(true);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; time: string }>>([]);

  // Restaurare camioane customizate din localStorage la inițializare
  useEffect(() => {
    try {
      const savedTrucks = localStorage.getItem(TRUCKS_STORAGE_KEY);
      if (savedTrucks) {
        const parsed = JSON.parse(savedTrucks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTrucksList(parsed);
        }
      }
    } catch (e) {
      console.error("Eroare la citire camioane salvate:", e);
    }
  }, []);

  // Restaurare istoric conversație din localStorage (persistent la ieșire/reintrare)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
          return;
        }
      }
    } catch (e) {
      console.error("Eroare la citire istoric chat:", e);
    }

    setChatMessages([
      {
        role: "assistant",
        content:
          "Bună ziua! Sunt Asistentul Tehnic Logistic OptiFleet. Monitorizez în timp real barierele teritoriale, pozițiile GPS ale camioanelor și disponibilitatea spațiului de marfă pentru grupaj pe coridoarele din Moldova.",
        time: "Acum",
      },
    ]);
  }, []);

  const updateMessagesAndPersist = useCallback(
    (updater: (prev: Array<{ role: "user" | "assistant"; content: string; time: string }>) => Array<{ role: "user" | "assistant"; content: string; time: string }>) => {
      setChatMessages((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.error("Eroare la salvare istoric chat:", e);
        }
        return next;
      });
    },
    []
  );

  const checkAiConnection = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      setAiConnected(data.connected === true);
    } catch {
      setAiConnected(false);
    }
  };

  useEffect(() => {
    checkAiConnection();
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 320);
  };

  // Deschidere Configurator Interior Paleți pentru un camion
  const handleOpenTruckConfig = (truck: AvailableTruck) => {
    setConfigTruck(truck);
    setEditingOrientation(truck.layoutOrientation || "2_WIDE");

    if (truck.customPallets && truck.customPallets.length > 0) {
      setEditingPallets([...truck.customPallets]);
    } else {
      // Inițializare implicită bazată pe paleții ocupați
      const occupied = Math.max(0, truck.totalPallets - truck.freePallets);
      const rows = truck.layoutOrientation === "3_LONG" ? 3 : 2;
      const initialP: PlacedPallet[] = [];
      let count = 0;

      for (let c = 0; c < 10; c++) {
        for (let r = 0; r < rows; r++) {
          if (count < occupied) {
            initialP.push({
              id: `p-${c}-${r}`,
              col: c,
              row: r,
              format: rows === 3 ? "EURO_3" : "EURO_2",
            });
            count++;
          }
        }
      }
      setEditingPallets(initialP);
    }
  };

  // Clic direct pe o celulă din interiorul caroseriei pentru adăugare / ștergere palet
  const handleTogglePalletSlot = (col: number, row: number) => {
    setEditingPallets((prev) => {
      const existingIndex = prev.findIndex((p) => p.col === col && (p.row === row || p.format === "OVERSIZED_DOUBLE"));

      if (existingIndex >= 0) {
        // Dacă e deja ocupat, îl eliminăm (scoatere palet)
        return prev.filter((_, idx) => idx !== existingIndex);
      } else {
        // Adăugăm un nou palet de formatul selectat
        const newPallet: PlacedPallet = {
          id: `p-${col}-${row}-${Date.now()}`,
          col,
          row: activePalletTool === "OVERSIZED_DOUBLE" ? 0 : row,
          format: activePalletTool,
        };
        return [...prev, newPallet];
      }
    });
  };

  // Salvarea încărcăturii configurate pe camion (se reflectă imediat pe hartă)
  const handleSaveTruckConfiguration = () => {
    if (!configTruck) return;

    const rowsCount = editingOrientation === "3_LONG" ? 3 : 2;
    const totalSlots = configTruck.totalPallets > 0 ? configTruck.totalPallets : 33;
    const occupiedCount = editingPallets.reduce((acc, p) => {
      if (p.format === "OVERSIZED_DOUBLE") return acc + rowsCount * 2;
      return acc + 1;
    }, 0);

    const updatedTruck: AvailableTruck = {
      ...configTruck,
      customPallets: [...editingPallets],
      layoutOrientation: editingOrientation,
      freePallets: Math.max(0, totalSlots - occupiedCount),
    };

    setTrucksList((prev) => {
      const next = prev.map((t) => (t.id === updatedTruck.id ? updatedTruck : t));
      try {
        localStorage.setItem(TRUCKS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setConfigTruck(null);
  };

  // Calculare Traseu Rutier Real (OSRM)
  const handleCalculateRoute = async (customStartId?: string, customEndId?: string) => {
    const sId = customStartId || startDistrictId;
    const eId = customEndId || endDistrictId;

    const startDist = ALL_DISTRICTS.find((d) => d.id === sId);
    const endDist = ALL_DISTRICTS.find((d) => d.id === eId);

    if (!startDist || !endDist || startDist.id === endDist.id) return;

    setIsCalculatingRoute(true);

    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { lat: startDist.lat, lng: startDist.lon, name: startDist.name },
          end: { lat: endDist.lat, lng: endDist.lon, name: endDist.name },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          setActiveRoute(data.routes[0]);
          setIsAiDrawerOpen(true);
        }
      }
    } catch (err) {
      console.error("Eroare calcul traseu:", err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Căutare Raion sau Traseu
  const handleSelectSearchResult = (type: "DISTRICT" | "ROUTE", item: any) => {
    setIsSearchFocused(false);
    setSearchQuery("");

    if (type === "DISTRICT") {
      setSelectedDistrict(item);
      setIsAiDrawerOpen(true);
    } else if (type === "ROUTE") {
      setStartDistrictId(item.startId);
      setEndDistrictId(item.endId);
      const startObj = ALL_DISTRICTS.find((d) => d.id === item.startId);
      if (startObj) setSelectedDistrict(startObj);
      handleCalculateRoute(item.startId, item.endId);
    }
  };

  // Sugestii de căutare
  const filteredSuggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return [
        { type: "ROUTE", title: "Chișinău ➔ Bălți (Coridor M5/R14)", startId: "chisinau", endId: "balti" },
        { type: "ROUTE", title: "Chișinău ➔ Ungheni (Vama Sculeni)", startId: "chisinau", endId: "ungheni" },
        { type: "DISTRICT", title: "Mun. Chișinău (18 camioane)", district: ALL_DISTRICTS[0] },
        { type: "DISTRICT", title: "Mun. Bălți (11 camioane)", district: ALL_DISTRICTS[1] },
        { type: "DISTRICT", title: "Raionul Orhei (7 camioane)", district: ALL_DISTRICTS[2] },
      ];
    }

    const matches: any[] = [];
    ALL_DISTRICTS.forEach((d) => {
      if (d.name.toLowerCase().includes(q)) {
        matches.push({ type: "DISTRICT", title: `${d.name} (${d.trucksCount} camioane)`, district: d });
      }
    });

    if (q.includes("chisinau") || q.includes("balti") || q.includes("spre")) {
      matches.unshift({ type: "ROUTE", title: "Traseu: Chișinău ➔ Bălți", startId: "chisinau", endId: "balti" });
    }

    return matches;
  }, [searchQuery]);

  // Trimitere mesaj către Asistent AI
  const handleSendAiMessage = async (textToSend?: string) => {
    const message = textToSend || aiInput;
    if (!message.trim() || aiLoading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    updateMessagesAndPersist((prev) => [...prev, { role: "user", content: message, time: timeStr }]);
    if (!textToSend) setAiInput("");
    setAiLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          cityContext: {
            name: selectedDistrict.name,
            pendingOrders: selectedDistrict.activeOrdersCount,
            freePallets: 12,
            truckPlate: "CAN 001",
            carrier: "TransMold Express SRL",
            model: "Mercedes-Benz Actros 1845",
          },
        }),
      });

      const data = await res.json();
      const reply = data?.content || "Nu am primit un răspuns.";
      setAiConnected(data?.connected !== false);

      updateMessagesAndPersist((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      setAiConnected(false);
      updateMessagesAndPersist((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "⚠️ LIPSĂ DE CONEXIUNE LA QWEN3 LOCAL (Ollama:11434)\n\nServiciul local Ollama nu răspunde. Rulați în terminal: ollama run qwen3:14b",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleResetChat = () => {
    const initial = [
      {
        role: "assistant" as const,
        content: "Conversația a fost resetată. Cu ce vă pot ajuta pe coridoarele de transport din Moldova?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
    setChatMessages(initial);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(initial));
    } catch (e) {}
  };

  const startDistObj = ALL_DISTRICTS.find((d) => d.id === startDistrictId) || null;
  const endDistObj = ALL_DISTRICTS.find((d) => d.id === endDistrictId) || null;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-100 font-sans">
      {/* ─── Sidebar Principal (Colapsabil) ─────────────────────────────── */}
      <Sidebar
        activePath="/map"
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* ─── Container Principal Hartă ──────────────────────────────────── */}
      <div
        className={`flex-1 h-full relative transition-all duration-300 ${
          isSidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        <RealMoldovaMap
          districts={ALL_DISTRICTS}
          selectedDistrict={selectedDistrict}
          availableTrucks={trucksList}
          onSelectDistrict={(d) => {
            setSelectedDistrict(d);
            setIsAiDrawerOpen(true);
          }}
          onSelectTruck={(t) => handleOpenTruckConfig(t)}
          onSetRouteStart={(d) => setStartDistrictId(d.id)}
          onSetRouteEnd={(d) => {
            setEndDistrictId(d.id);
            handleCalculateRoute(startDistrictId, d.id);
          }}
          activeRoute={activeRoute}
          startDistrict={startDistObj}
          endDistrict={endDistObj}
        />

        {/* ─── BARA DE CĂUTARE DE SUS CU SEMNUL DE CĂUTARE (🔍) ─────────── */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
          <div className="relative">
            <div className="bg-white border-2 border-slate-900 rounded-lg shadow-md px-3.5 py-2 flex items-center gap-3">
              <span className="text-base text-slate-800 shrink-0">🔍</span>

              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută raion sau traseu (ex: Chișinău, sau Chișinău spre Bălți)..."
                className="w-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
              />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-800 text-xs font-bold px-1"
                >
                  ✕
                </button>
              )}

              <button
                onClick={() => handleCalculateRoute("chisinau", "balti")}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold whitespace-nowrap transition-colors"
              >
                Traseu Chișinău - Bălți
              </button>
            </div>

            {/* Meniu derulant Autocompletare / Sugestii */}
            {isSearchFocused && (
              <div
                onMouseDown={(e) => e.preventDefault()}
                className="absolute top-full left-0 right-0 mt-1.5 bg-white border-2 border-slate-900 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto z-30"
              >
                <div className="p-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                  Selectați o destinație sau un traseu:
                </div>
                {filteredSuggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSearchResult(sug.type as any, sug.district || sug)}
                    className="px-3 py-2 text-xs font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-b-0 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span>{sug.type === "ROUTE" ? "🛣️" : "📍"}</span>
                      <span className="font-semibold">{sug.title}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">
                      {sug.type === "ROUTE" ? "Traseu OSRM" : "Raion / Barieră"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Indicator traseu activ dacă e calculat */}
          {activeRoute && (
            <div className="mt-2 bg-white/95 backdrop-blur-md border border-blue-600 rounded-md shadow-sm px-3 py-1 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <span>🛣️ {activeRoute.distanceKm} km</span>
                <span className="text-slate-300">|</span>
                <span>⏱️ {activeRoute.durationFormatted}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 font-normal">{activeRoute.summaryRoad}</span>
              </div>
              <button
                onClick={() => setActiveRoute(null)}
                className="text-slate-400 hover:text-red-600 font-bold text-xs"
              >
                ✕ Șterge
              </button>
            </div>
          )}
        </div>

        {/* ─── Buton Dreapta-Sus: Deschidere / Închidere Gândurile AI ──────── */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
            className="px-3 py-2 rounded-md bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 font-bold text-xs shadow-md transition-colors flex items-center gap-2"
          >
            <span>🧠 Gândurile AI</span>
            <span
              className={`w-2 h-2 rounded-full ${
                aiConnected === true ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </button>
        </div>

        {/* ─── MODAL / DRAWER CONFIGURATOR INTERIOR PALEȚI (Exact cerința utilizatorului) ─── */}
        {configTruck && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl border-2 border-slate-900 shadow-2xl w-full max-w-4xl p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
              {/* Header Configurator */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                      {configTruck.plate}
                    </span>
                    <h2 className="font-extrabold text-sm text-slate-900">
                      Configurator Încărcătură · {configTruck.model}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Faceți clic pe interiorul caroseriei pentru a așeza sau scoate paleți în timp real. Modificările se vor reflecta direct pe hartă!
                  </p>
                </div>
                <button
                  onClick={() => setConfigTruck(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Selector Tip Palet & Orientare */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Tip Palet Activ:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { type: "EURO_2" as const, label: "Euro 2 de-a latul (Orizontal)", icon: "🟦" },
                      { type: "EURO_3" as const, label: "Euro 3 de-a lungul (Vertical)", icon: "🟦" },
                      { type: "OVERSIZED_DOUBLE" as const, label: "Palet Mare / Utilaj (2 Coloane)", icon: "🟪" },
                      { type: "ISO_1000" as const, label: "Industrial ISO", icon: "🟧" },
                    ].map((btn) => (
                      <button
                        key={btn.type}
                        onClick={() => {
                          setActivePalletTool(btn.type);
                          if (btn.type === "EURO_3") setEditingOrientation("3_LONG");
                          if (btn.type === "EURO_2") setEditingOrientation("2_WIDE");
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 border transition-all ${
                          activePalletTool === btn.type
                            ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <span>{btn.icon}</span>
                        <span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Umple 2 rânduri
                      const p: PlacedPallet[] = [];
                      for (let c = 0; c < 10; c++) {
                        p.push({ id: `p-${c}-0`, col: c, row: 0, format: "EURO_2" });
                        p.push({ id: `p-${c}-1`, col: c, row: 1, format: "EURO_2" });
                      }
                      setEditingOrientation("2_WIDE");
                      setEditingPallets(p);
                    }}
                    className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Umple 2 de-a latul
                  </button>
                  <button
                    onClick={() => {
                      // Umple 3 rânduri
                      const p: PlacedPallet[] = [];
                      for (let c = 0; c < 10; c++) {
                        p.push({ id: `p-${c}-0`, col: c, row: 0, format: "EURO_3" });
                        p.push({ id: `p-${c}-1`, col: c, row: 1, format: "EURO_3" });
                        p.push({ id: `p-${c}-2`, col: c, row: 2, format: "EURO_3" });
                      }
                      setEditingOrientation("3_LONG");
                      setEditingPallets(p);
                    }}
                    className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Umple 3 de-a lungul
                  </button>
                  <button
                    onClick={() => setEditingPallets([])}
                    className="px-2 py-1 text-[11px] bg-white border border-red-200 text-red-600 rounded font-semibold hover:bg-red-50"
                  >
                    Golește Tot
                  </button>
                </div>
              </div>

              {/* Desenul Tehnic 2D al Camionului cu Paleții Pozitionați în Interior (Privire Profil) */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col items-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Schiță Tehnică Line-Art (Așa cum apare pe hartă):
                </span>
                <VehicleBlueprintSVG
                  type={configTruck.vehicleType}
                  hasConditioner={configTruck.hasConditioner}
                  pallets={editingPallets}
                  layoutOrientation={editingOrientation}
                  className="w-full max-w-2xl h-36"
                />
              </div>

              {/* Planșă Interactivă: Clic pe interiorul caroseriei pentru adăugare/scoatere paleți */}
              <div className="border border-slate-300 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Planșă Interactivă Podea Remorcă (Clic pe celulă):
                  </span>
                  <span className="text-xs font-semibold text-blue-700">
                    {editingPallets.length} paleți plasați
                  </span>
                </div>

                {/* Grilă Podea Camion (10 coloane x 2 sau 3 rânduri) */}
                <div className="grid grid-cols-10 gap-1.5 p-3 bg-slate-100 rounded-md border border-slate-200">
                  {Array.from({ length: 10 }).map((_, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-center font-bold text-slate-400">
                        C{colIdx + 1}
                      </span>
                      {Array.from({ length: editingOrientation === "3_LONG" ? 3 : 2 }).map((_, rowIdx) => {
                        const isFilled = editingPallets.some(
                          (p) => p.col === colIdx && (p.row === rowIdx || p.format === "OVERSIZED_DOUBLE")
                        );
                        const matchedPallet = editingPallets.find((p) => p.col === colIdx);
                        const isOversized = matchedPallet?.format === "OVERSIZED_DOUBLE";

                        return (
                          <div
                            key={rowIdx}
                            onClick={() => handleTogglePalletSlot(colIdx, rowIdx)}
                            className={`h-12 rounded border-2 cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold select-none ${
                              isFilled
                                ? isOversized
                                  ? "bg-purple-600 border-purple-800 text-white"
                                  : "bg-blue-600 border-blue-800 text-white shadow-xs"
                                : "bg-white border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-300"
                            }`}
                            title={isFilled ? "Clic pentru a scoate paletul" : "Clic pentru a adăuga palet"}
                          >
                            {isFilled ? (isOversized ? "UTILAJ" : "PALET") : "+"}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Buton Salvare & Aplicare pe Hartă */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setConfigTruck(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSaveTruckConfiguration}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <span>✓</span>
                  <span>Salvează și Aplică pe Hartă</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PANOU DREAPTA: GÂNDURILE LA INTELIGENȚĂ (AI LIVE REASONING) ─── */}
        {isAiDrawerOpen && (
          <div className="absolute top-0 right-0 h-full w-[410px] max-w-full bg-white border-l-2 border-slate-900 shadow-2xl z-30 flex flex-col transition-all">
            {/* Header Gânduri AI */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                  <span>🧠 Gândurile Asistentului AI (Qwen3 Live)</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Raționament logistic & optimizare grupaj în timp real
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetChat}
                  title="Resetează istoricul conversației"
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded font-semibold transition-colors"
                >
                  Resetează
                </button>
                <button
                  onClick={() => setIsAiDrawerOpen(false)}
                  className="w-7 h-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Corpul Gândurilor AI */}
            <div className="flex-1 p-3.5 overflow-y-auto flex flex-col gap-3">
              {/* Card 1: Bariera teritorială activă */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <span>📍</span>
                  <span>Barieră Teritorială Activă: {selectedDistrict.name}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Perimetrul teritorial delimitat conform cadastrului administrativ național. Au fost identificate{" "}
                  <strong>{selectedDistrict.trucksCount} vehicule</strong> cu transpondere GPS înregistrate în acest raion.
                </p>
              </div>

              {/* Card 2: Scenariul de tranzit GPS dinamic (Anenii Noi spre Chișinău) */}
              <div className="p-3 rounded-lg border-2 border-blue-600 bg-blue-50/60 text-xs">
                <div className="font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                  <span>🛰️</span>
                  <span>Oportunitate GPS Detectată (Tranzit Anenii Noi):</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Camionul <strong>BST 102</strong> (LogiSpeed SA, Tren Rutier 40 paleți) se deplasează pe drumul național R2 dinspre{" "}
                  <strong>Anenii Noi</strong> spre Chișinău cu viteza de <strong>82 km/h</strong>.
                </p>
                <div className="mt-2 bg-white p-2 rounded border border-blue-200 flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Sosire estimată Chișinău:</span>
                    <span className="font-bold text-slate-900">~14:20 (după GPS)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Spațiu liber pentru marfă:</span>
                    <span className="font-bold text-emerald-700">18 paleți liberi</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Economie estimată prin grupaj:</span>
                    <span className="font-bold text-blue-700">-45% la tarif per palet</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Camion în focar Chișinău */}
              <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <span>🚚</span>
                    <span>Camion gata de încărcare: CAN 001</span>
                  </span>
                  <span className="font-bold text-emerald-700 text-[11px]">GPS: ✓ Activ</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Mercedes-Benz Actros 1845 · TransMold Express SRL. Are <strong>12 paleți liberi din 33</strong>. Faceți clic pe camionul de pe hartă pentru a modifica așezarea paleților.
                </div>
              </div>

              {/* Istoric Conversație Chat AI Persistent */}
              <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Dialog Direct cu Qwen3 (Sesiune Păstrată):
                </span>

                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg p-2.5 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-800 border border-slate-200"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                  </div>
                ))}

                {aiLoading && (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Qwen3 calculează logica...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Input Formular Chat */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAiMessage();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Întrebați Qwen3 (ex: tarif, grupaj Anenii Noi)..."
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiInput.trim()}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors"
                >
                  Trimite
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
