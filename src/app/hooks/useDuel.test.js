import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTurnStaleCheck } from "./useUndo.js";
import { consumeDuelRequest, openDuelAfterNarration, useDuel } from "./useDuel.js";
import { GAME_KEYS, gameActions, gameStore, initGameStore } from "../../core/gameStore.js";

function freshStore(overrides) {
  const original = structuredClone(gameStore.getState());
  const initial = Object.fromEntries(GAME_KEYS.map((key) => [key, null]));
  initGameStore({ ...initial, ...overrides });
  return () => initGameStore(original);
}

describe("duel narration rollback", () => {
  it("uses the duel invitation settle without allowing the fight to start", async () => {
    const npc = { name: "才旦" };
    const act = vi.fn().mockResolvedValue(undefined);
    const setDuelPending = vi.fn();
    await expect(openDuelAfterNarration({
      act,
      setDuelPending,
      isStale: () => false,
    }, npc)).resolves.toBe(true);
    expect(act).toHaveBeenCalledWith("向才旦抱拳邀战，请他切磋一番", [], {
      keepUndo: true, settle: true, settleKind: "duel_invite", settleNpc: npc,
    });
    expect(setDuelPending).toHaveBeenCalledWith(npc);
  });

  it("does not open the duel banner when rollback invalidates the response", async () => {
    let releaseNarration;
    const narration = new Promise((resolve) => { releaseNarration = resolve; });
    const turnGenerationRef = { current: 0 };
    const isStale = createTurnStaleCheck(turnGenerationRef);
    const setDuelPending = vi.fn();
    const pending = openDuelAfterNarration({
      act: () => narration,
      setDuelPending,
      isStale,
    }, { name: "守门人" });

    turnGenerationRef.current += 1;
    releaseNarration();
    await expect(pending).resolves.toBe(false);
    expect(setDuelPending).not.toHaveBeenCalled();
  });
});

describe("AI duel request consumption", () => {
  const npc = { name: "才旦" };
  const makeOptions = (overrides = {}) => ({
    opts: {}, isStale: () => false, isTalk: false, interactMode: "action",
    recognize: vi.fn(), setActiveTarget: vi.fn(), setDuelPending: vi.fn(),
    ...overrides,
  });

  it("recognizes the present NPC, selects it, and opens the confirmation bar", () => {
    const options = makeOptions();
    expect(consumeDuelRequest({ ok: true, duelRequest: npc }, options)).toBe(true);
    expect(options.recognize).toHaveBeenCalledWith(npc);
    expect(options.setActiveTarget).toHaveBeenCalledWith(npc.name);
    expect(options.setDuelPending).toHaveBeenCalledWith(npc);
  });

  it("records recognition through the feature context", () => {
    const setVarTree = vi.fn();
    const options = makeOptions({
      recognize: undefined,
      featureCtxRef: { current: { setVarTree } },
    });
    expect(consumeDuelRequest({ ok: true, duelRequest: npc }, options)).toBe(true);
    expect(setVarTree).toHaveBeenCalledWith(expect.any(Function));
  });

  it("ignores talk, whisper, stale, and settle results", () => {
    const ignored = [
      [{ ok: true, duelRequest: npc }, makeOptions({ isTalk: true })],
      [{ ok: true, duelRequest: npc }, makeOptions({ interactMode: "whisper" })],
      [{ ok: true, duelRequest: npc }, makeOptions({ isStale: () => true })],
      [{ ok: true, duelRequest: npc }, makeOptions({ opts: { settle: true } })],
      [{ ok: true, duelRequest: npc }, makeOptions({ opts: { settleKind: "duel_invite" } })],
      [{ ok: true, duelRequest: npc }, makeOptions({ opts: { duelReport: true } })],
      [{ ok: false, duelRequest: npc }, makeOptions()],
    ];
    for (const [result, options] of ignored) {
      expect(consumeDuelRequest(result, options)).toBe(false);
      expect(options.recognize).not.toHaveBeenCalled();
      expect(options.setActiveTarget).not.toHaveBeenCalled();
      expect(options.setDuelPending).not.toHaveBeenCalled();
    }
  });
});

describe("duel battle report", () => {
  it("requests the settled report through a duelReport turn", () => {
    const npc = { name: "才旦", levelCap: 1 };
    const restoreStore = freshStore({
      room: { name: "鱼定村", npcs: [npc], items: [] },
      char: { name: "测试主角", hp: [10, 10], special: { 气运: 5 } },
      varTree: { 角色: {}, 世界: {} },
      pot: 0, inv: [], skills: [], flags: [], questProgress: {}, time: 1,
    });
    vi.useFakeTimers();
    try {
      const addLog = vi.fn();
      const act = vi.fn();
      const featureCtxRef = { current: { setVarTree: gameActions.setVarTreeState, addLog } };
      const handlers = {};
      function Harness() {
        Object.assign(handlers, useDuel({
          act, addLog, duelPending: null, featureCtxRef,
          setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setDuelingNpc: vi.fn(),
          duelingNpc: npc, pendingQuestBranch: null, noteAction: vi.fn(), jotNote: vi.fn(),
          aiSummarizeFact: vi.fn(), setPendingQuestBranch: vi.fn(), captureUndo: vi.fn(),
          turnGenerationRef: { current: 0 },
        }));
        return null;
      }
      renderToStaticMarkup(createElement(Harness));

      handlers.duelFinishHandler("win", null, [], null, [], null, []);
      vi.runOnlyPendingTimers();

      expect(act).toHaveBeenCalledWith(expect.stringContaining("连贯的整场战报"), [], expect.objectContaining({
        silentCmd: true, preserveHp: true, keepUndo: true, duelReport: { rounds: [] },
        duelReportFallback: expect.any(Function),
      }));
    } finally {
      vi.useRealTimers();
      restoreStore();
    }
  });

  it.each([
    ["failed", { ok: false, error: new Error("report failed") }],
    ["stale", { ok: true, stale: true }],
  ])("logs settled system rows when the report turn is %s", async (_label, reportResult) => {
    const npc = { name: "才旦", levelCap: 1 };
    const restoreStore = freshStore({
      room: { name: "鱼定村", npcs: [npc], items: [] },
      char: { name: "测试主角", hp: [10, 10], special: { 气运: 5 } },
      varTree: { 角色: {}, 世界: {} },
      pot: 0, inv: [], skills: [], flags: [], questProgress: {}, time: 1,
    });
    vi.useFakeTimers();
    try {
      const addLog = vi.fn();
      const act = vi.fn((_prompt, _args, options) => {
        options.duelReportFallback();
        return Promise.resolve(reportResult);
      });
      const featureCtxRef = { current: { setVarTree: gameActions.setVarTreeState, addLog } };
      const handlers = {};
      function Harness() {
        Object.assign(handlers, useDuel({
          act, addLog, duelPending: null, featureCtxRef,
          setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setDuelingNpc: vi.fn(),
          duelingNpc: npc, pendingQuestBranch: null, noteAction: vi.fn(), jotNote: vi.fn(),
          aiSummarizeFact: vi.fn(), setPendingQuestBranch: vi.fn(), captureUndo: vi.fn(),
          turnGenerationRef: { current: 0 },
        }));
        return null;
      }
      renderToStaticMarkup(createElement(Harness));

      handlers.duelFinishHandler("win", null, [{ round: 1, teamText: "一招既定" }], null, [], null, []);
      await vi.runOnlyPendingTimersAsync();

      const logs = addLog.mock.calls.flatMap(([entries]) => entries || []);
      expect(logs).toContainEqual(expect.objectContaining({
        t: "sys", text: expect.stringContaining("第1回合"),
      }));
    } finally {
      vi.useRealTimers();
      restoreStore();
    }
  });
});
