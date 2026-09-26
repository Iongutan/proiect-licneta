"use client";

import { ArrowLeft, Camera, Printer } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BOOKING_STATUS } from "@/lib/booking-status";
import type { Booking, BookingMessage, Company, DeliveryProof, Side } from "@/lib/db-types";
import { districtName } from "@/lib/districts";
import { fmtDateTime, fmtKg, fmtMdl } from "@/lib/format";
import { displayCompanyName, formatIdno } from "@/lib/idno-validator";
import { errorMessage, dbBrowser } from "@/lib/db-browser";

interface AuditRow { id: number; action: string; created_at: string; details: Record<string, unknown> }
interface VehicleInfo { id: string; plate: string; make_model: string }
interface DriverInfo { driver_name: string | null; driver_phone: string | null }

const AUDIT_LABEL: Record<string, string> = {
  BOOKING_PROPOSED: "Cerere / ofertă creată",
  PRICE_ACCEPTED: "Preț acceptat",
  PATH_PLATFORM_CONTRACT_GENERATED: "Contract generat prin platformă",
  PATH_DIRECT_DISCLAIMER_ACCEPTED: "Aleasă înțelegerea directă — exonerare acceptată",
  CONTRACT_SIGNED: "Contract semnat electronic",
  DIRECT_CONFIRMED: "Înțelegere directă confirmată (exonerare acceptată)",
  TRANSIT_STARTED: "Cursă pornită",
  DELIVERY_PROOF_UPLOADED: "Dovadă foto încărcată",
  DELIVERY_CONFIRMED: "Livrare confirmată",
  BOOKING_CANCELLED: "Rezervare anulată",
};

interface BookingBundle {
  booking: Booking | null;
  parties: Record<string, Company>;
  vehicle: VehicleInfo | null;
  driver: DriverInfo | null;
  messages: BookingMessage[];
  proofs: DeliveryProof[];
  audit: AuditRow[];
}

async function fetchBooking(bookingId: string): Promise<BookingBundle | { error: string }> {
  const db = dbBrowser();
  const { data, error } = await db.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error) return { error: errorMessage(error) };
  const empty = { parties: {}, vehicle: null, driver: null, messages: [], proofs: [], audit: [] };
  if (!data) return { booking: null, ...empty };
  const [{ data: cs }, { data: v }, { data: d }, { data: m }, { data: p }, { data: a }] = await Promise.all([
    db.from("companies").select("*").in("id", [data.shipper_company_id, data.carrier_company_id]),
    db.from("vehicles").select("id, plate, make_model").eq("id", data.vehicle_id).maybeSingle(),
    db.from("vehicle_private").select("driver_name, driver_phone").eq("vehicle_id", data.vehicle_id).maybeSingle(),
    db.from("booking_messages").select("*").eq("booking_id", bookingId).order("created_at"),
    db.from("delivery_proofs").select("*").eq("booking_id", bookingId).order("created_at"),
    db.from("audit_log").select("id, action, created_at, details").eq("entity", "booking").eq("entity_id", bookingId).order("created_at"),
  ]);
  return {
    booking: data as Booking,
    parties: Object.fromEntries(((cs ?? []) as Company[]).map((c) => [c.id, c])),
    vehicle: v as VehicleInfo | null,
    driver: d as DriverInfo | null,
    messages: (m ?? []) as BookingMessage[],
    proofs: (p ?? []) as DeliveryProof[],
    audit: (a ?? []) as AuditRow[],
  };
}

export default function BookingDetail({ bookingId, companyId }: { bookingId: string; companyId: string }) {
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [parties, setParties] = useState<Record<string, Company>>({});
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [proofs, setProofs] = useState<DeliveryProof[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    fetchBooking(bookingId).then((res) => {
      if (!active) return;
      if ("error" in res) return setError(res.error);
      setB(res.booking);
      if (!res.booking) return;
      setParties(res.parties);
      setVehicle(res.vehicle);
      setDriver(res.driver);
      setMessages(res.messages);
      setProofs(res.proofs);
      setAudit(res.audit);
    });
    return () => {
      active = false;
    };
  }, [bookingId, version]);

  useEffect(() => {
    const db = dbBrowser();
    const channel = db
      .channel(`booking:${bookingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => setMessages((prev) => prev.some((x) => x.id === (payload.new as BookingMessage).id) ? prev : [...prev, payload.new as BookingMessage]))
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [bookingId, load]);

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const { error: e } = await dbBrowser().rpc(fn, args);
    setBusy(false);
    if (e) {
      setError(errorMessage(e));
      return false;
    }
    load();
    return true;
  };

  if (b === undefined) return <main className="px-6 py-6 t-small">Se încarcă…</main>;
  if (b === null) return <main className="px-6 py-6"><div className="alert alert-error">Rezervarea nu există sau nu ai acces la ea.</div></main>;

  const side: Side = b.shipper_company_id === companyId ? "SHIPPER" : "CARRIER";
  const other = side === "SHIPPER" ? parties[b.carrier_company_id] : parties[b.shipper_company_id];
  const mySigned = side === "SHIPPER" ? b.shipper_signed_at : b.carrier_signed_at;
  const otherSigned = side === "SHIPPER" ? b.carrier_signed_at : b.shipper_signed_at;
  const myDelivered = side === "SHIPPER" ? b.shipper_delivery_confirmed_at : b.carrier_delivery_confirmed_at;
  const canNegotiate = b.status === "NEGOTIATING" || b.status === "AGREED";

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div>
          <Link href="/bookings" className="btn btn-ghost btn-sm -ml-2 mb-1"><ArrowLeft className="h-4 w-4" /> Contracte</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-title">{districtName(b.pickup_district_id)} → {districtName(b.dropoff_district_id)}</h1>
            <span className={`badge ${BOOKING_STATUS[b.status].c}`}>{BOOKING_STATUS[b.status].t}</span>
          </div>
          <p className="t-small mt-1">
            {b.pallets} paleți · {fmtKg(b.weight_kg)} · {vehicle ? `${vehicle.plate}, ${vehicle.make_model}` : "vehicul"} · cu {other?.name ?? "partenerul"}
            {b.pickup_at ? ` · preluare ${fmtDateTime(b.pickup_at)}` : ""}
          </p>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <Steps status={b.status} />

        {/* Preț */}
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="t-label">Preț</div>
              <div className="t-num text-xl font-semibold">{fmtMdl(b.price_mdl)}</div>
              {b.price_proposed_by && <div className="t-small">propus de {b.price_proposed_by === side ? "tine" : "partener"}</div>}
            </div>
            {b.status === "NEGOTIATING" && b.price_mdl !== null && b.price_proposed_by && b.price_proposed_by !== side && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => rpc("accept_price", { p_booking: b.id })}>Accept prețul</button>
            )}
          </div>
        </section>

        {b.status === "AGREED" && <PathChooser booking={b} busy={busy} rpc={rpc} />}

        {b.path === "PLATFORM" && b.contract_snapshot && (
          <ContractDocument booking={b} mySigned={mySigned} otherSigned={otherSigned} busy={busy}
            onSign={() => rpc("sign_booking", { p_booking: b.id, p_disclaimer_accepted: false })} />
        )}

        {b.path === "DIRECT" && (
          <section className="card space-y-2 p-4">
            <h2 className="t-subtitle">Înțelegere directă (fără mediere)</h2>
            <div className="alert alert-warn">Platforma NU își asumă răspunderea pentru marfa transportată prin această înțelegere.</div>
            <p className="text-[13px]">Tu: {mySigned ? `ai confirmat la ${fmtDateTime(mySigned)}` : "nu ai confirmat încă"} · Partenerul: {otherSigned ? `a confirmat la ${fmtDateTime(otherSigned)}` : "nu a confirmat încă"}</p>
            {b.status === "AGREED" && !mySigned && <DirectConfirm busy={busy} onConfirm={() => rpc("sign_booking", { p_booking: b.id, p_disclaimer_accepted: true })} />}
          </section>
        )}

        {["CONTRACTED", "IN_TRANSIT", "DELIVERED"].includes(b.status) && (
          <DeliverySection booking={b} side={side} proofs={proofs} driver={driver} busy={busy} rpc={rpc} setError={setError} myDelivered={myDelivered} />
        )}

        {["NEGOTIATING", "AGREED", "CONTRACTED"].includes(b.status) && (
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => {
            const reason = prompt("Motivul anulării (opțional):") ?? undefined;
            if (reason !== undefined) rpc("cancel_booking", { p_booking: b.id, p_reason: reason || null });
          }}>
            {b.status === "NEGOTIATING" && b.initiated_by !== side ? "Refuză" : "Anulează rezervarea"}
          </button>
        )}
      </div>

      <aside className="space-y-5">
        <Thread booking={b} companyId={companyId} messages={messages} parties={parties} canNegotiate={canNegotiate} onError={setError} />
        <section className="card p-4">
          <h2 className="t-label mb-2">Jurnal (firma ta)</h2>
          <ol className="space-y-2 text-xs">
            {audit.length === 0 && <li className="t-small">—</li>}
            {audit.map((a) => (
              <li key={a.id}><div className="text-ink">{AUDIT_LABEL[a.action] ?? a.action}</div><div className="t-small">{fmtDateTime(a.created_at)}</div></li>
            ))}
          </ol>
        </section>
      </aside>
    </main>
  );
}

function Steps({ status }: { status: Booking["status"] }) {
  const steps = ["NEGOTIATING", "AGREED", "CONTRACTED", "IN_TRANSIT", "DELIVERED"] as const;
  const idx = steps.indexOf(status as (typeof steps)[number]);
  if (idx < 0) return null;
  return (
    <ol className="flex gap-1" aria-label="Etape">
      {steps.map((s, i) => (
        <li key={s} className="flex-1">
          <div className={`h-1 rounded ${i <= idx ? "bg-accent" : "bg-line"}`} />
          <div className={`mt-1 text-[11px] ${i === idx ? "font-semibold text-ink" : "text-muted"}`}>{BOOKING_STATUS[s].t}</div>
        </li>
      ))}
    </ol>
  );
}

// ─── K9: alegerea căii ────────────────────────────────────────────────────
function PathChooser({ booking, busy, rpc }: { booking: Booking; busy: boolean; rpc: (fn: string, a: Record<string, unknown>) => Promise<boolean> }) {
  const [warnOpen, setWarnOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  return (
    <section className="card p-4">
      <h2 className="t-subtitle">Cum finalizați înțelegerea?</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className={`rounded-md border p-3 ${booking.path === "PLATFORM" ? "border-accent bg-accent-soft" : "border-line"}`}>
          <div className="text-[13px] font-semibold">A. Contract prin platformă</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-2">
            <li>Contract generat din datele legale ale firmelor (IDNO, formă juridică)</li>
            <li>Semnătură electronică: amprentă SHA-256 + ora + utilizatorul</li>
            <li>Expeditorul vede GPS-ul pe toată cursa</li>
            <li>Livrare finalizată doar cu confirmarea ambelor părți și poză</li>
          </ul>
          <button type="button" className="btn btn-primary btn-sm mt-3" disabled={busy} onClick={() => rpc("choose_contract_path", { p_booking: booking.id, p_path: "PLATFORM" })}>
            {booking.path === "PLATFORM" ? "Regenerează contractul" : "Alege calea A"}
          </button>
        </div>
        <div className={`rounded-md border p-3 ${booking.path === "DIRECT" ? "border-accent bg-accent-soft" : "border-line"}`}>
          <div className="text-[13px] font-semibold">B. Înțelegere directă, fără mediere</div>
          <p className="mt-1 text-xs text-ink-2">Firmele se înțeleg între ele. Platforma doar rezervă locurile și nu răspunde de marfă.</p>
          <button type="button" className="btn btn-secondary btn-sm mt-3" disabled={busy} onClick={() => { setChecked(false); setWarnOpen(true); }}>Alege calea B</button>
        </div>
      </div>

      {warnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="warn-title">
          <div className="card w-full max-w-md space-y-4 p-5 shadow-xl">
            <h3 id="warn-title" className="t-subtitle">Atenție — înțelegere directă</h3>
            <p className="text-[14px] font-medium text-danger">Platforma NU își asumă răspunderea pentru marfa transportată prin această înțelegere directă.</p>
            <p className="t-small">Nu se generează contract semnat prin platformă, iar dovada livrării nu e obligatorie. Alegerea ta se salvează în jurnalul de audit, cu ora exactă.</p>
            <label className="flex gap-2 text-[13px]">
              <input type="checkbox" className="mt-0.5 accent-[var(--color-accent)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              Confirm că înțeleg și accept acest lucru.
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setWarnOpen(false)}>Renunță</button>
              <button type="button" className="btn btn-primary" disabled={!checked || busy} onClick={async () => {
                if (await rpc("choose_contract_path", { p_booking: booking.id, p_path: "DIRECT", p_disclaimer_accepted: true })) setWarnOpen(false);
              }}>Accept și continui</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DirectConfirm({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-2">
      <label className="flex gap-2 text-[13px]">
        <input type="checkbox" className="mt-0.5 accent-[var(--color-accent)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        Confirm că înțeleg că platforma NU își asumă răspunderea pentru marfă și accept înțelegerea directă.
      </label>
      <button type="button" className="btn btn-primary" disabled={!checked || busy} onClick={onConfirm}>Confirm înțelegerea</button>
    </div>
  );
}

// ─── K9/K12: contractul generat ───────────────────────────────────────────
function ContractDocument({ booking, mySigned, otherSigned, busy, onSign }: {
  booking: Booking; mySigned: string | null; otherSigned: string | null; busy: boolean; onSign: () => void;
}) {
  const c = booking.contract_snapshot!;
  const party = (label: string, p: typeof c.shipper) => (
    <div>
      <div className="t-label">{label}</div>
      <div className="text-[13px] font-medium">{displayCompanyName(p.name, p.legal_form)}</div>
      <div className="t-small">IDNO {formatIdno(p.idno)}{p.address ? ` · ${p.address}` : ""}</div>
    </div>
  );
  return (
    <section className="card p-5 print:border-0" id="contract">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="t-subtitle">Contract de transport rutier de mărfuri</h2>
          <p className="t-small">{c.template} · emis {fmtDateTime(c.issued_at)}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" /> PDF</button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {party("Expeditor", c.shipper)}
        {party("Transportator", c.carrier)}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] md:grid-cols-4">
        <dt className="text-muted">Traseu</dt><dd>{districtName(c.route.pickup)} → {districtName(c.route.dropoff)}</dd>
        <dt className="text-muted">Vehicul</dt><dd>{c.vehicle.plate}, {c.vehicle.make_model}</dd>
        <dt className="text-muted">Marfă</dt><dd>{c.cargo.pallets} paleți, {fmtKg(c.cargo.weight_kg)}</dd>
        <dt className="text-muted">Preț</dt><dd className="font-semibold">{fmtMdl(c.price_mdl)}</dd>
      </dl>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
        {c.clauses.map((cl) => <li key={cl}>{cl}</li>)}
      </ol>
      <div className="mt-4 rounded-md bg-canvas p-3">
        <div className="t-label">Amprentă SHA-256 a contractului</div>
        <code className="mt-1 block break-all font-mono text-[11px] text-ink">{booking.contract_hash}</code>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Signature label="Expeditor" at={booking.shipper_signed_at} />
        <Signature label="Transportator" at={booking.carrier_signed_at} />
      </div>
      {booking.status === "AGREED" && !mySigned && (
        <div className="mt-4 flex items-center justify-between gap-3 print:hidden">
          <p className="t-small">Semnând, confirmi conținutul de mai sus; semnătura se leagă de amprenta SHA-256.{otherSigned ? " Partenerul a semnat deja." : ""}</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onSign}>Semnează</button>
        </div>
      )}
    </section>
  );
}

function Signature({ label, at }: { label: string; at: string | null }) {
  return (
    <div className={`rounded-md border p-3 ${at ? "border-[#bbf7d0] bg-ok-soft" : "border-dashed border-line"}`}>
      <div className="t-label">{label}</div>
      <div className="text-[13px]">{at ? `Semnat electronic la ${fmtDateTime(at)}` : "Nesemnat"}</div>
    </div>
  );
}

// ─── Livrare: pornire cursă, dovadă foto (K11), confirmare ────────────────
function DeliverySection({ booking, side, proofs, driver, busy, rpc, setError, myDelivered }: {
  booking: Booking; side: Side; proofs: DeliveryProof[]; driver: DriverInfo | null; busy: boolean;
  rpc: (fn: string, a: Record<string, unknown>) => Promise<boolean>; setError: (e: string | null) => void; myDelivered: string | null;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const db = dbBrowser();
    Promise.all(proofs.map(async (p) => {
      const { data } = await db.storage.from("delivery-proofs").createSignedUrl(p.storage_path, 300);
      return [p.id, data?.signedUrl ?? ""] as const;
    })).then((pairs) => setUrls(Object.fromEntries(pairs)));
  }, [proofs]);

  const upload = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError("Fotografia trebuie să fie JPG, PNG sau WebP.");
    if (file.size > 8 * 1024 * 1024) return setError("Fotografia depășește 8 MB.");
    setUploading(true);
    setError(null);
    const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), () => resolve(null), { enableHighAccuracy: true, timeout: 8000 });
    });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${booking.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await dbBrowser().storage.from("delivery-proofs").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setUploading(false);
      return setError(errorMessage(upErr));
    }
    await rpc("record_delivery_proof", {
      p_booking: booking.id, p_storage_path: path, p_lat: coords?.latitude ?? null, p_lon: coords?.longitude ?? null,
      p_taken_at: new Date().toISOString(),
    });
    setUploading(false);
  };

  return (
    <section className="card space-y-4 p-4">
      <h2 className="t-subtitle">Cursă și livrare</h2>

      {side === "SHIPPER" && driver && (driver.driver_name || driver.driver_phone) && (
        <p className="text-[13px]">Șofer: {driver.driver_name ?? "—"} {driver.driver_phone && <a className="text-accent hover:underline" href={`tel:${driver.driver_phone.replace(/[^+\d]/g, "")}`}>{driver.driver_phone}</a>}</p>
      )}
      {booking.status !== "DELIVERED" && (
        <Link href={`/map?vehicle=${booking.vehicle_id}`} className="btn btn-secondary btn-sm">Vezi vehiculul pe hartă (GPS)</Link>
      )}

      {side === "CARRIER" && booking.status === "CONTRACTED" && booking.path === "PLATFORM" && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => rpc("start_transit", { p_booking: booking.id })}>Pornește cursa</button>
      )}

      <div>
        <div className="t-label mb-2">Dovadă foto la livrare</div>
        {proofs.length === 0 && <p className="t-small">{booking.path === "PLATFORM" ? "Obligatorie pentru transportator înainte de confirmare." : "Opțională pentru înțelegerea directă."}</p>}
        <div className="grid grid-cols-2 gap-3">
          {proofs.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-md border border-line">
              {urls[p.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL semnat, temporar, din bucket privat
                <img src={urls[p.id]} alt="Marfa la livrare" className="aspect-[4/3] w-full object-cover" />
              ) : <div className="aspect-[4/3] bg-canvas" />}
              <figcaption className="px-2 py-1 t-small">{fmtDateTime(p.taken_at)}{p.lat !== null ? ` · ${p.lat.toFixed(4)}, ${p.lon?.toFixed(4)}` : " · fără GPS"}</figcaption>
            </figure>
          ))}
        </div>
        {side === "CARRIER" && ["CONTRACTED", "IN_TRANSIT"].includes(booking.status) && (
          <>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <button type="button" className="btn btn-secondary mt-3" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" /> {uploading ? "Se încarcă…" : "Fotografiază marfa livrată"}
            </button>
          </>
        )}
      </div>

      {["CONTRACTED", "IN_TRANSIT"].includes(booking.status) && !(booking.path === "PLATFORM" && booking.status === "CONTRACTED") && (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="t-small">
            {myDelivered ? `Ai confirmat livrarea la ${fmtDateTime(myDelivered)}. Se așteaptă partenerul.`
              : booking.path === "PLATFORM" ? "Livrarea se închide după confirmarea ambelor părți." : "Prima confirmare închide cursa."}
          </p>
          {!myDelivered && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => rpc("confirm_delivery", { p_booking: booking.id })}>
              {side === "SHIPPER" ? "Confirm recepția" : "Confirm predarea"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ─── K8: negociere în platformă ───────────────────────────────────────────
function Thread({ booking, companyId, messages, parties, canNegotiate, onError }: {
  booking: Booking; companyId: string; messages: BookingMessage[]; parties: Record<string, Company>; canNegotiate: boolean; onError: (e: string | null) => void;
}) {
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const open = ["NEGOTIATING", "AGREED", "CONTRACTED", "IN_TRANSIT"].includes(booking.status);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    const p = price.trim() ? Number(price) : null;
    if (!text && p === null) return;
    if (p !== null && (!Number.isFinite(p) || p < 0)) return onError("Preț invalid.");
    setSending(true);
    const { error } = await dbBrowser().from("booking_messages").insert({
      booking_id: booking.id, sender_company_id: companyId, body: text || `Propun ${p} MDL`, price_mdl: p,
    });
    setSending(false);
    if (error) return onError(errorMessage(error));
    setBody("");
    setPrice("");
  };

  return (
    <section className="card flex h-[480px] flex-col">
      <h2 className="border-b border-line px-4 py-3 t-label">Negociere</h2>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <p className="t-small">Niciun mesaj. Discutați prețul și detaliile aici.</p>}
        {messages.map((m) => {
          const mine = m.sender_company_id === companyId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] ${mine ? "bg-accent text-white" : "bg-canvas text-ink"}`}>
                {m.price_mdl !== null && <div className={`mb-0.5 text-xs font-semibold ${mine ? "text-white" : "text-accent-strong"}`}>Ofertă: {fmtMdl(m.price_mdl)}</div>}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
              </div>
              <span className="mt-0.5 text-[10px] text-muted">{mine ? "Tu" : parties[m.sender_company_id]?.name ?? "Partener"} · {fmtDateTime(m.created_at)}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {open ? (
        <form onSubmit={send} className="space-y-2 border-t border-line p-3">
          <textarea className="textarea" rows={2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Scrie un mesaj…" aria-label="Mesaj" />
          <div className="flex gap-2">
            {canNegotiate && (
              <input className="input t-num" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} placeholder="Preț nou (MDL)" aria-label="Preț propus" />
            )}
            <button type="submit" className="btn btn-primary" disabled={sending}>Trimite</button>
          </div>
          {canNegotiate && price && <p className="t-small">Un preț nou redeschide negocierea și anulează contractul generat, dacă există.</p>}
        </form>
      ) : <p className="border-t border-line p-3 t-small">Conversația e închisă.</p>}
    </section>
  );
}
