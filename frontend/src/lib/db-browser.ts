"use client";

// Clientul de date din browser. Aceeași formă ca înainte (from/rpc/channel/
// storage), dar vorbește doar cu serverul propriu (/api/db, /api/rpc,
// /api/storage, /api/realtime). Sesiunea e un cookie httpOnly; JavaScript-ul
// paginii nu vede niciun token.

import { QueryBuilder, type QueryResult, type QuerySpec } from "./query-builder";

async function post(url: string, body: unknown): Promise<QueryResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (json && "data" in json) return json as unknown as QueryResult;
    const message = typeof json?.error === "string" ? json.error : `Eroare de server (${res.status}).`;
    return { data: null, error: { message, code: String(res.status) } };
  } catch {
    return { data: null, error: { message: "Serverul nu răspunde. Verifică dacă aplicația rulează.", code: "NETWORK" } };
  }
}

// ─── Timp real (Server-Sent Events) ───────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ChangePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any>;
  old: Record<string, any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface ChangeConfig {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema: "public";
  table: string;
  /** Doar forma „coloană=eq.valoare”. */
  filter?: string;
}

interface Binding {
  config: ChangeConfig;
  callback: (payload: ChangePayload) => void;
}

export class RealtimeChannel {
  bindings: Binding[] = [];
  active = false;

  constructor(readonly name: string) {}

  on(_type: "postgres_changes", config: ChangeConfig, callback: (payload: ChangePayload) => void): this {
    this.bindings.push({ config, callback });
    return this;
  }

  subscribe(): this {
    this.active = true;
    realtime.add(this);
    return this;
  }
}

const realtime = (() => {
  const channels = new Set<RealtimeChannel>();
  let source: EventSource | null = null;
  let tablesKey = "";
  let scheduled = false;

  const matches = (b: Binding, table: string, eventType: ChangePayload["eventType"], row: Record<string, unknown>) => {
    if (b.config.table !== table) return false;
    if (b.config.event !== "*" && b.config.event !== eventType) return false;
    if (!b.config.filter) return true;
    const m = b.config.filter.match(/^([a-z_]+)=eq\.(.+)$/);
    return Boolean(m) && String(row[m![1]] ?? "") === m![2];
  };

  const reconnect = () => {
    scheduled = false;
    const tables = [...new Set([...channels].flatMap((c) => c.bindings.map((b) => b.config.table)))].sort();
    const key = tables.join(",");
    if (key === tablesKey && source) return;
    source?.close();
    source = null;
    tablesKey = key;
    if (!tables.length) return;
    source = new EventSource(`/api/realtime?tables=${encodeURIComponent(key)}`);
    source.onmessage = (e) => {
      let ev: { table: string } & ChangePayload;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      const row = ev.eventType === "DELETE" ? ev.old : ev.new;
      for (const ch of channels) {
        for (const b of ch.bindings) {
          if (matches(b, ev.table, ev.eventType, row)) b.callback({ eventType: ev.eventType, new: ev.new, old: ev.old });
        }
      }
    };
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(reconnect);
  };

  return {
    add(ch: RealtimeChannel) {
      channels.add(ch);
      schedule();
    },
    remove(ch: RealtimeChannel) {
      channels.delete(ch);
      schedule();
    },
  };
})();

// ─── Client ───────────────────────────────────────────────────────────────
export interface BrowserDb {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<QueryResult>;
  channel: (name: string) => RealtimeChannel;
  removeChannel: (channel: RealtimeChannel) => void;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: Blob, options?: { contentType?: string; upsert?: boolean }) => Promise<QueryResult<{ path: string }>>;
      createSignedUrl: (path: string, expiresInSeconds: number) => Promise<QueryResult<{ signedUrl: string }>>;
    };
  };
  auth: { signOut: () => Promise<void> };
}

let client: BrowserDb | undefined;

export function dbBrowser(): BrowserDb {
  client ??= {
    from: (table) => new QueryBuilder((spec: QuerySpec) => post("/api/db", spec), table),
    rpc: (fn, args = {}) => post(`/api/rpc/${encodeURIComponent(fn)}`, args),
    channel: (name) => new RealtimeChannel(name),
    removeChannel: (ch) => realtime.remove(ch),
    storage: {
      from: (bucket) => ({
        upload: async (path, file, options) => {
          try {
            const res = await fetch(`/api/storage/${encodeURIComponent(bucket)}?path=${encodeURIComponent(path)}`, {
              method: "PUT",
              headers: { "Content-Type": options?.contentType ?? (file.type || "application/octet-stream") },
              body: file,
              credentials: "same-origin",
            });
            const json = await res.json().catch(() => null);
            return json && "data" in json ? json : { data: null, error: { message: "Încărcarea a eșuat.", code: String(res.status) } };
          } catch {
            return { data: null, error: { message: "Serverul nu răspunde.", code: "NETWORK" } };
          }
        },
        // Accesul la fișier e verificat la fiecare citire (cookie + RLS); URL-ul nu e un secret.
        createSignedUrl: async (path) => ({
          data: { signedUrl: `/api/storage/${encodeURIComponent(bucket)}?path=${encodeURIComponent(path)}` },
          error: null,
        }),
      }),
    },
    auth: {
      signOut: async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
      },
    },
  };
  return client;
}

/** Mesajul de eroare Postgres, gata de afișat (RPC-urile au mesaje în română). */
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
