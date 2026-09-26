import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OptiFleet", template: "%s · OptiFleet" },
  description: "Bursă B2B de transport marfă pentru IMM-urile din Republica Moldova.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Randare dinamică: nonce-ul CSP din proxy.ts se aplică la fiecare request.
  await connection();
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
