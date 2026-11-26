import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // USAMOS getUser() para validar la sesión auténticamente en el servidor
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const userData = {
    id: user.id,
    email: user.email,
    profile: {
      role: user.user_metadata?.role || "user",
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
    },
  };

  return (
    <div className="min-h-screen bg-bg-surface font-sans">
      <div className="flex flex-col">
        {/* Topbar Persistente */}
        <Topbar user={userData} />

        <div className="flex">
          {/* Sidebar Persistente */}
          <Sidebar role={userData.profile.role} />

          {/* Área de Contenido Variable */}
          <main className="flex-1 min-h-[calc(100vh-56px)]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
