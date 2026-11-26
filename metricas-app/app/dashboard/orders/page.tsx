import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminOrders from "./components/AdminOrders";
import BranchOrders from "./components/BranchOrders";

export default async function OrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userRole = user.user_metadata?.role || "user";

  if (userRole === "admin") {
    return <AdminOrders />;
  }

  return <BranchOrders role={userRole} />;
}
