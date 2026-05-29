import { useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Download, Trash2, Upload } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrecios } from "@/hooks/usePrecios";
import { supabase } from "@/integrations/supabase/client";
import { MIN_CAMPAIGN_LABEL } from "@/lib/campaigns";
import { campaignLabel, formatEur, formatKg, formatNum, MONTHS } from "@/lib/format";
import { SaleFilterPanel, filterSales, summaryStats, useEnrichedPrecios, usePagination, useSaleFilterState, PaginationControls } from "./pageHelpers";

export default function Datos() {
  const { data, isLoading } = usePrecios();
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const rows = useEnrichedPrecios(data);
  const [filters, setFilters] = useSaleFilterState();
  const deferredFilters = useDeferredValue(filters);
  const filtered = useMemo(() => filterSales(rows, deferredFilters), [rows, deferredFilters]);
  const stats = summaryStats(filtered);
  const page = usePagination(filtered, 100);

  const exportCsv = () => {
    const header = ["id", "campana", "mes", "documento", "cliente", "producto", "categoria", "referencia", "kilos", "precio", "base_iva"];
    const body = filtered.map((row) => [row.id, campaignLabel(row.campaign), row.month, row.documento, row.clientLabel, row.product, row.category, row.referencia, row.kilos, row.price, row.base_iva]);
    const csv = [header, ...body].map((line) => line.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pricetrack-datos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importCsv = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const [head, ...lines] = text.split(/\r?\n/).filter(Boolean);
      const headers = head.split(/[;,]/).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const records = lines.map((line) => {
        const values = line.split(/;|,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.trim().replace(/^"|"$/g, ""));
        const raw = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
        return {
          producto: raw.producto || raw.product || "",
          categoria: raw.categoria || raw.category || "Importado",
          precio: Number(String(raw.precio || raw.price || "0").replace(",", ".")),
          unidad: raw.unidad || raw.unit || "kg",
          ano: Number(raw.ano || raw.year || new Date().getFullYear()),
          mes: Number(raw.mes || raw.month || 0) || null,
          cliente: raw.cliente || "",
          denominacion_social: raw.denominacion_social || raw.cliente_nombre || "",
          referencia: raw.referencia || "",
          kilos: Number(String(raw.kilos || raw.kg || "0").replace(",", ".")),
          base_iva: Number(String(raw.base_iva || raw.total || "0").replace(",", ".")),
          documento: raw.documento || "",
          factura: raw.factura || "",
          fecha_fra: raw.fecha_fra || raw.fecha || null,
          notas: raw.notas || "Importado desde CSV",
        };
      }).filter((row) => row.producto);
      if (!records.length) throw new Error("CSV sin filas validas");
      const { error } = await supabase.from("precios").insert(records);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["precios"] });
      toast.success(`${records.length} filas importadas`);
      setImportOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el CSV");
    } finally {
      setImporting(false);
    }
  };
  const deleteAll = async () => {
    if (!window.confirm("Eliminar todos los datos de precios? Esta accion no se puede deshacer.")) return;
    const { error } = await supabase.rpc("delete_all_precios");
    if (error) {
      toast.error("No se pudieron eliminar los datos");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["precios"] });
    toast.success("Datos eliminados");
  };

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="page-shell">
      <PageHeader title="Datos" subtitle={`Tabla completa desde campana ${MIN_CAMPAIGN_LABEL}`}>
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> Importar CSV</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader>
              <DialogTitle>Importar CSV</DialogTitle>
              <DialogDescription>Selecciona un CSV con columnas de PriceTrack. Se insertaran nuevas filas en Supabase.</DialogDescription>
            </DialogHeader>
            <Input type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => importCsv(event.target.files?.[0])} />
          </DialogContent>
        </Dialog>
        <Button className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar CSV</Button>
        <Button variant="destructive" className="gap-2" onClick={deleteAll}><Trash2 className="h-4 w-4" /> Borrar todo</Button>
      </PageHeader>
      <section className="metric-strip">
        <KPICard label="Registros" value={formatNum(stats.lines)} icon={Database} />
        <KPICard label="Kilos producto" value={formatKg(stats.productKg)} icon={Database} />
        <KPICard label="Base producto" value={formatEur(stats.productRevenue)} icon={Database} />
        <KPICard label="Otros conceptos" value={formatEur(stats.otherRevenue)} icon={Database} />
      </section>
      <SaleFilterPanel rows={rows} filters={filters} onChange={setFilters} />
      <Card className="glass-accented">
        <CardContent className="space-y-4 p-4">
          <PaginationControls page={page.page} pageSize={page.pageSize} pageCount={page.pageCount} total={filtered.length} onPage={page.setPage} onPageSize={page.setPageSize} />
          <DataTable rows={page.pagedRows} columns={[
            { key: "id", header: "ID", cell: (row) => row.id },
            { key: "date", header: "Fecha", cell: (row) => <>{campaignLabel(row.campaign)}<div className="text-xs text-muted-foreground">{row.month ? MONTHS[row.month - 1] : "-"}</div></> },
            { key: "doc", header: "Documento", cell: (row) => row.documento || row.factura || "-" },
            { key: "client", header: "Cliente", cell: (row) => row.clientLabel },
            { key: "product", header: "Producto", cell: (row) => <>{row.product}<div className="text-xs text-muted-foreground">{row.category}</div></> },
            { key: "class", header: "Clasificacion", cell: (row) => <>{row.cls.type}<div className="text-xs text-muted-foreground">{row.cls.subproduct}</div></> },
            { key: "kg", header: "KG", cell: (row) => formatKg(row.kilos), className: "text-right" },
            { key: "price", header: "Precio linea", cell: (row) => formatEur(row.price), className: "text-right" },
            { key: "total", header: "Base IVA", cell: (row) => formatEur(row.base_iva), className: "text-right font-semibold" },
          ]} getRowKey={(row) => row.id} />
        </CardContent>
      </Card>
    </div>
  );
}
