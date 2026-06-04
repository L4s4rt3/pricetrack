import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, DollarSign, Package, TrendingUp, Users } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatEur, formatKg, formatNum } from "@/lib/format";
import { BAR_STYLE, C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, barFill, GlassTooltip } from "@/lib/chartTheme";

export default function Dashboard() {
  const { data = [], isLoading, isError, error, refetch } = useDashboardSummary();
  const latest = data[data.length - 1];
  const isProductionSummary = latest?.source === "produccion";
  const totals = data.reduce(
    (acc, row) => ({
      lineas: acc.lineas + row.lineas,
      kilos: acc.kilos + row.kilos,
      facturacion: acc.facturacion + row.facturacion,
      clientes: Math.max(acc.clientes, row.clientes),
      cajas: acc.cajas + (row.cajas ?? 0),
      palets: acc.palets + (row.palets ?? 0),
      lotes: acc.lotes + (row.lotes ?? 0),
      dias: acc.dias + (row.dias ?? 0),
    }),
    { lineas: 0, kilos: 0, facturacion: 0, clientes: 0, cajas: 0, palets: 0, lotes: 0, dias: 0 },
  );
  const chartRows = data.map((row) => ({
    label: row.mes ? `${String(row.mes).padStart(2, "0")}/${String(row.ano).slice(-2)}` : String(row.ano),
    facturacion: row.facturacion,
    kilos: row.kilos,
    precio: row.precio_medio,
    palets: row.palets ?? 0,
    cajas: row.cajas ?? 0,
  }));
  const latestLabel = latest?.mes ? `${String(latest.mes).padStart(2, "0")}/${latest.ano}` : latest ? String(latest.ano) : "Sin datos";
  const headerSubtitle = latest
    ? isProductionSummary
      ? `${formatNum(totals.lineas)} lineas de produccion - ultimos ${formatNum(data.length)} meses hasta ${latestLabel}`
      : `${formatNum(totals.lineas)} lineas agregadas - ultimos ${formatNum(data.length)} meses hasta ${latestLabel}`
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

  if (isError) {
    const message = error instanceof Error ? error.message : "No se pudo cargar el resumen agregado.";

    return (
      <div className="page-shell">
        <PageHeader title="Resumen" subtitle="No se pudo cargar la vista operativa reciente" />
        <Card className="glass-accented overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-destructive/20 bg-destructive/[0.1] text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Error al cargar el resumen</p>
                <p className="mt-1 text-sm text-muted-foreground">{message}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
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
        {isProductionSummary ? (
          <>
            <KPICard label="Kilos producidos" value={formatKg(totals.kilos)} hint="Ultimos 6 meses" icon={Package} />
            <KPICard label="Palets" value={formatNum(totals.palets)} hint={`${formatNum(totals.dias)} dias con parte`} icon={TrendingUp} />
            <KPICard label="Clientes destino" value={formatNum(totals.clientes)} hint="Maximo mensual" icon={Users} />
            <KPICard label="Cajas" value={formatNum(totals.cajas)} hint={`${formatNum(totals.lineas)} lineas`} icon={DollarSign} />
          </>
        ) : (
          <>
            <KPICard label="Precio medio" value={`${formatEur(latest?.precio_medio ?? 0)}/kg`} hint={latestLabel} icon={DollarSign} />
            <KPICard label="Kilos producto" value={formatKg(totals.kilos)} hint="Ultimos 6 meses" icon={Package} />
            <KPICard label="Clientes activos" value={formatNum(totals.clientes)} hint="Maximo mensual" icon={Users} />
            <KPICard label="Facturacion producto" value={formatEur(totals.facturacion)} hint={`${formatNum(totals.lineas)} lineas`} icon={TrendingUp} />
          </>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={isProductionSummary ? "Kilos producidos por mes" : "Facturacion por mes"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis {...YAXIS} tickFormatter={(value) => (isProductionSummary ? formatKg(Number(value)) : formatEur(Number(value)))} />
              <Tooltip content={<GlassTooltip />} />
              <Bar
                dataKey={isProductionSummary ? "kilos" : "facturacion"}
                {...BAR_STYLE}
                fill={barFill(C.primary, 0.26)}
                stroke={C.primary}
                name={isProductionSummary ? "Kilos" : "Facturacion"}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={isProductionSummary ? "Palets por mes" : "Kilos por mes"}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis {...YAXIS} tickFormatter={(value) => (isProductionSummary ? formatNum(Number(value)) : formatKg(Number(value)))} />
              <Tooltip content={<GlassTooltip />} />
              <Bar
                dataKey={isProductionSummary ? "palets" : "kilos"}
                {...BAR_STYLE}
                fill={barFill(C.success, 0.22)}
                stroke={C.success}
                name={isProductionSummary ? "Palets" : "Kilos"}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={isProductionSummary ? "Cajas por mes" : "Precio medio por mes"}>
          <ResponsiveContainer width="100%" height={300}>
            {isProductionSummary ? (
              <BarChart data={chartRows} margin={MARGIN}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...XAXIS} />
                <YAxis {...YAXIS} tickFormatter={(value) => formatNum(Number(value))} />
                <Tooltip content={<GlassTooltip />} />
                <Bar dataKey="cajas" {...BAR_STYLE} fill={barFill(C.primary, 0.18)} stroke={C.primary} name="Cajas" />
              </BarChart>
            ) : (
              <LineChart data={chartRows} margin={MARGIN}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...XAXIS} />
                <YAxis {...YAXIS} tickFormatter={(value) => formatEur(Number(value))} />
                <Tooltip content={<GlassTooltip />} />
                <Line dataKey="precio" stroke={C.primary} strokeWidth={2.5} dot={false} name="Precio medio" />
              </LineChart>
            )}
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
