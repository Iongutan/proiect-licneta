"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/ui/Sidebar";
import { DistrictInfo, AvailableTruck, CalculatedRoute } from "@/components/map/RealMoldovaMap";
import VehicleBlueprintSVG from "@/components/logistics/VehicleBlueprintSVG";

// Import dinamic pentru Leaflet pe client
const RealMoldovaMap = dynamic(() => import("@/components/map/RealMoldovaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-600 gap-3">
      <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm font-semibold">Se inițializează Harta Rutieră & GPS Live...</span>
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

// Flota Disponibilă cu Schițe CAD și Telemetrie GPS Reală
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
    gpsTrackerId: "Teltonika FMB920 (TK-8812)",
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
    gpsTrackerId: "Teltonika FMB640 (TK-9950)",
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
    model: "Volvo FH 500 (Schmitz Cargobull Frigo)",
    vehicleType: "SEMI_REEFER_33",
    carrierName: "ColdChain Moldova SRL",
    carrierPhone: "+373 79 332 110",
    driverName: "Sergiu Moraru",
    pricePerKm: 21.5,
    hasConditioner: true,
    totalPallets: 33,
    freePallets: 7,
    isVerifiedANTA: true,
    gpsTrackerId: "Teltonika FMB920 + Temp (TK-4411)",
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
    gpsTrackerId: "Teltonika FMB920 (TK-9041)",
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
    gpsTrackerId: "Teltonika FMB920 (TK-3301)",
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

export default function MapPage() {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictInfo>(ALL_DISTRICTS[0]);
  const [selectedTruck, setSelectedTruck] = useState<AvailableTruck | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "INTERN" | "INTERNATIONAL">("ALL");

  // State Rutare Tip Google Maps
  const [startDistrictId, setStartDistrictId] = useState<string>("chisinau");
  const [endDistrictId, setEndDistrictId] = useState<string>("balti");
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [calculatedRoutes, setCalculatedRoutes] = useState<CalculatedRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("route-1");
  const [isRouteDrawerOpen, setIsRouteDrawerOpen] = useState<boolean>(true);

  // State Sertar AI Copilot
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [aiModelName, setAiModelName] = useState<string>("qwen3:14b");
  const [aiStatusMsg, setAiStatusMsg] = useState<string>("Se verifică serverul Ollama local...");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; time: string }>>([
    {
      role: "assistant",
      content:
        "Bună ziua! Sunt Asistentul Inteligent Logistic OptiFleet B2B. Vă pot calcula în timp real rute, tarife și disponibilitatea paleților pe coridoarele Moldovei.",
      time: "Acum",
    },
  ]);

  // Verificare status conexiune Ollama la montare
  useEffect(() => {
    checkAiConnection();
  }, []);

  const checkAiConnection = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (data.connected && data.qwenLoaded) {
        setAiConnected(true);
        setAiModelName(data.models?.[0] || "qwen3:14b");
        setAiStatusMsg("Conectat la Qwen3 Local (Ollama:11434)");
      } else if (data.connected) {
        setAiConnected(true);
        setAiModelName("Ollama activ (model qwen în descărcare)");
        setAiStatusMsg("Ollama activ");
      } else {
        setAiConnected(false);
        setAiStatusMsg("Ollama Deconectat. Rulați: ollama run qwen3:14b");
      }
    } catch {
      setAiConnected(false);
      setAiStatusMsg("Ollama Offline (port 11434 inaccesibil)");
    }
  };

  // Calculare Rută Reală OSRM (Google Maps Style)
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
          setCalculatedRoutes(data.routes);
          setSelectedRouteId(data.routes[0].id);
        }
      }
    } catch (err) {
      console.error("Eroare calcul rută:", err);
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

  const startDistObj = ALL_DISTRICTS.find((d) => d.id === startDistrictId);
  const endDistObj = ALL_DISTRICTS.find((d) => d.id === endDistrictId);

  // Trimitere mesaj către Asistent AI
  const handleSendAiMessage = async (textToSend?: string) => {
    const message = textToSend || aiInput;
    if (!message.trim() || aiLoading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setChatMessages((prev) => [...prev, { role: "user", content: message, time: timeStr }]);
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
            distKm: Math.round(
              Math.sqrt(Math.pow(selectedDistrict.lat - 47.0105, 2) + Math.pow(selectedDistrict.lon - 28.8638, 2)) * 111
            ),
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

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      setAiConnected(false);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "⚠️ LIPSĂ DE CONEXIUNE: Serverul Ollama nu răspunde pe portul 11434. Vă rugăm să rulați în terminal: ollama run qwen3:14b",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Camioane disponibile în raionul selectat
  const trucksInDistrict = INITIAL_TRUCKS.filter(
    (t) =>
      (t.currentRaion === selectedDistrict.id || selectedDistrict.id === "chisinau") &&
      (scopeFilter === "ALL" || t.destinationScope === scopeFilter)
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900">
      {/* ─── Sidebar Principal (Stânga - Colapsabil) ───────────────────── */}
      <Sidebar activePath="/map" />

      {/* ─── Harta Full-Screen ────────────────────────────────────────── */}
      <div className="flex-1 h-full relative">
        <RealMoldovaMap
          districts={ALL_DISTRICTS}
          selectedDistrict={selectedDistrict}
          availableTrucks={INITIAL_TRUCKS}
          onSelectDistrict={(d) => {
            setSelectedDistrict(d);
            setSelectedTruck(null);
          }}
          onSelectTruck={(t) => setSelectedTruck(t)}
          scopeFilter={scopeFilter}
          activeRoutes={calculatedRoutes}
          selectedRouteId={selectedRouteId}
          onSelectRouteId={(id) => setSelectedRouteId(id)}
          startDistrict={startDistObj}
          endDistrict={endDistObj}
        />

        {/* ─── Calculator Rută Stil Google Maps (Flotant Sus-Stânga) ─────── */}
        <div className="absolute top-4 left-4 z-20 w-96 max-w-[calc(100vw-32px)]">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 p-4 transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Calculator Rute Reale (OSRM)
                </span>
              </div>
              <button
                onClick={() => setIsRouteDrawerOpen(!isRouteDrawerOpen)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-1.5 py-0.5 rounded"
              >
                {isRouteDrawerOpen ? "▲ Ascunde" : "▼ Deschide"}
              </button>
            </div>

            {isRouteDrawerOpen && (
              <div className="mt-3 flex flex-col gap-3">
                {/* Selector Origine & Destinație */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex flex-col gap-2">
                    {/* Origine (A) */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                        A
                      </span>
                      <select
                        value={startDistrictId}
                        onChange={(e) => setStartDistrictId(e.target.value)}
                        className="bg-transparent text-xs font-semibold text-slate-800 w-full focus:outline-none"
                      >
                        {ALL_DISTRICTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Destinație (B) */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                        B
                      </span>
                      <select
                        value={endDistrictId}
                        onChange={(e) => setEndDistrictId(e.target.value)}
                        className="bg-transparent text-xs font-semibold text-slate-800 w-full focus:outline-none"
                      >
                        {ALL_DISTRICTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Buton Inversare (⇄) */}
                  <button
                    onClick={handleSwapRoute}
                    title="Inversează punctele"
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center text-sm font-bold shrink-0 transition-all shadow-2xs"
                  >
                    ⇅
                  </button>
                </div>

                {/* Buton Calculare Traseu */}
                <button
                  onClick={handleCalculateRoute}
                  disabled={isCalculatingRoute || startDistrictId === endDistrictId}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isCalculatingRoute ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Se calculează pe șosele...</span>
                    </>
                  ) : (
                    <span>Calculează Traseul Rutier</span>
                  )}
                </button>

                {/* Rezultate Rute (Google Maps Style) */}
                {calculatedRoutes.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Rute Rutiere Disponibile:
                    </span>

                    {calculatedRoutes.map((route) => {
                      const isSelected = route.id === selectedRouteId;
                      return (
                        <div
                          key={route.id}
                          onClick={() => setSelectedRouteId(route.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50/80 border-blue-600 shadow-xs"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{route.name}</span>
                            <span className="font-bold text-sm text-blue-700">{route.durationFormatted}</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span>{route.summaryRoad}</span>
                            <span className="font-semibold text-slate-700">{route.distanceKm} km</span>
                          </div>

                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-600">
                            <span>Consum: ~{route.fuelLiters}L motorină</span>
                            <span className="font-mono font-bold text-slate-800">
                              Cost Estimat: {route.estimatedCostMdl} MDL
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Buton Dreapta-Sus: Deschidere Asistent AI Qwen3 ──────────── */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Status Badge Qwen3 */}
          <div
            onClick={checkAiConnection}
            title="Clic pentru verificare conexiune"
            className={`px-3 py-2 rounded-xl backdrop-blur-md shadow-md border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              aiConnected === true
                ? "bg-emerald-50/90 text-emerald-800 border-emerald-300"
                : aiConnected === false
                ? "bg-amber-50/90 text-amber-800 border-amber-300"
                : "bg-white/90 text-slate-700 border-slate-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                aiConnected === true
                  ? "bg-emerald-500 animate-pulse"
                  : aiConnected === false
                  ? "bg-amber-500"
                  : "bg-slate-400"
              }`}
            />
            <span>{aiConnected === true ? "Qwen3:14B Conectat" : "Ollama Offline"}</span>
          </div>

          <button
            onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md border border-blue-500 transition-all flex items-center gap-2"
          >
            <span>Asistent AI Qwen3</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">14B</span>
          </button>
        </div>

        {/* ─── Panou Culisant AI în Dreapta (Slide-out Drawer) ───────────── */}
        {isAiDrawerOpen && (
          <div className="absolute top-0 right-0 h-full w-96 max-w-full bg-white/95 backdrop-blur-md shadow-2xl border-l border-slate-200 z-30 flex flex-col transition-all">
            {/* Header Drawer */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">Copilot Logistic Qwen3</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                    LOCAL
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Hub curent: {selectedDistrict.name}
                </div>
              </div>
              <button
                onClick={() => setIsAiDrawerOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Alertă Transparență Stare Conexiune (Exact cum a cerut utilizatorul) */}
            {aiConnected === false && (
              <div className="m-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1 text-amber-800">
                  <span>⚠️ LIPSĂ DE CONEXIUNE LA QWEN3 LOCAL</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                  Serverul Ollama nu rulează pe portul 11434. Pentru a utiliza modelul AI local, porniți-l în terminal:
                </p>
                <div className="mt-1.5 bg-white p-1.5 rounded font-mono text-[11px] font-bold text-slate-900 border border-amber-300">
                  ollama run qwen3:14b
                </div>
                <button
                  onClick={checkAiConnection}
                  className="mt-2 w-full py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-all"
                >
                  ↻ Reîncearcă Conexiunea
                </button>
              </div>
            )}

            {/* Mesaje Conversație */}
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                </div>
              ))}

              {aiLoading && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Qwen3 calculează răspunsul...</span>
                </div>
              )}
            </div>

            {/* Sugestii Rapide */}
            <div className="p-3 border-t border-slate-100 flex flex-wrap gap-1.5">
              {[
                `Preț transport ${selectedDistrict.name}`,
                "Paleți disponibili",
                "Economie grupaj",
              ].map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendAiMessage(sug)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 transition-all"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Input Mesaj */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAiMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Întrebați Qwen3 (ex: tarif, capacitate)..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiInput.trim()}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Trimite
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── Panou Inferior: Flota din Raion cu Schițe CAD & Telemetrie GPS ─ */}
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 p-4 max-w-6xl mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{selectedDistrict.name}</span>
                <span className="text-xs text-slate-500">
                  · {trucksInDistrict.length} camioane active · {selectedDistrict.activeOrdersCount} comenzi în tranzit
                </span>
              </div>

              {/* Filtru Destinație */}
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-slate-400 text-[11px]">Traseu:</span>
                {(["ALL", "INTERN", "INTERNATIONAL"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScopeFilter(s)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                      scopeFilter === s
                        ? "bg-blue-600 text-white font-bold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s === "ALL" ? "Toate" : s === "INTERN" ? "Intern MD" : "Export RO/UE"}
                  </button>
                ))}
              </div>
            </div>

            {/* Listă Orizontală de Camioane cu Schițe CAD din Profil */}
            <div className="mt-3 flex items-stretch gap-4 overflow-x-auto pb-1">
              {trucksInDistrict.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 w-full">
                  Niciun vehicul disponibil în acest raion pentru filtrul selectat.
                </div>
              ) : (
                trucksInDistrict.map((trk) => {
                  const isMoving = trk.speedKmH > 0;
                  return (
                    <div
                      key={trk.id}
                      onClick={() => setSelectedTruck(trk)}
                      className={`min-w-[340px] max-w-[360px] p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        selectedTruck?.id === trk.id
                          ? "border-blue-600 bg-blue-50/50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Desen CAD Tehnic din Profil (exact ca la configurator) */}
                      <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-100 mb-2">
                        <VehicleBlueprintSVG
                          type={trk.vehicleType}
                          hasConditioner={trk.hasConditioner}
                          className="w-full h-20"
                        />
                      </div>

                      {/* Header Camion */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                            {trk.plate}
                          </span>
                          <span className="font-bold text-xs text-blue-700">{trk.pricePerKm} MDL / km</span>
                        </div>

                        <div className="font-semibold text-xs text-slate-900 mt-1">{trk.model}</div>
                        <div className="text-[11px] text-slate-500">{trk.carrierName}</div>

                        {/* Telemetrie GPS Live */}
                        <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col gap-1 text-[11px]">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <span
                                className={`w-2 h-2 rounded-full ${isMoving ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`}
                              />
                              {isMoving ? `În Deplasare (${trk.speedKmH} km/h)` : "La Rampă (0 km/h)"}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {trk.lat.toFixed(3)}°N, {trk.lon.toFixed(3)}°E
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-600 text-[10px]">
                            <span>Senzor: {trk.gpsTrackerId}</span>
                            <span>Combustibil: {trk.fuelLevelPercent}%</span>
                          </div>

                          {trk.hasConditioner && trk.temperatureCelsius !== undefined && (
                            <div className="text-[10px] font-bold text-blue-600 flex items-center justify-between pt-0.5 border-t border-slate-200/60">
                              <span>Senzor Frigo Agregat:</span>
                              <span>+{trk.temperatureCelsius}°C (Stabil)</span>
                            </div>
                          )}
                        </div>

                        {/* Detalii Paleți & Contact */}
                        <div className="mt-2 flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="font-semibold text-emerald-700">
                            {trk.totalPallets > 0 ? `${trk.freePallets} paleți liberi` : "Trailă Utilaje"}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px]">{trk.carrierPhone}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
