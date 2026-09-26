import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, sameOrigin } from "@/lib/api-guard";
import { SESSION_COOKIE, deleteSession } from "@/lib/server/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Cerere respinsă.");
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
