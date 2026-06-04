import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const logistica = readFileSync(new URL("../src/pages/Logistica.tsx", import.meta.url), "utf8");

test("logistics keeps CMR and route document directories separated", () => {
  assert.match(logistica, /const cmrClientsQueryKey = \["cmr-clients"\] as const/);
  assert.match(logistica, /const cmrCarriersQueryKey = \["cmr-carriers"\] as const/);
  assert.match(logistica, /const routeClientsQueryKey = \["route-clients"\] as const/);
  assert.match(logistica, /const routeCarriersQueryKey = \["route-carriers"\] as const/);

  assert.match(logistica, /const \[cmrClients, setCmrClients\] = useState<CmrClient\[\]>\(\[\]\)/);
  assert.match(logistica, /const \[routeClients, setRouteClients\] = useState<CmrClient\[\]>\(\[\]\)/);
  assert.match(logistica, /const \[cmrCarriers, setCmrCarriers\] = useState<CmrCarrier\[\]>\(\[\]\)/);
  assert.match(logistica, /const \[routeCarriers, setRouteCarriers\] = useState<CmrCarrier\[\]>\(\[\]\)/);
});

test("logistics filters imported templates by document kind before deriving presets", () => {
  assert.match(logistica, /const cmrTemplates = loadedTemplates\.filter\(\(template\) => template\.kind === "cmr"\)/);
  assert.match(logistica, /const routeTemplates = loadedTemplates\.filter\(\(template\) => template\.kind === "route"\)/);

  const cmrClientBuild = logistica.indexOf("loadedCmrClients = buildCmrClientsFromTemplates(cmrTemplates)");
  const routeClientBuild = logistica.indexOf("loadedRouteClients = buildCmrClientsFromTemplates(routeTemplates)");
  assert.notEqual(cmrClientBuild, -1, "CMR clients should be built only from CMR templates");
  assert.notEqual(routeClientBuild, -1, "route clients should be built only from route templates");
  assert.doesNotMatch(logistica, /buildCmrClientsFromTemplates\(loadedTemplates\)/);
  assert.doesNotMatch(logistica, /buildCmrCarriersFromTemplates\(loadedTemplates\)/);
});

test("logistics stores search and selection per document mode", () => {
  assert.match(logistica, /useState<Record<DocumentKind, string>>\(\{ cmr: "", route: "" \}\)/);
  assert.match(logistica, /const selectedClientKey = selectedClientKeys\[documentMode\]/);
  assert.match(logistica, /const selectedCarrierKey = selectedCarrierKeys\[documentMode\]/);
  assert.match(logistica, /setSelectedClientKeys\(\(current\) => \(\{ \.\.\.current, \[documentMode\]: value \}\)\)/);
  assert.match(logistica, /setSelectedCarrierKeys\(\(current\) => \(\{ \.\.\.current, \[documentMode\]: value \}\)\)/);
});
