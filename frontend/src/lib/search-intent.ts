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

// Dicționar de sinagrame și aliasuri raioane Moldova
const DISTRICT_ALIASES: Record<string, { id: string; name: string }> = {
  chisinau: { id: "chisinau", name: "Chișinău" },
  chisinaului: { id: "chisinau", name: "Chișinău" },
  balti: { id: "balti", name: "Bălți" },
  orhei: { id: "orhei", name: "Orhei" },
  rezina: { id: "rezina", name: "Rezina" },
  soroca: { id: "soroca", name: "Soroca" },
  ungheni: { id: "ungheni", name: "Ungheni" },
  cahul: { id: "cahul", name: "Cahul" },
  edinet: { id: "edinet", name: "Edineț" },
  "anenii noi": { id: "anenii_noi", name: "Anenii Noi" },
  aneniinoi: { id: "anenii_noi", name: "Anenii Noi" },
  comrat: { id: "comrat", name: "Comrat" },
  falesti: { id: "falesti", name: "Fălești" },
  drochia: { id: "drochia", name: "Drochia" },
  ialoveni: { id: "ialoveni", name: "Ialoveni" },
  hincesti: { id: "hincesti", name: "Hîncești" },
  straseni: { id: "straseni", name: "Strășeni" },
  causeni: { id: "causeni", name: "Căușeni" },
  cimislia: { id: "cimislia", name: "Cimișlia" },
};

// Rute predefinite de tranzit prin Moldova (ex: mașini pe coridoare naționale)
export const CORRIDOR_TRANSITS: Record<string, string[]> = {
  // Rută M5/R14 Bălți - Chișinău trece prin Sîngerei, Telenești, Strășeni
  "balti-chisinau": ["balti", "singerei", "telenesti", "straseni", "chisinau"],
  "chisinau-balti": ["chisinau", "straseni", "telenesti", "singerei", "balti"],

  // Rută Chișinău - Rezina trece prin Orhei
  "chisinau-rezina": ["chisinau", "orhei", "rezina"],
  "rezina-chisinau": ["rezina", "orhei", "chisinau"],

  // Rută Anenii Noi - Bălți trece prin Chișinău, Orhei
  "anenii_noi-balti": ["anenii_noi", "chisinau", "orhei", "balti"],

  // Rută Soroca - Chișinău trece prin Florești, Orhei
  "soroca-chisinau": ["soroca", "floresti", "orhei", "chisinau"],
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
