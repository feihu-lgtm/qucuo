import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// panels 目录的可点击元素从内联 style 搬进 panels.css（路线图 U2）。下面是搬迁前的内联样式快照，
// 带状态的元素展开成「开 / 关」两份；CSS 规则必须逐属性等于快照，保证外观不变。
const CSS = readFileSync("src/ui/panels/panels.css", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
const UNITLESS = new Set(["opacity"]);
const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cssValue = (key, value) => (typeof value === "number" && value !== 0 && !UNITLESS.has(key) ? `${value}px` : String(value));

function rule(selector) {
  const decls = {};
  for (const match of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!match[1].split(",").map((s) => s.trim()).includes(selector)) continue;
    for (const line of match[2].split(";")) {
      const [prop, ...rest] = line.split(":");
      if (prop && rest.length) decls[prop.trim()] = rest.join(":").trim();
    }
  }
  return decls;
}

// border 简写拆成 border + border-color：状态规则只改颜色，合并后比较"实际生效的描边"。
function effective(selectors) {
  const merged = Object.assign({}, ...selectors.map(rule));
  if (merged["border-color"] && merged.border && merged.border !== "none") {
    merged.border = merged.border.replace(/var\([^)]+\)$/, merged["border-color"]);
  }
  return merged;
}

function expectSame(selectors, legacy) {
  const merged = effective(selectors);
  for (const [key, value] of Object.entries(legacy)) {
    expect(merged[kebab(key)], `${selectors.join(" + ")} → ${key}`).toBe(cssValue(key, value));
  }
}

const craftTab = (on) => ({ cursor: "pointer", padding: "2px 12px", fontSize: "var(--fs-sm)", borderRadius: 0, color: on ? "var(--bg)" : "var(--accent)", background: on ? "var(--accent)" : "transparent", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` });
const debugAction = (on) => ({ cursor: "pointer", fontSize: "var(--fs-2xs)", color: on ? "var(--clay)" : "var(--ink-dim-deep)", padding: "2px 8px", border: `1px solid ${on ? "var(--ink-accent)" : "var(--ink-divider)"}`, borderRadius: 0, userSelect: "none" });
const teleport = (on) => ({ ...debugAction(on), color: on ? "var(--accent)" : "var(--ink-dim-deep)", border: `1px solid ${on ? "var(--accent)" : "var(--ink-divider)"}` });
const send = (on) => ({ flexShrink: 0, minWidth: 52, minHeight: 32, padding: "4px 12px", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, borderRadius: 0, background: "transparent", color: on ? "var(--accent)" : "var(--text-dim)", fontFamily: "inherit", fontSize: "var(--fs-md)", letterSpacing: "2px", cursor: on ? "pointer" : "default", opacity: on ? 1 : 0.5 });

describe("panels.css 与搬迁前的内联样式逐属性相等", () => {
  it("工艺标签：选中 / 未选中", () => {
    expectSame([".craft-tab", '.craft-tab[data-on="true"]'], craftTab(true));
    expectSame([".craft-tab"], craftTab(false));
  });

  it("切磋确认 / 取消", () => {
    expectSame([".duel-confirm-btn"], { cursor: "pointer", fontSize: "var(--fs-sm)", padding: "4px 12px", borderRadius: 0, color: "var(--ink-bg-panel)", background: "var(--red-soft)", border: "1px solid var(--red-soft)" });
    expectSame([".duel-cancel-btn"], { cursor: "pointer", fontSize: "var(--fs-sm)", padding: "4px 12px", borderRadius: 0, color: "var(--text-dim)", border: "1px solid var(--ink-edge-quest)" });
  });

  it("调试面板：关闭、调试动作（可用 / 不可用）、传送（可用 / 不可用）", () => {
    expectSame([".debug-close-btn"], { cursor: "pointer", color: "var(--debug-close)", fontSize: "var(--fs-md)", padding: "2px 12px", border: "1px solid var(--debug-close-edge)", borderRadius: 0 });
    expectSame([".debug-action"], debugAction(true));
    expectSame([".debug-action", '.debug-action[data-on="false"]'], debugAction(false));
    expectSame([".debug-action", ".debug-action.debug-action-accent"], teleport(true));
    expectSame([".debug-action", ".debug-action.debug-action-accent", '.debug-action[data-on="false"]'], teleport(false));
  });

  it("恢复默认头像、任务进度、任务选项、@ 菜单项", () => {
    expectSame([".avatar-reset-btn"], { cursor: "pointer", fontSize: "var(--fs-sm)", color: "var(--ink-danger-soft)", padding: "6px 12px", border: "1px solid var(--footer-stalled-bg)", borderRadius: 0 });
    expectSame([".quest-progress-btn"], { cursor: "pointer", color: "var(--ember)", padding: "2px 10px", border: "1px solid var(--gold-deep)", borderRadius: 0, fontSize: "var(--fs-xs)", background: "var(--footer-progress-button)", whiteSpace: "nowrap" });
    expectSame([".quest-choice-btn"], { cursor: "pointer", color: "var(--clay)", padding: "2px 10px", border: "1px solid var(--accent)", borderRadius: 0, fontSize: "var(--fs-xs)", background: "var(--ink-tier-bg)", whiteSpace: "nowrap" });
    expectSame([".at-menu-item"], { background: "transparent", border: "none", color: "var(--text)", textAlign: "left", padding: "6px 10px", fontSize: "var(--fs-sm)", fontFamily: "inherit", cursor: "pointer" });
  });

  it("发送按钮：有输入 / 无输入", () => {
    expectSame([".game-send-button"], send(true));
    expectSame([".game-send-button", '.game-send-button[data-on="false"]'], send(false));
  });

  it("状态规则写在基础规则之后，层叠时才会生效", () => {
    const order = (a, b) => expect(CSS.indexOf(a), `${a} 应在 ${b} 之后`).toBeGreaterThan(CSS.indexOf(b));
    order('.debug-action[data-on="false"]', ".debug-action.debug-action-accent");
    order('.game-send-button[data-on="false"]', ".game-send-button {");
  });
});


// 第二批（工具提取）：搬迁前内联样式的快照，值已换算成 CSS 写法（数字补 px）。
const EXTRACTED = [
  { cls: "mind-confess-btn", on: {"marginTop": "9px", "padding": "7px 10px", "borderRadius": "0", "cursor": "pointer", "border": "1px solid var(--mind-button-edge)", "background": "rgba(232,200,106,.13)", "color": "var(--mind-button-text)", "fontSize": "var(--fs-sm)", "textAlign": "center"}, off: null },
  { cls: "attr-train-waigong", on: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "padding": "1px 5px", "borderRadius": "0", "color": "var(--attr-waigong-tag)", "background": "var(--bg-panel)", "border": "1px solid var(--attr-waigong-edge)", "whiteSpace": "nowrap"}, off: null },
  { cls: "attr-train-neigong", on: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "padding": "1px 5px", "borderRadius": "0", "color": "var(--attr-neigong-tag)", "background": "var(--bg-panel)", "border": "1px solid var(--attr-neigong-edge)", "whiteSpace": "nowrap"}, off: null },
  { cls: "profile-inspect-btn", on: {"fontSize": "var(--fs-2xs)", "padding": "1px 5px", "borderRadius": "0", "color": "var(--text-dim)", "background": "var(--bg-panel)", "border": "1px solid var(--border)", "cursor": "wait", "opacity": "0.6"}, off: {"fontSize": "var(--fs-2xs)", "padding": "1px 5px", "borderRadius": "0", "color": "var(--text-dim)", "background": "var(--bg-panel)", "border": "1px solid var(--border)", "cursor": "pointer", "opacity": "1"} },
  { cls: "profile-form-tab", on: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "padding": "1px 7px", "borderRadius": "0", "color": "var(--bg)", "background": "var(--accent)", "border": "1px solid var(--accent)"}, off: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "padding": "1px 7px", "borderRadius": "0", "color": "var(--accent)", "background": "var(--bg-panel)", "border": "1px solid var(--border)"} },
  { cls: "profile-companion-card", on: {"width": "90px", "aspectRatio": "2/3", "borderRadius": "0", "overflow": "hidden", "border": "1px solid var(--border)", "background": "var(--bg-panel)", "display": "flex", "alignItems": "center", "justifyContent": "center", "position": "relative", "cursor": "pointer"}, off: {"width": "90px", "aspectRatio": "2/3", "borderRadius": "0", "overflow": "hidden", "border": "1px solid var(--border)", "background": "var(--bg-panel)", "display": "flex", "alignItems": "center", "justifyContent": "center", "position": "relative", "cursor": "default"} },
  { cls: "profile-body-btn", on: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "padding": "1px 6px", "borderRadius": "0", "border": "1px solid var(--border)", "whiteSpace": "nowrap", "color": "var(--accent)"}, off: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "padding": "1px 6px", "borderRadius": "0", "border": "1px solid var(--border)", "whiteSpace": "nowrap", "color": "var(--text-dim)"} },
  { cls: "profile-avatar-card", on: {"width": "90px", "aspectRatio": "2/3", "borderRadius": "0", "overflow": "hidden", "border": "1px solid var(--border)", "background": "var(--bg-panel)", "cursor": "pointer", "display": "flex", "alignItems": "center", "justifyContent": "center", "position": "relative"}, off: null },
  { cls: "skills-train-btn", on: {"fontSize": "var(--fs-2xs)", "padding": "1px 7px", "borderRadius": "0", "userSelect": "none", "cursor": "pointer", "color": "var(--violet)", "background": "var(--bg-panel)", "border": "1px solid var(--building-desc)"}, off: {"fontSize": "var(--fs-2xs)", "padding": "1px 7px", "borderRadius": "0", "userSelect": "none", "cursor": "not-allowed", "color": "var(--ink-text-dim)", "background": "transparent", "border": "1px solid var(--border)"} },
  { cls: "skills-idle-toggle", on: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "color": "var(--accent)", "border": "1px solid var(--border)", "borderRadius": "0", "padding": "0 4px", "flexShrink": "0"}, off: null },
  { cls: "team-detail-btn", on: {"cursor": "pointer", "fontSize": "var(--fs-2xs)", "color": "var(--accent-dim)", "padding": "5px 7px", "borderRadius": "0", "border": "1px solid var(--border)"}, off: null },
  { cls: "team-portrait-card", on: {"flex": "1", "minWidth": "0", "display": "flex", "alignItems": "center", "gap": "8px", "cursor": "pointer", "padding": "6px 8px", "borderRadius": "0", "border": "1px solid var(--accent)"}, off: {"flex": "1", "minWidth": "0", "display": "flex", "alignItems": "center", "gap": "8px", "cursor": "pointer", "padding": "6px 8px", "borderRadius": "0", "border": "1px solid var(--border)"} },
  { cls: "avatar-pick-card", on: {"aspectRatio": "2/3", "borderRadius": "0", "overflow": "hidden", "cursor": "pointer", "background": "var(--bg-panel)", "border": "2px solid var(--accent)"}, off: {"aspectRatio": "2/3", "borderRadius": "0", "overflow": "hidden", "cursor": "pointer", "background": "var(--bg-panel)", "border": "1px solid var(--border)"} },
  { cls: "mind-gate-btn", on: {"cursor": "pointer", "userSelect": "none", "fontSize": "var(--fs-xs)", "padding": "4px 11px", "borderRadius": "0", "color": "var(--mind-gate-ok)", "border": "1px solid var(--mind-gate-ok-edge)", "background": "rgba(232,200,106,.08)"}, off: {"cursor": "pointer", "userSelect": "none", "fontSize": "var(--fs-xs)", "padding": "4px 11px", "borderRadius": "0", "color": "var(--text-dim)", "border": "1px solid var(--mind-gate-edge)", "background": "transparent"} },
];

describe("panels.css 第二批：工具提取的类与快照逐属性相等", () => {
  for (const { cls, on, off } of EXTRACTED) {
    it(`.${cls}`, () => {
      const base = rule(`.${cls}`);
      for (const [key, value] of Object.entries(on)) expect(base[kebab(key)], `${cls} 开 → ${key}`).toBe(value);
      if (off) {
        const merged = { ...base, ...rule(`.${cls}[data-on="false"]`) };
        for (const [key, value] of Object.entries(off)) expect(merged[kebab(key)], `${cls} 关 → ${key}`).toBe(value);
      }
    });
  }
});

it("队伍头像卡片的出战底色：修复 U3-2c 拼出的无效 var(--accent)18，改为 color-mix 9.4%", () => {
  expect(rule(".team-portrait-card").background).toBe("color-mix(in srgb, var(--accent) 9.4%, transparent)");
  expect(rule('.team-portrait-card[data-on="false"]').background).toBe("var(--bg-panel)");
});
