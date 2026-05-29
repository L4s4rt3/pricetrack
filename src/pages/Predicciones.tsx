import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Gauge, TrendingUp } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrecios } from "@/hooks/usePrecios";
import { formatEur } from "@/lib/format";
import { C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, GlassTooltip, barFill } from "@/lib/chartTheme";
import { predictPrices } from "@/lib/predictions";
import { SelectFilter, productPriceRows, productWeightedPrice, selectOptions, useEnrichedPrecios } from "./pageHelpers";

export default function Predicciones() {
  const { data } = usePrecios();
  const rows = useEnrichedPrecios(data);
  const priceRows = useMemo(() => productPriceRows(rows), [rows]);
  const [product, setProduct] = useState("Naranja");
  const products = selectOptions(priceRows, (row) => row.cls.product);
  const baseRows = product ? priceRows.filter((row) => row.cls.product === product) : priceRows;
  const monthlyHistory = useMemo(() => {
    const keys = Array.from(new Set(baseRows.map((row) => `${row.year}-${row.month}`))).sort();
    return keys.map((key) => {
      const [year, month] = key.split("-").map(Number);
      return { year, month, price: productWeightedPrice(baseRows.filter((row) => row.year === year && row.month === month)) };
    }).filter((item) => item.month && item.price > 0);
  }, [baseRows]);
  const prediction = predictPrices(monthlyHistory, 12);
  const chartData = prediction.predMonths.map((label, index) => ({
    label,
    previsto: prediction.predicted[index],
    inferior: prediction.lowerBound[index],
    superior: prediction.upperBound[index],
  }));
  const next = prediction.predicted[0] ?? 0;
  const confidence = prediction.predicted.length ? Math.max(35, Math.min(92, 88 - Math.abs(prediction.trend) * 20)) : 0;

  return (
    <div className="page-shell">
      <PageHeader title="Predicciones" subtitle="Proyeccion estadistica del precio/kg de producto" />
      <div className="section-toolbar"><SelectFilter label="Producto" value={product} options={products} onChange={setProduct} /></div>
      <section className="metric-strip">
        <KPICard label="Precio producto estimado" value={`${formatEur(next)}/kg`} icon={TrendingUp} />
        <KPICard label="Tendencia" value={`${prediction.trend >= 0 ? "+" : ""}${prediction.trend.toFixed(3)}`} hint="pendiente mensual" icon={Activity} trend={prediction.trend >= 0 ? "up" : "down"} />
        <KPICard label="Confianza" value={`${confidence.toFixed(0)}%`} icon={Gauge} />
      </section>
      <Card className="glass-accented">
        <CardHeader><CardTitle className="text-lg">Forecast producto 12 meses</CardTitle></CardHeader>
        <CardContent>
          <div className={CHART_PANEL_CLASS}>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData} margin={MARGIN}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...XAXIS} />
                <YAxis {...YAXIS} tickFormatter={(v) => `${Number(v).toFixed(2)}€`} />
                <Tooltip content={<GlassTooltip />} />
                <Area dataKey="superior" stroke="transparent" fill={barFill(C.primary, 0.08)} name="Superior" />
                <Area dataKey="inferior" stroke="transparent" fill="var(--glass-bg)" name="Inferior" />
                <Line dataKey="previsto" stroke={C.primary} strokeWidth={2.5} dot={false} name="Previsto" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <DataTable rows={chartData} columns={[
        { key: "month", header: "Mes", cell: (row) => row.label },
        { key: "pred", header: "Precio producto previsto", cell: (row) => `${formatEur(row.previsto)}/kg`, className: "text-right font-semibold" },
        { key: "low", header: "Rango inferior", cell: (row) => formatEur(row.inferior), className: "text-right" },
        { key: "high", header: "Rango superior", cell: (row) => formatEur(row.superior), className: "text-right" },
      ]} />
    </div>
  );
}
