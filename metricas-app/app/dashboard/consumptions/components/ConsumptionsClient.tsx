"use client";

import { useState, useRef, useEffect } from "react";
import { openTub, closeDay } from "@/actions/consumptions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createUnifiedSheet, downloadExcelWorkbook } from "@/lib/excel";

interface ConsumptionsClientProps {
  initialTubs: any[];
  branchName: string;
  role?: string;
}

export default function ConsumptionsClient({ initialTubs, branchName, role = "branch" }: ConsumptionsClientProps) {
  const router = useRouter();
  const [tubs, setTubs] = useState<any[]>(initialTubs);
  
  // Scanner state
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timeoutRef = useRef<any>(null);
  
  const [manualCode, setManualCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const processBarcode = async (code: string) => {
    setIsScanning(true);

    const isDuplicate = tubs.some(t => t.internalCode === code);
    if (isDuplicate) {
      toast.warning("Esta lata ya está abierta y en la lista actual.");
      setIsScanning(false);
      return;
    }

    const res = await openTub(code);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Lata abierta y añadida a los consumos del día.");
      router.refresh(); // Refresh para obtener la lata con sus datos desde el servidor
      
      // Update local state is not strictly needed because router.refresh() will re-fetch, 
      // but if we want instant UI:
      // (En este caso dependemos del refresh para traer el nombre del sabor y precio exacto).
    }
    
    setIsScanning(false);
  };

  // Escáner Hook
  useEffect(() => {
    if (isCloseModalOpen) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!e.key || e.key.length > 1) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      
      if (timeSinceLastKey > 60) {
        barcodeBufferRef.current = "";
      }
      
      barcodeBufferRef.current += e.key;
      lastKeyTimeRef.current = now;

      const isInput = (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (isInput && timeSinceLastKey <= 60) {
        e.preventDefault();
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(async () => {
        const code = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = "";
        
        if (code.length >= 6) {
          await processBarcode(code);
          setManualCode(""); 
        }
      }, 100);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCloseModalOpen, tubs]);

  // Actualizar la lista cuando viene del servidor tras el refresh
  useEffect(() => {
    setTubs(initialTubs);
  }, [initialTubs]);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processBarcode(manualCode.trim());
    setManualCode("");
  };

  const handleExportExcel = async () => {
    if (tubs.length === 0) return;

    const totalWeight = tubs.reduce((sum, t) => sum + Number(t.weight), 0);

    const worksheet = await createUnifiedSheet({
      title: "HELADERÍA LOS BAMBINOS - CONSUMO DIARIO DE LATAS",
      metadata: [
        `Sucursal: ${branchName}   |   Fecha de emisión: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        `Total Latas Abiertas: ${tubs.length}   |   Total Kilos Consumidos: ${totalWeight.toFixed(2)} Kg`,
      ],
      headers: ["Código Interno", "Sabor", "Peso Bruto (Kg)"],
      rows: tubs.map((t) => [t.internalCode, t.flavorName, Number(t.weight)]),
      totalsRow: ["TOTAL GENERAL", `${tubs.length} latas`, totalWeight],
      weightColIndices: [2],
    });

    const sanitizedBranch = branchName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_");

    await downloadExcelWorkbook(
      `consumo_diario_${sanitizedBranch}_${format(new Date(), "ddMMyy")}.xlsx`,
      [{ sheetName: "Consumo Diario", worksheet }]
    );
  };

  const handleCloseDay = async () => {
    setIsClosing(true);
    const tubIds = tubs.map(t => t.id);
    const res = await closeDay(tubIds);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Día cerrado. Latas eliminadas correctamente.");
      setIsCloseModalOpen(false);
      router.refresh();
    }
    setIsClosing(false);
  };

  const totalWeight = tubs.reduce((sum, t) => sum + Number(t.weight), 0);
  const totalPrice = tubs.reduce((sum, t) => sum + Number(t.price), 0);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
            Consumo Diario
          </h1>
          <p className="text-[14px] text-text-secondary">
            {branchName} · Latas abiertas en el turno actual
          </p>
        </div>
        <button
          onClick={() => setIsCloseModalOpen(true)}
          disabled={tubs.length === 0}
          className="h-10 px-4 bg-brand text-white rounded-md text-[14px] font-medium hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          <i className="ti ti-calendar-check text-[18px]"></i>
          Cerrar Día
        </button>
      </div>

      <div className="bg-brand-soft-bg/30 border border-brand-border rounded-xl p-5 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-brand shadow-sm border border-border-subtle">
            <i className="ti ti-barcode text-[24px]"></i>
          </div>
          <div>
            <h3 className="text-[15px] font-medium text-text-primary">Escáner Activo</h3>
            <p className="text-[13px] text-text-secondary">Pistoleá cualquier lata para sumarla al consumo al instante.</p>
          </div>
        </div>
        
        <form onSubmit={handleManualAdd} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="O tipeá el código..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="h-10 px-3 w-full sm:w-64 border border-border-strong rounded-md text-[13px] focus:outline-none focus:border-brand shadow-sm bg-white"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || isScanning}
            className="h-10 px-4 bg-bg-surface border border-border-strong text-text-primary rounded-md text-[13px] font-medium hover:bg-bg-surface-hover transition-colors shadow-sm disabled:opacity-50"
          >
            Añadir
          </button>
        </form>
      </div>

      {tubs.length === 0 ? (
        <div className="text-center py-16 bg-bg-canvas border border-border-subtle rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-text-secondary">
            <i className="ti ti-box text-[24px]"></i>
          </div>
          <h3 className="text-[16px] font-medium text-text-primary mb-1">No hay latas abiertas</h3>
          <p className="text-[14px] text-text-secondary">Escaneá la primera lata para comenzar el consumo del día.</p>
        </div>
      ) : (
        <div className="bg-bg-canvas border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-bg-surface">
              <tr>
                <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase border-b border-border-subtle">Sabor</th>
                <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase border-b border-border-subtle">Código Interno</th>
                <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase border-b border-border-subtle text-right">Peso (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {tubs.map((tub) => (
                <tr key={tub.id} className="hover:bg-bg-surface transition-colors">
                  <td className="px-5 py-4 text-[14px] font-medium text-text-primary">{tub.flavorName}</td>
                  <td className="px-5 py-4 text-[12px] font-mono text-text-secondary">{tub.internalCode}</td>
                  <td className="px-5 py-4 text-[13px] text-text-primary text-right">{Number(tub.weight).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-bg-surface border-t border-border-strong">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-[13px] font-medium text-text-primary uppercase text-right">Total Acumulado</td>
                <td className="px-5 py-3 text-[14px] font-bold text-brand text-right">{totalWeight.toFixed(3)} kg</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal Cierre de Día */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">Resumen de Consumo</h2>
              <button onClick={() => setIsCloseModalOpen(false)} disabled={isClosing} className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors disabled:opacity-50">
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>
            
            <div className="p-5">
              <div className="flex items-center gap-4 mb-6 p-4 bg-brand-soft-bg/30 rounded-lg border border-brand-border">
                <div className="flex-1 text-center border-r border-border-subtle">
                  <p className="text-[11px] text-text-secondary uppercase mb-1">Latas consumidas</p>
                  <p className="text-[24px] font-medium text-text-primary">{tubs.length}</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[11px] text-text-secondary uppercase mb-1">Kilos totales</p>
                  <p className="text-[24px] font-medium text-brand">{totalWeight.toFixed(2)}</p>
                </div>
              </div>

              <p className="text-[14px] text-text-secondary mb-6 text-center">
                Antes de cerrar el día y borrar estas latas de la base de datos, te recomendamos descargar el Excel.
              </p>

              <button 
                onClick={handleExportExcel}
                className="w-full h-12 flex items-center justify-center gap-2 bg-[#107c41] text-white rounded-md font-medium hover:bg-[#0c6132] transition-colors shadow-sm mb-4"
              >
                <i className="ti ti-file-spreadsheet text-[20px]"></i>
                Exportar a Excel
              </button>
            </div>
            
            <footer className="flex justify-between p-4 border-t border-border-subtle bg-bg-surface">
              <button 
                onClick={() => setIsCloseModalOpen(false)} 
                disabled={isClosing}
                className="h-10 px-4 rounded-md font-medium text-text-primary hover:bg-black/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCloseDay} 
                disabled={isClosing}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md font-medium bg-danger text-white hover:bg-danger-hover transition-colors disabled:opacity-50 shadow-sm"
              >
                {isClosing ? "Borrando latas..." : "Cerrar Día y Borrar Latas"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
