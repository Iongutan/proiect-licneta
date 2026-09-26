import { NextResponse } from "next/server";
import { jsonError, readJson, sameOrigin } from "@/lib/api-guard";
import { currentUser } from "@/lib/server/auth";
import { callRpc } from "@/lib/server/rpc";

// Funcțiile de business (05_business_rpc.sql, 10_trust_and_market.sql).
// Doar cele cu GRANT EXECUTE pentru rolul apelantului pot fi chemate.
export async function POST(request: Request, { params }: { params: Promise<{ fn: string }> }) {
  if (!sameOrigin(request)) return jsonError(403, "Cerere respinsă.");
  const { fn } = await params;
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(fn)) return jsonError(404, "Funcție inexistentă.");
  const args = await readJson<Record<string, unknown>>(request, 256 * 1024);
  const user = await currentUser();
  const result = await callRpc(fn, args ?? {}, user?.userId ?? null);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
