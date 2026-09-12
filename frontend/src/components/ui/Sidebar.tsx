"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAppStatus } from "@/hooks/use-app-status";
import {
  Map,
  Package,
  Truck,
  FileText,
  User,
  Layers,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const primaryNav: NavItem[] = [
  { href: "/map", label: "Hartă Live & Tranzit", shortLabel: "Hartă", icon: Map },
  { href: "/orders", label: "Comenzile mele", shortLabel: "Comenzi", icon: Package },
  { href: "/fleet", label: "Flota mea", shortLabel: "Flotă", icon: Truck },
  { href: "/contracts", label: "Contracte", shortLabel: "Contracte", icon: FileText },
  { href: "/login", label: "Cont", shortLabel: "Cont", icon: User },
];

const secondaryNav: NavItem[] = [
  { href: "/clusters", label: "Consolidare Grupaj", shortLabel: "Grupaj", icon: Layers },
  { href: "/dashboard", label: "Panou de Control (KPI)", shortLabel: "KPI", icon: BarChart3 },
  { href: "/verification", label: "Certificare KYC & ANTA", shortLabel: "KYC", icon: ShieldCheck },
  { href: "/admin", label: "Administrare Sistem", shortLabel: "Admin", icon: Settings },
];

interface SidebarProps {
  activePath?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  activePath,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { isLive } = useAppStatus();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [companyName, setCompanyName] = useState<string>("TransMoldova Grup SRL");

  const collapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed;

  useEffect(() => {
    const loadCompany = () => {
      const stored = localStorage.getItem("optifleet_company_name");
      if (stored) {
        setCompanyName(stored);
      } else {
        const role = localStorage.getItem("optifleet_user_role");
        if (role === "CARRIER_ADMIN") {
          setCompanyName("TransMold Express SRL");
        } else if (role === "SME_ADMIN") {
          setCompanyName("TechMold Electronics SRL");
        } else {
          setCompanyName("TransMoldova Grup SRL");
        }
      }
    };

    loadCompany();
    window.addEventListener("storage", loadCompany);
    return () => window.removeEventListener("storage", loadCompany);
  }, []);

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <aside
      className={`h-screen fixed left-0 top-0 flex flex-col z-40 bg-white border-r border-slate-200 transition-all duration-300 select-none ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header Branding + Companie + Toggle */}
      <div className="px-3.5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        {!collapsed ? (
          <Link href="/map" className="flex items-center gap-2.5 overflow-hidden group">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs group-hover:bg-blue-700 transition-colors">
              O
            </div>
            <div className="truncate min-w-0">
              <div className="font-bold text-sm text-slate-900 tracking-tight leading-tight">
                OptiFleet B2B
              </div>
              <div
                className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5"
                title={companyName}
              >
                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{companyName}</span>
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/map" className="mx-auto" title={`OptiFleet B2B · ${companyName}`}>
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              O
            </div>
          </Link>
        )}

        <button
          onClick={handleToggle}
          title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
          className={`p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 ${
            collapsed ? "mx-auto mt-2" : ""
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigare Principală (Prompt K2: Hartă, Comenzile mele, Flota mea, Contracte, Cont) */}
      <nav className="flex-1 px-2.5 py-3 flex flex-col gap-4 overflow-y-auto overflow-x-hidden">
        {/* Secțiunea Principală */}
        <div className="flex flex-col gap-1">
          {!collapsed && (
            <div className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase truncate">
              Navigare Principală
            </div>
          )}
          {primaryNav.map((item) => {
            const isActive = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 shadow-2xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto shrink-0" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Secțiunea Secundară / Extinsă */}
        <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
          {!collapsed && (
            <div className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase truncate">
              Operațiuni & Gestionare
            </div>
          )}
          {secondaryNav.map((item) => {
            const isActive = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 shadow-2xs"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer Status B2B */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50 flex flex-col gap-1.5">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
            <span className="text-[11px] font-medium text-slate-500">Sistem B2B:</span>
            <span
              className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold flex items-center gap-1.5"
              style={{
                background: isLive ? "#f0fdf4" : "#eff6ff",
                color: isLive ? "#16a34a" : "#2563eb",
                border: isLive ? "1px solid #bbf7d0" : "1px solid #bfdbfe",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: isLive ? "#16a34a" : "#2563eb" }}
              />
              {isLive ? "RUST ONLINE" : "LOCAL READY"}
            </span>
          </div>
        ) : (
          <div className="flex justify-center" title="Sistem Status">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: isLive ? "#16a34a" : "#2563eb" }}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
