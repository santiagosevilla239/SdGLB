import { Dispatch, SetStateAction } from "react";
import { OrderWithDetails } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ModalType = "detalle" | "cancelar" | null;

interface BranchOrdersMobileCardsProps {
  isLoading: boolean;
  orders: OrderWithDetails[];
  pending: OrderWithDetails[];
  received: OrderWithDetails[];
  cancelled: OrderWithDetails[];
  role?: string;
  setModalState: Dispatch<SetStateAction<{ type: ModalType, order: OrderWithDetails | null }>>;
}

export function BranchOrdersMobileCards({
  isLoading,
  orders,
  pending,
  received,
  cancelled,
  role = "user",
  setModalState,
}: BranchOrdersMobileCardsProps) {
  return (
    <div className="md:hidden flex flex-col gap-6 p-4 bg-bg-canvas/50">
      {isLoading ? (
        <div className="text-center text-text-secondary text-[14px] py-8 bg-bg-canvas border border-border-subtle rounded-lg">
          Cargando pedidos...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-text-secondary text-[14px] py-8 bg-bg-canvas border border-border-subtle rounded-lg">
          Aún no hiciste pedidos.
        </div>
      ) : (
        <div className="flex flex-col gap-6">


          {/* Pendientes */}
          {pending.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.3px]">
                Esperando a la fábrica
              </h3>
              {pending.map((order) => (
                <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden flex flex-col shadow-sm">
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[12px] font-mono text-text-secondary mb-1">{order.id}</p>
                      </div>
                      <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-warning-soft-bg text-warning text-[11px] font-medium whitespace-nowrap">
                        Esperando confirmación
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Ítems</span>
                        <span className="text-text-primary font-mono text-[14px]">{order.items}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Enviado</span>
                        <span className="text-text-primary text-[13px]">
                          {format(new Date(order.createdAt), "dd MMM HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-surface flex flex-wrap justify-end border-t border-border-subtle gap-2">
                    <button onClick={() => setModalState({ type: "detalle", order })} className="h-[36px] px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">
                      Ver detalle
                    </button>
                    <button onClick={() => setModalState({ type: "cancelar", order })} className="h-[36px] px-3 text-[12px] font-medium text-danger bg-danger-soft-bg hover:bg-danger/10 rounded-md transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}



          {/* Recibidos */}
          {received.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.3px]">
                Recibidos
              </h3>
              {received.map((order) => (
                <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden flex flex-col shadow-sm opacity-60">
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[12px] font-mono text-text-secondary mb-1">{order.id}</p>
                      </div>
                      <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-bg-surface text-text-secondary border border-border-subtle text-[11px] font-medium whitespace-nowrap">
                        Recibido
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Ítems</span>
                        <span className="text-text-primary font-mono text-[14px]">{order.items}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Enviado</span>
                        <span className="text-text-primary text-[13px]">
                          {format(new Date(order.createdAt), "dd MMM HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-surface flex flex-wrap justify-end border-t border-border-subtle gap-2">
                    <button onClick={() => setModalState({ type: "detalle", order })} className="h-[36px] px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">
                      Ver detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cancelados */}
          {cancelled.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.3px]">
                Cancelados
              </h3>
              {cancelled.map((order) => (
                <div key={order.id} className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden flex flex-col shadow-sm opacity-60">
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[12px] font-mono text-text-secondary mb-1">{order.id}</p>
                      </div>
                      <span className="inline-flex items-center py-0.5 px-2.5 rounded-full bg-danger-soft-bg text-danger text-[11px] font-medium whitespace-nowrap">
                        Cancelado
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Ítems</span>
                        <span className="text-text-primary font-mono text-[14px]">{order.items}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Enviado</span>
                        <span className="text-text-primary text-[13px]">
                          {format(new Date(order.createdAt), "dd MMM HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-bg-surface flex flex-wrap justify-end border-t border-border-subtle gap-2">
                    <button onClick={() => setModalState({ type: "detalle", order })} className="h-[36px] px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors">
                      Ver detalle
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
