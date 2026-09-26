import Link from "next/link";
import { redirect } from "next/navigation";
import VehicleSide from "@/components/logistics/VehicleBlueprintSVG";
import { getViewer } from "@/lib/db-server";

export default async function HomePage() {
  if (await getViewer()) redirect("/map");

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-5">
        <span className="text-[15px] font-semibold tracking-tight">OptiFleet</span>
        <nav className="flex gap-2">
          <Link href="/login" className="btn btn-ghost">Intră</Link>
          <Link href="/register" className="btn btn-primary">Înregistrează firma</Link>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-10 py-12 md:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink">
            Locurile libere din camioanele Moldovei, într-un singur loc.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">
            Expeditorii fără flotă găsesc camioane care merg — sau doar trec — pe traseul lor și rezervă câțiva paleți.
            Transportatorii umplu drumurile de întoarcere. Contract, GPS și dovadă de livrare incluse.
          </p>
          <div className="mt-6 flex gap-2">
            <Link href="/register" className="btn btn-primary">Începe</Link>
            <Link href="/login" className="btn btn-secondary">Am cont</Link>
          </div>
        </div>
        <div className="card p-5">
          <VehicleSide type="CURTAINSIDE" cargoLengthCm={1360} cargoWidthCm={245} occupied={21} className="w-full" title="Semiremorcă cu 21 din 33 de paleți ocupați" />
          <div className="mt-3 flex items-center justify-between text-[13px]">
            <span><span className="kbd-plate mr-2">CAN 001</span>Chișinău → Rezina</span>
            <span className="font-semibold text-accent-strong">12 locuri libere</span>
          </div>
          <p className="t-small mt-1">Trece prin Orhei la 14:20 · 18,5 MDL/km</p>
        </div>
      </section>

      <footer className="border-t border-line py-5 t-small">
        Proiect de licență · Universitatea Tehnică a Moldovei · FCIM · 2026
      </footer>
    </main>
  );
}
