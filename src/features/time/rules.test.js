import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRngState, setRngState, setSeed } from "../../core/rng.js";
import { makeBuffFlag } from "../../utils/buffSystem.js";
import { timeAdvanceRule } from "./rules.js";

let previousRngState;

beforeEach(() => {
  previousRngState = getRngState();
});

afterEach(() => {
  setRngState(previousRngState);
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
      roomMapRef,
    });

    expect(result.forcedDuelNpc).toBe(npc);
    expect(result.changes.room(state.room).npcs).toEqual([npc]);
    expect(result.roomMap.鱼定村.npcs).toEqual([]);
    expect(result.roomMap.玉泉寨.npcs).toEqual([npc]);
    expect(result.logs).toContainEqual({
      t: "err",
      text: "  猎户一路寻来，堵在你面前——积怒难平，这场恶斗躲不掉了！",
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
      roomMapRef: { current: {} },
      importedRegistry: { getImportedNpc: () => ({ name: "入册旅人", brief: "远道而来的旅人", levelCap: 2 }) },
    });

    expect(result.forcedDuelNpc).toMatchObject({
      name: "入册旅人",
      imported: true,
      moveset: expect.any(Array),
      combatStats: expect.any(Object),
    });
    expect(result.changes.room(state.room).npcs).toHaveLength(1);
  });

  it("lets anger lapse when no NPC record can be found", () => {
    const state = makeState({
      room: { name: "玉泉寨", npcs: [] },
      varTree: { 角色: { 失踪者: { 生气状态: { active: true, turnsLeft: 1 } } } },
    });
    const result = timeAdvanceRule.run(state, {
      firstRun: false,
      previousDeps: [state.time - 1, state.room.npcs],
      roomMapRef: { current: {} },
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
