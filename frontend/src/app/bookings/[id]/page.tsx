import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import BookingDetail from "@/components/bookings/BookingDetail";
import { getViewer } from "@/lib/db-server";

export const metadata: Metadata = { title: "Contract" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer?.company) redirect("/account");
  return <BookingDetail bookingId={id} companyId={viewer.company.id} />;
}
