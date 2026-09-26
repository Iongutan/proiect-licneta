import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountForm from "@/components/account/AccountForm";
import { getViewer } from "@/lib/db-server";

export const metadata: Metadata = { title: "Cont" };

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.company) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="t-title">Cont fără firmă</h1>
        <p className="t-small mt-2">{viewer.isPlatformAdmin ? "Ești administrator al platformei. Folosește pagina Administrare." : "Contul nu e legat de nicio firmă. Contactează administratorul platformei."}</p>
      </main>
    );
  }
  return (
    <AccountForm
      company={viewer.company}
      userId={viewer.userId}
      fullName={viewer.profile?.full_name ?? ""}
      email={viewer.email}
      isCompanyAdmin={viewer.profile?.company_role === "ADMIN"}
    />
  );
}
