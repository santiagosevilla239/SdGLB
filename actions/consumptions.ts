"use server";

import { createClient } from "@/lib/supabase/server";

export async function getOpenedTubs() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No user found" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, role, branches(is_central)")
      .eq("id", user.id)
      .single();

    let query = supabase
      .from("tubs")
      .select(`
        id, 
        internal_code, 
        gross_weight, 
        total_price,
        flavors ( name )
      `)
      .eq("status", "opened")
      .order("created_at", { ascending: false });

    // Las latas abiertas se asignan al branch_id al abrirlas. 
    // Filtramos por la sucursal actual del usuario.
    if (!profile?.branch_id) {
      query = query.is("branch_id", null);
    } else {
      query = query.eq("branch_id", profile?.branch_id);
    }

    const { data: tubs, error } = await query;

    if (error) {
      console.error("Error fetching opened tubs:", error);
      return { error: "Error al obtener las latas en uso." };
    }

    return { 
      success: true, 
      tubs: tubs.map((tub: any) => ({
        id: tub.id,
        internalCode: tub.internal_code,
        weight: tub.gross_weight,
        price: tub.total_price,
        flavorName: tub.flavors?.name || "Desconocido"
      }))
    };
  } catch (err) {
    console.error("Error in getOpenedTubs:", err);
    return { error: "Error inesperado." };
  }
}

export async function openTub(internalCode: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autorizado" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, role, branches(is_central)")
      .eq("id", user.id)
      .single();

    // Buscar latas con ese código que estén en stock
    let query = supabase
      .from("tubs")
      .select("id, gross_weight")
      .eq("internal_code", internalCode)
      .eq("status", "in_stock");

    if (profile?.role === "admin" || (profile?.branches as any)?.is_central) {
      query = query.is("branch_id", null);
    } else {
      query = query.eq("branch_id", profile?.branch_id);
    }

    const { data: availableTubs, error: findError } = await query;

    if (findError || !availableTubs || availableTubs.length === 0) {
      return { error: "Lata no encontrada en tu stock, o ya está en uso." };
    }

    // Tomar solo una (la primera)
    const tub = availableTubs[0];

    // Actualizar estado a opened y asignar el branch_id para métricas
    const { error: updateError } = await supabase
      .from("tubs")
      .update({ status: "opened", branch_id: profile?.branch_id })
      .eq("id", tub.id);

    if (updateError) {
      return { error: "No se pudo marcar la lata como en uso." };
    }

    // Registrar en el historial de consumo al ABRIR la lata
    const { error: historyError } = await supabase
      .from("consumption_history")
      .insert({
        branch_id: profile?.branch_id,
        tubs_count: 1,
        total_weight: Number(tub.gross_weight || 0)
      });

    if (historyError) {
      console.error("Error inserting consumption history on open:", historyError);
    }

    return { success: true };
  } catch (err) {
    console.error("Error in openTub:", err);
    return { error: "Error inesperado al intentar abrir la lata." };
  }
}

export async function closeDay(tubIds: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autorizado" };

    if (!tubIds || tubIds.length === 0) return { error: "No hay latas para cerrar." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", user.id)
      .single();

    if (!profile?.branch_id) return { error: "No tienes una sucursal asignada." };

    // Obtener los datos de las latas antes de borrarlas para guardar el historial
    const { data: tubsToClose, error: tubsError } = await supabase
      .from("tubs")
      .select("id, flavor_id, branch_id, gross_weight, net_weight, total_price, internal_code")
      .in("id", tubIds)
      .eq("status", "opened");

    if (tubsError || !tubsToClose || tubsToClose.length === 0) {
      return { error: "No se encontraron las latas o ya fueron borradas." };
    }

    // Insertar el detalle de cada lata en la tabla de archivo consumed_tubs
    const consumedTubsToInsert = tubsToClose.map(tub => ({
      original_tub_id: tub.id,
      flavor_id: tub.flavor_id,
      branch_id: tub.branch_id || profile.branch_id,
      gross_weight: tub.gross_weight,
      net_weight: tub.net_weight,
      total_price: tub.total_price,
      internal_code: tub.internal_code,
    }));

    const { error: insertConsumedError } = await supabase
      .from("consumed_tubs")
      .insert(consumedTubsToInsert);

    if (insertConsumedError) {
      console.error("Error inserting consumed tubs:", insertConsumedError);
      return { error: "Error al guardar el detalle de las latas consumidas." };
    }

    // Borrar físicamente las latas
    const { error } = await supabase
      .from("tubs")
      .delete()
      .in("id", tubIds)
      .eq("status", "opened");

    if (error) {
      console.error("Error deleting consumed tubs:", error);
      return { error: "Error al intentar borrar las latas consumidas." };
    }

    return { success: true };
  } catch (err) {
    console.error("Error in closeDay:", err);
    return { error: "Error inesperado al cerrar el día." };
  }
}
