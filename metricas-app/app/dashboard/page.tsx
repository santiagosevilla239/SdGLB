import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboard from "./components/AdminDashboard";

import { getBranchDashboardData } from "@/actions/dashboard";
import BranchDashboard from "./components/BranchDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  // USAMOS getUser() para validar la sesión de forma segura
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userData = {
    id: user.id,
    email: user.email,
    profile: {
      role: user.user_metadata?.role || "user",
      full_name:
        user.user_metadata?.full_name ||
        user.email?.split("@")[0],
    },
  };

  const userRole = userData.profile.role;

  // Si es admin, mostramos el dashboard del wireframe
  if (userRole == "admin") {
    return <AdminDashboard user={userData} />;
  }

  // Dashboard por defecto para sucursales
  const branchData = await getBranchDashboardData();

  if (!branchData) {
    return <div className="p-8 text-center text-text-secondary">Error cargando el dashboard.</div>;
  }

  return <BranchDashboard user={userData} data={branchData} />;
}
