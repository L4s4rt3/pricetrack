import { useDeferredValue, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, Package, TrendingUp, Users } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrecios } from "@/hooks/usePrecios";
import { campaignLabel, CAMPAIGN_MONTHS, formatEur, formatKg, formatNum } from "@/lib/format";
import { BAR_STYLE, C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, barFill, GlassTooltip } from "@/lib/chartTheme";
import { MIN_CAMPAIGN_LABEL } from "@/lib/campaigns";
import { SaleFilterPanel, campaignRows, filterSales, groupRows, productPriceRows, productWeightedPrice, summaryStats, useEnrichedPrecios, useSaleFilterState } from "./pageHelpers";

export default function Dashboard() {
  const { data, isLoading, isFetching } = usePrecios();
  const rows = useEnrichedPrecios(data);
  const [filters, setFilters] = useSaleFilterState();
  const deferredFilters = useDeferredValue(filters);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const filtered = useMemo(() => filterSales(rows, deferredFilters), [rows, deferredFilters]);
  const campaigns = useMemo(() => Array.from(new Set(filtered.map((row) => row.campaign))).sort((a, b) => b - a), [filtered]);
  const currentCampaign = Number(selectedCampaign || campaigns[0] || new Date().getFullYear());
  const currentRows = useMemo(() => campaignRows(filtered, currentCampaign), [filtered, currentCampaign]);
  const currentProductRows = useMemo(() => productPriceRows(currentRows), [currentRows]);
  const stats = summaryStats(currentRows);

  const annualData = [...campaigns].reverse().map((campaign) => ({
    label: campaignLabel(campaign),
    price: Number(productWeightedPrice(campaignRows(filtered, campaign)).toFixed(3)),
  }));
  const monthlyData = CAMPAIGN_MONTHS.map((label, index) => {
    const month = index < 3 ? index + 10 : index - 2;
    return { label, price: Number(productWeightedPrice(currentRows.filter((row) => row.month === month)).toFixed(3)) };
  });
  const varietyData = groupRows(currentProductRows, (row) => row.cls.variety).slice(0, 8);
  const headerSubtitle = isFetching
    ? `${formatNum(rows.length)} lineas visibles - cargando historico en segundo plano`
    : `${formatNum(rows.length)} lineas - desde campana ${MIN_CAMPAIGN_LABEL}`;

  if (isLoading) {
    return (
      <div className="page-shell">
        <PageHeader title="Resumen" subtitle={`Preparando historico desde campana ${MIN_CAMPAIGN_LABEL}`} />
        <div className="metric-strip">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Skeleton className="h-[380px] rounded-lg" />
          <Skeleton className="h-[380px] rounded-lg" />
        </div>
        <Skeleton className="h-[340px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Resumen" subtitle={headerSubtitle} />
      <section className="metric-strip">
        <KPICard label="Precio producto" value={`${formatEur(stats.price)}/kg`} hint={campaignLabel(currentCampaign)} icon={DollarSign} />
        <KPICard label="Kilos producto" value={formatKg(stats.productKg)} hint={`${formatNum(currentProductRows.length)} lineas`} icon={Package} />
        <KPICard label="Clientes activos" value={formatNum(stats.clients)} hint="Filtro actual" icon={Users} />
        <KPICard label="Facturacion producto" value={formatEur(stats.productRevenue)} hint="Solo ventas" icon={TrendingUp} />
      </section>
      <SaleFilterPanel rows={rows} filters={filters} onChange={setFilters} compact />
      <div className="section-toolbar">
        <label className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">Campana activa</label>
        <Select value={String(selectedCampaign || currentCampaign)} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="h-10 w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => <SelectItem key={campaign} value={String(campaign)}>{campaignLabel(campaign)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <ChartCard title="Evolucion precio/kg producto">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={annualData} margin={MARGIN}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...XAXIS} />
              <YAxis {...YAXIS} tickFormatter={(v) => `${Number(v).toFixed(2)}€`} />
              <Tooltip content={<GlassTooltip />} />
              <Line dataKey="price" stroke={C.primary} strokeWidth={2.5} dot={false} name="Precio producto" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Variedades principales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={varietyData} layout="vertical" margin={MARGIN}>
              <CartesianGrid {...GRID} horizontal={false} />
              <XAxis type="number" {...XAXIS} tickFormatter={(v) => `${Number(v).toFixed(2)}€`} />
              <YAxis type="category" dataKey="name" {...XAXIS} width={120} />
              <Tooltip content={<GlassTooltip />} />
              <Bar dataKey="price" {...BAR_STYLE} fill={barFill(C.primary, 0.28)} stroke={C.primary} name="Precio producto" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <ChartCard title={`Precio producto mensual - ${campaignLabel(currentCampaign)}`}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyData} margin={MARGIN}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...XAXIS} />
            <YAxis {...YAXIS} tickFormatter={(v) => `${Number(v).toFixed(2)}€`} />
            <Tooltip content={<GlassTooltip />} />
            <Bar dataKey="price" {...BAR_STYLE} fill={barFill(C.primary, 0.28)} stroke={C.primary} name="Precio producto" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
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
