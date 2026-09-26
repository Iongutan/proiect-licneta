import { NextResponse } from "next/server";
import { clientIp, jsonError, rateLimited, readJson, sameOrigin } from "@/lib/api-guard";
import { EMAIL_PATTERN, SESSION_COOKIE, createSession, hashPassword, passwordProblem, sessionCookieOptions } from "@/lib/server/auth";
import { asApp } from "@/lib/server/db";

// Înregistrarea firmei (K1): contul + firma + profilul se creează într-o singură
// tranzacție — triggerul handle_new_user (03_functions_core.sql) validează
// metadatele și anulează totul dacă ceva e greșit.

interface Body {
  email?: unknown;
  password?: unknown;
  data?: Record<string, unknown>;
}

const META_KEYS = ["full_name", "company_name", "legal_form", "idno", "company_kind", "district_id"] as const;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Cerere respinsă.");
  if (rateLimited(`signup:${clientIp(request)}`, 5, 10 * 60_000)) return jsonError(429, "Prea multe încercări. Revino peste câteva minute.");

  const body = await readJson<Body>(request, 8192);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return jsonError(400, "Adresă de email invalidă.");
  const problem = passwordProblem(password);
  if (problem) return jsonError(400, problem);

  const meta: Record<string, string> = {};
  for (const key of META_KEYS) {
    const v = body?.data?.[key];
    if (typeof v === "string" && v.length <= 200) meta[key] = v.trim();
  }
  if (!meta.company_name || !meta.full_name) return jsonError(400, "Numele și denumirea firmei sunt obligatorii.");

  let userId: string;
  try {
    const hash = await hashPassword(password);
    userId = await asApp(async (c) => (await c.query<{ id: string }>(
      "insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning id",
      [email, hash, JSON.stringify(meta)],
    )).rows[0].id);
  } catch (err) {
    const e = err as { code?: string; constraint?: string; message?: string };
    if (e.code === "23505" && e.constraint === "users_email_key") return jsonError(409, "Există deja un cont cu acest email.");
    if (e.code === "23505") return jsonError(409, "Există deja o firmă înregistrată cu acest IDNO.");
    if (e.code === "23514" || e.code === "22023" || e.code === "23503") {
      return jsonError(400, "Datele firmei nu sunt valide. Verifică IDNO-ul (13 cifre), forma juridică și raionul.");
    }
    return jsonError(500, "Contul nu a putut fi creat.");
  }

  const token = await createSession(userId, request.headers.get("user-agent"));
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
