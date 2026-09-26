import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Company, Profile } from "./db-types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/** Client Supabase pentru Server Components și Route Handlers, cu sesiunea utilizatorului. */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Apelat dintr-un Server Component: cookie-urile se reîmprospătează în proxy.ts.
        }
      },
    },
  });
}

export interface Viewer {
  userId: string;
  email: string | null;
  profile: Profile | null;
  company: Company | null;
  isPlatformAdmin: boolean;
}

/**
 * Utilizatorul curent, verificat criptografic (getClaims validează semnătura JWT
 * cu cheile publice ale proiectului). O singură dată per request (React cache).
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const userId = data.claims.sub;
  const [{ data: profile }, { data: admin }] = await Promise.all([
    supabase.from("profiles").select("id, company_id, full_name, company_role").eq("id", userId).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  const { data: company } = profile
    ? await supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle()
    : { data: null };

  return {
    userId,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    profile: profile as Profile | null,
    company: company as Company | null,
    isPlatformAdmin: Boolean(admin),
  };
});
