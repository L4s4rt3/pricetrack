import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Euro, Package, Search, Users } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientes } from "@/hooks/useClientes";
import { useConfeccion } from "@/hooks/useConfeccion";
import { usePrecios } from "@/hooks/usePrecios";
import { formatEur, formatKg, formatNum } from "@/lib/format";
import { campaignLabel } from "@/lib/format";
import { BAR_STYLE, C, CHART_PANEL_CLASS, GRID, MARGIN, XAXIS, YAXIS, barFill, GlassTooltip } from "@/lib/chartTheme";
import { campaignRows, summaryStats, useEnrichedPrecios } from "./pageHelpers";

export default function Clientes() {
  const clientes = useClientes();
  const { data, isLoading: isPreciosLoading } = usePrecios();
  const { data: confeccion, isLoading: isConfeccionLoading } = useConfeccion();
  const salesRows = useEnrichedPrecios(data);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const filtered = useMemo(() => clientes.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())), [clientes, search]);
  const top = filtered.slice(0, 12);
  const revenue = filtered.reduce((s, c) => s + c.facturacion, 0);
  const kg = filtered.reduce((s, c) => s + c.kg, 0);
  const confeccionKg = filtered.reduce((s, c) => s + c.confeccionKg, 0);
  const selectedName = selected || filtered[0]?.nombre || "";
  const selectedRows = salesRows.filter((row) => row.clientLabel === selectedName);
  const selectedConfeccion = (confeccion ?? []).filter((row) => (row.cliente_nombre || row.denominacion_social) === selectedName);
  const selectedCampaigns = Array.from(new Set(selectedRows.map((row) => row.campaign))).sort((a, b) => a - b);
  const selectedHistory = selectedCampaigns.map((campaign) => ({ label: campaignLabel(campaign), ...summaryStats(campaignRows(selectedRows, campaign)) }));

  if (isPreciosLoading || isConfeccionLoading) {
    return (
      <div className="page-shell">
        <PageHeader title="Clientes" subtitle="Preparando ranking y detalle de clientes" />
        <div className="metric-strip">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Clientes" subtitle="Ranking y detalle de clientes por facturacion y volumen" />
      <section className="metric-strip">
        <KPICard label="Clientes" value={formatNum(filtered.length)} icon={Users} />
        <KPICard label="Facturacion ventas" value={formatEur(revenue)} icon={Euro} />
        <KPICard label="KG producto" value={formatKg(kg)} icon={Package} />
        <KPICard label="KG confeccion" value={formatKg(confeccionKg)} icon={Package} />
      </section>
      <div className="section-toolbar">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card className="glass-accented">
          <CardHeader><CardTitle className="text-lg">Top clientes</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              rows={filtered}
              getRowKey={(row) => row.nombre}
              columns={[
                { key: "name", header: "Cliente", cell: (row) => <button className="text-left font-medium hover:text-primary" onClick={() => setSelected(row.nombre)}>{row.nombre}<div className="text-xs font-normal text-muted-foreground">{formatNum(row.ventasRegistros)} ventas / {formatNum(row.confeccionRegistros)} conf. / {row.fuente}</div></button> },
                { key: "kg", header: "KG producto", cell: (row) => formatKg(row.kg), className: "text-right" },
                { key: "conf", header: "KG conf.", cell: (row) => formatKg(row.confeccionKg), className: "text-right" },
                { key: "revenue", header: "Facturacion ventas", cell: (row) => formatEur(row.facturacion), className: "text-right font-semibold" },
              ]}
            />
          </CardContent>
        </Card>
        <Card className="glass-accented">
          <CardHeader><CardTitle className="text-lg">Facturacion ventas</CardTitle></CardHeader>
          <CardContent>
            <div className={CHART_PANEL_CLASS}>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={top} layout="vertical" margin={MARGIN}>
                  <CartesianGrid {...GRID} horizontal={false} />
                  <XAxis type="number" {...XAXIS} tickFormatter={(v) => formatEur(Number(v))} />
                  <YAxis type="category" dataKey="nombre" {...XAXIS} width={150} />
                  <Tooltip content={<GlassTooltip />} />
                  <Bar dataKey="facturacion" {...BAR_STYLE} fill={barFill(C.primary, 0.28)} stroke={C.primary} name="Facturacion ventas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      {selectedName && (
        <Card className="glass-accented">
          <CardHeader><CardTitle className="text-lg">Detalle · {selectedName}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <DataTable
              rows={[
                ...selectedRows.slice(0, 16).map((row) => ({
                  key: `v-${row.id}`,
                  date: row.fecha_fra || campaignLabel(row.campaign),
                  product: row.product,
                  detail: row.factura || row.documento || campaignLabel(row.campaign),
                  kg: row.kilos,
                  price: row.kilos > 0 ? row.base_iva / row.kilos : row.price,
                  total: row.base_iva,
                  source: "Ventas",
                })),
                ...selectedConfeccion.slice(0, 16).map((row) => ({
                  key: `c-${row.id}`,
                  date: row.fecha || "-",
                  product: row.producto_confeccionado || row.producto_base,
                  detail: [row.lote && `Lote ${row.lote}`, row.n_palet && `Palet ${row.n_palet}`, row.documento_limpio].filter(Boolean).join(" · "),
                  kg: row.kg_netos,
                  price: row.pvp_kg,
                  total: row.pvp_total || row.kg_netos * row.pvp_kg,
                  source: "Confeccion",
                })),
              ]}
              getRowKey={(row) => row.key}
              columns={[
                { key: "date", header: "Fecha", cell: (row) => <>{row.date}<div className="text-xs text-muted-foreground">{row.source}</div></> },
                { key: "product", header: "Producto / trazabilidad", cell: (row) => <>{row.product}<div className="text-xs text-muted-foreground">{row.detail}</div></> },
                { key: "kg", header: "KG", cell: (row) => formatKg(row.kg), className: "text-right" },
                { key: "price", header: "Precio/kg", cell: (row) => formatEur(row.price), className: "text-right" },
                { key: "total", header: "Total", cell: (row) => formatEur(row.total), className: "text-right font-semibold" },
              ]}
            />
            <div className={CHART_PANEL_CLASS}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={selectedHistory} margin={MARGIN}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...XAXIS} />
                  <YAxis {...YAXIS} tickFormatter={(v) => formatEur(Number(v))} />
                  <Tooltip content={<GlassTooltip />} />
                  <Line dataKey="revenue" stroke={C.primary} strokeWidth={2.5} dot={false} name="Facturacion" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
