import "server-only";

// Execută o QuerySpec (din query-builder.ts) ca SQL parametrizat.
// Apărare în adâncime: tabelele și coloanele sunt validate față de catalogul
// Postgres (doar ce are drept rolul `authenticated`/`anon`), identificatorii
// sunt citați, valorile merg DOAR ca parametri, iar execuția are loc sub RLS.

import type { PoolClient } from "pg";
import type { Filter, QueryResult, QuerySpec } from "@/lib/query-builder";
import { asUser, pool, toDbError } from "./db";

interface TableInfo {
  columns: Map<string, string>; // nume → tip (udt_name)
}

let catalog: { at: number; tables: Map<string, TableInfo> } | null = null;

async function tables(): Promise<Map<string, TableInfo>> {
  if (catalog && Date.now() - catalog.at < 60_000) return catalog.tables;
  const { rows } = await pool().query<{ table_name: string; column_name: string; type: string }>(
    `select c.relname as table_name, a.attname as column_name, t.typname as type
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
       join pg_type t on t.oid = a.atttypid
      where c.relkind in ('r', 'v', 'm')
        and (has_table_privilege('authenticated', c.oid, 'select, insert, update, delete')
             or has_any_column_privilege('authenticated', c.oid, 'select, insert, update'))`,
  );
  const map = new Map<string, TableInfo>();
  for (const r of rows) {
    const t = map.get(r.table_name) ?? { columns: new Map() };
    t.columns.set(r.column_name, r.type);
    map.set(r.table_name, t);
  }
  catalog = { at: Date.now(), tables: map };
  return map;
}

class BadRequest extends Error {
  code = "PGRST100";
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const MAX_ROWS = 1000;

function column(info: TableInfo, name: string): string {
  if (!info.columns.has(name)) throw new BadRequest(`Coloană necunoscută: ${name}`);
  return ident(name);
}

/** json/jsonb primesc JSON serializat; restul (inclusiv text[]) le convertește driverul. */
function param(info: TableInfo, col: string, value: unknown): unknown {
  const type = info.columns.get(col);
  if ((type === "jsonb" || type === "json") && value !== null && value !== undefined) return JSON.stringify(value);
  return value;
}

function selectList(info: TableInfo, columns: string | null): string {
  if (!columns || columns.trim() === "*") return "*";
  return columns.split(",").map((c) => column(info, c.trim())).join(", ");
}

function whereClause(info: TableInfo, filters: Filter[], params: unknown[]): string {
  if (!filters.length) return "";
  const parts = filters.map((f) => {
    const col = column(info, f.column);
    const add = (v: unknown) => {
      params.push(param(info, f.column, v));
      return `$${params.length}`;
    };
    switch (f.op) {
      case "eq": return `${col} = ${add(f.value)}`;
      case "neq": return `${col} <> ${add(f.value)}`;
      case "gt": return `${col} > ${add(f.value)}`;
      case "gte": return `${col} >= ${add(f.value)}`;
      case "lt": return `${col} < ${add(f.value)}`;
      case "lte": return `${col} <= ${add(f.value)}`;
      case "in":
        if (!Array.isArray(f.value)) throw new BadRequest("in() cere o listă");
        if (f.value.length === 0) return "false";
        return `${col} = any(${add(f.value)})`;
      case "is": return `${col} is null`;
      case "not.is": return `${col} is not null`;
      default: throw new BadRequest("Operator necunoscut");
    }
  });
  return ` where ${parts.join(" and ")}`;
}

async function run(c: PoolClient, info: TableInfo, spec: QuerySpec): Promise<QueryResult> {
  const table = `public.${ident(spec.table)}`;
  const params: unknown[] = [];
  const returning = spec.columns === null ? "" : ` returning ${selectList(info, spec.columns)}`;
  let sql: string;

  switch (spec.action) {
    case "select": {
      const order = spec.order.length
        ? ` order by ${spec.order.map((o) => `${column(info, o.column)} ${o.ascending ? "asc" : "desc"}`).join(", ")}`
        : "";
      const limit = Math.min(Math.max(1, Math.floor(spec.limit ?? MAX_ROWS)), MAX_ROWS);
      sql = `select ${selectList(info, spec.columns)} from ${table}${whereClause(info, spec.filters, params)}${order} limit ${limit}`;
      break;
    }
    case "insert": {
      const rows = Array.isArray(spec.values) ? spec.values : spec.values ? [spec.values] : [];
      if (!rows.length || rows.length > 200) throw new BadRequest("Între 1 și 200 de rânduri.");
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      if (!cols.length) throw new BadRequest("Nimic de inserat.");
      const tuples = rows.map((r) => `(${cols.map((k) => {
        if (!(k in r)) return "default";
        params.push(param(info, k, r[k]));
        return `$${params.length}`;
      }).join(", ")})`);
      sql = `insert into ${table} (${cols.map((k) => column(info, k)).join(", ")}) values ${tuples.join(", ")}${returning}`;
      break;
    }
    case "update": {
      const values = (spec.values ?? {}) as Record<string, unknown>;
      const cols = Object.keys(values);
      if (!cols.length) throw new BadRequest("Nimic de modificat.");
      if (!spec.filters.length) throw new BadRequest("Modificarea cere un filtru.");
      const set = cols.map((k) => {
        params.push(param(info, k, values[k]));
        return `${column(info, k)} = $${params.length}`;
      });
      sql = `update ${table} set ${set.join(", ")}${whereClause(info, spec.filters, params)}${returning}`;
      break;
    }
    case "delete": {
      if (!spec.filters.length) throw new BadRequest("Ștergerea cere un filtru.");
      sql = `delete from ${table}${whereClause(info, spec.filters, params)}${returning}`;
      break;
    }
    default:
      throw new BadRequest("Acțiune necunoscută");
  }

  const res = await c.query(sql, params);
  const count = spec.count === "exact" ? res.rowCount : undefined;
  if (spec.action !== "select" && spec.columns === null) return { data: null, error: null, count };

  if (spec.single) {
    if (res.rows.length > 1) return { data: null, error: { message: "Rezultatul are mai multe rânduri.", code: "PGRST116" } };
    if (res.rows.length === 0) {
      return spec.single === "maybe"
        ? { data: null, error: null, count }
        : { data: null, error: { message: "Rândul nu există sau nu ai acces la el.", code: "PGRST116" } };
    }
    return { data: res.rows[0], error: null, count };
  }
  return { data: res.rows, error: null, count };
}

function isSpec(x: unknown): x is QuerySpec {
  const s = x as QuerySpec;
  return Boolean(s) && typeof s.table === "string" && typeof s.action === "string"
    && Array.isArray(s.filters) && Array.isArray(s.order);
}

/** Validează și execută; nu aruncă — întoarce { data, error } ca un client obișnuit. */
export async function executeQuery(spec: unknown, userId: string | null): Promise<QueryResult> {
  try {
    if (!isSpec(spec)) throw new BadRequest("Cerere invalidă.");
    const info = (await tables()).get(spec.table);
    if (!info) throw new BadRequest(`Tabel necunoscut: ${spec.table}`);
    return await asUser(userId, (c) => run(c, info, spec));
  } catch (err) {
    return { data: null, error: toDbError(err) };
  }
}
