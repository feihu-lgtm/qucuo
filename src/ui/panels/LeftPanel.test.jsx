import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import NpcAngerLine from "./NpcAngerLine.jsx";
import LeftPanel from "./LeftPanel.jsx";
import TopBar from "./TopBar.jsx";
import { THEME_VARS } from "../../utils/theme.js";
import { LEFT_FACE_DEFAULTS, LEFT_FACE_PREF_KEY, LEFT_MODULES, migrateLeftFaces } from "./left/leftFaces.js";
import useFaces, { readFacePreferences } from "../components/faces/useFaces.js";

function Demo(props) {
  const faces = useFaces(LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, {
    availableModules: LEFT_MODULES, editable: false, enableKeyboard: false, migrate: migrateLeftFaces,
  });
  return createElement(LeftPanel, { ...props, faces });
}

const props = {
  zoneTheme: THEME_VARS, S: {},
  room: { name: "鱼定村", desc: "三水交汇", exits: ["n", "w", "s"], npcs: [{ name: "才旦", brief: "村长之女" }] },
  time: 6, varTree: {}, char: {}, peoplePanel: { present: true, absent: true },
  mapView: "outer", mapData: { "鱼定村": { x: 0, y: 0 }, "喇嘛庙": { x: 0, y: 1 } },
  questProgress: {}, flags: [], inv: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("left faces", () => {
  it("renders the first face (此地) with explored/unexplored neighbor thumbnails and outer nine-grid map", () => {
    const html = renderToStaticMarkup(createElement(Demo, props));
    expect(html).toContain("三水交汇");
    expect(html).toContain("邻近地点");
    expect(html).toContain("art/place/L03.webp");
    expect(html).toContain("喇嘛庙");
    expect(html).toContain("未探明");
    expect(html).not.toContain("鱼定土司");
    expect(html).toContain("舆图·外");
    expect(html).not.toContain("村图·内");
    expect(html).not.toContain("角色面板");
    expect(html).not.toContain("此地建筑");
    expect(html).not.toContain("编排");
    expect(html).toContain('aria-label="天地面切换"');
  });

  it("renders the second face (周遭) with building thumbnails and inner nine-grid map", () => {
    const getItem = vi.fn(() => JSON.stringify({ ...LEFT_FACE_DEFAULTS, currentIndex: 1 }));
    vi.stubGlobal("window", { localStorage: { getItem } });
    const html = renderToStaticMarkup(createElement(Demo, props));
    expect(getItem).toHaveBeenCalledWith("qucuo_left_faces");
    expect(LEFT_FACE_PREF_KEY).toBe("qucuo_left_faces");
    expect(html).toContain("此地建筑");
    expect(html).toContain("art/building/pigeon_coop.webp");
    expect(html).toContain("村图·内");
    expect(html).not.toContain("舆图·外");
    expect(html).not.toContain("角色面板");
  });

  it("renders the third face (人物) with NPCs only", () => {
    const getItem = vi.fn(() => JSON.stringify({ ...LEFT_FACE_DEFAULTS, currentIndex: 2 }));
    vi.stubGlobal("window", { localStorage: { getItem } });
    const html = renderToStaticMarkup(createElement(Demo, props));
    expect(html).toContain("角色面板");
    expect(html).not.toContain("此地建筑");
    expect(html).not.toContain("舆图·外");
    expect(html).not.toContain("村图·内");
  });

  it("migrates legacy two-face stored left preferences to the three-face layout while preserving single-face test fixtures", () => {
    const legacy = {
      faces: [
        { id: "here", name: "此地", modules: ["location", "exits", "homestead"] },
        { id: "surroundings", name: "周遭", modules: ["buildings", "npcs", "map"] },
      ],
      currentIndex: 1,
    };
    expect(migrateLeftFaces(legacy)).toEqual({ ...LEFT_FACE_DEFAULTS, currentIndex: 1 });

    const singleFaceFixture = {
      faces: [{ id: "surroundings", name: "周遭", modules: ["npcs"] }],
      currentIndex: 0,
    };
    expect(migrateLeftFaces(singleFaceFixture)).toEqual(singleFaceFixture);
  });

  it("falls back to the default face when stored preferences are corrupt or unavailable", () => {
    const options = { availableModules: LEFT_MODULES };
    expect(readFacePreferences({ getItem: () => "broken" }, LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, options)).toEqual(LEFT_FACE_DEFAULTS);
    expect(readFacePreferences({ getItem: () => { throw Error("blocked"); } }, LEFT_FACE_PREF_KEY, LEFT_FACE_DEFAULTS, options)).toEqual(LEFT_FACE_DEFAULTS);
  });
});

describe("TopBar compact single-line header", () => {
  it("renders brand, zone tag, time/turn, compact version button, and status pill in one row", () => {
    const html = renderToStaticMarkup(createElement(TopBar, {
      zoneName: "人间烟火",
      autoSaveError: null,
      lastAutoSave: 1700000000000,
      playerAvatarCustom: "",
      setPlayerAvatarCustom: () => {},
      AV_BASE: "/portraits/player/",
      genderAvatar: {},
      addLog: () => {},
    }));
    expect(html).toContain("天都·曲措");
    expect(html).toContain("天地 · 人间烟火");
    expect(html).toContain("点击查看版本历史目录");
    expect(html).toContain("已保存");

    const panelsCss = readFileSync("src/ui/panels/panels.css", "utf-8");
    expect(panelsCss).toMatch(/\.topbar-actions\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(panelsCss).toMatch(/\.topbar-actions\[data-mobile="false"\]\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(panelsCss).toMatch(/\.topbar-brand\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow:\s*hidden/);
    expect(panelsCss).toMatch(/\.topbar-version-btn\s*\{[^}]*flex-shrink:\s*0/);
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
