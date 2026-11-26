"use client";

import { useState, useTransition, useEffect } from "react";
import { addFlavor, getFlavorsWithStock, updateGlobalPrice } from "@/actions/flavors";
import { getSupplies, createSupply, updateSupply, deleteSupply } from "@/actions/supplies";
import { addBulkTubs } from "@/actions/tubs";
import { toast } from "react-toastify";
import { InventoryMobileCards } from "./InventoryMobileCards";
import { InventoryDesktopTable } from "./InventoryDesktopTable";
import { InventoryModals } from "./InventoryModals";

export default function AdminInventory() {
  const [activeTab, setActiveTab] = useState<"sabores" | "insumos">("sabores");
  const [weighModalConfig, setWeighModalConfig] = useState<{
    isOpen: boolean;
    flavorId: string | null;
  }>({ isOpen: false, flavorId: null });
  const [isFlavorModalOpen, setIsFlavorModalOpen] = useState(false);
  const [flavorError, setFlavorError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [isPricePending, startPriceTransition] = useTransition();

  const [weighError, setWeighError] = useState<string | null>(null);
  const [isWeighPending, startWeighTransition] = useTransition();

  const [flavors, setFlavors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFlavors = flavors.filter((flavor) =>
    flavor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [supplies, setSupplies] = useState<any[]>([]);
  const [isLoadingSupplies, setIsLoadingSupplies] = useState(true);

  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isEditSupplyModalOpen, setIsEditSupplyModalOpen] = useState(false);
  const [isDeleteSupplyModalOpen, setIsDeleteSupplyModalOpen] = useState(false);
  const [selectedSupplyForEdit, setSelectedSupplyForEdit] = useState<any | null>(null);
  const [selectedSupplyForDelete, setSelectedSupplyForDelete] = useState<any | null>(null);
  const [supplyError, setSupplyError] = useState<string | null>(null);
  const [isSupplyPending, startSupplyTransition] = useTransition();

  const fetchFlavors = async () => {
    const res = await getFlavorsWithStock();
    if (res.flavors) {
      setFlavors(res.flavors);
    }
    setIsLoading(false);
  };

  const fetchSupplies = async () => {
    const res = await getSupplies();
    if (res.success) {
      setSupplies(res.data || []);
    }
    setIsLoadingSupplies(false);
  };

  useEffect(() => {
    fetchFlavors();
    fetchSupplies();
  }, []);

  const handleAddFlavor = async (formData: FormData) => {
    setFlavorError(null);
    startTransition(async () => {
      const res = await addFlavor(formData);
      if (res.error) {
        setFlavorError(res.error);
      } else {
        setIsFlavorModalOpen(false);
        toast.success("Sabor cargado correctamente");
        fetchFlavors();
      }
    });
  };

  const handleAddBulkTubs = async (
    tubs: Array<{ flavorId: string; internalCode: string; grossWeight: number }>
  ) => {
    setWeighError(null);
    startWeighTransition(async () => {
      const res = await addBulkTubs(tubs);
      if (res.error) {
        setWeighError(res.error);
      } else {
        setWeighModalConfig({ isOpen: false, flavorId: null });
        toast.success(`Se guardaron ${tubs.length} lata(s) correctamente`);
        fetchFlavors();
      }
    });
  };

  const handleUpdatePrice = async (newPrice: number) => {
    setPriceError(null);
    startPriceTransition(async () => {
      const res = await updateGlobalPrice(newPrice);
      if (res.error) {
        setPriceError(res.error);
      } else {
        setIsPriceModalOpen(false);
        toast.success("Precio global actualizado");
        fetchFlavors(); // to refresh current price
      }
    });
  };

  const handleCreateSupply = async (formData: FormData) => {
    setSupplyError(null);
    startSupplyTransition(async () => {
      const res = await createSupply({
        name: formData.get("name") as string,
        price_per_unit: Number(formData.get("price_per_unit")),
      });
      if (res.error) {
        setSupplyError(res.error);
      } else {
        setIsSupplyModalOpen(false);
        toast.success("Insumo creado correctamente");
        fetchSupplies();
      }
    });
  };

  const handleEditSupply = async (supplyId: string, formData: FormData) => {
    setSupplyError(null);
    startSupplyTransition(async () => {
      const res = await updateSupply(supplyId, {
        name: formData.get("name") as string,
        price_per_unit: Number(formData.get("price_per_unit")),
      });
      if (res.error) {
        setSupplyError(res.error);
      } else {
        setIsEditSupplyModalOpen(false);
        setSelectedSupplyForEdit(null);
        toast.success("Insumo actualizado correctamente");
        fetchSupplies();
      }
    });
  };

  const handleDeleteSupply = async (supplyId: string) => {
    setSupplyError(null);
    startSupplyTransition(async () => {
      const res = await deleteSupply(supplyId);
      if (res.error) {
        setSupplyError(res.error);
      } else {
        setIsDeleteSupplyModalOpen(false);
        setSelectedSupplyForDelete(null);
        toast.success("Insumo eliminado correctamente");
        fetchSupplies();
      }
    });
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
            Inventario
          </h1>
          <p className="text-[14px] text-text-secondary">
            {flavors.length} sabores en total
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "sabores" ? (
            <>
              <button
                type="button"
                onClick={() => setIsPriceModalOpen(true)}
                className="btn btn-ghost"
              >
                <i className="ti ti-currency-dollar text-[18px]"></i>
                <span className="hidden sm:inline">Actualizar Precios</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFlavorModalOpen(true)}
                className="btn btn-ghost"
              >
                <i className="ti ti-plus text-[18px]"></i>
                <span className="hidden sm:inline">Cargar Sabor</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setWeighModalConfig({ isOpen: true, flavorId: null })
                }
                className="btn btn-primary"
              >
                <i className="ti ti-weight text-[18px]"></i>
                <span className="hidden sm:inline">Pesar lata</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsSupplyModalOpen(true)}
                className="btn btn-primary"
              >
                <i className="ti ti-plus text-[18px]"></i>
                <span className="hidden sm:inline">Crear Insumo</span>
              </button>
            </>
          )}
        </div>
      </div>

      <section className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-border-subtle bg-bg-canvas/50">
          <h2 className="text-[16px] font-medium text-text-primary">
            Stock actual
          </h2>
          <div className="relative w-full sm:max-w-[300px]">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]"></i>
            <input
              type="text"
              placeholder="Buscar sabor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-md border border-border-strong bg-bg-surface text-[13px] text-text-primary focus:outline-none focus:ring-[3px] focus:ring-brand-soft-bg focus:border-brand transition-colors"
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
            Sabores
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
            Insumos
          </button>
        </div>

        {activeTab === "sabores" ? (
          <>
            <InventoryMobileCards
              isLoading={isLoading}
              flavors={filteredFlavors}
              setWeighModalConfig={setWeighModalConfig}
            />

            <InventoryDesktopTable
              isLoading={isLoading}
              flavors={filteredFlavors}
              setWeighModalConfig={setWeighModalConfig}
            />
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-surface border-b border-border-subtle">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase">Insumo</th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase text-right">Precio Unit.</th>
                  <th className="px-5 py-3 text-[11px] font-medium text-text-secondary uppercase w-[100px] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {isLoadingSupplies ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-text-secondary text-[14px]">Cargando insumos...</td>
                  </tr>
                ) : supplies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-text-secondary text-[14px]">No hay insumos registrados.</td>
                  </tr>
                ) : (
                  supplies.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(supply => {
                    return (
                      <tr key={supply.id} className="hover:bg-bg-surface transition-colors cursor-default">
                        <td className="px-5 py-3 text-[14px] text-text-primary">
                          {supply.name}
                        </td>
                        <td className="px-5 py-3 text-[12px] text-text-secondary font-mono text-right">
                          ${supply.price_per_unit.toLocaleString('es-AR')}
                        </td>
                        <td className="px-5 py-3 text-right flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedSupplyForEdit(supply);
                              setIsEditSupplyModalOpen(true);
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            <i className="ti ti-edit"></i> Editar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSupplyForDelete(supply);
                              setIsDeleteSupplyModalOpen(true);
                            }}
                            className="btn btn-ghost btn-sm text-danger hover:bg-danger-soft-bg hover:border-danger"
                          >
                            <i className="ti ti-trash"></i> Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <InventoryModals
        weighModalConfig={weighModalConfig}
        setWeighModalConfig={setWeighModalConfig}
        weighError={weighError}
        isWeighPending={isWeighPending}
        handleAddBulkTubs={handleAddBulkTubs}
        flavors={flavors}
        isFlavorModalOpen={isFlavorModalOpen}
        setIsFlavorModalOpen={setIsFlavorModalOpen}
        flavorError={flavorError}
        isPending={isPending}
        handleAddFlavor={handleAddFlavor}
        isPriceModalOpen={isPriceModalOpen}
        setIsPriceModalOpen={setIsPriceModalOpen}
        handleUpdatePrice={handleUpdatePrice}
        isPricePending={isPricePending}
        priceError={priceError}
        isSupplyModalOpen={isSupplyModalOpen}
        setIsSupplyModalOpen={setIsSupplyModalOpen}
        isEditSupplyModalOpen={isEditSupplyModalOpen}
        setIsEditSupplyModalOpen={setIsEditSupplyModalOpen}
        isDeleteSupplyModalOpen={isDeleteSupplyModalOpen}
        setIsDeleteSupplyModalOpen={setIsDeleteSupplyModalOpen}
        selectedSupplyForEdit={selectedSupplyForEdit}
        selectedSupplyForDelete={selectedSupplyForDelete}
        supplyError={supplyError}
        isSupplyPending={isSupplyPending}
        handleCreateSupply={handleCreateSupply}
        handleEditSupply={handleEditSupply}
        handleDeleteSupply={handleDeleteSupply}
        supplies={supplies}
      />
    </div>
  );
}
