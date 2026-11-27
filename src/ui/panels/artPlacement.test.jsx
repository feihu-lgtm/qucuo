import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({ log: [] }));
vi.mock("../../store/gameStore.js", () => ({
  useGameStore: (selector) => selector(mockState),
  gameStore: { getState: () => mockState },
}));

import LocationModule from "./left/LocationModule.jsx";
import NarrativeLogFeed from "./center/NarrativeLogFeed.jsx";

const feed = () => renderToStaticMarkup(createElement(NarrativeLogFeed, {
  hidden: false, clr: { room: "var(--log-room)", desc: "var(--log-desc)", cmd: "var(--log-cmd)", sys: "var(--log-sys)" },
  isDayMode: false, act: () => {}, collapsedGroups: new Set(), setCollapsedGroups: () => {},
  loading: false, queueCount: 0, pendingTalks: 0, inspecting: null, logEnd: { current: null },
}));

describe("头图放在哪", () => {
  it("天地栏小图固定是外层据点图，走进内层房间也不换", () => {
    const outer = renderToStaticMarkup(createElement(LocationModule, { room: { name: "鱼定村", desc: "" }, innerRoomName: null, time: 30 }));
    const inner = renderToStaticMarkup(createElement(LocationModule, { room: { name: "鱼定村", desc: "" }, innerRoomName: "歇马居", time: 30 }));
    for (const html of [outer, inner]) {
      expect(html).toContain("art--thumb");
      expect(html).toMatch(/art\/place\/L01\.webp/);
    }
  });

  it("江湖栏只在换外层据点时放进场横幅，横幅压着据点名；内层走动只留地名行", () => {
    mockState.log = [
      { t: "room", text: "    鱼定村", turn: 6 },
      { t: "cmd", text: "> 往东走", turn: 6 },
      { t: "room", text: "    鱼定村·歇马居", turn: 7 },
      { t: "cmd", text: "> 往东走", turn: 8 },
      { t: "room", text: "    雅江", turn: 9 },
    ];
    const html = feed();
    expect(html.match(/narrative-arrival/g)).toHaveLength(2);
    expect(html).toMatch(/art\/place\/L01\.webp/);
    expect(html).toMatch(/art\/place\/L14\.webp/);
    expect(html).toContain("鱼定村·歇马居");
    expect(html).toContain("art--enter");
  });
});
