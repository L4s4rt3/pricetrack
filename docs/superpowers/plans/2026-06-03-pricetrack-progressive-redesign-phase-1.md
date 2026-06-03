# PriceTrack Progressive Redesign Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of the progressive redesign: new six-area structure, fast six-month Dashboard, no-load Search area, dark silver WWDC26 visual foundation, and safer logistics decomposition.

**Architecture:** Keep React/Vite, React Router, Supabase, TanStack Query, TanStack Table and existing UI primitives. Move heavy history access behind explicit user choices, use Supabase aggregate views for the Dashboard, and keep legacy routes as redirects while the new information architecture settles.

**Tech Stack:** React 18, Vite, TypeScript, Supabase JS, Postgres views/migrations, TanStack Query, TanStack Table/Virtual, Recharts, Tailwind/shadcn UI.

---

## Scope Check

The approved spec covers several independent subsystems: Dashboard, Search, Clientes 360, Comparativas, Datos/Admin, Logistics and global visual redesign. This plan implements Phase 1 only. Later plans should cover Clientes 360, Comparativas deep history, and Datos/Admin workflows separately.

Phase 1 must produce working software on its own:

- New navigation structure.
- Dashboard that no longer loads all sales rows on first render.
- Search page that loads nothing until the user searches.
- Initial dark/silver visual tokens applied globally.
- Logistics split plan started with shared types/utils or exporters extracted from the oversized page.

## File Structure

- Modify `src/lib/navigation.ts`: six top-level areas and route metadata.
- Modify `src/lib/navigationIcons.ts`: add missing icons for Search and Comparativas.
- Modify `src/lib/pagePreloads.ts`: new page routes and redirects; keep heavy pages out of critical preload.
- Modify `src/App.tsx`: new routes and compatibility redirects from old routes.
- Create `src/pages/Busqueda.tsx`: no-load search UI with text/filter modes.
- Create `src/hooks/useSalesSearch.ts`: server-paginated Supabase search.
- Create `src/hooks/useDashboardSummary.ts`: six-month aggregate Dashboard query.
- Modify `src/pages/Dashboard.tsx`: consume six-month summary instead of `usePrecios()`.
- Create `supabase/migrations/20260603_dashboard_search_phase1.sql`: aggregate dashboard view and search indexes.
- Modify `src/index.css`: dark/silver WWDC26 token foundation.
- Modify `src/lib/chartTheme.tsx`: restrained silver/ice chart palette.
- Create `src/features/logistica/types.ts`: logistics shared types.
- Create `src/features/logistica/pdfExporters.ts`: CMR and route PDF export functions.
- Create `src/features/logistica/excelExporters.ts`: Excel/XML export helpers.
- Modify `src/pages/Logistica.tsx`: import extracted logistics modules without changing UI behavior.
- Modify `scripts/navigation.test.mjs`: assert new six-area IA and redirects.
- Modify `scripts/performance.test.mjs`: assert Dashboard does not import `usePrecios` and Search query is gated.
- Create `scripts/search.test.mjs`: source-level no-load search checks.

---

### Task 1: Navigation IA

**Files:**
- Modify: `src/lib/navigation.ts`
- Modify: `src/lib/navigationIcons.ts`
- Modify: `src/lib/pagePreloads.ts`
- Modify: `src/App.tsx`
- Test: `scripts/navigation.test.mjs`

- [ ] **Step 1: Update navigation test first**

Replace the first test in `scripts/navigation.test.mjs` with:

```js
test("navigation source defines six progressive-redesign areas", () => {
  const source = navigationSource();

  assert.match(source, /export const navigationSections/);
  assert.match(source, /label:\s*"Dashboard"/);
  assert.match(source, /to:\s*"\/logistica"/);
  assert.match(source, /to:\s*"\/busqueda"/);
  assert.match(source, /to:\s*"\/clientes"/);
  assert.match(source, /to:\s*"\/comparativas"/);
  assert.match(source, /to:\s*"\/datos"/);
  assert.doesNotMatch(source, /label:\s*"Comercial"/);
  assert.doesNotMatch(source, /label:\s*"Analisis"/);
});
```

Add a second compatibility test:

```js
test("app keeps legacy routes as redirects during transition", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(app, /path="ventas"[\s\S]*to="\/busqueda"/);
  assert.match(app, /path="productos"[\s\S]*to="\/busqueda"/);
  assert.match(app, /path="tendencias"[\s\S]*to="\/comparativas"/);
  assert.match(app, /path="comparar"[\s\S]*to="\/comparativas"/);
  assert.match(app, /path="predicciones"[\s\S]*to="\/comparativas"/);
});
```

- [ ] **Step 2: Run navigation test and verify failure**

Run:

```bash
npm.cmd run test:navigation
```

Expected: FAIL because `/busqueda` and `/comparativas` are not yet defined.

- [ ] **Step 3: Update `src/lib/navigation.ts`**

Replace the top-level section list with six areas:

```ts
export type NavigationIconId =
  | "dashboard"
  | "logistics"
  | "search"
  | "clients"
  | "compare"
  | "data";

export const navigationSections = [
  {
    to: "/",
    label: "Dashboard",
    subtitle: "Ultimos 6 meses y senales clave",
    icon: "dashboard",
  },
  {
    to: "/logistica",
    label: "Logistica",
    subtitle: "CMR, hojas de ruta, clientes y transportistas",
    icon: "logistics",
  },
  {
    to: "/busqueda",
    label: "Busqueda",
    subtitle: "Consulta por texto o filtros sin cargar historico",
    icon: "search",
  },
  {
    to: "/clientes",
    label: "Clientes",
    subtitle: "Base comercial 360 y evolucion por cliente",
    icon: "clients",
  },
  {
    to: "/comparativas",
    label: "Comparativas",
    subtitle: "Campanas, meses, productos y clientes",
    icon: "compare",
  },
  {
    to: "/datos",
    label: "Datos",
    subtitle: "Importar, modificar, exportar y borrar",
    icon: "data",
  },
] satisfies NavigationItem[];
```

Keep `flattenNavigationItems`, `isNavigationRouteActive` and `findNavigationTrail` unchanged.

- [ ] **Step 4: Update `src/lib/navigationIcons.ts`**

Use lucide icons already installed:

```ts
import { BarChart3, Database, FileSearch, LayoutDashboard, Route, Scale, Users } from "lucide-react";
import type { NavigationIconId } from "./navigation";

export const navigationIcons: Record<NavigationIconId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  logistics: Route,
  search: FileSearch,
  clients: Users,
  compare: Scale,
  data: Database,
};
```

- [ ] **Step 5: Update `src/lib/pagePreloads.ts`**

Add new page imports and keep legacy pages importable only if still routed directly:

```ts
const pageImports = {
  "/": () => import("@/pages/Dashboard"),
  "/logistica": () => import("@/pages/Logistica"),
  "/busqueda": () => import("@/pages/Busqueda"),
  "/clientes": () => import("@/pages/Clientes"),
  "/comparativas": () => import("@/pages/Comparar"),
  "/datos": () => import("@/pages/Datos"),
  "*": () => import("@/pages/NotFound"),
} satisfies Record<string, () => Promise<{ default: ComponentType<unknown> }>>;

export const criticalPagePreloaders = [
  pageImports["/"],
];
```

Keep `preloadPage()` unchanged.

- [ ] **Step 6: Update `src/App.tsx`**

Add lazy import:

```ts
const Busqueda = lazyWithPreload(pageLoaders["/busqueda"]);
const Comparativas = lazyWithPreload(pageLoaders["/comparativas"]);
```

Add routes:

```tsx
<Route path="busqueda" element={<div className="route-page" key="busqueda"><Busqueda /></div>} />
<Route path="comparativas" element={<div className="route-page" key="comparativas"><Comparativas /></div>} />
```

Replace old direct routes with compatibility redirects:

```tsx
<Route path="comercial" element={<Navigate to="/busqueda" replace />} />
<Route path="ventas" element={<Navigate to="/busqueda" replace />} />
<Route path="productos" element={<Navigate to="/busqueda" replace />} />
<Route path="analisis" element={<Navigate to="/comparativas" replace />} />
<Route path="tendencias" element={<Navigate to="/comparativas" replace />} />
<Route path="comparar" element={<Navigate to="/comparativas" replace />} />
<Route path="predicciones" element={<Navigate to="/comparativas" replace />} />
<Route path="confeccion" element={<Navigate to="/clientes" replace />} />
```

- [ ] **Step 7: Run navigation test**

Run:

```bash
npm.cmd run test:navigation
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/navigation.ts src/lib/navigationIcons.ts src/lib/pagePreloads.ts src/App.tsx scripts/navigation.test.mjs
git commit -m "Restructure navigation for progressive redesign"
```

---

### Task 2: Dashboard Six-Month Aggregate Data

**Files:**
- Create: `supabase/migrations/20260603_dashboard_search_phase1.sql`
- Create: `src/hooks/useDashboardSummary.ts`
- Modify: `src/pages/Dashboard.tsx`
- Test: `scripts/performance.test.mjs`

- [ ] **Step 1: Add performance guard test**

Append to `scripts/performance.test.mjs`:

```js
test("dashboard uses aggregate summary hook instead of full precios rows", () => {
  const dashboard = readFileSync(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(dashboard, /usePrecios\(/);
  assert.match(dashboard, /useDashboardSummary\(/);
});
```

- [ ] **Step 2: Run performance test and verify failure**

Run:

```bash
npm.cmd run test:performance
```

Expected: FAIL because Dashboard still calls `usePrecios()`.

- [ ] **Step 3: Create Supabase aggregate view**

Create `supabase/migrations/20260603_dashboard_search_phase1.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_precios_cliente_trgm
  ON public.precios USING gin (cliente gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_precios_denominacion_social_trgm
  ON public.precios USING gin (denominacion_social gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_precios_documento_trgm
  ON public.precios USING gin (documento gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_precios_factura_trgm
  ON public.precios USING gin (factura gin_trgm_ops);

CREATE OR REPLACE VIEW public.precios_dashboard_mensual
WITH (security_invoker = on) AS
SELECT
  make_date(ano, COALESCE(NULLIF(mes, 0), 1), 1) AS month_start,
  ano,
  mes,
  count(*)::integer AS lineas,
  count(DISTINCT COALESCE(NULLIF(denominacion_social, ''), NULLIF(cliente, '')))::integer AS clientes,
  count(DISTINCT NULLIF(producto, ''))::integer AS productos,
  COALESCE(sum(kilos), 0)::numeric(14, 2) AS kilos,
  COALESCE(sum(base_iva), 0)::numeric(14, 2) AS facturacion,
  CASE
    WHEN COALESCE(sum(kilos), 0) > 0 THEN (COALESCE(sum(base_iva), 0) / NULLIF(sum(kilos), 0))::numeric(12, 4)
    ELSE avg(precio)::numeric(12, 4)
  END AS precio_medio,
  max(created_at) AS refreshed_at
FROM public.precios
WHERE ano IS NOT NULL
GROUP BY ano, mes;
```

- [ ] **Step 4: Create `src/hooks/useDashboardSummary.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LONG_LIVED_QUERY_OPTIONS } from "@/lib/persistentQueryCache";

export interface DashboardMonthSummary {
  month_start: string;
  ano: number;
  mes: number | null;
  lineas: number;
  clientes: number;
  productos: number;
  kilos: number;
  facturacion: number;
  precio_medio: number;
  refreshed_at: string | null;
}

export const dashboardSummaryQueryKey = ["dashboard-summary", "last-6-months"] as const;

async function fetchDashboardSummary() {
  const { data, error } = await supabase
    .from("precios_dashboard_mensual")
    .select("month_start,ano,mes,lineas,clientes,productos,kilos,facturacion,precio_medio,refreshed_at")
    .order("month_start", { ascending: false })
    .limit(6);

  if (error) throw error;

  return [...(data ?? [])]
    .reverse()
    .map((row) => ({
      month_start: String(row.month_start),
      ano: Number(row.ano),
      mes: row.mes === null || row.mes === undefined ? null : Number(row.mes),
      lineas: Number(row.lineas ?? 0),
      clientes: Number(row.clientes ?? 0),
      productos: Number(row.productos ?? 0),
      kilos: Number(row.kilos ?? 0),
      facturacion: Number(row.facturacion ?? 0),
      precio_medio: Number(row.precio_medio ?? 0),
      refreshed_at: row.refreshed_at ? String(row.refreshed_at) : null,
    })) satisfies DashboardMonthSummary[];
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryQueryKey,
    queryFn: fetchDashboardSummary,
    ...LONG_LIVED_QUERY_OPTIONS,
  });
}
```

- [ ] **Step 5: Rewrite Dashboard to use the summary hook**

In `src/pages/Dashboard.tsx`, remove `usePrecios`, `SaleFilterPanel`, `filterSales`, `productPriceRows`, `summaryStats`, and campaign selection logic. Import:

```ts
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
```

Use:

```ts
const { data = [], isLoading } = useDashboardSummary();
const latest = data[data.length - 1];
const totals = data.reduce(
  (acc, row) => ({
    lineas: acc.lineas + row.lineas,
    kilos: acc.kilos + row.kilos,
    facturacion: acc.facturacion + row.facturacion,
    clientes: Math.max(acc.clientes, row.clientes),
  }),
  { lineas: 0, kilos: 0, facturacion: 0, clientes: 0 },
);
const chartRows = data.map((row) => ({
  label: row.mes ? `${String(row.mes).padStart(2, "0")}/${String(row.ano).slice(-2)}` : String(row.ano),
  facturacion: row.facturacion,
  kilos: row.kilos,
  precio: row.precio_medio,
}));
```

Add the history action:

```tsx
<Button variant="outline" asChild>
  <Link to="/busqueda?mode=filters">Ampliar historico</Link>
</Button>
```

- [ ] **Step 6: Run build and performance tests**

Run:

```bash
npm.cmd run build
npm.cmd run test:performance
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260603_dashboard_search_phase1.sql src/hooks/useDashboardSummary.ts src/pages/Dashboard.tsx scripts/performance.test.mjs
git commit -m "Load dashboard from six month aggregate summary"
```

---

### Task 3: No-Load Search Page

**Files:**
- Create: `src/hooks/useSalesSearch.ts`
- Create: `src/pages/Busqueda.tsx`
- Create: `scripts/search.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add source test for no-load behavior**

Create `scripts/search.test.mjs`:

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const hookUrl = new URL("../src/hooks/useSalesSearch.ts", import.meta.url);
const pageUrl = new URL("../src/pages/Busqueda.tsx", import.meta.url);

test("search hook is disabled until criteria exists", () => {
  assert.equal(existsSync(hookUrl), true, "src/hooks/useSalesSearch.ts should exist");
  const source = readFileSync(hookUrl, "utf8");

  assert.match(source, /enabled:\s*hasCriteria/);
  assert.match(source, /\.range\(from,\s*to\)/);
  assert.match(source, /\.limit\(/);
});

test("search page does not use usePrecios full dataset hook", () => {
  assert.equal(existsSync(pageUrl), true, "src/pages/Busqueda.tsx should exist");
  const source = readFileSync(pageUrl, "utf8");

  assert.doesNotMatch(source, /usePrecios\(/);
  assert.match(source, /useSalesSearch\(/);
});
```

Add script to `package.json`:

```json
"test:search": "node --test scripts/search.test.mjs"
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm.cmd run test:search
```

Expected: FAIL because files do not exist yet.

- [ ] **Step 3: Create `src/hooks/useSalesSearch.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRECIOS_SELECT } from "@/lib/campaigns";
import type { PrecioRow } from "@/lib/types";

export interface SalesSearchFilters {
  text: string;
  campaign: string;
  month: string;
  client: string;
  product: string;
}

export interface SalesSearchParams {
  filters: SalesSearchFilters;
  page: number;
  pageSize: number;
}

function hasSearchCriteria(filters: SalesSearchFilters) {
  return Boolean(filters.text.trim() || filters.campaign || filters.month || filters.client || filters.product);
}

function normalizeSearchRow(row: Record<string, unknown>): PrecioRow {
  return {
    id: row.id as number,
    product: (row.producto as string) || "",
    category: (row.categoria as string) || "Sin categoria",
    price: Number(row.precio ?? 0),
    unit: (row.unidad as string) || "kg",
    year: Number(row.ano ?? new Date().getFullYear()),
    month: (row.mes as number) || null,
    notes: (row.notas as string) || "",
    cliente: (row.cliente as string) || "",
    denominacion_social: (row.denominacion_social as string) || "",
    referencia: (row.referencia as string) || "",
    kilos: Number(row.kilos ?? 0),
    unidades: Number(row.unidades ?? 0),
    litros: Number(row.litros ?? 0),
    tarifa: Number(row.tarifa ?? 0),
    coste_adic: Number(row.coste_adic ?? 0),
    base_iva: Number(row.base_iva ?? 0),
    documento: (row.documento as string) || "",
    factura: (row.factura as string) || "",
    fecha_fra: (row.fecha_fra as string) || "",
    lin: Number(row.lin ?? 0),
    created_at: (row.created_at as string) || "",
  };
}

async function fetchSalesSearch({ filters, page, pageSize }: SalesSearchParams) {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  let query = supabase
    .from("precios")
    .select(PRECIOS_SELECT, { count: "exact" })
    .order("ano", { ascending: false })
    .order("mes", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, to)
    .limit(pageSize);

  const text = filters.text.trim();
  if (text) {
    const escaped = text.replace(/[%_]/g, "\\$&");
    query = query.or([
      `producto.ilike.%${escaped}%`,
      `categoria.ilike.%${escaped}%`,
      `cliente.ilike.%${escaped}%`,
      `denominacion_social.ilike.%${escaped}%`,
      `documento.ilike.%${escaped}%`,
      `factura.ilike.%${escaped}%`,
      `referencia.ilike.%${escaped}%`,
    ].join(","));
  }

  if (filters.campaign) query = query.eq("ano", Number(filters.campaign));
  if (filters.month) query = query.eq("mes", Number(filters.month));
  if (filters.client) query = query.ilike("denominacion_social", `%${filters.client}%`);
  if (filters.product) query = query.ilike("producto", `%${filters.product}%`);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map(normalizeSearchRow),
    total: count ?? 0,
  };
}

export function useSalesSearch(params: SalesSearchParams) {
  const hasCriteria = hasSearchCriteria(params.filters);
  return useQuery({
    queryKey: ["sales-search", params],
    queryFn: () => fetchSalesSearch(params),
    enabled: hasCriteria,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
```

- [ ] **Step 4: Create `src/pages/Busqueda.tsx`**

Implement a page with two modes and no initial load:

```tsx
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSalesSearch, type SalesSearchFilters } from "@/hooks/useSalesSearch";
import { formatEur, formatKg, formatNum, MONTHS } from "@/lib/format";

const initialFilters: SalesSearchFilters = {
  text: "",
  campaign: "",
  month: "",
  client: "",
  product: "",
};

export default function Busqueda() {
  const [mode, setMode] = useState("text");
  const [filters, setFilters] = useState(initialFilters);
  const [submitted, setSubmitted] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const search = useSalesSearch({ filters: submitted, page, pageSize });
  const pageCount = Math.max(1, Math.ceil((search.data?.total ?? 0) / pageSize));
  const hasSubmitted = useMemo(() => Object.values(submitted).some((value) => value.trim()), [submitted]);

  const submit = () => {
    setPage(1);
    setSubmitted(filters);
  };

  return (
    <div className="page-shell">
      <PageHeader title="Busqueda" subtitle="Busca por texto o filtra antes de cargar datos">
        <Button onClick={submit} className="gap-2"><Search className="h-4 w-4" /> Buscar</Button>
      </PageHeader>
      <Card className="glass-accented">
        <CardContent className="space-y-4 p-4">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="glass-strong">
              <TabsTrigger value="text">Texto</TabsTrigger>
              <TabsTrigger value="filters">Filtros</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "text" ? (
            <Input value={filters.text} onChange={(event) => setFilters((current) => ({ ...current, text: event.target.value }))} placeholder="Cliente, producto, factura, documento, referencia..." />
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <Input value={filters.campaign} onChange={(event) => setFilters((current) => ({ ...current, campaign: event.target.value }))} placeholder="Ano" />
              <Input value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} placeholder="Mes" />
              <Input value={filters.client} onChange={(event) => setFilters((current) => ({ ...current, client: event.target.value }))} placeholder="Cliente" />
              <Input value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))} placeholder="Producto" />
            </div>
          )}
        </CardContent>
      </Card>
      {!hasSubmitted ? (
        <div className="empty-state py-16">Elige texto o filtros y pulsa Buscar. No se carga historico hasta que lo pidas.</div>
      ) : (
        <Card className="glass-accented">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{search.isFetching ? "Buscando..." : `${formatNum(search.data?.total ?? 0)} resultados`}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Siguiente</Button>
              </div>
            </div>
            <DataTable rows={search.data?.rows ?? []} getRowKey={(row) => row.id} columns={[
              { key: "date", header: "Fecha", cell: (row) => <>{row.year}<div className="text-xs text-muted-foreground">{row.month ? MONTHS[row.month - 1] : "-"}</div></> },
              { key: "document", header: "Documento", cell: (row) => row.documento || row.factura || "-" },
              { key: "client", header: "Cliente", cell: (row) => row.denominacion_social || row.cliente || "-" },
              { key: "product", header: "Producto", cell: (row) => <>{row.product}<div className="text-xs text-muted-foreground">{row.category}</div></> },
              { key: "kg", header: "KG", cell: (row) => formatKg(row.kilos), className: "text-right" },
              { key: "price", header: "Precio", cell: (row) => formatEur(row.price), className: "text-right" },
              { key: "total", header: "Base IVA", cell: (row) => formatEur(row.base_iva), className: "text-right font-semibold" },
            ]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run build and search test**

Run:

```bash
npm.cmd run build
npm.cmd run test:search
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/search.test.mjs src/hooks/useSalesSearch.ts src/pages/Busqueda.tsx
git commit -m "Add no-load sales search page"
```

---

### Task 4: Dark Silver WWDC26 Visual Foundation

**Files:**
- Modify: `src/index.css`
- Modify: `src/lib/chartTheme.tsx`
- Test: `npm.cmd run build`

- [ ] **Step 1: Add a visual token block in `src/index.css`**

Update the `:root` and dark theme variables to make dark mode the premium target. Add or replace these custom values near existing glass variables:

```css
:root {
  --metal-bg: 220 18% 3%;
  --metal-bg-soft: 220 14% 6%;
  --metal-surface: 220 10% 10%;
  --metal-surface-strong: 220 8% 15%;
  --metal-border: 220 10% 28%;
  --metal-silver: 220 12% 78%;
  --metal-silver-bright: 210 30% 94%;
  --metal-ice: 208 100% 78%;
  --metal-amber: 36 100% 72%;
  --glass-bg: 220 10% 10% / 0.58;
  --glass-bg-strong: 220 8% 15% / 0.72;
  --glass-border: 220 12% 70% / 0.16;
  --glass-border-accent: 208 100% 78% / 0.38;
  --glass-shadow: 0 22px 70px hsl(220 30% 2% / 0.52);
}

.dark {
  --background: var(--metal-bg);
  --foreground: var(--metal-silver-bright);
  --card: var(--metal-surface);
  --card-foreground: var(--metal-silver-bright);
  --muted: var(--metal-surface-strong);
  --muted-foreground: var(--metal-silver);
  --primary: var(--metal-ice);
  --primary-foreground: 220 18% 4%;
  --border: var(--metal-border);
  --ring: var(--metal-ice);
}
```

- [ ] **Step 2: Reduce colorful chart palette in `src/lib/chartTheme.tsx`**

Use a silver-first palette:

```ts
export const C = {
  primary: "hsl(208 100% 78%)",
  silver: "hsl(220 12% 78%)",
  white: "hsl(210 30% 94%)",
  amber: "hsl(36 100% 72%)",
  success: "hsl(150 45% 62%)",
  info: "hsl(208 100% 78%)",
  orange: "hsl(36 100% 72%)",
  purple: "hsl(250 28% 72%)",
  muted: "hsl(220 10% 46%)",
};
```

Keep existing exported constants so pages do not break.

- [ ] **Step 3: Run build**

Run:

```bash
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/lib/chartTheme.tsx
git commit -m "Apply dark silver visual foundation"
```

---

### Task 5: Logistics Module Extraction

**Files:**
- Create: `src/features/logistica/types.ts`
- Create: `src/features/logistica/formatters.ts`
- Create: `src/features/logistica/pdfExporters.ts`
- Create: `src/features/logistica/excelExporters.ts`
- Modify: `src/pages/Logistica.tsx`
- Test: `npm.cmd run build`

- [ ] **Step 1: Create shared logistics types**

Move `LogisticsPreset`, `LogisticsTemplateRow`, `CmrClient`, `CmrCarrier`, `TripFields`, and `DocumentKind` to `src/features/logistica/types.ts`:

```ts
export interface LogisticsPreset {
  id?: string;
  preset_key: string;
  name: string;
  sender: string;
  consignee: string;
  carrier: string;
  load_place: string;
  load_country: string;
  delivery_place: string;
  delivery_country: string;
  default_goods: string;
  default_instructions: string;
  source_files?: string[];
}

export interface LogisticsTemplateRow {
  kind: "route" | "cmr";
  name: string;
  original_path: string | null;
  storage_path: string;
}

export interface CmrClient {
  client_key: string;
  name: string;
  consignee: string;
  transitario: string;
  country: string;
  default_goods: string;
  is_edeka: boolean;
  occurrences: number;
}

export interface CmrCarrier {
  carrier_key: string;
  name: string;
  details: string;
  country: string;
  occurrences: number;
}

export interface TripFields {
  numeroCarta: string;
  fechaCarga: string;
  fechaDescarga: string;
  horaCarga: string;
  horaDescarga: string;
  routeOperator: string;
  routeCarrierName: string;
  vehiclePlate: string;
  routeDescription: string;
  instructions: string;
  successiveCarriersEnabled: boolean;
  successiveCarriers: string;
  carrierReservations: string;
  documents: string;
  goodsLine: string;
  bultos: string;
  mercancia: string;
  peso: string;
  volume: string;
  specialAgreements: string;
  usefulParticulars17: string;
  nonContractual18: string;
  cashOnDelivery19: string;
  consigneeReceipt24: string;
  tractora: string;
  remolque: string;
  conductor: string;
  documento1: string;
  documento2: string;
  observaciones: string;
}

export type DocumentKind = "route" | "cmr";
```

- [ ] **Step 2: Create `src/features/logistica/formatters.ts`**

Move shared pure helpers:

```ts
import type { LogisticsPreset, TripFields } from "./types";

export function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-/g, "_") || "manual";
}

export function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function splitLines(value: string, max = 4) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function buildGoodsLine(trip: TripFields) {
  return trip.goodsLine || [trip.documento1, trip.bultos, trip.mercancia].filter(Boolean).join("   ");
}

export function routeDestination(preset: LogisticsPreset) {
  return [preset.delivery_place, preset.delivery_country].filter(Boolean).join(" - ");
}

export function routeMerchandiseDescription(trip: TripFields) {
  return trip.routeDescription || [trip.bultos, trip.mercancia].filter(Boolean).join(" ");
}
```

- [ ] **Step 3: Extract PDF exporters**

Move `generateExactCmrPdf`, `generateExactRoutePdf`, and `wrapPdfLines` to `src/features/logistica/pdfExporters.ts`. Export:

```ts
export async function generateExactCmrPdf(preset: LogisticsPreset, trip: TripFields, company: string) {
  // Move the full current generateExactCmrPdf implementation from src/pages/Logistica.tsx here.
  // Replace references to CMR_COMPANY with the company argument.
}

export async function generateExactRoutePdf(preset: LogisticsPreset, trip: TripFields) {
  // Move the full current generateExactRoutePdf implementation from src/pages/Logistica.tsx here unchanged.
}
```

Use imports:

```ts
import type { LogisticsPreset, TripFields } from "./types";
import { buildGoodsLine, formatDate, routeDestination, routeMerchandiseDescription, splitLines } from "./formatters";
```

- [ ] **Step 4: Extract Excel exporter**

Move `worksheetXml`, `escapeXml`, and `escapeHtml` if needed to `src/features/logistica/excelExporters.ts`. Export:

```ts
export function worksheetXml(kind: DocumentKind, preset: LogisticsPreset, trip: TripFields) {
  // Move the full current worksheetXml implementation from src/pages/Logistica.tsx here unchanged.
}
```

- [ ] **Step 5: Update `src/pages/Logistica.tsx` imports**

Remove local interface declarations and exporter functions. Add:

```ts
import type { CmrCarrier, CmrClient, DocumentKind, LogisticsPreset, LogisticsTemplateRow, TripFields } from "@/features/logistica/types";
import { formatDate, safeFilename } from "@/features/logistica/formatters";
import { generateExactCmrPdf, generateExactRoutePdf } from "@/features/logistica/pdfExporters";
import { worksheetXml } from "@/features/logistica/excelExporters";
```

Update the CMR PDF call:

```ts
const pdfBytes = await generateExactCmrPdf(fixed, trip, CMR_COMPANY);
```

- [ ] **Step 6: Run build**

Run:

```bash
npm.cmd run build
```

Expected: PASS and no logistics behavior changes.

- [ ] **Step 7: Commit**

```bash
git add src/features/logistica src/pages/Logistica.tsx
git commit -m "Split logistics helpers into focused modules"
```

---

### Task 6: Full Phase 1 Verification

**Files:**
- No source changes unless verification fails.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm.cmd run build
npm.cmd run test:navigation
npm.cmd run test:performance
npm.cmd run test:search
```

Expected: all PASS.

- [ ] **Step 2: Browser QA if available**

If Browser/IAB works, verify:

```text
The flow under test is: / -> Dashboard renders 6-month aggregate -> click Ampliar historico -> /busqueda opens -> page shows no-load empty state -> text search submits results.
```

Required checks:

- Page identity for `/`.
- Page identity for `/busqueda`.
- No blank shell.
- No Vite/framework overlay.
- Console has no relevant errors.
- Search empty state is visible before submitting.
- Search table appears only after submitting criteria.

- [ ] **Step 3: Fallback QA if Browser/IAB fails**

If Browser/IAB fails with the known Windows sandbox issue, run:

```bash
npm.cmd run build
```

Then state in the final handoff:

```text
Browser/IAB QA was blocked by the Windows sandbox issue. Automated build and source-level tests passed.
```

- [ ] **Step 4: Commit any verification fixes**

If fixes were required:

```bash
git add <changed-files>
git commit -m "Fix phase 1 redesign verification issues"
```

If no fixes were required, do not create an empty commit.

---

## Plan Self-Review

Spec coverage:

- Dashboard 6 months: Task 2.
- Ampliar historico asks first: Task 2 links to `/busqueda?mode=filters`; Task 3 no-load search implements criteria-first querying.
- Six navigation areas: Task 1.
- Search without initial load: Task 3.
- Dark/silver WWDC26 style: Task 4.
- Logistics separation: Task 5.
- Server pagination and indexes: Tasks 2 and 3.
- Phase execution and verification: Task 6.

Deferred to later plans:

- Full Clientes 360 detail.
- Deep Comparativas redesign beyond route consolidation.
- Datos/Admin import/edit/export/delete redesign.
- EDEKA special logistics flow.

Placeholder scan:

- This plan intentionally does not use TBD/TODO placeholders.
- Later-phase work is explicitly marked as deferred, not left ambiguous inside Phase 1.

Type consistency:

- `SalesSearchFilters`, `SalesSearchParams`, `DashboardMonthSummary`, `LogisticsPreset`, `TripFields` and `DocumentKind` are defined before use.
- New route names are consistently `/busqueda` and `/comparativas`.
