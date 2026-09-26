import { NextResponse } from "next/server";
import { jsonError, readJson, sameOrigin } from "@/lib/api-guard";
import { currentUser } from "@/lib/server/auth";
import { executeQuery } from "@/lib/server/query";

// Interogările din browser (from().select()…). Rulează ca utilizatorul din
// cookie, sub RLS; validarea tabelelor/coloanelor e în lib/server/query.ts.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Cerere respinsă.");
  const spec = await readJson<unknown>(request, 512 * 1024);
  if (!spec) return jsonError(400, "Cerere invalidă.");
  const user = await currentUser();
  const result = await executeQuery(spec, user?.userId ?? null);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
