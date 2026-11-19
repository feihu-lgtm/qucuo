import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRngState, setRngState, setSeed } from "../../core/rng.js";
import { createWorldRules } from "../../engine/worldRules.js";
import { getResidentNpcs } from "../../domain/npc/residentNpcs.js";
import { residentNpcRule } from "./rules.js";

const importedRegistry = {
  getImportedForDistrict: () => [],
  getImportedResidentNames: () => [],
};

let previousRngState;

beforeEach(() => {
  previousRngState = getRngState();
});

afterEach(() => {
  setRngState(previousRngState);
});

const makeState = () => ({
  char: { special: { 气运: 5 } },
  companionState: {},
  flags: [],
  importedVer: 0,
  questProgress: {},
  room: { name: "鱼定村", npcs: [] },
  time: 6,
});

function getResidents() {
  const state = makeState();
  const result = residentNpcRule.run(state, { importedRegistry });
  return result.changes.room(state.room).npcs;
}

describe("resident NPC world rule", () => {
  it("injects scheduled and fixed residents with combat data", () => {
    setSeed(42);
    const residents = getResidents();
    const fixedNames = new Set(getResidentNpcs("鱼定村").map((npc) => npc.name));

    expect(residents.some((npc) => fixedNames.has(npc.name))).toBe(true);
    expect(residents.every((npc) => npc.moveset && npc.carriedItems && npc.combatStats)).toBe(true);
  });

  it("produces the same seeded roster and inner-room assignments", () => {
    setSeed(42);
    const first = getResidents().map(({ name, innerRoom }) => [name, innerRoom]);
    setSeed(42);
    const second = getResidents().map(({ name, innerRoom }) => [name, innerRoom]);

    expect(second).toEqual(first);
  });

  it("does not rerun injection when only room.npcs identity changes", () => {
    const state = makeState();
    const rule = { ...residentNpcRule, run: vi.fn(residentNpcRule.run) };
    const runner = createWorldRules([rule], {
      getState: () => state,
      ctx: { importedRegistry },
      applyResult: (result) => {
        state.room = result.changes.room(state.room);
      },
    });

    runner.check();
    state.room = { ...state.room, npcs: [...state.room.npcs] };
    runner.check();

    expect(rule.run).toHaveBeenCalledTimes(1);
  });

  it("reuses hydrated residents without consuming RNG on a later dependency change", () => {
    setSeed(42);
    const state = makeState();
    const first = residentNpcRule.run(state, { importedRegistry });
    state.room = first.changes.room(state.room);
    const checkpoint = getRngState();

    residentNpcRule.run({
      ...state,
      flags: [...state.flags],
      questProgress: { ...state.questProgress },
    }, { importedRegistry });

    expect(getRngState()).toBe(checkpoint);
  });

  it("depends on imported registry revision, quest progress, and flags", () => {
    const deps = residentNpcRule.deps(makeState());
    expect(deps).toEqual(["鱼定村", 0, {}, [], 0]);
  });
});
