"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordRecoveryEmail } from "@/lib/mailer";
import { cookies } from "next/headers";

export async function logIn(email: string, password: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: "Credenciales Invalidas" };
    }

    if (!user) {
      return { error: "No se pudo obtener el usuario después del login." };
    }

    // Obtener el perfil de la base de datos
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Sincronizar el rol y el nombre en la metadata de Supabase Auth
    // Esto hace que los datos viajen en el JWT de la sesión por defecto
    await supabase.auth.updateUser({
      data: {
        role: profile?.role || "user",
        full_name: profile?.full_name || user.email?.split("@")[0],
      }
    });

    return {
      success: true,
      user: { ...user, profile },
    };
  } catch (err: any) {
    return { error: err.message || "Ocurrió un error inesperado." };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    
    // USAMOS getUser() para validar la sesión contra el servidor de Supabase
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    // Extraemos el rol y nombre desde la metadata del usuario
    const profile = {
      id: user.id,
      role: user.user_metadata?.role || "user",
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
    };

    return {
      user: { ...user, profile }
    };
  } catch (error) {
    return null;
  }
}

export async function recoverPassword(email: string) {
  try {
    const adminSupabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectUrl = `${siteUrl}/auth/callback?next=/update-password`;

    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error || !data.properties?.action_link) {
      console.error("Error generating recovery link:", error);
      return { error: "No se pudo generar el enlace de recuperación. Verificá que el correo exista." };
    }

    await sendPasswordRecoveryEmail(email, data.properties.action_link);
    return { success: true };
  } catch (err: any) {
    return { error: "Ocurrió un error inesperado al solicitar la recuperación." };
  }
}
