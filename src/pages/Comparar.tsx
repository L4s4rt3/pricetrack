import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrecios } from "@/hooks/usePrecios";
import { CAMPAIGN_MONTHS, campaignLabel, formatEur, formatKg } from "@/lib/format";
import { C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, GlassTooltip } from "@/lib/chartTheme";
import { weightedPrice } from "@/lib/parsers";
import { SelectFilter, campaignRows, selectOptions, summaryStats, useEnrichedPrecios } from "./pageHelpers";

const colors = [C.primary, C.orange, C.info, C.success, C.purple];

export default function Comparar() {
  const { data } = usePrecios();
  const rows = useEnrichedPrecios(data);
  const [product, setProduct] = useState("");
  const products = selectOptions(rows, (row) => row.cls.product);
  const baseRows = product ? rows.filter((row) => row.cls.product === product) : rows;
  const campaigns = Array.from(new Set(baseRows.map((row) => row.campaign))).sort((a, b) => b - a);
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => {
    setSelected((current) => {
      const valid = current.filter((campaign) => campaigns.includes(campaign));
      return valid.length >= 2 ? valid : campaigns.slice(0, Math.min(3, campaigns.length));
    });
  }, [product, campaigns.join(",")]);
  const active = selected;
  const chartData = CAMPAIGN_MONTHS.map((label, index) => {
    const month = index < 3 ? index + 10 : index - 2;
    return Object.fromEntries([["label", label], ...active.map((campaign) => [campaignLabel(campaign), Number(weightedPrice(campaignRows(baseRows, campaign).filter((row) => row.month === month)).toFixed(3))])]);
  });
  const tableRows = active.map((campaign) => ({ campaign, ...summaryStats(campaignRows(baseRows, campaign)) }));

  return (
    <div className="page-shell">
      <PageHeader title="Comparar" subtitle="Comparativa mensual entre campanas" />
      <div className="section-toolbar"><SelectFilter label="Producto" value={product} options={products} onChange={setProduct} /></div>
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
        { key: "price", header: "Precio medio", cell: (row) => `${formatEur(row.price)}/kg`, className: "text-right" },
        { key: "kg", header: "KG", cell: (row) => formatKg(row.kg), className: "text-right" },
        { key: "revenue", header: "Facturacion", cell: (row) => formatEur(row.revenue), className: "text-right font-semibold" },
      ]} />
    </div>
  );
}
