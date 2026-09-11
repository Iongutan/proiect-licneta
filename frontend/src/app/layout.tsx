import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OptiFleet B2B — Platformă Logistică Inteligentă Moldova",
  description:
    "Reduceți costurile de transport cu până la 62% prin livrări grupate AI-optimizate. " +
    "Tracking GPS real-time, CVRP routing, și asistent AI disponibil 24/7.",
  keywords: ["logistică", "transport", "Moldova", "B2B", "livrări grupate", "AI"],
  authors: [{ name: "OptiFleet Team" }],
  openGraph: {
    title: "OptiFleet B2B",
    description: "Platformă B2B Inteligentă de Logistică pentru IMM-uri din Moldova",
    locale: "ro_MD",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" className="bg-white text-slate-900">
      <body className="antialiased bg-white text-slate-900">{children}</body>
    </html>
  );
}
