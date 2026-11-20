import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gameActions, gameStore, initGameStore, markGameReplaced, subscribeGameReplaced } from "../core/gameStore.js";
import { createAutosaveScheduler } from "../core/autosaveScheduler.js";
import { createWorldRules } from "../engine/worldRules.js";
import { applyResult } from "../features/run.js";
import { derivedMovesetRule } from "../features/skills/rules.js";
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

// 与 useWorldRulesRunner 同构：换局时 reset 并挂起常规检查，等提交后（afterCommit）静默首跑。
function connectRunner(rules = [timeAdvanceRule]) {
  let replaced = false;
  const inner = createWorldRules(rules, {
    getState: gameStore.getState,
    applyResult: (result) => applyResult({ setVarTree: gameActions.setVarTreeState, addLog: () => {} }, result),
  });
  disconnect = subscribeGameReplaced(() => {
    inner.reset();
    replaced = true;
  });
  return {
    check() {
      if (!replaced) inner.check();
    },
    afterCommit(runSilently = (fn) => fn()) {
      if (!replaced) return;
      replaced = false;
      runSilently(() => inner.check());
    },
  };
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
  runner.afterCommit();
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
    runner.afterCommit();

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

describe("replacement first-run writes stay out of autosave", () => {
  it("does not arm the autosave when a silent new game or load re-runs world rules", async () => {
    initGameStore({ ...savedState(), skills: [], char: { name: "旧档侠", moveset: [] } });
    const runner = connectRunner([timeAdvanceRule, derivedMovesetRule]);
    runner.check();
    const timers = { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() };
    const autosave = createAutosaveScheduler({
      subscribe: gameStore.subscribe,
      isArmed: () => true,
      isBusy: () => false,
      save: vi.fn(),
      timers,
    });

    autosave.runSilently(() => {
      gameActions.setChar({ name: "新侠", moveset: [] });
      markGameReplaced();
    });
    runner.check();
    await Promise.resolve();
    runner.afterCommit(autosave.runSilently);
    autosave.dispose();

    expect(timers.setTimeout).not.toHaveBeenCalled();
    expect(gameStore.getState().char.name).toBe("新侠");
    expect(gameStore.getState().char.moveset).not.toBe(undefined);
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
    expect(between(source, "subscribeGameReplaced(() => {", "});")).toMatch(/\.reset\(\);\s*replacedRef\.current = true;/);
    expect(source).toMatch(/if \(!replacedRef\.current\) worldRulesRunnerRef\.current\.check\(\);/);
    expect(source).toMatch(/autosave\.runSilently\(check\)/);
    expect(source).toContain("unsubscribeReplaced();");
    expect(read("./MudRPG.jsx")).toMatch(/useWorldRulesRunner\(\{[^}]*schedulerRef[^}]*\}\)/);
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
