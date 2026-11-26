import { Dispatch, SetStateAction } from "react";
import { OrderWithDetails } from "@/types/database";

type ModalType = "detalle" | "rechazar" | "despachar" | null;

interface OrdersMobileCardsProps {
  isLoading: boolean;
  orders: OrderWithDetails[];
  pendingOrders: OrderWithDetails[];
  confirmedOrders: OrderWithDetails[];
  dispatchedOrders: OrderWithDetails[];
  deliveredOrders: OrderWithDetails[];
  formatRelativeTime: (date: string) => string;
  setModalState: Dispatch<SetStateAction<{ type: ModalType, order: OrderWithDetails | null }>>;
}

export function OrdersMobileCards({
  isLoading,
  orders,
  pendingOrders,
  confirmedOrders,
  dispatchedOrders,
  deliveredOrders,
  formatRelativeTime,
  setModalState,
}: OrdersMobileCardsProps) {
  return (
    <div className="md:hidden flex flex-col gap-6 p-4 bg-bg-canvas/50">
      {isLoading ? (
        <div className="text-center text-text-secondary text-[14px] py-8 bg-bg-canvas border border-border-subtle rounded-lg">
          Cargando pedidos...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-text-secondary text-[14px] py-8 bg-bg-canvas border border-border-subtle rounded-lg">
          No hay pedidos registrados.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Pendientes */}
          {pendingOrders.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.3px]">
                Pendientes de despacho
              </h3>
              {pendingOrders.map((order) => (
                <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden flex flex-col shadow-sm">
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[12px] font-mono text-text-secondary mb-1">{order.id}</p>
                        <h4 className="text-[16px] font-medium text-text-primary">{order.branchName}</h4>
                      </div>
                      <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-warning-soft-bg text-warning-soft-text text-[11px] font-medium whitespace-nowrap">
                        Pendiente
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Ítems</span>
                        <span className="text-text-primary font-mono text-[14px]">{order.items}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Recibido</span>
                        <span className="text-text-primary text-[13px]">{formatRelativeTime(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-surface flex flex-wrap justify-end border-t border-border-subtle gap-2">
                    <button onClick={() => setModalState({ type: "detalle", order })} className="h-[36px] px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">
                      Detalle
                    </button>
                    {(order.status === "pendiente" || order.status === "contraoferta") && (
                      <>
                        <button onClick={() => setModalState({ type: "despachar", order })} className="h-[36px] px-3 text-[12px] font-medium text-white bg-success hover:bg-success-hover rounded-md transition-colors">
                          <i className="ti ti-truck text-[14px] mr-1"></i>
                          Despachar
                        </button>
                        <button onClick={() => setModalState({ type: "rechazar", order })} className="h-[36px] px-3 text-[12px] font-medium text-danger bg-danger-soft-bg hover:bg-danger/10 rounded-md transition-colors">
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Confirmados */}
          {confirmedOrders.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.3px]">
                Confirmados · listos para despachar
              </h3>
              {confirmedOrders.map((order) => (
                <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden flex flex-col shadow-sm">
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[12px] font-mono text-text-secondary mb-1">{order.id}</p>
                        <h4 className="text-[16px] font-medium text-text-primary">{order.branchName}</h4>
                      </div>
                      <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-success-soft-bg text-success-soft-text text-[11px] font-medium whitespace-nowrap">
                        Confirmado
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Ítems</span>
                        <span className="text-text-primary font-mono text-[14px]">{order.items}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Recibido</span>
                        <span className="text-text-primary text-[13px]">{formatRelativeTime(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-surface flex justify-end border-t border-border-subtle gap-2">
                    <button onClick={() => setModalState({ type: "detalle", order })} className="h-[36px] px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">
                      Detalle
                    </button>
                    <button onClick={() => setModalState({ type: "despachar", order })} className="inline-flex items-center gap-1.5 h-[36px] px-3 text-[12px] font-medium text-white bg-success hover:bg-success-hover rounded-md transition-colors">
                      <i className="ti ti-truck text-[14px]"></i>
                      Despachar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Despachados */}
          {dispatchedOrders.length > 0 && (
            <div className="flex flex-col gap-3 opacity-60">
              <h3 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.3px]">
                Despachados
              </h3>
              {dispatchedOrders.map((order) => (
                <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg p-4 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[12px] font-mono text-text-secondary mb-1">{order.id}</p>
                      <h4 className="text-[16px] font-medium text-text-primary">{order.branchName}</h4>
                    </div>
                    <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-bg-surface text-text-secondary border border-border-subtle text-[11px] font-medium whitespace-nowrap">
                      Despachado
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
                    <div className="flex flex-col gap-1">
                      <span className="text-text-secondary">Ítems</span>
                      <span className="text-text-primary font-mono text-[14px]">{order.items}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-text-secondary">Recibido</span>
                      <span className="text-text-primary text-[13px]">{formatRelativeTime(order.createdAt)}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-surface flex justify-end border-t border-border-subtle">
                    <button onClick={() => setModalState({ type: "detalle", order })} className="h-[36px] px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">
                      Ver detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Entregados */}
          {deliveredOrders.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.3px]">
                Entregados
              </h3>
              {deliveredOrders.map((order) => (
                <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden flex flex-col shadow-sm opacity-60">
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[12px] font-mono text-text-secondary mb-1">{order.id}</p>
                        <h4 className="text-[16px] font-medium text-text-primary">{order.branchName}</h4>
                      </div>
                      <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-bg-surface text-text-secondary border border-border-subtle text-[11px] font-medium whitespace-nowrap">
                        Entregado
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Ítems</span>
                        <span className="text-text-primary font-mono text-[14px]">{order.items}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Recibido</span>
                        <span className="text-text-primary text-[13px]">{formatRelativeTime(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-surface flex flex-wrap justify-end border-t border-border-subtle">
                    <button onClick={() => setModalState({ type: "detalle", order })} className="h-[36px] px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">
                      Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
