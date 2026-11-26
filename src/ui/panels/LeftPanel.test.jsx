import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import NpcAngerLine from "./NpcAngerLine.jsx";
import LeftPanel from "./LeftPanel.jsx";
import { THEME_VARS } from "../../utils/theme.js";
import { LEFT_FACE_DEFAULTS, LEFT_FACE_PREF_KEY, LEFT_MODULES } from "./left/leftFaces.js";
import useFaces, { readFacePreferences } from "../components/faces/useFaces.js";

function Demo(props) {
  const faces = useFaces(LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, {
    availableModules: LEFT_MODULES, editable: false, enableKeyboard: false,
  });
  return createElement(LeftPanel, { ...props, faces });
}

const props = {
  zoneTheme: THEME_VARS, S: {},
  room: { name: "鱼定村", desc: "三水交汇", exits: ["n"], npcs: [{ name: "才旦", brief: "村长之女" }] },
  time: 6, varTree: {}, char: {}, peoplePanel: { present: true, absent: true },
  mapView: "outer", mapData: {}, questProgress: {}, flags: [], inv: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("left faces", () => {
  it("renders the location face and fixed date header without an editor", () => {
    const html = renderToStaticMarkup(createElement(Demo, props));
    expect(html).toContain("三水交汇");
    expect(html).toContain("出口");
    expect(html).toContain("点击查看版本历史目录");
    expect(html).not.toContain("角色面板");
    expect(html).not.toContain("家园设施");
    expect(html).not.toContain("编排");
    expect(html).toContain('aria-label="天地面切换"');
  });

  it("reads the left preference key and renders NPCs and map on the second face", () => {
    const getItem = vi.fn(() => JSON.stringify({ ...LEFT_FACE_DEFAULTS, currentIndex: 1 }));
    vi.stubGlobal("window", { localStorage: { getItem } });
    const html = renderToStaticMarkup(createElement(Demo, props));
    expect(getItem).toHaveBeenCalledWith("qucuo_left_faces");
    expect(LEFT_FACE_PREF_KEY).toBe("qucuo_left_faces");
    expect(html).toContain("此地建筑");
    expect(html).toContain("角色面板");
    expect(html).toContain("舆图·外");
    expect(html).not.toContain("三水交汇");
  });

  it("falls back to the default face when stored preferences are corrupt or unavailable", () => {
    const options = { availableModules: LEFT_MODULES };
    expect(readFacePreferences({ getItem: () => "broken" }, LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, options)).toEqual(LEFT_FACE_DEFAULTS);
    expect(readFacePreferences({ getItem: () => { throw Error("blocked"); } }, LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, options)).toEqual(LEFT_FACE_DEFAULTS);
  });
});

describe("LeftPanel NPC anger status", () => {
  it("renders the shared anger line with its existing color and attempt count", () => {
    const html = renderToStaticMarkup(createElement(NpcAngerLine, {
      angerState: {
        active: true,
        reason: "偷窃未遂",
        turnsLeft: 2,
        attempts: [{}, {}, {}],
      },
    }));

    expect(html).toContain("⚡ 气头上（偷窃未遂），还剩 2 回合 · 已求和 3 次");
    expect(html).toContain("color:var(--qb-versus)");
  });

  it("does not render an inactive anger line", () => {
    expect(renderToStaticMarkup(createElement(NpcAngerLine, {
      angerState: { active: false, attempts: [] },
    }))).toBe("");
  });
});
