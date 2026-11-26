import { Dispatch, SetStateAction } from "react";
import { OrderWithDetails } from "@/types/database";

type ModalType = "detalle" | "rechazar" | "despachar" | null;

interface OrdersDesktopTableProps {
  isLoading: boolean;
  orders: OrderWithDetails[];
  pendingOrders: OrderWithDetails[];
  confirmedOrders: OrderWithDetails[];
  dispatchedOrders: OrderWithDetails[];
  deliveredOrders: OrderWithDetails[];
  formatRelativeTime: (date: string) => string;
  setModalState: Dispatch<SetStateAction<{ type: ModalType, order: OrderWithDetails | null }>>;
}

export function OrdersDesktopTable({
  isLoading,
  orders,
  pendingOrders,
  confirmedOrders,
  dispatchedOrders,
  deliveredOrders,
  formatRelativeTime,
  setModalState,
}: OrdersDesktopTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-bg-surface">
          <tr>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">Pedido</th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">Sucursal</th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">Ítems</th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">Recibido</th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase w-[120px]">Estado</th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase w-[230px] text-right">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-text-secondary text-[14px]">
                Cargando pedidos...
              </td>
            </tr>
          ) : orders.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-text-secondary text-[14px]">
                No hay pedidos registrados.
              </td>
            </tr>
          ) : (
            <>
              {/* Pendientes */}
              {pendingOrders.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="bg-bg-surface px-5 py-2 text-[11px] font-medium text-text-tertiary uppercase tracking-[0.3px] border-b border-border-subtle">
                      Pendientes de despacho
                    </td>
                  </tr>
                  {pendingOrders.map((order, i) => (
                    <tr key={order.id} className="hover:bg-bg-surface transition-colors cursor-default">
                      <td className="px-5 py-3 text-[12px] font-medium font-mono text-text-primary">{order.id}</td>
                      <td className="px-5 py-3 text-[14px] text-text-primary">{order.branchName}</td>
                      <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">{order.items}</td>
                      <td className="px-5 py-3 text-[11px] text-text-secondary">{formatRelativeTime(order.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-warning-soft-bg text-warning-soft-text text-[11px] font-medium whitespace-nowrap">Pendiente</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setModalState({ type: "detalle", order })} className="h-8 px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors mr-2">Ver detalle</button>
                        {(order.status === "pendiente" || order.status === "contraoferta") && (
                          <>
                            <button onClick={() => setModalState({ type: "despachar", order })} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white bg-success hover:bg-success-hover rounded-md transition-colors mr-2">
                              <i className="ti ti-truck text-[14px]"></i>
                              Despachar
                            </button>
                            <button onClick={() => setModalState({ type: "rechazar", order })} className="h-8 px-3 text-[12px] font-medium text-danger bg-danger-soft-bg hover:bg-danger/10 rounded-md transition-colors">Rechazar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Confirmados */}
              {confirmedOrders.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="bg-bg-surface px-5 py-2 text-[11px] font-medium text-text-tertiary uppercase tracking-[0.3px] border-y border-border-subtle mt-4">
                      Confirmados · listos para despachar
                    </td>
                  </tr>
                  {confirmedOrders.map((order, i) => (
                    <tr key={order.id} className="hover:bg-bg-surface transition-colors cursor-default">
                      <td className="px-5 py-3 text-[12px] font-medium font-mono text-text-primary">{order.id}</td>
                      <td className="px-5 py-3 text-[14px] text-text-primary">{order.branchName}</td>
                      <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">{order.items}</td>
                      <td className="px-5 py-3 text-[11px] text-text-secondary">{formatRelativeTime(order.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-success-soft-bg text-success-soft-text text-[11px] font-medium whitespace-nowrap">Confirmado</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setModalState({ type: "detalle", order })} className="h-8 px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors mr-2">Ver detalle</button>
                        <button onClick={() => setModalState({ type: "despachar", order })} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white bg-success hover:bg-success-hover rounded-md transition-colors">
                          <i className="ti ti-truck text-[14px]"></i>
                          Despachar
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Despachados */}
              {dispatchedOrders.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="bg-bg-surface px-5 py-2 text-[11px] font-medium text-text-tertiary uppercase tracking-[0.3px] border-y border-border-subtle mt-4">
                      Despachados
                    </td>
                  </tr>
                  {dispatchedOrders.map((order, i) => (
                    <tr key={order.id} className="hover:bg-bg-surface transition-colors cursor-default opacity-55">
                      <td className="px-5 py-3 text-[12px] font-medium font-mono text-text-primary">{order.id}</td>
                      <td className="px-5 py-3 text-[14px] text-text-primary">{order.branchName}</td>
                      <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">{order.items}</td>
                      <td className="px-5 py-3 text-[11px] text-text-secondary">{formatRelativeTime(order.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-bg-surface text-text-secondary border border-border-subtle text-[11px] font-medium whitespace-nowrap">Despachado</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setModalState({ type: "detalle", order })} className="h-8 px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">Ver detalle</button>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Entregados */}
              {deliveredOrders.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="bg-bg-surface px-5 py-2 text-[11px] font-medium text-text-tertiary uppercase tracking-[0.3px] border-y border-border-subtle mt-4">
                      Entregados
                    </td>
                  </tr>
                  {deliveredOrders.map((order, i) => (
                    <tr key={order.id} className="hover:bg-bg-surface transition-colors cursor-default opacity-55">
                      <td className="px-5 py-3 text-[12px] font-medium font-mono text-text-primary">{order.id}</td>
                      <td className="px-5 py-3 text-[14px] text-text-primary">{order.branchName}</td>
                      <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">{order.items}</td>
                      <td className="px-5 py-3 text-[11px] text-text-secondary">{formatRelativeTime(order.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-bg-surface text-text-secondary border border-border-subtle text-[11px] font-medium whitespace-nowrap">Entregado</span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setModalState({ type: "detalle", order })} className="h-8 px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">Ver detalle</button>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
