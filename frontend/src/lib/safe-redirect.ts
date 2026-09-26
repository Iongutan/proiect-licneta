/** Acceptă doar căi relative interne („/map”), niciodată „//evil.com” sau URL-uri absolute. */
export function safeNextPath(raw: string | null | undefined, fallback = "/map"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  try {
    const url = new URL(raw, "http://local");
    return url.origin === "http://local" ? url.pathname + url.search : fallback;
  } catch {
    return fallback;
  }
}
