import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSnapshot } from "../infra/saves.js";
import { GAME_KEYS, gameActions, gameStore, initGameStore } from "./gameStore.js";
import { snapshotFromStore } from "./persist.js";
import { getRngState, setRngState } from "../utils/rng.js";

afterEach(() => {
  initGameStore({});
  vi.restoreAllMocks();
});

describe("game store", () => {
  it("sets a value", () => {
    initGameStore({ room: { name: "曲措乡" } });

    gameActions.setRoom({ name: "鱼定村" });

    expect(gameStore.getState().room).toEqual({ name: "鱼定村" });
  });

  it("composes sequential functional updates against the latest value", () => {
    initGameStore({ exp: 2 });

    gameActions.setExp((current) => current + 1);
    gameActions.setExp((current) => current * 3);

    expect(gameStore.getState().exp).toBe(9);
  });

  it("resets keys missing from init values to undefined", () => {
    initGameStore({ char: { name: "少侠" }, room: { name: "曲措乡" } });

    initGameStore({ char: { name: "新少侠" } });

    const state = gameStore.getState();
    expect(state.char).toEqual({ name: "新少侠" });
    expect(GAME_KEYS.filter((key) => key !== "char").every((key) => state[key] === undefined)).toBe(true);
    expect(Object.keys(state)).toEqual(GAME_KEYS);
  });

  it("builds the same snapshot as buildSnapshot with stored fields and extra values", () => {
    const values = {
      preset: { id: "test", name: "测试剧本" },
      room: { name: "曲措乡", exits: [], npcs: [], items: [] },
      char: { name: "少侠" },
      dao: { karma: 1 },
      skills: [],
      inv: [],
      log: [],
      convo: [],
      exp: 4,
      pot: 5,
      flags: [],
      mapData: {},
      time: 6,
      narrator: {},
      varTree: {},
      claimedMilestones: new Set(["first"]),
      questProgress: { q1: { count: 1 } },
      deposit: 2,
      depositedAt: null,
      pledgedItems: [],
      persuasionProgress: { q1: { turns: 1 } },
      innerRoomName: "村口",
      companionState: { active: false },
    };
    const extra = { squares: { day: 1 }, roomMap: { 曲措乡: { items: [], npcs: [] } } };
    vi.spyOn(Date, "now").mockReturnValue(1234);
    initGameStore(values);
    setRngState(0);

    const snapshot = snapshotFromStore(extra);
    expect(snapshot).toEqual(buildSnapshot({ ...values, ...extra, rngState: getRngState() }));
    expect(snapshot.rngState).toBe(0);
  });
});
