// Rulează înaintea fiecărei pagini (runtime Node.js):
//  1. verifică sesiunea (cookie httpOnly → auth.sessions în baza locală);
//  2. trimite la /login vizitatorii neautentificați ai paginilor protejate;
//  3. setează un Content-Security-Policy strict, cu nonce nou la fiecare request.
// Aplicația nu mai vorbește cu niciun serviciu extern: connect-src e doar 'self'.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionUser } from "@/lib/server/auth";

const PROTECTED = ["/map", "/fleet", "/requests", "/bookings", "/account", "/admin"];
const AUTH_PAGES = ["/login", "/register"];

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Leaflet și poziționarea markerilor folosesc atribute style; nu permit <style> fără nonce.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await sessionUser(token).catch(() => null) : null;
  const { pathname, search } = request.nextUrl;

  const withCleanup = (res: NextResponse) => {
    // Cookie de sesiune expirat sau șters din baza de date → îl ștergem și din browser.
    if (token && !user) res.cookies.delete(SESSION_COOKIE);
    return res;
  };

  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return withCleanup(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url)));
  }
  if (user && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/map", request.url));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return withCleanup(response);
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|data/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
