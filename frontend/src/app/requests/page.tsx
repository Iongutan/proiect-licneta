import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RequestsScreen from "@/components/requests/RequestsScreen";
import { getViewer } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Cereri de transport" };

export default async function RequestsPage() {
  const viewer = await getViewer();
  const c = viewer?.company;
  if (!c) redirect("/account");
  return (
    <RequestsScreen
      companyId={c.id}
      canShip={c.kind !== "CARRIER"}
      canCarry={c.kind !== "SHIPPER"}
      verified={c.kyc_status === "VERIFIED"}
      homeDistrict={c.district_id}
    />
  );
}
