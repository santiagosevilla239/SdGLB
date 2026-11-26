"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import {
  AccountMovement,
  BranchAccountSummary,
  PaymentMethod,
} from "@/types/database";

function formatShortId(order: any, branchName: string): string {
  const branchStr = branchName
    .toUpperCase()
    .replace("SUCURSAL", "")
    .trim()
    .replace(/\s+/g, "");
  const datePart = order.created_at
    ? format(new Date(order.created_at), "ddMMyy")
    : "000000";
  return `PED-${datePart}${branchStr}`;
}

export async function getBranchAccountStatement(selectedBranchId?: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "No autorizado." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, branch_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { error: "Perfil no encontrado." };
    }

    if (profile.role === "empleado") {
      return { error: "Los empleados no tienen acceso a la cuenta corriente." };
    }

    const isAdmin = profile.role === "admin";

    // Obtener todas las sucursales para el selector de admin
    let branchesList: { id: string; name: string }[] = [];
    if (isAdmin) {
      const { data: bList } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_central", false)
        .order("name", { ascending: true });
      branchesList = bList || [];
    }

    // Determinar la sucursal objetivo
    let targetBranchId: string | null = null;
    if (isAdmin) {
      targetBranchId = selectedBranchId || (branchesList.length > 0 ? branchesList[0].id : null);
    } else {
      targetBranchId = profile.branch_id;
    }

    if (!targetBranchId) {
      return {
        success: true,
        branch: null,
        branches: branchesList,
        movements: [],
        summary: {
          totalOrdersAmount: 0,
          totalPaymentsAmount: 0,
          currentBalance: 0,
        },
      };
    }

    // Obtener información de la sucursal
    const { data: currentBranch } = await supabase
      .from("branches")
      .select("id, name, address")
      .eq("id", targetBranchId)
      .single();

    const branchName = currentBranch?.name || "Sucursal";

    // 1. Obtener pedidos entregados o despachados con precio final
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, created_at, delivery_date, total_price, status")
      .eq("branch_id", targetBranchId)
      .in("status", ["entregado", "despachado"])
      .order("created_at", { ascending: true });

    if (ordersError) {
      console.error("Error fetching orders for account:", ordersError);
    }

    // 2. Obtener pagos registrados
    let payments: any[] = [];
    try {
      const { data: pList, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("branch_id", targetBranchId)
        .order("payment_date", { ascending: true });

      if (!paymentsError && pList) {
        payments = pList;
      }
    } catch (pErr) {
      console.warn("Table payments might not exist yet:", pErr);
    }

    // 3. Unificar movimientos en orden cronológico
    const rawMovements: {
      id: string;
      date: string;
      type: "pedido" | "pago";
      displayId: string;
      description: string;
      debit: number;
      credit: number;
      paymentMethod?: PaymentMethod | null;
      referenceNumber?: string | null;
      status?: string;
      notes?: string | null;
    }[] = [];

    (orders || []).forEach((order) => {
      const orderDate = order.delivery_date || order.created_at;
      const shortId = formatShortId(order, branchName);
      rawMovements.push({
        id: order.id,
        date: orderDate,
        type: "pedido",
        displayId: shortId,
        description: `Pedido ${shortId}`,
        debit: Number(order.total_price || 0),
        credit: 0,
        status: order.status,
      });
    });

    payments.forEach((payment) => {
      const payDate = payment.payment_date || payment.created_at;
      const displayId = payment.reference_number
        ? `REC-${payment.reference_number}`
        : `PAG-${payment.id.substring(0, 4).toUpperCase()}`;

      let methodLabel = "Transferencia";
      if (payment.payment_method === "efectivo") methodLabel = "Efectivo";
      else if (payment.payment_method === "cheque") methodLabel = "Cheque";
      else if (payment.payment_method === "otro") methodLabel = "Otro";

      rawMovements.push({
        id: payment.id,
        date: payDate,
        type: "pago",
        displayId: displayId,
        description: `Pago · ${methodLabel}`,
        debit: 0,
        credit: Number(payment.amount || 0),
        paymentMethod: payment.payment_method,
        referenceNumber: payment.reference_number,
        status: payment.status || "aprobado",
        notes: payment.notes,
      });
    });

    // Ordenar de más antiguo a más reciente para calcular el saldo acumulado
    rawMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    let totalOrdersAmount = 0;
    let totalPaymentsAmount = 0;

    const calculatedMovements: AccountMovement[] = rawMovements.map((mov) => {
      totalOrdersAmount += mov.debit;
      totalPaymentsAmount += mov.credit;
      runningBalance += mov.debit - mov.credit;

      return {
        ...mov,
        balance: runningBalance,
      };
    });

    // Para la vista en tabla, mostramos los movimientos más recientes arriba
    const movementsNewestFirst = [...calculatedMovements].reverse();

    return {
      success: true,
      branch: currentBranch,
      branches: branchesList,
      isAdmin,
      movements: movementsNewestFirst,
      summary: {
        totalOrdersAmount,
        totalPaymentsAmount,
        currentBalance: runningBalance,
      },
    };
  } catch (err: any) {
    console.error("Error in getBranchAccountStatement:", err);
    return { error: err.message || "Error al obtener el estado de cuenta." };
  }
}

export async function getAllBranchesAccountSummary() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { error: "No autorizado." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { error: "Solo los administradores pueden ver el resumen global." };
    }

    const { data: branches } = await supabase
      .from("branches")
      .select("id, name")
      .eq("is_central", false)
      .order("name", { ascending: true });

    if (!branches) return { summaries: [] };

    const summaries: BranchAccountSummary[] = [];

    for (const b of branches) {
      // Sum orders
      const { data: orders } = await supabase
        .from("orders")
        .select("total_price")
        .eq("branch_id", b.id)
        .in("status", ["entregado", "despachado"]);

      const totalOrdersAmount = (orders || []).reduce(
        (sum, o) => sum + Number(o.total_price || 0),
        0
      );

      // Sum payments
      let totalPaymentsAmount = 0;
      let paymentsCount = 0;
      try {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("branch_id", b.id);

        totalPaymentsAmount = (payments || []).reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        );
        paymentsCount = (payments || []).length;
      } catch (e) {
        // Table might not exist yet
      }

      const currentBalance = totalOrdersAmount - totalPaymentsAmount;

      summaries.push({
        branchId: b.id,
        branchName: b.name,
        totalOrdersAmount,
        totalPaymentsAmount,
        currentBalance,
        movementsCount: (orders?.length || 0) + paymentsCount,
      });
    }

    return { summaries };
  } catch (err: any) {
    console.error("Error in getAllBranchesAccountSummary:", err);
    return { error: "Error al obtener el resumen de cuentas corrientes." };
  }
}

export async function registerPayment(data: {
  branchId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { error: "No autorizado." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, branch_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role === "empleado") {
      return { error: "No tenés permiso para informar pagos." };
    }

    // Si es sucursal, verificar que el pago sea para su propia sucursal
    let targetBranchId = data.branchId;
    if (profile.role === "branch") {
      if (!profile.branch_id) {
        return { error: "No tenés una sucursal asignada." };
      }
      targetBranchId = profile.branch_id;
    }

    if (!data.amount || data.amount <= 0) {
      return { error: "El monto del pago debe ser mayor a 0." };
    }

    const { data: insertedPayment, error: insertError } = await supabase
      .from("payments")
      .insert({
        branch_id: targetBranchId,
        amount: data.amount,
        payment_method: data.paymentMethod || "transferencia",
        payment_date: data.paymentDate || new Date().toISOString(),
        reference_number: data.referenceNumber?.trim() || null,
        notes: data.notes?.trim() || null,
        status: "aprobado",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting payment:", insertError);
      return {
        error:
          insertError.message ||
          "No se pudo registrar el pago. Asegurate de que la tabla 'payments' esté creada en la base de datos.",
      };
    }

    revalidatePath("/dashboard/account");
    return { success: true, data: insertedPayment };
  } catch (err: any) {
    console.error("Error in registerPayment:", err);
    return { error: "Error inesperado al registrar el pago." };
  }
}

export async function deletePayment(paymentId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { error: "No autorizado." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { error: "Solo los administradores pueden eliminar pagos." };
    }

    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (deleteError) {
      return { error: "No se pudo eliminar el pago." };
    }

    revalidatePath("/dashboard/account");
    return { success: true };
  } catch (err: any) {
    return { error: "Error inesperado al eliminar el pago." };
  }
}
