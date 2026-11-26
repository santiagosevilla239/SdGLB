"use client";
import { useState } from "react";
import FactoryDemandChart from "./FactoryDemandChart";
import type { DemandPoint } from "@/lib/factory-demand";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { format } from "date-fns";
import { createUnifiedSheet, downloadExcelWorkbook } from "@/lib/excel";

interface MetricsClientProps {
  role: string;
  data: any;
  demand?: { points: DemandPoint[]; notice: string } | null;
}

export default function MetricsClient({ role, data, demand }: MetricsClientProps) {
  const isAdmin = role === "admin";
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">(isAdmin ? "monthly" : "weekly");

  const handleExportExcel = async () => {
    const buildSection = async (title: string, dataKeyField: string, weighedData: any[], dispatchedData: any[], sheetName: string) => {
      const map = new Map();
      weighedData?.forEach((d: any) => {
        map.set(d[dataKeyField], { pesadas: d.latas, kilos: d.peso, pedDesp: 0, latDesp: 0 });
      });
      dispatchedData?.forEach((d: any) => {
        if (!map.has(d[dataKeyField])) {
          map.set(d[dataKeyField], { pesadas: 0, kilos: 0, pedDesp: d.pedidos, latDesp: d.latas });
        } else {
          const item = map.get(d[dataKeyField]);
          item.pedDesp = d.pedidos;
          item.latDesp = d.latas;
        }
      });

      let sumPesadas = 0;
      let sumKilos = 0;
      let sumPedDesp = 0;
      let sumLatDesp = 0;

      const rows: any[] = [];
      Array.from(map.entries()).forEach(([period, vals]) => {
        const p = Number(vals.pesadas || 0);
        const k = Number(vals.kilos || 0);
        const pd = Number(vals.pedDesp || 0);
        const ld = Number(vals.latDesp || 0);
        sumPesadas += p;
        sumKilos += k;
        sumPedDesp += pd;
        sumLatDesp += ld;
        rows.push([period, p, k, pd, ld]);
      });

      const worksheet = await createUnifiedSheet({
        title: `HELADERÍA LOS BAMBINOS - REPORTE DE MÉTRICAS (${sheetName.toUpperCase()})`,
        metadata: [
          `Fecha de emisión: ${format(new Date(), "dd/MM/yyyy HH:mm")}   |   Producción y Despachos en Fábrica`,
          `Total Latas Pesadas: ${sumPesadas}   |   Total Kilos: ${sumKilos.toFixed(2)} Kg   |   Pedidos Despachados: ${sumPedDesp}`,
        ],
        headers: ["Periodo", "Latas Pesadas", "Kilos Pesados (Kg)", "Pedidos Despachados", "Latas Despachadas"],
        rows,
        totalsRow: ["TOTALES", sumPesadas, sumKilos, sumPedDesp, sumLatDesp],
        weightColIndices: [2],
        numberColIndices: [1, 3, 4],
      });

      return { sheetName, worksheet };
    };

    const buildBranchSection = async (title: string, dataKeyField: string, consumptionData: any[], ordersData: any[], sheetName: string) => {
      const map = new Map();
      consumptionData?.forEach((d: any) => {
        map.set(d[dataKeyField], { consumidas: d.latas, pedidas: 0 });
      });
      ordersData?.forEach((d: any) => {
        if (!map.has(d[dataKeyField])) {
          map.set(d[dataKeyField], { consumidas: 0, pedidas: d.latas });
        } else {
          map.get(d[dataKeyField]).pedidas = d.latas;
        }
      });

      let sumConsumidas = 0;
      let sumPedidas = 0;

      const rows: any[] = [];
      Array.from(map.entries()).forEach(([period, vals]) => {
        const c = Number(vals.consumidas || 0);
        const p = Number(vals.pedidas || 0);
        sumConsumidas += c;
        sumPedidas += p;
        rows.push([period, c, p]);
      });

      const worksheet = await createUnifiedSheet({
        title: `HELADERÍA LOS BAMBINOS - MÉTRICAS DE SUCURSAL (${sheetName.toUpperCase()})`,
        metadata: [
          `Fecha de emisión: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
          `Total Latas Consumidas: ${sumConsumidas}   |   Total Latas Pedidas: ${sumPedidas}`,
        ],
        headers: ["Periodo", "Latas Consumidas", "Latas Pedidas"],
        rows,
        totalsRow: ["TOTALES", sumConsumidas, sumPedidas],
        numberColIndices: [1, 2],
      });

      return { sheetName, worksheet };
    };

    const sheets: { sheetName: string; worksheet: any }[] = [];

    if (isAdmin) {
      const { monthlyWeighed, monthlyDispatched, weeklyWeighed, dailyWeighed, weeklyDispatched, dailyDispatched } = data;
      sheets.push(await buildSection("REPORTE DIARIO", "date", dailyWeighed, dailyDispatched, "Diario"));
      sheets.push(await buildSection("REPORTE SEMANAL", "week", weeklyWeighed, weeklyDispatched, "Semanal"));
      sheets.push(await buildSection("REPORTE MENSUAL", "month", monthlyWeighed, monthlyDispatched, "Mensual"));
    } else {
      const { dailyConsumption, monthlyOrders, weeklyConsumption, weeklyOrders } = data;
      sheets.push(await buildBranchSection("REPORTE DIARIO", "date", dailyConsumption, [], "Diario"));
      sheets.push(await buildBranchSection("REPORTE SEMANAL", "week", weeklyConsumption, weeklyOrders, "Semanal"));
      sheets.push(await buildBranchSection("REPORTE MENSUAL", "month", [], monthlyOrders, "Mensual"));
    }

    await downloadExcelWorkbook(
      `reporte_metricas_${format(new Date(), "ddMMyy")}.xlsx`,
      sheets
    );
  };

  const renderAdminMetrics = () => {
    const { monthlyWeighed, monthlyDispatched, weeklyWeighed, dailyWeighed, weeklyDispatched, dailyDispatched } = data;

    const weighedData = viewMode === "monthly" ? monthlyWeighed : viewMode === "weekly" ? weeklyWeighed : dailyWeighed;
    const dispatchedData = viewMode === "monthly" ? monthlyDispatched : viewMode === "weekly" ? weeklyDispatched : dailyDispatched;
    const weighedTitle = viewMode === "monthly" ? "Total Latas Pesadas (Últimos 12 meses)" : viewMode === "weekly" ? "Total Latas Pesadas (Semanales)" : "Total Latas Pesadas (Últimos 7 días)";
    const dispatchedTitle = viewMode === "monthly" ? "Pedidos Despachados (Últimos meses)" : viewMode === "weekly" ? "Pedidos Despachados (Semanales)" : "Pedidos Despachados (Últimos 7 días)";
    const xAxisKey = viewMode === "monthly" ? "month" : viewMode === "weekly" ? "week" : "date";

    return (
      <div className="flex flex-col gap-8 w-full">
        <div className="flex justify-end gap-2 mb-[-1rem]">
          <button 
            onClick={() => setViewMode("daily")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "daily" ? "bg-[#27500A] text-white font-medium shadow-sm" : "bg-bg-canvas border border-border-subtle text-text-secondary hover:text-text-primary"}`}
          >
            Diario
          </button>
          <button 
            onClick={() => setViewMode("weekly")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "weekly" ? "bg-[#27500A] text-white font-medium shadow-sm" : "bg-bg-canvas border border-border-subtle text-text-secondary hover:text-text-primary"}`}
          >
            Semanal
          </button>
          <button 
            onClick={() => setViewMode("monthly")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "monthly" ? "bg-[#27500A] text-white font-medium shadow-sm" : "bg-bg-canvas border border-border-subtle text-text-secondary hover:text-text-primary"}`}
          >
            Mensual
          </button>
        </div>
        <section className="bg-bg-canvas border border-border-subtle rounded-xl p-5 shadow-sm w-full h-[400px]">
          <h2 className="text-[16px] font-medium text-text-primary mb-6">{weighedTitle}</h2>
          {weighedData && weighedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={weighedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#171717', fontWeight: 600, marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar yAxisId="left" name="Latas" dataKey="latas" fill="#27500A" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[14px] text-text-secondary">No hay datos recientes</div>
          )}
        </section>

        <section className="bg-bg-canvas border border-border-subtle rounded-xl p-5 shadow-sm w-full h-[400px]">
          <h2 className="text-[16px] font-medium text-text-primary mb-6">{dispatchedTitle}</h2>
          {dispatchedData && dispatchedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={dispatchedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dx={-10} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dx={10} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#171717', fontWeight: 600, marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar yAxisId="left" name="Latas Despachadas" dataKey="latas" fill="#27500A" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar yAxisId="right" name="Total Pedidos" dataKey="pedidos" fill="#64748B" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[14px] text-text-secondary">No hay datos recientes</div>
          )}
        </section>
      </div>
    );
  };

  const renderBranchMetrics = () => {
    const { dailyConsumption, monthlyOrders, weeklyConsumption, weeklyOrders } = data;

    return (
      <div className="flex flex-col gap-8 w-full">
        <div className="flex justify-end gap-2 mb-[-1rem]">
          <button 
            onClick={() => setViewMode("daily")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "daily" ? "bg-[#27500A] text-white font-medium shadow-sm" : "bg-bg-canvas border border-border-subtle text-text-secondary hover:text-text-primary"}`}
          >
            Diario
          </button>
          <button 
            onClick={() => setViewMode("weekly")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "weekly" ? "bg-[#27500A] text-white font-medium shadow-sm" : "bg-bg-canvas border border-border-subtle text-text-secondary hover:text-text-primary"}`}
          >
            Semanal
          </button>
          <button 
            onClick={() => setViewMode("monthly")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "monthly" ? "bg-[#27500A] text-white font-medium shadow-sm" : "bg-bg-canvas border border-border-subtle text-text-secondary hover:text-text-primary"}`}
          >
            Mensual
          </button>
        </div>

        <section className="bg-bg-canvas border border-border-subtle rounded-xl p-5 shadow-sm w-full h-[400px]">
          <h2 className="text-[16px] font-medium text-text-primary mb-6">
            {viewMode === "weekly" ? "Consumo Semanal de Latas (Últimas 8 semanas)" : "Consumo Diario de Latas (Últimos 7 días)"}
          </h2>
          {(viewMode === "weekly" ? weeklyConsumption : dailyConsumption) && (viewMode === "weekly" ? weeklyConsumption : dailyConsumption).length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={viewMode === "weekly" ? weeklyConsumption : dailyConsumption} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey={viewMode === "weekly" ? "week" : "date"} tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#171717', fontWeight: 600, marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar yAxisId="left" name="Latas Consumidas" dataKey="latas" fill="#27500A" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[14px] text-text-secondary">No hay consumos recientes en este periodo</div>
          )}
        </section>

        <section className="bg-bg-canvas border border-border-subtle rounded-xl p-5 shadow-sm w-full h-[400px]">
          <h2 className="text-[16px] font-medium text-text-primary mb-6">
            {viewMode === "monthly" ? "Latas Pedidas a Fábrica (Últimos meses)" : "Latas Pedidas a Fábrica (Semanales)"}
          </h2>
          {(viewMode === "monthly" ? monthlyOrders : weeklyOrders) && (viewMode === "monthly" ? monthlyOrders : weeklyOrders).length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={viewMode === "monthly" ? monthlyOrders : weeklyOrders} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey={viewMode === "monthly" ? "month" : "week"} tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#171717', fontWeight: 600, marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar name="Latas Pedidas" dataKey="latas" fill="#27500A" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[14px] text-text-secondary">No hay pedidos recientes</div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-[24px] font-medium text-text-primary leading-tight mb-1">
            Métricas {isAdmin ? "de Fábrica" : "de Sucursal"}
          </h1>
          <p className="text-[14px] text-text-secondary">
            {isAdmin 
              ? "Resumen de productividad y volumen de despachos" 
              : "Resumen de tus consumos diarios y pedidos históricos"}
          </p>
        </div>
        <button 
          onClick={handleExportExcel}
          className="h-10 px-4 bg-success text-white rounded-md text-[14px] font-medium hover:bg-success-hover transition-colors shadow-sm flex items-center gap-2"
        >
          <i className="ti ti-file-spreadsheet text-[18px]"></i>
          Exportar Excel
        </button>
      </div>

      {isAdmin && demand && <FactoryDemandChart {...demand} />}
      {isAdmin ? renderAdminMetrics() : renderBranchMetrics()}
    </div>
  );
}
