import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://placeholder-optifleet.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Singleton client pentru browser (Safe fallback pentru Vercel build)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole =
  | "SUPER_ADMIN"
  | "CARRIER_ADMIN"
  | "CARRIER_DRIVER"
  | "SME_ADMIN"
  | "SME_USER"
  | "SUPPLIER";

/**
 * Login cu email + password via Supabase Auth.
 * JWT-ul returnat este trimis automat la Rust API în header Authorization.
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}
