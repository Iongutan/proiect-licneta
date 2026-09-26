import "server-only";

// Variabile DOAR pentru server (nu au prefix NEXT_PUBLIC_ și nu ajung în browser).

export const serverEnv = {
  /** Serviciul ML intern (DBSCAN, CVRP, Qwen3). Opțional: fără el, gruparea e indisponibilă. */
  mlServiceUrl: process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8001",
  mlServiceToken: process.env.ML_SERVICE_TOKEN ?? "",
  /** OSRM local (docker compose). Fără el se folosește linia dreaptă între raioane. */
  osrmUrl: process.env.OSRM_URL ?? "http://127.0.0.1:5000",
};

export function mlConfigured(): boolean {
  return serverEnv.mlServiceToken.length >= 32;
}
