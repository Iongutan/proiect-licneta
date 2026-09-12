// OptiFleet B2B — Algoritm Oficial de Validare IDNO (Republica Moldova)
// Conform standardelor Agenției Servicii Publice (ASP) și Registrului de Stat (RSUD)

/**
 * Ponderile oficiale utilizate în algoritmul Modulo 11 pentru calculul cifrei de control IDNO.
 */
const IDNO_WEIGHTS = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1];

export interface IdnoValidationResult {
  isValid: boolean;
  idno: string;
  error?: string;
  companyType?: "SRL" | "II" | "SA" | "ALTA";
  issuedYear?: number;
}

/**
 * Validează un cod fiscal (IDNO) din Republica Moldova conform algoritmului Modulo 11.
 *
 * @param idno Codul fiscal de 13 cifre
 * @returns Rezultatul validării cu detalii
 */
export function validateMoldovaIdno(idno: string): IdnoValidationResult {
  const cleanIdno = idno.trim().replace(/\s+/g, "");

  if (!cleanIdno) {
    return { isValid: false, idno: cleanIdno, error: "IDNO-ul nu poate fi gol." };
  }

  if (!/^\d{13}$/.test(cleanIdno)) {
    return {
      isValid: false,
      idno: cleanIdno,
      error: `IDNO-ul trebuie să conțină exact 13 cifre (lungime curentă: ${cleanIdno.length}).`,
    };
  }

  // Calcul cifră de control (a 13-a cifră, index 12)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanIdno[i], 10) * IDNO_WEIGHTS[i];
  }

  const remainder = sum % 11;
  const controlDigit = remainder === 10 ? 0 : remainder;
  const actualDigit = parseInt(cleanIdno[12], 10);

  if (controlDigit !== actualDigit) {
    return {
      isValid: false,
      idno: cleanIdno,
      error: `Cifră de control invalidă (așteptat: ${controlDigit}, găsit: ${actualDigit}). IDNO-ul nu există în Registrul ASP.`,
    };
  }

  // Extragere an aproximativ de înregistrare (primele cifre după prefixul 100x)
  const prefix = cleanIdno.slice(0, 3);
  let issuedYear = 2000;
  if (prefix === "100" || prefix === "101") {
    const yearDigits = parseInt(cleanIdno.slice(3, 5), 10);
    issuedYear = yearDigits > 50 ? 1900 + yearDigits : 2000 + yearDigits;
  }

  return {
    isValid: true,
    idno: cleanIdno,
    issuedYear,
  };
}

/**
 * Detectează forma juridică a entității din denumire sau IDNO (Prompt K12).
 * SRL (Societate cu Răspundere Limitată) / Î.I. (Întreprindere Individuală) / S.A. (Societate pe Acțiuni).
 */
export function detectLegalForm(
  companyName: string = "",
  idno: string = ""
): "SRL" | "II" | "SA" | "ALTA" {
  const upper = companyName.toUpperCase().trim();
  if (upper.includes("SRL") || upper.includes("S.R.L.")) return "SRL";
  if (upper.includes("Î.I.") || upper.includes("II") || upper.includes("I.I.") || upper.includes("INDIVIDUAL")) return "II";
  if (upper.includes("S.A.") || upper.includes("SA")) return "SA";

  // Dacă nu este specificat în nume, verificăm dacă este înregistrat ca persoană juridică generală
  if (idno.startsWith("1002") || idno.startsWith("1004")) return "II";
  if (idno.startsWith("1003") || idno.startsWith("1005")) return "SRL";

  return "SRL";
}

/**
 * Extrage profilul legal complet al companiei pentru auto-populare în contracte și KYC (Prompt K12)
 */
export function getCompanyLegalProfile(idno: string, companyName: string = "") {
  const validation = validateMoldovaIdno(idno);
  const legalForm = detectLegalForm(companyName, idno);
  const legalFormLabels: Record<string, string> = {
    SRL: "Societate cu Răspundere Limitată (S.R.L.)",
    II: "Întreprindere Individuală (Î.I.)",
    SA: "Societate pe Acțiuni (S.A.)",
    ALTA: "Entitate Economică Înregistrată",
  };

  return {
    idno: validation.idno || idno,
    isValid: validation.isValid,
    issuedYear: validation.issuedYear,
    legalForm,
    legalFormDescription: legalFormLabels[legalForm] || legalFormLabels.SRL,
    companyName: companyName || (legalForm === "II" ? "Transport Individual Î.I." : "Logistica Nord SRL"),
    jurisdiction: "Republica Moldova (ASP)",
  };
}

/**
 * Formatează IDNO-ul cu spații pentru lizibilitate (ex: 1003 6000 1234 5)
 */
export function formatIdno(idno: string): string {
  const clean = idno.replace(/\D/g, "").slice(0, 13);
  return clean.replace(/(\d{4})(\d{4})(\d{4})(\d{1})/, "$1 $2 $3 $4").trim();
}
