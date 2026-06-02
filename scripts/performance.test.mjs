import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pagePreloads = readFileSync(new URL("../src/lib/pagePreloads.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

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
