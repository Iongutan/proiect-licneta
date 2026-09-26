"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { safeNextPath } from "@/lib/safe-redirect";
import { AuthFrame } from "@/components/shell/AuthFrame";

export default function LoginPage() {
  return (
    <AuthFrame title="Intră în cont" subtitle="Bursa de transport marfă pentru firmele din Moldova">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    }).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      // Mesaj generic: nu dezvăluim dacă adresa există.
      const body = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(res ? body?.error ?? "Email sau parolă greșită." : "Serverul nu răspunde. Verifică dacă aplicația rulează.");
      return;
    }
    router.replace(safeNextPath(params.get("next")));
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="email" className="t-label">Email</label>
        <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password" className="t-label">Parolă</label>
        <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending || !email || !password}>
        {pending ? "Se verifică…" : "Intră"}
      </button>
      <p className="text-center t-small">
        Firma ta nu are cont? <Link href="/register" className="text-accent hover:underline">Înregistrează firma</Link>
      </p>
    </form>
  );
}
