"use client";

import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import { useAdmin } from "@/hooks/use-admin";
import { DigitalContract } from "@/lib/api-client";

export default function ContractsPage() {
  const { contracts, acceptContract, isLoading } = useAdmin();
  const [selectedContract, setSelectedContract] = useState<DigitalContract | null>(null);
  const [signing, setSigning] = useState(false);
  const [signerName, setSignerName] = useState("Vasile Cojocaru (Administrator)");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const active = selectedContract || contracts[0];

  const handleSign = async () => {
    if (!active || active.status === "ACCEPTED") return;
    setSigning(true);
    try {
      const updated = await acceptContract(active.id, signerName);
      setSelectedContract(updated);
      setToastMsg("Contractul a fost semnat digital cu succes și securizat cu hash SHA-256.");
      setTimeout(() => setToastMsg(null), 5000);
    } catch {
      setToastMsg("Eroare la semnarea contractului.");
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/contracts" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-5">
        {/* Header Minimalist */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Contracte B2B Digitale (Amprentă SHA-256)</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Conform Codului Civil al RM & Codului Transporturilor Rutiere nr. 150/2014 · Imutabilitate criptografică
            </p>
          </div>
          <button onClick={() => window.print()} className="btn-secondary text-xs">
            Printează / Salvează PDF
          </button>
        </div>

        {toastMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>✓ {toastMsg}</span>
            <button onClick={() => setToastMsg(null)} className="text-emerald-600 font-bold">✕</button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-5 items-start">
          {/* Lista Contracte Stânga (4 Coloane) */}
          <div className="col-span-4 bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider px-2 py-1">
              Contracte Generate ({contracts.length})
            </div>

            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Se încarcă contractele...</div>
            ) : (
              contracts.map((ctr) => {
                const isSelected = active?.id === ctr.id;
                return (
                  <div
                    key={ctr.id}
                    onClick={() => setSelectedContract(ctr)}
                    className={`p-3 rounded-md border text-xs cursor-pointer transition-colors ${
                      isSelected ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{ctr.contract_number}</span>
                      {ctr.status === "ACCEPTED" ? (
                        <span className="badge-green">Semnat</span>
                      ) : (
                        <span className="badge-amber">În așteptare</span>
                      )}
                    </div>
                    <div className="text-slate-600 font-medium">{ctr.corridor}</div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                      <span>Valoare: <strong>{ctr.total_price_mdl.toLocaleString()} MDL</strong></span>
                      <span className="font-mono">{ctr.created_at.slice(0, 10)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Vizualizare Document Contract Dreapta (8 Coloane) */}
          {active && (
            <div className="col-span-8 bg-white border border-slate-200 rounded-lg p-6 shadow-xs text-slate-800 space-y-4">
              {/* Antet Contract */}
              <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-bold text-blue-600">Contract Digital de Transport Rutier B2B</div>
                  <h2 className="text-lg font-bold text-slate-900">{active.contract_number}</h2>
                  <div className="text-xs text-slate-500">
                    Versiune Termeni: <strong>v2.4/2026</strong> · Legislația Republicii Moldova
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Valoare Contractuală:</div>
                  <div className="text-lg font-bold text-blue-600">{active.total_price_mdl.toLocaleString()} MDL</div>
                </div>
              </div>

              {/* Amprentă Criptografică SHA-256 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono">
                <div className="text-[11px] text-slate-500 font-sans font-medium mb-0.5">
                  Amprentă Criptografică Document (SHA-256 Non-Repudiere):
                </div>
                <div className="text-blue-700 font-bold break-all">{active.content_hash}</div>
              </div>

              {/* Părți Contractuale */}
              <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-100 pb-4">
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">TRANSPORTATOR (CĂRĂUȘ):</span>
                  <div className="font-semibold text-slate-900">{active.carrier_company_name}</div>
                  <div className="text-slate-500">IDNO: {active.carrier_idno}</div>
                  <div className="text-slate-500">Decontare: <strong>{(active.total_price_mdl * 0.94).toLocaleString()} MDL (94%)</strong></div>
                </div>

                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">BENEFICIAR (EXPEDITOR):</span>
                  <div className="font-semibold text-slate-900">{active.sme_company_name}</div>
                  <div className="text-slate-500">IDNO: {active.sme_idno}</div>
                  <div className="text-slate-500">Comision Platformă: <strong>{(active.total_price_mdl * 0.06).toLocaleString()} MDL (6%)</strong></div>
                </div>
              </div>

              {/* Clauze Legale */}
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  <strong>Art. 1 (Obiectul Contractului):</strong> Cărăușul se obligă să transporte mărfurile consolidate conform rutei <strong>{active.corridor}</strong>, respectând graficul de livrare și condițiile de integritate fizică conform Codului Transporturilor Rutiere nr. 150/2014.
                </p>
                <p>
                  <strong>Art. 2 (Răspundere & Asigurare):</strong> Marfa este asigurată conform Convenției CMR. În caz de pierdere sau avariere, transportatorul răspunde conform limitelor legale în vigoare în Republica Moldova.
                </p>
                <p>
                  <strong>Art. 3 (Validitate Electronică):</strong> Părțile recunosc valabilitatea juridică deplină a prezentului contract acceptat electronic conform Art. 1014-1017 din Codul Civil al RM.
                </p>
              </div>

              {/* Zonă Semnare / Acceptare */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                {active.status === "ACCEPTED" ? (
                  <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 w-full flex items-center justify-between">
                    <div>
                      <span className="font-bold">✓ Semnat Digital la:</span> {active.accepted_at ?? "2026-09-11 14:30"}
                      <div className="text-[11px] text-emerald-700">Semnatar: {active.accepted_by ?? "Vasile Cojocaru"} (IP: 185.108.128.45)</div>
                    </div>
                    <span className="badge-green font-bold">Valid & Executoriu</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600">Semnatar:</label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="input-clean text-xs py-1 w-64"
                      />
                    </div>
                    <button
                      onClick={handleSign}
                      disabled={signing}
                      className="btn-primary text-xs"
                    >
                      {signing ? "Se semnează..." : "Semnează Digital Contractul"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
