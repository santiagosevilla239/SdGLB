import { createClient } from "@/lib/supabase/server";
import { apply, type Command, type Planning } from "@/lib/factory/planning";

const fail = (error: string, status: number) => Response.json({ error }, { status });

async function context() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "admin" ? db : null;
}

export async function GET() {
  const db = await context();
  if (!db) return fail("Solo puede acceder el administrador de fábrica.", 403);
  const [planning, flavors, stock] = await Promise.all([
    db.from("factory_planning").select("state").single(),
    db.from("flavors").select("id,name").eq("is_active", true).order("name"),
    db.rpc("factory_planning_stock"),
  ]);
  if (planning.error || flavors.error || stock.error) return fail("No se pudo cargar Producción. Revisá que esté aplicada la migración de planificación.", 503);
  const available = new Map<number, number>(stock.data.map((item: { flavor_id: number; available: number }) => [item.flavor_id, Number(item.available)]));
  return Response.json({
    state: planning.data.state,
    flavors: flavors.data.map(flavor => ({ ...flavor, available: available.get(flavor.id) ?? 0 })),
  });
}

export async function POST(request: Request) {
  const db = await context();
  if (!db) return fail("Solo puede registrar cambios el administrador de fábrica.", 403);
  const command: Command | null = await request.json().catch(() => null);
  if (!command || typeof command.commandId !== "string" || !/^[a-f0-9-]{36}$/i.test(command.commandId)) {
    return fail("Operación inválida.", 400);
  }
  let flavorIds: number[] = [];
  if (command.type === "minimum") {
    const { data, error } = await db.from("flavors").select("id").eq("id", Number(command.flavorId)).eq("is_active", true).maybeSingle();
    if (error || !data) return fail("Seleccioná un sabor activo.", 400);
    flavorIds = [data.id];
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db.from("factory_planning").select("state,version").single();
    if (error) return fail("No se pudo leer el registro de fábrica.", 503);
    const state: Planning = data.state;
    if (state.commands.includes(command.commandId)) return Response.json({ state });
    try {
      apply(state, command, flavorIds);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Operación inválida.", 400);
    }
    const saved = await db.from("factory_planning").update({ state, version: data.version + 1 })
      .eq("id", true).eq("version", data.version).select("version").maybeSingle();
    if (saved.error) return fail("No se pudo guardar el cambio.", 503);
    if (saved.data) return Response.json({ state });
  }
  return fail("Otro usuario modificó el registro. Volvé a intentar.", 409);
}
