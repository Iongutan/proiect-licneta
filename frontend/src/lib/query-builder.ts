// Constructor de interogări cu aceeași formă ca înainte (from().select().eq()…),
// dar care produce doar o descriere JSON a cererii. Execuția o face serverul
// (src/lib/server/query.ts), care validează tabelul și coloanele și rulează
// SQL parametrizat ca utilizatorul curent, sub RLS. Nu conține SQL.

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "not.is";

export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface QuerySpec {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  /** Coloanele citite (select) sau întoarse după scriere; null = nimic întors. */
  columns: string | null;
  filters: Filter[];
  order: Array<{ column: string; ascending: boolean }>;
  limit?: number;
  single?: "one" | "maybe";
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  count?: "exact";
}

export interface DbErrorShape {
  message: string;
  code: string;
}

// Fără tipuri generate pentru schemă: rândurile sunt `any`, ca la clientul anterior.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryResult<T = any> {
  data: T | null;
  error: DbErrorShape | null;
  count?: number | null;
}

export type Executor = (spec: QuerySpec) => Promise<QueryResult>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryBuilder<T = any[]> implements PromiseLike<QueryResult<T>> {
  private spec: QuerySpec;

  constructor(private readonly exec: Executor, table: string) {
    this.spec = { table, action: "select", columns: "*", filters: [], order: [] };
  }

  /** La citire: coloanele cerute. După insert/update/delete: coloanele întoarse. */
  select(columns = "*"): this {
    this.spec.columns = columns;
    return this;
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>): this {
    this.spec = { ...this.spec, action: "insert", values, columns: null };
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.spec = { ...this.spec, action: "update", values, columns: null };
    return this;
  }

  delete(options?: { count?: "exact" }): this {
    this.spec = { ...this.spec, action: "delete", columns: null, count: options?.count };
    return this;
  }

  private filter(column: string, op: FilterOp, value: unknown): this {
    this.spec.filters.push({ column, op, value });
    return this;
  }

  eq(column: string, value: unknown) { return this.filter(column, "eq", value); }
  neq(column: string, value: unknown) { return this.filter(column, "neq", value); }
  gt(column: string, value: unknown) { return this.filter(column, "gt", value); }
  gte(column: string, value: unknown) { return this.filter(column, "gte", value); }
  lt(column: string, value: unknown) { return this.filter(column, "lt", value); }
  lte(column: string, value: unknown) { return this.filter(column, "lte", value); }
  in(column: string, values: readonly unknown[]) { return this.filter(column, "in", [...values]); }
  is(column: string, value: null) { return this.filter(column, "is", value); }

  /** Doar forma folosită în aplicație: .not(col, "is", null). */
  not(column: string, operator: "is", value: null): this {
    if (operator !== "is" || value !== null) throw new Error("not(): doar „is null” e suportat");
    return this.filter(column, "not.is", null);
  }

  match(values: Record<string, unknown>): this {
    for (const [k, v] of Object.entries(values)) this.filter(k, "eq", v);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.spec.order.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this.spec.limit = n;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single(): QueryBuilder<any> {
    this.spec.single = "one";
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle(): QueryBuilder<any> {
    this.spec.single = "maybe";
    return this;
  }

  then<R1 = QueryResult<T>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec(this.spec).then((r) => r as QueryResult<T>).then(onfulfilled, onrejected);
  }
}
