import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const logistica = readFileSync(new URL("../src/pages/Logistica.tsx", import.meta.url), "utf8");
const routeDirectoryMigration = readFileSync(new URL("../supabase/migrations/20260604_create_route_clients_carriers.sql", import.meta.url), "utf8");
const populateDirectoryMigration = readFileSync(new URL("../supabase/migrations/20260604_populate_logistics_directories_from_templates.sql", import.meta.url), "utf8");

test("logistics keeps CMR and route document directories separated", () => {
  assert.match(logistica, /const cmrClientsQueryKey = \["cmr-clients"\] as const/);
  assert.match(logistica, /const cmrCarriersQueryKey = \["cmr-carriers"\] as const/);
  assert.match(logistica, /const routeClientsQueryKey = \["route-clients"\] as const/);
  assert.match(logistica, /const routeCarriersQueryKey = \["route-carriers"\] as const/);

  assert.match(logistica, /const \[cmrClients, setCmrClients\] = useState<CmrClient\[\]>\(\[\]\)/);
  assert.match(logistica, /const \[routeClients, setRouteClients\] = useState<CmrClient\[\]>\(\[\]\)/);
  assert.match(logistica, /const \[cmrCarriers, setCmrCarriers\] = useState<CmrCarrier\[\]>\(\[\]\)/);
  assert.match(logistica, /const \[routeCarriers, setRouteCarriers\] = useState<CmrCarrier\[\]>\(\[\]\)/);
  assert.match(logistica, /\.from\("cmr_clients"\)/);
  assert.match(logistica, /\.from\("cmr_carriers"\)/);
  assert.match(logistica, /\.from\("route_clients"\)/);
  assert.match(logistica, /\.from\("route_carriers"\)/);
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

test("logistics database keeps route directories separate from CMR directories", () => {
  assert.match(routeDirectoryMigration, /create table if not exists public\.route_clients/);
  assert.match(routeDirectoryMigration, /create table if not exists public\.route_carriers/);
  assert.match(routeDirectoryMigration, /Route clients are readable/);
  assert.match(routeDirectoryMigration, /Route carriers are readable/);
  assert.match(populateDirectoryMigration, /where kind = 'cmr'/);
  assert.match(populateDirectoryMigration, /where kind = 'route'/);
  assert.match(populateDirectoryMigration, /insert into public\.cmr_clients/);
  assert.match(populateDirectoryMigration, /insert into public\.cmr_carriers/);
  assert.match(populateDirectoryMigration, /insert into public\.route_clients/);
  assert.match(populateDirectoryMigration, /insert into public\.route_carriers/);
});
