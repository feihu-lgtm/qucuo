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
      .toEqual({ active: false, escalated: true, reason: undefined });
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
});
