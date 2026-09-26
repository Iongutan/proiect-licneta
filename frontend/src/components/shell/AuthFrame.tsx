import Link from "next/link";

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-[15px] font-semibold tracking-tight text-ink">OptiFleet</Link>
        <div className="card p-6">
          <h1 className="t-title">{title}</h1>
          <p className="mb-5 mt-1 t-small">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
