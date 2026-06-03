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
