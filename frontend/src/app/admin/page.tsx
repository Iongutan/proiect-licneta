"use client";

import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import { useAdmin } from "@/hooks/use-admin";
import { Invoice } from "@/lib/api-client";

export default function AdminPage() {
  const {
    kycRequests,
    invoices,
    contracts,
    auditLogs,
    financialMetrics,
    isLoading,
    error,
    reviewKyc,
    markInvoicePaid,
    refetch,
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<"KYC" | "FINANCIAL" | "CONTRACTS" | "AUDIT">("KYC");
  const [invoiceFilter, setInvoiceFilter] = useState<Invoice["status"] | "ALL">("ALL");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const filteredInvoices =
    invoiceFilter === "ALL" ? invoices : invoices.filter((i) => i.status === invoiceFilter);

  const handleApproveKyc = async (id: string) => {
    await reviewKyc(id, "VERIFIED");
    setToastMsg("Compania a fost aprobată cu succes în Registrul OptiFleet.");
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleRejectKyc = async (id: string) => {
    const reason = prompt("Introduceți motivul respingerii (ex: Extras ASP expirat sau IDNO neconform):");
    if (reason) {
      await reviewKyc(id, "REJECTED", reason);
      setToastMsg("Dosarul KYC a fost respins.");
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handlePayInvoice = async (id: string) => {
    await markInvoicePaid(id, "TRANSFER_BANCAR_IBAN");
    setToastMsg("Plata a fost confirmată și marcată ca Achitată.");
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/admin" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-5">
        {/* Header Minimalist */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Centru de Control & Administrare B2B</h1>
              <span className="badge-blue font-bold">Rol: SUPER_ADMIN</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verificare identitate juridică (SRL / Î.I. / IP), evidență financiară și jurnal de securitate auditabil
            </p>
          </div>
          <button onClick={refetch} className="btn-secondary text-xs">
            ↻ Reîmprospătează
          </button>
        </div>

        {toastMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>✓ {toastMsg}</span>
            <button onClick={() => setToastMsg(null)} className="text-emerald-600 font-bold">✕</button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* 4 Carduri KPI Financiare */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-emerald-600">
              {financialMetrics.totalCollectedMdl.toLocaleString()} MDL
            </div>
            <div className="text-xs text-slate-500 font-medium">Încasări Totale (Achitate)</div>
            <div className="text-[11px] text-slate-400 mt-1">{financialMetrics.paidCount} tranzacții finalizate</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-blue-600">
              {financialMetrics.totalCarrierPayoutsMdl.toLocaleString()} MDL
            </div>
            <div className="text-xs text-slate-500 font-medium">Decontat Cărăuși (94%)</div>
            <div className="text-[11px] text-slate-400 mt-1">Viramente bancare operate</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-slate-900">
              {financialMetrics.totalPlatformFeesMdl.toLocaleString()} MDL
            </div>
            <div className="text-xs text-slate-500 font-medium">Comision Platformă (6%)</div>
            <div className="text-[11px] text-emerald-600 mt-1 font-semibold">Venit operațional</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="text-2xl font-bold text-amber-600">
              {financialMetrics.totalOverdueMdl.toLocaleString()} MDL
            </div>
            <div className="text-xs text-slate-500 font-medium">Facturi Restante / Neachitate</div>
            <div className="text-[11px] text-red-500 mt-1 font-medium">{financialMetrics.overdueCount} companii restante</div>
          </div>
        </div>

        {/* Tab-uri Navigare */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {[
            { id: "KYC", label: `Verificare Firme KYC (${kycRequests.filter((k) => k.status === "PENDING_VERIFICATION").length} în așteptare)` },
            { id: "FINANCIAL", label: `Evidență Facturi & Încasări (${invoices.length})` },
            { id: "CONTRACTS", label: `Contracte B2B Digitale (${contracts.length})` },
            { id: "AUDIT", label: `Jurnal de Audit & Securitate (${auditLogs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white font-semibold shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: COADĂ VERIFICARE KYC */}
        {activeTab === "KYC" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Se încarcă dosarele...</div>
            ) : (
              kycRequests.map((company) => (
                <div key={company.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm text-slate-900">{company.company_name}</h3>
                        <span className="badge-blue font-mono">{company.legal_type}</span>
                        {company.status === "VERIFIED" ? (
                          <span className="badge-green">● VERIFICAT</span>
                        ) : company.status === "REJECTED" ? (
                          <span className="badge-gray text-red-600">✕ RESPINS</span>
                        ) : (
                          <span className="badge-amber">○ ÎN AȘTEPTARE</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-4">
                        <span>IDNO: <strong className="font-mono text-slate-800">{company.idno}</strong> (Modulo 11 Valid)</span>
                        <span>Sediu: {company.city}, {company.address}</span>
                        <span>Administrator: {company.admin_name} ({company.phone})</span>
                        {company.anta_license_number && (
                          <span>Licență ANTA: <strong className="text-blue-600">{company.anta_license_number}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {company.status !== "VERIFIED" && (
                        <button
                          onClick={() => handleApproveKyc(company.id)}
                          className="btn-primary text-xs py-1 px-3"
                        >
                          ✓ Aprobă Compania
                        </button>
                      )}
                      {company.status !== "REJECTED" && (
                        <button
                          onClick={() => handleRejectKyc(company.id)}
                          className="btn-secondary text-xs py-1 px-3 text-red-600 hover:text-red-700"
                        >
                          ✕ Respinge
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Documente */}
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block mb-1.5">Documente Verificate:</span>
                    <div className="flex gap-2 flex-wrap">
                      {company.documents.map((doc) => (
                        <div key={doc.id} className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-xs flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">{doc.file_name}</span>
                          <span className="text-[10px] text-slate-400">({doc.file_size_kb} KB)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: EVIDENȚĂ FACTURI & ÎNCASĂRI */}
        {activeTab === "FINANCIAL" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["ALL", "PAID", "PENDING_PAYMENT", "OVERDUE"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setInvoiceFilter(s)}
                  className={`px-3 py-1 rounded text-xs border ${
                    invoiceFilter === s
                      ? "bg-blue-600 text-white font-semibold border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s === "ALL" ? `Toate (${invoices.length})` : s}
                </button>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Nr. Factură</th>
                    <th>Debitor / Companie</th>
                    <th>Status</th>
                    <th>Valoare Brută</th>
                    <th>Comision (6%)</th>
                    <th>Decontare Transport</th>
                    <th>Scadență</th>
                    <th>Acțiune</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                      <td>
                        <div className="font-medium text-slate-900">{inv.company_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">IDNO: {inv.company_idno}</div>
                      </td>
                      <td>
                        {inv.status === "PAID" ? (
                          <span className="badge-green">Achitat</span>
                        ) : inv.status === "OVERDUE" ? (
                          <span className="badge-gray text-red-600 font-bold">Restant</span>
                        ) : (
                          <span className="badge-amber">Neachitat (Pending)</span>
                        )}
                      </td>
                      <td className="font-bold text-slate-900">{inv.total_amount_mdl.toLocaleString()} MDL</td>
                      <td className="text-blue-600 font-medium">{inv.platform_fee_mdl.toLocaleString()} MDL</td>
                      <td className="text-slate-600">{inv.carrier_payout_mdl.toLocaleString()} MDL</td>
                      <td className="text-xs text-slate-600">{inv.due_date}</td>
                      <td>
                        {inv.status !== "PAID" && (
                          <button
                            onClick={() => handlePayInvoice(inv.id)}
                            className="btn-primary text-xs py-1 px-2.5"
                          >
                            Marchează Achitat
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CONTRACTE B2B */}
        {activeTab === "CONTRACTS" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Nr. Contract</th>
                  <th>Traseu & Părți</th>
                  <th>Amprentă SHA-256 (Integritate)</th>
                  <th>Valoare Totală</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((ctr) => (
                  <tr key={ctr.id}>
                    <td className="font-mono font-bold text-slate-900">{ctr.contract_number}</td>
                    <td>
                      <div className="font-semibold text-slate-900">{ctr.corridor}</div>
                      <div className="text-xs text-slate-500">
                        Cărăuș: {ctr.carrier_company_name} ➔ Beneficiar: {ctr.sme_company_name}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                        {ctr.content_hash.slice(0, 16)}…{ctr.content_hash.slice(-8)}
                      </span>
                    </td>
                    <td className="font-bold text-blue-600">{ctr.total_price_mdl.toLocaleString()} MDL</td>
                    <td>
                      {ctr.status === "ACCEPTED" ? (
                        <span className="badge-green">Semnat Digital</span>
                      ) : (
                        <span className="badge-amber">În așteptare</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: JURNAL DE AUDIT & SECURITATE */}
        {activeTab === "AUDIT" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Eveniment / Acțiune</th>
                  <th>Actor / Email</th>
                  <th>Adresă IP</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs text-slate-600">{log.timestamp}</td>
                    <td>
                      <div className="font-semibold text-slate-900">{log.action}</div>
                      <div className="text-xs text-slate-500">{log.entity_type} #{log.entity_id}</div>
                    </td>
                    <td>
                      <div className="text-xs font-medium text-slate-800">{log.actor_email}</div>
                      <div className="text-[10px] text-slate-400">Rol: {log.actor_role}</div>
                    </td>
                    <td className="font-mono text-xs text-slate-600">{log.ip_address}</td>
                    <td>
                      {log.action.includes("BLOCKED") || log.action.includes("DENIED") ? (
                        <span className="badge-gray text-red-600 font-bold">BLOCAT</span>
                      ) : (
                        <span className="badge-green">SUCCES</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
