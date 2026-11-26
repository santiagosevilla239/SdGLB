import { Dispatch, SetStateAction, useState, useRef, useEffect } from "react";
import { FlavorWithStock } from "@/types/database";

interface BranchScanModalProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  handleAddBranchBulkTubs: (tubs: Array<{ flavorId: string; internalCode: string; grossWeight: number }>) => Promise<void>;
  flavors: FlavorWithStock[];
  isPending: boolean;
  error: string | null;
}

type ScannedTub = { id: string; flavorId: string; flavorName: string; internalCode: string; grossWeight: number };

export function BranchScanModal({
  isOpen,
  setIsOpen,
  handleAddBranchBulkTubs,
  flavors,
  isPending,
  error,
}: BranchScanModalProps) {
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timeoutRef = useRef<any>(null);
  const [localScanError, setLocalScanError] = useState("");

  const [scannedTubs, setScannedTubs] = useState<ScannedTub[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<ScannedTub | null>(null);
  const [balanzaStatus, setBalanzaStatus] = useState<{
    connected: boolean;
    port?: string;
    currentWeight?: number;
    currentPlu?: number;
    isStable?: boolean;
    statusText?: string;
  } | null>(null);

  const scannedTubsRef = useRef<ScannedTub[]>([]);
  useEffect(() => {
    scannedTubsRef.current = scannedTubs;
  }, [scannedTubs]);

  const duplicateWarningRef = useRef<ScannedTub | null>(null);
  useEffect(() => {
    duplicateWarningRef.current = duplicateWarning;
  }, [duplicateWarning]);

  // Soporte para enviar con la tecla Enter
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        
        if (target.tagName === "INPUT" && target.closest("form")) return;
        if (target.tagName === "TEXTAREA") return;
        if (target.tagName === "BUTTON" && target.getAttribute("type") === "button" && target.innerText.toLowerCase().includes("cancelar")) {
          return;
        }

        if (duplicateWarning) {
          e.preventDefault();
          setScannedTubs(prev => [duplicateWarning, ...prev]);
          setDuplicateWarning(null);
          return;
        }

        if (isOpen && scannedTubs.length > 0 && !isPending) {
          e.preventDefault();
          handleAddBranchBulkTubs(scannedTubs);
        }
      }
    };
    
    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, [isOpen, duplicateWarning, scannedTubs, isPending, handleAddBranchBulkTubs]);

  // Manejar el escáner y reinicio
  useEffect(() => {
    if (!isOpen) {
      barcodeBufferRef.current = "";
      setLocalScanError("");
      setScannedTubs([]);
      setDuplicateWarning(null);
      return;
    }

    const processBarcode = async (code: string) => {
      setLocalScanError("");
      
      if (code.length === 13 && code.startsWith('2')) {
        const flavorIdStr = parseInt(code.substring(1, 7), 10).toString();
        const flavorMatch = flavors.find(f => f.id.toString() === flavorIdStr);
        
        if (flavorMatch) {
          const detectedFlavorId = flavorMatch.id.toString();
          const detectedFlavorName = flavorMatch.name;
          
          const weightStr = code.substring(7, 12);
          const weightInKg = parseInt(weightStr, 10) / 1000;
          
          if (!isNaN(weightInKg) && weightInKg > 0) {
            const isDuplicate = scannedTubsRef.current.some(t => t.internalCode === code);
            if (isDuplicate) {
              setDuplicateWarning({ id: crypto.randomUUID(), flavorId: detectedFlavorId, flavorName: detectedFlavorName, internalCode: code, grossWeight: weightInKg });
              return;
            }
            
            setScannedTubs(prev => [{ id: crypto.randomUUID(), flavorId: detectedFlavorId, flavorName: detectedFlavorName, internalCode: code, grossWeight: weightInKg }, ...prev]);
            return;
          }
        } else {
          setLocalScanError(`No se encontró el sabor con ID ${flavorIdStr} en el catálogo.`);
          return;
        }
      }

      setLocalScanError("El código escaneado no es un formato válido de balanza (EAN-13).");
    };

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
        }
      }, 100);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flavors]);

  // Listener para balanza Kretz vía Electron IPC
  useEffect(() => {
    if (!isOpen) {
      setBalanzaStatus(null);
      return;
    }

    if (typeof window !== "undefined" && (window as any).electronAPI) {
      if ((window as any).electronAPI.onBalanzaStatus) {
        (window as any).electronAPI.onBalanzaStatus((status: any) => {
          setBalanzaStatus(status);
        });
      }

      (window as any).electronAPI.onBalanzaData((data: { plu: number, peso: number, internal_code?: string }) => {
        setLocalScanError("");
        
        const flavorMatch = flavors.find(f => f.id.toString() === data.plu.toString());
        
        if (flavorMatch) {
          const detectedFlavorId = flavorMatch.id.toString();
          const detectedFlavorName = flavorMatch.name;
          const weightInKg = data.peso;
          
          if (!isNaN(weightInKg) && weightInKg > 0) {
            const newInternalCode = data.internal_code || `BALANZA-${data.plu}-${Date.now()}`;

            setScannedTubs(prev => [{ 
              id: crypto.randomUUID(), 
              flavorId: detectedFlavorId, 
              flavorName: detectedFlavorName, 
              internalCode: newInternalCode, 
              grossWeight: weightInKg 
            }, ...prev]);
            return;
          }
        } else {
          setLocalScanError(`La balanza envió PLU ${data.plu} pero no se encontró ese sabor.`);
        }
      });

      if ((window as any).electronAPI.requestBalanzaData) {
        (window as any).electronAPI.requestBalanzaData();
      }
    }
  }, [isOpen, flavors]);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const internalCodeInput = document.getElementById("branchInternalCode") as HTMLInputElement;
    const code = (internalCodeInput?.value || "").trim();
    if (!code) return;

    setLocalScanError("");
    
    if (code.length === 13 && code.startsWith('2')) {
      const flavorIdStr = parseInt(code.substring(1, 7), 10).toString();
      const flavorMatch = flavors.find(f => f.id.toString() === flavorIdStr);
      
      if (flavorMatch) {
        const detectedFlavorId = flavorMatch.id.toString();
        const detectedFlavorName = flavorMatch.name;
        
        const weightStr = code.substring(7, 12);
        const weightInKg = parseInt(weightStr, 10) / 1000;
        
        if (!isNaN(weightInKg) && weightInKg > 0) {
          const isDuplicate = scannedTubs.some(t => t.internalCode === code);
          if (isDuplicate) {
            setDuplicateWarning({ id: crypto.randomUUID(), flavorId: detectedFlavorId, flavorName: detectedFlavorName, internalCode: code, grossWeight: weightInKg });
            return;
          }
          
          setScannedTubs(prev => [{ id: crypto.randomUUID(), flavorId: detectedFlavorId, flavorName: detectedFlavorName, internalCode: code, grossWeight: weightInKg }, ...prev]);
          if (internalCodeInput) internalCodeInput.value = "";
          return;
        }
      }
    }

    setLocalScanError("El código ingresado no es un código de balanza válido (EAN-13).");
  };

  if (!isOpen && !duplicateWarning) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Carga inicial de stock
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5 flex-1 overflow-y-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 mb-4 bg-brand-soft-bg border border-brand/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <i className="ti ti-scale text-[24px] text-brand"></i>
                  <div className="text-[13px]">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <p className="font-medium text-brand">Escáner y Balanza</p>
                      {balanzaStatus ? (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          balanzaStatus.connected 
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30" 
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${balanzaStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                          {balanzaStatus.connected ? (balanzaStatus.port || 'Balanza Conectada') : 'Balanza Reconectando...'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30" title="La balanza por puerto COM funciona a través de la aplicación instalable de escritorio">
                          <i className="ti ti-device-desktop text-[12px]"></i>
                          Modo Navegador Web
                        </span>
                      )}
                    </div>
                    <p className="text-brand-soft-text">
                      {balanzaStatus?.connected && balanzaStatus.currentWeight && balanzaStatus.currentWeight >= 0.05
                        ? `Detectado en balanza: ${balanzaStatus.currentWeight.toFixed(3)} kg ${balanzaStatus.isStable ? "✓ (Estable)" : "⏳ (Estabilizando...)"}`
                        : balanzaStatus
                        ? "Balanza lista. Apoyá una lata o escaneá una etiqueta."
                        : "En el navegador podés escanear o ingresar códigos a mano. Para conectar la balanza física COM, abrí la App de Escritorio."
                      }
                    </p>
                  </div>
                </div>

                {balanzaStatus?.connected && balanzaStatus.currentWeight && balanzaStatus.currentWeight >= 0.05 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined" && (window as any).electronAPI?.forceCaptureBalanza) {
                        (window as any).electronAPI.forceCaptureBalanza();
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-brand text-white rounded-md hover:bg-brand-hover shadow-sm transition-all shrink-0"
                    title="Forzar lectura actual de la balanza sin esperar"
                  >
                    <i className="ti ti-check text-[14px]"></i>
                    Tomar {balanzaStatus.currentWeight.toFixed(3)} kg
                  </button>
                )}
              </div>

              {(error || localScanError) && (
                <div className="flex items-center gap-3 p-4 bg-danger-soft-bg text-danger border border-danger/20 rounded-lg text-[14px] mb-4">
                  <i
                    className="ti ti-alert-circle text-[20px]"
                    aria-hidden="true"
                  ></i>
                  <span className="font-medium">{error || localScanError}</span>
                </div>
              )}
              
              <form onSubmit={handleManualAdd} id="branch-scan-form" className="space-y-4">
                <div className="flex gap-2">
                  <input
                    id="branchInternalCode"
                    name="internalCode"
                    type="text"
                    autoFocus
                    placeholder="O ingresá un código (EAN-13) a mano..."
                    className="w-full h-11 px-3.5 border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary hover:border-[#B0AFA8] focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand transition-all"
                  />
                  <button type="submit" className="px-4 h-11 text-[12px] font-medium bg-brand text-white rounded-md hover:bg-brand-hover transition-colors shrink-0">
                    Añadir
                  </button>
                </div>
              </form>

              {scannedTubs.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border-subtle">
                  <h3 className="text-[13px] font-medium text-text-primary mb-3">Latas a cargar ({scannedTubs.length})</h3>
                  <div className="border border-border-subtle rounded-md divide-y divide-border-subtle">
                    {scannedTubs.map(tub => (
                      <div key={tub.id} className="flex justify-between items-center p-3 text-[12px] bg-bg-canvas hover:bg-bg-surface transition-colors">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text-primary">{tub.flavorName}</span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-border-subtle text-text-secondary">{tub.internalCode}</span>
                          </div>
                          <span className="text-text-secondary">{tub.grossWeight.toFixed(3)} kg</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setScannedTubs(prev => prev.filter(t => t.id !== tub.id))} 
                          className="w-8 h-8 flex items-center justify-center text-danger hover:bg-danger-soft-bg rounded-md transition-colors"
                          title="Eliminar de la lista"
                        >
                          <i className="ti ti-trash text-[16px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={() => setIsOpen(false)}
                type="button"
                className="h-12 px-4 rounded-md font-medium text-text-primary border border-transparent hover:bg-black/5 transition-colors"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleAddBranchBulkTubs(scannedTubs)}
                disabled={isPending || scannedTubs.length === 0}
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md font-medium bg-success text-white hover:bg-success-hover transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <i className="ti ti-loader-2 animate-spin text-[18px]"></i>
                ) : (
                  <i className="ti ti-device-floppy text-[18px]"></i>
                )}
                {isPending ? "Guardando..." : `Guardar ${scannedTubs.length} lata(s)`}
              </button>
            </footer>
          </div>
        </div>
      )}

      {duplicateWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[320px] p-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3 text-[#eab308]">
              <i className="ti ti-alert-triangle text-[24px]"></i>
              <h3 className="text-[16px] font-medium text-text-primary">Código duplicado</h3>
            </div>
            <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">
              El código <strong>{duplicateWarning.internalCode}</strong> ya se encuentra en la lista actual. ¿Deseas agregarlo de todos modos?
            </p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setDuplicateWarning(null)} 
                className="px-4 py-2 rounded-md text-[13px] font-medium text-text-primary border border-border-strong hover:bg-black/5 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setScannedTubs(prev => [duplicateWarning, ...prev]);
                  setDuplicateWarning(null);
                }} 
                className="px-4 py-2 rounded-md text-[13px] font-medium bg-[#eab308] text-white hover:bg-[#ca8a04] transition-colors"
              >
                Sí, agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
