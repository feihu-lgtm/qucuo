import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRngState, setRngState, setSeed } from "../../../utils/rng.js";
import { makeBuffFlag } from "../../../utils/buffSystem.js";
import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { clearImported, getImportedNpc, registerImported } from "../cards/importedRegistry.js";
import { timeAdvanceRule } from "./rules.js";

let previousRngState;

beforeEach(() => {
  previousRngState = getRngState();
  clearImported();
});

afterEach(() => {
  setRngState(previousRngState);
  clearImported();
});

const makeState = (overrides = {}) => ({
  time: 30,
  room: { npcs: [{ name: "猎户" }] },
  flags: [makeBuffFlag("体魄", 1, 0, 10), "forge_pending_0_5_-"],
  inv: [],
  varTree: { 角色: { 猎户: { 生气状态: { active: true, turnsLeft: 1 } } } },
  ...overrides,
});

describe("time advance world rule", () => {
  it("does not tick the initial mount or a room-only dependency change", () => {
    const state = makeState();

    expect(timeAdvanceRule.run(state, {
      firstRun: true,
      previousDeps: undefined,
    })).toBeNull();
    expect(timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time, []],
    })).toBeNull();
  });

  it("cleans buffs, delivers matured orders, ticks anger, and keeps log order", () => {
    setSeed(42);
    const state = makeState();
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [29, state.room.npcs],
    });

    expect(result.changes.flags(state.flags)).toEqual([]);
    expect(result.changes.inv(state.inv)).toMatchObject([
      { name: "定制长剑", quality: "蓝", id: expect.stringMatching(/^forge_0_/) },
    ]);
    expect(result.changes.varTree(state.varTree).角色.猎户.生气状态)
      .toMatchObject({ active: false, escalated: true, turnsLeft: 1 });
    expect(result.forcedDuelNpc).toBe(state.room.npcs[0]);
    expect(result.logs.map((entry) => entry.t)).toEqual(["item", "err"]);
  });

  it("keeps zero luck when delivering a forge order", () => {
    setSeed(42);
    const state = makeState({
      flags: ["forge_pending_0_0_-"],
      varTree: { 角色: {} },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [29, state.room.npcs],
    });

    expect(result.changes.inv(state.inv)).toMatchObject([
      { name: "定制长剑", quality: "白" },
    ]);
  });

  it("preserves unrelated flags and does not write unchanged anger state", () => {
    const state = makeState({
      time: 12,
      flags: ["story_flag"],
      varTree: { 角色: { 猎户: {} } },
    });

    expect(timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [11, state.room.npcs],
    })).toBeNull();
  });

  it("moves an absent angry NPC from its cached room and forces a duel", () => {
    const npc = {
      name: "猎户",
      id: "hunter",
      innerRoom: "猎户小屋",
      moveset: [],
      carriedItems: [],
      special: {},
      combatStats: { hp: [10, 10] },
    };
    const state = makeState({
      room: { name: "玉泉寨", items: [], npcs: [] },
      varTree: { 角色: { 猎户: { 生气状态: { active: true, turnsLeft: 1, attempts: [] } } } },
    });
    const roomMapRef = { current: { 鱼定村: { items: [], npcs: [npc] } } };
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMap: roomMapRef.current,
    });

    expect(result.forcedDuelNpc).not.toBe(npc);
    expect(result.forcedDuelNpc).toMatchObject({ name: "猎户", id: "hunter" });
    expect(result.forcedDuelNpc).not.toHaveProperty("innerRoom");
    expect(result.forcedDuelNpc).toHaveProperty("pursuitInnerRoom", null);
    expect(result.changes.room(state.room).npcs).toEqual([result.forcedDuelNpc]);
    expect(result.roomMap.鱼定村.npcs).toEqual([]);
    expect(result.roomMap.玉泉寨.npcs).toEqual([result.forcedDuelNpc]);
    expect(result.logs).toContainEqual({
      t: "err",
      text: "  猎户一路寻来，堵在你面前——积怒难平，这场恶斗躲不掉了！",
    });
  });

  it("uses a null pursuit override in districts without inner maps", () => {
    const npc = {
      name: "旧路旅人",
      id: "old-road-traveler",
      innerRoom: "旧住处",
      moveset: [],
      carriedItems: [],
      special: {},
      combatStats: { hp: [10, 10] },
    };
    const state = makeState({
      room: { name: "未建内景据点", items: [], npcs: [] },
      innerRoomName: "村口",
      varTree: { 角色: { 旧路旅人: { 生气状态: { active: true, turnsLeft: 1 } } } },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMap: { 鱼定村: { items: [], npcs: [npc] } },
    });

    expect(result.forcedDuelNpc).toMatchObject({ innerRoom: "村口", pursuitInnerRoom: null });
    expect(isNpcVisibleInInnerRoom("未建内景据点", "村口", result.forcedDuelNpc)).toBe(true);
  });

  it("sets a cached pursuer's inner room to the player's room and keeps it visible", () => {
    const npc = {
      name: "远道旅人",
      id: "traveler",
      innerRoom: "玉石料场",
      moveset: [],
      carriedItems: [],
      special: {},
      combatStats: { hp: [10, 10] },
    };
    const state = makeState({
      room: { name: "鱼定村", items: [], npcs: [] },
      innerRoomName: "村口",
      varTree: { 角色: { 远道旅人: { 生气状态: { active: true, turnsLeft: 1 } } } },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMap: { 玉泉寨: { items: [], npcs: [npc] } },
    });

    expect(result.forcedDuelNpc.innerRoom).toBe("村口");
    expect(result.forcedDuelNpc.pursuitInnerRoom).toBe("村口");
    expect(isNpcVisibleInInnerRoom("鱼定村", "村口", result.forcedDuelNpc)).toBe(true);
    expect(npc.innerRoom).toBe("玉石料场");
  });

  it("lets a pursuer override an authored resident room", () => {
    const npc = {
      name: "杂货商人",
      innerRoom: "杂货铺摊位",
      pursuitInnerRoom: "村口",
    };

    expect(isNpcVisibleInInnerRoom("鱼定村", "村口", npc)).toBe(true);
    expect(isNpcVisibleInInnerRoom("鱼定村", "杂货铺摊位", npc)).toBe(false);
  });

  it("pursues an angry NPC hidden in another inner room and updates the existing room entry", () => {
    const npc = {
      name: "杂货商人",
      id: "grocery-merchant",
      innerRoom: "杂货铺摊位",
      moveset: [],
      carriedItems: [],
      special: {},
      combatStats: { hp: [10, 10] },
    };
    const state = makeState({
      room: { name: "鱼定村", items: [], npcs: [npc] },
      innerRoomName: "村口",
      varTree: { 角色: { 杂货商人: { 生气状态: { active: true, turnsLeft: 1 } } } },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMap: { 鱼定村: { items: [], npcs: [npc] } },
    });
    const currentNpcs = result.changes.room(state.room).npcs;

    expect(isNpcVisibleInInnerRoom("鱼定村", "村口", npc)).toBe(false);
    expect(result.forcedDuelNpc).toMatchObject({ innerRoom: "村口", pursuitInnerRoom: "村口" });
    expect(isNpcVisibleInInnerRoom("鱼定村", "村口", result.forcedDuelNpc)).toBe(true);
    expect(isNpcVisibleInInnerRoom("鱼定村", "杂货铺摊位", result.forcedDuelNpc)).toBe(false);
    expect(currentNpcs).toHaveLength(1);
    expect(currentNpcs[0]).toBe(result.forcedDuelNpc);
    expect(result.logs).toContainEqual({
      t: "err",
      text: "  杂货商人一路寻来，堵在你面前——积怒难平，这场恶斗躲不掉了！",
    });
    expect(result.logs).not.toContainEqual({
      t: "err",
      text: "  杂货商人积怒难平，终于按捺不住，径直朝你逼了过来——这场恶斗，躲不掉了！",
    });
  });

  it("uses the imported registry when an imported NPC is absent from the room map", () => {
    const state = makeState({
      room: { name: "玉泉寨", items: [], npcs: [] },
      varTree: { 角色: { 入册旅人: { 生气状态: { active: true, turnsLeft: 1 } } } },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMap: {},
      importedRegistry: { getImportedNpc: () => ({
        id: "imported_入册旅人",
        name: "入册旅人",
        brief: "远道而来的旅人",
        levelCap: 2,
        imported: true,
      }) },
    });

    expect(result.forcedDuelNpc).toMatchObject({
      name: "入册旅人",
      imported: true,
      moveset: expect.any(Array),
      combatStats: expect.any(Object),
    });
    expect(result.changes.room(state.room).npcs).toHaveLength(1);
  });

  it("hydrates an uncached imported pursuer through the room NPC path with equipment intact", () => {
    registerImported([{
      name: "武装旅人",
      brief: "携带自备兵刃的旅人",
      levelCap: 2,
      carry: ["青锋剑", "药包"],
    }]);
    const state = makeState({
      room: { name: "玉泉寨", items: [], npcs: [] },
      varTree: { 角色: { 武装旅人: { 生气状态: { active: true, turnsLeft: 1 } } } },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMap: {},
      importedRegistry: { getImportedNpc },
    });

    expect(result.forcedDuelNpc.carriedItems.map((item) => item.name)).toEqual(
      expect.arrayContaining(["青锋剑", "药包"]),
    );
  });

  it("lets anger lapse when no NPC record can be found", () => {
    const state = makeState({
      room: { name: "玉泉寨", npcs: [] },
      varTree: { 角色: { 失踪者: { 生气状态: { active: true, turnsLeft: 1 } } } },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMap: {},
      importedRegistry: { getImportedNpc: () => null },
    });

    expect(result.forcedDuelNpc).toBeUndefined();
    expect(result.changes.room).toBeUndefined();
    expect(result.logs).toContainEqual({
      t: "sys",
      text: "  失踪者已不知所踪，积怒也随时间不了了之。",
    });
    expect(result.changes.varTree(state.varTree).角色.失踪者.生气状态.active).toBe(false);
  });
});
