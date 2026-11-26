import { getCatalogFlavors } from "@/actions/flavors";
import { getSupplies } from "@/actions/supplies";
import CatalogClient from "./components/CatalogClient";
import { createClient } from "@/lib/supabase/server";

export default async function CatalogPage() {
  const [{ flavors }, { data: supplies }] = await Promise.all([
    getCatalogFlavors(),
    getSupplies()
  ]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role || "user";

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
          Pedir a fábrica
        </h1>
        <p className="text-[14px] text-text-secondary">
          Disponibilidad en vivo · agregá los sabores e insumos que necesitás
        </p>
      </div>

      <CatalogClient flavors={flavors || []} supplies={supplies || []} role={role} />
    </div>
  );
}
