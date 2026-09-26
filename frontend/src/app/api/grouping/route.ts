import { NextResponse } from "next/server";
import { jsonError, rateLimited, requireUser } from "@/lib/api-guard";
import { MlUnavailable, callMl } from "@/lib/ml-client";
import { supabaseServer } from "@/lib/supabase-server";

// Grupaj (group-buying): cererile deschise vizibile utilizatorului (prin RLS)
// sunt trimise la DBSCAN; răspunsul conține grupurile de cereri pe același
// coridor, cu economia estimată de kilometri.

interface GroupOut {
  shipment_ids: string[];
  pallets_total: number;
  individual_km: number;
  consolidated_km: number;
  savings_pct: number;
}

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (rateLimited(`grouping:${auth.userId}`, 10, 60_000)) return jsonError(429, "Încearcă din nou peste un minut.");

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("freight_requests_geo")
    .select("id, origin_lat, origin_lon, destination_lat, destination_lon, pallets, ready_from, deliver_by")
    .eq("status", "OPEN")
    .gte("deliver_by", new Date().toISOString())
    .limit(2000);
  if (error) return jsonError(500, "Cererile nu au putut fi citite.");
  if (!data || data.length < 2) return NextResponse.json({ groups: [], ungrouped_ids: (data ?? []).map((r) => r.id) });

  try {
    const result = await callMl<{ groups: GroupOut[]; ungrouped_ids: string[]; algorithm: string }>("/v1/grouping", {
      shipments: data.map((r) => ({
        id: r.id,
        pickup: { lat: r.origin_lat, lon: r.origin_lon },
        dropoff: { lat: r.destination_lat, lon: r.destination_lon },
        pallets: r.pallets,
        ready_from: r.ready_from,
        deliver_by: r.deliver_by,
      })),
      eps_km: 15,
      min_group_size: 2,
      max_group_pallets: 33,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof MlUnavailable) return jsonError(503, "Serviciul de grupare (ml_service) nu rulează.");
    return jsonError(502, "Gruparea a eșuat.");
  }
}
