"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanyKind, LegalForm } from "@/lib/db-types";
import { DISTRICTS } from "@/lib/districts";
import { LEGAL_FORMS, idnoError, normalizeIdno } from "@/lib/idno-validator";
import { AuthFrame } from "@/components/shell/AuthFrame";

const KINDS: Array<{ id: CompanyKind; title: string; hint: string }> = [
  { id: "SHIPPER", title: "Am marfă de transportat", hint: "Nu am mașini — caut transport și postez cereri." },
  { id: "CARRIER", title: "Sunt transportator", hint: "Am vehicule și ofer locuri libere." },
  { id: "BOTH", title: "Ambele", hint: "Am flotă proprie și trimit și marfă." },
];

interface Form {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
  legalForm: LegalForm;
  idno: string;
  kind: CompanyKind;
  districtId: string;
  consent: boolean;
}

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.fullName.trim().length < 3) e.fullName = "Numele complet.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Adresă de email invalidă.";
  if (f.password.length < 10) e.password = "Minim 10 caractere.";
  else if (!/[a-zA-Z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Folosește litere și cifre.";
  if (f.companyName.trim().length < 2) e.companyName = "Denumirea firmei.";
  const idno = idnoError(f.idno);
  if (idno) e.idno = idno;
  if (!f.districtId) e.districtId = "Alege raionul sediului.";
  if (!f.consent) e.consent = "Necesar pentru a crea contul.";
  return e;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    fullName: "", email: "", password: "", companyName: "", legalForm: "SRL", idno: "",
    kind: "SHIPPER", districtId: "", consent: false,
  });
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validate(form);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const show = (key: keyof Form) => (touched ? errors[key] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        password: form.password,
        data: {
          full_name: form.fullName.trim(),
          company_name: form.companyName.trim(),
          legal_form: form.legalForm,
          idno: normalizeIdno(form.idno),
          company_kind: form.kind,
          district_id: form.districtId,
        },
      }),
    }).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(res ? body?.error ?? "Contul nu a putut fi creat." : "Serverul nu răspunde. Verifică dacă aplicația rulează.");
      return;
    }
    router.replace("/map");
    router.refresh();
  };

  return (
    <AuthFrame title="Înregistrează firma" subtitle="Contul aparține firmei; denumirea apare în antetul platformei.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <fieldset className="space-y-2">
          <legend className="t-label mb-1">Ce faci pe platformă?</legend>
          {KINDS.map((k) => (
            <label key={k.id} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${form.kind === k.id ? "border-accent bg-accent-soft" : "border-line"}`}>
              <input type="radio" name="kind" className="mt-1 accent-[var(--color-accent)]" checked={form.kind === k.id} onChange={() => set("kind", k.id)} />
              <span>
                <span className="block text-[13px] font-medium">{k.title}</span>
                <span className="block t-small">{k.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-3 gap-3">
          <Field id="companyName" label="Denumirea firmei" error={show("companyName")} className="col-span-2">
            <input id="companyName" className="input" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} autoComplete="organization" aria-invalid={Boolean(show("companyName"))} />
          </Field>
          <Field id="legalForm" label="Forma">
            <select id="legalForm" className="select" value={form.legalForm} onChange={(e) => set("legalForm", e.target.value as LegalForm)}>
              {LEGAL_FORMS.map((f) => <option key={f.id} value={f.id}>{f.suffix || f.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field id="idno" label="IDNO" error={show("idno")} hint="13 cifre, din extrasul ASP">
            <input id="idno" inputMode="numeric" className="input t-num" value={form.idno} onChange={(e) => set("idno", normalizeIdno(e.target.value))} aria-invalid={Boolean(show("idno"))} />
          </Field>
          <Field id="districtId" label="Raionul sediului" error={show("districtId")}>
            <select id="districtId" className="select" value={form.districtId} onChange={(e) => set("districtId", e.target.value)} aria-invalid={Boolean(show("districtId"))}>
              <option value="">Alege…</option>
              {[...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "ro")).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>

        <Field id="fullName" label="Numele tău" error={show("fullName")}>
          <input id="fullName" className="input" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" aria-invalid={Boolean(show("fullName"))} />
        </Field>
        <Field id="email" label="Email" error={show("email")}>
          <input id="email" type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" aria-invalid={Boolean(show("email"))} />
        </Field>
        <Field id="password" label="Parolă" error={show("password")} hint="Minim 10 caractere, cu litere și cifre.">
          <input id="password" type="password" className="input" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" aria-invalid={Boolean(show("password"))} />
        </Field>

        <label className="flex gap-2 text-xs text-ink-2">
          <input type="checkbox" className="mt-0.5 accent-[var(--color-accent)]" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
          <span>
            Sunt de acord cu prelucrarea datelor firmei și ale mele pentru funcționarea platformei, conform Legii nr. 133/2011 privind protecția datelor cu caracter personal.
            {show("consent") && <span className="block text-danger">{show("consent")}</span>}
          </span>
        </label>

        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Se creează contul…" : "Creează contul"}
        </button>
        <p className="text-center t-small">
          Ai deja cont? <Link href="/login" className="text-accent hover:underline">Intră</Link>
        </p>
      </form>
    </AuthFrame>
  );
}

function Field({ id, label, error, hint, className, children }: { id: string; label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id} className="t-label">{label}</label>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
