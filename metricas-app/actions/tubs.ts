"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addTub(formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "No autorizado" };
    }

    const flavorId = formData.get("flavorId")?.toString();
    const grossWeight = parseFloat(formData.get("grossWeight")?.toString() || "0");
    const internalCode = formData.get("internalCode")?.toString() || null;

    if (!flavorId || isNaN(grossWeight) || grossWeight <= 0) {
      return { error: "Faltan datos requeridos o el peso es inválido." };
    }

    // Obtener precio por kilo del sabor para calcular el precio total
    const { data: flavor, error: flavorError } = await supabase
      .from("flavors")
      .select("price_per_kilo")
      .eq("id", flavorId)
      .single();

    if (flavorError || !flavor) {
      return { error: "Error al obtener el precio del sabor." };
    }

    // Por ahora usamos grossWeight como netWeight
    const netWeight = grossWeight;
    const totalPrice = netWeight * Number(flavor.price_per_kilo);

    const { error } = await supabase.from("tubs").insert({
      flavor_id: flavorId,
      gross_weight: grossWeight,
      net_weight: netWeight,
      total_price: totalPrice,
      internal_code: internalCode,
      status: "in_stock",
      branch_id: null // Todavía en fábrica
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/orders");
    return { success: true };
  } catch (err: any) {
    return {
      error: err.message || "Ocurrió un error inesperado al guardar la lata.",
    };
  }
}

export async function addBulkTubs(
  tubs: Array<{ flavorId: string; internalCode: string; grossWeight: number }>
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "No autorizado" };
    }

    if (tubs.length === 0) {
      return { error: "La lista de latas está vacía." };
    }

    const flavorIds = [...new Set(tubs.map(t => t.flavorId))];

    // Obtener precio por kilo de todos los sabores incluidos
    const { data: flavorsData, error: flavorError } = await supabase
      .from("flavors")
      .select("id, price_per_kilo")
      .in("id", flavorIds);

    if (flavorError || !flavorsData || flavorsData.length === 0) {
      return { error: "Error al obtener el precio de los sabores." };
    }

    const flavorPrices = flavorsData.reduce((acc, curr) => {
      acc[curr.id.toString()] = Number(curr.price_per_kilo);
      return acc;
    }, {} as Record<string, number>);

    const insertData = tubs.map((tub) => {
      const pricePerKilo = flavorPrices[tub.flavorId.toString()] || 0;
      const netWeight = tub.grossWeight;
      const totalPrice = netWeight * pricePerKilo;
      
      return {
        flavor_id: tub.flavorId,
        gross_weight: tub.grossWeight,
        net_weight: netWeight,
        total_price: totalPrice,
        internal_code: tub.internalCode || null,
        status: "in_stock",
        branch_id: null, // Todavía en fábrica
      };
    });

    const { data: insertedTubs, error } = await supabase
      .from("tubs")
      .insert(insertData)
      .select("id, flavor_id, internal_code, gross_weight, total_price");

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/orders");
    return { success: true, data: insertedTubs };
  } catch (err: any) {
    return {
      error: err.message || "Ocurrió un error inesperado al guardar las latas.",
    };
  }
}

export async function consumeTub(tubId: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("tubs")
      .update({ status: "consumed" })
      .eq("id", tubId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/orders");
    return { success: true };
  } catch (err: any) {
    return {
      error: err.message || "Ocurrió un error inesperado al consumir la lata.",
    };
  }
}

export async function addBranchBulkTubs(
  tubs: Array<{ flavorId: string; internalCode: string; grossWeight: number }>
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "No autorizado" };
    }

    // Obtener el branch_id del usuario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.branch_id) {
      return { error: "Error al obtener la sucursal del usuario." };
    }

    if (tubs.length === 0) {
      return { error: "La lista de latas está vacía." };
    }

    const flavorIds = [...new Set(tubs.map(t => t.flavorId))];

    // Obtener precio por kilo de todos los sabores incluidos
    const { data: flavorsData, error: flavorError } = await supabase
      .from("flavors")
      .select("id, price_per_kilo")
      .in("id", flavorIds);

    if (flavorError || !flavorsData || flavorsData.length === 0) {
      return { error: "Error al obtener el precio de los sabores." };
    }

    const flavorPrices = flavorsData.reduce((acc, curr) => {
      acc[curr.id.toString()] = Number(curr.price_per_kilo);
      return acc;
    }, {} as Record<string, number>);

    const insertData = tubs.map((tub) => {
      const pricePerKilo = flavorPrices[tub.flavorId.toString()] || 0;
      const netWeight = tub.grossWeight;
      const totalPrice = netWeight * pricePerKilo;
      
      return {
        flavor_id: tub.flavorId,
        gross_weight: tub.grossWeight,
        net_weight: netWeight,
        total_price: totalPrice,
        internal_code: tub.internalCode || null,
        status: "in_stock",
        branch_id: profile.branch_id, // Asignado directamente a la sucursal
      };
    });

    const { error } = await supabase.from("tubs").insert(insertData);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (err: any) {
    return {
      error: err.message || "Ocurrió un error inesperado al guardar las latas.",
    };
  }
}
