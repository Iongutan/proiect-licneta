import { NextResponse } from "next/server";
import { clientIp, jsonError, rateLimited, readJson, sameOrigin } from "@/lib/api-guard";
import { SESSION_COOKIE, createSession, sessionCookieOptions, verifyPassword } from "@/lib/server/auth";
import { asApp } from "@/lib/server/db";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Cerere respinsă.");
  const body = await readJson<{ email?: unknown; password?: unknown }>(request, 2048);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || password.length > 200) return jsonError(400, "Email sau parolă greșită.");

  // Limite separate pe adresă și pe IP: încetinesc ghicirea parolelor.
  if (rateLimited(`login:${email}`, 8, 15 * 60_000) || rateLimited(`login-ip:${clientIp(request)}`, 30, 15 * 60_000)) {
    return jsonError(429, "Prea multe încercări. Revino peste 15 minute.");
  }

  const user = await asApp(async (c) => (await c.query<{ id: string; encrypted_password: string | null }>(
    "select id, encrypted_password from auth.users where email = $1", [email])).rows[0]);
  // verifyPassword rulează și când contul nu există (timp constant, mesaj unic).
  const ok = await verifyPassword(password, user?.encrypted_password ?? null);
  if (!user || !ok) return jsonError(401, "Email sau parolă greșită.");

  await asApp((c) => c.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]));
  const token = await createSession(user.id, request.headers.get("user-agent"));
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
