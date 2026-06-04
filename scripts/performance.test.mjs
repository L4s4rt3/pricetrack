import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pagePreloads = readFileSync(new URL("../src/lib/pagePreloads.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const dashboardSummaryHook = readFileSync(new URL("../src/hooks/useDashboardSummary.ts", import.meta.url), "utf8");
const dashboardMigration = readFileSync(new URL("../supabase/migrations/20260603_dashboard_search_phase1.sql", import.meta.url), "utf8");

function findMatchingParen(source, openIndex) {
  let depth = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new Error("No matching closing parenthesis found");
}

function extractMonthlyKeysCte(sql) {
  const cteStart = sql.search(/WITH\s+monthly_keys\s+AS\s*\(/i);
  assert.notEqual(cteStart, -1, "monthly_keys CTE should exist");

  const openParen = sql.indexOf("(", cteStart);
  const closeParen = findMatchingParen(sql, openParen);

  return {
    body: sql.slice(openParen + 1, closeParen),
    end: closeParen + 1,
    start: cteStart,
  };
}

function extractChartCard(source, title) {
  const titleIndex = source.indexOf(`<ChartCard title="${title}">`);
  assert.notEqual(titleIndex, -1, `${title} ChartCard should exist`);

  const closeIndex = source.indexOf("</ChartCard>", titleIndex);
  assert.notEqual(closeIndex, -1, `${title} ChartCard should close`);

  return source.slice(titleIndex, closeIndex);
}

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

test("dashboard summary does not block startup when aggregate view is missing", () => {
  assert.match(dashboardSummaryHook, /isMissingDashboardSummarySource/);
  assert.match(dashboardSummaryHook, /PGRST205/);
  assert.match(dashboardSummaryHook, /precios_dashboard_mensual/);
  assert.match(dashboardSummaryHook, /if \(isMissingDashboardSummarySource\(error\)\) return \[\]/);
});

test("dashboard aggregate view limits to latest valid months before aggregation", () => {
  const monthlyKeys = extractMonthlyKeysCte(dashboardMigration);
  const finalSelectStart = dashboardMigration.search(/SELECT\s+monthly_keys\.month_start/i);
  const finalBody = dashboardMigration.slice(finalSelectStart);
  const finalFromJoinIndex = dashboardMigration.search(/FROM\s+public\.precios\s+JOIN\s+monthly_keys/i);
  const groupByIndex = dashboardMigration.search(/GROUP\s+BY\s+monthly_keys\.month_start/i);

  assert.match(monthlyKeys.body, /ORDER\s+BY\s+month_start\s+DESC\s+LIMIT\s+6/i);
  assert.match(monthlyKeys.body, /mes\s+IS\s+NULL\s+OR\s+mes\s+BETWEEN\s+1\s+AND\s+12/i);
  assert.doesNotMatch(monthlyKeys.body, /\b(count|sum|avg)\s*\(/i);
  assert.ok(finalSelectStart > monthlyKeys.end, "final SELECT should run after monthly_keys CTE");
  assert.match(finalBody, /\bcount\s*\(/i);
  assert.match(finalBody, /\bsum\s*\(/i);
  assert.match(finalBody, /\bavg\s*\(/i);
  assert.ok(finalFromJoinIndex > finalSelectStart, "final aggregation should read precios joined to monthly_keys");
  assert.ok(groupByIndex > finalFromJoinIndex, "GROUP BY should happen after joining monthly_keys");
});

test("dashboard exposes aggregate load errors and keeps units split across charts", () => {
  const facturacionChart = extractChartCard(dashboard, "Facturacion por mes");
  const kilosChart = extractChartCard(dashboard, "Kilos por mes");
  const precioChart = extractChartCard(dashboard, "Precio medio por mes");

  assert.match(dashboard, /isError/);
  assert.match(dashboard, /refetch/);
  assert.match(dashboard, /Reintentar/);
  assert.match(facturacionChart, /dataKey="facturacion"/);
  assert.doesNotMatch(facturacionChart, /dataKey="kilos"/);
  assert.match(kilosChart, /dataKey="kilos"/);
  assert.doesNotMatch(kilosChart, /dataKey="facturacion"/);
  assert.match(precioChart, /dataKey="precio"/);
});
