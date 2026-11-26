import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getBranchAccountStatement,
  getAllBranchesAccountSummary,
} from "@/actions/account";
import { AccountClient } from "./components/AccountClient";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verificar perfil y rol
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || user.user_metadata?.role || "branch";

  // Empleados no tienen acceso a precios ni finanzas
  if (role === "empleado") {
    redirect("/dashboard");
  }

  const statementRes = await getBranchAccountStatement();

  if (statementRes.error || !statementRes.success) {
    return (
      <div className="p-8 text-center text-text-secondary">
        {statementRes.error || "Error al cargar la cuenta corriente."}
      </div>
    );
  }

  let globalSummaries: any[] = [];
  if (role === "admin") {
    const globalRes = await getAllBranchesAccountSummary();
    if (globalRes.summaries) {
      globalSummaries = globalRes.summaries;
    }
  }

  return (
    <AccountClient
      initialStatement={statementRes as any}
      initialGlobalSummaries={globalSummaries}
    />
  );
}
