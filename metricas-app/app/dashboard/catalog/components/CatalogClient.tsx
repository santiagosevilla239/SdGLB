"use client";

import { useCartStore } from "@/store/useCartStore";
import { useState, useTransition } from "react";
import { createOrder } from "@/actions/orders";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { CatalogFlavor } from "@/types/database";

interface CatalogClientProps {
  flavors: CatalogFlavor[];
  supplies: any[];
  role?: string;
}

export default function CatalogClient({ flavors, supplies, role = "user" }: CatalogClientProps) {
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
  } = useCartStore();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"latas" | "insumos">("latas");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const totalItems = getTotalItems();

  const approximatePrice = items.reduce((acc, item) => {
    if (item.type === "tub") {
      const flavor = flavors.find((f) => f.id === item.id);
      if (!flavor) return acc;
      return acc + item.quantity * flavor.avgWeight * flavor.price_per_kilo;
    } else {
      const supply = supplies.find((s) => s.id === item.id);
      if (!supply) return acc;
      const unitCount = supply.bulk_quantity || 1;
      return acc + item.quantity * unitCount * supply.price_per_unit;
    }
  }, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleSendOrder = async () => {
    if (items.length === 0) return;

    startTransition(async () => {
      const tubItems = items.filter(i => i.type === "tub").map(i => ({ id: i.id, quantity: i.quantity }));
      const supplyItems = items.filter(i => i.type === "supply").map(i => ({ id: i.id, quantity: i.quantity }));

      const res = await createOrder(
        tubItems,
        supplyItems,
        approximatePrice
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Pedido enviado a la fábrica");
        clearCart();
        setIsConfirmModalOpen(false);
        router.push("/dashboard/orders");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
      {/* Main Content */}
      <div className="min-w-0">
        <div className="flex flex-col sm:flex-row border-b border-border-subtle mb-5 gap-4 sm:items-end justify-between">
          <div className="flex gap-4">
            <button
              className={`pb-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "latas"
                  ? "border-brand text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => {
                setActiveTab("latas");
                setSearchQuery("");
              }}
            >
              <i className="ti ti-ice-cream text-[18px]"></i>
              Latas de helado
            </button>
            <button
              className={`pb-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "insumos"
                  ? "border-brand text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => {
                setActiveTab("insumos");
                setSearchQuery("");
              }}
            >
              <i className="ti ti-box text-[18px]"></i>
              Insumos
            </button>
          </div>
          <div className="pb-2 sm:mb-0 w-full sm:w-auto">
            <div className="relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-base"></i>
              <input
                type="text"
                placeholder={activeTab === "latas" ? "Buscar sabor..." : "Buscar insumo..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 h-9 pl-9 pr-3 rounded-md bg-bg-surface border border-border-strong text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
              />
            </div>
          </div>
        </div>

        {activeTab === "latas" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {flavors.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((flavor) => {
              const cartItem = items.find((i) => i.id === flavor.id);
              const qty = cartItem ? cartItem.quantity : 0;
              const isInCart = qty > 0;

              return (
                <article
                  key={flavor.id}
                  className={`bg-bg-canvas border rounded-xl p-5 flex flex-col gap-3 transition-colors ${
                    isInCart
                      ? "border-brand shadow-[0_0_0_1px] shadow-brand"
                      : "border-border-subtle hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-medium text-text-primary leading-tight">
                      {flavor.name}
                    </h3>
                  </div>

                  <p className="text-xs text-text-secondary mt-auto">
                    Peso promedio {flavor.avgWeight.toFixed(2)} kg por lata
                  </p>

                  <div className="flex justify-start mt-2">
                    <div className="flex items-center bg-bg-surface border border-border-strong rounded-md overflow-hidden">
                      <button
                        onClick={() => updateQuantity(flavor.id, qty - 1)}
                        disabled={qty <= 0}
                        className="w-10 h-10 flex items-center justify-center text-text-secondary hover:bg-black/5 disabled:opacity-50 transition-colors"
                      >
                        <i className="ti ti-minus"></i>
                      </button>
                      <span className="w-12 text-center text-sm font-medium text-text-primary font-mono">
                        {qty}
                      </span>
                      <button
                        onClick={() => {
                          if (qty === 0)
                            addItem({ id: flavor.id, name: flavor.name, type: "tub" });
                          else updateQuantity(flavor.id, qty + 1);
                        }}
                        className="w-10 h-10 flex items-center justify-center text-text-secondary hover:bg-black/5 disabled:opacity-50 transition-colors"
                      >
                        <i className="ti ti-plus"></i>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {activeTab === "insumos" && (
          <div>
            <div className="flex flex-wrap gap-4 mb-5 text-xs text-text-secondary">
              <span className="flex items-center gap-2">
                Los insumos se piden por bulto cerrado. Abajo de cada uno ves cuántas unidades entran.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {supplies.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((supply) => {
                const cartItem = items.find((i) => i.id === supply.id);
                const qty = cartItem ? cartItem.quantity : 0;
                const isInCart = qty > 0;

                return (
                  <article
                    key={supply.id}
                    className={`bg-bg-canvas border rounded-xl p-5 flex flex-col gap-3 transition-colors ${
                      isInCart
                        ? "border-brand shadow-[0_0_0_1px] shadow-brand"
                        : "border-border-subtle hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-medium text-text-primary leading-tight">
                        {supply.name}
                      </h3>
                    </div>

                    <p className="text-xs text-text-secondary mt-auto">
                      {supply.bulk_quantity || 1} {supply.unit}s por bulto
                    </p>

                    <div className="flex justify-start mt-2">
                      <div className="flex items-center bg-bg-surface border border-border-strong rounded-md overflow-hidden">
                        <button
                          onClick={() => updateQuantity(supply.id, qty - 1)}
                          disabled={qty <= 0}
                          className="w-10 h-10 flex items-center justify-center text-text-secondary hover:bg-black/5 disabled:opacity-50 transition-colors"
                        >
                          <i className="ti ti-minus"></i>
                        </button>
                        <span className="w-12 text-center text-sm font-medium text-text-primary font-mono">
                          {qty}
                        </span>
                        <button
                          onClick={() => {
                            if (qty === 0)
                              addItem({ id: supply.id, name: supply.name, type: "supply" });
                            else updateQuantity(supply.id, qty + 1);
                          }}
                          className="w-10 h-10 flex items-center justify-center text-text-secondary hover:bg-black/5 disabled:opacity-50 transition-colors"
                        >
                          <i className="ti ti-plus"></i>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cart Sidebar Desktop */}
      <aside className="sticky top-[80px] bg-bg-canvas border border-border-subtle rounded-xl overflow-hidden hidden md:block">
        <div className="p-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-text-primary">
            Tu pedido
          </h2>
        </div>

        <div className="max-h-[48vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center p-8">
              <i className="ti ti-shopping-cart text-[32px] text-text-tertiary block mb-2"></i>
              <p className="text-sm text-text-secondary leading-normal">
                Todavía no agregaste nada.
                <br />
                Sumá sabores o insumos desde el catálogo &rarr;
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 px-4"
                >
                  <span className="text-sm text-text-primary min-w-0 truncate">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-text-primary font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:bg-danger-soft-bg hover:text-danger transition-colors"
                    >
                      <i className="ti ti-x"></i>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-border-subtle bg-bg-surface">
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text-secondary">Ítems</span>
              <span className="text-base font-medium text-text-primary font-mono">
                {totalItems}
              </span>
            </div>
            {role !== "empleado" && (
              <div className="flex items-baseline justify-between border-t border-border-subtle pt-2 mt-1">
                <span className="text-sm font-medium text-text-secondary">
                  Aprox. total
                </span>
                <span className="text-lg font-bold text-brand font-mono">
                  {formatPrice(approximatePrice)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={items.length === 0}
            className="btn btn-primary w-full h-12 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ti ti-send"></i>
            Enviar pedido
          </button>
        </div>
      </aside>

      {/* Cart Bar Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 p-3 px-4 bg-bg-canvas border-t border-border-strong shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary font-mono leading-none mb-1">
            {totalItems} ítems
          </span>
          {role !== "empleado" && (
            <span className="text-xs text-text-secondary font-mono">
              {formatPrice(approximatePrice)}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsConfirmModalOpen(true)}
          disabled={items.length === 0}
          className="btn btn-primary flex items-center gap-2 h-10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="ti ti-send"></i>
          Enviar pedido
        </button>
      </div>

      {/* Confirm Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
          <div className="bg-bg-canvas rounded-xl w-full max-w-md overflow-hidden shadow-lg border border-border-subtle flex flex-col max-h-[90vh]">
            <header className="flex items-center justify-between p-5 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">
                Revisá tu pedido
              </h2>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-bg-surface rounded-md"
              >
                <i className="ti ti-x text-xl"></i>
              </button>
            </header>

            <div className="p-5 flex-1 overflow-y-auto">
              <p className="text-sm text-text-secondary mb-4">
                Vas a enviar este pedido a la Fábrica Central. Cuando lo
                confirmen, te va a aparecer en &quot;Mis pedidos&quot;.
              </p>

              <ul className="border border-border-subtle rounded-md overflow-hidden divide-y divide-border-subtle mb-4">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between p-3 px-4 text-sm bg-bg-canvas"
                  >
                    <span className="text-text-primary">{item.name}</span>
                    <span className="font-medium font-mono text-text-primary">
                      {item.quantity} {item.type === "tub" ? "latas" : "bultos"}
                    </span>
                  </li>
                ))}
              </ul>

              {role !== "empleado" && (
                <div className="flex flex-col gap-2 mt-4 text-right">
                  <p className="text-sm text-text-secondary font-medium">
                    Total ítems:{" "}
                    <span className="font-mono text-text-primary">
                      {totalItems}
                    </span>
                  </p>
                  <p className="text-base text-text-secondary font-medium border-t border-border-subtle pt-2">
                    Precio estimado:{" "}
                    <span className="font-mono text-brand font-bold">
                      {formatPrice(approximatePrice)}
                    </span>
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    *El precio final puede variar según el peso exacto de cada
                    lata. Los insumos se cobran completos por el bulto.
                  </p>
                </div>
              )}
              {role === "empleado" && (
                <div className="flex flex-col gap-2 mt-4 text-right">
                  <p className="text-sm text-text-secondary font-medium">
                    Total ítems:{" "}
                    <span className="font-mono text-text-primary">
                      {totalItems}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <footer className="p-5 border-t border-border-subtle bg-bg-surface flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="btn btn-ghost"
                disabled={isPending}
              >
                Seguir agregando
              </button>
              <button
                onClick={handleSendOrder}
                disabled={isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                {isPending ? (
                  <i className="ti ti-loader animate-spin"></i>
                ) : (
                  <i className="ti ti-send"></i>
                )}
                {isPending ? "Enviando..." : "Sí, enviar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
