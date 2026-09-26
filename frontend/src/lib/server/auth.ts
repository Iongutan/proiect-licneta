import "server-only";

// Autentificare locală: parole cu scrypt (Node crypto, fără module native),
// sesiuni în baza de date. În cookie stă doar un token aleator de 256 de biți;
// în baza de date doar hash-ul lui, deci o copie a bazei nu dă acces la conturi.

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { promisify } from "node:util";
import { asApp } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export const SESSION_COOKIE = "of_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Aceleași reguli ca formularul de înregistrare. */
export function passwordProblem(p: string): string | null {
  if (p.length < 10) return "Parola trebuie să aibă minim 10 caractere.";
  if (p.length > 200) return "Parola e prea lungă.";
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return "Parola trebuie să conțină litere și cifre.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = stored?.split("$") ?? [];
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    // Aceeași durată ca o verificare reală: nu dezvăluim dacă emailul există.
    await scrypt(password, randomBytes(16), 64, SCRYPT);
    return false;
  }
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string, userAgent: string | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await asApp((c) => c.query(
    "insert into auth.sessions (user_id, token_hash, user_agent, expires_at) values ($1, $2, $3, now() + make_interval(days => $4))",
    [userId, sha256(token), userAgent?.slice(0, 300) ?? null, SESSION_DAYS],
  ));
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) return;
  await asApp((c) => c.query("delete from auth.sessions where token_hash = $1", [sha256(token)]));
}

export interface SessionUser {
  userId: string;
  email: string;
}

/** Utilizatorul unei sesiuni valide; prelungește ultima activitate cel mult o dată pe oră. */
export async function sessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const { rows } = await asApp((c) => c.query<{ user_id: string; email: string; stale: boolean; id: string }>(
    `select s.id, s.user_id, u.email, s.last_seen_at < now() - interval '1 hour' as stale
       from auth.sessions s join auth.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)],
  ));
  const row = rows[0];
  if (!row) return null;
  if (row.stale) {
    await asApp((c) => c.query("update auth.sessions set last_seen_at = now() where id = $1", [row.id])).catch(() => undefined);
  }
  return { userId: row.user_id, email: row.email };
}

/** Utilizatorul curent din cookie (Server Components, Route Handlers). */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return sessionUser(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Aplicația locală rulează pe http://127.0.0.1; pe HTTPS se activează Secure.
    secure: process.env.OPTIFLEET_SECURE_COOKIES === "1",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  };
}
