import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminInventory from "./components/AdminInventory";
import BranchInventory from "./components/BranchInventory";

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userRole = user.user_metadata?.role || "user";

  if (userRole === "admin") {
    return <AdminInventory />;
  }

  return <BranchInventory role={userRole} />;
}
