import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getBranchMetrics, getFactoryMetrics } from "@/actions/metrics";
import { getFactoryDemand } from "@/actions/factory-demand";
import MetricsClient from "./components/MetricsClient";

export default async function MetricsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = user.user_metadata?.role || "user";
  if (role === "empleado") {
    redirect("/dashboard");
  }
  
  const [data, demand] = role === "admin"
    ? await Promise.all([getFactoryMetrics(), getFactoryDemand()])
    : [await getBranchMetrics(), null];

  if (!data) return <div className="p-8 text-center text-text-secondary">Error cargando métricas.</div>;

  return <MetricsClient role={role} data={data} demand={demand} />;
}
