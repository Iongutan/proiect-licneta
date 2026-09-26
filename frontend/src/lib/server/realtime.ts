import "server-only";

// Timp real: o singură conexiune LISTEN la canalul `optifleet_changes`
// (triggerele din db/platform/90_realtime.sql). Pentru fiecare eveniment,
// rândul se recitește CA FIECARE abonat (RLS) și se trimite doar celor care
// îl pot vedea — nimeni nu primește date la care nu are acces.

import type { Client } from "pg";
import { asUser, pool } from "./db";

export interface ChangeEvent {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

interface Subscriber {
  userId: string;
  tables: Set<string>;
  send: (event: ChangeEvent) => void;
}

const TABLES = new Set(["vehicles", "vehicle_loads", "bookings", "booking_messages", "notifications"]);

const state = globalThis as unknown as {
  optifleetRealtime?: { subscribers: Set<Subscriber>; listener: Promise<Client> | null };
};
state.optifleetRealtime ??= { subscribers: new Set(), listener: null };
const hub = state.optifleetRealtime;

async function deliver(raw: string) {
  let msg: { t: string; op: ChangeEvent["eventType"]; row: Record<string, unknown> };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!TABLES.has(msg.t) || typeof msg.row?.id !== "string") return;
  const targets = [...hub.subscribers].filter((s) => s.tables.has(msg.t));
  if (!targets.length) return;

  if (msg.op === "DELETE") {
    // Rândul nu mai există: trimitem doar id-urile de legătură (fără conținut).
    for (const s of targets) s.send({ table: msg.t, eventType: "DELETE", new: {}, old: msg.row });
    return;
  }
  const byUser = new Map<string, Subscriber[]>();
  for (const s of targets) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  await Promise.all([...byUser].map(async ([userId, subs]) => {
    try {
      const row = await asUser(userId, async (c) =>
        (await c.query(`select * from public."${msg.t}" where id = $1`, [msg.row.id])).rows[0] as Record<string, unknown> | undefined);
      if (!row) return;
      for (const s of subs) s.send({ table: msg.t, eventType: msg.op, new: row, old: { id: msg.row.id } });
    } catch {
      // o eroare pentru un abonat nu îi afectează pe ceilalți
    }
  }));
}

function ensureListener() {
  hub.listener ??= (async () => {
    const client = await pool().connect();
    client.on("notification", (n) => {
      if (n.channel === "optifleet_changes" && n.payload) void deliver(n.payload);
    });
    const reset = () => {
      hub.listener = null;
      client.release(true);
    };
    client.on("error", reset);
    client.on("end", reset);
    await client.query("listen optifleet_changes");
    return client as unknown as Client;
  })().catch((err) => {
    hub.listener = null;
    throw err;
  });
  return hub.listener;
}

export async function subscribe(userId: string, tables: string[], send: Subscriber["send"]): Promise<() => void> {
  await ensureListener();
  const sub: Subscriber = { userId, tables: new Set(tables.filter((t) => TABLES.has(t))), send };
  hub.subscribers.add(sub);
  return () => {
    hub.subscribers.delete(sub);
  };
}
