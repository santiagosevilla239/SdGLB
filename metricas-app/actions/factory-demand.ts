"use server";

import { createClient } from '@/lib/supabase/server';
import { argentinaDay, type DemandPoint } from '@/lib/factory-demand';

type Order = { id: string; branch_id: string; created_at: string; order_items: { flavor_id: string; quantity: number }[] };
type Event = { id: number; kind: 'opening' | 'dispatch'; happened_at: string; branch_id: string; flavor_id: string };

export async function getFactoryDemand() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - 11, 1);
  const since = from.toISOString().slice(0, 10) + 'T03:00:00Z';
  const [branches, flavors] = await Promise.all([
    db.from('branches').select('id,name,is_central'),
    db.from('flavors').select('id,name'),
  ]);
  if (branches.error || flavors.error) return { points: [], notice: 'No se pudieron cargar las sucursales o los gustos.' };
  const names = new Map(branches.data.map(b => [String(b.id), String(b.name)]));
  const tastes = new Map(flavors.data.map(f => [String(f.id), String(f.name)]));
  const namedDaireaux = branches.data.filter(b => /daireaux/i.test(b.name));
  const daireaux = new Set((namedDaireaux.length ? namedDaireaux : branches.data.filter(b => b.is_central)).map(b => String(b.id)));
  const sums = new Map<string, DemandPoint>();
  function add(day: string, branchId: string, flavorId: string, series: DemandPoint['series'], count: number) {
    const key = JSON.stringify([day, branchId, flavorId, series]);
    const point = sums.get(key) ?? { day, branch: names.get(branchId) ?? branchId, flavor: tastes.get(flavorId) ?? flavorId, series, count: 0 };
    point.count += count;
    sums.set(key, point);
  }
  const batch = 250;
  async function loadOrders() {
    for (let offset = 0; ; offset += batch) {
      const { data, error } = await db.from('orders').select('id,branch_id,created_at,order_items(flavor_id,quantity)')
        .neq('status', 'cancelado').gte('created_at', since).order('created_at').order('id').range(offset, offset + batch - 1);
      if (error) return 'No se pudieron cargar todos los pedidos.';
      for (const order of (data ?? []) as Order[]) {
        if (daireaux.has(String(order.branch_id))) continue;
        for (const item of order.order_items ?? []) add(argentinaDay(order.created_at), String(order.branch_id), String(item.flavor_id), 'requested', Number(item.quantity));
      }
      if (!data || data.length < batch) return '';
    }
  }
  async function loadEvents() {
    for (let offset = 0; ; offset += batch) {
      const { data, error } = await db.from('factory_metric_events').select('id,kind,happened_at,branch_id,flavor_id')
        .gte('happened_at', since).order('happened_at').order('id').range(offset, offset + batch - 1);
      if (error) return 'No está disponible el registro nuevo de aperturas y despachos.';
      for (const event of (data ?? []) as Event[]) {
        const isDaireaux = daireaux.has(event.branch_id);
        if ((event.kind === 'opening') !== isDaireaux) continue;
        add(argentinaDay(event.happened_at), event.branch_id, event.flavor_id, event.kind === 'opening' ? 'opened' : 'shipped', 1);
      }
      if (!data || data.length < batch) return '';
    }
  }
  const notices: string[] = await Promise.all([loadOrders(), loadEvents()]);
  if (!daireaux.size) notices.push('No se identificó la sucursal de Daireaux.');
  return { points: [...sums.values()], notice: notices.filter(Boolean).join(' ') };
}
