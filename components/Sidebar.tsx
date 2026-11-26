"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/actions/auth";
import { useUIStore } from "@/store/useUIStore";

interface SidebarProps {
  role?: string;
}

export default function Sidebar({ role = "user" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, closeSidebar } = useUIStore();

  const handleLogout = async () => {
    await signOut();
    closeSidebar();
    router.push("/login");
    router.refresh();
  };

  const adminNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: "ti-layout-dashboard" },
    { label: "Inventario", href: "/dashboard/inventory", icon: "ti-package" },
    { label: "Pedidos", href: "/dashboard/orders", icon: "ti-clipboard-list" },
    {
      label: "Cuenta Corriente",
      href: "/dashboard/account",
      icon: "ti-wallet",
    },
    { label: "Producción", href: "/dashboard/production", icon: "ti-building-factory" },
    { label: "Métricas", href: "/dashboard/metrics", icon: "ti-chart-bar" },
    { label: "Ajustes", href: "/dashboard/settings", icon: "ti-settings" },
  ];

  const branchNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: "ti-layout-dashboard" },
    { label: "Inventario", href: "/dashboard/inventory", icon: "ti-package" },
    { label: "Catálogo", href: "/dashboard/catalog", icon: "ti-shopping-cart" },
    { label: "Pedidos", href: "/dashboard/orders", icon: "ti-clipboard-list" },
    {
      label: "Cuenta Corriente",
      href: "/dashboard/account",
      icon: "ti-wallet",
    },
    {
      label: "Consumo Diario",
      href: "/dashboard/consumptions",
      icon: "ti-barcode",
    },
    { label: "Métricas", href: "/dashboard/metrics", icon: "ti-chart-bar" },
    { label: "Ajustes", href: "/dashboard/settings", icon: "ti-settings" },
  ];

  const empleadoNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: "ti-layout-dashboard" },
    { label: "Inventario", href: "/dashboard/inventory", icon: "ti-package" },
    { label: "Catálogo", href: "/dashboard/catalog", icon: "ti-shopping-cart" },
    { label: "Pedidos", href: "/dashboard/orders", icon: "ti-clipboard-list" },
    {
      label: "Consumo Diario",
      href: "/dashboard/consumptions",
      icon: "ti-barcode",
    },
  ];

  const navItems =
    role === "admin"
      ? adminNavItems
      : role === "empleado"
        ? empleadoNavItems
        : branchNavItems;

  return (
    <>
      {/* Overlay para móvil */}
      <div
        className={`fixed inset-0 bg-black/40 z-[60] md:hidden transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeSidebar}
      />

      {/* Sidebar Container */}
      <nav
        className={`
        fixed md:sticky top-0 md:top-[56px] left-0 z-[70] md:z-auto
        h-full md:h-[calc(100vh-56px)] w-[260px] md:w-[220px] 
        bg-bg-canvas border-r border-border-subtle p-4 flex flex-col 
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        {/* Header de Sidebar solo en móvil para poder cerrar */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <span className="font-bold text-brand">Menú</span>
          <button
            onClick={closeSidebar}
            className="p-2 -mr-2 text-text-secondary"
          >
            <i className="ti ti-x text-xl"></i>
          </button>
        </div>

        <ul className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 h-10 px-3 rounded-md text-[14px] transition-colors ${
                    isActive
                      ? "bg-bg-surface text-text-primary font-medium"
                      : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                  }`}
                >
                  <i
                    className={`ti ${item.icon} text-[18px]`}
                    aria-hidden="true"
                  ></i>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="pt-4 border-t border-border-subtle mt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 h-10 px-3 rounded-md text-[14px] text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors cursor-pointer text-left"
          >
            <i className="ti ti-logout text-[18px]" aria-hidden="true"></i>
            <span>Salir</span>
          </button>
        </div>
      </nav>
    </>
  );
}
