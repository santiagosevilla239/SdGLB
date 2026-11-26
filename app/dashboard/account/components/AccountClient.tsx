"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AccountMovement,
  BranchAccountSummary,
} from "@/types/database";
import { PaymentModal } from "./PaymentModal";
import { deletePayment, getBranchAccountStatement } from "@/actions/account";
import { toast } from "react-toastify";
import { createUnifiedSheet, downloadExcelWorkbook } from "@/lib/excel";

interface AccountClientProps {
  initialStatement: {
    branch: { id: string; name: string; address?: string } | null;
    branches: { id: string; name: string }[];
    isAdmin: boolean;
    movements: AccountMovement[];
    summary: {
      totalOrdersAmount: number;
      totalPaymentsAmount: number;
      currentBalance: number;
    };
  };
  initialGlobalSummaries?: BranchAccountSummary[];
}

export function AccountClient({
  initialStatement,
  initialGlobalSummaries = [],
}: AccountClientProps) {
  const [statement, setStatement] = useState(initialStatement);
  const [selectedBranchId, setSelectedBranchId] = useState(
    initialStatement.branch?.id || (initialStatement.branches[0]?.id || "")
  );
  const [activeTab, setActiveTab] = useState<"detalle" | "resumen_global">(
    initialStatement.isAdmin && initialGlobalSummaries.length > 0
      ? "detalle"
      : "detalle"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todos" | "pedido" | "pago">("todos");

  const isAdmin = statement.isAdmin;
  const currentBranch = statement.branch;
  const summary = statement.summary;
  const movements = statement.movements;

  const handleBranchChange = async (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    setIsLoading(true);
    const res = await getBranchAccountStatement(newBranchId);
    if (!res.error && res.success) {
      setStatement(res as any);
    }
    setIsLoading(false);
  };

  const reloadStatement = async () => {
    setIsLoading(true);
    const res = await getBranchAccountStatement(selectedBranchId);
    if (!res.error && res.success) {
      setStatement(res as any);
    }
    setIsLoading(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("¿Estás seguro de que querés eliminar este pago?")) return;
    const res = await deletePayment(paymentId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Pago eliminado.");
    reloadStatement();
  };

  // Filtrado de movimientos
  const filteredMovements = movements.filter((mov) => {
    if (typeFilter !== "todos" && mov.type !== typeFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchId = mov.displayId.toLowerCase().includes(q);
      const matchDesc = mov.description.toLowerCase().includes(q);
      const matchNotes = mov.notes ? mov.notes.toLowerCase().includes(q) : false;
      const matchRef = mov.referenceNumber ? mov.referenceNumber.toLowerCase().includes(q) : false;
      return matchId || matchDesc || matchNotes || matchRef;
    }
    return true;
  });

  // Exportar a Excel (formato nativo .xlsx con auto-ajuste dinámico de columnas y formato contable)
  const handleExportExcel = async () => {
    // Caso A: Exportación de Resumen Global de todas las sucursales (Admin)
    if (isAdmin && activeTab === "resumen_global") {
      let grandTotalOrders = 0;
      let grandTotalPayments = 0;
      let grandTotalBalance = 0;

      const rows = initialGlobalSummaries.map((s) => {
        grandTotalOrders += s.totalOrdersAmount;
        grandTotalPayments += s.totalPaymentsAmount;
        grandTotalBalance += s.currentBalance;

        return [
          s.branchName,
          s.totalOrdersAmount,
          s.totalPaymentsAmount,
          s.currentBalance,
          s.currentBalance > 0 ? "Saldo Pendiente" : "Al Día",
        ];
      });

      const worksheet = await createUnifiedSheet({
        title: "HELADERÍA LOS BAMBINOS - RESUMEN GLOBAL DE CUENTAS CORRIENTES",
        metadata: [`Fecha de emisión: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
        headers: ["Sucursal", "Total Pedidos ($)", "Total Pagos ($)", "Saldo Deudor ($)", "Estado"],
        rows,
        totalsRow: [
          "TOTAL GENERAL",
          grandTotalOrders,
          grandTotalPayments,
          grandTotalBalance,
          grandTotalBalance > 0 ? "Saldo Deudor Total" : "Al Día",
        ],
        currencyColIndices: [1, 2, 3],
      });

      await downloadExcelWorkbook(
        `resumen_global_cuentas_corrientes_${format(new Date(), "ddMMyy")}.xlsx`,
        [{ sheetName: "Resumen Sucursales", worksheet }]
      );
      return;
    }

    // Caso B: Exportación de Detalle de Cuenta Corriente por Sucursal
    const branchName = currentBranch?.name || "Sucursal";
    const statusText =
      summary.currentBalance > 0
        ? "Saldo Pendiente (Deudor)"
        : "Al Día (Sin deuda)";

    const chronological = [...movements].reverse();
    const rows = chronological.map((mov) => {
      const dateObj = new Date(mov.date);
      return [
        format(dateObj, "dd/MM/yyyy"),
        format(dateObj, "HH:mm"),
        mov.type === "pedido" ? "Pedido" : "Pago",
        mov.displayId,
        mov.description,
        mov.referenceNumber || "-",
        mov.notes || "-",
        mov.debit > 0 ? mov.debit : "-",
        mov.credit > 0 ? mov.credit : "-",
        mov.balance,
      ];
    });

    const worksheet = await createUnifiedSheet({
      title: "HELADERÍA LOS BAMBINOS - ESTADO DE CUENTA CORRIENTE",
      metadata: [
        `Sucursal: ${branchName}   |   Fecha de emisión: ${format(new Date(), "dd/MM/yyyy HH:mm")}   |   Estado: ${statusText}`,
        `Total Pedidos: $ ${summary.totalOrdersAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}   |   Total Pagos: $ ${summary.totalPaymentsAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}   |   SALDO ACTUAL: $ ${summary.currentBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
      ],
      headers: [
        "Fecha",
        "Hora",
        "Tipo",
        "Comprobante",
        "Concepto / Detalle",
        "Referencia",
        "Observaciones",
        "Débito ($)",
        "Crédito ($)",
        "Saldo Acumulado ($)",
      ],
      rows,
      totalsRow: [
        "TOTALES",
        "",
        "",
        "",
        "",
        "",
        "",
        summary.totalOrdersAmount,
        summary.totalPaymentsAmount,
        summary.currentBalance,
      ],
      currencyColIndices: [7, 8, 9],
    });

    const sanitizedBranch = branchName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_");

    await downloadExcelWorkbook(
      `cuenta_corriente_${sanitizedBranch}_${format(new Date(), "ddMMyy")}.xlsx`,
      [{ sheetName: "Cuenta Corriente", worksheet }]
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
            Cuenta Corriente
          </h1>
          <p className="text-[14px] text-text-secondary">
            {isAdmin
              ? "Supervisión contable de pedidos, cobranzas y saldos de sucursales"
              : `Estado contable y registro de pagos · ${currentBranch?.name || "Mi Sucursal"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón Exportar Excel */}
          <button
            onClick={handleExportExcel}
            disabled={
              activeTab === "resumen_global"
                ? initialGlobalSummaries.length === 0
                : movements.length === 0
            }
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md text-[13px] font-medium text-[#107c41] bg-[#107c41]/10 border border-[#107c41]/25 hover:bg-[#107c41]/20 transition-colors disabled:opacity-50"
            title="Descargar estado de cuenta en archivo Excel (.xlsx)"
          >
            <i className="ti ti-file-spreadsheet text-[18px]"></i>
            <span>Exportar a Excel</span>
          </button>

          {/* Botón Informar/Registrar Pago */}
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md text-[14px] font-medium bg-success text-white hover:bg-success-hover shadow-sm transition-colors"
          >
            <i className="ti ti-cash text-[18px]"></i>
            <span>{isAdmin ? "Registrar Pago" : "Informar Pago"}</span>
          </button>
        </div>
      </div>

      {/* Tabs para Admin: Detalle de Sucursal vs Resumen Global */}
      {isAdmin && initialGlobalSummaries.length > 0 && (
        <div className="flex border-b border-border-subtle gap-4">
          <button
            onClick={() => setActiveTab("detalle")}
            className={`pb-3 text-[14px] font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "detalle"
                ? "border-brand text-brand"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Detalle por Sucursal
          </button>
          <button
            onClick={() => setActiveTab("resumen_global")}
            className={`pb-3 text-[14px] font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "resumen_global"
                ? "border-brand text-brand"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Resumen Global de Saldos ({initialGlobalSummaries.length} sucursales)
          </button>
        </div>
      )}

      {/* VISTA RESUMEN GLOBAL (Solo Admin) */}
      {isAdmin && activeTab === "resumen_global" && (
        <div className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border-subtle bg-bg-surface flex justify-between items-center">
            <h2 className="text-[16px] font-medium text-text-primary">
              Saldos Pendientes por Sucursal
            </h2>
            <span className="text-[12px] text-text-secondary">
              Actualizado al instante
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead className="bg-bg-surface text-[11px] font-medium text-text-secondary uppercase">
                <tr>
                  <th className="px-5 py-3 border-b border-border-subtle whitespace-nowrap">Sucursal</th>
                  <th className="px-5 py-3 border-b border-border-subtle text-right whitespace-nowrap">Total Pedidos</th>
                  <th className="px-5 py-3 border-b border-border-subtle text-right whitespace-nowrap">Total Pagos</th>
                  <th className="px-5 py-3 border-b border-border-subtle text-right whitespace-nowrap">Saldo Deudor</th>
                  <th className="px-5 py-3 border-b border-border-subtle text-center whitespace-nowrap">Estado</th>
                  <th className="px-5 py-3 border-b border-border-subtle text-right whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-[13px]">
                {initialGlobalSummaries.map((s) => {
                  const hasDebt = s.currentBalance > 0;
                  return (
                    <tr key={s.branchId} className="hover:bg-bg-surface transition-colors">
                      <td className="px-5 py-3 font-medium text-text-primary">
                        {s.branchName}
                      </td>
                      <td className="px-5 py-3 font-mono text-text-secondary text-right">
                        $ {s.totalOrdersAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 font-mono text-text-secondary text-right">
                        $ {s.totalPaymentsAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-5 py-3 font-mono font-semibold text-right ${hasDebt ? "text-danger" : "text-success"}`}>
                        $ {s.currentBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center py-0.5 px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap ${
                            hasDebt
                              ? "bg-danger-soft-bg text-danger"
                              : "bg-success-soft-bg text-success"
                          }`}
                        >
                          {hasDebt ? "Saldo Pendiente" : "Al Día"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            handleBranchChange(s.branchId);
                            setActiveTab("detalle");
                          }}
                          className="h-8 px-3 text-[12px] font-medium text-brand bg-brand/10 hover:bg-brand/20 rounded-md transition-colors"
                        >
                          Ver movimientos
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA DETALLE DE CUENTA CORRIENTE (Por Sucursal) */}
      {(activeTab === "detalle" || !isAdmin) && (
        <div className="space-y-6">
          {/* Selector de Sucursal para Admin */}
          {isAdmin && statement.branches.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-bg-surface border border-border-subtle rounded-lg">
              <span className="text-[13px] font-medium text-text-secondary flex items-center gap-1.5">
                <i className="ti ti-building-store text-[18px] text-brand"></i>
                Seleccionar Sucursal:
              </span>
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="h-10 px-3 border border-border-strong bg-bg-canvas rounded-md text-[14px] font-medium text-text-primary focus:outline-none focus:border-brand min-w-[240px]"
              >
                {statement.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {isLoading && (
                <span className="text-[13px] text-text-secondary flex items-center gap-1">
                  <i className="ti ti-loader animate-spin text-[16px]"></i>
                  Cargando...
                </span>
              )}
            </div>
          )}

          {/* Tarjetas KPI de Saldo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Saldo Pendiente */}
            <div className={`p-5 rounded-xl border flex flex-col justify-between ${
              summary.currentBalance > 0
                ? "bg-danger-soft-bg/30 border-danger/30"
                : "bg-success-soft-bg/30 border-success/30"
            }`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
                  Saldo Pendiente a Pagar
                </span>
                <span
                  className={`inline-flex items-center py-0.5 px-2 rounded-full text-[10px] font-semibold uppercase ${
                    summary.currentBalance > 0
                      ? "bg-danger text-white"
                      : "bg-success text-white"
                  }`}
                >
                  {summary.currentBalance > 0 ? "Saldo Deudor" : "Al Día"}
                </span>
              </div>
              <div className={`text-[28px] font-bold font-mono tracking-tight ${
                summary.currentBalance > 0 ? "text-danger" : "text-success"
              }`}>
                $ {summary.currentBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-text-secondary mt-1">
                {summary.currentBalance > 0
                  ? "Diferencia acumulada entre pedidos entregados y pagos registrados"
                  : "No posee deuda acumulada en pedidos anteriores"}
              </p>
            </div>

            {/* Total Pedidos Entregados */}
            <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
                  Total Pedidos Entregados
                </span>
                <i className="ti ti-truck text-[20px] text-brand"></i>
              </div>
              <div className="text-[28px] font-bold font-mono text-text-primary tracking-tight">
                $ {summary.totalOrdersAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-text-secondary mt-1">
                Suma total de cargos por pedidos despachados a la sucursal
              </p>
            </div>

            {/* Total Pagos Registrados */}
            <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
                  Total Pagos Acreditados
                </span>
                <i className="ti ti-cash text-[20px] text-success"></i>
              </div>
              <div className="text-[28px] font-bold font-mono text-text-primary tracking-tight">
                $ {summary.totalPaymentsAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-text-secondary mt-1">
                Monto acumulado de transferencias y pagos informados
              </p>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="bg-bg-canvas border border-border-subtle rounded-lg overflow-hidden shadow-sm flex flex-col">
            {/* Barra de Filtros */}
            <div className="p-4 border-b border-border-subtle bg-bg-surface flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-medium text-text-primary">
                  Libro de Movimientos
                </h2>
                <span className="text-[12px] text-text-secondary">
                  ({filteredMovements.length} registros)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro por Tipo */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="h-9 px-2.5 border border-border-strong bg-bg-canvas rounded-md text-[13px] text-text-primary focus:outline-none focus:border-brand"
                >
                  <option value="todos">Todos los movimientos</option>
                  <option value="pedido">Solo Pedidos</option>
                  <option value="pago">Solo Pagos</option>
                </select>

                {/* Buscador */}
                <div className="relative">
                  <i className="ti ti-search absolute left-2.5 top-2.5 text-text-secondary text-[14px]"></i>
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Buscar comprobante..."
                    className="h-9 pl-8 pr-3 border border-border-strong bg-bg-canvas rounded-md text-[13px] text-text-primary focus:outline-none focus:border-brand placeholder:text-text-secondary/50 w-full sm:w-48"
                  />
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead className="bg-bg-surface text-[11px] font-medium text-text-secondary uppercase">
                  <tr>
                    <th className="px-5 py-3 border-b border-border-subtle whitespace-nowrap">Fecha</th>
                    <th className="px-5 py-3 border-b border-border-subtle whitespace-nowrap">Tipo</th>
                    <th className="px-5 py-3 border-b border-border-subtle whitespace-nowrap">Comprobante</th>
                    <th className="px-5 py-3 border-b border-border-subtle whitespace-nowrap">Detalle / Notas</th>
                    <th className="px-5 py-3 border-b border-border-subtle text-right whitespace-nowrap">Débito (+)</th>
                    <th className="px-5 py-3 border-b border-border-subtle text-right whitespace-nowrap">Crédito (-)</th>
                    <th className="px-5 py-3 border-b border-border-subtle text-right whitespace-nowrap">Saldo ($)</th>
                    {isAdmin && (
                      <th className="px-4 py-3 border-b border-border-subtle text-center whitespace-nowrap">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y border-subtle text-[13px]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-5 py-8 text-center text-text-secondary">
                        <i className="ti ti-loader animate-spin text-[18px] mr-2"></i>
                        Cargando movimientos...
                      </td>
                    </tr>
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-5 py-8 text-center text-text-secondary">
                        No hay movimientos registrados para esta sucursal.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mov) => {
                      const isOrder = mov.type === "pedido";
                      return (
                        <tr key={mov.id} className="hover:bg-bg-surface transition-colors">
                          {/* Fecha */}
                          <td className="px-5 py-3 text-text-secondary whitespace-nowrap text-[12px]">
                            {mov.date
                              ? format(new Date(mov.date), "dd/MM/yyyy HH:mm", { locale: es })
                              : "-"}
                          </td>

                          {/* Tipo */}
                          <td className="px-5 py-3 whitespace-nowrap">
                            {isOrder ? (
                              <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-brand-soft-bg text-brand text-[11px] font-medium">
                                <i className="ti ti-truck text-[12px]"></i>
                                Pedido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-success-soft-bg text-success text-[11px] font-medium">
                                <i className="ti ti-cash text-[12px]"></i>
                                Pago
                              </span>
                            )}
                          </td>

                          {/* Comprobante */}
                          <td className="px-5 py-3 font-mono font-medium text-text-primary whitespace-nowrap">
                            {mov.displayId}
                          </td>

                          {/* Detalle */}
                          <td className="px-5 py-3 text-text-primary">
                            <div>{mov.description}</div>
                            {mov.referenceNumber && (
                              <div className="text-[11px] font-mono text-text-secondary">
                                Ref: {mov.referenceNumber}
                              </div>
                            )}
                            {mov.notes && (
                              <div className="text-[11px] text-text-secondary italic">
                                {mov.notes}
                              </div>
                            )}
                          </td>

                          {/* Débito (Pedido) */}
                          <td className="px-5 py-3 font-mono text-right text-text-primary whitespace-nowrap">
                            {mov.debit > 0 ? (
                              <span className="text-danger font-medium">
                                + $ {mov.debit.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-text-secondary/40">-</span>
                            )}
                          </td>

                          {/* Crédito (Pago) */}
                          <td className="px-5 py-3 font-mono text-right text-text-primary whitespace-nowrap">
                            {mov.credit > 0 ? (
                              <span className="text-success font-medium">
                                - $ {mov.credit.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-text-secondary/40">-</span>
                            )}
                          </td>

                          {/* Saldo Acumulado */}
                          <td className={`px-5 py-3 font-mono font-semibold text-right whitespace-nowrap ${
                            mov.balance > 0 ? "text-danger" : "text-success"
                          }`}>
                            $ {mov.balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Acciones de Admin */}
                          {isAdmin && (
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {!isOrder && (
                                <button
                                  onClick={() => handleDeletePayment(mov.id)}
                                  className="w-7 h-7 inline-flex items-center justify-center rounded text-text-secondary hover:text-danger hover:bg-danger-soft-bg transition-colors"
                                  title="Eliminar registro de pago"
                                >
                                  <i className="ti ti-trash text-[15px]"></i>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Registrar/Informar Pago */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        branchId={currentBranch?.id || ""}
        branchName={currentBranch?.name || ""}
        isAdmin={isAdmin}
        branches={statement.branches}
        onSuccess={reloadStatement}
      />
    </div>
  );
}
