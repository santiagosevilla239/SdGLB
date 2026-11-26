"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderNotification } from "@/lib/mailer";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "admin@losbambinos.com";

async function getBranchEmail(branchId: string): Promise<string | null> {
  try {
    const adminSupabase = createAdminClient();
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("branch_id", branchId);

    if (!profiles || profiles.length === 0) return null;

    const emails: string[] = [];
    for (const profile of profiles) {
      const { data: userData, error } = await adminSupabase.auth.admin.getUserById(profile.id);
      if (!error && userData?.user?.email) {
        emails.push(userData.user.email);
      }
    }

    return emails.length > 0 ? emails.join(", ") : null;
  } catch (err) {
    console.error("Error getting branch email:", err);
    return null;
  }
}

export async function verifyScannedTub(internalCode: string) {
  try {
    const supabase = await createClient();

    // 1. Buscar en el stock de la fábrica (branch_id es null y status in_stock)
    const { data: tubs, error } = await supabase
      .from("tubs")
      .select("id, flavor_id, status, branch_id, gross_weight, internal_code, flavors(name)")
      .eq("internal_code", internalCode)
      .eq("status", "in_stock")
      .is("branch_id", null);

    if (!error && tubs && tubs.length > 0) {
      return {
        success: true,
        inStock: true,
        tubs: tubs.map((tub) => ({
          id: tub.id,
          internalCode: tub.internal_code,
          flavorId: tub.flavor_id,
          flavorName: (tub.flavors as any)?.name || "Desconocido",
          weight: tub.gross_weight,
        })),
      };
    }

    // 2. Si no hay ninguna en stock de fábrica, extraemos los datos del código de barras
    if (internalCode.length === 13 && internalCode.startsWith("2")) {
      const plu = parseInt(internalCode.substring(1, 7), 10);
      const weightGrams = parseInt(internalCode.substring(7, 12), 10);
      const weightKg = !isNaN(weightGrams) ? weightGrams / 1000 : 0;

      if (!isNaN(plu)) {
        const { data: flavor } = await supabase
          .from("flavors")
          .select("id, name, price_per_kilo")
          .eq("id", plu)
          .maybeSingle();

        if (flavor) {
          return {
            success: true,
            inStock: false,
            notFound: true,
            parsedData: {
              code: internalCode,
              flavorId: flavor.id,
              flavorName: flavor.name,
              weight: weightKg,
              pricePerKilo: flavor.price_per_kilo,
            },
          };
        }
      }

      return {
        success: true,
        inStock: false,
        notFound: true,
        parsedData: {
          code: internalCode,
          flavorId: null,
          flavorName: null,
          weight: weightKg || 0,
        },
      };
    }

    // Código con otro formato
    return {
      success: true,
      inStock: false,
      notFound: true,
      parsedData: {
        code: internalCode,
        flavorId: null,
        flavorName: null,
        weight: 0,
      },
    };
  } catch (err: any) {
    return { error: "Error al verificar la lata." };
  }
}

export async function assignScannedTubsToOrder(orderId: string, tubIds: string[], supabase: any) {
  if (tubIds && tubIds.length > 0) {
    const { error: updateTubsError } = await supabase
      .from("tubs")
      .update({ order_id: orderId })
      .in("id", tubIds);

    if (updateTubsError) throw new Error("Error al asignar latas al pedido.");
  }

  let finalPrice = 0;

  // 1. Calculate price from assigned tubs
  const { data: assignedTubs, error: tubsError } = await supabase
    .from("tubs")
    .select("total_price")
    .eq("order_id", orderId);

  if (!tubsError && assignedTubs) {
    for (const tub of assignedTubs) {
      finalPrice += Number(tub.total_price || 0);
    }
  }

  // 2. Calculate price from supplies
  const { data: supplyItems } = await supabase
    .from("supply_order_items")
    .select("quantity, approved_quantity, supplies ( price_per_unit )")
    .eq("order_id", orderId);

  if (supplyItems) {
    for (const sItem of supplyItems) {
      const qty = (sItem.approved_quantity !== null && sItem.approved_quantity !== undefined) ? sItem.approved_quantity : sItem.quantity;
      const price = sItem.supplies?.price_per_unit || 0;
      finalPrice += qty * price;
    }
  }

  // 3. Update order total_price
  const { error: updateOrderError } = await supabase
    .from("orders")
    .update({ total_price: finalPrice })
    .eq("id", orderId);

  if (updateOrderError) throw new Error("Error al actualizar el precio final del pedido.");

  return { success: true };
}

async function recalculateEstimatedPrice(orderId: string, supabase: any, useApproved: boolean = false) {
  let total = 0;

  // Tubs
  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, approved_quantity, flavors ( price_per_kilo, tubs ( status, branch_id, gross_weight ) )")
    .eq("order_id", orderId);

  if (items) {
    for (const item of items) {
      const qty = useApproved ? (item.approved_quantity || 0) : item.quantity;
      if (qty === 0) continue;

      const pricePerKilo = item.flavors?.price_per_kilo || 0;
      const factoryTubs = item.flavors?.tubs?.filter((t: any) => t.status === "in_stock" && t.branch_id === null) || [];
      
      let avgWeight = 4.2;
      if (factoryTubs.length > 0) {
        const totalWeight = factoryTubs.reduce((acc: number, t: any) => acc + (Number(t.gross_weight) || 0), 0);
        avgWeight = totalWeight / factoryTubs.length;
      }

      total += qty * avgWeight * pricePerKilo;
    }
  }

  // Supplies
  const { data: supplyItems } = await supabase
    .from("supply_order_items")
    .select("quantity, approved_quantity, supplies ( price_per_unit )")
    .eq("order_id", orderId);

  if (supplyItems) {
    for (const sItem of supplyItems) {
      const qty = useApproved ? (sItem.approved_quantity || 0) : sItem.quantity;
      const price = sItem.supplies?.price_per_unit || 0;
      total += qty * price;
    }
  }

  return total;
}

export async function getAllOrders() {
  try {
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        created_at,
        status,
        estimated_price,
        total_price,
        admin_notes,
        branch_notes,
        branches ( name ),
        order_items ( id, flavor_id, quantity, approved_quantity, flavors ( name, tubs ( status, branch_id, internal_code, gross_weight ) ) ),
        supply_order_items ( id, supply_id, quantity, approved_quantity, supplies ( name, price_per_unit ) ),
        tubs ( id, flavor_id, internal_code, net_weight, total_price, flavors ( name ) )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching all orders:", error);
      return [];
    }

    return orders.map((order: any) => {
      const tubsCount =
        order.order_items?.reduce(
          (sum: number, item: any) =>
            sum +
            (item.approved_quantity !== null &&
            item.approved_quantity !== undefined
              ? item.approved_quantity
              : item.quantity || 0),
          0,
        ) || 0;
      const suppliesCount = 
        order.supply_order_items?.reduce(
          (sum: number, item: any) =>
            sum +
            (item.approved_quantity !== null &&
            item.approved_quantity !== undefined
              ? item.approved_quantity
              : item.quantity || 0),
          0,
        ) || 0;
      const itemsCount = tubsCount + suppliesCount;
      const branchStr = (order.branches?.name || "Desconocida").toUpperCase().replace("SUCURSAL", "").trim().replace(/\s+/g, '');
      const datePart = order.created_at ? format(new Date(order.created_at), "ddMMyy") : "000000";
      const shortId = `PED-${datePart}${branchStr}`;

      const items =
        order.order_items?.map((item: any) => {
          const factoryTubs =
            item.flavors?.tubs?.filter(
              (t: any) => t.status === "in_stock" && t.branch_id === null,
            ) || [];
          const factoryStock = factoryTubs.length;
          return {
            id: item.id,
            flavorId: item.flavor_id,
            name: item.flavors?.name || "Desconocido",
            quantity: item.quantity,
            approvedQuantity: item.approved_quantity,
            factoryStock,
            availableTubs: factoryTubs.map((t: any) => ({
              internalCode: t.internal_code || "N/A",
              weight: t.gross_weight
            })),
            assignedTubs: (order.tubs || [])
              .filter((t: any) => String(t.flavor_id) === String(item.flavor_id))
              .map((t: any) => ({
                internalCode: t.internal_code || "N/A",
                weight: t.net_weight,
                price: t.total_price,
              })),
          };
        }) || [];

      // Incluir latas asignadas de sabores adicionales que no estaban en el pedido
      const extraTubs = (order.tubs || []).filter(
        (t: any) =>
          !items.some(
            (item: any) => String(item.flavorId) === String(t.flavor_id),
          ),
      );

      if (extraTubs.length > 0) {
        const extraByFlavor: Record<string, any[]> = {};
        for (const t of extraTubs) {
          const fId = String(t.flavor_id);
          if (!extraByFlavor[fId]) extraByFlavor[fId] = [];
          extraByFlavor[fId].push(t);
        }
        for (const [fId, tList] of Object.entries(extraByFlavor)) {
          const flavorName = (tList[0]?.flavors as any)?.name || "Sabor Adicional";
          items.push({
            id: `extra-${fId}`,
            flavorId: fId,
            name: `${flavorName} (Adicional)`,
            quantity: 0,
            approvedQuantity: 0,
            factoryStock: 0,
            availableTubs: [],
            assignedTubs: tList.map((t: any) => ({
              internalCode: t.internal_code || "N/A",
              weight: t.net_weight,
              price: t.total_price,
            })),
          });
        }
      }

      const orderObj: any = {
        id: shortId,
        originalId: order.id,
        branchName: order.branches?.name || "Desconocida",
        items: itemsCount,
        status: order.status,
        createdAt: order.created_at,
        estimatedPrice: order.estimated_price,
        totalPrice: order.total_price,
        adminNotes: order.admin_notes,
        branchNotes: order.branch_notes,
        details: items,
        supplies:
          order.supply_order_items?.map((item: any) => ({
            id: item.id,
            supplyId: item.supply_id,
            name: item.supplies?.name || "Desconocido",
            pricePerUnit: item.supplies?.price_per_unit || 0,
            quantity: item.quantity,
            approvedQuantity: item.approved_quantity,
          })) || [],
      };

      const canConfirm = orderObj.details.every(
        (item: any) => (item.factoryStock || 0) >= item.quantity,
      );
      orderObj.canConfirm = canConfirm;

      return orderObj;
    });
  } catch (err) {
    console.error("Unexpected error in getAllOrders:", err);
    return [];
  }
}

export async function createOrder(
  items: { id: string; quantity: number }[],
  supplies?: { id: string; quantity: number }[],
  estimatedPrice?: number,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "No user found" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", user.id)
      .single();

    if (!profile?.branch_id) return { error: "User has no branch assigned" };
    const branchId = profile.branch_id;

    if ((!items || items.length === 0) && (!supplies || supplies.length === 0)) return { error: "El pedido está vacío" };

    // Create the order bypassing RLS
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        branch_id: branchId,
        status: "pendiente",
        total_price: 0,
        estimated_price: estimatedPrice || 0,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Error creating order:", orderError);
      return { error: "No se pudo crear el pedido" };
    }

    // Prepare order items
    if (items && items.length > 0) {
      const orderItemsData = items.map((item) => ({
        order_id: order.id,
        flavor_id: item.id,
        quantity: item.quantity,
      }));

      // Insert order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsData);

      if (itemsError) {
        console.error("Error inserting order items:", itemsError);
        return { error: "No se pudieron guardar los ítems del pedido" };
      }
    }

    if (supplies && supplies.length > 0) {
      const supplyItemsData = supplies.map(sup => ({
        order_id: order.id,
        supply_id: sup.id,
        quantity: sup.quantity
      }));
      const { error: supError } = await supabase.from("supply_order_items").insert(supplyItemsData);
      if (supError) {
        console.error("Error inserting supply items:", supError);
        return { error: "No se pudieron guardar los insumos del pedido" };
      }
    }

    await sendOrderNotification(ADMIN_EMAIL, order.id, "created", undefined, { estimatedPrice: estimatedPrice || 0 });

    return { success: true, orderId: order.id };
  } catch (err: any) {
    console.error("Error in createOrder:", err);
    return { error: err.message || "Error al crear el pedido" };
  }
}

export async function getBranchOrders() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", user.id)
      .single();

    if (!profile?.branch_id) return [];
    const branchId = profile.branch_id;

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        status,
        created_at,
        estimated_price,
        total_price,
        admin_notes,
        branch_notes,
        branches ( name ),
        order_items ( id, flavor_id, quantity, approved_quantity, flavors ( name ) ),
        supply_order_items ( id, supply_id, quantity, approved_quantity, supplies ( name, price_per_unit ) ),
        tubs ( id, flavor_id, internal_code, net_weight, total_price, flavors ( name ) )
      `,
      )
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching branch orders:", error);
      return [];
    }

    return orders.map((order: any) => {
      const tubsCount =
        order.order_items?.reduce(
          (sum: number, item: any) =>
            sum +
            (item.approved_quantity !== null &&
            item.approved_quantity !== undefined
              ? item.approved_quantity
              : item.quantity || 0),
          0,
        ) || 0;
      const suppliesCount = 
        order.supply_order_items?.reduce(
          (sum: number, item: any) =>
            sum +
            (item.approved_quantity !== null &&
            item.approved_quantity !== undefined
              ? item.approved_quantity
              : item.quantity || 0),
          0,
        ) || 0;
      const itemsCount = tubsCount + suppliesCount;
      const branchStr = (order.branches?.name || "Desconocida").toUpperCase().replace("SUCURSAL", "").trim().replace(/\s+/g, '');
      const datePart = order.created_at ? format(new Date(order.created_at), "ddMMyy") : "000000";
      const shortId = `PED-${datePart}${branchStr}`;

      const details =
        order.order_items?.map((item: any) => ({
          id: item.id,
          flavorId: item.flavor_id,
          name: item.flavors?.name || "Desconocido",
          quantity: item.quantity,
          approvedQuantity: item.approved_quantity,
          assignedTubs: (order.tubs || [])
            .filter((t: any) => String(t.flavor_id) === String(item.flavor_id))
            .map((t: any) => ({
              internalCode: t.internal_code || "N/A",
              weight: t.net_weight,
              price: t.total_price,
            })),
        })) || [];

      // Incluir latas de sabores adicionales
      const extraTubs = (order.tubs || []).filter(
        (t: any) =>
          !details.some(
            (item: any) => String(item.flavorId) === String(t.flavor_id),
          ),
      );

      if (extraTubs.length > 0) {
        const extraByFlavor: Record<string, any[]> = {};
        for (const t of extraTubs) {
          const fId = String(t.flavor_id);
          if (!extraByFlavor[fId]) extraByFlavor[fId] = [];
          extraByFlavor[fId].push(t);
        }
        for (const [fId, tList] of Object.entries(extraByFlavor)) {
          const flavorName = (tList[0]?.flavors as any)?.name || "Sabor Adicional";
          details.push({
            id: `extra-${fId}`,
            flavorId: fId,
            name: `${flavorName} (Adicional)`,
            quantity: 0,
            approvedQuantity: 0,
            assignedTubs: tList.map((t: any) => ({
              internalCode: t.internal_code || "N/A",
              weight: t.net_weight,
              price: t.total_price,
            })),
          });
        }
      }

      return {
        originalId: order.id,
        id: shortId,
        items: itemsCount,
        status: order.status,
        createdAt: order.created_at,
        estimatedPrice: order.estimated_price,
        totalPrice: order.total_price,
        adminNotes: order.admin_notes,
        branchNotes: order.branch_notes,
        details,
        supplies:
          order.supply_order_items?.map((item: any) => ({
            id: item.id,
            supplyId: item.supply_id,
            name: item.supplies?.name || "Desconocido",
            pricePerUnit: item.supplies?.price_per_unit || 0,
            quantity: item.quantity,
            approvedQuantity: item.approved_quantity,
          })) || [],
      };
    });
  } catch (err) {
    console.error("Unexpected error in getBranchOrders:", err);
    return [];
  }
}

export async function cancelOrder(orderId: string) {
  try {
    const supabase = await createClient();
    // Assuming only branch users do this and only for 'pendiente' orders.
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelado" })
      .eq("id", orderId)
      .eq("status", "pendiente");

    if (error)
      return {
        error: "No se pudo cancelar el pedido. Quizás ya fue procesado.",
      };

    const { data: orderData } = await supabase.from("orders").select("estimated_price").eq("id", orderId).single();
    await sendOrderNotification(ADMIN_EMAIL, orderId, "cancelled", undefined, { estimatedPrice: orderData?.estimated_price });

    return { success: true };
  } catch (err: any) {
    return { error: "Error inesperado al cancelar el pedido." };
  }
}

export async function dispatchAndCompleteOrder(orderId: string, scannedTubIds: string[]) {
  try {
    const supabase = await createClient();

    // Verify order
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select(`branch_id`)
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return { error: "Pedido no encontrado." };
    }

    // 1. Assign tubs to order and calculate final price
    try {
      await assignScannedTubsToOrder(orderId, scannedTubIds, supabase);
    } catch (assignError: any) {
      return {
        error: assignError.message || "Error al asignar latas al pedido.",
      };
    }

    // 2. Update order to entregado directly
    const { error: orderError } = await supabase
      .from("orders")
      .update({ 
        status: "entregado",
        delivery_date: new Date().toISOString()
      })
      .eq("id", orderId)
      .in("status", ["pendiente", "confirmado", "contraoferta"]);

    if (orderError) {
      console.error("Error dispatched order:", orderError);
      // Revert tubs if failed
      await supabase.from("tubs").update({ order_id: null }).in("id", scannedTubIds);
      return { error: "No se pudo despachar el pedido." };
    }

    // 3. Update tubs to in_stock in branch
    const { error: tubsError } = await supabase
      .from("tubs")
      .update({ status: "in_stock", branch_id: order.branch_id })
      .eq("order_id", orderId);

    if (tubsError) return { error: "Error al actualizar estado de las latas." };

    // 4. Process supply order items to update branch inventory
    const { data: supplyItems } = await supabase
      .from("supply_order_items")
      .select("supply_id, quantity, approved_quantity")
      .eq("order_id", orderId);
    
    if (supplyItems && supplyItems.length > 0) {
      for (const item of supplyItems) {
        const qtyToAdd = item.approved_quantity !== null ? item.approved_quantity : item.quantity;
        if (qtyToAdd <= 0) continue;

        const { data: existingInv } = await supabase
          .from("supply_inventory")
          .select("id, stock")
          .eq("supply_id", item.supply_id)
          .eq("branch_id", order.branch_id)
          .single();

        if (existingInv) {
          await supabase
            .from("supply_inventory")
            .update({ stock: (existingInv.stock || 0) + qtyToAdd })
            .eq("id", existingInv.id);
        } else {
          await supabase
            .from("supply_inventory")
            .insert({ supply_id: item.supply_id, branch_id: order.branch_id, stock: qtyToAdd });
        }
      }
    }

    // 5. Notify branch
    const branchEmail = await getBranchEmail(order.branch_id);
    if (branchEmail) {
      const { data: orderData } = await supabase.from("orders").select("total_price").eq("id", orderId).single();
      await sendOrderNotification(branchEmail, orderId, "dispatched", undefined, { totalPrice: orderData?.total_price });
    }

    return { success: true };
  } catch (err: any) {
    return { error: "Error inesperado al despachar el pedido." };
  }
}

