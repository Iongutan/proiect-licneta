import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BOOKING_STATUS } from "@/lib/booking-status";
import type { Booking } from "@/lib/db-types";
import { districtName } from "@/lib/districts";
import { fmtDateTime, fmtMdl } from "@/lib/format";
import { getViewer, dbServer } from "@/lib/db-server";

export const metadata: Metadata = { title: "Contracte" };


export default async function BookingsPage() {
  const viewer = await getViewer();
  const me = viewer?.company?.id;
  if (!me) redirect("/account");

  const db = await dbServer();
  const { data } = await db.from("bookings").select("*").order("updated_at", { ascending: false }).limit(300);
  const bookings = (data ?? []) as Booking[];
  const partyIds = [...new Set(bookings.flatMap((b) => [b.shipper_company_id, b.carrier_company_id]))];
  const vehicleIds = [...new Set(bookings.map((b) => b.vehicle_id))];
  const [{ data: companies }, { data: vehicles }] = await Promise.all([
    db.from("companies").select("id, name").in("id", partyIds.length ? partyIds : ["00000000-0000-0000-0000-000000000000"]),
    db.from("vehicles").select("id, plate").in("id", vehicleIds.length ? vehicleIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const name = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const plate = new Map((vehicles ?? []).map((v) => [v.id, v.plate]));

  const active = bookings.filter((b) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(b.status));
  const closed = bookings.filter((b) => ["DELIVERED", "CANCELLED", "REJECTED"].includes(b.status));

  const table = (rows: Booking[]) => (
    <table className="table">
      <thead><tr><th>Partener</th><th>Traseu</th><th>Vehicul</th><th>Paleți</th><th>Preț</th><th>Stare</th><th>Actualizat</th></tr></thead>
      <tbody>
        {rows.map((b) => {
          const iAmShipper = b.shipper_company_id === me;
          const waitingForMe = b.status === "NEGOTIATING" && b.price_proposed_by && b.price_proposed_by !== (iAmShipper ? "SHIPPER" : "CARRIER");
          return (
            <tr key={b.id}>
              <td>
                <Link href={`/bookings/${b.id}`} className="font-medium text-accent hover:underline">
                  {name.get(iAmShipper ? b.carrier_company_id : b.shipper_company_id) ?? "—"}
                </Link>
                <div className="t-small">{iAmShipper ? "transportator" : "expeditor"}</div>
              </td>
              <td>{districtName(b.pickup_district_id)} → {districtName(b.dropoff_district_id)}</td>
              <td><span className="kbd-plate">{plate.get(b.vehicle_id) ?? "—"}</span></td>
              <td className="t-num">{b.pallets}</td>
              <td className="t-num">{fmtMdl(b.price_mdl)}</td>
              <td>
                <span className={`badge ${BOOKING_STATUS[b.status].c}`}>{BOOKING_STATUS[b.status].t}</span>
                {waitingForMe && <div className="mt-1 text-xs text-warn">Așteaptă răspunsul tău</div>}
              </td>
              <td className="text-xs">{fmtDateTime(b.updated_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <header>
        <h1 className="t-title">Contracte</h1>
        <p className="t-small">Negocieri, contracte și livrări. Fiecare pas e înregistrat în jurnalul de audit.</p>
      </header>
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 t-subtitle">Active</h2>
        {active.length ? table(active) : <p className="p-4 t-small">Nicio rezervare activă. Caută un vehicul pe hartă sau răspunde unei cereri din bursă.</p>}
      </section>
      {closed.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 t-subtitle">Încheiate</h2>
          {table(closed)}
        </section>
      )}
    </main>
  );
}
