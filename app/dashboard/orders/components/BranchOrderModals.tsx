import { Dispatch, SetStateAction, useState, useTransition, Fragment } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cancelOrder } from "@/actions/orders";
import { toast } from "react-toastify";
import { OrderWithDetails } from "@/types/database";
import { createUnifiedSheet, downloadExcelWorkbook } from "@/lib/excel";

interface BranchOrderModalsProps {
  modalState: { type: "detalle" | "cancelar" | null, order: OrderWithDetails | null };
  setModalState: Dispatch<SetStateAction<{ type: "detalle" | "cancelar" | null, order: OrderWithDetails | null }>>;
  onRefresh: () => void;
  role?: string;
}

export default function BranchOrderModals({ modalState, setModalState, onRefresh, role = "user" }: BranchOrderModalsProps) {
  const { type, order } = modalState;
  const [isPending, startTransition] = useTransition();
  const [diffNotes, setDiffNotes] = useState("");
  const [branchNotes, setBranchNotes] = useState("");

  if (!type || !order) return null;

  const close = () => setModalState({ type: null, order: null });

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelOrder(order.originalId!);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Pedido cancelado");
        close();
        onRefresh();
      }
    });
  };



  const handleExportOrder = async () => {
    if (!order) return;

    const includePrices = role !== "empleado";
    const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
    const statusText = order.status ? order.status.toUpperCase() : "PENDIENTE";
    const orderDate = order.createdAt;
    const formattedDate = orderDate ? format(new Date(orderDate), "dd/MM/yyyy HH:mm") : "-";

    const rows: (string | number)[][] = [];
    let totalTubsCount = 0;
    let totalWeightSum = 0;
    let totalPriceSum = 0;

    order.details?.forEach((item: any) => {
      const qty = (order.status === "pendiente" || order.status === "contraoferta" || order.status === "rechazado") 
        ? Number(item.quantity || 0) 
        : Number(item.approvedQuantity !== null && item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity || 0);

      if (item.assignedTubs && item.assignedTubs.length > 0) {
        item.assignedTubs.forEach((tub: any) => {
          const w = Number(tub.weight || 0);
          const p = Number(tub.price || 0);
          totalTubsCount += 1;
          totalWeightSum += w;
          totalPriceSum += p;

          const row: (string | number)[] = [
            "Helado",
            item.name,
            qty,
            tub.internalCode,
            w,
          ];
          if (includePrices) {
            row.push(p > 0 ? p : "-");
          }
          rows.push(row);
        });
      } else {
        totalTubsCount += qty;
        const row: (string | number)[] = [
          "Helado",
          item.name,
          qty,
          "-",
          "-",
        ];
        if (includePrices) {
          row.push("-");
        }
        rows.push(row);
      }
    });

    order.supplies?.forEach((item: any) => {
      const qty = (order.status === "pendiente" || order.status === "contraoferta" || order.status === "rechazado") 
        ? Number(item.quantity || 0) 
        : Number(item.approvedQuantity !== null && item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity || 0);
      const unitPrice = Number(item.pricePerUnit || 0);
      const supplyTotal = unitPrice * qty;
      totalPriceSum += supplyTotal;

      const row: (string | number)[] = [
        "Insumo",
        item.name,
        qty,
        "-",
        "-",
      ];
      if (includePrices) {
        row.push(supplyTotal > 0 ? supplyTotal : "-");
      }
      rows.push(row);
    });

    const metadata: string[] = [
      `Fecha de Pedido: ${formattedDate}   |   Estado: ${statusText}`,
    ];

    if (includePrices) {
      const finalPrice = Number(order.totalPrice || totalPriceSum || 0);
      if (finalPrice > 0) {
        metadata.push(
          `Importe Total Facturado: $ ${finalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
        );
      }
    }

    const headers = includePrices
      ? [
          "Tipo",
          "Nombre / Sabor",
          "Cantidad Pedida",
          "Lata Asignada (Código)",
          "Peso Lata (Kg)",
          "Importe ($)",
        ]
      : [
          "Tipo",
          "Nombre / Sabor",
          "Cantidad Pedida",
          "Lata Asignada (Código)",
          "Peso Lata (Kg)",
        ];

    const totalsRow: (string | number)[] = [
      "TOTAL",
      "",
      totalTubsCount,
      "",
      totalWeightSum > 0 ? totalWeightSum : "-",
    ];
    if (includePrices) {
      const finalPrice = Number(order.totalPrice || totalPriceSum || 0);
      totalsRow.push(finalPrice > 0 ? finalPrice : "-");
    }

    const worksheet = await createUnifiedSheet({
      title: `HELADERÍA LOS BAMBINOS - DETALLE DE PEDIDO ${shortId}`,
      metadata,
      headers,
      rows,
      totalsRow,
      numberColIndices: [2],
      weightColIndices: [4],
      currencyColIndices: includePrices ? [5] : [],
    });

    await downloadExcelWorkbook(
      `pedido_${shortId.replace("#", "")}_${format(new Date(), "ddMMyy")}.xlsx`,
      [{ sheetName: "Detalle de Pedido", worksheet }]
    );
  };

  return (
    <>
      {type === "detalle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
          <div className="bg-bg-canvas rounded-xl w-full max-w-lg overflow-hidden shadow-lg border border-border-subtle flex flex-col max-h-[90vh]">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">Pedido {order.id}</h2>
              <button onClick={close} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-bg-surface rounded-md">
                <i className="ti ti-x text-xl"></i>
              </button>
            </header>
            
            <div className="p-5 flex-1 overflow-y-auto">
              <p className="text-sm text-text-secondary mb-4">
                Enviado: {order.createdAt ? format(new Date(order.createdAt), "EEEE d 'de' MMMM, HH:mm", { locale: es }) : "Fecha desconocida"}
              </p>
              
              {order.adminNotes && (
                <div className="mb-4 p-3 bg-bg-surface border border-border-strong rounded-md text-sm text-text-primary">
                  <strong className="text-brand">Nota de la fábrica:</strong> {order.adminNotes}
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[300px]">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">Sabor</th>
                      <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas text-right">
                        {(order.status === "pendiente" || order.status === "contraoferta" || order.status === "rechazado") ? "Pedidas" : "Confirmadas"}
                      </th>
                      {order.status === "contraoferta" && (
                        <th className="px-4 py-3 text-xs font-medium text-brand uppercase border-b border-border-subtle bg-bg-canvas text-right">Ofrecidas</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {order.details?.map((item: any, i: number) => (
                      <Fragment key={i}>
                        <tr className="bg-bg-surface">
                          <td className="px-4 py-3 text-sm text-text-primary">{item.name}</td>
                          <td className="px-4 py-3 text-sm font-medium font-mono text-text-primary text-right">
                            {(order.status === "pendiente" || order.status === "contraoferta" || order.status === "rechazado") 
                              ? item.quantity 
                              : (item.approvedQuantity !== null && item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity)}
                          </td>
                          {order.status === "contraoferta" && (
                            <td className="px-4 py-3 text-sm font-medium font-mono text-brand text-right">{item.approvedQuantity}</td>
                          )}
                        </tr>
                        {item.assignedTubs && item.assignedTubs.length > 0 && (
                          <tr>
                            <td colSpan={order.status === "contraoferta" ? 3 : 2} className="px-4 py-2 bg-brand-soft-bg/20 border-t-0">
                              <div className="flex flex-col gap-1">
                                <p className="text-[10px] font-medium text-text-secondary uppercase mb-0.5">Latas Asignadas</p>
                                {item.assignedTubs.map((tub: any, tIdx: number) => (
                                  <div key={tIdx} className="flex items-center justify-between text-[12px] mb-0.5">
                                    <span className="font-mono text-text-primary text-[11px] bg-bg-canvas px-1.5 py-0.5 rounded border border-border-subtle">{tub.internalCode}</span>
                                    <span className="text-text-secondary text-[11px]">{tub.weight} kg</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {order.supplies && order.supplies.length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <h3 className="text-[13px] font-semibold text-text-primary uppercase mb-2">Insumos</h3>
                  <table className="w-full text-left border-collapse min-w-[300px]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">Insumo</th>
                        <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas text-right">
                          {(order.status === "pendiente" || order.status === "contraoferta" || order.status === "rechazado") ? "Bultos Pedidos" : "Confirmados"}
                        </th>
                        {order.status === "contraoferta" && (
                          <th className="px-4 py-3 text-xs font-medium text-brand uppercase border-b border-border-subtle bg-bg-canvas text-right">Ofrecidos</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {order.supplies.map((item: any, i: number) => (
                        <tr key={i} className="bg-bg-surface">
                          <td className="px-4 py-3 text-sm text-text-primary">
                            <span className="font-medium text-text-primary text-[14px]">{item.name}</span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium font-mono text-text-primary text-right">
                            {(order.status === "pendiente" || order.status === "contraoferta" || order.status === "rechazado") 
                              ? item.quantity 
                              : (item.approvedQuantity !== null && item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity)}
                          </td>
                          {order.status === "contraoferta" && (
                            <td className="px-4 py-3 text-sm font-medium font-mono text-brand text-right">{item.approvedQuantity}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex pt-4 border-t border-border-subtle mt-4">
                <button
                  onClick={handleExportOrder}
                  className="inline-flex items-center gap-2 h-9 px-3 text-[13px] font-medium text-[#107c41] bg-[#107c41]/10 border border-[#107c41]/20 rounded-md hover:bg-[#107c41]/20 transition-colors"
                >
                  <i className="ti ti-file-spreadsheet text-[16px]"></i>
                  Exportar a Excel
                </button>
              </div>
            </div>

            <footer className="p-5 border-t border-border-subtle bg-bg-surface flex justify-end gap-3">
              <button onClick={close} className="btn btn-ghost">Cerrar</button>
            </footer>
          </div>
        </div>
      )}



      {type === "cancelar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
          <div className="bg-bg-canvas rounded-xl w-full max-w-md overflow-hidden shadow-lg border border-border-subtle flex flex-col">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">Cancelar pedido</h2>
              <button onClick={close} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-bg-surface rounded-md">
                <i className="ti ti-x text-xl"></i>
              </button>
            </header>
            
            <div className="p-5">
              <div className="flex gap-3 items-start p-4 bg-danger-soft-bg text-danger border border-danger-border rounded-lg">
                <i className="ti ti-alert-circle text-xl mt-0.5"></i>
                <p className="text-sm">
                  Vas a cancelar el pedido {order.id}. La fábrica ya no lo va a preparar. ¿Confirmás?
                </p>
              </div>
            </div>

            <footer className="p-5 border-t border-border-subtle bg-bg-surface flex justify-end gap-3">
              <button onClick={close} disabled={isPending} className="btn btn-ghost">No, dejarlo</button>
              <button onClick={handleCancel} disabled={isPending} className="btn btn-destructive">
                {isPending ? <i className="ti ti-loader animate-spin"></i> : <i className="ti ti-trash"></i>}
                {isPending ? "Cancelando..." : "Sí, cancelar pedido"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
