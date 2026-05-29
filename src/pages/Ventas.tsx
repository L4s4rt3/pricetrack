import { useDeferredValue, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Package, ShoppingCart, Users } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrecios } from "@/hooks/usePrecios";
import { supabase } from "@/integrations/supabase/client";
import { MIN_CAMPAIGN_LABEL } from "@/lib/campaigns";
import { campaignLabel, formatEur, formatKg, formatNum, MONTHS } from "@/lib/format";
import { SaleFilterPanel, filterSales, summaryStats, useEnrichedPrecios, usePagination, useSaleFilterState, PaginationControls } from "./pageHelpers";

export default function Ventas() {
  const { data, isLoading } = usePrecios();
  const queryClient = useQueryClient();
  const rows = useEnrichedPrecios(data);
  const [filters, setFilters] = useSaleFilterState();
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => filterSales(rows, deferredFilters), [rows, deferredFilters]);
  const stats = summaryStats(filtered);
  const page = usePagination(filtered, 50);
  const deleteRow = async (id: number) => {
    if (!window.confirm("Eliminar esta linea de ventas?")) return;
    const { error } = await supabase.from("precios").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar la linea");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["precios"] });
    toast.success("Linea eliminada");
  };

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="page-shell">
      <PageHeader title="Ventas" subtitle={`Lineas comerciales desde campana ${MIN_CAMPAIGN_LABEL}`} />
      <section className="metric-strip">
        <KPICard label="Registros" value={formatNum(stats.lines)} icon={FileText} />
        <KPICard label="Facturacion" value={formatEur(stats.revenue)} icon={ShoppingCart} />
        <KPICard label="Kilos" value={formatKg(stats.kg)} icon={Package} />
        <KPICard label="Clientes" value={formatNum(stats.clients)} icon={Users} />
      </section>
      <SaleFilterPanel rows={rows} filters={filters} onChange={setFilters} />
      <Card className="glass-accented">
        <CardContent className="space-y-4 p-4">
          <PaginationControls page={page.page} pageSize={page.pageSize} pageCount={page.pageCount} total={filtered.length} onPage={page.setPage} onPageSize={page.setPageSize} />
          <DataTable
            rows={page.pagedRows}
            getRowKey={(row) => row.id}
            columns={[
              { key: "date", header: "Campana / mes", cell: (row) => <>{campaignLabel(row.campaign)}<div className="text-xs text-muted-foreground">{row.month ? MONTHS[row.month - 1] : "Sin mes"}</div></> },
              { key: "doc", header: "Documento", cell: (row) => <>{row.documento || row.factura || "-"}<div className="text-xs text-muted-foreground">Lin. {row.lin || "-"}</div></> },
              { key: "client", header: "Cliente", cell: (row) => row.clientLabel },
              { key: "product", header: "Producto", cell: (row) => <>{row.cls.product}<div className="max-w-sm text-xs text-muted-foreground">{row.cls.subproduct || row.product}</div></> },
              { key: "ref", header: "Referencia", cell: (row) => row.referencia || "-" },
              { key: "kg", header: "Kilos", cell: (row) => formatKg(row.kilos), className: "text-right" },
              { key: "price", header: "Precio", cell: (row) => `${formatEur(row.price)}/kg`, className: "text-right" },
              { key: "total", header: "Total", cell: (row) => formatEur(row.base_iva), className: "text-right font-semibold" },
              { key: "actions", header: "", cell: (row) => <button className="text-xs font-semibold text-destructive hover:underline" onClick={() => deleteRow(row.id)}>Eliminar</button>, className: "text-right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
