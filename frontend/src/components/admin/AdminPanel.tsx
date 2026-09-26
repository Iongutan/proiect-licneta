"use client";

// Panoul administratorului platformei: verificarea firmelor (KYC), jurnalul de
// audit și reîmprospătarea curselor demo. Toate acțiunile sunt verificate și
// în baza de date (is_platform_admin()), nu doar ascunse în interfață.

import { useEffect, useState } from "react";
import type { Company, KycStatus } from "@/lib/db-types";
import { districtName } from "@/lib/districts";
import { fmtDateTime } from "@/lib/format";
import { displayCompanyName, formatIdno } from "@/lib/idno-validator";
import { errorMessage, supabaseBrowser } from "@/lib/supabase";

interface AuditRow { id: number; action: string; entity: string; entity_id: string | null; company_id: string | null; created_at: string; details: Record<string, unknown> }

export default function AdminPanel() {
  const [filter, setFilter] = useState<KycStatus>("PENDING");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true;
    const supabase = supabaseBrowser();
    Promise.all([
      supabase.from("companies").select("*").eq("kyc_status", filter).order("created_at", { ascending: false }).limit(200),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("companies").select("id, name").limit(5000),
    ]).then(([{ data: cs, error }, { data: a }, { data: all }]) => {
      if (!active) return;
      if (error) return setStatus({ kind: "error", text: errorMessage(error) });
      setCompanies((cs ?? []) as Company[]);
      setAudit((a ?? []) as AuditRow[]);
      setNames(Object.fromEntries((all ?? []).map((c) => [c.id, c.name])));
    });
    return () => {
      active = false;
    };
  }, [filter, version]);

  const review = async (c: Company, next: KycStatus) => {
    const note = next === "REJECTED" ? prompt(`Motivul respingerii pentru ${c.name}:`) : null;
    if (next === "REJECTED" && !note) return;
    const { error } = await supabaseBrowser().rpc("review_company", { p_company: c.id, p_status: next, p_note: note });
    if (error) setStatus({ kind: "error", text: errorMessage(error) });
    else {
      setStatus({ kind: "info", text: `${c.name}: ${next === "VERIFIED" ? "verificată" : "respinsă"}.` });
      load();
    }
  };

  const refreshDemo = async () => {
    const { data, error } = await supabaseBrowser().rpc("refresh_demo_trips");
    setStatus(error ? { kind: "error", text: errorMessage(error) } : { kind: "info", text: `${data} curse demo mutate la ora curentă.` });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="t-title">Administrare</h1>
          <p className="t-small">Verificarea firmelor și jurnalul de audit al platformei.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={refreshDemo}>Reîmprospătează cursele demo</button>
      </header>
      {status && <div className={`alert ${status.kind === "error" ? "alert-error" : "alert-info"}`}>{status.text}</div>}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="t-subtitle">Firme</h2>
          <select className="select w-44" value={filter} onChange={(e) => setFilter(e.target.value as KycStatus)} aria-label="Filtru KYC">
            <option value="PENDING">În verificare</option>
            <option value="VERIFIED">Verificate</option>
            <option value="REJECTED">Respinse</option>
          </select>
        </div>
        {companies.length === 0 ? <p className="p-4 t-small">Nicio firmă în această stare.</p> : (
          <table className="table">
            <thead><tr><th>Firmă</th><th>IDNO</th><th>Tip</th><th>Raion</th><th>Înregistrată</th><th /></tr></thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{displayCompanyName(c.name, c.legal_form)}{c.is_demo && <span className="badge ml-2">demo</span>}</td>
                  <td className="t-num">{formatIdno(c.idno)}</td>
                  <td>{c.kind}</td>
                  <td>{districtName(c.district_id)}</td>
                  <td className="text-xs">{fmtDateTime(c.created_at)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.kyc_status !== "VERIFIED" && <button type="button" className="btn btn-primary btn-sm" onClick={() => review(c, "VERIFIED")}>Verifică</button>}
                      {c.kyc_status !== "REJECTED" && <button type="button" className="btn btn-danger btn-sm" onClick={() => review(c, "REJECTED")}>Respinge</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 t-subtitle">Jurnal de audit (ultimele 100)</h2>
        <table className="table">
          <thead><tr><th>Când</th><th>Acțiune</th><th>Firmă</th><th>Obiect</th><th>Detalii</th></tr></thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(a.created_at)}</td>
                <td className="font-mono text-xs">{a.action}</td>
                <td className="text-xs">{a.company_id ? names[a.company_id] ?? a.company_id.slice(0, 8) : "—"}</td>
                <td className="text-xs">{a.entity} {a.entity_id?.slice(0, 8)}</td>
                <td className="max-w-xs truncate font-mono text-[11px] text-muted" title={JSON.stringify(a.details)}>{JSON.stringify(a.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
