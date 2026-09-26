// IDNO (cod fiscal al persoanei juridice, Republica Moldova): 13 cifre.
// Verificarea de fond (existența în Registrul de stat) o face administratorul
// platformei la aprobarea KYC; aici validăm doar formatul, identic cu
// constrângerea din baza de date (companies.idno ~ '^[0-9]{13}$').

import type { LegalForm } from "./db-types";

export function normalizeIdno(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 13);
}

export function idnoError(raw: string): string | null {
  const idno = normalizeIdno(raw);
  if (!idno) return "Introdu codul IDNO.";
  if (idno.length !== 13) return `IDNO are 13 cifre (ai introdus ${idno.length}).`;
  return null;
}

export function formatIdno(idno: string): string {
  return normalizeIdno(idno).replace(/(\d{4})(\d{4})(\d{4})(\d)/, "$1 $2 $3 $4");
}

export const LEGAL_FORMS: Array<{ id: LegalForm; label: string; suffix: string }> = [
  { id: "SRL", label: "Societate cu răspundere limitată", suffix: "SRL" },
  { id: "II", label: "Întreprindere individuală", suffix: "Î.I." },
  { id: "SA", label: "Societate pe acțiuni", suffix: "SA" },
  { id: "GT", label: "Gospodărie țărănească", suffix: "GȚ" },
  { id: "ALTA", label: "Altă formă", suffix: "" },
];

export function legalSuffix(form: LegalForm): string {
  return LEGAL_FORMS.find((f) => f.id === form)?.suffix ?? "";
}

/** „TransMold Express” + SRL → „TransMold Express SRL” */
export function displayCompanyName(name: string, form: LegalForm): string {
  const suffix = legalSuffix(form);
  return suffix && !name.toUpperCase().endsWith(suffix.toUpperCase()) ? `${name} ${suffix}` : name;
}
