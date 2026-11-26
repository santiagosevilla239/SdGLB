"use client";

import { useEffect, useState } from "react";
import { getAllOrders } from "@/actions/orders";
import { OrdersMobileCards } from "./OrdersMobileCards";
import { OrdersDesktopTable } from "./OrdersDesktopTable";
import { OrderModals } from "./OrderModals";
import { OrderWithDetails } from "@/types/database";

type ModalType = "detalle" | "rechazar" | "despachar" | null;

export default function AdminOrders() {
  const [modalState, setModalState] = useState<{ type: ModalType, order: OrderWithDetails | null }>({ type: null, order: null });
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      setIsLoading(true);
      const data = await getAllOrders();
      setOrders(data);
      setIsLoading(false);
    }
    fetchOrders();
  }, []);

  const refreshOrders = async () => {
    setIsLoading(true);
    const data = await getAllOrders();
    setOrders(data);
    setIsLoading(false);
  };

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

  const pendingOrders = orders.filter((o) => o.status === "pendiente" || o.status === "contraoferta");
  const confirmedOrders = orders.filter((o) => o.status === "confirmado");
  const dispatchedOrders = orders.filter((o) => o.status === "despachado");
  const deliveredOrders = orders.filter((o) => o.status === "entregado");

  return (
    <div className="p-6 lg:p-8">
      {/* Encabezado de página */}
      <div className="mb-8">
        <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
          Pedidos
        </h1>
        <p className="text-[14px] text-text-secondary">
          {isLoading ? "-" : pendingOrders.length} pendientes de despacho · {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Tabla de pedidos */}
      <section className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-canvas/50">
          <h2 className="text-[16px] font-medium text-text-primary">Todos los pedidos</h2>
        </div>
        
        <OrdersMobileCards
          isLoading={isLoading}
          orders={orders}
          pendingOrders={pendingOrders}
          confirmedOrders={confirmedOrders}
          dispatchedOrders={dispatchedOrders}
          deliveredOrders={deliveredOrders}
          formatRelativeTime={formatRelativeTime}
          setModalState={setModalState}
        />

        <OrdersDesktopTable
          isLoading={isLoading}
          orders={orders}
          pendingOrders={pendingOrders}
          confirmedOrders={confirmedOrders}
          dispatchedOrders={dispatchedOrders}
          deliveredOrders={deliveredOrders}
          formatRelativeTime={formatRelativeTime}
          setModalState={setModalState}
        />
      </section>

      <OrderModals modalState={modalState} setModalState={setModalState} onRefresh={refreshOrders} />
    </div>
  );
}
