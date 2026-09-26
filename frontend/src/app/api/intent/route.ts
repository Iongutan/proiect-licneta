import { NextResponse } from "next/server";
import { jsonError, rateLimited, readJson, requireUser } from "@/lib/api-guard";
import { DISTRICTS } from "@/lib/districts";
import { MlUnavailable, callMl } from "@/lib/ml-client";

// K4: când parserul determinist nu înțelege căutarea, cerem interpretarea
// modelului local Qwen3 (prin ml_service). Răspunsul e limitat la raioanele cunoscute.

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (rateLimited(`intent:${auth.userId}`, 20, 60_000)) return jsonError(429, "Prea multe căutări. Încearcă peste un minut.");

  const body = await readJson<{ query?: unknown }>(request, 2048);
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 300) : "";
  if (!query) return jsonError(400, "Căutare goală.");

  try {
    const r = await callMl<{ origin: string | null; destination: string | null; pallets: number | null; with_transit: boolean }>(
      "/v1/intent",
      { query, known_places: DISTRICTS.map((d) => d.name) },
      22_000,
    );
    const byName = (name: string | null) => DISTRICTS.find((d) => d.name === name)?.id ?? null;
    return NextResponse.json({
      origin: byName(r.origin), destination: byName(r.destination), pallets: r.pallets, withTransit: r.with_transit,
    });
  } catch (e) {
    if (e instanceof MlUnavailable) return jsonError(503, "Modelul local (Qwen3) nu rulează.");
    return jsonError(502, "Interpretarea a eșuat.");
  }
}
