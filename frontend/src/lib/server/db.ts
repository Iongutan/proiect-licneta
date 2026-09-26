import "server-only";

// Conexiunea la PostgreSQL-ul local. Aplicația se conectează ca optifleet_app
// și execută fiecare cerere a unui utilizator într-o tranzacție în care:
//   SET LOCAL ROLE authenticated (sau anon) + request.jwt.claim.sub = userId
// → politicile RLS și drepturile pe coloane din supabase/sql/04 se aplică exact
// ca înainte; codul aplicației nu ocolește nicio regulă.

import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

export function dataDir(): string {
  return process.env.OPTIFLEET_DATA_DIR ?? path.resolve(process.cwd(), "..", ".data");
}

function connectionString(): string {
  if (process.env.OPTIFLEET_DATABASE_URL) return process.env.OPTIFLEET_DATABASE_URL;
  const file = path.join(dataDir(), "credentials.json");
  if (!fs.existsSync(file)) {
    throw new Error("Baza de date locală nu e configurată. Pornește aplicația cu `npm run dev` din rădăcina proiectului.");
  }
  const c = JSON.parse(fs.readFileSync(file, "utf8")) as { port: number; appPassword: string };
  return `postgres://optifleet_app:${encodeURIComponent(c.appPassword)}@127.0.0.1:${c.port}/optifleet`;
}

const globalForPool = globalThis as unknown as { optifleetPool?: Pool };

export function pool(): Pool {
  globalForPool.optifleetPool ??= new Pool({ connectionString: connectionString(), max: 12, idleTimeoutMillis: 30_000 });
  return globalForPool.optifleetPool;
}

export interface DbError {
  message: string;
  code: string;
}

export function toDbError(err: unknown): DbError {
  const e = err as { message?: string; code?: string };
  return { message: e?.message ?? "Eroare la baza de date.", code: e?.code ?? "XX000" };
}

/** Rulează `fn` ca utilizatorul dat (sau anonim) — RLS decide ce vede și ce poate scrie. */
export async function asUser<T>(userId: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    await c.query(userId ? "set local role authenticated" : "set local role anon");
    await c.query("set local statement_timeout = '15s'");
    await c.query(
      "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
      [userId ?? "", JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" })],
    );
    const result = await fn(c);
    await c.query("commit");
    return result;
  } catch (err) {
    await c.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

/** Rulează ca aplicația însăși — DOAR pentru conturi și sesiuni (schema auth). */
export async function asApp<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}
