import { FormEvent, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasSearchCriteria, useSalesSearch, type SalesSearchFilters } from "@/hooks/useSalesSearch";
import { campaignLabel, formatEur, formatKg, formatNum, MONTHS } from "@/lib/format";

const emptyFilters: SalesSearchFilters = {
  text: "",
  campaign: "",
  month: "",
  client: "",
  product: "",
};

const pageSize = 50;

export default function Busqueda() {
  const [mode, setMode] = useState("text");
  const [draftFilters, setDraftFilters] = useState<SalesSearchFilters>(emptyFilters);
  const [submittedFilters, setSubmittedFilters] = useState<SalesSearchFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const hasSubmittedCriteria = hasSearchCriteria(submittedFilters);
  const search = useSalesSearch({ filters: submittedFilters, page, pageSize });
  const rows = search.data?.rows ?? [];
  const total = search.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const errorMessage = search.isError
    ? search.error instanceof Error
      ? search.error.message
      : "No se pudo completar la busqueda."
    : "";

  const columns = useMemo(
    () => [
      {
        key: "date",
        header: "Fecha",
        cell: (row: (typeof rows)[number]) => (
          <>
            {campaignLabel(row.year)}
            <div className="text-xs text-muted-foreground">{row.month ? MONTHS[row.month - 1] : "Sin mes"}</div>
          </>
        ),
      },
      {
        key: "document",
        header: "Documento",
        cell: (row: (typeof rows)[number]) => (
          <>
            {row.documento || row.factura || "-"}
            <div className="text-xs text-muted-foreground">Lin. {row.lin || "-"}</div>
          </>
        ),
      },
      {
        key: "client",
        header: "Cliente",
        cell: (row: (typeof rows)[number]) => row.denominacion_social || row.cliente || "-",
      },
      {
        key: "product",
        header: "Producto",
        cell: (row: (typeof rows)[number]) => (
          <>
            {row.product || "-"}
            <div className="max-w-sm text-xs text-muted-foreground">{row.category || row.referencia || "-"}</div>
          </>
        ),
      },
      { key: "kg", header: "Kg", cell: (row: (typeof rows)[number]) => formatKg(row.kilos), className: "text-right" },
      { key: "price", header: "Precio", cell: (row: (typeof rows)[number]) => `${formatEur(row.price)}/kg`, className: "text-right" },
      { key: "total", header: "Total", cell: (row: (typeof rows)[number]) => formatEur(row.base_iva), className: "text-right font-semibold" },
    ],
    [rows]
  );

  const setFilter = (key: keyof SalesSearchFilters, value: string) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedFilters({ ...draftFilters });
    setPage(1);
  };

  return (
    <div className="page-shell">
      <PageHeader title="Busqueda" subtitle="Busca ventas bajo demanda sin cargar el historico completo" />

      <Card className="glass-accented">
        <CardContent className="space-y-4 p-4">
          <form className="space-y-4" onSubmit={submit}>
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList>
                <TabsTrigger value="text">Texto</TabsTrigger>
                <TabsTrigger value="filters">Filtros</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={draftFilters.text}
                    placeholder="Producto, cliente, documento, factura o referencia"
                    onChange={(event) => setFilter("text", event.target.value)}
                  />
                </div>
              </TabsContent>
              <TabsContent value="filters" className="mt-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Input value={draftFilters.campaign} placeholder="Campana, ej. 2025" inputMode="numeric" onChange={(event) => setFilter("campaign", event.target.value)} />
                  <Input value={draftFilters.month} placeholder="Mes, 1-12" inputMode="numeric" onChange={(event) => setFilter("month", event.target.value)} />
                  <Input value={draftFilters.client} placeholder="Cliente" onChange={(event) => setFilter("client", event.target.value)} />
                  <Input value={draftFilters.product} placeholder="Producto" onChange={(event) => setFilter("product", event.target.value)} />
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
              <Button type="button" variant="outline" onClick={() => { setDraftFilters(emptyFilters); setSubmittedFilters(emptyFilters); setPage(1); }}>
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-accented">
        <CardContent className="space-y-4 p-4">
          {!hasSubmittedCriteria ? (
            <div className="rounded-[8px] border border-dashed border-[hsl(var(--glass-border))] px-4 py-10 text-center text-sm text-muted-foreground">
              Elige texto o filtros y pulsa Buscar. No se carga historico hasta que lo pidas.
            </div>
          ) : search.isError ? (
            <div className="rounded-[8px] border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  {search.isFetching ? "Buscando..." : `${formatNum(total)} resultados`} · Pagina {page} de {pageCount}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || search.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= pageCount || search.isFetching} onClick={() => setPage((current) => current + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
              <DataTable rows={rows} getRowKey={(row) => row.id} columns={columns} empty={search.isFetching ? "Buscando..." : "Sin resultados"} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
