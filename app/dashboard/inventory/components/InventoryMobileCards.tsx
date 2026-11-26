import { Dispatch, SetStateAction } from "react";
import { FlavorWithStock } from "@/types/database";

interface InventoryMobileCardsProps {
  isLoading: boolean;
  flavors: FlavorWithStock[];
  setWeighModalConfig: Dispatch<SetStateAction<{ isOpen: boolean; flavorId: string | null }>>;
}

export function InventoryMobileCards({
  isLoading,
  flavors,
  setWeighModalConfig,
}: InventoryMobileCardsProps) {
  return (
    <div className="md:hidden flex flex-col gap-4 p-4 bg-bg-canvas/50">
      {flavors.length === 0 ? (
        <div className="text-center text-text-secondary text-[14px] py-8 bg-bg-canvas border border-border-subtle rounded-lg">
          {isLoading ? "Cargando sabores..." : "No hay sabores registrados."}
        </div>
      ) : (
        flavors.map((item) => (
          <div
            key={item.id}
            className="bg-bg-canvas border border-border-subtle rounded-lg p-4 flex flex-col gap-4 shadow-sm"
          >
            <div className="flex justify-between items-start">
              <h3 className="text-[16px] font-medium text-text-primary flex flex-wrap items-center gap-2">
                {item.name}
                <span className="text-[11px] text-text-secondary font-mono bg-bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                  #{item.id}
                </span>
              </h3>
              <span
                className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium ${
                  item.statusType === "Sin stock"
                    ? "bg-brand-soft-bg text-brand-soft-text"
                    : item.statusType === "Limitado"
                      ? "bg-warning-soft-bg text-warning-soft-text"
                      : "bg-success-soft-bg text-success-soft-text"
                }`}
              >
                {item.statusType}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-[12px] bg-bg-surface p-3 rounded-md border border-border-subtle">
              <div className="flex flex-col gap-1">
                <span className="text-text-secondary">Latas</span>
                <span className="text-text-primary font-mono text-[14px]">
                  {item.stock}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-text-secondary">Peso total</span>
                <span className="text-text-primary font-mono text-[14px]">
                  {item.totalWeight}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-text-secondary">
                  Peso promedio por lata
                </span>
                <span className="text-text-primary font-mono text-[14px]">
                  {item.avgWeight}
                </span>
              </div>
            </div>

            <div>
              <button
                onClick={() =>
                  setWeighModalConfig({ isOpen: true, flavorId: item.id })
                }
                className="w-full h-10 flex items-center justify-center gap-2 text-[13px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors"
              >
                <i className="ti ti-weight text-[16px]"></i>
                Pesar lata
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
