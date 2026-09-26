import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "./supabase-server";

/**
 * Limitare de rată în memorie (fereastră fixă) per cheie. Protejează serviciile
 * costisitoare (OSRM, ML) de abuz. Pe mai multe instanțe fiecare are propriul
 * contor — suficient ca plasă de siguranță; limita globală o dă Supabase/infra.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size > 10_000) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Cere o sesiune validă; întoarce id-ul utilizatorului sau un răspuns 401. */
export async function requireUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return { response: jsonError(401, "Autentificare necesară.") };
  return { userId: sub };
}

export async function readJson<T>(request: Request, maxBytes = 16_384): Promise<T | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const isLat = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90;
export const isLon = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180;
