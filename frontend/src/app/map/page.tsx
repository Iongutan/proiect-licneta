"use client";

import { useState, useEffect, useCallback } from "react";
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

// Flota Disponibilă cu Telemetrie GPS Reală (Fără elemente artificiale AI)
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
    model: "Scania R500 (Trailă Utilaje Mari & Mașini)",
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
    model: "Volvo FH 500 (Frigotehnic Schmitz Cargobull)",
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
    model: "MAN TGX 18.500 (Tren Rutier Tandem 40 Paleți)",
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
    currentRaion: "ungheni",
    destinationScope: "INTERNATIONAL",
    availableNow: true,
    speedKmH: 82,
    fuelLevelPercent: 55,
    lat: 47.21,
    lon: 27.81,
  },
  {
    id: "trk-05",
    plate: "CHL 501",
    model: "DAF CF 450 (Camion Rigid 18t cu Lift)",
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
    model: "Mercedes-Benz Sprinter 316 (Dubă Cargo Express)",
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

  // Stare Rutare Simplă & Reale (OSRM)
  const [startDistrictId, setStartDistrictId] = useState<string>("chisinau");
  const [endDistrictId, setEndDistrictId] = useState<string>("balti");
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<CalculatedRoute | null>(null);

  // Stare Panou Asistent AI Qwen3
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; time: string }>>([]);

  // 1. Restaurare istoric conversație din localStorage (nu se pierde la ieșire/reintrare)
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

    // Mesaj inițial implicit dacă nu există istoric anterior
    setChatMessages([
      {
        role: "assistant",
        content:
          "Bună ziua! Sunt Asistentul Tehnic Logistic OptiFleet. Vă pot asista cu informații despre camioanele disponibile pe raioane, trasee optime pe drumurile naționale și disponibilitatea spațiului de marfă.",
        time: "Acum",
      },
    ]);
  }, []);

  // 2. Salvare mesaje conversație în localStorage la fiecare modificare
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

  // Redimensionare Leaflet la colapsarea meniului lateral
  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 320);
  };

  // Calculare Traseu Rutier Real (OSRM)
  const handleCalculateRoute = async () => {
    const startDist = ALL_DISTRICTS.find((d) => d.id === startDistrictId);
    const endDist = ALL_DISTRICTS.find((d) => d.id === endDistrictId);

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
        }
      }
    } catch (err) {
      console.error("Eroare calcul traseu:", err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Inversare Origine și Destinație
  const handleSwapRoute = () => {
    const temp = startDistrictId;
    setStartDistrictId(endDistrictId);
    setEndDistrictId(temp);
  };

  // Curățare traseu de pe hartă
  const handleClearRoute = () => {
    setActiveRoute(null);
  };

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

      if (data?.connected === false) {
        setAiConnected(false);
      } else {
        setAiConnected(true);
      }

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

  // Resetare sesiune chat
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
    <div className="h-screen w-screen flex overflow-hidden bg-slate-100">
      {/* ─── Sidebar Principal (Colapsabil) ─────────────────────────────── */}
      <Sidebar
        activePath="/map"
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* ─── Container Principal Hartă Full-Screen ──────────────────────── */}
      <div
        className={`flex-1 h-full relative transition-all duration-300 ${
          isSidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        <RealMoldovaMap
          districts={ALL_DISTRICTS}
          selectedDistrict={selectedDistrict}
          availableTrucks={INITIAL_TRUCKS}
          onSelectDistrict={(d) => setSelectedDistrict(d)}
          onSetRouteStart={(d) => setStartDistrictId(d.id)}
          onSetRouteEnd={(d) => setEndDistrictId(d.id)}
          activeRoute={activeRoute}
          startDistrict={startDistObj}
          endDistrict={endDistObj}
        />

        {/* ─── Bară Traseu Minimalistă & Curată (Stânga-Sus) ───────────────── */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap max-w-[calc(100vw-340px)]">
          <div className="bg-white border border-slate-300 rounded-md shadow-xs px-3 py-1.5 flex items-center gap-2 text-xs">
            {/* Origine (A) */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
              <span className="text-slate-500 font-medium">De la:</span>
              <select
                value={startDistrictId}
                onChange={(e) => setStartDistrictId(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 border-none outline-none cursor-pointer max-w-[130px] truncate"
              >
                {ALL_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Buton Inversare (⇄) */}
            <button
              onClick={handleSwapRoute}
              title="Inversează punctele"
              className="px-1 text-slate-400 hover:text-slate-900 font-bold transition-colors"
            >
              ⇄
            </button>

            {/* Destinație (B) */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0"></span>
              <span className="text-slate-500 font-medium">Spre:</span>
              <select
                value={endDistrictId}
                onChange={(e) => setEndDistrictId(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 border-none outline-none cursor-pointer max-w-[130px] truncate"
              >
                {ALL_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Buton Calcul Traseu */}
            <button
              onClick={handleCalculateRoute}
              disabled={isCalculatingRoute || startDistrictId === endDistrictId}
              className="ml-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium text-xs transition-colors flex items-center gap-1"
            >
              {isCalculatingRoute ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  <span>Calcul...</span>
                </>
              ) : (
                <span>Trasează</span>
              )}
            </button>
          </div>

          {/* Info Traseu Activ Desenat pe Hartă */}
          {activeRoute && (
            <div className="bg-white border border-blue-300 rounded-md shadow-xs px-3 py-1.5 flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-800 font-medium">
                <span className="font-bold text-blue-700">{activeRoute.distanceKm} km</span>
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-slate-700">{activeRoute.durationFormatted}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 hidden sm:inline">{activeRoute.summaryRoad}</span>
              </div>
              <button
                onClick={handleClearRoute}
                title="Șterge linia de traseu de pe hartă"
                className="text-slate-400 hover:text-red-600 font-bold px-1 transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* ─── Buton Dreapta-Sus: Deschidere Asistent AI Qwen3 ──────────── */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Status Conexiune Ollama */}
          <div
            onClick={checkAiConnection}
            title="Clic pentru a verifica conexiunea cu serverul Ollama"
            className="bg-white border border-slate-300 shadow-xs px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                aiConnected === true ? "bg-emerald-500" : aiConnected === false ? "bg-amber-500" : "bg-slate-400"
              }`}
            />
            <span className="hidden sm:inline">
              {aiConnected === true ? "Qwen3 Activ" : "Ollama Offline"}
            </span>
          </div>

          <button
            onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
            className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>Asistent Qwen3</span>
          </button>
        </div>

        {/* ─── Panou Culisant AI în Dreapta (Slide Drawer) ───────────────── */}
        {isAiDrawerOpen && (
          <div className="absolute top-0 right-0 h-full w-96 max-w-full bg-white shadow-xl border-l border-slate-200 z-30 flex flex-col transition-all">
            {/* Header Drawer */}
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                  <span>Asistent Logistic Qwen3</span>
                  <span className="text-[10px] text-slate-500 font-normal">· Sesiune Păstrată</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Raion selectat: <span className="font-semibold text-slate-700">{selectedDistrict.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetChat}
                  title="Resetează istoricul conversației"
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded transition-colors"
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

            {/* Alertă LIPSĂ CONEXIUNE dacă Ollama nu rulează */}
            {aiConnected === false && (
              <div className="m-3 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1 text-amber-800">
                  <span>⚠️ LIPSĂ DE CONEXIUNE LA OLLAMA LOCAL</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700 leading-normal">
                  Pentru a rula asistentul AI privat pe mașina dvs., deschideți un terminal și comandați:
                </p>
                <div className="mt-1.5 bg-white p-1.5 rounded font-mono text-[11px] font-bold text-slate-900 border border-amber-300 select-all">
                  ollama run qwen3:14b
                </div>
                <button
                  onClick={checkAiConnection}
                  className="mt-2 w-full py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] transition-colors"
                >
                  Verifică din nou conexiunea
                </button>
              </div>
            )}

            {/* Listă Mesaje Conversație */}
            <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-lg p-2.5 text-xs leading-relaxed ${
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
                  <span>Qwen3 procesează...</span>
                </div>
              )}
            </div>

            {/* Sugestii Rapide */}
            <div className="p-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-1">
              {[
                `Camioane în ${selectedDistrict.name}`,
                "Tarif mediu per km",
                "Economie prin grupaj",
              ].map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendAiMessage(sug)}
                  className="text-[11px] px-2 py-0.5 rounded bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Formular Input */}
            <div className="p-2.5 border-t border-slate-200 bg-white">
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
                  placeholder="Scrieți o întrebare..."
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiInput.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
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
