import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UpdatePasswordClient from "./UpdatePasswordClient";

export const metadata = {
  title: "Restablecer Contraseña | Los Bambinos",
};

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user is logged in, redirect to login
  if (!user) {
    redirect("/login");
  }

  return <UpdatePasswordClient email={user.email} />;
}
