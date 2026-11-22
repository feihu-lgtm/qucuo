import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRngState, setRngState, setSeed } from "../../../utils/rng.js";
import { createWorldRules } from "../../../engine/worldRules.js";
import { getResidentNpcs } from "../../data/npc/residentNpcs.js";
import { getScheduledNpcs } from "../../data/npc/npcPool.js";
import { travelByCarriage } from "../../../features/buildings/logic.js";
import { timeAdvanceRule } from "../time/rules.js";
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
  it("escort target that is a resident still shows up when an old save cached him elsewhere", () => {
    setSeed(42);
    const state = {
      ...makeState(),
      room: { name: "天都镇", npcs: [] },
      questProgress: { eq_lizhang_tiandu: { active: true } },
    };
    const roomMapRef = { current: { 锦官城: { npcs: [{ name: "李掌柜" }] } } };
    const result = residentNpcRule.run(state, { importedRegistry, roomMapRef });
    const names = result.changes.room(state.room).npcs.map((npc) => npc.name);
    expect(names.filter((n) => n === "李掌柜")).toHaveLength(1);
  });

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

  it("does not reinject a resident after a pursuit moves them to another cached room", () => {
    setSeed(42);
    const homeState = makeState();
    const homeResult = residentNpcRule.run(homeState, { importedRegistry });
    const homeNpcs = homeResult.changes.room(homeState.room).npcs;
    const residentName = getResidentNpcs("鱼定村")[0].name;
    const roomMapRef = { current: { 鱼定村: { items: [], npcs: homeNpcs } } };
    const awayState = {
      ...makeState(),
      time: 31,
      room: { name: "玉泉寨", items: [], npcs: [] },
      varTree: { 角色: { [residentName]: { 生气状态: { active: true, turnsLeft: 1 } } } },
    };
    const pursuit = timeAdvanceRule.run(awayState, {
      firstRun: false,
      previousDeps: [30, awayState.room.npcs],
      roomMapRef,
    });
    const homeAgain = {
      ...makeState(),
      room: { ...homeState.room, items: pursuit.roomMap.鱼定村.items, npcs: pursuit.roomMap.鱼定村.npcs },
    };
    const reentry = residentNpcRule.run(homeAgain, {
      importedRegistry,
      roomMapRef: { current: pursuit.roomMap },
    });
    const homeAfterReentry = reentry.changes.room(homeAgain.room).npcs;
    const cachedOccurrences = Object.values(pursuit.roomMap)
      .flatMap((room) => room.npcs || [])
      .filter((npc) => npc.name === residentName);

    expect(homeAfterReentry.some((npc) => npc.name === residentName)).toBe(false);
    expect(cachedOccurrences).toHaveLength(1);
  });

  it("reinjects residents after carriage arrival despite the district's own cache", () => {
    setSeed(42);
    const visitedState = makeState();
    const visitedNpcs = residentNpcRule.run(visitedState, { importedRegistry })
      .changes.room(visitedState.room).npcs;
    const arrivalTime = 11;
    const scheduledNames = new Set(getScheduledNpcs("鱼定村", arrivalTime).map((npc) => npc.name));
    const residentName = getResidentNpcs("鱼定村").find((npc) => !scheduledNames.has(npc.name)).name;
    const carriage = travelByCarriage({
      ...makeState(),
      time: 6,
      room: { name: "玉泉寨", items: [], npcs: [] },
      mapData: { 鱼定村: {} },
      char: { money: 100, special: { 气运: 5 } },
    }, "鱼定村", 5);
    const arrivalState = {
      ...makeState(),
      time: carriage.changes.time,
      room: carriage.changes.room,
    };
    const result = residentNpcRule.run(arrivalState, {
      importedRegistry,
      roomMapRef: { current: { 鱼定村: { items: [], npcs: visitedNpcs } } },
    });

    expect(carriage.changes.room.npcs).toEqual([]);
    expect(visitedNpcs.some((npc) => npc.name === residentName)).toBe(true);
    expect(result.changes.room(arrivalState.room).npcs.some((npc) => npc.name === residentName)).toBe(true);
  });

  it("depends on imported registry revision, quest progress, and flags", () => {
    const deps = residentNpcRule.deps(makeState());
    expect(deps).toEqual(["鱼定村", 0, {}, [], 0]);
  });
});
