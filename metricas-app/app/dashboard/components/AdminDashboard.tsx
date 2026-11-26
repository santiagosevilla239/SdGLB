"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStockAlerts } from "@/actions/flavors";
import { getAdminDashboardKPIs, getLatestOrders } from "@/actions/dashboard";
import { RoleEnum } from "@/types/database";

interface AdminDashboardProps {
  user: {
    id: string;
    email?: string;
    profile: {
      role: RoleEnum | string;
      full_name: string;
    };
  };
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const userName = user.profile.full_name || "Administrador";

  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  const [kpiData, setKpiData] = useState({
    pendingOrders: 0,
    tubsWeighedToday: 0,
    dispatchesToday: 0,
  });
  const [isLoadingKpis, setIsLoadingKpis] = useState(true);

  const [latestOrders, setLatestOrders] = useState<any[]>([]);
  const [isLoadingLatestOrders, setIsLoadingLatestOrders] = useState(true);

  // Helper for time
  function formatRelativeTime(dateString: string) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24)
      return `Hace ${diffInHours} hora${diffInHours > 1 ? "s" : ""}`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Ayer";
    return `Hace ${diffInDays} días`;
  }

  useEffect(() => {
    async function fetchData() {
      setIsLoadingAlerts(true);
      setIsLoadingKpis(true);
      setIsLoadingLatestOrders(true);

      const [alertsRes, kpiRes, ordersRes] = await Promise.all([
        getStockAlerts(),
        getAdminDashboardKPIs(),
        getLatestOrders(),
      ]);

      if ("alerts" in alertsRes && alertsRes.alerts) {
        setAlerts(alertsRes.alerts);
      }
      setIsLoadingAlerts(false);

      setKpiData(kpiRes);
      setIsLoadingKpis(false);

      setLatestOrders(ordersRes);
      setIsLoadingLatestOrders(false);
    }
    fetchData();
  }, []);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
          Hola, {userName}
        </h1>
        <p className="text-[14px] text-text-secondary">
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Pedidos por confirmar",
            value: isLoadingKpis ? "-" : kpiData.pendingOrders.toString(),
            link: "/dashboard/orders",
          },
          {
            label: "Latas pesadas hoy",
            value: isLoadingKpis ? "-" : kpiData.tubsWeighedToday.toString(),
            link: "/dashboard/inventory",
          },
          {
            label: "Despachos del día",
            value: isLoadingKpis ? "-" : kpiData.dispatchesToday.toString(),
            link: "/dashboard/orders",
          },
          {
            label: "Stock limitado o nulo",
            value: isLoadingAlerts ? "-" : alerts.length.toString(),
            link: "/dashboard/inventory",
            alert: true,
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="bg-bg-canvas border border-border-subtle rounded-lg p-5 flex flex-col gap-2 shadow-sm"
          >
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              {kpi.label}
            </span>
            <span
              className={`text-[32px] font-medium leading-tight ${kpi.alert ? "text-brand" : "text-text-primary"}`}
            >
              {kpi.value}
            </span>
            <Link
              href={kpi.link}
              className="text-[11px] text-brand hover:underline flex items-center gap-1 mt-auto pt-3"
            >
              Ver detalles
              <i className="ti ti-arrow-right"></i>
            </Link>
          </div>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-6">
        {/* Alertas de Stock */}
        <section className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-canvas/50">
            <h2 className="text-[16px] font-medium text-text-primary">
              Alertas de stock
            </h2>
            <Link
              href="/dashboard/inventory"
              className="text-[11px] text-brand hover:underline"
            >
              Ver inventario completo
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
                    Producto
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase text-right">
                    Latas
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {isLoadingAlerts ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-text-secondary text-[14px]"
                    >
                      Cargando alertas...
                    </td>
                  </tr>
                ) : alerts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-text-secondary text-[14px]"
                    >
                      No hay alertas de stock.
                    </td>
                  </tr>
                ) : (
                  alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td className="px-5 py-3 text-[14px] text-text-primary">
                        {alert.name}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-text-secondary text-right font-mono">
                        {alert.stock}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium ${
                            alert.statusType === "Sin stock"
                              ? "bg-brand-soft-bg text-brand-soft-text"
                              : "bg-warning-soft-bg text-warning-soft-text"
                          }`}
                        >
                          {alert.statusType}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Últimos Pedidos */}
        <section className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-canvas/50">
            <h2 className="text-[16px] font-medium text-text-primary">
              Últimos pedidos recibidos
            </h2>
            <Link
              href="/dashboard/orders"
              className="text-[11px] text-brand hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-surface">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
                    Pedido
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
                    Sucursal
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase text-right">
                    Ítems
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
                    Recibido
                  </th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {isLoadingLatestOrders ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-text-secondary text-[14px]"
                    >
                      Cargando pedidos...
                    </td>
                  </tr>
                ) : latestOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-text-secondary text-[14px]"
                    >
                      No hay pedidos recientes.
                    </td>
                  </tr>
                ) : (
                  latestOrders.map((order, i) => (
                    <tr
                      key={i}
                      className="hover:bg-bg-surface transition-colors cursor-default"
                    >
                      <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">
                        {order.id}
                      </td>
                      <td className="px-5 py-3 text-[14px] text-text-primary">
                        {order.branchName}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-text-secondary text-right font-mono">
                        {order.items}
                      </td>
                      <td className="px-5 py-3 text-[11px] text-text-secondary">
                        {formatRelativeTime(order.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium ${
                            order.status === "pendiente"
                              ? "bg-warning-soft-bg text-warning-soft-text"
                              : order.status === "confirmado"
                                ? "bg-success-soft-bg text-success-soft-text"
                                : "bg-bg-surface text-text-secondary border border-border-subtle"
                          }`}
                        >
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
