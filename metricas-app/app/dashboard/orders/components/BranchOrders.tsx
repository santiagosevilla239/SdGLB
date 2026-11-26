"use client";

import { useEffect, useState } from "react";
import { getBranchOrders } from "@/actions/orders";
import Link from "next/link";

import BranchOrderModals from "./BranchOrderModals";
import { OrderWithDetails } from "@/types/database";
import { BranchOrdersMobileCards } from "./BranchOrdersMobileCards";
import { BranchOrdersDesktopTable } from "./BranchOrdersDesktopTable";

interface BranchOrdersProps {
  role?: string;
}

export default function BranchOrders({ role = "user" }: BranchOrdersProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalState, setModalState] = useState<{
    type: "detalle" | "cancelar" | null;
    order: OrderWithDetails | null;
  }>({ type: null, order: null });

  useEffect(() => {
    async function fetchOrders() {
      setIsLoading(true);
      const data = await getBranchOrders();
      setOrders(data);
      setIsLoading(false);
    }
    fetchOrders();
  }, []);

  const refreshOrders = async () => {
    setIsLoading(true);
    const data = await getBranchOrders();
    setOrders(data);
    setIsLoading(false);
  };

  const pending = orders.filter((o) => o.status === "pendiente");
  const received = orders.filter((o) => o.status === "entregado");
  const cancelled = orders.filter((o) => o.status === "cancelado" || o.status === "rechazado");

  return (
    <div className="p-6 lg:p-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
            Mis pedidos
          </h1>
          <p className="text-[14px] text-text-secondary">
            {pending.length} esperando confirmación de fábrica
          </p>
        </div>
        <Link
          href="/dashboard/catalog"
          className="btn btn-primary h-12 px-5 gap-2"
        >
          <i className="ti ti-plus"></i>
          Pedido nuevo
        </Link>
      </div>

      {/* Tabla */}
      <section className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-surface">
          <h2 className="text-[16px] font-medium text-text-primary">
            Todos mis pedidos
          </h2>
        </div>
        <BranchOrdersMobileCards
          isLoading={isLoading}
          orders={orders}
          pending={pending}
          received={received}
          cancelled={cancelled}
          setModalState={setModalState}
          role={role}
        />

        <BranchOrdersDesktopTable
          isLoading={isLoading}
          orders={orders}
          pending={pending}
          received={received}
          cancelled={cancelled}
          setModalState={setModalState}
          role={role}
        />
      </section>

      <BranchOrderModals
        modalState={modalState}
        setModalState={setModalState}
        onRefresh={refreshOrders}
        role={role}
      />
    </div>
  );
}
