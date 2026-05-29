import { useMemo, useState } from "react";
import { Download, Package, Table2, TreePine } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { FilterField, FilterPanel } from "@/components/FilterPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfeccion } from "@/hooks/useConfeccion";
import { formatEur, formatKg, formatNum } from "@/lib/format";
import { PaginationControls, SelectFilter, usePagination } from "./pageHelpers";

export default function Confeccion() {
  const { data, isLoading } = useConfeccion();
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const [situacion, setSituacion] = useState("");
  const [producto, setProducto] = useState("");
  const [cliente, setCliente] = useState("");
  const [variedad, setVariedad] = useState("");
  const [calibre, setCalibre] = useState("");
  const [tipoCaja, setTipoCaja] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showTree, setShowTree] = useState(false);
  const rows = data ?? [];
  const optionSets = useMemo(
    () => ({
      tipos: Array.from(new Set(rows.map((row) => row.tipo).filter(Boolean))).sort(),
      clientes: Array.from(new Set(rows.map((row) => row.cliente_nombre || row.denominacion_social).filter(Boolean))).sort(),
      productos: Array.from(new Set(rows.map((row) => row.producto_base).filter(Boolean))).sort(),
      variedades: Array.from(new Set(rows.map((row) => row.variedad).filter(Boolean))).sort(),
      calibres: Array.from(new Set(rows.map((row) => row.calibre).filter(Boolean))).sort(),
      cajas: Array.from(new Set(rows.map((row) => row.tipo_caja).filter(Boolean))).sort(),
      situaciones: Array.from(new Set(rows.map((row) => row.situacion).filter(Boolean))).sort(),
    }),
    [rows]
  );
  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = [row.n_palet, row.tipo, row.producto_confeccionado, row.producto_base, row.variedad, row.calibre, row.tipo_caja, row.cliente_nombre, row.denominacion_social, row.situacion].join(" ").toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (tipo && row.tipo !== tipo) return false;
    if (situacion && row.situacion !== situacion) return false;
    if (producto && row.producto_base !== producto) return false;
    if (cliente && (row.cliente_nombre || row.denominacion_social) !== cliente) return false;
    if (variedad && row.variedad !== variedad) return false;
    if (calibre && row.calibre !== calibre) return false;
    if (tipoCaja && row.tipo_caja !== tipoCaja) return false;
    if (desde && row.fecha < desde) return false;
    if (hasta && row.fecha > hasta) return false;
    return true;
  }), [rows, search, tipo, situacion, producto, cliente, variedad, calibre, tipoCaja, desde, hasta]);
  const page = usePagination(filtered, 50);
  const kg = filtered.reduce((s, row) => s + row.kg_netos, 0);
  const revenue = filtered.reduce((s, row) => s + (row.pvp_total || row.kg_netos * row.pvp_kg), 0);
  const tree = Array.from(filtered.reduce((map, row) => {
    const product = row.producto_base || "Sin producto";
    const variety = row.variedad || "Sin variedad";
    const current = map.get(product) ?? new Map<string, number>();
    current.set(variety, (current.get(variety) ?? 0) + row.kg_netos);
    map.set(product, current);
    return map;
  }, new Map<string, Map<string, number>>()).entries());

  const exportCsv = () => {
    const header = ["palet", "tipo", "producto", "variedad", "calibre", "cliente", "kg", "pvp_kg", "total", "situacion", "fecha"];
    const body = filtered.map((row) => [row.n_palet, row.tipo, row.producto_confeccionado, row.variedad, row.calibre, row.cliente_nombre, row.kg_netos, row.pvp_kg, row.pvp_total, row.situacion, row.fecha]);
    const csv = [header, ...body].map((line) => line.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "confeccion.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="page-shell">
      <PageHeader title="Confeccion" subtitle="Produccion confeccionada, clientes, formatos y situacion" />
      <section className="metric-strip">
        <KPICard label="Registros" value={formatNum(filtered.length)} icon={Table2} />
        <KPICard label="KG netos" value={formatKg(kg)} icon={Package} />
        <KPICard label="Valor" value={formatEur(revenue)} icon={Package} />
      </section>
      <FilterPanel title="Filtros" meta={`${formatNum(rows.length)} lineas`}>
        <FilterField label="Busqueda"><Input value={search} onChange={(event) => setSearch(event.target.value)} /></FilterField>
        <SelectFilter label="Tipo" value={tipo} options={optionSets.tipos} onChange={setTipo} />
        <SelectFilter label="Cliente" value={cliente} options={optionSets.clientes} onChange={setCliente} />
        <SelectFilter label="Producto" value={producto} options={optionSets.productos} onChange={setProducto} />
        <SelectFilter label="Variedad" value={variedad} options={optionSets.variedades} onChange={setVariedad} />
        <SelectFilter label="Calibre" value={calibre} options={optionSets.calibres} onChange={setCalibre} />
        <SelectFilter label="Tipo caja" value={tipoCaja} options={optionSets.cajas} onChange={setTipoCaja} />
        <SelectFilter label="Situacion" value={situacion} options={optionSets.situaciones} onChange={setSituacion} />
        <FilterField label="Desde"><Input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} /></FilterField>
        <FilterField label="Hasta"><Input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} /></FilterField>
        <Button variant="outline" className="gap-2" onClick={() => setShowTree((v) => !v)}><TreePine className="h-4 w-4" /> Arbol</Button>
        <Button className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar CSV</Button>
      </FilterPanel>
      {showTree && (
        <Card className="glass-accented">
          <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {tree.map(([productName, varieties]) => (
              <div key={productName} className="glass-strong rounded-xl p-3">
                <p className="font-semibold">{productName}</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {Array.from(varieties.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => (
                    <div key={name} className="flex justify-between gap-3"><span>{name}</span><span>{formatKg(value)}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card className="glass-accented">
        <CardContent className="space-y-4 p-4">
          <PaginationControls page={page.page} pageSize={page.pageSize} pageCount={page.pageCount} total={filtered.length} onPage={page.setPage} onPageSize={page.setPageSize} />
          <DataTable
            rows={page.pagedRows}
            getRowKey={(row) => row.id}
            columns={[
              { key: "palet", header: "Palet", cell: (row) => row.n_palet || "-" },
              { key: "product", header: "Producto", cell: (row) => <>{row.producto_confeccionado}<div className="text-xs text-muted-foreground">{row.variedad} · {row.calibre} · {row.tipo_caja}</div></> },
              { key: "client", header: "Cliente", cell: (row) => row.cliente_nombre || row.denominacion_social || "-" },
              { key: "kg", header: "KG", cell: (row) => formatKg(row.kg_netos), className: "text-right" },
              { key: "price", header: "PVP/kg", cell: (row) => formatEur(row.pvp_kg), className: "text-right" },
              { key: "total", header: "Total", cell: (row) => formatEur(row.pvp_total), className: "text-right font-semibold" },
              { key: "status", header: "Situacion", cell: (row) => row.situacion || "-" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
