import "server-only";

// Acces la date din Server Components și Route Handlers, ca utilizatorul curent
// (sesiunea din cookie). Aceeași interfață ca în browser: from() / rpc().

import { cache } from "react";
import type { Company, Profile } from "./db-types";
import { QueryBuilder } from "./query-builder";
import { currentUser } from "./server/auth";
import { executeQuery } from "./server/query";
import { callRpc } from "./server/rpc";

export interface ServerDb {
  userId: string | null;
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => ReturnType<typeof callRpc>;
}

export function dbAs(userId: string | null): ServerDb {
  return {
    userId,
    from: (table) => new QueryBuilder((spec) => executeQuery(spec, userId), table),
    rpc: (fn, args = {}) => callRpc(fn, args, userId),
  };
}

/** Clientul pentru utilizatorul din cookie (sau anonim). */
export async function dbServer(): Promise<ServerDb> {
  const user = await currentUser();
  return dbAs(user?.userId ?? null);
}

export interface Viewer {
  userId: string;
  email: string | null;
  profile: Profile | null;
  company: Company | null;
  isPlatformAdmin: boolean;
}

/** Utilizatorul curent, cu profilul și firma lui. O singură dată per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await currentUser();
  if (!user) return null;
  const db = dbAs(user.userId);
  const [{ data: profile }, { data: admin }] = await Promise.all([
    db.from("profiles").select("id, company_id, full_name, company_role").eq("id", user.userId).maybeSingle(),
    db.from("platform_admins").select("user_id").eq("user_id", user.userId).maybeSingle(),
  ]);
  const { data: company } = profile
    ? await db.from("companies").select("*").eq("id", (profile as Profile).company_id).maybeSingle()
    : { data: null };

  return {
    userId: user.userId,
    email: user.email,
    profile: profile as Profile | null,
    company: company as Company | null,
    isPlatformAdmin: Boolean(admin),
  };
});
