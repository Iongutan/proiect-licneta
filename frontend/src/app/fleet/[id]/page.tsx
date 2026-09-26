import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import VehicleDetail from "@/components/fleet/VehicleDetail";
import { getViewer } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Vehicul" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer?.company) redirect("/account");
  return <VehicleDetail vehicleId={id} companyId={viewer.company.id} isCompanyAdmin={viewer.profile?.company_role === "ADMIN"} />;
}
