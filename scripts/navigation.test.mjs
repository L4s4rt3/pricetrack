import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const navigationUrl = new URL("../src/lib/navigation.ts", import.meta.url);

function navigationSource() {
  assert.equal(existsSync(navigationUrl), true, "src/lib/navigation.ts should exist");
  return readFileSync(navigationUrl, "utf8");
}

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

test("navigation source exposes helpers used by layout, topbar and command palette", () => {
  const source = navigationSource();

  assert.match(source, /export function flattenNavigationItems/);
  assert.match(source, /export function findNavigationTrail/);
  assert.match(source, /export function isNavigationRouteActive/);
});

test("app keeps legacy routes as redirects during transition", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(app, /path="ventas"[\s\S]*to="\/busqueda"/);
  assert.match(app, /path="productos"[\s\S]*to="\/busqueda"/);
  assert.match(app, /path="tendencias"[\s\S]*to="\/comparativas"/);
  assert.match(app, /path="comparar"[\s\S]*to="\/comparativas"/);
  assert.match(app, /path="predicciones"[\s\S]*to="\/comparativas"/);
});
