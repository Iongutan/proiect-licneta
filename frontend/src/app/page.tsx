import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-between p-6 sm:p-8">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
            O
          </div>
          <div>
            <div className="font-bold text-slate-900 tracking-tight text-lg">OptiFleet B2B</div>
            <div className="text-xs text-blue-600 font-semibold">Bursă Cargo & Rețea Logistică Națională</div>
          </div>
        </div>

        <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <Link href="/map" className="px-3 py-1.5 text-slate-600 hover:text-blue-600 font-semibold transition-colors">
            Hartă Live & Camioane
          </Link>
          <Link href="/fleet" className="px-3 py-1.5 text-slate-600 hover:text-blue-600 font-semibold transition-colors">
            Configurator Flotă (CAD)
          </Link>
          <Link href="/orders" className="px-3 py-1.5 text-slate-600 hover:text-blue-600 font-semibold transition-colors">
            Bursă Comenzi
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm"
          >
            Intră în Cont
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl w-full mx-auto py-14 sm:py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Marketplace B2B pentru Producători & Transportatori Licențiați ANTA
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Soluția Inteligentă de Transport Marfă în Moldova & Export spre UE
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10">
          Conectăm direct firmele de producție cu transportatori verificați. Reduceri de până la <strong>62%</strong> prin grupajul încărcăturilor libere, urmărire GPS în timp real pe 32 de raioane și contracte de transport securizate.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4 flex-wrap mb-16">
          <Link
            href="/map"
            className="px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md flex items-center gap-2 hover:scale-105"
          >
            <span>🗺️</span> Deschide Harta Live a Camioanelor
          </Link>
          <Link
            href="/fleet"
            className="px-7 py-3.5 rounded-xl bg-white border border-slate-300 hover:border-blue-600 hover:text-blue-600 text-slate-800 font-bold text-sm transition-all shadow-sm"
          >
            <span>🚚</span> Configurator Flotă Cărăuși
          </Link>
          <Link
            href="/verification"
            className="px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-all"
          >
            Înregistrare & Verificare ANTA/ASP
          </Link>
        </div>

        {/* Feature Grid 3 Coloane */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-4 font-bold">
              🏭
            </div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Pentru Producători</div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Transport Accesibil & Ieftin</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Nu dețineți mașini? Căutați rapid camioane disponibile per raion, găsiți cel mai avantajos preț per kilometru și rezervați spațiu pentru 2, 3 sau 33 de paleți.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mb-4 font-bold">
              🚛
            </div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Pentru Transportatori</div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Configurator Flotă & GPS</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Adăugați orice tip de vehicul (minivan, dubă mare, TIR 1 remorcă, tren rutier 2 remorci), setați tariful per km, asociați senzorul GPS și primiți comenzi verificate.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 transition-all shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-xl mb-4 font-bold">
              🛡️
            </div>
            <div className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">Securitate & Legalitate</div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Conformitate ANTA & CMR</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Fiecare cărăuș trece verificarea oficială cu licență de transport și asigurare CMR. Contracte electronice B2B securizate prin hash criptografic SHA-256.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Comercial Curat */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div>
          © 2026 OptiFleet B2B Logistics Platform · Chișinău, Republica Moldova. Toate drepturile rezervate.
        </div>
        <div className="flex items-center gap-4">
          <Link href="/map" className="hover:text-blue-600">Hartă Live</Link>
          <Link href="/contracts" className="hover:text-blue-600">Termeni B2B & CMR</Link>
          <Link href="/verification" className="hover:text-blue-600">Verificare ANTA/ASP</Link>
        </div>
      </footer>
    </div>
  );
}
