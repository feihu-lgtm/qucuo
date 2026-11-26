import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_VARS, ZONE_THEMES, ZONE_THEMES_DAY } from "./theme.js";

// 路线图 U3 的前提：theme.js 的两套色值与 tokens.css 的变量逐字段相等，
// 所以把 zoneTheme 的字段换成对应的 CSS 变量不会改变任何颜色。这条测试锁住这一点。
const TOKENS = readFileSync("src/ui/tokens.css", "utf-8");

function block(selector) {
  const at = TOKENS.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return TOKENS.slice(at, TOKENS.indexOf("\n}", at));
}

function valueOf(css, name) {
  const match = css.match(new RegExp(`\\s${name}:\\s*([^;]+);`));
  return match ? match[1].trim().toLowerCase() : undefined;
}

const varName = (value) => value.match(/^var\((--[\w-]+)\)$/)[1];

describe("theme.js 色值与 tokens.css 变量一一相等", () => {
  const night = block(":root");
  const day = block(':root[data-theme="day"]');

  it("THEME_VARS 覆盖主题对象里全部颜色字段", () => {
    const colorFields = Object.keys(ZONE_THEMES.village).filter((key) => key !== "name").sort();
    expect(Object.keys(THEME_VARS).sort()).toEqual(colorFields);
  });

  it("七个分区暗夜色值都等于 :root 的对应变量", () => {
    for (const [zone, theme] of Object.entries(ZONE_THEMES)) {
      for (const [field, cssVar] of Object.entries(THEME_VARS)) {
        expect(theme[field].toLowerCase(), `${zone}.${field}`).toBe(valueOf(night, varName(cssVar)));
      }
    }
  });

  it("七个分区日间色值都等于 :root[data-theme=\"day\"] 的对应变量", () => {
    for (const [zone, theme] of Object.entries(ZONE_THEMES_DAY)) {
      for (const [field, cssVar] of Object.entries(THEME_VARS)) {
        expect(theme[field].toLowerCase(), `${zone}.${field}`).toBe(valueOf(day, varName(cssVar)));
      }
    }
  });
});
