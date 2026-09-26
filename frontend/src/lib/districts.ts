// Cele 37 de unități administrativ-teritoriale. Oglindă a supabase/sql/07_seed_districts.sql
// (testul districts.test.ts verifică sincronizarea). Centrul = orașul-reședință.

export type Region = "NORD" | "CENTRU" | "SUD";

export interface District {
  id: string;
  name: string;
  region: Region;
  lat: number;
  lon: number;
  /** Forme alternative folosite în căutare (fără diacritice, lowercase). */
  aliases?: string[];
}

export const DISTRICTS: District[] = [
  { id: "chisinau", name: "Chișinău", region: "CENTRU", lat: 47.0105, lon: 28.8638, aliases: ["kishinev", "chisinaului"] },
  { id: "balti", name: "Bălți", region: "NORD", lat: 47.7617, lon: 27.929 },
  { id: "bender", name: "Bender", region: "SUD", lat: 46.8316, lon: 29.4773, aliases: ["tighina"] },
  { id: "briceni", name: "Briceni", region: "NORD", lat: 48.3615, lon: 27.0845, aliases: ["criva"] },
  { id: "donduseni", name: "Dondușeni", region: "NORD", lat: 48.2233, lon: 27.5908 },
  { id: "drochia", name: "Drochia", region: "NORD", lat: 48.0355, lon: 27.8126 },
  { id: "edinet", name: "Edineț", region: "NORD", lat: 48.1717, lon: 27.3053 },
  { id: "falesti", name: "Fălești", region: "NORD", lat: 47.5732, lon: 27.7093 },
  { id: "floresti", name: "Florești", region: "NORD", lat: 47.8913, lon: 28.2944 },
  { id: "glodeni", name: "Glodeni", region: "NORD", lat: 47.7708, lon: 27.5144 },
  { id: "ocnita", name: "Ocnița", region: "NORD", lat: 48.4108, lon: 27.4806, aliases: ["otaci"] },
  { id: "riscani", name: "Rîșcani", region: "NORD", lat: 47.9575, lon: 27.5536, aliases: ["riscani", "rascani"] },
  { id: "singerei", name: "Sîngerei", region: "NORD", lat: 47.6353, lon: 28.1419, aliases: ["sangerei"] },
  { id: "soldanesti", name: "Șoldănești", region: "NORD", lat: 47.8161, lon: 28.7969 },
  { id: "soroca", name: "Soroca", region: "NORD", lat: 48.1558, lon: 28.2975 },
  { id: "anenii_noi", name: "Anenii Noi", region: "CENTRU", lat: 46.8797, lon: 29.2314, aliases: ["anenii"] },
  { id: "calarasi", name: "Călărași", region: "CENTRU", lat: 47.2544, lon: 28.3081 },
  { id: "criuleni", name: "Criuleni", region: "CENTRU", lat: 47.2139, lon: 29.1592 },
  { id: "dubasari", name: "Dubăsari", region: "CENTRU", lat: 47.3016, lon: 29.1231, aliases: ["cocieri"] },
  { id: "hincesti", name: "Hîncești", region: "CENTRU", lat: 46.8306, lon: 28.5906, aliases: ["hancesti", "leuseni"] },
  { id: "ialoveni", name: "Ialoveni", region: "CENTRU", lat: 46.9431, lon: 28.7822 },
  { id: "nisporeni", name: "Nisporeni", region: "CENTRU", lat: 47.0814, lon: 28.1783 },
  { id: "orhei", name: "Orhei", region: "CENTRU", lat: 47.3831, lon: 28.8231 },
  { id: "rezina", name: "Rezina", region: "CENTRU", lat: 47.7492, lon: 28.9622 },
  { id: "straseni", name: "Strășeni", region: "CENTRU", lat: 47.1414, lon: 28.6103 },
  { id: "telenesti", name: "Telenești", region: "CENTRU", lat: 47.4997, lon: 28.3656 },
  { id: "ungheni", name: "Ungheni", region: "CENTRU", lat: 47.2108, lon: 27.8006, aliases: ["sculeni"] },
  { id: "basarabeasca", name: "Basarabeasca", region: "SUD", lat: 46.3336, lon: 28.9614 },
  { id: "cahul", name: "Cahul", region: "SUD", lat: 45.9075, lon: 28.1944, aliases: ["giurgiulesti", "oancea"] },
  { id: "cantemir", name: "Cantemir", region: "SUD", lat: 46.2781, lon: 28.2011 },
  { id: "causeni", name: "Căușeni", region: "SUD", lat: 46.6442, lon: 29.4114 },
  { id: "cimislia", name: "Cimișlia", region: "SUD", lat: 46.52, lon: 28.7836 },
  { id: "leova", name: "Leova", region: "SUD", lat: 46.4786, lon: 28.2553 },
  { id: "stefan_voda", name: "Ștefan Vodă", region: "SUD", lat: 46.5128, lon: 29.6631 },
  { id: "taraclia", name: "Taraclia", region: "SUD", lat: 45.8986, lon: 28.6689 },
  { id: "gagauzia", name: "UTA Găgăuzia", region: "SUD", lat: 46.2956, lon: 28.6567, aliases: ["comrat", "gagauzia", "ceadir lunga", "vulcanesti"] },
  { id: "stinga_nistrului", name: "Stânga Nistrului", region: "SUD", lat: 46.8403, lon: 29.6433, aliases: ["tiraspol", "ribnita", "transnistria"] },
];

export const REGIONS: Record<Region, { name: string; lat: number; lon: number }> = {
  NORD: { name: "Nord", lat: 47.98, lon: 27.85 },
  CENTRU: { name: "Centru", lat: 47.2, lon: 28.65 },
  SUD: { name: "Sud", lat: 46.3, lon: 28.75 },
};

const BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));

export function districtById(id: string | null | undefined): District | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function districtName(id: string | null | undefined): string {
  return districtById(id)?.name ?? "—";
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
