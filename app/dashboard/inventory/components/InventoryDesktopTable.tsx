import { Dispatch, SetStateAction } from "react";
import { FlavorWithStock } from "@/types/database";

interface InventoryDesktopTableProps {
  isLoading: boolean;
  flavors: FlavorWithStock[];
  setWeighModalConfig: Dispatch<SetStateAction<{ isOpen: boolean; flavorId: string | null }>>;
}

export function InventoryDesktopTable({
  isLoading,
  flavors,
  setWeighModalConfig,
}: InventoryDesktopTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-bg-surface">
          <tr>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
              Sabor
            </th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
              Latas en stock
            </th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
              Peso total
            </th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">
              Peso promedio por lata
            </th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase w-[120px]">
              Estado
            </th>
            <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase w-[80px] text-right">
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {flavors.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-5 py-8 text-center text-text-secondary text-[14px]"
              >
                {isLoading
                  ? "Cargando sabores..."
                  : "No hay sabores registrados."}
              </td>
            </tr>
          ) : (
            flavors.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-bg-surface transition-colors cursor-default"
              >
                <td className="px-5 py-3 text-[14px] text-text-primary flex items-center gap-2">
                  {item.name}
                  <span className="text-[11px] text-text-secondary font-mono bg-bg-canvas px-1.5 py-0.5 rounded border border-border-subtle">
                    #{item.id}
                  </span>
                </td>
                <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">
                  {item.stock}
                </td>
                <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">
                  {item.totalWeight}
                </td>
                <td className="px-5 py-3 text-[12px] text-text-secondary font-mono">
                  {item.avgWeight}
                </td>
                <td className="px-5 py-3">
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
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() =>
                      setWeighModalConfig({
                        isOpen: true,
                        flavorId: item.id,
                      })
                    }
                    className="h-8 px-3 text-[12px] font-medium text-text-primary border border-border-strong rounded-md hover:bg-bg-surface transition-colors"
                  >
                    Pesar
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
