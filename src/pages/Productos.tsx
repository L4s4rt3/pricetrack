import { useDeferredValue, useMemo } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrecios } from "@/hooks/usePrecios";
import { formatEur, formatKg, formatNum } from "@/lib/format";
import { SaleFilterPanel, filterSales, groupRows, summaryStats, useEnrichedPrecios, useSaleFilterState } from "./pageHelpers";
import { Layers, Package, ShoppingCart } from "lucide-react";

export default function Productos() {
  const { data, isLoading } = usePrecios();
  const rows = useEnrichedPrecios(data);
  const [filters, setFilters] = useSaleFilterState();
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => filterSales(rows, deferredFilters), [rows, deferredFilters]);
  const stats = summaryStats(filtered);
  const groups = [
    ["Tipo", groupRows(filtered, (row) => row.cls.type)],
    ["Producto base", groupRows(filtered, (row) => row.cls.product)],
    ["Variedad", groupRows(filtered, (row) => row.cls.variety)],
    ["Calibre", groupRows(filtered, (row) => row.cls.caliber)],
    ["Formato", groupRows(filtered, (row) => row.cls.format)],
    ["Subproducto", groupRows(filtered, (row) => row.cls.subproduct)],
  ] as const;

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="page-shell">
      <PageHeader title="Productos" subtitle="Agregaciones por familia, variedad, calibre, formato y subproducto" />
      <section className="metric-strip">
        <KPICard label="Lineas" value={formatNum(stats.lines)} icon={Layers} />
        <KPICard label="Productos" value={formatNum(stats.products)} icon={Package} />
        <KPICard label="Facturacion producto" value={formatEur(stats.productRevenue)} hint={`${formatEur(stats.otherRevenue)} auxiliares`} icon={ShoppingCart} />
      </section>
      <SaleFilterPanel rows={rows} filters={filters} onChange={setFilters} compact />
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map(([title, dataRows]) => (
          <Card key={title} className="glass-accented overflow-hidden">
            <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
            <CardContent>
              <DataTable
                rows={dataRows.slice(0, 12)}
                getRowKey={(row) => row.name}
                columns={[
                  { key: "name", header: "Nombre", cell: (row) => row.name },
                  { key: "lines", header: "Lineas", cell: (row) => formatNum(row.lines), className: "text-right" },
                  { key: "refs", header: "Refs.", cell: (row) => formatNum(row.refsCount), className: "text-right" },
                  { key: "kg", header: "KG", cell: (row) => formatKg(row.kg), className: "text-right" },
                  { key: "revenue", header: "Base IVA", cell: (row) => formatEur(row.revenue), className: "text-right font-semibold" },
                ]}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
