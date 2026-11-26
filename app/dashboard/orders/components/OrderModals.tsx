import {
  Dispatch,
  SetStateAction,
  useState,
  useEffect,
  useRef,
  Fragment,
} from "react";
import { OrderWithDetails } from "@/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  dispatchAndCompleteOrder,
  cancelOrder,
  verifyScannedTub,
} from "@/actions/orders";
import { addBulkTubs } from "@/actions/tubs";
import { toast } from "react-toastify";
import { createUnifiedSheet, downloadExcelWorkbook } from "@/lib/excel";

type ModalType = "detalle" | "rechazar" | "despachar" | null;

interface OrderModalsProps {
  modalState: { type: ModalType; order: OrderWithDetails | null };
  setModalState: Dispatch<
    SetStateAction<{ type: ModalType; order: OrderWithDetails | null }>
  >;
  onRefresh?: () => void;
  role?: string;
}

export function OrderModals({
  modalState,
  setModalState,
  onRefresh,
  role = "admin",
}: OrderModalsProps) {
  const { type, order } = modalState;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scanner state
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timeoutRef = useRef<any>(null);
  const [scannedTubs, setScannedTubs] = useState<any[]>([]);
  const scannedTubsRef = useRef(scannedTubs);
  const [scanError, setScanError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");

  // Modal para lata inexistente escaneada
  const [missingTubModalData, setMissingTubModalData] = useState<{
    code: string;
    flavorId: string | number;
    flavorName: string;
    weight: number;
  } | null>(null);
  const [isCreatingTub, setIsCreatingTub] = useState(false);
  const [createTubError, setCreateTubError] = useState("");

  useEffect(() => {
    scannedTubsRef.current = scannedTubs;
  }, [scannedTubs]);

  const getRemainingQty = (item: any) => {
    const reqQty =
      item.approvedQuantity !== null && item.approvedQuantity !== undefined
        ? item.approvedQuantity
        : item.quantity;
    const assignedQty = item.assignedTubs?.length || 0;
    return Math.max(0, reqQty - assignedQty);
  };

  const needsScanning = order?.details?.some(
    (item) => getRemainingQty(item) > 0,
  );

  const isAllTubsScanned = () => {
    if (!order?.details) return false;
    return order.details.every((item) => {
      const remaining = getRemainingQty(item);
      const scanned = scannedTubs.filter(
        (t) => String(t.flavorId) === String(item.flavorId),
      ).length;
      return scanned >= remaining;
    });
  };

  // Soporte para enviar modales con la tecla Enter
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const target = e.target as HTMLElement;

        // Si el modal de crear lata está abierto
        if (missingTubModalData) {
          if (
            target.tagName === "BUTTON" &&
            target.innerText.toLowerCase().includes("cancelar")
          )
            return;
          e.preventDefault();
          if (!isCreatingTub) {
            handleConfirmCreateTub();
          }
          return;
        }

        // Ignorar si estamos en un textarea o en un input dentro de un form (ej. buscador manual)
        if (target.tagName === "TEXTAREA") return;
        if (target.tagName === "INPUT" && target.closest("form")) return;

        // No interceptar si el usuario está haciendo foco en un botón secundario (ej. "Cancelar")
        if (
          target.tagName === "BUTTON" &&
          target.getAttribute("type") === "button" &&
          target.innerText.toLowerCase().includes("cancelar")
        ) {
          return;
        }

        // Si el escáner disparó recientemente o hay buffer acumulado, no despachar por Enter
        if (
          Date.now() - lastKeyTimeRef.current < 200 ||
          barcodeBufferRef.current.length > 0
        ) {
          return;
        }

        if (type === "rechazar" && !isSubmitting) {
          e.preventDefault();
          handleReject();
        } else if (type === "despachar" && !isSubmitting) {
          e.preventDefault();
          handleDispatch();
        } else if (type === "detalle") {
          e.preventDefault();
          close();
        }
      }
    };

    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, [
    type,
    isSubmitting,
    scannedTubs,
    order,
    missingTubModalData,
    isCreatingTub,
  ]);

  const close = () => {
    setModalState({ type: null, order: null });
    setScannedTubs([]);
    setScanError("");
    barcodeBufferRef.current = "";
    setMissingTubModalData(null);
    setIsCreatingTub(false);
    setCreateTubError("");
  };

  const processBarcode = async (code: string) => {
    if (!order) return;
    setScanError("");
    setIsScanning(true);

    // Evitar procesar dos veces la misma lata en esta sesión
    if (scannedTubsRef.current.some((st) => st.internalCode === code)) {
      setScanError(
        `La lata con el código ${code} ya fue escaneada para este pedido.`,
      );
      setIsScanning(false);
      return;
    }

    try {
      const res = await verifyScannedTub(code);
      if (res.error) {
        setScanError(res.error);
        setIsScanning(false);
        return;
      }

      // Si la lata no existe en stock, abrimos el modal informativo con los datos leídos
      if (res.notFound && res.parsedData) {
        const {
          flavorId,
          flavorName,
          weight,
          code: parsedCode,
        } = res.parsedData;

        if (!flavorId || !flavorName) {
          setScanError(
            `No se pudo reconocer el sabor del código escaneado (${parsedCode}).`,
          );
          setIsScanning(false);
          return;
        }

        if (!weight || weight <= 0) {
          setScanError(
            `No se pudo leer un peso válido del código escaneado (${parsedCode}).`,
          );
          setIsScanning(false);
          return;
        }

        // Se permite agregar gustos adicionales o cantidades por encima de lo solicitado
        setCreateTubError("");
        setMissingTubModalData({
          code: parsedCode,
          flavorId: flavorId,
          flavorName: flavorName,
          weight: weight,
        });
        setIsScanning(false);
        return;
      }

      if (res.inStock && res.tubs && res.tubs.length > 0) {
        // Buscar cualquier lata de este código que NO haya sido escaneada ya en esta sesión
        const availableTub = res.tubs.find(
          (t: any) => !scannedTubsRef.current.some((st) => st.id === t.id),
        );

        if (!availableTub) {
          setScanError(
            `Todas las latas con el código ${code} ya fueron escaneadas.`,
          );
          setIsScanning(false);
          return;
        }

        // Se incorpora la lata al pedido (sea del gusto original, gusto extra, o cantidad adicional)
        setScannedTubs((prev) => [...prev, availableTub]);
      } else {
        setScanError("Lata no encontrada.");
      }
    } catch (err) {
      setScanError("Error al procesar el código.");
    }

    setIsScanning(false);
  };

  const handleConfirmCreateTub = async () => {
    if (!missingTubModalData || !order) return;

    if (!missingTubModalData.flavorId) {
      setCreateTubError("Debes seleccionar un sabor para la lata.");
      return;
    }

    if (!missingTubModalData.weight || missingTubModalData.weight <= 0) {
      setCreateTubError("El peso de la lata debe ser mayor a 0 kg.");
      return;
    }

    const requiredItems = order.details || [];
    const orderItem = requiredItems.find(
      (item) => String(item.flavorId) === String(missingTubModalData.flavorId),
    );
    const flavorDisplayName = orderItem ? orderItem.name : missingTubModalData.flavorName;

    setIsCreatingTub(true);
    setCreateTubError("");

    try {
      const res = await addBulkTubs([
        {
          flavorId: String(missingTubModalData.flavorId),
          internalCode: missingTubModalData.code,
          grossWeight: Number(missingTubModalData.weight),
        },
      ]);

      if (res.error || !res.data || res.data.length === 0) {
        setCreateTubError(res.error || "No se pudo crear la lata.");
        setIsCreatingTub(false);
        return;
      }

      const createdTub = res.data[0];
      setScannedTubs((prev) => [
        ...prev,
        {
          id: createdTub.id,
          internalCode: createdTub.internal_code || missingTubModalData.code,
          flavorId: createdTub.flavor_id,
          flavorName: flavorDisplayName,
          weight: createdTub.gross_weight,
        },
      ]);
      toast.success(
        `Lata creada y lista para despachar (${flavorDisplayName} - ${createdTub.gross_weight} kg)`,
      );
      if (onRefresh) onRefresh();
      setMissingTubModalData(null);
    } catch (err: any) {
      setCreateTubError(err.message || "Error al crear la lata.");
    } finally {
      setIsCreatingTub(false);
    }
  };

  // Scanner Hook
  useEffect(() => {
    if (type !== "despachar") {
      setScannedTubs([]);
      setScanError("");
      barcodeBufferRef.current = "";
      setManualCode("");
      setMissingTubModalData(null);
      return;
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Si el modal de crear lata inexistente está abierto, ignorar la captura del escáner
      if (missingTubModalData) return;

      // Si la pistola envía Enter tras leer el código
      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length >= 6) {
          e.preventDefault();
          e.stopPropagation();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          const code = barcodeBufferRef.current.trim();
          barcodeBufferRef.current = "";
          await processBarcode(code);
          setManualCode("");
          return;
        }
      }

      if (!e.key || e.key.length > 1) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      if (timeSinceLastKey > 60) {
        barcodeBufferRef.current = "";
      }

      barcodeBufferRef.current += e.key;
      lastKeyTimeRef.current = now;

      // Si estamos en un input y la velocidad es rápida (pistola), prevenimos que escriba
      const isInput =
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (isInput && timeSinceLastKey <= 60) {
        e.preventDefault();
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(async () => {
        const code = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = "";

        if (code.length >= 6) {
          await processBarcode(code);
          setManualCode(""); // Limpiamos el input por si entró el primer carácter del escáner
        }
      }, 100);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [type, order, missingTubModalData]);

  const handleReject = async () => {
    if (!order?.originalId) return;
    setIsSubmitting(true);
    const res = await cancelOrder(order.originalId);
    if (res?.error) {
      alert(res.error);
      setIsSubmitting(false);
      return;
    }
    if (onRefresh) onRefresh();
    setIsSubmitting(false);
    close();
  };

  const handleDispatch = async () => {
    if (!order?.originalId) return;
    setIsSubmitting(true);
    const scannedIds = scannedTubs.map((t) => t.id);
    const res = await dispatchAndCompleteOrder(order.originalId, scannedIds);
    if (res?.error) {
      alert(res.error);
      setIsSubmitting(false);
      return;
    }
    if (onRefresh) onRefresh();
    setIsSubmitting(false);
    close();
  };

  const handleExportOrder = async () => {
    if (!order) return;

    const includePrices = role !== "empleado";
    const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
    const branchName = order.branchName || "Sucursal";
    const statusText = order.status ? order.status.toUpperCase() : "PENDIENTE";
    const orderDate = order.createdAt;
    const formattedDate = orderDate ? format(new Date(orderDate), "dd/MM/yyyy HH:mm") : "-";

    const rows: (string | number)[][] = [];
    let totalTubsCount = 0;
    let totalWeightSum = 0;
    let totalPriceSum = 0;

    order.details?.forEach((item: any) => {
      const qty = item.quantity;
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
        totalTubsCount += Number(qty || 0);
        const row: (string | number)[] = [
          "Helado",
          item.name,
          Number(qty || 0),
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
      const qty = Number(item.quantity || 0);
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
      `Sucursal: ${branchName}   |   Fecha de Pedido: ${formattedDate}   |   Estado: ${statusText}`,
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

  if (!type || !order) return null;

  const renderScannerUI = () => {
    // Generate the list of available tubs for datalist
    const allAvailableTubs =
      order.details?.flatMap((item: any) =>
        (item.availableTubs || []).map((t: any) => ({
          ...t,
          flavorName: item.name,
        })),
      ) || [];

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-bg-surface text-text-primary border border-border-strong rounded-lg shadow-sm">
          <div className="flex gap-3 items-center flex-1">
            <i className="ti ti-barcode text-[24px] text-brand"></i>
            <div className="text-[14px]">
              <p className="font-semibold mb-1">Escáner activo</p>
              <p className="text-text-secondary leading-tight">
                Usa la pistola USB para escanear etiquetas o busca el código a
                mano.
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                processBarcode(manualCode.trim());
                setManualCode("");
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              list="available-tubs-list"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Buscar código..."
              className="w-full sm:w-48 h-10 px-3 border border-brand-border bg-white rounded-md text-[14px] focus:outline-none focus:border-brand placeholder:text-text-secondary/50"
            />
            <datalist id="available-tubs-list">
              {allAvailableTubs.map((t, idx) => (
                <option key={idx} value={t.internalCode}>
                  {t.flavorName} ({t.weight} kg)
                </option>
              ))}
            </datalist>
            <button
              type="submit"
              disabled={!manualCode.trim() || isScanning}
              className="h-10 px-4 bg-brand text-white rounded-md text-[14px] font-medium hover:bg-brand-hover disabled:opacity-50 shrink-0"
            >
              Añadir
            </button>
          </form>
        </div>

        {scanError && (
          <div className="p-3 bg-danger-soft-bg text-danger border border-danger/20 rounded-md text-[13px] flex items-center gap-2">
            <i className="ti ti-alert-circle text-[16px]"></i>
            {scanError}
          </div>
        )}

        <div className="space-y-3">
          {order.details?.map((item) => {
            const remaining = getRemainingQty(item);
            const scanned = scannedTubs.filter(
              (t) => String(t.flavorId) === String(item.flavorId),
            );

            if (remaining === 0 && scanned.length === 0) return null;

            const isComplete = scanned.length >= remaining;
            const isExtra = remaining > 0 && scanned.length > remaining;
            return (
              <div
                key={item.id}
                className={`p-4 border rounded-lg ${isComplete ? "bg-success-soft-bg/20 border-success/30" : "bg-bg-surface border-border-subtle"}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-[15px] text-text-primary">
                    {item.name}
                  </span>
                  <span
                    className={`text-[13px] font-medium ${isComplete ? "text-success" : scanned.length > 0 ? "text-warning" : "text-text-secondary"}`}
                  >
                    {scanned.length} / {remaining} escaneadas
                    {isExtra && (
                      <span className="ml-1.5 text-[11px] font-semibold text-brand">
                        (+{scanned.length - remaining} extra)
                      </span>
                    )}
                  </span>
                </div>

                {scanned.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {scanned.map((tub) => (
                      <div
                        key={tub.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-canvas border border-border-strong rounded-md text-[12px] font-mono text-text-primary"
                      >
                        <i className="ti ti-check text-success text-[14px]"></i>
                        <span>{tub.internalCode}</span>
                        {tub.weight ? (
                          <span className="text-text-secondary text-[11px]">
                            ({tub.weight} kg)
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setScannedTubs((prev) =>
                              prev.filter((t) => t.id !== tub.id),
                            )
                          }
                          className="ml-1 text-text-secondary hover:text-danger transition-colors p-0.5 rounded"
                          title="Quitar lata"
                        >
                          <i className="ti ti-x text-[12px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* Mostrar sabores escaneados que no estaban en el pedido original */}
          {(() => {
            const extraTubs = scannedTubs.filter(
              (t) =>
                !order.details?.some(
                  (item: any) => String(item.flavorId) === String(t.flavorId),
                ),
            );
            if (extraTubs.length === 0) return null;

            const groupedExtras = extraTubs.reduce(
              (acc, tub) => {
                if (!acc[tub.flavorName]) acc[tub.flavorName] = [];
                acc[tub.flavorName].push(tub);
                return acc;
              },
              {} as Record<string, any[]>,
            );

            return Object.entries(groupedExtras).map(([flavorName, _tubs]) => {
              const tubs = _tubs as any[];
              return (
                <div
                  key={flavorName}
                  className="p-4 border rounded-lg bg-warning-soft-bg/20 border-warning/30"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-[15px] text-text-primary flex items-center gap-1.5">
                      <i className="ti ti-sparkles text-warning text-[16px]"></i>
                      {flavorName} (Adicional)
                    </span>
                    <span className="text-[13px] font-medium text-warning">
                      {tubs.length} {tubs.length === 1 ? "lata adicional" : "latas adicionales"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tubs.map((tub) => (
                      <div
                        key={tub.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-canvas border border-warning/50 rounded-md text-[12px] font-mono text-text-primary"
                      >
                        <i className="ti ti-plus text-warning text-[14px]"></i>
                        <span>{tub.internalCode}</span>
                        {tub.weight ? (
                          <span className="text-text-secondary text-[11px]">
                            ({tub.weight} kg)
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setScannedTubs((prev) =>
                              prev.filter((t) => t.id !== tub.id),
                            )
                          }
                          className="ml-1 text-text-secondary hover:text-danger transition-colors p-0.5 rounded"
                          title="Quitar lata"
                        >
                          <i className="ti ti-x text-[12px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Modal - Detalle */}
      {type === "detalle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Pedido {order.id}
              </h2>
              <button
                onClick={close}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <p className="text-[12px] text-text-secondary mb-4">
                {order.branchName} · Recibido:{" "}
                {order.createdAt
                  ? format(
                      new Date(order.createdAt),
                      "EEEE d 'de' MMMM, HH:mm",
                      { locale: es },
                    )
                  : "Fecha desconocida"}
              </p>

              {order.branchNotes && (
                <div className="mb-4 p-3 bg-brand-soft-bg border border-brand-border rounded-md text-[13px] text-text-primary">
                  <strong>Nota de la sucursal:</strong> {order.branchNotes}
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-[13px] font-semibold text-text-primary uppercase mb-2">
                  Latas de Helado
                </h3>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-bg-surface">
                    <tr>
                      <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase border-b border-border-subtle">
                        Sabor
                      </th>
                      <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase border-b border-border-subtle text-right">
                        Pedidas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {order.details?.map((item: any, i: number) => (
                      <Fragment key={i}>
                        <tr>
                          <td className="px-5 py-3 text-[14px] text-text-primary">
                            {item.name}
                          </td>
                          <td className="px-5 py-3 text-[12px] font-mono text-text-secondary text-right">
                            {item.quantity}
                          </td>
                        </tr>
                        {item.assignedTubs && item.assignedTubs.length > 0 && (
                          <tr>
                            <td
                              colSpan={2}
                              className="px-5 py-2 bg-brand-soft-bg/30 border-t-0"
                            >
                              <div className="flex flex-col gap-1">
                                <p className="text-[10px] font-medium text-text-secondary uppercase mb-0.5">
                                  Latas Asignadas
                                </p>
                                {item.assignedTubs.map(
                                  (tub: any, tIdx: number) => (
                                    <div
                                      key={tIdx}
                                      className="flex items-center justify-between text-[12px] mb-0.5"
                                    >
                                      <span className="font-mono text-text-primary text-[11px] bg-bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                                        {tub.internalCode}
                                      </span>
                                      <span className="text-text-secondary text-[11px]">
                                        {tub.weight} kg
                                      </span>
                                    </div>
                                  ),
                                )}
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
                <div className="mb-4">
                  <h3 className="text-[13px] font-semibold text-text-primary uppercase mb-2">
                    Insumos
                  </h3>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-bg-surface">
                      <tr>
                        <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase border-b border-border-subtle">
                          Insumo
                        </th>
                        <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase border-b border-border-subtle text-right">
                          Bultos Pedidos
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {order.supplies.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="px-5 py-3 text-[14px] text-text-primary">
                            {item.name}
                            <span className="block text-[11px] text-text-secondary mt-0.5">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[12px] font-mono text-text-secondary text-right">
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {order.adminNotes && (
                <div className="mt-4 p-3 bg-bg-surface border border-border-subtle rounded-md text-[13px] text-text-primary">
                  <strong>Tu nota (Fábrica):</strong> {order.adminNotes}
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

            <footer className="flex justify-end p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={close}
                className="h-10 px-4 rounded-md font-medium text-text-primary border border-transparent hover:bg-black/5 transition-colors"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Rechazar */}
      {type === "rechazar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Rechazar pedido
              </h2>
              <button
                onClick={close}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5">
              <div className="flex items-start gap-3 p-4 bg-danger-soft-bg text-danger border-l-[3px] border-danger rounded-r-md text-[14px]">
                <i className="ti ti-alert-circle text-[18px] shrink-0 mt-px"></i>
                <span>
                  Vas a rechazar el pedido {order.id} de {order.branchName}. No
                  se puede deshacer. ¿Confirmás?
                </span>
              </div>
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={close}
                disabled={isSubmitting}
                className="h-12 px-4 rounded-md font-medium text-text-primary border border-transparent hover:bg-black/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md font-medium bg-danger text-white hover:bg-danger-hover transition-colors disabled:opacity-50"
              >
                <i className="ti ti-x text-[18px]"></i>
                {isSubmitting ? "Rechazando..." : "Sí, rechazar"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Despachar */}
      {type === "despachar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[650px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Asignar Latas y Despachar
              </h2>
              <button
                onClick={close}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {renderScannerUI()}
              <div className="mt-4 text-[13px] text-text-secondary">
                <p>
                  Las latas escaneadas serán descontadas del stock de la fábrica
                  y el pedido será marcado como Entregado. Se informará a la
                  sucursal de cualquier diferencia con su pedido original.
                </p>
              </div>
            </div>

            <footer className="flex justify-between items-center p-4 border-t border-border-subtle bg-bg-surface">
              <div className="text-[13px] text-text-secondary">
                <span className="text-success font-medium flex items-center gap-1.5">
                  <i className="ti ti-check"></i> Listo para despachar
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={close}
                  className="h-12 px-4 rounded-md font-medium text-text-primary border border-transparent hover:bg-black/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDispatch}
                  disabled={isSubmitting || isScanning}
                  className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md font-medium bg-success text-white hover:bg-success-hover transition-colors disabled:opacity-50"
                >
                  <i className="ti ti-truck text-[18px]"></i>
                  {isSubmitting ? "Despachando..." : "Sí, despachar"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Confirmación de creación y asignación para lata inexistente en stock */}
      {missingTubModalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-2xl w-full max-w-[500px] border border-border-subtle flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-surface">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <i className="ti ti-alert-triangle text-[22px]"></i>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-text-primary leading-tight">
                    Lata no encontrada en stock
                  </h3>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    Crear e incorporar al pedido
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMissingTubModalData(null)}
                disabled={isCreatingTub}
                className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-canvas hover:text-text-primary transition-colors disabled:opacity-50"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Aviso */}
              <div className="p-3 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-md text-[13px] text-text-primary leading-relaxed">
                El código escaneado{" "}
                <strong>no existe en el stock de fábrica</strong>. Podés
                confirmar sus datos para crearla y asignarla inmediatamente a
                este pedido.
              </div>

              {createTubError && (
                <div className="p-3 bg-danger-soft-bg text-danger border border-danger/20 rounded-md text-[13px] flex items-center gap-2">
                  <i className="ti ti-alert-circle text-[16px] shrink-0"></i>
                  <span>{createTubError}</span>
                </div>
              )}

              {/* Datos leídos del código */}
              <div className="p-4 bg-bg-surface border border-border-subtle rounded-lg space-y-3.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  Datos leídos del código escaneado
                </h4>

                {/* Código de barras */}
                <div className="flex items-center justify-between py-1 border-b border-border-subtle text-[13px]">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <i className="ti ti-barcode text-[16px]"></i> Código:
                  </span>
                  <span className="font-mono font-semibold text-text-primary px-2.5 py-0.5 bg-bg-canvas border border-border-strong rounded-md">
                    {missingTubModalData.code}
                  </span>
                </div>

                {/* Sabor */}
                <div className="flex items-center justify-between py-2 border-b border-border-subtle text-[13px]">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <i className="ti ti-ice-cream text-[16px]"></i> Sabor:
                  </span>
                  <div className="text-right">
                    <span className="font-semibold text-text-primary px-2.5 py-0.5 bg-bg-canvas border border-border-strong rounded-md text-[13px]">
                      {missingTubModalData.flavorName}
                    </span>
                    {!order.details?.some(
                      (item) =>
                        String(item.flavorId) ===
                        String(missingTubModalData.flavorId),
                    ) && (
                      <span className="block text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                        (Sabor no solicitado originalmente)
                      </span>
                    )}
                  </div>
                </div>

                {/* Peso */}
                <div className="flex items-center justify-between py-2 text-[13px]">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <i className="ti ti-scale text-[16px]"></i> Peso bruto:
                  </span>
                  <span className="font-mono font-semibold text-text-primary px-2.5 py-0.5 bg-bg-canvas border border-border-strong rounded-md text-[13px]">
                    {missingTubModalData.weight} kg
                  </span>
                </div>
              </div>

              <p className="text-[13px] text-text-secondary leading-normal">
                ¿Confirmás que querés crear esta lata y asignarla al pedido de
                forma instantánea?
              </p>
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                type="button"
                onClick={() => setMissingTubModalData(null)}
                disabled={isCreatingTub}
                className="h-10 px-4 rounded-md text-[14px] font-medium text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateTub}
                disabled={
                  isCreatingTub ||
                  !missingTubModalData.weight ||
                  !missingTubModalData.flavorId
                }
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-[14px] font-medium bg-success text-white hover:bg-success-hover shadow-sm transition-colors disabled:opacity-50"
              >
                {isCreatingTub ? (
                  <>
                    <i className="ti ti-loader animate-spin text-[16px]"></i>
                    <span>Creando...</span>
                  </>
                ) : (
                  <>
                    <i className="ti ti-circle-plus text-[16px]"></i>
                    <span>Crear y asignar</span>
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
