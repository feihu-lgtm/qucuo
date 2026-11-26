import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Badge, Button, Field, FieldLabel, List, Panel, Tabs } from "./index.js";
import { THEME_VARS, chromeBtn } from "../../utils/theme.js";

// 原语的每个变体都要原样复刻已有的手写样式：把 primitives.css 的规则与原样式对象逐个属性比对。
const CSS = readFileSync("src/ui/primitives/primitives.css", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
const UNITLESS = new Set(["lineHeight", "opacity", "flex", "zIndex", "fontWeight"]);
const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cssValue = (key, value) => (typeof value === "number" && value !== 0 && !UNITLESS.has(key) ? `${value}px` : String(value));

function rule(selector) {
  const decls = {};
  for (const match of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1].split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    for (const line of match[2].split(";")) {
      const [prop, ...rest] = line.split(":");
      if (prop && rest.length) decls[prop.trim()] = rest.join(":").trim();
    }
  }
  return decls;
}

function expectSameStyle(selectors, legacy) {
  const merged = Object.assign({}, ...selectors.map(rule));
  for (const [key, value] of Object.entries(legacy)) {
    expect(merged[kebab(key)], `${selectors.join(" + ")} → ${key}`).toBe(cssValue(key, value));
  }
}

// 设置面板迁移前的共享样式件快照（原 screens/settings/styles.js，设置面板全部迁入原语后删除）。
const inputStyle = {
  width: "100%", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0,
  color: "var(--text)", padding: "6px 8px", fontFamily: "inherit", fontSize: "var(--fs-sm)", boxSizing: "border-box",
};
const labelStyle = { fontSize: "var(--fs-xs)", color: "var(--good)", marginBottom: 4, marginTop: 10 };
const sectionStyle = { borderTop: "1px solid var(--ink-divider)", paddingTop: 12, marginTop: 12 };
const btnStyle = {
  cursor: "pointer", color: "var(--accent)", padding: "5px 12px", background: "var(--bg-panel)",
  border: "1px solid var(--border)", borderRadius: 0, fontSize: "var(--fs-sm)", display: "inline-block",
};

// 建筑面板 Btn 迁移前的样式快照（screens/buildings/common.jsx，可用态）。
const FORMER_BUILDING_BTN = {
  primary: { fontSize: "var(--fs-sm)", padding: "5px 14px", borderRadius: 0, cursor: "pointer", color: "var(--bg)", background: "var(--accent)", border: "1px solid var(--accent)", userSelect: "none", display: "inline-block" },
  secondary: { fontSize: "var(--fs-sm)", padding: "5px 14px", borderRadius: 0, cursor: "pointer", color: "var(--accent-dim)", background: "transparent", borderColor: "var(--border)", userSelect: "none", display: "inline-block" },
};

describe("原语样式与原手写样式逐属性相等", () => {
  it("settings 按钮 = 设置面板原 btnStyle", () => {
    expectSameStyle([".ui-btn", '.ui-btn[data-variant="settings"]'], btnStyle);
  });

  it("chrome 按钮 = chromeBtn(THEME_VARS)，开启态同 chromeBtn(…, { active: true })", () => {
    const off = chromeBtn(THEME_VARS);
    const on = chromeBtn(THEME_VARS, { active: true });
    expectSameStyle([".ui-btn", '.ui-btn[data-variant="chrome"]'], off);
    const active = rule('.ui-btn[data-variant="chrome"][aria-pressed="true"]');
    expect(active.color).toBe(on.color);
    expect(active.background).toBe(on.background);
    expect(`1px solid ${active["border-color"]}`).toBe(on.border);
  });

  it("primary / secondary 按钮 = 建筑面板 Btn 的快照", () => {
    expectSameStyle([".ui-btn", '.ui-btn[data-variant="primary"]', '.ui-btn[data-variant="secondary"]', '.ui-btn[data-variant="primary"]'], FORMER_BUILDING_BTN.primary);
    expectSameStyle([".ui-btn", '.ui-btn[data-variant="primary"]', '.ui-btn[data-variant="secondary"]', '.ui-btn[data-variant="secondary"]'], FORMER_BUILDING_BTN.secondary);
  });

  it("表单标签与输入框 = labelStyle / inputStyle；分节 = sectionStyle", () => {
    expectSameStyle([".ui-field-label"], labelStyle);
    expectSameStyle([".ui-input"], inputStyle);
    expectSameStyle(['.ui-panel[data-variant="section"]'], sectionStyle);
  });

  it("块级字段标签 = ApiProviderSettings 原先的 fieldLabel（labelStyle + display: block）", () => {
    expectSameStyle([".ui-field-label", ".ui-field-label--block"], { ...labelStyle, display: "block" });
  });

  it("font=\"native\" 退回浏览器的按钮默认字体", () => {
    expect(rule('.ui-btn[data-font="native"]')["font-family"]).toBe("revert");
  });

  it("按钮把浏览器默认样式重置回 <span> 的行为", () => {
    const base = rule(".ui-btn");
    for (const prop of ["font", "letter-spacing", "text-align", "text-transform"]) expect(base[prop], prop).toBe("inherit");
    expect(base["box-sizing"]).toBe("content-box");
    expect(base.margin).toBe("0");
  });
});

// 建筑面板标题栏迁移前的样式快照（screens/buildings/common.jsx 的 Header）。
const FORMER_BUILDING_HEADER = {
  root: { padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 1, background: "var(--building-panel-bg)" },
  title: { fontSize: "var(--fs-base)", color: "var(--text)" },
  close: { color: "var(--text-dim)", fontSize: "var(--fs-sm)", cursor: "pointer", padding: "2px 8px", borderRadius: 0, transition: "color 0.15s, background 0.15s" },
  closeHover: { color: "var(--accent)", background: "rgba(255, 255, 255, 0.04)" },
};

describe("建筑面板公共件与原样式逐属性相等", () => {
  it("标题栏、标题、关闭按钮（含悬停）", () => {
    expectSameStyle([".building-header"], FORMER_BUILDING_HEADER.root);
    expectSameStyle([".building-header-title"], FORMER_BUILDING_HEADER.title);
    expectSameStyle([".ui-btn", '.ui-btn[data-variant="settings"]', ".ui-btn.building-header-close"], FORMER_BUILDING_HEADER.close);
    expectSameStyle([".ui-btn.building-header-close:hover"], FORMER_BUILDING_HEADER.closeHover);
  });
});

describe("原语渲染", () => {
  const html = (type, props, ...children) => renderToStaticMarkup(createElement(type, props, ...children));

  it("Button 是 type=button 的真按钮，未知变体回落 settings，style 只透传调用方的布局", () => {
    expect(html(Button, { onClick: () => {} }, "存档")).toBe('<button type="button" class="ui-btn" data-variant="settings">存档</button>');
    expect(html(Button, { variant: "nope" }, "x")).toContain('data-variant="settings"');
    expect(html(Button, { variant: "chrome", active: true }, "x")).toContain('aria-pressed="true"');
    expect(html(Button, { style: { flex: 1 } }, "x")).toContain('style="flex:1"');
    expect(html(Button, { variant: "chrome", font: "native" }, "x")).toContain('data-font="native"');
    expect(html(Button, { variant: "chrome" }, "x")).not.toContain("data-font");
  });

  it("Panel、FieldLabel、Field、List、Badge、Tabs 挂对应的类", () => {
    expect(html(Panel, { variant: "section" }, "x")).toBe('<div class="ui-panel" data-variant="section">x</div>');
    expect(html(FieldLabel, null, "名称")).toBe('<div class="ui-field-label">名称</div>');
    const field = html(Field, { label: "密钥" }, createElement("input", { className: "ui-input" }));
    const id = field.match(/for="([^"]+)"/)[1];
    expect(field).toContain(`id="${id}"`);
    expect(html(List, null, createElement("li", null, "a"))).toBe('<ul class="ui-list"><li>a</li></ul>');
    expect(html(Badge, { tone: "accent" }, "大促")).toBe('<span class="ui-badge" data-tone="accent">大促</span>');
    const tabs = html(Tabs, { items: [{ key: "a", label: "甲" }, { key: "b", label: "乙" }], value: "b" });
    expect(tabs).toContain('role="tablist"');
    expect(tabs.match(/aria-selected="true"/g)).toHaveLength(1);
  });
});
