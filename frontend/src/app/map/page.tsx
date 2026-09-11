"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/ui/Sidebar";
import { DistrictInfo, AvailableTruck, CalculatedRoute } from "@/components/map/RealMoldovaMap";

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
  },
];

const CHAT_STORAGE_KEY = "optifleet_ai_chat_session";

export default function MapPage() {
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

  // Stare Panou Dreapta: "Gândurile la Inteligență" (AI Reasoning & Copilot)
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(true);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; time: string }>>([]);

  // 1. Restaurare istoric conversație din localStorage (persistent la ieșire/reintrare)
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

  // Verificare conexiune Ollama
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
          // Deschidem automat panoul din dreapta cu gândurile AI
          setIsAiDrawerOpen(true);
        }
      }
    } catch (err) {
      console.error("Eroare calcul traseu:", err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Căutare Raion sau Traseu (Când utilizatorul scrie în bara de căutare de sus)
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

  // Sugestii de căutare filtrate
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
          availableTrucks={INITIAL_TRUCKS}
          onSelectDistrict={(d) => {
            setSelectedDistrict(d);
            setIsAiDrawerOpen(true);
          }}
          onSetRouteStart={(d) => setStartDistrictId(d.id)}
          onSetRouteEnd={(d) => {
            setEndDistrictId(d.id);
            handleCalculateRoute(startDistrictId, d.id);
          }}
          activeRoute={activeRoute}
          startDistrict={startDistObj}
          endDistrict={endDistObj}
        />

        {/* ─── BARA DE CĂUTARE DE SUS CU SEMNUL DE CĂUTARE (Exact cerința: 'sus doar sa fie o bara cu semnul de cautare') ─── */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
          <div className="relative">
            <div className="bg-white border-2 border-slate-900 rounded-lg shadow-md px-3.5 py-2 flex items-center gap-3">
              {/* Semnul de căutare 🔍 */}
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

              {/* Buton Calculare Traseu Rapid Chișinău - Bălți */}
              <button
                onClick={() => handleCalculateRoute("chisinau", "balti")}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold whitespace-nowrap transition-colors"
                title="Calculează automat ruta Chișinău ➔ Bălți"
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

        {/* ─── PANOU DREAPTA: GÂNDURILE LA INTELIGENȚĂ (AI REASONING & SCENARIU ÎN DIRECT) ─── */}
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

            {/* Corpul Gândurilor AI (Scenariul descris de utilizator în timp real) */}
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
                  Mercedes-Benz Actros 1845 · TransMold Express SRL. Localizat pe Calea Basarabiei, Chișinău. Are <strong>12 paleți liberi din 33</strong>.
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
