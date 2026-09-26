import { NextResponse } from "next/server";
import { isLat, isLon, jsonError, rateLimited, readJson, requireUser } from "@/lib/api-guard";
import { serverEnv } from "@/lib/server-env";

// Traseu rutier între două puncte prin OSRM-ul local (docker compose).
// Nu folosim serverul public demo OSRM (politica lui interzice uzul în aplicații).

interface Body {
  from?: { lat?: unknown; lon?: unknown };
  to?: { lat?: unknown; lon?: unknown };
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (rateLimited(`route:${auth.userId}`, 30, 60_000)) return jsonError(429, "Prea multe cereri de traseu. Încearcă peste un minut.");

  const body = await readJson<Body>(request);
  const { from, to } = body ?? {};
  if (!from || !to || !isLat(from.lat) || !isLon(from.lon) || !isLat(to.lat) || !isLon(to.lon)) {
    return jsonError(400, "Coordonate invalide.");
  }

  const coords = `${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}`;
  try {
    const res = await fetch(`${serverEnv.osrmUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!res.ok || data?.code !== "Ok" || !route?.geometry) return jsonError(502, "OSRM nu a găsit traseul.");
    return NextResponse.json(
      {
        geometry: route.geometry,
        distanceKm: Math.round(route.distance / 100) / 10,
        durationMin: Math.round(route.duration / 60),
        source: "osrm",
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return jsonError(503, "Serviciul de rutare (OSRM) nu rulează.");
  }
}
