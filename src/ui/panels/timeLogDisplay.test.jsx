import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { THEME_VARS } from "../../utils/theme.js";

const mockState = vi.hoisted(() => ({ log: [] }));

vi.mock("../../store/gameStore.js", () => ({
  useGameStore: (selector) => selector(mockState),
  gameStore: { getState: () => mockState },
}));

import LocationModule from "./left/LocationModule.jsx";
import NarrativeLogFeed from "./center/NarrativeLogFeed.jsx";

describe("局内时间合并与叙事日志回合显示", () => {
  it("LocationModule 并排展示游戏时间回合与现实时间组件", () => {
    const html = renderToStaticMarkup(createElement(LocationModule, {
      room: { name: "鱼定村", desc: "雪山脚下。" },
      innerRoomName: null,
      time: 30,
    }));
    expect(html).toContain("游戏 第2日·卯初·05:00 · 第30回合");
    expect(html).toContain("现实 ");
    expect(html).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it("NarrativeLogFeed 展示带回合与游戏日的日志并兼容无 turn 的旧存档条目", () => {
    mockState.log = [
      { t: "sys", text: "旧存档开场", standalone: true },
      { t: "room", text: "— 天都镇 —", turn: 25, day: 2 },
      { t: "cmd", text: "> 端详才旦", turn: 25, day: 2 },
      { t: "desc", text: "  神色沈静。", turn: 25, day: 2 },
    ];
    const html = renderToStaticMarkup(createElement(NarrativeLogFeed, {
      hidden: false,
      clr: { sys: "var(--text)", cmd: "var(--accent)", desc: "var(--text)", room: "var(--accent)" },
      isDayMode: false,
      act: () => {},
      collapsedGroups: new Set(),
      setCollapsedGroups: () => {},
      loading: false,
      queueCount: 0,
      pendingTalks: 0,
      inspecting: null,
      logEnd: { current: null },
    }));
    expect(html).toContain("第2日·第25回合");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });

  it("组内回合推进、独立消息、切磋分割条与流式骨架都保留稳定时间戳与对齐类", () => {
    mockState.log = [
      { t: "sys", text: "  自动赶路出发", standalone: true, turn: 25, day: 2, realTs: 1700000000000 },
      { t: "cmd", text: "> 看 元朵朵", turn: 25, day: 2, realTs: 1700000000000 },
      { t: "sys", text: "  元朵朵 气血 167/167", turn: 25, day: 2 },
      { t: "sys", text: "　── 与元朵朵切磋 ──", turn: 27, day: 2 },
      { t: "desc", text: "  ▌", streaming: true, placeholder: true, fillKey: "ftm-1", turn: 27, day: 2 },
    ];
    const html = renderToStaticMarkup(createElement(NarrativeLogFeed, {
      hidden: false,
      clr: { sys: "var(--text)", cmd: "var(--accent)", desc: "var(--text)", room: "var(--accent)" },
      isDayMode: false,
      act: () => {},
      collapsedGroups: new Set(),
      setCollapsedGroups: () => {},
      loading: true,
      queueCount: 0,
      pendingTalks: 0,
      inspecting: null,
      logEnd: { current: null },
    }));
    expect(html).toContain("第2日·第25回合 · 子正 24:00");
    expect(html).toContain("第2日·第27回合 · 丑正 02:00");
    expect(html).toContain("narrative-time-divider");
    expect(html).toContain("log-duel-banner");
    expect(html).toContain("narrative-skeleton");
  });

  it("紧凑单行盒省去多余横线分割、正文逐段落成 .log-para（缩进统一交给样式表）、来信走素笺卡片且箱外弱化", () => {
    mockState.log = [
      { t: "sys", text: "正在读档，请稍候。", standalone: true, turn: 1, day: 1 },
      { t: "cmd", text: "> 环顾四周", turn: 1, day: 1 },
      { t: "desc", text: "  界石边有一条清亮水痕。", turn: 1, day: 1 },
      { t: "cmd", text: "> 细看雪山", turn: 2, day: 1 },
      { t: "desc", text: "风从垭口灌下来，卷着碎雪扑在肩头，远处白塔在云雾里露出一角檐牙，山道上行人寥寥，只有牧马的低鸣断断续续传进耳中。", turn: 2, day: 1 },
      { t: "narrator", text: "  「元朵朵来信」见字如面，近来可好。", standalone: true, letterFrom: "元朵朵", letterBody: "见字如面，近来可好。" },
    ];
    const html = renderToStaticMarkup(createElement(NarrativeLogFeed, {
      hidden: false,
      clr: { sys: "var(--log-sys)", cmd: "var(--log-cmd)", desc: "var(--log-desc)", room: "var(--log-room)", narrator: "var(--log-narrator)" },
      isDayMode: false,
      act: () => {},
      collapsedGroups: new Set(),
      setCollapsedGroups: () => {},
      loading: false,
      queueCount: 0,
      pendingTalks: 0,
      inspecting: null,
      logEnd: { current: null },
    }));
    expect(html).toContain("color:var(--center-outside-text)");
    // 第一组紧凑单行不带 header--divided，第二组长段才带 header--divided
    expect(html).toMatch(/narrative-group-header--open"[^>]*>.*?环顾四周/);
    expect(html).toMatch(/narrative-group-header--divided"[^>]*>.*?细看雪山/);
    // 长短正文一律逐段落成 .log-para，不再按字数决定缩不缩、也不在行内写 text-indent。
    expect(html.match(/class="log-para"/g)?.length).toBe(2);
    expect(html).not.toContain("text-indent");
    expect(html).toContain("log-letter-card");
    expect(html).toContain("✉ 元朵朵 来信");
  });

  it("细看立绘只包住细看那一回合，同组后续回合回到版心左边界", () => {
    mockState.log = [
      { t: "cmd", text: "> 看 珍珠", turn: 6, day: 1 },
      { t: "desc", text: "  珍珠 村口通体雪白的小白马", turn: 6, day: 1 },
      { t: "sys", text: "  装束 珍珠的缰绳", turn: 6, day: 1 },
      { t: "sys", text: "  你向珍珠抱拳邀战，珍珠点头应下。", turn: 7, day: 1 },
    ];
    const html = renderToStaticMarkup(createElement(NarrativeLogFeed, {
      hidden: false,
      clr: { sys: "var(--text)", cmd: "var(--accent)", desc: "var(--text)" },
      isDayMode: false, act: () => {}, collapsedGroups: new Set(), setCollapsedGroups: () => {},
      loading: false, queueCount: 0, pendingTalks: 0, inspecting: null, logEnd: { current: null },
    }));
    // 取出 narrative-look-body 这一个 div 的完整内容（按 div 配对找闭合处）。
    const start = html.indexOf('<div class="narrative-look-body">');
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    let end = start;
    const tag = /<div\b|<\/div>/g;
    tag.lastIndex = start;
    for (let m = tag.exec(html); m; m = tag.exec(html)) {
      depth += m[0] === "</div>" ? -1 : 1;
      if (depth === 0) { end = m.index; break; }
    }
    const lookBody = html.slice(start, end);
    expect(lookBody).toContain("装束 珍珠的缰绳");
    expect(lookBody).not.toContain("抱拳");
    expect(html).toContain("抱拳");
  });
});
