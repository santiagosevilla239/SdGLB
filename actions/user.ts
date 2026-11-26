"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeNotification } from "@/lib/mailer";
import { revalidatePath } from "next/cache";

export async function changeUserPassword(newPassword: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("Error cambiando contraseña:", error);
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: "Ocurrió un error inesperado al cambiar la contraseña." };
  }
}

export async function getBranches() {
  try {
    const supabase = await createClient();
    // We fetch branches and maybe the user email from profiles? 
    // We can just fetch branches.
    const { data: branches, error } = await supabase
      .from("branches")
      .select(`
        id,
        name,
        address,
        is_central,
        created_at,
        profiles ( full_name )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching branches:", error);
      return [];
    }

    return branches;
  } catch (err) {
    console.error("Error in getBranches:", err);
    return [];
  }
}

export async function createBranchWithUser(
  name: string,
  address: string,
  email: string,
  passwordTemp: string,
  isCentral: boolean = false
) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Create User in Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email,
      password: passwordTemp,
      email_confirm: true,
      user_metadata: {
        role: "branch",
        full_name: name,
      }
    });

    if (authError || !authData.user) {
      console.error("Error creating user:", authError);
      return { error: authError?.message || "No se pudo crear el usuario." };
    }

    const userId = authData.user.id;

    // 2. Create Branch in Public Schema
    const { data: branchData, error: branchError } = await adminSupabase
      .from("branches")
      .insert({
        name,
        address,
        is_central: isCentral
      })
      .select("id")
      .single();

    if (branchError || !branchData) {
      console.error("Error creating branch:", branchError);
      // Rollback user creation
      await adminSupabase.auth.admin.deleteUser(userId);
      return { error: "No se pudo crear la sucursal en la base de datos." };
    }

    const branchId = branchData.id;

    // 3. Upsert Profile
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert({
        id: userId,
        full_name: name,
        branch_id: branchId,
        role: "branch",
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Clean up manually created branch and user to prevent orphans
      await adminSupabase.from("branches").delete().eq("id", branchId);
      await adminSupabase.auth.admin.deleteUser(userId);
      return { error: "No se pudo vincular el perfil del usuario." };
    }

    // 4. Send Welcome Email
    await sendWelcomeNotification(email, passwordTemp, name);

    revalidatePath("/dashboard/settings");

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in createBranchWithUser:", err);
    return { error: "Ocurrió un error inesperado al crear la sucursal." };
  }
}

export async function createEmpleado(
  name: string,
  email: string,
  passwordTemp: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autorizado." };

    const { data: profile } = await supabase.from("profiles").select("branch_id").eq("id", user.id).single();
    if (!profile?.branch_id) return { error: "No se encontró la sucursal asignada." };

    const adminSupabase = createAdminClient();

    // 1. Create User in Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email,
      password: passwordTemp,
      email_confirm: true,
      user_metadata: {
        role: "empleado",
        full_name: name,
      }
    });

    if (authError || !authData.user) {
      console.error("Error creating empleado:", authError);
      return { error: authError?.message || "No se pudo crear el empleado." };
    }

    const userId = authData.user.id;

    // 2. Upsert Profile
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert({
        id: userId,
        full_name: name,
        branch_id: profile.branch_id,
        role: "empleado",
      });

    if (profileError) {
      console.error("Error creating empleado profile:", profileError);
      await adminSupabase.auth.admin.deleteUser(userId);
      return { error: "No se pudo vincular el perfil del empleado." };
    }

    revalidatePath("/dashboard/settings");

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in createEmpleado:", err);
    return { error: "Ocurrió un error inesperado al crear el empleado." };
  }
}
