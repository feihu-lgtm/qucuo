import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NIGHT_VARS, THEME_VARS, getZoneName } from "./theme.js";

// 路线图 U3：颜色只有 tokens.css 一套。迁移前 theme.js 的两套主题色（七个分区共用）
// 与 ink() 的两个语义色冻结在下面，tokens.css 的变量必须与它们逐字段相等，
// 保证把 zoneTheme.xxx / ink() 换成 CSS 变量没有改变任何颜色。测试文件不计入棘轮的色值计数。
const FORMER_NIGHT = { accent: "#c8323a", accentDim: "#8a4a48", bg: "#0a0a09", bgPanel: "#111110", border: "#4a453c", text: "#e8e4d6", textDim: "#8f8a7c" };
const FORMER_DAY = { accent: "#a8202a", accentDim: "#8a4a42", bg: "#eae7dd", bgPanel: "#f4f2e9", border: "#2a2620", text: "#201d18", textDim: "#6d6759" };
const FORMER_INK = { "--npc-name": { night: "#c07050", day: "#8a4a2a" }, "--npc-affection": { night: "#d68a8a", day: "#a8524a" } };
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

describe("tokens.css 与迁移前的主题色逐字段相等", () => {
  const night = block(":root");
  const day = block(':root[data-theme="day"]');

  it("THEME_VARS 覆盖迁移前主题对象的全部颜色字段", () => {
    expect(Object.keys(THEME_VARS).sort()).toEqual(Object.keys(FORMER_NIGHT).sort());
  });

  it("暗夜：每个变量等于迁移前的暗夜色", () => {
    for (const [field, cssVar] of Object.entries(THEME_VARS)) {
      expect(valueOf(night, varName(cssVar)), field).toBe(FORMER_NIGHT[field]);
    }
  });

  it("日间：每个变量等于迁移前的日间色", () => {
    for (const [field, cssVar] of Object.entries(THEME_VARS)) {
      expect(valueOf(day, varName(cssVar)), field).toBe(FORMER_DAY[field]);
    }
  });

  it("NPC 名与好感两个语义色等于迁移前 ink() 的取值", () => {
    for (const [name, { night: n, day: d }] of Object.entries(FORMER_INK)) {
      expect(valueOf(night, name), name).toBe(n);
      expect(valueOf(day, name), name).toBe(d);
    }
  });

  it("分区名：七区氛围文字不变，日间加「·昼」，未知房间回落「人间烟火」", () => {
    expect(getZoneName("喇嘛庙")).toBe("梵音低回");
    expect(getZoneName("雅江", true)).toBe("雨城竹海·昼");
    expect(getZoneName("不存在的房间")).toBe("人间烟火");
  });

  it("theme.js 不再定义任何色值", () => {
    const source = readFileSync("src/utils/theme.js", "utf-8").replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
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

describe("NIGHT_VARS：逐元素固定暗夜", () => {
  const root = block(":root");
  const day = block(':root[data-theme="day"]');
  const night = block('[data-theme="night"]');

  it("字段与 THEME_VARS 一致，每个定色变量的值都等于暗夜主题色", () => {
    expect(Object.keys(NIGHT_VARS).sort()).toEqual(Object.keys(THEME_VARS).sort());
    for (const [field, cssVar] of Object.entries(NIGHT_VARS)) {
      expect(valueOf(root, varName(cssVar)), field).toBe(FORMER_NIGHT[field]);
    }
  });

  it("这些定色变量不随日夜切换：日间块和暗夜块都不覆盖它们", () => {
    for (const cssVar of Object.values(NIGHT_VARS)) {
      expect(valueOf(day, varName(cssVar)), cssVar).toBeUndefined();
      expect(valueOf(night, varName(cssVar)), cssVar).toBeUndefined();
    }
  });
});

describe("不许给 CSS 变量直接拼十六进制透明度", () => {
  // 旧写法 zoneTheme.accent + "18" 对十六进制色有效；颜色换成 var(--accent) 后，同样的拼接
  // 得到 var(--accent)18，是无效 CSS，浏览器会丢掉整条声明，CI 也不会报错。透明度一律写成
  // color-mix(in srgb, var(--某色) N%, transparent)。U3-2c 在 TeamModule 里留下过一处，已在 U2-7 修复。
  it("src 下的 JS/JSX 里没有 var(--某色)XX 或 \"var(--某色)\" + \"XX\"", () => {
    const bad = [];
    const pattern = /"var\(--[\w-]+\)"\s*\+\s*["'][0-9a-fA-F]{2}["']|var\(--[\w-]+\)[0-9a-fA-F]{2}\b/;
    for (const file of jsxFiles("src")) {
      if (pattern.test(readFileSync(file, "utf-8"))) bad.push(file);
    }
    for (const file of jsFiles("src")) {
      if (!/\.test\./.test(file) && pattern.test(readFileSync(file, "utf-8"))) bad.push(file);
    }
    expect(bad).toEqual([]);
  });
});

function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) jsFiles(path, out);
    else if (/\.js$/.test(name)) out.push(path);
  }
  return out;
}
