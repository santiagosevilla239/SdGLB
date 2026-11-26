import { Dispatch, SetStateAction, useState, useRef, useEffect } from "react";
import { FlavorWithStock } from "@/types/database";

interface InventoryModalsProps {
  // Weigh Modal
  weighModalConfig: { isOpen: boolean; flavorId: string | null };
  setWeighModalConfig: Dispatch<SetStateAction<{ isOpen: boolean; flavorId: string | null }>>;
  weighError: string | null;
  isWeighPending: boolean;
  handleAddBulkTubs: (tubs: Array<{ flavorId: string; internalCode: string; grossWeight: number }>) => Promise<void>;
  flavors: FlavorWithStock[];

  // Flavor Modal
  isFlavorModalOpen: boolean;
  setIsFlavorModalOpen: Dispatch<SetStateAction<boolean>>;
  flavorError: string | null;
  isPending: boolean;
  handleAddFlavor: (formData: FormData) => void;

  // Price Modal
  isPriceModalOpen?: boolean;
  setIsPriceModalOpen?: Dispatch<SetStateAction<boolean>>;
  handleUpdatePrice?: (newPrice: number) => void;
  isPricePending?: boolean;
  priceError?: string | null;

  // Supply Modals
  isSupplyModalOpen?: boolean;
  setIsSupplyModalOpen?: Dispatch<SetStateAction<boolean>>;
  isEditSupplyModalOpen?: boolean;
  setIsEditSupplyModalOpen?: Dispatch<SetStateAction<boolean>>;
  isDeleteSupplyModalOpen?: boolean;
  setIsDeleteSupplyModalOpen?: Dispatch<SetStateAction<boolean>>;
  selectedSupplyForEdit?: any | null;
  selectedSupplyForDelete?: any | null;
  supplyError?: string | null;
  isSupplyPending?: boolean;
  handleCreateSupply?: (formData: FormData) => void;
  handleEditSupply?: (supplyId: string, formData: FormData) => void;
  handleDeleteSupply?: (supplyId: string) => void;
  supplies?: any[];
}

type ScannedTub = { id: string; flavorId: string; flavorName: string; internalCode: string; grossWeight: number };

export function InventoryModals({
  weighModalConfig,
  setWeighModalConfig,
  weighError,
  isWeighPending,
  handleAddBulkTubs,
  flavors,
  isFlavorModalOpen,
  setIsFlavorModalOpen,
  flavorError,
  isPending,
  handleAddFlavor,
  isPriceModalOpen,
  setIsPriceModalOpen,
  handleUpdatePrice,
  isPricePending,
  priceError,
  isSupplyModalOpen,
  setIsSupplyModalOpen,
  isEditSupplyModalOpen,
  setIsEditSupplyModalOpen,
  isDeleteSupplyModalOpen,
  setIsDeleteSupplyModalOpen,
  selectedSupplyForEdit,
  selectedSupplyForDelete,
  supplyError,
  isSupplyPending,
  handleCreateSupply,
  handleEditSupply,
  handleDeleteSupply,
  supplies,
}: InventoryModalsProps) {
  const [newGlobalPrice, setNewGlobalPrice] = useState<string>("");

  useEffect(() => {
    if (isPriceModalOpen) {
      const currentPrice = (flavors[0] as any)?.price_per_kilo || 1000;
      setNewGlobalPrice(currentPrice.toString());
    }
  }, [isPriceModalOpen, flavors]);

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

  // Soporte para enviar modales con la tecla Enter
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        
        // Ignorar si estamos en un input dentro de un form (esos se envían solos por submit)
        if (target.tagName === "INPUT" && target.closest("form")) return;
        if (target.tagName === "TEXTAREA") return;

        // No interceptar si el usuario está tabulando en un botón secundario (ej. "Cancelar")
        if (target.tagName === "BUTTON" && target.getAttribute("type") === "button" && target.innerText.toLowerCase().includes("cancelar")) {
          return;
        }

        // Modal de advertencia de duplicado
        if (duplicateWarning) {
          e.preventDefault();
          setScannedTubs(prev => [duplicateWarning, ...prev]);
          setDuplicateWarning(null);
          return;
        }

        // Modal principal de carga de latas
        if (weighModalConfig.isOpen && scannedTubs.length > 0 && !isWeighPending) {
          e.preventDefault();
          handleAddBulkTubs(scannedTubs);
        }
      }
    };
    
    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, [weighModalConfig.isOpen, duplicateWarning, scannedTubs, isWeighPending]);

  // Reiniciar valor cuando se cierra o abre el modal y manejar el escáner
  useEffect(() => {
    if (!weighModalConfig.isOpen) {
      barcodeBufferRef.current = "";
      setLocalScanError("");
      setScannedTubs([]);
      setDuplicateWarning(null);
      return;
    }

    const processBarcode = async (code: string) => {
      setLocalScanError("");
      
      const currentFlavorId = weighModalConfig.flavorId;
      const currentFlavorName = flavors.find(f => f.id.toString() === currentFlavorId)?.name || "";

      // Si es un código EAN-13 y empieza con '2' (estándar de balanza)
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
        }
      }

      setLocalScanError("El código escaneado no es un formato válido de balanza (EAN-13).");
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignorar teclas especiales (Shift, Ctrl, etc.)
      if (!e.key || e.key.length > 1) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      
      // Si la diferencia de tiempo entre teclas es mayor a 60ms, es tipeo humano.
      if (timeSinceLastKey > 60) {
        barcodeBufferRef.current = "";
      }
      
      barcodeBufferRef.current += e.key;
      lastKeyTimeRef.current = now;

      // Si detectamos que es una ráfaga (pistola) y estamos en un input, prevenimos que se siga escribiendo
      const isInput = (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (isInput && timeSinceLastKey <= 60) {
        e.preventDefault();
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Esperar un breve instante para asegurar que la pistola terminó de disparar
      timeoutRef.current = setTimeout(async () => {
        const code = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = "";
        
        // Si acumuló 6 o más caracteres rápidamente, es un escaneo
        if (code.length >= 6) {
          await processBarcode(code);
        }
      }, 100);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [weighModalConfig.isOpen, weighModalConfig.flavorId]);

  // Listener para la balanza Kretz vía Electron IPC
  useEffect(() => {
    if (!weighModalConfig.isOpen) {
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

      // Pedimos a la balanza que nos reenvíe el estado actual
      if ((window as any).electronAPI.requestBalanzaData) {
        (window as any).electronAPI.requestBalanzaData();
      }
    }
  }, [weighModalConfig.isOpen, flavors]);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const internalCodeInput = document.getElementById("internalCode") as HTMLInputElement;
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

  return (
    <>
      {/* Modal - Pesar lata (Solo UI) */}
      {weighModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Carga masiva de latas
              </h2>
              <button
                onClick={() =>
                  setWeighModalConfig({ isOpen: false, flavorId: null })
                }
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

              {(weighError || localScanError) && (
                <div className="flex items-center gap-3 p-4 bg-danger-soft-bg text-danger border border-danger/20 rounded-lg text-[14px] mb-4">
                  <i
                    className="ti ti-alert-circle text-[20px]"
                    aria-hidden="true"
                  ></i>
                  <span className="font-medium">{weighError || localScanError}</span>
                </div>
              )}
              
              <form onSubmit={handleManualAdd} id="weigh-form" className="space-y-4">
                <div className="flex gap-2">
                  <input
                    id="internalCode"
                    name="internalCode"
                    type="text"
                    placeholder="O ingresá un código de barras (EAN-13) a mano..."
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
                onClick={() =>
                  setWeighModalConfig({ isOpen: false, flavorId: null })
                }
                type="button"
                className="h-12 px-4 rounded-md font-medium text-text-primary border border-transparent hover:bg-black/5 transition-colors"
                disabled={isWeighPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleAddBulkTubs(scannedTubs)}
                disabled={isWeighPending || scannedTubs.length === 0}
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md font-medium bg-success text-white hover:bg-success-hover transition-colors disabled:opacity-50"
              >
                {isWeighPending ? (
                  <i className="ti ti-loader-2 animate-spin text-[18px]"></i>
                ) : (
                  <i className="ti ti-device-floppy text-[18px]"></i>
                )}
                {isWeighPending ? "Guardando..." : `Guardar ${scannedTubs.length} lata(s)`}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Alerta de código duplicado */}
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

      {/* Modal - Cargar Sabor */}
      {isFlavorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Cargar nuevo sabor
              </h2>
              <button
                onClick={() => setIsFlavorModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5">
              {flavorError && (
                <div className="flex items-center gap-3 p-4 bg-brand-soft-bg text-brand-soft-text rounded-lg text-[14px] mb-4">
                  <i
                    className="ti ti-alert-circle text-[20px]"
                    aria-hidden="true"
                  ></i>
                  <span className="font-medium">{flavorError}</span>
                </div>
              )}
              <form
                action={handleAddFlavor}
                id="flavor-form"
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="block text-[11px] font-medium text-text-primary tracking-[0.3px]"
                  >
                    Nombre del sabor
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Ej: Chocolate Suizo"
                    className="w-full h-[44px] px-[14px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary hover:border-[#B0AFA8] focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="description"
                    className="block text-[11px] font-medium text-text-primary tracking-[0.3px]"
                  >
                    Descripción (Opcional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    placeholder="Detalles sobre los ingredientes o preparación..."
                    className="w-full h-[80px] p-[14px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary hover:border-[#B0AFA8] focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand transition-all resize-none"
                  />
                </div>
              </form>
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={() => setIsFlavorModalOpen(false)}
                type="button"
                className="h-12 px-4 rounded-md font-medium text-text-primary border border-transparent hover:bg-black/5 transition-colors"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="flavor-form"
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md font-medium bg-success text-white hover:bg-success-hover transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <i className="ti ti-loader-2 animate-spin text-[18px]"></i>
                ) : (
                  <i className="ti ti-device-floppy text-[18px]"></i>
                )}
                {isPending ? "Guardando..." : "Guardar sabor"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Actualizar Precios Globales */}
      {isPriceModalOpen && setIsPriceModalOpen && handleUpdatePrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[420px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Actualizar Precio Global
              </h2>
              <button
                onClick={() => setIsPriceModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5">
              <div className="mb-5 flex items-center gap-3 p-4 bg-brand-soft-bg border border-brand/20 rounded-lg">
                <i className="ti ti-info-circle text-[24px] text-brand"></i>
                <p className="text-[13px] text-brand-soft-text leading-relaxed">
                  Este precio se aplicará a <strong>todos</strong> los sabores de forma masiva para futuros pedidos. Las latas ya guardadas conservarán su precio histórico.
                </p>
              </div>

              {priceError && (
                <div className="flex items-center gap-3 p-4 bg-danger-soft-bg text-danger border border-danger/20 rounded-lg text-[14px] mb-4">
                  <i className="ti ti-alert-circle text-[20px]"></i>
                  <span className="font-medium">{priceError}</span>
                </div>
              )}

              <form
                id="price-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdatePrice(parseFloat(newGlobalPrice));
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="global_price"
                    className="block text-[11px] font-medium text-text-primary tracking-[0.3px]"
                  >
                    Nuevo Precio por Kilo ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-medium">$</span>
                    <input
                      id="global_price"
                      name="global_price"
                      type="number"
                      step="0.01"
                      min="0.1"
                      required
                      value={newGlobalPrice}
                      onChange={(e) => setNewGlobalPrice(e.target.value)}
                      placeholder="Ej: 1500.00"
                      className="w-full h-[44px] pl-8 pr-[14px] border border-border-strong rounded-md bg-bg-canvas text-[12px] text-text-primary hover:border-[#B0AFA8] focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1">Precio actual: ${(flavors[0] as any)?.price_per_kilo || 1000}</p>
                </div>
              </form>
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={() => setIsPriceModalOpen(false)}
                type="button"
                className="h-12 px-4 rounded-md font-medium text-text-primary border border-transparent hover:bg-black/5 transition-colors"
                disabled={isPricePending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="price-form"
                disabled={isPricePending}
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md font-medium bg-success text-white hover:bg-success-hover transition-colors disabled:opacity-50"
              >
                {isPricePending ? (
                  <i className="ti ti-loader-2 animate-spin text-[18px]"></i>
                ) : (
                  <i className="ti ti-device-floppy text-[18px]"></i>
                )}
                {isPricePending ? "Guardando..." : "Actualizar masivamente"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Cargar Insumo Nuevo */}
      {isSupplyModalOpen && setIsSupplyModalOpen && handleCreateSupply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Cargar insumo nuevo
              </h2>
              <button
                onClick={() => setIsSupplyModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {supplyError && (
                <div className="flex items-center gap-3 p-4 bg-brand-soft-bg text-brand-soft-text rounded-lg text-[14px] mb-4">
                  <i className="ti ti-alert-circle text-[20px]"></i>
                  <span className="font-medium">{supplyError}</span>
                </div>
              )}
              <form action={handleCreateSupply} id="supply-form" className="space-y-4">
                <div className="field-group">
                  <label className="field-label">Nombre</label>
                  <input type="text" name="name" required className="input" placeholder="Ej: Cucurucho bañado" />
                </div>
                <div className="field-group">
                  <label className="field-label">Precio por unidad</label>
                  <input type="number" name="price_per_unit" min="0" step="0.01" required className="input" placeholder="Ej: 120" />
                </div>
              </form>
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={() => setIsSupplyModalOpen(false)}
                type="button"
                className="btn btn-ghost"
                disabled={isSupplyPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="supply-form"
                disabled={isSupplyPending}
                className="btn btn-primary btn-lg"
              >
                <i className="ti ti-check text-[18px]"></i>
                {isSupplyPending ? "Guardando..." : "Guardar insumo"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Editar Insumo */}
      {isEditSupplyModalOpen && setIsEditSupplyModalOpen && handleEditSupply && selectedSupplyForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary">
                Editar Insumo
              </h2>
              <button
                onClick={() => setIsEditSupplyModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {supplyError && (
                <div className="flex items-center gap-3 p-4 bg-brand-soft-bg text-brand-soft-text rounded-lg text-[14px] mb-4">
                  <i className="ti ti-alert-circle text-[20px]"></i>
                  <span className="font-medium">{supplyError}</span>
                </div>
              )}
              <form action={(formData) => handleEditSupply(selectedSupplyForEdit.id, formData)} id="edit-supply-form" className="space-y-4">
                <div className="field-group">
                  <label className="field-label">Nombre</label>
                  <input type="text" name="name" required defaultValue={selectedSupplyForEdit.name} className="input" placeholder="Ej: Cucurucho bañado" />
                </div>
                <div className="field-group">
                  <label className="field-label">Precio por unidad</label>
                  <input type="number" name="price_per_unit" min="0" step="0.01" required defaultValue={selectedSupplyForEdit.price_per_unit} className="input" placeholder="Ej: 120" />
                </div>
              </form>
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={() => setIsEditSupplyModalOpen(false)}
                type="button"
                className="btn btn-ghost"
                disabled={isSupplyPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="edit-supply-form"
                disabled={isSupplyPending}
                className="btn btn-primary btn-lg"
              >
                <i className="ti ti-check text-[18px]"></i>
                {isSupplyPending ? "Guardando..." : "Guardar cambios"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal - Eliminar Insumo */}
      {isDeleteSupplyModalOpen && setIsDeleteSupplyModalOpen && handleDeleteSupply && selectedSupplyForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-canvas rounded-xl shadow-lg w-full max-w-[400px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-[18px] font-medium text-text-primary flex items-center gap-2">
                <i className="ti ti-alert-triangle text-danger"></i>
                Eliminar Insumo
              </h2>
              <button
                onClick={() => setIsDeleteSupplyModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-colors"
              >
                <i className="ti ti-x text-[18px]"></i>
              </button>
            </header>

            <div className="p-5">
              {supplyError && (
                <div className="flex items-center gap-3 p-4 bg-brand-soft-bg text-brand-soft-text rounded-lg text-[14px] mb-4">
                  <i className="ti ti-alert-circle text-[20px]"></i>
                  <span className="font-medium">{supplyError}</span>
                </div>
              )}
              <p className="text-[14px] text-text-secondary mb-2">
                ¿Estás seguro que querés eliminar el insumo <strong>{selectedSupplyForDelete.name}</strong>?
              </p>
              <p className="text-[14px] text-text-secondary">
                Esta acción no se puede deshacer.
              </p>
            </div>

            <footer className="flex justify-end gap-3 p-4 border-t border-border-subtle bg-bg-surface">
              <button
                onClick={() => setIsDeleteSupplyModalOpen(false)}
                type="button"
                className="btn btn-ghost"
                disabled={isSupplyPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteSupply(selectedSupplyForDelete.id)}
                disabled={isSupplyPending}
                className="btn btn-primary btn-lg bg-danger hover:bg-danger-hover border-danger"
              >
                <i className="ti ti-trash text-[18px]"></i>
                {isSupplyPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
