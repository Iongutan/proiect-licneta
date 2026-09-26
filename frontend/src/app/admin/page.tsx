import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPanel from "@/components/admin/AdminPanel";
import { getViewer } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Administrare" };

export default async function AdminPage() {
  const viewer = await getViewer();
  // Pentru non-admini pagina nu există (nu dezvăluim că ruta e protejată).
  if (!viewer?.isPlatformAdmin) notFound();
  return <AdminPanel />;
}
