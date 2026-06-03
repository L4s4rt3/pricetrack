import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrecios } from "@/hooks/usePrecios";
import { CAMPAIGN_MONTHS, campaignLabel, formatEur, formatKg } from "@/lib/format";
import { C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, GlassTooltip } from "@/lib/chartTheme";
import { isCountableSaleRow, saleLineValue, weightedPrice } from "@/lib/parsers";
import { SaleFilterPanel, campaignRows, filterSales, productPriceRows, productWeightedPrice, useEnrichedPrecios, useSaleFilterState } from "./pageHelpers";

const colors = [C.primary, C.orange, C.info, C.success, C.purple];

export default function Comparar() {
  const { data, isLoading, isHydratingHistory } = usePrecios({ hydrateHistory: true });
  const rows = useEnrichedPrecios(data);
  const [filters, setFilters] = useSaleFilterState();
  const deferredFilters = useDeferredValue(filters);
  const filteredRows = useMemo(() => filterSales(rows, deferredFilters), [rows, deferredFilters]);
  const compareExactRows = Boolean(deferredFilters.type || deferredFilters.article || deferredFilters.confeccion || deferredFilters.subproduct);
  const baseRows = useMemo(
    () => (compareExactRows ? filteredRows : productPriceRows(filteredRows)),
    [compareExactRows, filteredRows]
  );
  const campaigns = useMemo(() => Array.from(new Set(baseRows.map((row) => row.campaign))).sort((a, b) => b - a), [baseRows]);
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => {
    setSelected((current) => {
      const valid = current.filter((campaign) => campaigns.includes(campaign));
      return valid.length >= 2 ? valid : campaigns.slice(0, Math.min(3, campaigns.length));
    });
  }, [campaigns.join(",")]);
  const active = selected;
  const comparePrice = (targetRows: typeof baseRows) => compareExactRows ? weightedPrice(targetRows) : productWeightedPrice(targetRows);
  const compareStats = (targetRows: typeof baseRows) => {
    const countableRows = targetRows.filter(isCountableSaleRow);
    return {
      kg: countableRows.reduce((sum, row) => sum + row.kilos, 0),
      revenue: countableRows.reduce((sum, row) => sum + saleLineValue(row), 0),
      price: comparePrice(targetRows),
    };
  };
  const rowsByCampaignMonth = useMemo(() => {
    const map = new Map<string, typeof baseRows>();
    baseRows.forEach((row) => {
      const key = `${row.campaign}-${row.month ?? ""}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    });
    return map;
  }, [baseRows]);
  const chartData = useMemo(
    () => CAMPAIGN_MONTHS.map((label, index) => {
      const month = index < 3 ? index + 10 : index - 2;
      return Object.fromEntries([
        ["label", label],
        ...active.map((campaign) => [
          campaignLabel(campaign),
          Number(comparePrice(rowsByCampaignMonth.get(`${campaign}-${month}`) ?? []).toFixed(3)),
        ]),
      ]);
    }),
    [active, rowsByCampaignMonth, compareExactRows]
  );
  const tableRows = useMemo(() => active.map((campaign) => ({ campaign, ...compareStats(campaignRows(baseRows, campaign)) })), [active, baseRows, compareExactRows]);

  if (isLoading) {
    return (
      <div className="page-shell">
        <PageHeader title="Comparar" subtitle="Preparando campañas para comparar precios directamente" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-[420px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Comparar" subtitle={isHydratingHistory ? "Cargando historico bajo demanda" : "Comparativa mensual con filtros de cliente, articulo y confeccion"} />
      <SaleFilterPanel rows={rows} filters={filters} onChange={setFilters} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {campaigns.slice(0, 12).map((campaign) => {
          const isActive = active.includes(campaign);
          return <Button key={campaign} variant={isActive ? "default" : "outline"} className="h-14 justify-start" onClick={() => setSelected((current) => {
            if (isActive) return current.length <= 2 ? current : current.filter((c) => c !== campaign);
            return [...current, campaign];
          })}>{campaignLabel(campaign)}</Button>;
        })}
      </div>
      {active.length < 2 && <p className="text-sm text-muted-foreground">Selecciona al menos dos campanas para comparar.</p>}
      <Card className="glass-accented">
        <CardHeader><CardTitle className="text-lg">Precio mensual comparado</CardTitle></CardHeader>
        <CardContent>
          <div className={CHART_PANEL_CLASS}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={MARGIN}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...XAXIS} />
                <YAxis {...YAXIS} tickFormatter={(v) => `${Number(v).toFixed(2)}€`} />
                <Tooltip content={<GlassTooltip />} />
                {active.map((campaign, index) => <Line key={campaign} dataKey={campaignLabel(campaign)} stroke={colors[index % colors.length]} strokeWidth={2.5} dot={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <DataTable rows={tableRows} getRowKey={(row) => row.campaign} columns={[
        { key: "campaign", header: "Campana", cell: (row) => campaignLabel(row.campaign) },
        { key: "price", header: "Precio", cell: (row) => `${formatEur(row.price)}/kg`, className: "text-right" },
        { key: "kg", header: "KG", cell: (row) => formatKg(row.kg), className: "text-right" },
        { key: "revenue", header: "Facturacion", cell: (row) => formatEur(row.revenue), className: "text-right font-semibold" },
      ]} />
    </div>
  );
}
