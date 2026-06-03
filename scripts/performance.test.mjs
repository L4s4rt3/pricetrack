import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pagePreloads = readFileSync(new URL("../src/lib/pagePreloads.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const dashboardSummaryHook = readFileSync(new URL("../src/hooks/useDashboardSummary.ts", import.meta.url), "utf8");
const dashboardMigration = readFileSync(new URL("../supabase/migrations/20260603_dashboard_search_phase1.sql", import.meta.url), "utf8");

test("app startup does not preload heavy routes or historical datasets", () => {
  assert.match(pagePreloads, /export const criticalPagePreloaders/);
  assert.doesNotMatch(app, /scheduleRoutePreload\(pagePreloaders\)/);
  assert.doesNotMatch(app, /scheduleRoutePreload\(/);
  assert.doesNotMatch(app, /prefetchQuery\(/);
});

test("vite chunks separate heavy vendors by responsibility", () => {
  assert.match(viteConfig, /supabase:\s*\[/);
  assert.match(viteConfig, /ui:\s*\[/);
  assert.match(viteConfig, /charts:\s*\[\s*"recharts"\s*\]/);
  assert.doesNotMatch(viteConfig, /vendor:\s*\[[\s\S]*"@supabase\/supabase-js"/);
});

test("dashboard uses aggregate summary hook instead of full precios rows", () => {
  assert.doesNotMatch(dashboard, /usePrecios\(/);
  assert.match(dashboard, /useDashboardSummary\(/);
});

test("dashboard aggregate summary stays in precios invalidation scope", () => {
  assert.match(dashboardSummaryHook, /dashboardSummaryQueryKey\s*=\s*\[\s*"precios",\s*"dashboard-summary",\s*"last-6-months"\s*\]\s+as const/);
});

test("dashboard aggregate view limits to latest valid months before aggregation", () => {
  assert.match(dashboardMigration, /WITH\s+monthly_keys\s+AS\s*\(/i);
  assert.match(dashboardMigration, /ORDER BY\s+month_start\s+DESC\s+LIMIT\s+6/i);
  assert.match(dashboardMigration, /mes\s+IS\s+NULL\s+OR\s+mes\s+BETWEEN\s+1\s+AND\s+12/i);
  assert.match(dashboardMigration, /JOIN\s+monthly_keys/i);
});

test("dashboard exposes aggregate load errors and keeps units split across charts", () => {
  assert.match(dashboard, /isError/);
  assert.match(dashboard, /refetch/);
  assert.match(dashboard, /Reintentar/);
  assert.doesNotMatch(dashboard, /Facturacion y kilos/);
  assert.match(dashboard, /Facturacion por mes/);
  assert.match(dashboard, /Kilos por mes/);
});
