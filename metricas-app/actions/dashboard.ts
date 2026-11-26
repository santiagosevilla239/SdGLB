"use server";

import { createClient } from "@/lib/supabase/server";

export async function getAdminDashboardKPIs() {
  try {
    const supabase = await createClient();

    // 1. Pending orders
    const { count: pendingOrders, error: pendingOrdersError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendiente");

    if (pendingOrdersError) {
      console.error("Error fetching pending orders:", pendingOrdersError);
    }

    // Obtener fecha/hora actual compensada para Argentina (UTC-3)
    const nowUTC = new Date();
    const nowART = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000);
    const year = nowART.getUTCFullYear();
    const month = nowART.getUTCMonth();
    const date = nowART.getUTCDate();

    // Inicio del día en ART es 00:00:00, que en UTC son las 03:00:00
    const startOfTodayUTC = new Date(Date.UTC(year, month, date, 3, 0, 0, 0));
    const startOfTodayIso = startOfTodayUTC.toISOString();

    const { count: tubsWeighedToday, error: tubsError } = await supabase
      .from("tubs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfTodayIso);

    if (tubsError) {
      console.error("Error fetching tubs weighed today:", tubsError);
    }

    // 3. Dispatches today
    // Fin del día en ART es 23:59:59.999, que en UTC son las 02:59:59.999 del día siguiente (hora 26)
    const endOfTodayUTC = new Date(Date.UTC(year, month, date, 26, 59, 59, 999));
    const endOfTodayIso = endOfTodayUTC.toISOString();

    const { count: dispatchesToday, error: dispatchesError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["despachado", "entregado"])
      .gte("delivery_date", startOfTodayIso)
      .lte("delivery_date", endOfTodayIso);

    if (dispatchesError) {
      console.error("Error fetching dispatches today:", dispatchesError);
    }

    return {
      pendingOrders: pendingOrders || 0,
      tubsWeighedToday: tubsWeighedToday || 0,
      dispatchesToday: dispatchesToday || 0,
    };
  } catch (err) {
    console.error("Unexpected error in getAdminDashboardKPIs:", err);
    return {
      pendingOrders: 0,
      tubsWeighedToday: 0,
      dispatchesToday: 0,
    };
  }
}

export async function getLatestOrders() {
  try {
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        created_at,
        branches ( name ),
        order_items ( quantity, approved_quantity ),
        supply_order_items ( quantity, approved_quantity )
      `)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching latest orders:", error);
      return [];
    }

    return orders.map((order: any) => {
      const tubsCount = order.order_items?.reduce((sum: number, item: any) => 
        sum + (item.approved_quantity !== null && item.approved_quantity !== undefined ? item.approved_quantity : item.quantity || 0), 0
      ) || 0;
      const suppliesCount = order.supply_order_items?.reduce((sum: number, item: any) => 
        sum + (item.approved_quantity !== null && item.approved_quantity !== undefined ? item.approved_quantity : item.quantity || 0), 0
      ) || 0;
      const itemsCount = tubsCount + suppliesCount;
      // Convert id to a short format like PED-1234
      const shortId = `PED-${order.id.substring(0, 4).toUpperCase()}`;
      return {
        id: shortId,
        branchName: order.branches?.name || "Desconocida",
        items: itemsCount,
        status: order.status,
        createdAt: order.created_at,
      };
    });
  } catch (err) {
    console.error("Unexpected error in getLatestOrders:", err);
    return [];
  }
}

export async function getBranchDashboardData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", user.id)
      .single();

    if (!profile?.branch_id) throw new Error("User has no branch assigned");
    const branchId = profile.branch_id;

    const { data: branchData } = await supabase
      .from("branches")
      .select("is_central")
      .eq("id", branchId)
      .single();
    const isCentral = branchData?.is_central || false;

    // 1. Pending orders (esperando confirmación)
    const { count: pendingOrdersCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("status", "pendiente");

    // 2. Orders in transit (en camino / despachado)
    const { data: inTransitOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("branch_id", branchId)
      .eq("status", "despachado")
      .order("created_at", { ascending: false });

    const inTransitCount = inTransitOrders?.length || 0;
    const latestInTransitOrder = inTransitOrders?.[0] || null;

    // 3. Flavors in gondola (tubs that are in_stock for this branch)
    let tubsQuery = supabase.from("tubs").select("flavor_id").eq("status", "in_stock");
    if (isCentral) {
      tubsQuery = tubsQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
    } else {
      tubsQuery = tubsQuery.eq("branch_id", branchId);
    }
    const { data: flavorsInStock } = await tubsQuery;

    const uniqueFlavorsInStock = new Set(flavorsInStock?.map(t => t.flavor_id)).size;

    // 4. Sabores para reponer (Stock Bajo / Limitado / Sin Stock)
    // We mock this slightly: ideally we calculate stock vs threshold
    // Let's get all active flavors and count their stock for this branch
    const { data: allFlavors } = await supabase
      .from("flavors")
      .select("id, name")
      .eq("is_active", true);

    const flavorsWithStock = allFlavors?.map(flavor => {
      const stock = flavorsInStock?.filter(t => t.flavor_id === flavor.id).length || 0;
      let estado = "disponible";
      if (stock === 0) estado = "sin-stock";
      else if (stock < 4) estado = "limitado";
      return { ...flavor, stock, estado };
    }) || [];

    const lowStockFlavors = flavorsWithStock.filter(f => f.estado !== "disponible").slice(0, 5);
    const lowStockCount = flavorsWithStock.filter(f => f.estado !== "disponible").length;

    // 5. Mis ultimos pedidos
    const { data: latestOrders } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        created_at,
        order_items ( quantity, approved_quantity ),
        supply_order_items ( quantity, approved_quantity )
      `)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(4);

    const formattedLatestOrders = latestOrders?.map((order: any) => {
      const tubsCount = order.order_items?.reduce((sum: number, item: any) => 
        sum + (item.approved_quantity !== null && item.approved_quantity !== undefined ? item.approved_quantity : item.quantity || 0), 0
      ) || 0;
      const suppliesCount = order.supply_order_items?.reduce((sum: number, item: any) => 
        sum + (item.approved_quantity !== null && item.approved_quantity !== undefined ? item.approved_quantity : item.quantity || 0), 0
      ) || 0;
      const itemsCount = tubsCount + suppliesCount;
      const shortId = `PED-${order.id.substring(0, 4).toUpperCase()}`;
      return {
        id: shortId,
        items: itemsCount,
        status: order.status,
        createdAt: order.created_at,
      };
    }) || [];

    return {
      kpis: {
        toReplenish: lowStockCount,
        inTransit: inTransitCount,
        pending: pendingOrdersCount || 0,
        inGondola: uniqueFlavorsInStock,
      },
      latestInTransitOrder: latestInTransitOrder ? {
        id: `PED-${latestInTransitOrder.id.substring(0, 4).toUpperCase()}`,
        status: latestInTransitOrder.status,
      } : null,
      lowStockFlavors,
      latestOrders: formattedLatestOrders,
    };
  } catch (err) {
    console.error("Error in getBranchDashboardData:", err);
    return null;
  }
}

