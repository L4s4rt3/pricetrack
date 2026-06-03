import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import vm from "node:vm";

const hookUrl = new URL("../src/hooks/useSalesSearch.ts", import.meta.url);
const pageUrl = new URL("../src/pages/Busqueda.tsx", import.meta.url);

function loadSearchHook() {
  const source = readFileSync(hookUrl, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const fakeQuery = {
    order: () => fakeQuery,
    select: () => fakeQuery,
    range: () => fakeQuery,
    limit: () => fakeQuery,
    or: () => fakeQuery,
    eq: () => fakeQuery,
  };
  const context = {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === "@tanstack/react-query") return { useQuery: (config) => config };
      if (id === "@/integrations/supabase/client") return { supabase: { from: () => fakeQuery } };
      if (id === "@/lib/campaigns") return { PRECIOS_SELECT: "id" };
      return {};
    },
    Date,
    Error,
    Number,
    RegExp,
    String,
  };

  vm.runInNewContext(outputText, context);
  return module.exports;
}

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

test("search helper criteria and validation behavior is executable", async () => {
  const {
    hasSearchCriteria,
    fetchSalesSearch,
    postgrestIlikePattern,
    validateSalesSearchFilters,
  } = loadSearchHook();
  const empty = { text: "", campaign: "", month: "", client: "", product: "" };

  assert.equal(hasSearchCriteria({ ...empty, campaign: " ", month: "\t", client: "  ", product: "\n" }), false);
  assert.equal(hasSearchCriteria({ ...empty, text: "  naranja  " }), true);
  assert.equal(hasSearchCriteria({ ...empty, client: "  ACME  " }), true);
  assert.equal(hasSearchCriteria({ ...empty, product: "  limon  " }), true);

  assert.throws(() => validateSalesSearchFilters({ ...empty, month: "13" }), /Mes debe estar entre 1 y 12/);
  assert.throws(() => validateSalesSearchFilters({ ...empty, campaign: "2025A" }), /Campana debe ser un numero entero/);

  const pattern = postgrestIlikePattern(" ACME, SL (Norte) ");
  assert.equal(pattern, "\"*ACME\\, SL \\(Norte\\)*\"");

  await assert.rejects(
    () => fetchSalesSearch({ filters: { ...empty, campaign: "  " }, page: 1, pageSize: 50 }),
    /Introduce texto o filtros/
  );
});

test("search page does not use usePrecios full dataset hook", () => {
  assert.equal(existsSync(pageUrl), true, "src/pages/Busqueda.tsx should exist");
  const source = readFileSync(pageUrl, "utf8");

  assert.doesNotMatch(source, /usePrecios\(/);
  assert.match(source, /useSalesSearch\(/);
  assert.match(source, /search\.isError/);
  assert.match(source, /search\.error/);
});
