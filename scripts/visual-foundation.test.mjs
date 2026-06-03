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

function finalCssBlock(selector) {
  const blocks = [...css.matchAll(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "g"))];
  assert.ok(blocks.length > 0, `${selector} block should exist`);
  return blocks.at(-1)[1];
}

function hslToken(block, tokenName) {
  const match = block.match(new RegExp(`${tokenName}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%`));
  assert.ok(match, `${tokenName} should be defined as an HSL token`);
  return {
    hue: Number(match[1]),
    saturation: Number(match[2]),
    lightness: Number(match[3]),
  };
}

function hexToHsl(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { hue: 0, saturation: 0, lightness: lightness * 100 };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;

  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return { hue: hue * 60, saturation: saturation * 100, lightness: lightness * 100 };
}

function chartHex(key) {
  const match = chartTheme.match(new RegExp(`${key}:\\s*"(#[0-9A-Fa-f]{6})"`));
  assert.ok(match, `${key} should keep its exported color key`);
  return match[1];
}

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

test("final dark semantic tokens stay subdued in the silver foundation", () => {
  const darkBlock = finalCssBlock(".dark");
  const success = hslToken(darkBlock, "--success");
  const info = hslToken(darkBlock, "--info");
  const destructive = hslToken(darkBlock, "--destructive");
  const warning = hslToken(darkBlock, "--warning");

  assert.ok(success.saturation <= 24, "--success should not read as vivid green");
  assert.ok(info.saturation <= 28, "--info should not read as vivid cyan");
  assert.ok(destructive.saturation <= 38, "--destructive should be subdued");
  assert.ok(warning.hue >= 34 && warning.hue <= 44, "--warning may keep restrained amber");
  assert.ok(warning.saturation <= 55, "--warning amber should be restrained");
});

test("chart theme uses silver and ice accents instead of the old bright palette", () => {
  assert.doesNotMatch(chartTheme, /#(?:0A84FF|64D2FF|FFD60A|FF9F0A|BF5AF2)/i);
  assert.match(chartTheme, /silver/i);
  assert.match(chartTheme, /ice/i);
  assert.match(chartTheme, /exportacion:\s*"#E[5-9]/);

  const vividChartKeys = ["mercado", "noExportacion", "noComercial", "mujeres", "otro"];
  for (const key of vividChartKeys) {
    const color = hexToHsl(chartHex(key));
    assert.ok(color.saturation <= 36, `${key} should stay in restrained silver/graphite/ice range`);
  }

  const semanticKeys = ["success", "info", "destructive", "warning"];
  for (const key of semanticKeys) {
    const color = hexToHsl(chartHex(key));
    assert.ok(color.saturation <= 42, `${key} export should be subdued`);
  }
});
