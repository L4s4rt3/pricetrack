import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Euro, FileText, Package, ReceiptText, Search, Users } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfeccion } from "@/hooks/useConfeccion";
import { usePrecios } from "@/hooks/usePrecios";
import { formatEur, formatKg, formatNum } from "@/lib/format";
import { summaryStats, useEnrichedPrecios } from "./pageHelpers";

const quickAccess = [
  { to: "/ventas", label: "Ventas", icon: ReceiptText },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/clientes", label: "Clientes", icon: Users },
];

export default function Comercial() {
  const { data: precios } = usePrecios();
  const { data: confeccion } = useConfeccion();
  const rows = useEnrichedPrecios(precios);
  const stats = summaryStats(rows);
  const [search, setSearch] = useState("");
  const traceRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const completeRows = (confeccion ?? []).filter((row) => (row.cliente_nombre || row.denominacion_social) && row.kg_netos > 0 && (row.pvp_kg > 0 || row.pvp_total > 0));
    return completeRows
      .filter((row) => {
        if (!needle) return true;
        return [
          row.fecha,
          row.cliente_nombre,
          row.denominacion_social,
          row.producto_confeccionado,
          row.producto_base,
          row.variedad,
          row.calibre,
          row.lote,
          row.n_palet,
          row.documento_limpio,
          row.documento_venta_original,
        ].join(" ").toLowerCase().includes(needle);
      })
      .slice(0, 24);
  }, [confeccion, search]);
  const traceKg = (confeccion ?? []).reduce((sum, row) => sum + row.kg_netos, 0);

  return (
    <div className="page-shell">
      <PageHeader title="Comercial" subtitle="Ventas, productos, clientes y trazabilidad comercial en un solo lugar" />
      <section className="metric-strip">
        <KPICard label="Facturacion ventas" value={formatEur(stats.productRevenue)} icon={Euro} />
        <KPICard label="KG producto" value={formatKg(stats.productKg)} icon={Package} />
        <KPICard label="Clientes activos" value={formatNum(stats.clients)} icon={Users} />
        <KPICard label="KG trazables" value={formatKg(traceKg)} icon={FileText} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {quickAccess.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.to} className="glass-accented commercial-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-4 w-4 text-primary" />{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full justify-between">
                  <NavLink to={item.to}>Abrir {item.label}<span aria-hidden="true">→</span></NavLink>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass-accented">
        <CardHeader>
          <CardTitle className="text-lg">Trazabilidad rapida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, factura, lote, producto, variedad o fecha" />
          </div>
          <DataTable
            rows={traceRows}
            getRowKey={(row) => row.id}
            columns={[
              { key: "date", header: "Fecha", cell: (row) => row.fecha || "-" },
              { key: "client", header: "Cliente", cell: (row) => row.cliente_nombre || row.denominacion_social || "-" },
              { key: "product", header: "Producto", cell: (row) => <>{row.producto_confeccionado}<div className="text-xs text-muted-foreground">{row.variedad} · {row.calibre}</div></> },
              { key: "trace", header: "Lote / factura", cell: (row) => <>{row.lote || "-"}<div className="text-xs text-muted-foreground">{row.documento_limpio || row.documento_venta_original || row.n_palet || ""}</div></> },
              { key: "kg", header: "KG", cell: (row) => formatKg(row.kg_netos), className: "text-right" },
              { key: "price", header: "Precio/kg", cell: (row) => formatEur(row.pvp_kg), className: "text-right" },
              { key: "total", header: "Total", cell: (row) => formatEur(row.pvp_total), className: "text-right font-semibold" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
