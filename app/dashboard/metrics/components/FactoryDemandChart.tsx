"use client";

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demandSeries, type DemandPoint } from '@/lib/factory-demand';

export default function FactoryDemandChart({ points, notice }: { points: DemandPoint[]; notice: string }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [branch, setBranch] = useState('');
  const [flavor, setFlavor] = useState('');
  const branches = [...new Set(points.map(p => p.branch))].sort();
  const flavors = [...new Set(points.map(p => p.flavor))].sort();
  const rows = demandSeries(points, period, branch, flavor).slice(-12);
  return (
    <section className="mb-8 rounded-xl border border-border-subtle bg-bg-canvas p-5">
      <h2 className="text-lg font-semibold">Demanda de fábrica</h2>
      <p className="mt-1 text-sm text-text-secondary">Lo pedido por otras sucursales más los baldes abiertos en Daireaux. Los despachos se muestran por separado, en la fecha en que salieron.</p>
      <div className="my-4 flex flex-wrap gap-4 text-sm">
        <label>Ver por <select className="border rounded px-2 py-1" value={period} onChange={e => setPeriod(e.target.value === 'month' ? 'month' : 'week')}><option value="week">Semana (desde el lunes)</option><option value="month">Mes</option></select></label>
        <label>Sucursal <select className="border rounded px-2 py-1" value={branch} onChange={e => setBranch(e.target.value)}><option value="">Todas</option>{branches.map(b => <option key={b}>{b}</option>)}</select></label>
        <label>Gusto <select className="border rounded px-2 py-1" value={flavor} onChange={e => setFlavor(e.target.value)}><option value="">Todos</option>{flavors.map(f => <option key={f}>{f}</option>)}</select></label>
      </div>
      {notice && <p role="status" className="mb-3 text-sm">{notice}</p>}
      <p className="mb-3 text-sm text-text-secondary">Se muestran hasta 12 períodos con registros. El detalle de aperturas y despachos empieza cuando se activa su registro; antes de eso, una ausencia de datos no significa que no hubo movimientos.</p>
      {rows.length ? <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" tickFormatter={v => v.split('-').slice(1).reverse().join('/') + '/' + v.slice(2,4)} />
            <YAxis allowDecimals={false} unit=" baldes" width={76} />
            <Tooltip />
            <Legend />
            <Bar name="Pedidos de otras sucursales" dataKey="requested" stackId="demand" fill="#27500A" />
            <Bar name="Aperturas en Daireaux" dataKey="opened" stackId="demand" fill="#647B34" />
            <Bar name="Despachos registrados" dataKey="shipped" fill="#486E99" />
          </BarChart>
        </ResponsiveContainer>
      </div> : <p className="py-8 text-center text-sm">No hay registros para esta selección.</p>}
    </section>
  );
}
