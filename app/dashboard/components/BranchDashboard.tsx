import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FlavorWithStock, OrderWithDetails, RoleEnum } from "@/types/database";

interface BranchDashboardProps {
  user: {
    id: string;
    email?: string;
    profile: {
      role: RoleEnum | string;
      full_name: string;
    };
  };
  data: {
    kpis: {
      toReplenish: number;
      inTransit: number;
      pending: number;
      inGondola: number;
    };
    latestInTransitOrder: { id: string; status: string } | null;
    lowStockFlavors: {
      id: string;
      name: string;
      stock: number;
      estado: string;
    }[];
    latestOrders: OrderWithDetails[];
  };
}

export default function BranchDashboard({ user, data }: BranchDashboardProps) {
  const userName = user?.profile?.full_name?.split(" ")[0] || "Usuario";
  const currentDate = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", {
    locale: es,
  });
  const capitalizedDate =
    currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
          Buen día, {userName}
        </h1>
        <p className="text-text-secondary text-sm md:text-base">
          {capitalizedDate} · Sucursal
        </p>
      </div>

      {/* Transit Banner */}
      {data?.latestInTransitOrder && (
        <div className="flex items-center gap-4 p-4 md:p-5 bg-success-soft-bg border border-border-subtle rounded-xl flex-wrap md:flex-nowrap">
          <i className="ti ti-truck-delivery text-[28px] text-success shrink-0"></i>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-text-primary mb-0.5">
              Tenés un pedido en camino
            </p>
            <p className="text-sm text-text-secondary">
              {data.latestInTransitOrder.id} salió de fábrica. Cuando llegue,
              confirmá la recepción.
            </p>
          </div>
          <Link
            href="/dashboard/orders"
            className="btn btn-primary w-full md:w-auto mt-3 md:mt-0"
          >
            <i className="ti ti-package-import"></i>
            Ver pedido
          </Link>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-danger-soft-bg border border-danger-border rounded-xl p-5 flex flex-col items-start shadow-sm">
          <span className="text-xs font-medium text-danger uppercase tracking-wider mb-2">
            Sabores para reponer
          </span>
          <span className="text-3xl font-bold text-danger mb-4">
            {data?.kpis?.toReplenish || 0}
          </span>
          <Link
            href="/dashboard/catalog"
            className="text-sm font-medium text-danger hover:underline mt-auto flex items-center gap-1"
          >
            Pedir a fábrica
            <i className="ti ti-arrow-right"></i>
          </Link>
        </div>

        {/* KPI 2 */}
        <div className="bg-bg-canvas border border-border-subtle rounded-xl p-5 flex flex-col items-start shadow-sm hover:shadow-md transition-shadow">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Pedidos en camino
          </span>
          <span className="text-3xl font-bold text-text-primary mb-4">
            {data?.kpis?.inTransit || 0}
          </span>
          <Link
            href="/dashboard/orders"
            className="text-sm font-medium text-brand hover:underline mt-auto flex items-center gap-1"
          >
            Ver pedidos
            <i className="ti ti-arrow-right"></i>
          </Link>
        </div>

        {/* KPI 3 */}
        <div className="bg-bg-canvas border border-border-subtle rounded-xl p-5 flex flex-col items-start shadow-sm hover:shadow-md transition-shadow">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Esperando confirmación
          </span>
          <span className="text-3xl font-bold text-text-primary mb-4">
            {data?.kpis?.pending || 0}
          </span>
          <Link
            href="/dashboard/orders"
            className="text-sm font-medium text-brand hover:underline mt-auto flex items-center gap-1"
          >
            Ver pedidos
            <i className="ti ti-arrow-right"></i>
          </Link>
        </div>

        {/* KPI 4 */}
        <div className="bg-bg-canvas border border-border-subtle rounded-xl p-5 flex flex-col items-start shadow-sm hover:shadow-md transition-shadow">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Sabores en stock
          </span>
          <span className="text-3xl font-bold text-text-primary mb-4">
            {data?.kpis?.inGondola || 0}
          </span>
          <Link
            href="/dashboard/inventory"
            className="text-sm font-medium text-brand hover:underline mt-auto flex items-center gap-1"
          >
            Ver mi inventario
            <i className="ti ti-arrow-right"></i>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Sabores para reponer */}
        <section className="lg:col-span-2 bg-bg-canvas border border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-surface">
            <h2 className="text-base font-semibold text-text-primary">
              Sabores para reponer
            </h2>
            <Link
              href="/dashboard/catalog"
              className="text-sm font-medium text-brand hover:underline"
            >
              Pedir a fábrica
            </Link>
          </div>
          
          {/* Mobile view */}
          <div className="md:hidden flex flex-col p-4 gap-3 bg-bg-canvas/50">
            {data?.lowStockFlavors?.length > 0 ? (
              data.lowStockFlavors.map((flavor: any) => (
                <div key={flavor.id} className="bg-bg-canvas border border-border-subtle rounded-lg p-3 flex justify-between items-center shadow-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-text-primary">{flavor.name}</span>
                    <span
                      className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        flavor.estado === "sin-stock"
                          ? "bg-danger-soft-bg text-danger"
                          : "bg-warning-soft-bg text-warning"
                      }`}
                    >
                      {flavor.estado === "sin-stock" ? "Sin stock" : "Limitado"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-text-secondary">En stock</span>
                    <span className="text-sm font-medium font-mono text-text-primary">{flavor.stock}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-text-secondary py-4">
                No hay sabores con stock bajo.
              </div>
            )}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
                    Sabor
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas text-right">
                    En stock
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data?.lowStockFlavors?.length > 0 ? (
                  data.lowStockFlavors.map((flavor: any) => (
                    <tr
                      key={flavor.id}
                      className="hover:bg-bg-surface transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-text-primary">
                        {flavor.name}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-text-primary text-right font-mono">
                        {flavor.stock}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            flavor.estado === "sin-stock"
                              ? "bg-danger-soft-bg text-danger"
                              : "bg-warning-soft-bg text-warning"
                          }`}
                        >
                          {flavor.estado === "sin-stock"
                            ? "Sin stock"
                            : "Limitado"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-sm text-text-secondary"
                    >
                      No hay sabores con stock bajo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Mis últimos pedidos */}
        <section className="lg:col-span-3 bg-bg-canvas border border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-surface">
            <h2 className="text-base font-semibold text-text-primary">
              Mis últimos pedidos
            </h2>
            <Link
              href="/dashboard/orders"
              className="text-sm font-medium text-brand hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {/* Mobile view */}
          <div className="md:hidden flex flex-col p-4 gap-3 bg-bg-canvas/50">
            {data?.latestOrders?.length > 0 ? (
              data.latestOrders.map((order: any) => {
                const statusColors: Record<string, string> = {
                  pendiente: "bg-warning-soft-bg text-warning",
                  confirmado: "bg-info-soft-bg text-info",
                  despachado: "bg-success-soft-bg text-success",
                  entregado: "bg-border-subtle text-text-secondary",
                };
                const statusLabels: Record<string, string> = {
                  pendiente: "Esperando confirmación",
                  confirmado: "Confirmado",
                  despachado: "En camino",
                  entregado: "Recibido",
                };

                return (
                  <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg p-3 flex flex-col gap-2 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-text-primary font-mono">{order.id}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>{format(new Date(order.createdAt), "dd MMM HH:mm", { locale: es })}</span>
                      <span>{order.items} ítems</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-sm text-text-secondary py-4">
                No hay pedidos recientes.
              </div>
            )}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
                    Pedido
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas text-right">
                    Ítems
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
                    Enviado
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data?.latestOrders?.length > 0 ? (
                  data.latestOrders.map((order: any) => {
                    const statusColors: Record<string, string> = {
                      pendiente: "bg-warning-soft-bg text-warning",
                      confirmado: "bg-info-soft-bg text-info",
                      despachado: "bg-success-soft-bg text-success",
                      entregado: "bg-border-subtle text-text-secondary",
                    };
                    const statusLabels: Record<string, string> = {
                      pendiente: "Esperando confirmación",
                      confirmado: "Confirmado",
                      despachado: "En camino",
                      entregado: "Recibido",
                    };

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-bg-surface transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-text-primary font-mono">
                          {order.id}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-text-primary text-right font-mono">
                          {order.items}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {format(new Date(order.createdAt), "dd MMM HH:mm", {
                            locale: es,
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}
                          >
                            {statusLabels[order.status] || order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-text-secondary"
                    >
                      No hay pedidos recientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
