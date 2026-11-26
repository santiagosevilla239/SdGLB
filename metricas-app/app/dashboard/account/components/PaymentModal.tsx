"use client";

import { useState } from "react";
import { registerPayment } from "@/actions/account";
import { toast } from "react-toastify";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  isAdmin?: boolean;
  branches?: { id: string; name: string }[];
  onSuccess: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  isAdmin = false,
  branches = [],
  onSuccess,
}: PaymentModalProps) {
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || (branches[0]?.id || ""));
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transferencia");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Ingresá un monto válido mayor a 0.");
      return;
    }

    const targetBranch = isAdmin ? selectedBranchId : branchId;
    if (!targetBranch) {
      setError("Seleccioná una sucursal.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await registerPayment({
        branchId: targetBranch,
        amount: numAmount,
        paymentMethod,
        paymentDate: new Date(paymentDate).toISOString(),
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      toast.success("Pago registrado exitosamente.");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar el pago.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-bg-canvas rounded-xl shadow-2xl w-full max-w-[500px] border border-border-subtle overflow-hidden flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success-soft-bg text-success flex items-center justify-center shrink-0">
              <i className="ti ti-cash text-[22px]"></i>
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-text-primary leading-tight">
                {isAdmin ? "Registrar Pago" : "Informar Pago"}
              </h3>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {isAdmin
                  ? "Registrar pago recibido en cuenta corriente"
                  : `Sucursal: ${branchName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-canvas hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <i className="ti ti-x text-[18px]"></i>
          </button>
        </header>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-danger-soft-bg text-danger border border-danger/20 rounded-md text-[13px] flex items-center gap-2">
              <i className="ti ti-alert-circle text-[16px] shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Selector de Sucursal (Solo para Admin con múltiples sucursales) */}
          {isAdmin && branches.length > 0 && (
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary uppercase mb-1.5">
                Sucursal
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full h-10 px-3 border border-border-strong bg-bg-surface rounded-md text-[14px] text-text-primary focus:outline-none focus:border-brand"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="block text-[12px] font-semibold text-text-secondary uppercase mb-1.5">
              Monto del pago ($) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-text-secondary font-mono text-[14px]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 150000"
                className="w-full h-10 pl-7 pr-3 border border-border-strong bg-bg-surface rounded-md text-[14px] text-text-primary font-mono focus:outline-none focus:border-brand"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Método de Pago */}
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary uppercase mb-1.5">
                Método de pago *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 border border-border-strong bg-bg-surface rounded-md text-[14px] text-text-primary focus:outline-none focus:border-brand"
              >
                <option value="transferencia">Transferencia bancaria</option>
                <option value="efectivo">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {/* Fecha de Pago */}
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary uppercase mb-1.5">
                Fecha del pago *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full h-10 px-3 border border-border-strong bg-bg-surface rounded-md text-[14px] text-text-primary focus:outline-none focus:border-brand"
                required
              />
            </div>
          </div>

          {/* Nro de Comprobante / Referencia */}
          <div>
            <label className="block text-[12px] font-semibold text-text-secondary uppercase mb-1.5">
              Nro. de Comprobante / Referencia
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Ej. 00094827 o Recibo Nº 102"
              className="w-full h-10 px-3 border border-border-strong bg-bg-surface rounded-md text-[14px] text-text-primary focus:outline-none focus:border-brand"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-[12px] font-semibold text-text-secondary uppercase mb-1.5">
              Observaciones o Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales, banco emisor, etc."
              rows={2}
              className="w-full p-2.5 border border-border-strong bg-bg-surface rounded-md text-[14px] text-text-primary focus:outline-none focus:border-brand resize-none"
            />
          </div>

          {/* Footer botones */}
          <footer className="flex justify-end gap-3 pt-3 border-t border-border-subtle mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-md text-[14px] font-medium text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md text-[14px] font-medium bg-success text-white hover:bg-success-hover shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i className="ti ti-loader animate-spin text-[16px]"></i>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <i className="ti ti-check text-[16px]"></i>
                  <span>Confirmar pago</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
