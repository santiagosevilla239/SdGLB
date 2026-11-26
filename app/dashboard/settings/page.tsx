import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./components/SettingsClient";
import { getBranches } from "@/actions/user";

export const metadata = {
  title: "Configuración | Los Bambinos",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = user.user_metadata?.role || "user";
  let initialBranches: any[] = [];

  if (role === "admin") {
    initialBranches = await getBranches();
  }

  return <SettingsClient role={role} initialBranches={initialBranches} userEmail={user.email} />;
}
