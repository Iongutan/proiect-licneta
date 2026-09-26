const TZ = "Europe/Chisinau";

const dateTime = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ,
});
const timeOnly = new Intl.DateTimeFormat("ro-MD", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const mdl = new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 0 });

export function fmtDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export function fmtTime(iso: string | null | undefined): string {
  return iso ? timeOnly.format(new Date(iso)) : "—";
}

export function fmtMdl(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${mdl.format(value)} MDL`;
}

export function fmtKg(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toLocaleString("ro-MD", { maximumFractionDigits: 1 })} t` : `${kg} kg`;
}

/** „peste 25 min” / „acum 3 min” — pentru ore de trecere estimate. */
export function fmtRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000);
  if (Math.abs(minutes) < 2) return "acum";
  const abs = Math.abs(minutes);
  const span = abs < 60 ? `${abs} min` : `${Math.floor(abs / 60)} h ${abs % 60 ? `${abs % 60} min` : ""}`.trim();
  return minutes > 0 ? `peste ${span}` : `acum ${span}`;
}

/** Pentru <input type="datetime-local"> în fusul orar local al browserului. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
