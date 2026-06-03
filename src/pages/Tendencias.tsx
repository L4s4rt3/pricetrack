import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowUpDown, Euro, Package } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrecios } from "@/hooks/usePrecios";
import { campaignLabel, formatEur, formatKg, formatNum } from "@/lib/format";
import { BAR_STYLE, C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, barFill, GlassTooltip } from "@/lib/chartTheme";
import { SelectFilter, campaignRows, productPriceRows, productWeightedPrice, selectOptions, useEnrichedPrecios } from "./pageHelpers";

export default function Tendencias() {
  const { data, isHydratingHistory } = usePrecios({ hydrateHistory: true });
  const rows = useEnrichedPrecios(data);
  const priceRows = useMemo(() => productPriceRows(rows), [rows]);
  const [product, setProduct] = useState("");
  const [fromCampaign, setFromCampaign] = useState("");
  const [toCampaign, setToCampaign] = useState("");
  const products = selectOptions(priceRows, (row) => row.cls.product);
  const baseRows = product ? priceRows.filter((row) => row.cls.product === product) : priceRows;
  const allCampaigns = Array.from(new Set(baseRows.map((row) => row.campaign))).sort((a, b) => a - b);
  const rawFrom = Number(fromCampaign || allCampaigns[0] || 0);
  const rawTo = Number(toCampaign || allCampaigns[allCampaigns.length - 1] || 0);
  const from = Math.min(rawFrom, rawTo);
  const to = Math.max(rawFrom, rawTo);
  const campaigns = allCampaigns.filter((campaign) => campaign >= from && campaign <= to);
  const chartData = campaigns.map((campaign, index) => {
    const cRows = campaignRows(baseRows, campaign);
    const price = productWeightedPrice(cRows);
    const previous = index > 0 ? productWeightedPrice(campaignRows(baseRows, campaigns[index - 1])) : price;
    return {
      label: campaignLabel(campaign),
      price: Number(price.toFixed(3)),
      min: Number(Math.min(...cRows.map((row) => row.price).filter((v) => v > 0), price || 0).toFixed(3)),
      max: Number(Math.max(...cRows.map((row) => row.price).filter((v) => v > 0), price || 0).toFixed(3)),
      kg: cRows.reduce((s, row) => s + row.kilos, 0),
      revenue: cRows.reduce((s, row) => s + row.base_iva, 0),
      variation: previous > 0 ? Number((((price - previous) / previous) * 100).toFixed(1)) : 0,
    };
  });
  const prices = chartData.map((d) => d.price).filter(Boolean);
  const avg = prices.reduce((a, b) => a + b, 0) / Math.max(1, prices.length);

  return (
    <div className="page-shell">
      <PageHeader title="Tendencias" subtitle={isHydratingHistory ? "Cargando historico bajo demanda" : "Evolucion historica del precio/kg de producto"} />
      <div className="section-toolbar">
        <SelectFilter label="Producto" value={product} options={products} onChange={setProduct} />
        <SelectFilter label="Desde" value={fromCampaign} options={allCampaigns.map(String)} format={(v) => campaignLabel(Number(v))} onChange={setFromCampaign} />
        <SelectFilter label="Hasta" value={toCampaign} options={allCampaigns.map(String)} format={(v) => campaignLabel(Number(v))} onChange={setToCampaign} />
      </div>
      <section className="metric-strip">
        <KPICard label="Precio producto" value={`${formatEur(avg || 0)}/kg`} icon={Euro} />
        <KPICard label="Maximo" value={`${formatEur(Math.max(...prices, 0))}/kg`} icon={Activity} />
        <KPICard label="Minimo" value={`${formatEur(prices.length ? Math.min(...prices) : 0)}/kg`} icon={ArrowUpDown} />
        <KPICard label="Volumen" value={formatKg(chartData.reduce((s, d) => s + d.kg, 0))} icon={Package} />
      </section>
      <Chart title="Precio producto por campana">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={MARGIN}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...XAXIS} />
            <YAxis {...YAXIS} tickFormatter={(v) => `${Number(v).toFixed(2)}€`} />
            <Tooltip content={<GlassTooltip />} />
            <Area dataKey="price" stroke={C.primary} fill={barFill(C.primary, 0.16)} name="Precio producto" />
          </AreaChart>
        </ResponsiveContainer>
      </Chart>
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Minimo / maximo por campana">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis {...YAXIS} tickFormatter={(v) => `${Number(v).toFixed(2)}€`} />
              <Tooltip content={<GlassTooltip />} />
              <Line dataKey="min" stroke={C.success} strokeWidth={2} dot={false} name="Minimo" />
              <Line dataKey="max" stroke={C.destructive} strokeWidth={2} dot={false} name="Maximo" />
            </ComposedChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Variacion %">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis {...YAXIS} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<GlassTooltip />} />
              <Bar dataKey="variation" {...BAR_STYLE} fill={barFill(C.orange, 0.32)} stroke={C.orange} name="Variacion" />
            </BarChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Volumen y facturacion">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis yAxisId="left" {...YAXIS} tickFormatter={(v) => formatNum(Number(v))} />
              <YAxis yAxisId="right" orientation="right" {...YAXIS} tickFormatter={(v) => formatEur(Number(v))} />
              <Tooltip content={<GlassTooltip />} />
              <Bar yAxisId="left" dataKey="kg" {...BAR_STYLE} fill={barFill(C.info, 0.22)} stroke={C.info} name="KG" />
              <Line yAxisId="right" dataKey="revenue" stroke={C.primary} strokeWidth={2} dot={false} name="Facturacion" />
            </ComposedChart>
          </ResponsiveContainer>
        </Chart>
      </div>
    </div>
  );
}

function Chart({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="glass-accented"><CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader><CardContent><div className={CHART_PANEL_CLASS}>{children}</div></CardContent></Card>;
}
