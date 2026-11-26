"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSupplies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplies")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Error fetching supplies:", error);
    return { error: "No se pudieron obtener los insumos" };
  }

  return { success: true, data };
}

export async function createSupply(data: {
  name: string;
  price_per_unit: number;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return { error: "No autorizado" };

  const { error } = await supabase.from("supplies").insert([{
    name: data.name,
    price_per_unit: data.price_per_unit,
  }]);

  if (error) {
    console.error("Error creating supply:", error);
    return { error: "No se pudo crear el insumo" };
  }

  return { success: true };
}

export async function updateSupply(supplyId: string, data: {
  name: string;
  price_per_unit: number;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return { error: "No autorizado" };

  const { error } = await supabase
    .from("supplies")
    .update({
      name: data.name,
      price_per_unit: data.price_per_unit,
    })
    .eq("id", supplyId);

  if (error) {
    console.error("Error updating supply:", error);
    return { error: "No se pudo actualizar el insumo" };
  }

  return { success: true };
}

export async function deleteSupply(supplyId: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return { error: "No autorizado" };

  const { error } = await supabase
    .from("supplies")
    .update({ is_active: false })
    .eq("id", supplyId);

  if (error) {
    console.error("Error deleting supply:", error);
    return { error: "No se pudo eliminar el insumo. Es posible que esté asociado a un pedido." };
  }

  return { success: true };
}

export async function getBranchSupplies() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  // Ya no traemos stock, simplemente devolvemos la lista de insumos
  const { data: supplies, error: suppliesError } = await supabase
    .from("supplies")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (suppliesError) {
    console.error("Error fetching supplies:", suppliesError);
    return { error: "No se pudieron obtener los insumos" };
  }

  return { success: true, data: supplies };
}

