# Navigation Fluidity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compact sidebar navigation with expandable area subpages while keeping the existing PriceTrack visual language.

**Architecture:** Navigation metadata will live in a pure TypeScript module that does not import React, making route matching and menu shape easy to test. React components will consume that metadata and map icon ids to lucide icons at the presentation layer. The existing shadcn sidebar, command palette, route preloading and topbar will share the same navigation source.

**Tech Stack:** React 18, TypeScript, react-router-dom v7, shadcn/Radix Collapsible, lucide-react, Vite, Node built-in test runner for lightweight structure tests.

---

## File Structure

- Create `src/lib/navigation.ts`: source of truth for areas, subpages, route matching, flattening and breadcrumbs.
- Create `scripts/navigation.test.mjs`: lightweight Node test that validates the navigation source before implementation and protects future edits.
- Modify `src/components/AppLayout.tsx`: render compact area navigation with collapsible subpages.
- Modify `src/components/TopBar.tsx`: resolve breadcrumb/title/subtitle from shared navigation metadata.
- Modify `src/components/CommandPalette.tsx`: list command items from shared navigation metadata.
- Modify `src/index.css`: add scoped sidebar subnavigation styles.
- Modify `package.json`: add `test:navigation` script.

## Task 1: Navigation Metadata And Tests

**Files:**
- Create: `src/lib/navigation.ts`
- Create: `scripts/navigation.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the failing navigation structure test**

Create `scripts/navigation.test.mjs` with this content:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/lib/navigation.ts", import.meta.url), "utf8");

function routeBlock(route) {
  const escaped = route.replace("/", "\\/");
  const pattern = new RegExp(`to:\\s*"${escaped}"[\\s\\S]*?(?=\\n\\s*\\{|\\n\\s*\\]|\\n\\s*\\},)`);
  return source.match(pattern)?.[0] ?? "";
}

test("navigation source defines compact areas with expected subpages", () => {
  assert.match(source, /export const navigationSections/);
  assert.match(routeBlock("/comercial"), /children:/);
  assert.match(routeBlock("/comercial"), /to:\s*"\/ventas"/);
  assert.match(routeBlock("/comercial"), /to:\s*"\/productos"/);
  assert.match(routeBlock("/comercial"), /to:\s*"\/clientes"/);
  assert.match(routeBlock("/analisis"), /children:/);
  assert.match(routeBlock("/analisis"), /to:\s*"\/tendencias"/);
  assert.match(routeBlock("/analisis"), /to:\s*"\/comparar"/);
  assert.match(routeBlock("/analisis"), /to:\s*"\/predicciones"/);
});

test("navigation source exposes helpers used by layout, topbar and command palette", () => {
  assert.match(source, /export function flattenNavigationItems/);
  assert.match(source, /export function findNavigationTrail/);
  assert.match(source, /export function isNavigationRouteActive/);
});
```

- [ ] **Step 2: Add the npm script**

Add this script to `package.json`:

```json
"test:navigation": "node --test scripts/navigation.test.mjs"
```

- [ ] **Step 3: Run the test and verify RED**

Run: `npm run test:navigation`

Expected: FAIL because `src/lib/navigation.ts` does not exist yet or does not export the required metadata/helpers.

- [ ] **Step 4: Implement the pure navigation module**

Create `src/lib/navigation.ts` with this content:

```ts
export type NavigationIconId =
  | "dashboard"
  | "commercial"
  | "logistics"
  | "analytics"
  | "data"
  | "sales"
  | "products"
  | "clients"
  | "trends"
  | "compare"
  | "predictions";

export type NavigationItem = {
  to: string;
  label: string;
  subtitle: string;
  icon: NavigationIconId;
  children?: NavigationItem[];
};

export const navigationSections = [
  {
    to: "/",
    label: "Dashboard",
    subtitle: "Vision general del negocio",
    icon: "dashboard",
  },
  {
    to: "/comercial",
    label: "Comercial",
    subtitle: "Ventas, productos, clientes y trazabilidad",
    icon: "commercial",
    children: [
      { to: "/ventas", label: "Ventas", subtitle: "Consulta detallada de ventas, facturas y clientes", icon: "sales" },
      { to: "/productos", label: "Productos", subtitle: "Navega por tipo de factura, variedad, calibre y formato", icon: "products" },
      { to: "/clientes", label: "Clientes", subtitle: "Analisis de la cartera de clientes y su historial", icon: "clients" },
    ],
  },
  {
    to: "/logistica",
    label: "Logistica",
    subtitle: "Expediciones, transporte y control operativo",
    icon: "logistics",
  },
  {
    to: "/analisis",
    label: "Analisis",
    subtitle: "Tendencias, comparativas y predicciones",
    icon: "analytics",
    children: [
      { to: "/tendencias", label: "Tendencias", subtitle: "Patrones, maximos, minimos y variaciones en el tiempo", icon: "trends" },
      { to: "/comparar", label: "Comparar", subtitle: "Selecciona campanas para comparar precios directamente", icon: "compare" },
      { to: "/predicciones", label: "Predicciones", subtitle: "Proyeccion estimada para los proximos 12 meses", icon: "predictions" },
    ],
  },
  {
    to: "/datos",
    label: "Datos",
    subtitle: "Consulta, edita y exporta todos los registros de precios",
    icon: "data",
  },
] satisfies NavigationItem[];

export function flattenNavigationItems(items: readonly NavigationItem[] = navigationSections): NavigationItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNavigationItems(item.children) : [])]);
}

export function isNavigationRouteActive(pathname: string, route: string) {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function findNavigationTrail(pathname: string, items: readonly NavigationItem[] = navigationSections): NavigationItem[] {
  for (const item of items) {
    if (item.children) {
      const childTrail = findNavigationTrail(pathname, item.children);
      if (childTrail.length > 0) return [item, ...childTrail];
    }
    if (isNavigationRouteActive(pathname, item.to)) return [item];
  }
  return [];
}
```

- [ ] **Step 5: Run the test and verify GREEN**

Run: `npm run test:navigation`

Expected: PASS with 2 passing tests.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add package.json scripts/navigation.test.mjs src/lib/navigation.ts
git commit -m "Add shared navigation metadata"
```

## Task 2: Sidebar Compact Area Navigation

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Update `AppLayout.tsx` to consume shared navigation**

Replace local `NavItem` and `navItems` with imports from `src/lib/navigation.ts`. Add an icon map and render children through `Collapsible`, `SidebarMenuSub`, `SidebarMenuSubItem` and `SidebarMenuSubButton`.

The core implementation should include these pieces:

```tsx
const navigationIcons: Record<NavigationIconId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  commercial: ShoppingBag,
  logistics: Truck,
  analytics: BarChart3,
  data: Database,
  sales: FileText,
  products: Package,
  clients: Users,
  trends: TrendingUp,
  compare: GitCompareArrows,
  predictions: LineChart,
};
```

Each top-level item should use:

```tsx
const isSectionActive =
  isNavigationRouteActive(location.pathname, item.to) ||
  item.children?.some((child) => isNavigationRouteActive(location.pathname, child.to));
```

For items with children, render a `Collapsible defaultOpen={isSectionActive}` whose trigger links to the parent route and whose subitems are real `NavLink` elements.

- [ ] **Step 2: Add scoped CSS for subnavigation**

Add classes to `src/index.css`:

```css
.nav-sub-list {
  border-color: hsl(0 0% 100% / 0.09);
}
.nav-sub-button {
  color: hsl(var(--sidebar-foreground) / 0.72);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.nav-sub-button.active,
.nav-sub-button[data-active="true"] {
  color: hsl(var(--sidebar-accent-foreground));
  background: hsl(var(--sidebar-accent) / 0.78);
}
.price-sidebar[data-collapsible="icon"] .nav-sub-list {
  display: none;
}
```

- [ ] **Step 3: Run build for integration**

Run: `npm run build`

Expected: Vite build exits 0.

- [ ] **Step 4: Commit Task 2**

Run:

```bash
git add src/components/AppLayout.tsx src/index.css
git commit -m "Add compact sidebar subnavigation"
```

## Task 3: TopBar And Command Palette From Shared Metadata

**Files:**
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/CommandPalette.tsx`

- [ ] **Step 1: Update `TopBar.tsx`**

Remove `ROUTE_META`. Import `findNavigationTrail` and use it like this:

```tsx
const trail = findNavigationTrail(location.pathname);
const meta = trail[trail.length - 1] ?? null;
const parent = trail.length > 1 ? trail[0] : null;
```

Render breadcrumb as `parent / meta` when a parent exists, and preserve the current subtitle line with `meta?.subtitle`.

- [ ] **Step 2: Update `CommandPalette.tsx`**

Remove the local `pages` array. Import `flattenNavigationItems` and `navigationSections`. Map icon ids to lucide icons with the same icon map used in layout. Use:

```tsx
const pages = flattenNavigationItems(navigationSections);
```

Each command item keeps `navigate(page.to)` and `onOpenChange(false)`.

- [ ] **Step 3: Run structure test and build**

Run:

```bash
npm run test:navigation
npm run build
```

Expected: navigation test passes and Vite build exits 0.

- [ ] **Step 4: Commit Task 3**

Run:

```bash
git add src/components/TopBar.tsx src/components/CommandPalette.tsx
git commit -m "Share navigation metadata across topbar and commands"
```

## Task 4: Manual Browser Verification

**Files:**
- No code files unless verification exposes a defect.

- [ ] **Step 1: Start dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 2: Verify sidebar and routes**

Open the local URL in the in-app browser. Check:

- `/` shows Dashboard active.
- `/ventas` opens the Comercial group and marks Ventas active.
- `/productos` opens the Comercial group and marks Productos active.
- `/tendencias` opens the Analisis group and marks Tendencias active.
- `/datos` shows Datos active.

- [ ] **Step 3: Verify command palette**

Open Ctrl/Cmd+K, search `Predicciones`, select it and verify route changes to `/predicciones` with Analisis active.

- [ ] **Step 4: Final verification**

Run:

```bash
npm run test:navigation
npm run build
git status --short
```

Expected: test/build pass. `git status --short` should only show the pre-existing untracked `pricetrack-glass-review.png` unless new intentional files are still uncommitted.
