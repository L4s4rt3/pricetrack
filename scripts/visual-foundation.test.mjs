import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const chartTheme = readFileSync(new URL("../src/lib/chartTheme.tsx", import.meta.url), "utf8");

const warmBackgroundPatterns = [
  /hsl\(3[05]\s+\d+%\s+\d+%[^)]*\/\s*0\.(?:0[6-9]|[1-9])/g,
  /hsl\(42\s+9[05]%\s+\d+%[^)]*\/\s*0\.(?:0[6-9]|[1-9])/g,
  /hsl\(346\s+82%\s+\d+%[^)]*\/\s*0\.(?:0[6-9]|[1-9])/g,
];

test("visual foundation keeps app backgrounds restrained and cold", () => {
  const backgroundBlocks = [
    ...css.matchAll(/(?:body|\.dark body|\.app-frame|\.dark \.app-frame|\.app-scroll|\.dark \.app-scroll|\.price-sidebar)[^{]*\{[^}]*background:[^}]*\}/g),
  ].map((match) => match[0]);

  assert.ok(backgroundBlocks.length >= 7, "expected app, page and sidebar background rules");

  for (const block of backgroundBlocks) {
    for (const pattern of warmBackgroundPatterns) {
      assert.doesNotMatch(block, pattern);
    }
  }
});

test("chart theme uses silver and ice accents instead of the old bright palette", () => {
  assert.doesNotMatch(chartTheme, /#(?:0A84FF|64D2FF|FFD60A|FF9F0A|BF5AF2)/i);
  assert.match(chartTheme, /silver/i);
  assert.match(chartTheme, /ice/i);
  assert.match(chartTheme, /exportacion:\s*"#E[5-9]/);
});
