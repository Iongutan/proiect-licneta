import type { Metadata } from "next";
import MapScreen from "@/components/map/MapScreen";
import { getViewer } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Hartă" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MapPage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  const viewer = await getViewer();
  const c = viewer?.company;
  return (
    <MapScreen
      companyId={c?.id ?? null}
      companyVerified={c?.kyc_status === "VERIFIED"}
      canShip={c?.kind === "SHIPPER" || c?.kind === "BOTH"}
      homeDistrict={c?.district_id ?? null}
      initialSelectedId={vehicle && UUID.test(vehicle) ? vehicle : null}
    />
  );
}
