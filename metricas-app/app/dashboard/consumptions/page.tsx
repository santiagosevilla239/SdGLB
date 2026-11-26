import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ConsumptionsClient from "./components/ConsumptionsClient";
import { getOpenedTubs } from "@/actions/consumptions";

export default async function ConsumptionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branches(name)")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "branch";
  
  // La fábrica central (Admin) no debe tener módulo de consumo diario.
  // Solo las sucursales (incluyendo las sucursales marcadas como is_central) lo usan.
  if (role === "admin") {
    redirect("/dashboard");
  }

  const branchName = (profile?.branches as any)?.name || "Sucursal Desconocida";

  const openedTubsRes = await getOpenedTubs();
  const initialTubs = openedTubsRes.success && openedTubsRes.tubs ? openedTubsRes.tubs : [];

  return (
    <ConsumptionsClient 
      initialTubs={initialTubs} 
      branchName={branchName}
      role={role}
    />
  );
}
