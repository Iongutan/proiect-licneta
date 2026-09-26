import "server-only";

// Apelează funcțiile SQL (RPC) din schema public. Listă albă = exact funcțiile
// pe care baza le permite rolului apelantului (GRANT EXECUTE din 05/10);
// argumentele sunt validate după numele din catalog și trimise ca parametri.

import type { QueryResult } from "@/lib/query-builder";
import { asUser, pool, toDbError } from "./db";

interface FnInfo {
  args: Map<string, string>; // nume argument → tip
  returnsRows: boolean;
  returnsVoid: boolean;
  roles: { anon: boolean; authenticated: boolean };
}

let catalog: { at: number; fns: Map<string, FnInfo> } | null = null;

async function functions(): Promise<Map<string, FnInfo>> {
  if (catalog && Date.now() - catalog.at < 60_000) return catalog.fns;
  const { rows } = await pool().query<{
    proname: string; argnames: string[] | null; argtypes: string[]; argmodes: string[] | null;
    retset: boolean; rettype: string; typtype: string; anon: boolean; auth: boolean;
  }>(
    `select p.proname,
            p.proargnames as argnames,
            array(select format_type(t, null) from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) t) as argtypes,
            p.proargmodes::text[] as argmodes,
            p.proretset as retset,
            format_type(p.prorettype, null) as rettype,
            rt.typtype,
            has_function_privilege('anon', p.oid, 'execute') as anon,
            has_function_privilege('authenticated', p.oid, 'execute') as auth
       from pg_proc p
       join pg_type rt on rt.oid = p.prorettype
      where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`,
  );
  const fns = new Map<string, FnInfo>();
  for (const r of rows) {
    const args = new Map<string, string>();
    (r.argnames ?? []).forEach((name, i) => {
      const mode = r.argmodes?.[i] ?? "i";
      if (name && (mode === "i" || mode === "b")) args.set(name, r.argtypes[i]);
    });
    fns.set(r.proname, {
      args,
      returnsRows: r.retset || r.typtype === "c" || r.rettype === "record",
      returnsVoid: r.rettype === "void",
      roles: { anon: r.anon, authenticated: r.auth },
    });
  }
  catalog = { at: Date.now(), fns };
  return fns;
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function callRpc(name: string, args: unknown, userId: string | null): Promise<QueryResult> {
  try {
    const fn = (await functions()).get(name);
    if (!fn || !(userId ? fn.roles.authenticated : fn.roles.anon)) {
      return { data: null, error: { message: "Funcție inexistentă sau fără drept de apel.", code: "42883" } };
    }
    const input = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
    const params: unknown[] = [];
    const named: string[] = [];
    for (const [k, v] of Object.entries(input)) {
      const type = fn.args.get(k);
      if (!type) return { data: null, error: { message: `Argument necunoscut: ${k}`, code: "42883" } };
      params.push((type === "jsonb" || type === "json") && v !== null && v !== undefined ? JSON.stringify(v) : v);
      named.push(`${ident(k)} => $${params.length}`);
    }
    const call = `public.${ident(name)}(${named.join(", ")})`;
    return await asUser(userId, async (c) => {
      if (fn.returnsRows) {
        const res = await c.query(`select * from ${call}`, params);
        return { data: res.rows, error: null };
      }
      const res = await c.query(`select ${call} as r`, params);
      return { data: fn.returnsVoid ? null : res.rows[0]?.r ?? null, error: null };
    });
  } catch (err) {
    return { data: null, error: toDbError(err) };
  }
}
