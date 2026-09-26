import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isLat, isLon, jsonError, rateLimited, readJson } from "@/lib/api-guard";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

// Poziții GPS de la trackere / aplicația șoferului.
// Autentificare: Authorization: Bearer <token de dispozitiv> (generat în pagina
// vehiculului). Tokenul e verificat în baza de date prin hash SHA-256
// (ingest_position); endpointul nu are nevoie de nicio cheie secretă.

const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Body {
  lat?: unknown;
  lon?: unknown;
  speed_kmh?: unknown;
  heading?: unknown;
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if (!token) return jsonError(401, "Token lipsă sau invalid.");
  if (rateLimited(`gps:${token}`, 30, 60_000)) return jsonError(429, "Prea multe poziții.");

  const body = await readJson<Body>(request, 1024);
  if (!body || !isLat(body.lat) || !isLon(body.lon)) return jsonError(400, "lat/lon invalide.");
  const speed = typeof body.speed_kmh === "number" && body.speed_kmh >= 0 && body.speed_kmh <= 200 ? body.speed_kmh : null;
  const heading = typeof body.heading === "number" && Number.isInteger(body.heading) && body.heading >= 0 && body.heading < 360 ? body.heading : null;

  const { data, error } = await anon.rpc("ingest_position", {
    p_token: token, p_lat: body.lat, p_lon: body.lon, p_speed: speed, p_heading: heading,
  });
  if (error) return jsonError(502, "Poziția nu a putut fi salvată.");
  // false = token necunoscut sau poziție trimisă prea des; nu dezvăluim care.
  return NextResponse.json({ accepted: data === true }, { status: data ? 200 : 202 });
}
