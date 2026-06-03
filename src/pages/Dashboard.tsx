import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, Package, TrendingUp, Users } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatEur, formatKg, formatNum } from "@/lib/format";
import { BAR_STYLE, C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, barFill, GlassTooltip } from "@/lib/chartTheme";

export default function Dashboard() {
  const { data = [], isLoading } = useDashboardSummary();
  const latest = data[data.length - 1];
  const totals = data.reduce(
    (acc, row) => ({
      lineas: acc.lineas + row.lineas,
      kilos: acc.kilos + row.kilos,
      facturacion: acc.facturacion + row.facturacion,
      clientes: Math.max(acc.clientes, row.clientes),
    }),
    { lineas: 0, kilos: 0, facturacion: 0, clientes: 0 },
  );
  const chartRows = data.map((row) => ({
    label: row.mes ? `${String(row.mes).padStart(2, "0")}/${String(row.ano).slice(-2)}` : String(row.ano),
    facturacion: row.facturacion,
    kilos: row.kilos,
    precio: row.precio_medio,
  }));
  const latestLabel = latest?.mes ? `${String(latest.mes).padStart(2, "0")}/${latest.ano}` : latest ? String(latest.ano) : "Sin datos";
  const headerSubtitle = latest
    ? `${formatNum(totals.lineas)} lineas agregadas - ultimos ${formatNum(data.length)} meses hasta ${latestLabel}`
    : "Resumen agregado de los ultimos seis meses";

  if (isLoading) {
    return (
      <div className="page-shell">
        <PageHeader title="Resumen" subtitle="Preparando vista operativa reciente" />
        <div className="metric-strip">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Skeleton className="h-[380px] rounded-lg" />
          <Skeleton className="h-[380px] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Resumen" subtitle={headerSubtitle}>
        <Button variant="outline" asChild>
          <Link to="/busqueda?mode=filters">Ampliar historico</Link>
        </Button>
      </PageHeader>
      <section className="metric-strip">
        <KPICard label="Precio medio" value={`${formatEur(latest?.precio_medio ?? 0)}/kg`} hint={latestLabel} icon={DollarSign} />
        <KPICard label="Kilos producto" value={formatKg(totals.kilos)} hint="Ultimos 6 meses" icon={Package} />
        <KPICard label="Clientes activos" value={formatNum(totals.clientes)} hint="Maximo mensual" icon={Users} />
        <KPICard label="Facturacion producto" value={formatEur(totals.facturacion)} hint={`${formatNum(totals.lineas)} lineas`} icon={TrendingUp} />
      </section>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <ChartCard title="Facturacion y kilos por mes">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis {...YAXIS} tickFormatter={(value) => formatNum(Number(value))} />
              <Tooltip content={<GlassTooltip />} />
              <Bar dataKey="facturacion" {...BAR_STYLE} fill={barFill(C.primary, 0.26)} stroke={C.primary} name="Facturacion" />
              <Bar dataKey="kilos" {...BAR_STYLE} fill={barFill(C.success, 0.22)} stroke={C.success} name="Kilos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Precio medio por mes">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartRows} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis {...YAXIS} tickFormatter={(value) => formatEur(Number(value))} />
              <Tooltip content={<GlassTooltip />} />
              <Line dataKey="precio" stroke={C.primary} strokeWidth={2.5} dot={false} name="Precio medio" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="chart-card glass-accented overflow-hidden">
      <CardHeader className="pb-3">
        <span className="panel-kicker">Analisis</span>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={CHART_PANEL_CLASS}>{children}</div>
      </CardContent>
    </Card>
  );
}
