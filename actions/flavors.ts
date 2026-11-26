"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addFlavor(formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "No autorizado" };
    }

    const name = formData.get("name")?.toString();
    const description = formData.get("description")?.toString() || "";

    if (!name) {
      return { error: "Falta el nombre del sabor." };
    }

    // Get the current global price from any active flavor (fallback to 1000 if no flavors exist)
    const { data: existingFlavor } = await supabase
      .from("flavors")
      .select("price_per_kilo")
      .limit(1)
      .single();
      
    const price_per_kilo = existingFlavor?.price_per_kilo || 1000;

    const { error } = await supabase.from("flavors").insert({
      name,
      description,
      price_per_kilo,
      is_active: true,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (err: any) {
    return {
      error: err.message || "Ocurrió un error inesperado al guardar el sabor.",
    };
  }
}

export async function updateGlobalPrice(newPrice: number) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "No autorizado" };
    }

    if (isNaN(newPrice) || newPrice <= 0) {
      return { error: "Precio inválido." };
    }

    // Actualiza todos los sabores de forma masiva
    const { error } = await supabase
      .from("flavors")
      .update({ price_per_kilo: newPrice })
      .gt("id", -1); // Supabase a veces requiere un filtro en los updates

    if (error) {
      return { error: error.message };
    }

    // Actualizar también el total_price de todas las latas existentes en stock
    const { data: tubs, error: tubsFetchError } = await supabase
      .from("tubs")
      .select("id, net_weight")
      .eq("status", "in_stock");

    if (tubsFetchError) {
      return { error: tubsFetchError.message };
    }

    if (tubs && tubs.length > 0) {
      // Procesamos en lotes de 50 para no saturar las conexiones
      const BATCH_SIZE = 50;
      for (let i = 0; i < tubs.length; i += BATCH_SIZE) {
        const batch = tubs.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((tub) =>
            supabase
              .from("tubs")
              .update({ total_price: Number(tub.net_weight) * newPrice })
              .eq("id", tub.id)
          )
        );
      }
    }

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/catalog");
    return { success: true };
  } catch (err: any) {
    return {
      error: err.message || "Ocurrió un error inesperado al actualizar los precios.",
    };
  }
}

export async function getFlavorsWithStock() {
  try {
    const supabase = await createClient();
    
    // Get flavors and their tubs
    const { data: flavors, error } = await supabase
      .from("flavors")
      .select(`
        *,
        tubs (
          id,
          gross_weight,
          status,
          branch_id
        )
      `)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return { error: error.message };
    }

    const processedFlavors = flavors.map((flavor: any) => {
      const inStockTubs = flavor.tubs?.filter((t: any) => t.status === "in_stock" && t.branch_id === null) || [];
      const stockCount = inStockTubs.length;
      
      let avgWeight = 0;
      let totalWeightNum = 0;
      if (stockCount > 0) {
        totalWeightNum = inStockTubs.reduce((acc: number, t: any) => acc + (Number(t.gross_weight) || 0), 0);
        avgWeight = totalWeightNum / stockCount;
      }

      let statusType: 'Disponible' | 'Limitado' | 'Sin stock' = "Disponible";
      if (stockCount === 0) statusType = "Sin stock";
      else if (stockCount < 5) statusType = "Limitado";

      return {
        id: flavor.id,
        name: flavor.name,
        stock: stockCount,
        totalWeight: stockCount > 0 ? totalWeightNum.toFixed(1) + " kg" : "—",
        avgWeight: stockCount > 0 ? avgWeight.toFixed(1) + " kg" : "—",
        statusType
      };
    });

    return { flavors: processedFlavors };
  } catch (err: any) {
    return { error: err.message || "Ocurrió un error al obtener el inventario." };
  }
}

export async function getStockAlerts() {
  const res = await getFlavorsWithStock();
  if (res.error) return res;
  
  if (res.flavors) {
    // Filtrar solo los que tienen estado "Sin stock" o "Limitado"
    const alerts = res.flavors.filter(
      (f: any) => f.statusType === "Sin stock" || f.statusType === "Limitado"
    );
    // Ordenar para que "Sin stock" aparezca primero
    alerts.sort((a: any, b: any) => {
      if (a.statusType === "Sin stock" && b.statusType !== "Sin stock") return -1;
      if (b.statusType === "Sin stock" && a.statusType !== "Sin stock") return 1;
      return 0;
    });
    return { alerts };
  }
  
  return { alerts: [] };
}

export async function getBranchFlavorsWithStock() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No user found" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", user.id)
      .single();

    if (!profile?.branch_id) return { error: "User has no branch assigned" };
    const branchId = profile.branch_id;

    const { data: branchData } = await supabase
      .from("branches")
      .select("is_central")
      .eq("id", branchId)
      .single();
    const isCentral = branchData?.is_central || false;

    // Get flavors and their tubs ONLY for this branch (or factory if central)
    const { data: flavors, error } = await supabase
      .from("flavors")
      .select(`
        *,
        tubs (
          id,
          gross_weight,
          status,
          branch_id,
          internal_code
        )
      `)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return { error: error.message };
    }

    const processedFlavors = flavors.map((flavor: any) => {
      // Filter tubs that belong to this branch, or to factory if branch is central
      const inStockTubs = flavor.tubs?.filter((t: any) => 
        t.status === "in_stock" && (t.branch_id === branchId || (isCentral && t.branch_id === null))
      ) || [];
      const stockCount = inStockTubs.length;
      
      let totalWeightNum = 0;
      if (stockCount > 0) {
        totalWeightNum = inStockTubs.reduce((acc: number, t: any) => acc + (Number(t.gross_weight) || 0), 0);
      }

      let statusType: 'Disponible' | 'Limitado' | 'Sin stock' = "Disponible";
      if (stockCount === 0) statusType = "Sin stock";
      else if (stockCount < 4) statusType = "Limitado";

      return {
        id: flavor.id,
        name: flavor.name,
        stock: stockCount,
        totalWeight: stockCount > 0 ? totalWeightNum.toFixed(1) + " kg" : "—",
        statusType,
        tubs: inStockTubs.map((t: any) => ({
          id: t.id,
          internalCode: t.internal_code || "N/A",
          weight: t.gross_weight
        }))
      };
    });

    return { flavors: processedFlavors };
  } catch (err: any) {
    return { error: err.message || "Ocurrió un error al obtener el inventario." };
  }
}


export async function getCatalogFlavors() {
  try {
    const supabase = await createClient();

    const { data: flavors, error } = await supabase
      .from("flavors")
      .select(`
        id, 
        name, 
        price_per_kilo,
        tubs (
          gross_weight,
          status,
          branch_id
        )
      `)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return { error: error.message };
    }

    const processedFlavors = flavors.map((flavor: any) => {
      // Calculamos el promedio basándonos en el stock real de la fábrica
      const factoryTubs = flavor.tubs?.filter((t: any) => t.status === "in_stock" && t.branch_id === null) || [];
      
      let avgWeight = 4.2; // fallback si no hay stock en fábrica
      if (factoryTubs.length > 0) {
        const totalWeight = factoryTubs.reduce((acc: number, t: any) => acc + (Number(t.gross_weight) || 0), 0);
        avgWeight = totalWeight / factoryTubs.length;
      }

      return {
        id: flavor.id,
        name: flavor.name,
        price_per_kilo: flavor.price_per_kilo,
        avgWeight
      };
    });

    return { flavors: processedFlavors };
  } catch (err: any) {
    return { error: err.message || "Ocurrió un error al cargar el catálogo." };
  }
}
