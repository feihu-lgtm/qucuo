import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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

describe("固定暗夜子树 [data-theme=\"night\"]", () => {
  const root = block(":root");
  const day = block(':root[data-theme="day"]');
  const night = block('[data-theme="night"]');
  const names = (css) => [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);

  it("重新声明的变量恰好是日间块覆盖过的那些", () => {
    expect(names(night)).toEqual(names(day));
  });

  it("每个变量都取 :root 的暗夜值（暗夜下本无的置为 initial），且声明 color-scheme: dark", () => {
    for (const name of names(night)) {
      const nightValue = valueOf(root, name);
      expect(valueOf(night, name), name).toBe(nightValue === undefined ? "initial" : nightValue);
    }
    expect(night).toMatch(/color-scheme:\s*dark;/);
  });
});

// 固定暗夜的界面靠根节点的 data-theme="night" 生效。CSS 变量沿 DOM 继承，
// 所以子树里的浮层必须真的挂在子树之内：ModalShell 原位渲染（不用 portal），
// 而用 createPortal 挂到 body 的浮层会逃出作用域。下面两条把这两点锁住。
export const NIGHT_ROOTS = [
  "src/ui/screens/tavernSim/TavernSimScreen.jsx",
];

function jsxFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) jsxFiles(path, out);
    else if (/\.jsx$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

describe("固定暗夜子树的作用域", () => {
  it("每个固定暗夜界面的根节点都写着 data-theme=\"night\"", () => {
    for (const file of NIGHT_ROOTS) expect(readFileSync(file, "utf-8"), file).toContain('data-theme="night"');
  });

  it("createPortal 只出现在不属于任何暗夜子树的 NoticeToast；ModalShell 不用 portal", () => {
    const users = jsxFiles("src").filter((file) => /\bcreatePortal\b/.test(readFileSync(file, "utf-8")));
    expect(users.map((file) => file.split(/[\\/]/).join("/"))).toEqual(["src/ui/components/NoticeToast.jsx"]);
    expect(readFileSync("src/ui/primitives/ModalShell.jsx", "utf-8")).not.toMatch(/createPortal/);
  });
});
