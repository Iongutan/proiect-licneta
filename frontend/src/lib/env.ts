// Variabile publice (ajung în bundle-ul din browser). Cheia publishable Supabase
// e publică prin design; protecția datelor o fac politicile RLS din baza de date.
// Referințele trebuie să fie statice ca Next să le poată insera la build.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Lipsesc NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY în frontend/.env.local (vezi .env.local.example).",
  );
}
if (key.startsWith("sb_secret_") || key.includes("service_role")) {
  throw new Error("Cheia secretă Supabase NU are voie să fie în variabile NEXT_PUBLIC_*.");
}

export const SUPABASE_URL = url;
export const SUPABASE_PUBLISHABLE_KEY = key;
