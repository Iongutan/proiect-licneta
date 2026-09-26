import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FleetList from "@/components/fleet/FleetList";
import { getViewer } from "@/lib/db-server";

export const metadata: Metadata = { title: "Flota mea" };

export default async function FleetPage() {
  const viewer = await getViewer();
  const company = viewer?.company;
  if (!company) redirect("/account");
  if (company.kind === "SHIPPER") redirect("/requests");
  return <FleetList companyId={company.id} homeDistrict={company.district_id} />;
}
