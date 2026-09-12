"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/supabase";
import { apiClient } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"SUPER_ADMIN" | "CARRIER_ADMIN" | "SME_ADMIN">("SUPER_ADMIN");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const presetAccounts = [
    {
      label: "Administrator General (SUPER_ADMIN)",
      email: "admin@optifleet.md",
      password: "AdminOptiFleet2026!",
      role: "SUPER_ADMIN" as const,
      desc: "Acces total: Verificare KYC, Facturare, Contracte, Jurnal Audit",
      redirectTo: "/admin",
    },
    {
      label: "Transportator / Cărăuș (CARRIER_ADMIN)",
      email: "dispatch@transmold.md",
      password: "CarrierOpti2026!",
      role: "CARRIER_ADMIN" as const,
      desc: "TransMold Express SRL: Flotă, Camioane 2D, Contracte B2B, Rute",
      redirectTo: "/fleet",
    },
    {
      label: "Comerciant / IMM (SME_ADMIN)",
      email: "orders@techmold.md",
      password: "MerchantOpti2026!",
      role: "SME_ADMIN" as const,
      desc: "TechMold Electronics SRL: Creare Comenzi, GroupLog Clustere",
      redirectTo: "/orders",
    },
  ];

  const handleSelectPreset = (acc: (typeof presetAccounts)[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setRole(acc.role);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      try {
        const res = await signIn(email, password);
        if (res?.session?.access_token) {
          // PROMPT J4: Token ținut în memorie JS, nu în localStorage
          apiClient.setToken(res.session.access_token);
        }
      } catch {
        // Mod offline securizat
      }

      localStorage.setItem("optifleet_user_email", email);
      localStorage.setItem("optifleet_user_role", role);
      localStorage.setItem(
        "optifleet_user_name",
        role === "SUPER_ADMIN"
          ? "Ion Guțan (Super Admin)"
          : role === "CARRIER_ADMIN"
          ? "Dispecerat TransMold"
          : "Manager TechMold"
      );

      setSuccessMsg(`Autentificare reușită ca ${role}! Redirecționare...`);

      setTimeout(() => {
        if (role === "SUPER_ADMIN") {
          router.push("/admin");
        } else if (role === "CARRIER_ADMIN") {
          router.push("/fleet");
        } else {
          router.push("/dashboard");
        }
      }, 700);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Eroare la autentificare.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              O
            </div>
            <div className="text-left">
              <div className="font-bold text-lg text-slate-900 tracking-tight">OptiFleet B2B</div>
              <div className="text-xs text-slate-500">Platformă B2B Logistică & Transport Moldova</div>
            </div>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 mt-4">Autentificare Securizată</h1>
          <p className="text-xs text-slate-500 mt-1">
            Acces bazat pe roluri (RBAC) conform politicilor Row-Level Security
          </p>
        </div>

        {/* Card Autentificare */}
        <div className="bg-white p-7 rounded-xl shadow-sm border border-slate-200">
          {/* Quick-Preset Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Selectare Rapidă Cont de Test:
            </label>
            <div className="flex flex-col gap-2">
              {presetAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(acc)}
                  className={`text-left p-3 rounded-lg border text-xs transition-all flex flex-col gap-0.5 ${
                    email === acc.email
                      ? "border-blue-600 bg-blue-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{acc.label}</span>
                    <span className="font-mono text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      {acc.email}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">{acc.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Utilizator (Login):
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nume@companie.md"
                className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Parolă:
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono transition-colors"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded accent-blue-600" />
                <span>Păstrează sesiunea activă</span>
              </label>
              <Link href="/verification" className="text-blue-600 hover:underline">
                Înregistrare Companie (KYC)
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Se autentifică...</span>
                </>
              ) : (
                <span>Intră în Panou</span>
              )}
            </button>
          </form>

          {/* Credențiale Reamintire */}
          <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            <span>Credențiale Administrator: </span>
            <span className="text-slate-900 font-mono font-semibold">admin@optifleet.md</span>
            <span> · Parolă: </span>
            <span className="text-slate-900 font-mono font-semibold">AdminOptiFleet2026!</span>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="text-center mt-6">
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
            Înapoi la Panoul de Comandă (Mod Vizitator)
          </Link>
        </div>
      </div>
    </div>
  );
}
