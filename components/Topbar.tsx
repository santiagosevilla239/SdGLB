"use client";

import Image from "next/image";
import { useUIStore } from "@/store/useUIStore";

interface TopbarProps {
  user: any;
}

export default function Topbar({ user }: TopbarProps) {
  const userName = user?.profile?.full_name || "Usuario";
  const userRole = user?.profile?.role || "user";
  const scopeLabel = userRole === "admin" ? "Fábrica Central" : "Sucursal";
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <header className="sticky top-0 z-50 h-[56px] bg-bg-canvas border-b border-border-subtle flex items-center justify-between px-5 gap-4">
      <div className="flex items-center gap-4">
        {/* Botón menú responsive */}
        <button 
          onClick={toggleSidebar}
          className="md:hidden w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-bg-surface rounded-md transition-colors"
          aria-label="Abrir menú"
        >
          <i className="ti ti-menu-2 text-[20px]"></i>
        </button>

        <Image
          src="/assets/logo.svg"
          alt="Los Bambinos"
          width={100}
          height={22}
          className="h-[22px] w-auto"
          style={{ width: 'auto' }}
        />
        <div className="w-px h-[18px] bg-border-strong shrink-0 hidden sm:block" aria-hidden="true"></div>
        <span className="text-[14px] text-text-secondary font-medium hidden sm:inline">
          {scopeLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[14px] text-text-secondary hidden sm:inline">
          {userName}
        </span>
        <div className="w-8 h-8 rounded-full bg-bg-surface border border-border-strong flex items-center justify-center text-[11px] font-medium text-text-primary uppercase shrink-0">
          {userName[0]}
        </div>
      </div>
    </header>
  );
}
