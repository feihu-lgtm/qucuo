import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ZONE_THEMES } from "../../utils/theme.js";

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
      zoneTheme: ZONE_THEMES.village,
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
      zoneTheme: ZONE_THEMES.village,
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
});
