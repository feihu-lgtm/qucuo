import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { gameActions, gameStore, initGameStore, markGameReplaced, subscribeGameReplaced } from "../core/gameStore.js";
import { createWorldRules } from "../engine/worldRules.js";
import { applyResult } from "../features/run.js";
import { timeAdvanceRule } from "../features/time/rules.js";

// 回归：网页读一个更早时间的存档时，time.advance 曾把读档造成的时间跳变当成过了一回合，
// 存档里 NPC 的愤怒回合被多扣一次（issue #3）。整局替换必须清掉世界规则的依赖历史。

const angry = (turnsLeft) => ({ active: true, reason: "偷窃未遂", turnsLeft });
const anger = () => gameStore.getState().varTree?.角色?.才旦?.生气状态;
const savedState = () => ({
  time: 6,
  room: { name: "曲措乡", npcs: [] },
  flags: [],
  inv: [],
  varTree: { 角色: { 才旦: { 生气状态: angry(3) } } },
});

let disconnect = () => {};

function connectRunner() {
  const runner = createWorldRules([timeAdvanceRule], {
    getState: gameStore.getState,
    applyResult: (result) => applyResult({ setVarTree: gameActions.setVarTreeState, addLog: () => {} }, result),
  });
  const unsubscribeReplaced = subscribeGameReplaced(() => runner.reset());
  disconnect = unsubscribeReplaced;
  return runner;
}

function playTwoTurns(runner) {
  runner.check();
  gameActions.setTime(7);
  runner.check();
  gameActions.setTime(8);
  runner.check();
  expect(anger().turnsLeft).toBe(1);
}

function loadEarlierSave(runner, { replaced = true } = {}) {
  const snap = savedState();
  gameActions.setTime(snap.time);
  gameActions.setVarTreeState(snap.varTree);
  if (replaced) markGameReplaced();
  runner.check();
}

afterEach(() => {
  disconnect();
  initGameStore({});
});

describe("loading a save resets world rule history", () => {
  it("keeps the saved anger counter after loading an earlier-time save", () => {
    initGameStore(savedState());
    const runner = connectRunner();
    playTwoTurns(runner);

    loadEarlierSave(runner);

    expect(gameStore.getState().time).toBe(6);
    expect(anger()).toEqual(angry(3));
  });

  it("would tick the loaded anger once more without the replacement signal", () => {
    initGameStore(savedState());
    const runner = connectRunner();
    playTwoTurns(runner);

    loadEarlierSave(runner, { replaced: false });

    expect(anger().turnsLeft).toBe(2);
  });

  it("treats a whole-store init (start-screen load, autosave restore) as a replacement", () => {
    initGameStore(savedState());
    const runner = connectRunner();
    playTwoTurns(runner);

    initGameStore(savedState());
    runner.check();

    expect(anger()).toEqual(angry(3));
  });

  it("ticks normally again after the load", () => {
    initGameStore(savedState());
    const runner = connectRunner();
    playTwoTurns(runner);
    loadEarlierSave(runner);

    gameActions.setTime(7);
    runner.check();

    expect(anger().turnsLeft).toBe(2);
  });
});

describe("web load paths signal a game replacement", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const between = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    expect(from, start).toBeGreaterThanOrEqual(0);
    expect(to, end).toBeGreaterThan(from);
    return source.slice(from, to);
  };

  it("the web world rules runner resets on replacement", () => {
    const source = read("./hooks/useWorldRulesRunner.js");
    expect(source).toMatch(/subscribeGameReplaced\(\(\) => worldRulesRunnerRef\.current\.reset\(\)\)/);
    expect(source).toContain("unsubscribeReplaced();");
  });

  it("start-screen load and autosave restore go through initGameStore", () => {
    expect(read("./hooks/useGameStartup.js")).toContain("initGameStore(buildInitialGameState(restored))");
    expect(read("../core/gameStore.js")).toMatch(/export function initGameStore[\s\S]*?markGameReplaced\(\);\n\}/);
  });

  it("Settings load (applySnapshot) and new game (loadPreset) mark the replacement", () => {
    const source = read("./hooks/useAutosave.js");
    expect(between(source, "const applySnapshot", "const loadPreset")).toContain("markGameReplaced();");
    expect(between(source, "const loadPreset", "scheduler.runSilently(startPreset)")).toContain("markGameReplaced();");
  });

  it("character creation marks the replacement", () => {
    const source = read("./hooks/useCardImportHandlers.js");
    expect(between(source, "const handleCreateCharacter", "closeOverlay(OVERLAY.CHAR_CREATE)")).toContain("markGameReplaced();");
  });
});
