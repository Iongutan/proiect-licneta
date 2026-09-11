"use client";

import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import { validateMoldovaIdno } from "@/lib/idno-validator";
import { apiClient } from "@/lib/api-client";

export default function VerificationPage() {
  const [form, setForm] = useState({
    company_name: "",
    legal_type: "SRL" as "SRL" | "II" | "SA",
    idno: "",
    anta_license_number: "",
    address: "",
    city: "Chișinău",
    admin_name: "",
    phone: "",
    email: "",
    role_type: "SME" as "SME" | "CARRIER",
  });

  const [idnoError, setIdnoError] = useState<string | null>(null);
  const [idnoValid, setIdnoValid] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  interface UploadedDoc {
    name: string;
    sizeKb: number;
    previewUrl?: string;
  }

  const [uploadedFiles, setUploadedFiles] = useState<{
    asp: UploadedDoc | null;
    anta: UploadedDoc | null;
    id: UploadedDoc | null;
  }>({
    asp: null,
    anta: null,
    id: null,
  });

  const handleIdnoChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 13);
    setForm((f) => ({ ...f, idno: clean }));

    if (clean.length === 13) {
      const res = validateMoldovaIdno(clean);
      setIdnoValid(res.isValid);
      setIdnoError(res.isValid ? null : res.error ?? "IDNO invalid");
    } else if (clean.length > 0) {
      setIdnoValid(false);
      setIdnoError(`Introduceți toate cele 13 cifre (${clean.length}/13)`);
    } else {
      setIdnoValid(null);
      setIdnoError(null);
    }
  };

  const handleAutofillValidSRL = () => {
    setForm({
      company_name: "Moldova Agro Logistics SRL",
      legal_type: "SRL",
      idno: "1003600012345",
      anta_license_number: "ANTA-MD-2024-9912",
      address: "str. Calea Ieșilor 10",
      city: "Chișinău",
      admin_name: "Dumitru Rotaru",
      phone: "+373 69 778 899",
      email: "contact@agrologistics.md",
      role_type: "CARRIER",
    });
    setIdnoValid(true);
    setIdnoError(null);
    setUploadedFiles({
      asp: { name: "extras_asp_agrologistics.pdf", sizeKb: 680 },
      anta: { name: "licenta_anta_2024.pdf", sizeKb: 920 },
      id: { name: "buletin_rotaru_dumitru.jpg", sizeKb: 410 },
    });
  };

  const handleAutofillValidII = () => {
    setForm({
      company_name: "Cojocaru Vasile Î.I.",
      legal_type: "II",
      idno: "1002600098761",
      anta_license_number: "",
      address: "str. Decebal 45",
      city: "Bălți",
      admin_name: "Vasile Cojocaru",
      phone: "+373 68 112 233",
      email: "vasile@cojocaru.md",
      role_type: "SME",
    });
    setIdnoValid(true);
    setIdnoError(null);
    setUploadedFiles({
      asp: { name: "extras_asp_cojocaru.pdf", sizeKb: 450 },
      anta: null,
      id: { name: "buletin_cojocaru_vasile.jpg", sizeKb: 380 },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idnoValid) {
      alert("Vă rugăm să introduceți un IDNO valid conform algoritmului Modulo 11.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.submitKyc({
        company_name: form.company_name,
        legal_type: form.legal_type,
        idno: form.idno,
        address: form.address,
        city: form.city,
        admin_name: form.admin_name,
        phone: form.phone,
        anta_license_number: form.anta_license_number || undefined,
        status: "PENDING_VERIFICATION",
      });
      setSuccess(true);
    } catch {
      alert("Eroare la trimiterea dosarului KYC.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activePath="/verification" />

      <main className="ml-64 flex-1 p-6 flex flex-col gap-5">
        {/* Header Minimalist */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Verificare KYC & Înregistrare Companii</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Validare matematică IDNO Modulo 11 ASP · Licențe ANTA transport marfă · Protecția Datelor (Legea 133/2011 RM)
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAutofillValidSRL} className="btn-secondary text-xs">
              ⚡ Exemplu SRL (Transportator)
            </button>
            <button onClick={handleAutofillValidII} className="btn-secondary text-xs">
              ⚡ Exemplu Î.I. (Comerciant)
            </button>
          </div>
        </div>

        {success ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl mx-auto mb-3">
              ✓
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Dosar KYC & Înregistrare Transmisă!</h2>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Compania <strong>{form.company_name}</strong> (IDNO: {form.idno}) a fost înregistrată în sistem.
              Documentele justificative și senzorul GPS au fost preluate. Puteți începe imediat configurarea activității:
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mb-4">
              {form.role_type === "CARRIER" ? (
                <>
                  <a href="/fleet" className="btn-primary text-xs py-2 px-4 w-full sm:w-auto text-center">
                    Configurator Flotă & Remorci
                  </a>
                  <a href="/map" className="btn-secondary text-xs py-2 px-4 w-full sm:w-auto text-center">
                    Harta Live GPS Moldova
                  </a>
                </>
              ) : (
                <>
                  <a href="/orders" className="btn-primary text-xs py-2 px-4 w-full sm:w-auto text-center">
                    Plasează Comandă Marfă
                  </a>
                  <a href="/map" className="btn-secondary text-xs py-2 px-4 w-full sm:w-auto text-center">
                    Caută Camioane Disponibile
                  </a>
                </>
              )}
            </div>

            <button
              onClick={() => setSuccess(false)}
              className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors"
            >
              Completează un alt dosar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-5 items-start">
            {/* Formular KYC (8 Coloane) */}
            <form onSubmit={handleSubmit} className="col-span-8 bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                1. Date de Identificare Persoană Juridică (ASP Moldova)
              </h2>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Denumire Oficială Companie:</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: TransMold Logistics SRL"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="input-clean text-xs py-1.5"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Formă Juridică:</label>
                  <select
                    value={form.legal_type}
                    onChange={(e) => setForm({ ...form, legal_type: e.target.value as any })}
                    className="input-clean text-xs py-1.5"
                  >
                    <option value="SRL">SRL — Societate cu Răspundere Limitată</option>
                    <option value="II">Î.I. / IP — Întreprindere Individuală</option>
                    <option value="SA">SA — Societate pe Acțiuni</option>
                  </select>
                </div>
              </div>

              {/* IDNO cu Validator Matematic */}
              <div className="text-xs">
                <label className="font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Număr de Identificare de Stat (IDNO — 13 Cifre):</span>
                  {idnoValid === true && <span className="text-emerald-600 font-bold">✓ IDNO Valid (ASP Modulo 11)</span>}
                  {idnoValid === false && <span className="text-red-600 font-bold">✕ {idnoError}</span>}
                </label>
                <input
                  type="text"
                  required
                  maxLength={13}
                  placeholder="ex: 1003600012345"
                  value={form.idno}
                  onChange={(e) => handleIdnoChange(e.target.value)}
                  className={`input-clean font-mono text-xs py-1.5 ${
                    idnoValid === true ? "border-emerald-500 bg-emerald-50/20" : idnoValid === false ? "border-red-500 bg-red-50/20" : ""
                  }`}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Algoritm Modulo 11 cu ponderile ASP: [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1].
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Oraș / Raion:</label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="input-clean text-xs py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Adresă Sediu Social:</label>
                  <input
                    type="text"
                    required
                    placeholder="str. Ștefan cel Mare 1"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="input-clean text-xs py-1.5"
                  />
                </div>
              </div>

              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2">
                2. Administrator & Licență ANTA
              </h2>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Nume Administrator:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ion Popescu"
                    value={form.admin_name}
                    onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                    className="input-clean text-xs py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Telefon Contact:</label>
                  <input
                    type="tel"
                    required
                    placeholder="+373 69 000 000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input-clean text-xs py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Nr. Licență ANTA (Opțional):</label>
                  <input
                    type="text"
                    placeholder="ANTA-MD-2024-XXXX"
                    value={form.anta_license_number}
                    onChange={(e) => setForm({ ...form, anta_license_number: e.target.value })}
                    className="input-clean text-xs py-1.5"
                  />
                </div>
              </div>

              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2 flex items-center justify-between">
                <span>3. Încărcare Imagini & Documente Justificative (PDF / Scan)</span>
                <span className="text-[10px] text-slate-400 font-normal">Format acceptat: JPG, PNG, PDF (max. 15MB)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* 1. Extras ASP */}
                <div className="flex flex-col">
                  <label className="font-semibold text-slate-700 mb-1 block text-[11px]">
                    Extras Registrul ASP:
                  </label>
                  <label
                    className={`p-3 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[110px] relative ${
                      uploadedFiles.asp
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                        : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const previewUrl = file.type.startsWith("image/")
                            ? URL.createObjectURL(file)
                            : undefined;
                          setUploadedFiles((prev) => ({
                            ...prev,
                            asp: { name: file.name, sizeKb: Math.round(file.size / 1024), previewUrl },
                          }));
                        }
                      }}
                    />

                    {uploadedFiles.asp ? (
                      <div className="flex flex-col items-center gap-1">
                        {uploadedFiles.asp.previewUrl ? (
                          <img
                            src={uploadedFiles.asp.previewUrl}
                            alt="ASP Scan"
                            className="w-10 h-10 object-cover rounded border border-emerald-300 mb-0.5"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                            PDF
                          </div>
                        )}
                        <span className="font-bold text-[11px] text-emerald-800 truncate max-w-[140px]">
                          {uploadedFiles.asp.name}
                        </span>
                        <span className="text-[10px] text-emerald-600">
                          {uploadedFiles.asp.sizeKb} KB · Atașat
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-base mb-0.5">📄</span>
                        <span className="font-bold text-[11px] text-slate-700">+ Încarcă Extras ASP</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Click pentru foto / PDF</span>
                      </>
                    )}
                  </label>
                </div>

                {/* 2. Licență ANTA */}
                <div className="flex flex-col">
                  <label className="font-semibold text-slate-700 mb-1 block text-[11px]">
                    Licență Transport ANTA:
                  </label>
                  <label
                    className={`p-3 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[110px] relative ${
                      uploadedFiles.anta
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                        : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const previewUrl = file.type.startsWith("image/")
                            ? URL.createObjectURL(file)
                            : undefined;
                          setUploadedFiles((prev) => ({
                            ...prev,
                            anta: { name: file.name, sizeKb: Math.round(file.size / 1024), previewUrl },
                          }));
                        }
                      }}
                    />

                    {uploadedFiles.anta ? (
                      <div className="flex flex-col items-center gap-1">
                        {uploadedFiles.anta.previewUrl ? (
                          <img
                            src={uploadedFiles.anta.previewUrl}
                            alt="ANTA Scan"
                            className="w-10 h-10 object-cover rounded border border-emerald-300 mb-0.5"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                            PDF
                          </div>
                        )}
                        <span className="font-bold text-[11px] text-emerald-800 truncate max-w-[140px]">
                          {uploadedFiles.anta.name}
                        </span>
                        <span className="text-[10px] text-emerald-600">
                          {uploadedFiles.anta.sizeKb} KB · Atașat
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-base mb-0.5">🚚</span>
                        <span className="font-bold text-[11px] text-slate-700">+ Încarcă Licență ANTA</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Obligatoriu cărăuși</span>
                      </>
                    )}
                  </label>
                </div>

                {/* 3. Buletin Administrator */}
                <div className="flex flex-col">
                  <label className="font-semibold text-slate-700 mb-1 block text-[11px]">
                    Buletin Identitate Admin:
                  </label>
                  <label
                    className={`p-3 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[110px] relative ${
                      uploadedFiles.id
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                        : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const previewUrl = file.type.startsWith("image/")
                            ? URL.createObjectURL(file)
                            : undefined;
                          setUploadedFiles((prev) => ({
                            ...prev,
                            id: { name: file.name, sizeKb: Math.round(file.size / 1024), previewUrl },
                          }));
                        }
                      }}
                    />

                    {uploadedFiles.id ? (
                      <div className="flex flex-col items-center gap-1">
                        {uploadedFiles.id.previewUrl ? (
                          <img
                            src={uploadedFiles.id.previewUrl}
                            alt="ID Scan"
                            className="w-10 h-10 object-cover rounded border border-emerald-300 mb-0.5"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                            PDF
                          </div>
                        )}
                        <span className="font-bold text-[11px] text-emerald-800 truncate max-w-[140px]">
                          {uploadedFiles.id.name}
                        </span>
                        <span className="text-[10px] text-emerald-600">
                          {uploadedFiles.id.sizeKb} KB · Atașat
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-base mb-0.5">🪪</span>
                        <span className="font-bold text-[11px] text-slate-700">+ Buletin Admin (Foto)</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Protejat Legea 133/2011</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Secțiune Integrare GPS Telematic (Dacă e Transportator) */}
              {form.role_type === "CARRIER" && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mt-2">
                  <h3 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    4. Conectare Senzor GPS / Telematică Flotă
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Introduceți identificatorul senzorului GPS instalat pe camionul principal pentru sincronizare automată pe hartă (Teltonika, Galileosky, Ruptela, etc.)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        ID Tracker / IMEI GPS:
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Teltonika-FMB920-8812"
                        className="input-clean text-xs py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Număr Înmatriculare Camion:
                      </label>
                      <input
                        type="text"
                        placeholder="ex: CAN 001"
                        className="input-clean text-xs py-1.5 font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || idnoValid !== true}
                  className="btn-primary text-xs py-2 px-4 disabled:opacity-50"
                >
                  {submitting ? "Se transmite dosarul..." : "Trimite Dosarul Spre Verificare"}
                </button>
              </div>
            </form>

            {/* Informații Juridice Dreapta (4 Coloane) */}
            <div className="col-span-4 bg-white border border-slate-200 rounded-lg p-5 shadow-xs text-xs text-slate-600 space-y-3">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Cadrul Legal al Republicii Moldova</h3>
              <p>
                <strong>SRL vs Î.I. (Răspundere):</strong> În cazul SRL, asociații răspund doar în limita capitalului social vărsat. Pentru Î.I., titularul răspunde nelimitat cu întreg patrimoniul său personal.
              </p>
              <p>
                <strong>Licențiere ANTA:</strong> Operatorii de transport rutier contra cost sunt obligați să dețină licență valabilă emisă de Agenția Națională Transport Auto conform Codului nr. 150/2014.
              </p>
              <p>
                <strong>Legea nr. 133/2011:</strong> Datele personale ale administratorilor și șoferilor sunt prelucrate strict pentru scopul executării contractelor logistice, în conformitate cu normele CNPDCP.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
