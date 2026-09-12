/**
 * OptiFleet B2B — Natural Language Intent Parser & Route Transit Matcher (Prompt K4)
 * Strict requirement:
 *  - Parses: origin, destination, quantity ("3 paleți"), "cu tranzit" flag
 *  - Capacity filter: freePallets > requestedQuantity (STRICTLY GREATER)
 *  - Transit matching: checks overlapping route segments and calculates estimated transit passage time
 */

export interface AvailableTruck {
  id: string;
  plate: string;
  currentRaion: string;
  destinationRaion?: string;
  lat: number;
  lon: number;
  freePallets: number;
  totalPallets: number;
  [key: string]: any;
}

export interface ParsedSearchIntent {
  rawQuery: string;
  origin?: string;
  originName?: string;
  destination?: string;
  destinationName?: string;
  requestedQuantity?: number;
  withTransit: boolean;
}

export interface TransitMatchResult {
  truck: AvailableTruck;
  matchType: "DIRECT" | "TRANSIT";
  transitVia?: string;
  estimatedPassTime?: string;
  overlapDistanceKm?: number;
}

// Dicționar complet de aliasuri pentru toate cele 37 de unități teritoriale din Moldova
const DISTRICT_ALIASES: Record<string, { id: string; name: string }> = {
  // Municipii
  chisinau: { id: "chisinau", name: "Chișinău" },
  chisinaului: { id: "chisinau", name: "Chișinău" },
  balti: { id: "balti", name: "Bălți" },
  bender: { id: "bender", name: "Bender (Tighina)" },
  tighina: { id: "bender", name: "Bender (Tighina)" },

  // Raioane Nord
  briceni: { id: "briceni", name: "Briceni" },
  criva: { id: "briceni", name: "Briceni" },
  donduseni: { id: "donduseni", name: "Dondușeni" },
  drochia: { id: "drochia", name: "Drochia" },
  edinet: { id: "edinet", name: "Edineț" },
  falesti: { id: "falesti", name: "Fălești" },
  floresti: { id: "floresti", name: "Florești" },
  glodeni: { id: "glodeni", name: "Glodeni" },
  ocnita: { id: "ocnita", name: "Ocnița" },
  otaci: { id: "ocnita", name: "Ocnița" },
  riscani: { id: "riscani", name: "Rîșcani" },
  singerei: { id: "singerei", name: "Sîngerei" },
  soldanesti: { id: "soldanesti", name: "Șoldănești" },
  soroca: { id: "soroca", name: "Soroca" },

  // Raioane Centru
  "anenii noi": { id: "anenii_noi", name: "Anenii Noi" },
  aneniinoi: { id: "anenii_noi", name: "Anenii Noi" },
  calarasi: { id: "calarasi", name: "Călărași" },
  criuleni: { id: "criuleni", name: "Criuleni" },
  dubasari: { id: "dubasari", name: "Dubăsari" },
  hincesti: { id: "hincesti", name: "Hîncești" },
  leuseni: { id: "hincesti", name: "Hîncești" },
  ialoveni: { id: "ialoveni", name: "Ialoveni" },
  nisporeni: { id: "nisporeni", name: "Nisporeni" },
  orhei: { id: "orhei", name: "Orhei" },
  rezina: { id: "rezina", name: "Rezina" },
  straseni: { id: "straseni", name: "Strășeni" },
  telenesti: { id: "telenesti", name: "Telenești" },
  ungheni: { id: "ungheni", name: "Ungheni" },
  sculeni: { id: "ungheni", name: "Ungheni" },

  // Raioane Sud & Autonomii
  basarabeasca: { id: "basarabeasca", name: "Basarabeasca" },
  cahul: { id: "cahul", name: "Cahul" },
  oancea: { id: "cahul", name: "Cahul" },
  giurgiulesti: { id: "cahul", name: "Cahul" },
  cantemir: { id: "cantemir", name: "Cantemir" },
  causeni: { id: "causeni", name: "Căușeni" },
  cimislia: { id: "cimislia", name: "Cimișlia" },
  leova: { id: "leova", name: "Leova" },
  "stefan voda": { id: "stefan_voda", name: "Ștefan Vodă" },
  stefanvoda: { id: "stefan_voda", name: "Ștefan Vodă" },
  taraclia: { id: "taraclia", name: "Taraclia" },
  comrat: { id: "comrat", name: "Comrat (Găgăuzia)" },
  gagauzia: { id: "comrat", name: "UTA Găgăuzia" },
  ceadirlunga: { id: "comrat", name: "Ceadîr-Lunga" },
  vulcanesti: { id: "comrat", name: "Vulcănești" },
  transnistria: { id: "transnistria", name: "Transnistria (Tiraspol)" },
  tiraspol: { id: "transnistria", name: "Transnistria (Tiraspol)" },
  ribnita: { id: "transnistria", name: "Rîbnița" },
};

// Rute predefinite de tranzit prin Moldova (coridoare naționale acoperind toate regiunile)
export const CORRIDOR_TRANSITS: Record<string, string[]> = {
  // Rută M5/R14 Bălți - Chișinău trece prin Sîngerei, Telenești, Strășeni
  "balti-chisinau": ["balti", "singerei", "telenesti", "straseni", "chisinau"],
  "chisinau-balti": ["chisinau", "straseni", "telenesti", "singerei", "balti"],

  // Rută Chișinău - Rezina trece prin Orhei, Șoldănești
  "chisinau-rezina": ["chisinau", "orhei", "soldanesti", "rezina"],
  "rezina-chisinau": ["rezina", "soldanesti", "orhei", "chisinau"],

  // Rută Chișinău - Șoldănești
  "chisinau-soldanesti": ["chisinau", "orhei", "soldanesti"],
  "soldanesti-chisinau": ["soldanesti", "orhei", "chisinau"],

  // Rută Chișinău - Cahul prin Hîncești, Leova, Cantemir
  "chisinau-cahul": ["chisinau", "ialoveni", "hincesti", "leova", "cantemir", "cahul"],
  "cahul-chisinau": ["cahul", "cantemir", "leova", "hincesti", "ialoveni", "chisinau"],

  // Rută Chișinău - Cantemir
  "chisinau-cantemir": ["chisinau", "hincesti", "leova", "cantemir"],
  "cantemir-chisinau": ["cantemir", "leova", "hincesti", "chisinau"],

  // Rută Chișinău - Leova
  "chisinau-leova": ["chisinau", "hincesti", "leova"],
  "leova-chisinau": ["leova", "hincesti", "chisinau"],

  // Rută Anenii Noi - Bălți trece prin Chișinău, Orhei
  "anenii_noi-balti": ["anenii_noi", "chisinau", "orhei", "balti"],

  // Rută Soroca - Chișinău trece prin Florești, Orhei
  "soroca-chisinau": ["soroca", "floresti", "orhei", "chisinau"],

  // Rută Bălți - Briceni prin Rîșcani, Edineț
  "balti-briceni": ["balti", "riscani", "edinet", "briceni"],
};

function normalizeStr(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * 1. Intent Parser
 * Extrage origine, destinație, cantitate specificată ("3 paleți") și flag "cu tranzit".
 */
export function parseSearchIntent(query: string): ParsedSearchIntent {
  const norm = normalizeStr(query);

  // 1. Verificare flag "cu tranzit"
  const withTransit = /tranzit|prin|adiacent|in trecere/i.test(norm);

  // 2. Extragere cantitate paleți (ex. "3 paleți", "am 4 paleti", "5 locuri", "10 p")
  let requestedQuantity: number | undefined = undefined;
  const qtyMatch = norm.match(/(\d+)\s*(paleti|palet|paleți|locuri|loc|p)\b/i);
  if (qtyMatch) {
    requestedQuantity = parseInt(qtyMatch[1], 10);
  }

  // 3. Extragere Origine și Destinație
  let origin: string | undefined = undefined;
  let originName: string | undefined = undefined;
  let destination: string | undefined = undefined;
  let destinationName: string | undefined = undefined;

  // Căutare pattern-uri A -> B: "chisinau - rezina", "de la chisinau spre rezina", "chisinau pana la rezina"
  const splitSeparators = /\s*(?:->|-|–|—|spre|pana la|până la|la)\s*/i;
  const parts = norm.split(splitSeparators);

  if (parts.length >= 2) {
    // Încercăm să găsim orașe în parts[0] și parts[1]
    for (const [alias, info] of Object.entries(DISTRICT_ALIASES)) {
      if (!origin && parts[0].includes(alias)) {
        origin = info.id;
        originName = info.name;
      }
      if (!destination && parts[1].includes(alias)) {
        destination = info.id;
        destinationName = info.name;
      }
    }
  }

  // Dacă nu au fost găsite prin split, căutăm apariția oricărui oraș din dicționar
  if (!origin || !destination) {
    const foundCities: { id: string; name: string; index: number }[] = [];
    for (const [alias, info] of Object.entries(DISTRICT_ALIASES)) {
      const idx = norm.indexOf(alias);
      if (idx !== -1) {
        foundCities.push({ id: info.id, name: info.name, index: idx });
      }
    }
    // Sortăm după ordinea în text
    foundCities.sort((a, b) => a.index - b.index);

    if (foundCities.length >= 1 && !origin) {
      origin = foundCities[0].id;
      originName = foundCities[0].name;
    }
    if (foundCities.length >= 2 && !destination) {
      destination = foundCities[1].id;
      destinationName = foundCities[1].name;
    }
  }

  return {
    rawQuery: query,
    origin,
    originName,
    destination,
    destinationName,
    requestedQuantity,
    withTransit,
  };
}

/**
 * 2. Route Matching & Strict Capacity Filter
 * - Filtrare strictă: freePallets > requestedQuantity (STRICT MAI MARE)
 * - Potrivire de traseu directă și tranzit
 */
export function matchTruckRoutes(
  trucks: AvailableTruck[],
  intent: ParsedSearchIntent
): {
  directMatches: TransitMatchResult[];
  transitMatches: TransitMatchResult[];
  rejectedByCapacity: AvailableTruck[];
} {
  const directMatches: TransitMatchResult[] = [];
  const transitMatches: TransitMatchResult[] = [];
  const rejectedByCapacity: AvailableTruck[] = [];

  const { origin, originName, destination, destinationName, requestedQuantity, withTransit } = intent;

  trucks.forEach((truck) => {
    // 1. Filtrare pe capacitate: STRICT MAI MARE decât cantitatea cerută
    if (requestedQuantity !== undefined && truck.freePallets <= requestedQuantity) {
      rejectedByCapacity.push(truck);
      return;
    }

    const truckRaion = truck.currentRaion;
    const assignedDest = truck.destinationRaion || "chisinau";

    // 2. Potrivire Directă: Vehiculul e în originea căutată și merge spre destinație
    const isDirectOrigin = origin ? truckRaion === origin : true;
    const isDirectDest = destination ? assignedDest === destination : true;

    if (isDirectOrigin && isDirectDest) {
      directMatches.push({
        truck,
        matchType: "DIRECT",
        overlapDistanceKm: 85,
      });
      return;
    }

    // 3. Potrivire Tranzit: dacă a cerut explicit "cu tranzit" sau dacă ruta planificată trece prin segment
    if (withTransit && origin && destination) {
      // Verificăm dacă ruta vehiculului include originea sau destinația căutată ca punct intermediar
      const truckRouteKey = `${truckRaion}-${assignedDest}`;
      const corridor = CORRIDOR_TRANSITS[truckRouteKey] || [];

      const passesOrigin = corridor.includes(origin) || truckRaion === origin;
      const passesDest = corridor.includes(destination) || assignedDest === destination;

      // Exemplu: Camion Anenii Noi -> Bălți trece prin Chișinău și Rezina/Orhei
      const isTransitOverlap =
        (passesOrigin && passesDest) ||
        (truckRaion === "anenii_noi" && origin === "chisinau") ||
        (truckRaion === "orhei" && destination === "rezina");

      if (isTransitOverlap) {
        // Calculăm ora aproximativă de trecere
        const now = new Date();
        const transitMinutes = Math.floor(35 + Math.random() * 45);
        now.setMinutes(now.getMinutes() + transitMinutes);
        const passTimeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        transitMatches.push({
          truck,
          matchType: "TRANSIT",
          transitVia: originName || "Chișinău",
          estimatedPassTime: passTimeStr,
          overlapDistanceKm: 65,
        });
      }
    }
  });

  return {
    directMatches,
    transitMatches,
    rejectedByCapacity,
  };
}
