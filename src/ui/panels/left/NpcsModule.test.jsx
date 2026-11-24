import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZONE_THEMES } from "../../../utils/theme.js";
import { unlockImportedCompanion, stationCompanion } from "../../../domain/rules/companion/companion.js";
import { partitionPeople } from "./peopleRoster.js";

// renderToStaticMarkup 走 zustand 的 getInitialState，读不到 setState 的结果，
// 这里把两个仓的订阅 hook 换成读可变快照，其余导出（setter 等）保留真实实现。
const mocked = vi.hoisted(() => ({ game: {}, ui: {} }));
vi.mock("../../../store/gameStore.js", async (importOriginal) => ({
  ...(await importOriginal()),
  useGameStore: (selector) => selector(mocked.game),
}));
vi.mock("../../../store/sessionUiStore.js", async (importOriginal) => ({
  ...(await importOriginal()),
  useSessionUi: (selector) => selector(mocked.ui),
}));

const { default: NpcsModule } = await import("./NpcsModule.jsx");
const { sessionUiStore } = await import("../../../store/sessionUiStore.js");

const room = { name: "鱼定村", npcs: [{ name: "才旦", brief: "村长之女" }] };
const varTree = { 世界: { 曾经出现人物: ["才旦", "老猎户", "行脚僧"] }, 角色: {} };

function companions() {
  // 元朵朵随行；雪豹留守在别的据点
  let cs = unlockImportedCompanion({}, { name: "元朵朵", levelCap: 2, brief: "散财娇蕊" });
  cs = {
    ...cs,
    snowLeopard: { unlocked: true, active: false, data: { name: "雪豹", brief: "雪白灵兽" }, label: "雪豹", beast: true },
  };
  return stationCompanion(cs, "snowLeopard", { district: "喇嘛庙", roomId: "山门", roomName: "山门" });
}

function render(peoplePanel) {
  mocked.game = { companionState: companions(), varTree, varTreeCache: null };
  mocked.ui = { pigeonTarget: null, peoplePanel };
  return renderToStaticMarkup(createElement(NpcsModule, {
    room, innerRoomName: null, varTree, zoneTheme: ZONE_THEMES.village, char: {},
    addLog: () => {}, inputRef: { current: null }, uiGreen: "var(--green-soft)", uiPink: "var(--pink)",
  }));
}

beforeEach(() => { mocked.game = {}; mocked.ui = {}; });

describe("partitionPeople", () => {
  it("lists following companions as present anywhere and keeps them out of absent", () => {
    const cs = companions();
    const { present, absent } = partitionPeople({
      room, innerRoomName: null, companionState: cs, everSeen: ["才旦", "元朵朵", "雪豹", "老猎户"],
    });
    expect(present.map(n => n.name)).toEqual(["才旦", "元朵朵"]);
    expect(present.find(n => n.name === "元朵朵")).toMatchObject({ companion: true, party: true, active: true });
    // 雪豹留守在喇嘛庙，不在当前据点：落「不在此地」
    expect(absent).toEqual(["雪豹", "老猎户"]);
  });

  it("shows a stationed companion only in the room where it was left", () => {
    const cs = companions();
    const here = partitionPeople({
      room: { name: "喇嘛庙", npcs: [] }, innerRoomName: "山门", companionState: cs, everSeen: ["雪豹"],
    });
    expect(here.present.map(n => n.name)).toEqual(["元朵朵", "雪豹"]);
    expect(here.present.at(-1)).toMatchObject({ stationed: true });
    expect(here.absent).toEqual([]);
  });

  it("does not duplicate a companion that also sits in room.npcs", () => {
    const { present } = partitionPeople({
      room: { name: "鱼定村", npcs: [{ name: "元朵朵", brief: "旧条目" }] }, innerRoomName: null,
      companionState: companions(), everSeen: [],
    });
    expect(present.filter(n => n.name === "元朵朵")).toHaveLength(1);
  });
});

describe("NpcsModule people lists", () => {
  it("renders the following companion under 此地 even though she is not in room.npcs", () => {
    const html = render({ present: true, absent: false });
    const presentPart = html.split("不在此地")[0];
    expect(presentPart).toContain("元朵朵");
    expect(presentPart).toContain("才旦");
  });

  it("collapses 不在此地 to a header with the count, and expands to list names", () => {
    const collapsed = render({ present: true, absent: false });
    const absentPart = collapsed.split("不在此地")[1];
    expect(collapsed).toMatch(/▸<\/span><span[^>]*>不在此地/);
    expect(absentPart).toContain("（2）");
    expect(absentPart).not.toContain("老猎户");

    const expanded = render({ present: true, absent: true });
    const expandedPart = expanded.split("不在此地")[1];
    expect(expanded).toMatch(/▾<\/span><span[^>]*>不在此地/);
    expect(expandedPart).toContain("老猎户");
    expect(expandedPart).toContain("行脚僧");
  });

  it("defaults the session store to a collapsed 不在此地 section", () => {
    expect(sessionUiStore.getInitialState().peoplePanel).toEqual({ present: true, absent: false });
  });
});
