import { describe, expect, it, vi, beforeEach } from "vitest";
import DungeonScreen from "./DungeonScreen.jsx";
import DungeonMapPanel from "../../components/DungeonMapPanel.jsx";

// 仓库无 jsdom/RTL：沿用 vnode 树断言。useState 打桩把 mapRun 注进组件，
// 验证 routeRoomText/routeRoomAction 的 needsAI 分支回退到主 AI 意图通路（act prop）。
const setSpy = vi.fn();
let injectedMapRun = null;
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useState: (init) => {
      const v = typeof init === "function" ? init() : init;
      return [v === null && injectedMapRun ? injectedMapRun : v, setSpy];
    },
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
    useEffect: () => {},
  };
  return { ...mocked, default: mocked };
});

const THEME = { accent: "#a11", accentDim: "#a55", text: "#eee", textDim: "#999", bgPanel: "#111", border: "#333", gold: "#c80", turquoise: "#a11", green: "#a55" };

const MAP_RUN = {
  districtKey: "白塔地宫", seed: "t",
  map: { anchor: "入口", rooms: { "入口": { desc: "石阶向下。", exits: {}, isAnchor: true } } },
  current: "入口", visited: ["入口"], envTags: {}, envState: {},
  hp: [10, 10], loot: { money: 0, exp: 0, pot: 0, items: [] },
  status: "exploring", step: 0, checkpoint: null, log: [],
};

function flatten(node, out = []) {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") return out;
  if (Array.isArray(node)) { node.forEach(n => flatten(n, out)); return out; }
  out.push(node);
  const kids = node.props?.children;
  if (kids != null) flatten(kids, out);
  return out;
}

function render(mapRun = MAP_RUN) {
  injectedMapRun = mapRun;
  const act = vi.fn();
  const tree = flatten(DungeonScreen({
    building: { name: "白塔地宫", dungeonId: "baita" },
    char: { hp: [10, 10] }, inv: [], skills: [], effectiveSpecialNow: {},
    zoneTheme: THEME, act, runCommand: (id, fn) => fn(),
  }));
  const panel = tree.find(n => n.type === DungeonMapPanel);
  return { act, panel };
}

describe("DungeonScreen 内层地图 needsAI 兜底", () => {
  beforeEach(() => { setSpy.mockClear(); });

  it("onText 谜题认不出的自由文本 → needsAI → 走 act（AI 意图通路）", () => {
    const { act, panel } = render();
    expect(panel).toBeTruthy();
    panel.props.onText("推开暗门");
    expect(act).toHaveBeenCalledWith("推开暗门");
    expect(setSpy).not.toHaveBeenCalled(); // needsAI 不落 runState
  });

  it("onAction 未匹配任何事件的标签 → needsAI → 同样走 act", () => {
    const { act, panel } = render();
    panel.props.onAction("四处张望");
    expect(act).toHaveBeenCalledWith("四处张望");
  });

  it("onAction 命中拾取标签 → 本地裁决落 runState，不走 act", () => {
    const run = {
      ...MAP_RUN,
      map: { anchor: "入口", rooms: { "入口": { desc: "石阶。", exits: {}, isAnchor: true, groundLoot: [{ name: "残经" }] } } },
    };
    const { act, panel } = render(run);
    panel.props.onAction("拾取地上的残经");
    expect(act).not.toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledTimes(1);
    const next = setSpy.mock.calls[0][0];
    expect(next.loot.items).toContain("残经");
    expect(next.map.rooms["入口"].groundLoot).toEqual([]);
  });

  it("无 act prop 时 needsAI 安静返回（不炸）", () => {
    injectedMapRun = MAP_RUN;
    const tree = flatten(DungeonScreen({
      building: { name: "x", dungeonId: "baita" },
      char: { hp: [10, 10] }, zoneTheme: THEME,
    }));
    const panel = tree.find(n => n.type === DungeonMapPanel);
    expect(() => panel.props.onText("推门")).not.toThrow();
  });
});
