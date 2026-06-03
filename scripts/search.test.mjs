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

test("search hook escapes PostgREST or patterns and validates numeric filters", () => {
  assert.equal(existsSync(hookUrl), true, "src/hooks/useSalesSearch.ts should exist");
  const source = readFileSync(hookUrl, "utf8");
  const patternLine = source.split("\n").find((line) => line.includes("replace(/["));

  assert.match(source, /function\s+postgrestIlikePattern/);
  assert.ok(patternLine, "postgrestIlikePattern should escape reserved characters");
  for (const char of ["\\\\", ",", "%", "\"", "'", "(", ")"]) {
    assert.ok(patternLine.includes(char), `postgrestIlikePattern should escape ${char}`);
  }
  assert.match(source, /validateSalesSearchFilters/);
  assert.match(source, /monthNumber\s*<\s*1\s*\|\|\s*monthNumber\s*>\s*12/);
  assert.match(source, /throw\s+new\s+Error/);
});

test("search page does not use usePrecios full dataset hook", () => {
  assert.equal(existsSync(pageUrl), true, "src/pages/Busqueda.tsx should exist");
  const source = readFileSync(pageUrl, "utf8");

  assert.doesNotMatch(source, /usePrecios\(/);
  assert.match(source, /useSalesSearch\(/);
  assert.match(source, /search\.isError/);
  assert.match(source, /search\.error/);
});
