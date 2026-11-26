"use client";

import { useState, useEffect, useTransition } from "react";
import { getBranchFlavorsWithStock } from "@/actions/flavors";
import { getBranchSupplies } from "@/actions/supplies";
import { consumeTub, addBranchBulkTubs } from "@/actions/tubs";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { FlavorWithStock } from "@/types/database";
import { toast } from "react-toastify";
import { BranchScanModal } from "./BranchScanModal";

interface BranchInventoryProps {
  role?: string;
}

export default function BranchInventory({ role = "user" }: BranchInventoryProps) {
  const [flavors, setFlavors] = useState<FlavorWithStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFlavors = flavors.filter((flavor) =>
    flavor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [activeTab, setActiveTab] = useState<"sabores" | "insumos">("sabores");

  const [supplies, setSupplies] = useState<any[]>([]);
  const [isLoadingSupplies, setIsLoadingSupplies] = useState(true);
  const [supplySearchQuery, setSupplySearchQuery] = useState("");

  const filteredSupplies = supplies.filter((supply) =>
    supply.name.toLowerCase().includes(supplySearchQuery.toLowerCase())
  );

  // Modal state
  const [selectedFlavor, setSelectedFlavor] = useState<FlavorWithStock | null>(null);
  

  // Scan Modal State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanPending, startScanTransition] = useTransition();

  const fetchFlavors = async () => {
    const res = await getBranchFlavorsWithStock();
    if (res.flavors) {
      setFlavors(res.flavors);
      setLastUpdated(new Date());
    }
    setIsLoading(false);
  };

  const fetchSupplies = async () => {
    const res = await getBranchSupplies();
    if (res.success && res.data) {
      setSupplies(res.data);
    }
    setIsLoadingSupplies(false);
  };

  useEffect(() => {
    fetchFlavors();
    fetchSupplies();
  }, []);

  const handleConsumeTub = (tubId: string) => {
    startTransition(async () => {
      const res = await consumeTub(tubId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Lata marcada como consumida.");
        // Actualizar el estado local
        if (selectedFlavor) {
          const updatedTubs = selectedFlavor.tubs?.filter(t => t.id !== tubId);
          const newStock = (updatedTubs?.length || 0);
          const newTotalWeight = updatedTubs?.reduce((acc, t) => acc + t.weight, 0) || 0;
          
          let newStatusType = selectedFlavor.statusType;
          if (newStock === 0) newStatusType = "Sin stock";
          else if (newStock < 4) newStatusType = "Limitado";

          const updatedFlavor = {
            ...selectedFlavor,
            tubs: updatedTubs,
            stock: newStock,
            totalWeight: newStock > 0 ? newTotalWeight.toFixed(1) + " kg" : "—",
            statusType: newStatusType,
          };
          
          setSelectedFlavor(updatedFlavor);
          setFlavors(prev => prev.map(f => f.id === updatedFlavor.id ? updatedFlavor : f));
        } else {
          await fetchFlavors();
        }
      }
    });
  };


  const handleAddBranchBulkTubs = async (
    tubs: Array<{ flavorId: string; internalCode: string; grossWeight: number }>
  ) => {
    setScanError(null);
    startScanTransition(async () => {
      const res = await addBranchBulkTubs(tubs);
      if (res.error) {
        setScanError(res.error);
      } else {
        setIsScanModalOpen(false);
        toast.success(`Se guardaron ${tubs.length} lata(s) correctamente`);
        fetchFlavors();
      }
    });
  };

  const totalFlavors = flavors.length;
  const toReplenishFlavors = flavors.filter(
    (f) => f.statusType === "Sin stock" || f.statusType === "Limitado",
  ).length;

  const totalSupplies = supplies.length;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
            Mi inventario
          </h1>
          <p className="text-[14px] text-text-secondary">
            Actualizado{" "}
            {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: es })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => setIsScanModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-5 rounded-md font-medium border border-border-strong bg-bg-canvas text-text-primary hover:bg-bg-surface transition-colors"
          >
            <i className="ti ti-barcode text-[18px]"></i>
            Cargar Stock Inicial
          </button>
          <Link
            href="/dashboard/catalog"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-5 rounded-md font-medium bg-brand text-white hover:bg-brand-hover transition-colors"
          >
            <i className="ti ti-shopping-cart text-[18px]"></i>
            Pedir a fábrica
          </Link>
        </div>
      </div>

      {/* Tabla de stock */}
      <section className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-border-subtle bg-bg-surface">
          <h2 className="text-[16px] font-medium text-text-primary">
            Stock en mi sucursal
          </h2>
          <div className="relative w-full sm:max-w-[300px]">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]"></i>
            <input
              type="text"
              placeholder={activeTab === "sabores" ? "Buscar sabor..." : "Buscar insumo..."}
              value={activeTab === "sabores" ? searchQuery : supplySearchQuery}
              onChange={(e) => activeTab === "sabores" ? setSearchQuery(e.target.value) : setSupplySearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-md border border-border-strong bg-bg-canvas text-[13px] text-text-primary focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand transition-colors"
            />
          </div>
        </div>

        <div className="flex border-b border-border-subtle bg-bg-surface px-5 pt-2 gap-4">
          <button
            className={`pb-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "sabores"
                ? "border-brand text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setActiveTab("sabores")}
          >
            <i className="ti ti-ice-cream text-[18px]"></i>
            Sabores ({totalFlavors})
          </button>
          <button
            className={`pb-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "insumos"
                ? "border-brand text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setActiveTab("insumos")}
          >
            <i className="ti ti-box text-[18px]"></i>
            Insumos ({totalSupplies})
          </button>
        </div>

        {activeTab === "sabores" ? (
          <>
            {/* Mobile view Sabores */}
            <div className="md:hidden flex flex-col p-4 gap-3 bg-bg-canvas/50">
              {isLoading ? (
                <div className="text-center text-sm text-text-secondary py-8 bg-bg-canvas border border-border-subtle rounded-lg">
                  Cargando inventario...
                </div>
              ) : filteredFlavors.length > 0 ? (
                filteredFlavors.map((flavor) => (
                  <div
                    key={flavor.id}
                    className="bg-bg-canvas border border-border-subtle rounded-lg p-4 flex flex-col gap-3 shadow-sm cursor-pointer hover:border-brand/30 transition-colors"
                    onClick={() => setSelectedFlavor(flavor)}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-text-primary">{flavor.name}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          flavor.statusType === "Sin stock"
                            ? "bg-danger-soft-bg text-danger"
                            : flavor.statusType === "Limitado"
                              ? "bg-warning-soft-bg text-warning"
                              : "bg-success-soft-bg text-success"
                        }`}
                      >
                        {flavor.statusType}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-text-secondary">
                      <div className="flex flex-col">
                        <span className="text-xs">Latas</span>
                        <span className="font-mono text-text-primary font-medium">{flavor.stock}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs">Peso Aprox.</span>
                        <span className="font-mono text-text-primary">{flavor.totalWeight}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-2 mt-1 border-t border-border-subtle">
                      <Link
                        href={`/dashboard/catalog?flavor=${flavor.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-primary btn-sm h-8 text-[12px] px-3 gap-1.5"
                      >
                        <i className="ti ti-shopping-cart"></i> Pedir
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-text-secondary py-8 bg-bg-canvas border border-border-subtle rounded-lg">
                  No hay stock disponible.
                </div>
              )}
            </div>

            {/* Desktop view Sabores */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas">
                      Sabor
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas text-right">
                      En stock
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas text-right">
                      Peso disponible
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas w-[120px]">
                      Estado
                    </th>
                    <th className="px-5 py-3 text-xs font-medium text-text-secondary uppercase border-b border-border-subtle bg-bg-canvas w-[96px]">
                      <span className="sr-only">Acción</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-8 text-center text-sm text-text-secondary"
                      >
                        Cargando inventario...
                      </td>
                    </tr>
                  ) : filteredFlavors.length > 0 ? (
                    filteredFlavors.map((flavor) => (
                      <tr
                        key={flavor.id}
                        className="hover:bg-bg-surface transition-colors cursor-pointer"
                        onClick={() => setSelectedFlavor(flavor)}
                      >
                        <td className="px-5 py-3 text-sm font-medium text-text-primary hover:underline">
                          {flavor.name}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-text-primary text-right font-mono">
                          {flavor.stock}
                        </td>
                        <td className="px-5 py-3 text-sm text-text-secondary text-right font-mono">
                          {flavor.totalWeight}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              flavor.statusType === "Sin stock"
                                ? "bg-danger-soft-bg text-danger"
                                : flavor.statusType === "Limitado"
                                  ? "bg-warning-soft-bg text-warning"
                                  : "bg-success-soft-bg text-success"
                            }`}
                          >
                            {flavor.statusType}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/dashboard/catalog?flavor=${flavor.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="btn btn-ghost btn-sm"
                          >
                            Pedir
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-8 text-center text-sm text-text-secondary"
                      >
                        No hay stock disponible.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-surface border-b border-border-subtle">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">Insumo</th>
                  {role !== "empleado" && <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase text-right">Precio Unit.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {isLoadingSupplies ? (
                  <tr>
                    <td colSpan={role === "empleado" ? 1 : 2} className="px-5 py-8 text-center text-text-secondary text-[14px]">Cargando insumos...</td>
                  </tr>
                ) : supplies.length === 0 ? (
                  <tr>
                    <td colSpan={role === "empleado" ? 1 : 2} className="px-5 py-8 text-center text-text-secondary text-[14px]">No hay insumos registrados.</td>
                  </tr>
                ) : (
                  filteredSupplies.map(supply => {
                    return (
                      <tr key={supply.id} className="hover:bg-bg-surface transition-colors">
                        <td className="px-5 py-3 text-[14px] text-text-primary">
                          {supply.name}
                        </td>
                        {role !== "empleado" && (
                          <td className="px-5 py-3 text-[12px] text-text-secondary font-mono text-right">
                            ${supply.price_per_unit.toLocaleString('es-AR')}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Detalle */}
      {selectedFlavor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
          <div className="bg-bg-canvas rounded-xl w-full max-w-lg overflow-hidden shadow-lg border border-border-subtle flex flex-col max-h-[90vh]">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-text-primary">
                  {selectedFlavor.name}
                </h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedFlavor.statusType === "Sin stock"
                      ? "bg-danger-soft-bg text-danger"
                      : selectedFlavor.statusType === "Limitado"
                        ? "bg-warning-soft-bg text-warning"
                        : "bg-success-soft-bg text-success"
                  }`}
                >
                  {selectedFlavor.statusType}
                </span>
              </div>
              <button
                onClick={() => setSelectedFlavor(null)}
                className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-bg-surface rounded-md"
              >
                <i className="ti ti-x text-xl"></i>
              </button>
            </header>

            <div className="p-5 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-text-secondary text-sm">
                    Latas en stock
                  </span>
                  <span className="font-mono font-medium text-text-primary">
                    {selectedFlavor.stock}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-text-secondary text-sm">
                    Peso disponible estimado
                  </span>
                  <span className="font-mono font-medium text-text-primary">
                    {selectedFlavor.totalWeight}
                  </span>
                </div>
                
                {selectedFlavor.tubs && selectedFlavor.tubs.length > 0 && (
                  <div className="pt-4">
                    <h3 className="text-sm font-medium text-text-primary mb-3">Detalle de latas</h3>
                    <div className="space-y-2">
                      {selectedFlavor.tubs.map((tub) => (
                        <div key={tub.id} className="flex justify-between items-center p-3 bg-bg-surface border border-border-subtle rounded-md">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-text-secondary uppercase">Lata {tub.internalCode}</span>
                            <span className="text-sm font-mono text-text-primary">{tub.weight} kg</span>
                          </div>
                          <button
                            onClick={() => handleConsumeTub(tub.id)}
                            disabled={isPending}
                            className="btn btn-ghost btn-sm h-8 text-[12px] px-3 border border-border-strong text-text-secondary hover:text-danger hover:border-danger hover:bg-danger-soft-bg transition-colors"
                          >
                            <i className="ti ti-trash"></i> Consumir
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <footer className="p-5 border-t border-border-subtle bg-bg-surface flex justify-end gap-3">
              <button
                onClick={() => setSelectedFlavor(null)}
                className="btn btn-ghost"
              >
                Cerrar
              </button>
              <Link
                href={`/dashboard/catalog?flavor=${selectedFlavor.id}`}
                className="btn btn-primary"
              >
                <i className="ti ti-shopping-cart"></i>
                Pedir más de este sabor
              </Link>
            </footer>
          </div>
        </div>
      )}



      {/* Branch Scan Modal */}
      <BranchScanModal
        isOpen={isScanModalOpen}
        setIsOpen={setIsScanModalOpen}
        handleAddBranchBulkTubs={handleAddBranchBulkTubs}
        flavors={flavors}
        isPending={isScanPending}
        error={scanError}
      />
    </div>
  );
}


