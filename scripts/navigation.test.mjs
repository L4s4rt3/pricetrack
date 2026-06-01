import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const navigationUrl = new URL("../src/lib/navigation.ts", import.meta.url);

function navigationSource() {
  assert.equal(existsSync(navigationUrl), true, "src/lib/navigation.ts should exist");
  return readFileSync(navigationUrl, "utf8");
}

function routeBlock(source, route) {
  const escaped = route.replace("/", "\\/");
  const pattern = new RegExp(`\\n  \\{[\\s\\S]*?to:\\s*"${escaped}"[\\s\\S]*?\\n  \\},`);
  return source.match(pattern)?.[0] ?? "";
}

test("navigation source defines compact areas with expected subpages", () => {
  const source = navigationSource();

  assert.match(source, /export const navigationSections/);
  assert.match(routeBlock(source, "/comercial"), /children:/);
  assert.match(routeBlock(source, "/comercial"), /to:\s*"\/ventas"/);
  assert.match(routeBlock(source, "/comercial"), /to:\s*"\/productos"/);
  assert.match(routeBlock(source, "/comercial"), /to:\s*"\/clientes"/);
  assert.match(routeBlock(source, "/analisis"), /children:/);
  assert.match(routeBlock(source, "/analisis"), /to:\s*"\/tendencias"/);
  assert.match(routeBlock(source, "/analisis"), /to:\s*"\/comparar"/);
  assert.match(routeBlock(source, "/analisis"), /to:\s*"\/predicciones"/);
});

test("navigation source exposes helpers used by layout, topbar and command palette", () => {
  const source = navigationSource();

  assert.match(source, /export function flattenNavigationItems/);
  assert.match(source, /export function findNavigationTrail/);
  assert.match(source, /export function isNavigationRouteActive/);
});
