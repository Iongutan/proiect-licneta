"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Company } from "@/lib/db-types";
import { DISTRICTS, districtById } from "@/lib/districts";
import { fmtDateTime } from "@/lib/format";
import { LEGAL_FORMS, displayCompanyName, formatIdno } from "@/lib/idno-validator";
import { errorMessage, dbBrowser } from "@/lib/db-browser";

const KYC = {
  PENDING: { t: "În verificare", c: "badge-warn", hint: "Un administrator verifică IDNO-ul în Registrul de stat. Până atunci poți explora harta și posta cereri, dar nu poți rezerva sau semna contracte." },
  VERIFIED: { t: "Verificată", c: "badge-ok", hint: "Datele legale de mai jos se completează automat în contractele generate de platformă." },
  REJECTED: { t: "Respinsă", c: "badge-danger", hint: "Corectează datele și contactează administratorul pentru o nouă verificare." },
} as const;

const KIND = { SHIPPER: "Expeditor (fără flotă)", CARRIER: "Transportator", BOTH: "Expeditor și transportator" } as const;

export default function AccountForm({ company, userId, fullName, email, isCompanyAdmin }: { company: Company; userId: string; fullName: string; email: string | null; isCompanyAdmin: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(company.name);
  const [address, setAddress] = useState(company.address ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const [district, setDistrict] = useState(company.district_id ?? "");
  const [person, setPerson] = useState(fullName);
  const [status, setStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const kyc = KYC[company.kyc_status];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setStatus({ kind: "error", text: "Denumirea firmei e prea scurtă." });
    if (phone && !/^\+?[0-9 ()-]{6,20}$/.test(phone)) return setStatus({ kind: "error", text: "Telefon invalid." });
    setPending(true);
    const db = dbBrowser();
    const d = districtById(district);
    const results = await Promise.all([
      isCompanyAdmin
        ? db.from("companies").update({
            name: name.trim(), address: address.trim() || null, phone: phone.trim() || null, district_id: d?.id ?? null,
            location: d ? `SRID=4326;POINT(${d.lon} ${d.lat})` : null,
          }).eq("id", company.id)
        : Promise.resolve({ error: null }),
      db.from("profiles").update({ full_name: person.trim() || null }).eq("id", userId),
    ]);
    setPending(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return setStatus({ kind: "error", text: errorMessage(err) });
    setStatus({ kind: "info", text: "Salvat." });
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-6 py-6">
      <header>
        <h1 className="t-title">{displayCompanyName(company.name, company.legal_form)}</h1>
        <p className="t-small">{KIND[company.kind]} · înregistrată {fmtDateTime(company.created_at)}</p>
      </header>

      <section className="card p-4">
        <div className="flex items-center gap-2"><span className="t-label">Verificare firmă (KYC)</span><span className={`badge ${kyc.c}`}>{kyc.t}</span></div>
        <p className="t-small mt-1">{kyc.hint}</p>
        {company.kyc_note && <p className="mt-2 text-[13px]">Notă administrator: {company.kyc_note}</p>}
      </section>

      <section className="card p-4">
        <h2 className="t-subtitle mb-3">Profil legal</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-muted">IDNO</dt><dd className="t-num">{formatIdno(company.idno)}</dd>
          <dt className="text-muted">Formă juridică</dt><dd>{LEGAL_FORMS.find((f) => f.id === company.legal_form)?.label}</dd>
        </dl>
        <p className="t-small mt-2">IDNO-ul și forma juridică nu se pot schimba după verificare; pentru corecturi contactează administratorul.</p>
      </section>

      <form onSubmit={save} className="card space-y-3 p-4">
        <h2 className="t-subtitle">Date de contact</h2>
        {status && <div className={`alert ${status.kind === "error" ? "alert-error" : "alert-info"}`}>{status.text}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field"><span className="t-label">Denumirea firmei</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!isCompanyAdmin} maxLength={160} />
          </label>
          <label className="field"><span className="t-label">Raionul sediului</span>
            <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!isCompanyAdmin}>
              <option value="">—</option>
              {[...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro")).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field sm:col-span-2"><span className="t-label">Adresă</span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isCompanyAdmin} maxLength={300} />
          </label>
          <label className="field"><span className="t-label">Telefon</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isCompanyAdmin} placeholder="+373 22 000 000" />
          </label>
          <label className="field"><span className="t-label">Numele tău</span>
            <input className="input" value={person} onChange={(e) => setPerson(e.target.value)} maxLength={120} />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <span className="t-small">Autentificat ca {email}</span>
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Se salvează…" : "Salvează"}</button>
        </div>
      </form>
    </main>
  );
}
