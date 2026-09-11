"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAppStatus } from "@/hooks/use-app-status";

const navSections = [
  {
    title: "OPERATIVE & LOGISTICĂ",
    items: [
      { href: "/map", label: "Hartă Live Moldova & AI", shortLabel: "Hartă", icon: "🗺️" },
      { href: "/fleet", label: "Flotă & Configurator CAD", shortLabel: "Flotă", icon: "🚚" },
      { href: "/orders", label: "Bursă Comenzi Marfă", shortLabel: "Comenzi", icon: "📦" },
      { href: "/clusters", label: "Consolidare GroupLog", shortLabel: "Grupaj", icon: "🔗" },
      { href: "/dashboard", label: "Panou de Control (KPI)", shortLabel: "KPI", icon: "📊" },
      { href: "/chat", label: "Asistent AI Qwen3", shortLabel: "AI", icon: "🤖" },
    ],
  },
  {
    title: "B2B, VERIFICARE & ADMIN",
    items: [
      { href: "/verification", label: "Certificare KYC & ANTA", shortLabel: "KYC", icon: "🛡️" },
      { href: "/contracts", label: "Contracte B2B (SHA-256)", shortLabel: "Contracte", icon: "📜" },
      { href: "/admin", label: "Administrare & Facturi", shortLabel: "Admin", icon: "⚙️" },
      { href: "/login", label: "Cont / Schimbă Rolul", shortLabel: "Cont", icon: "👤" },
    ],
  },
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

  // Folosim starea externă dacă este transmisă, altfel cea internă
  const collapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <aside
      className={`h-screen fixed left-0 top-0 flex flex-col z-40 bg-white border-r border-slate-200 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header Logo & Toggle Button */}
      <div className="px-3 py-4 border-b border-slate-200 flex items-center justify-between">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow-xs flex-shrink-0">
              O
            </div>
            <div className="truncate">
              <div className="font-bold text-sm text-slate-900 tracking-tight leading-tight">
                OptiFleet B2B
              </div>
              <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">
                Marketplace Cargo
              </div>
            </div>
          </Link>
        )}

        {collapsed && (
          <Link href="/" className="mx-auto">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
              O
            </div>
          </Link>
        )}

        {/* Buton Colapsare / Expandare */}
        <button
          onClick={handleToggle}
          title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
          className={`p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors ${
            collapsed ? "mx-auto mt-2" : ""
          }`}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigare */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-3 overflow-y-auto overflow-x-hidden">
        {navSections.map((sec, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            {!collapsed && (
              <div className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase truncate">
                {sec.title}
              </div>
            )}
            {sec.items.map((item) => {
              const isActive = activePath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold border-l-3 border-blue-600 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <span className="text-sm flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto flex-shrink-0"></span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Status */}
      <div className="p-2 border-t border-slate-200 bg-slate-50 flex flex-col gap-1.5">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
            <span>Server Axum/Rust:</span>
            <span
              className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold"
              style={{
                background: isLive ? "#dcfce7" : "#eff6ff",
                color: isLive ? "#16a34a" : "#2563eb",
                border: isLive ? "1px solid #bbf7d0" : "1px solid #bfdbfe",
              }}
            >
              {isLive ? "● ONLINE" : "○ LOCAL"}
            </span>
          </div>
        ) : (
          <div className="flex justify-center" title="Server Status">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: isLive ? "#16a34a" : "#2563eb" }}
            ></span>
          </div>
        )}
      </div>
    </aside>
  );
}
