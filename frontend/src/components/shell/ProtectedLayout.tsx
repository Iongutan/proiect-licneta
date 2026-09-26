import { redirect } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import { displayCompanyName } from "@/lib/idno-validator";
import { getViewer } from "@/lib/db-server";

/**
 * Layout comun pentru paginile aplicației. Verificarea din proxy.ts e repetată
 * aici (apărare în adâncime): fără sesiune validă → /login.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar
        viewer={{
          fullName: viewer.profile?.full_name ?? null,
          email: viewer.email,
          companyId: viewer.company?.id ?? null,
          companyName: viewer.company ? displayCompanyName(viewer.company.name, viewer.company.legal_form) : null,
          companyKind: viewer.company?.kind ?? null,
          kycStatus: viewer.company?.kyc_status ?? null,
          isPlatformAdmin: viewer.isPlatformAdmin,
        }}
      />
      <div className="pl-56">{children}</div>
    </div>
  );
}
