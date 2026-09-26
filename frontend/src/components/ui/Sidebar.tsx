"use client";

import { Bell, FileText, LogOut, Map as MapIcon, Package, Settings, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CompanyKind, KycStatus, Notification } from "@/lib/db-types";
import { fmtDateTime } from "@/lib/format";
import { dbBrowser } from "@/lib/db-browser";

export interface SidebarViewer {
  fullName: string | null;
  email: string | null;
  companyId: string | null;
  companyName: string | null;
  companyKind: CompanyKind | null;
  kycStatus: KycStatus | null;
  isPlatformAdmin: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof MapIcon;
  show: (v: SidebarViewer) => boolean;
}

const canShip = (v: SidebarViewer) => v.companyKind === "SHIPPER" || v.companyKind === "BOTH";
const canCarry = (v: SidebarViewer) => v.companyKind === "CARRIER" || v.companyKind === "BOTH";

const NAV: NavItem[] = [
  { href: "/map", label: "Hartă", icon: MapIcon, show: (v) => Boolean(v.companyId) },
  { href: "/requests", label: "Comenzile mele", icon: Package, show: (v) => canShip(v) && !canCarry(v) },
  { href: "/requests", label: "Bursa de marfă", icon: Package, show: canCarry },
  { href: "/fleet", label: "Flota mea", icon: Truck, show: canCarry },
  { href: "/bookings", label: "Contracte", icon: FileText, show: (v) => Boolean(v.companyId) },
  { href: "/account", label: "Cont", icon: Settings, show: (v) => Boolean(v.companyId) },
  { href: "/admin", label: "Administrare", icon: ShieldCheck, show: (v) => v.isPlatformAdmin },
];

export default function Sidebar({ viewer }: { viewer: SidebarViewer }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await dbBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-line bg-surface">
      <div className="border-b border-line px-4 py-4">
        <Link href="/map" className="block">
          <div className="text-[15px] font-semibold tracking-tight text-ink">OptiFleet</div>
          {viewer.companyName && (
            <div className="mt-0.5 truncate text-xs text-muted" title={viewer.companyName}>{viewer.companyName}</div>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 p-2" aria-label="Navigare principală">
        {NAV.filter((item) => item.show(viewer)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ${
                active ? "bg-accent-soft font-medium text-accent-strong" : "text-ink-2 hover:bg-canvas"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      {viewer.companyId && viewer.kycStatus !== "VERIFIED" && (
        <Link href="/account" className="mx-2 mb-2 rounded-md border border-[#fde68a] bg-warn-soft px-3 py-2 text-xs text-warn">
          {viewer.kycStatus === "REJECTED" ? "Verificarea firmei a fost respinsă." : "Firma așteaptă verificarea. Până atunci poți căuta, dar nu poți rezerva."}
        </Link>
      )}

      <div className="flex items-center gap-2 border-t border-line p-2">
        <div className="min-w-0 flex-1 px-1.5">
          <div className="truncate text-xs font-medium text-ink">{viewer.fullName || viewer.email}</div>
          {viewer.fullName && <div className="truncate text-[11px] text-muted">{viewer.email}</div>}
        </div>
        {viewer.companyId && <NotificationBell companyId={viewer.companyId} />}
        <button type="button" onClick={signOut} className="btn btn-ghost btn-sm px-2" title="Ieșire" aria-label="Ieșire">
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}

function NotificationBell({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    const db = dbBrowser();
    let active = true;
    db
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => active && data && setItems(data));

    const channel = db
      .channel(`notifications:${companyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `company_id=eq.${companyId}` },
        (payload) => setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20)),
      )
      .subscribe();
    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, [companyId]);

  const markAllRead = async () => {
    await dbBrowser().rpc("mark_notifications_read");
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-sm relative px-2"
        aria-label={`Notificări${unread ? ` (${unread} necitite)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute bottom-10 left-0 z-50 w-80 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="t-label">Notificări</span>
            {unread > 0 && (
              <button type="button" className="text-xs text-accent hover:underline" onClick={markAllRead}>
                Marchează citite
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-3 py-6 text-center t-small">Nicio notificare.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`block w-full border-b border-line px-3 py-2 text-left last:border-0 hover:bg-canvas ${n.read_at ? "" : "bg-accent-soft/40"}`}
                  onClick={() => {
                    setOpen(false);
                    if (n.link) router.push(n.link);
                  }}
                >
                  <div className="text-[13px] font-medium text-ink">{n.title}</div>
                  {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-ink-2">{n.body}</div>}
                  <div className="mt-1 t-small">{fmtDateTime(n.created_at)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
