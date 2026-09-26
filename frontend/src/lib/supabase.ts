"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | undefined;

/** Client Supabase pentru browser; sesiunea stă în cookie-uri gestionate de @supabase/ssr. */
export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}

/** Mesajul de eroare Postgres/PostgREST, gata de afișat (RPC-urile au mesaje în română). */
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const code = "code" in error ? String(error.code) : "";
    if (code === "42501" && /permission denied|row-level security/i.test(error.message)) {
      return "Nu ai drepturi pentru această acțiune.";
    }
    return error.message;
  }
  return "A apărut o eroare neașteptată.";
}
