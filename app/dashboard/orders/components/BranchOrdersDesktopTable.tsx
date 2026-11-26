import { Dispatch, SetStateAction } from "react";
import { OrderWithDetails } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ModalType = "detalle" | "cancelar" | null;

interface BranchOrdersDesktopTableProps {
  isLoading: boolean;
  orders: OrderWithDetails[];
  pending: OrderWithDetails[];
  received: OrderWithDetails[];
  cancelled: OrderWithDetails[];
  role?: string;
  setModalState: Dispatch<SetStateAction<{ type: ModalType, order: OrderWithDetails | null }>>;
}

export function BranchOrdersDesktopTable({
  isLoading,
  orders,
  pending,
  received,
  cancelled,
  role = "user",
  setModalState,
}: BranchOrdersDesktopTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead className="bg-bg-surface">
          <tr>
            <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
              Pedido
            </th>
            <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas text-right">
              Ítems
            </th>
            <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
              Enviado
            </th>
            <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas w-[180px]">
              Estado
            </th>
            <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas w-[280px] text-right">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {isLoading && (
            <tr>
              <td
                colSpan={5}
                className="px-5 py-8 text-center text-sm text-text-secondary"
              >
                Cargando pedidos...
              </td>
            </tr>
          )}
          {!isLoading && orders.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-5 py-8 text-center text-sm text-text-secondary"
              >
                Aún no hiciste pedidos.
              </td>
            </tr>
          )}



          {/* Pendientes */}
          {pending.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={5}
                  className="bg-bg-surface px-5 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide border-y border-border-subtle mt-4"
                >
                  Esperando a la fábrica
                </td>
              </tr>
              {pending.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-bg-surface transition-colors cursor-default"
                >
                  <td className="px-5 py-3 font-medium font-mono text-text-primary">
                    {order.id}
                  </td>
                  <td className="px-5 py-3 font-mono text-text-primary text-right">
                    {order.items}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">
                    {format(new Date(order.createdAt), "dd MMM HH:mm", {
                      locale: es,
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center py-0.5 px-2.5 whitespace-nowrap rounded-full text-xs font-medium bg-warning-soft-bg text-warning">
                      Esperando confirmación
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() =>
                        setModalState({ type: "detalle", order })
                      }
                      className="btn btn-ghost btn-sm mr-2"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() =>
                        setModalState({ type: "cancelar", order })
                      }
                      className="btn btn-destructive btn-sm"
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ))}
            </>
          )}



          {/* Recibidos */}
          {received.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={5}
                  className="bg-bg-surface px-5 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide border-y border-border-subtle mt-4"
                >
                  Recibidos
                </td>
              </tr>
              {received.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-bg-surface transition-colors opacity-60 hover:opacity-100 cursor-default"
                >
                  <td className="px-5 py-3 font-medium font-mono text-text-primary">
                    {order.id}
                  </td>
                  <td className="px-5 py-3 font-mono text-text-primary text-right">
                    {order.items}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">
                    {format(new Date(order.createdAt), "dd MMM HH:mm", {
                      locale: es,
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center py-0.5 px-2.5 whitespace-nowrap rounded-full text-xs font-medium bg-border-subtle text-text-secondary">
                      Recibido
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() =>
                        setModalState({ type: "detalle", order })
                      }
                      className="btn btn-ghost btn-sm"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </>
          )}

          {/* Cancelados */}
          {cancelled.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={5}
                  className="bg-bg-surface px-5 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide border-y border-border-subtle mt-4"
                >
                  Cancelados
                </td>
              </tr>
              {cancelled.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-bg-surface transition-colors opacity-60 hover:opacity-100 cursor-default"
                >
                  <td className="px-5 py-3 font-medium font-mono text-text-primary">
                    {order.id}
                  </td>
                  <td className="px-5 py-3 font-mono text-text-primary text-right">
                    {order.items}
                  </td>
                  <td className="px-5 py-3 text-sm text-text-secondary">
                    {format(new Date(order.createdAt), "dd MMM HH:mm", {
                      locale: es,
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center py-0.5 px-2.5 whitespace-nowrap rounded-full text-xs font-medium bg-danger-soft-bg text-danger">
                      Cancelado
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() =>
                        setModalState({ type: "detalle", order })
                      }
                      className="btn btn-ghost btn-sm"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
