"use server";

import { createClient } from "@/lib/supabase/server";
import { format, subDays, startOfMonth, subMonths, startOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";

export async function getBranchMetrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("branch_id").eq("id", user.id).single();
  if (!profile?.branch_id) return null;
  const branchId = profile.branch_id;

  // Consumo diario (últimos 7 días)
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();
  const { data: consumptionData } = await supabase
    .from("consumption_history")
    .select("created_at, tubs_count, total_weight")
    .eq("branch_id", branchId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: true });

  const dailyConsumption = consumptionData?.map(d => ({
    date: format(new Date(d.created_at), "E d", { locale: es }),
    latas: d.tubs_count,
    peso: d.total_weight
  })) || [];

  // Pedidos por mes (últimos 6 meses)
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString();
  const { data: ordersData } = await supabase
    .from("orders")
    .select("created_at, order_items(quantity, approved_quantity)")
    .eq("branch_id", branchId)
    .in("status", ["confirmado", "despachado", "entregado"])
    .gte("created_at", sixMonthsAgo)
    .order("created_at", { ascending: true });

  const monthlyOrdersMap: Record<string, number> = {};
  ordersData?.forEach(order => {
    const month = format(new Date(order.created_at), "MMM yyyy", { locale: es });
    const tubsCount = order.order_items?.reduce((sum: number, item: any) => sum + (item.approved_quantity ?? item.quantity), 0) || 0;
    monthlyOrdersMap[month] = (monthlyOrdersMap[month] || 0) + tubsCount;
  });

  const monthlyOrders = Object.entries(monthlyOrdersMap).map(([month, count]) => ({
    month,
    latas: count
  }));

  // Consumo Semanal (últimas 8 semanas)
  const eightWeeksAgo = startOfWeek(subWeeks(new Date(), 7), { weekStartsOn: 1 }).toISOString();
  const { data: weeklyConsumptionData } = await supabase
    .from("consumption_history")
    .select("created_at, tubs_count, total_weight")
    .eq("branch_id", branchId)
    .gte("created_at", eightWeeksAgo)
    .order("created_at", { ascending: true });

  const weeklyConsumptionMap: Record<string, { latas: number, peso: number }> = {};
  weeklyConsumptionData?.forEach(d => {
    // Agrupar por semana (lunes)
    const weekStart = format(startOfWeek(new Date(d.created_at), { weekStartsOn: 1 }), "d MMM", { locale: es });
    if (!weeklyConsumptionMap[weekStart]) weeklyConsumptionMap[weekStart] = { latas: 0, peso: 0 };
    weeklyConsumptionMap[weekStart].latas += d.tubs_count;
    weeklyConsumptionMap[weekStart].peso += d.total_weight;
  });

  const weeklyConsumption = Object.entries(weeklyConsumptionMap).map(([week, data]) => ({
    week: `Sem ${week}`,
    latas: data.latas,
    peso: Number(data.peso.toFixed(2))
  }));

  // Pedidos Semanales (últimas 8 semanas)
  const { data: weeklyOrdersData } = await supabase
    .from("orders")
    .select("created_at, order_items(quantity, approved_quantity)")
    .eq("branch_id", branchId)
    .in("status", ["confirmado", "despachado", "entregado"])
    .gte("created_at", eightWeeksAgo)
    .order("created_at", { ascending: true });

  const weeklyOrdersMap: Record<string, number> = {};
  weeklyOrdersData?.forEach(order => {
    const weekStart = format(startOfWeek(new Date(order.created_at), { weekStartsOn: 1 }), "d MMM", { locale: es });
    const tubsCount = order.order_items?.reduce((sum: number, item: any) => sum + (item.approved_quantity ?? item.quantity), 0) || 0;
    weeklyOrdersMap[weekStart] = (weeklyOrdersMap[weekStart] || 0) + tubsCount;
  });

  const weeklyOrders = Object.entries(weeklyOrdersMap).map(([week, count]) => ({
    week: `Sem ${week}`,
    latas: count
  }));

  return { dailyConsumption, monthlyOrders, weeklyConsumption, weeklyOrders };
}

export async function getFactoryMetrics() {
  const supabase = await createClient();
  
  // Total latas pesadas en fábrica (últimos 12 meses)
  const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11)).toISOString();
  const { data: tubsData } = await supabase
    .from("tubs")
    .select("created_at, gross_weight")
    .gte("created_at", twelveMonthsAgo)
    .order("created_at", { ascending: true });

  const monthlyWeighedMap: Record<string, { latas: number, peso: number }> = {};
  tubsData?.forEach(tub => {
    const month = format(new Date(tub.created_at), "MMM yyyy", { locale: es });
    if (!monthlyWeighedMap[month]) monthlyWeighedMap[month] = { latas: 0, peso: 0 };
    monthlyWeighedMap[month].latas += 1;
    monthlyWeighedMap[month].peso += Number(tub.gross_weight || 0);
  });

  const monthlyWeighed = Object.entries(monthlyWeighedMap).map(([month, data]) => ({
    month,
    latas: data.latas,
    peso: Number(data.peso.toFixed(2))
  }));

  // Pedidos despachados por mes (últimos 12 meses)
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 11)).toISOString();
  const { data: ordersData } = await supabase
    .from("orders")
    .select("delivery_date, order_items(approved_quantity)")
    .in("status", ["despachado", "entregado"])
    .gte("delivery_date", sixMonthsAgo)
    .order("delivery_date", { ascending: true });

  const monthlyDispatchedMap: Record<string, { pedidos: number, latas: number }> = {};
  ordersData?.forEach(order => {
    const month = format(new Date(order.delivery_date), "MMM yyyy", { locale: es });
    if (!monthlyDispatchedMap[month]) monthlyDispatchedMap[month] = { pedidos: 0, latas: 0 };
    monthlyDispatchedMap[month].pedidos += 1;
    const tubsCount = order.order_items?.reduce((sum: number, item: any) => sum + (item.approved_quantity || 0), 0) || 0;
    monthlyDispatchedMap[month].latas += tubsCount;
  });

  const monthlyDispatched = Object.entries(monthlyDispatchedMap).map(([month, data]) => ({
    month,
    pedidos: data.pedidos,
    latas: data.latas
  }));

  // Agrupaciones Semanales y Diarias
  const weeklyWeighedMap: Record<string, { latas: number, peso: number }> = {};
  const dailyWeighedMap: Record<string, { latas: number, peso: number }> = {};
  const eightWeeksAgoDate = startOfWeek(subWeeks(new Date(), 7), { weekStartsOn: 1 });
  const sevenDaysAgoDate = subDays(new Date(), 7);

  tubsData?.forEach(tub => {
    const tubDate = new Date(tub.created_at);
    
    // Semanal
    if (tubDate >= eightWeeksAgoDate) {
      const weekStart = format(startOfWeek(tubDate, { weekStartsOn: 1 }), "d MMM", { locale: es });
      if (!weeklyWeighedMap[weekStart]) weeklyWeighedMap[weekStart] = { latas: 0, peso: 0 };
      weeklyWeighedMap[weekStart].latas += 1;
      weeklyWeighedMap[weekStart].peso += Number(tub.gross_weight || 0);
    }
    
    // Diario
    if (tubDate >= sevenDaysAgoDate) {
      const day = format(tubDate, "E d", { locale: es });
      if (!dailyWeighedMap[day]) dailyWeighedMap[day] = { latas: 0, peso: 0 };
      dailyWeighedMap[day].latas += 1;
      dailyWeighedMap[day].peso += Number(tub.gross_weight || 0);
    }
  });

  const weeklyWeighed = Object.entries(weeklyWeighedMap).map(([week, data]) => ({
    week: `Sem ${week}`,
    latas: data.latas,
    peso: Number(data.peso.toFixed(2))
  }));
  const dailyWeighed = Object.entries(dailyWeighedMap).map(([date, data]) => ({
    date,
    latas: data.latas,
    peso: Number(data.peso.toFixed(2))
  }));

  const weeklyDispatchedMap: Record<string, { pedidos: number, latas: number }> = {};
  const dailyDispatchedMap: Record<string, { pedidos: number, latas: number }> = {};

  ordersData?.forEach(order => {
    const orderDate = new Date(order.delivery_date);
    const tubsCount = order.order_items?.reduce((sum: number, item: any) => sum + (item.approved_quantity || 0), 0) || 0;
    
    // Semanal
    if (orderDate >= eightWeeksAgoDate) {
      const weekStart = format(startOfWeek(orderDate, { weekStartsOn: 1 }), "d MMM", { locale: es });
      if (!weeklyDispatchedMap[weekStart]) weeklyDispatchedMap[weekStart] = { pedidos: 0, latas: 0 };
      weeklyDispatchedMap[weekStart].pedidos += 1;
      weeklyDispatchedMap[weekStart].latas += tubsCount;
    }
    
    // Diario
    if (orderDate >= sevenDaysAgoDate) {
      const day = format(orderDate, "E d", { locale: es });
      if (!dailyDispatchedMap[day]) dailyDispatchedMap[day] = { pedidos: 0, latas: 0 };
      dailyDispatchedMap[day].pedidos += 1;
      dailyDispatchedMap[day].latas += tubsCount;
    }
  });

  const weeklyDispatched = Object.entries(weeklyDispatchedMap).map(([week, data]) => ({
    week: `Sem ${week}`,
    pedidos: data.pedidos,
    latas: data.latas
  }));
  const dailyDispatched = Object.entries(dailyDispatchedMap).map(([date, data]) => ({
    date,
    pedidos: data.pedidos,
    latas: data.latas
  }));

  return { monthlyWeighed, monthlyDispatched, weeklyWeighed, dailyWeighed, weeklyDispatched, dailyDispatched };
}
