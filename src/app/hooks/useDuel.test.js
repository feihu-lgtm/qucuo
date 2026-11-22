import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTurnStaleCheck } from "./useUndo.js";
import { consumeDuelRequest, narrateDuelInBackground, openDuelAfterNarration, useDuel } from "./useDuel.js";
import { GAME_KEYS, gameActions, gameStore, initGameStore } from "../../store/gameStore.js";

function freshStore(overrides) {
  const original = structuredClone(gameStore.getState());
  const initial = Object.fromEntries(GAME_KEYS.map((key) => [key, null]));
  initGameStore({ ...initial, ...overrides });
  return () => initGameStore(original);
}

describe("duel invitation", () => {
  it("writes one short system line and opens the confirmation without an AI turn", async () => {
    const npc = { name: "才旦" };
    const addLog = vi.fn();
    const setDuelPending = vi.fn();
    await expect(openDuelAfterNarration({ addLog, setDuelPending, isStale: () => false }, npc)).resolves.toBe(true);
    const [[entries]] = addLog.mock.calls;
    expect(entries).toHaveLength(1);
    expect(entries[0].t).toBe("sys");
    expect(entries[0].text).toContain("才旦");
    expect(entries[0].text.trim().length).toBeLessThanOrEqual(50);
    expect(setDuelPending).toHaveBeenCalledWith(npc);
  });

  it("does not open the duel banner when rollback invalidates the turn", async () => {
    const turnGenerationRef = { current: 0 };
    const isStale = createTurnStaleCheck(turnGenerationRef);
    turnGenerationRef.current += 1;
    const setDuelPending = vi.fn();
    await expect(openDuelAfterNarration({ addLog: vi.fn(), setDuelPending, isStale }, { name: "守门人" })).resolves.toBe(false);
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
      featureCtxRef: { current: { setVarTree, gameActions } },
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
  function setup(narrator) {
    const npc = { name: "才旦", levelCap: 1 };
    const restoreStore = freshStore({
      room: { name: "鱼定村", npcs: [npc], items: [] },
      char: { name: "测试主角", hp: [10, 10], special: { 气运: 5 } },
      varTree: { 角色: {}, 世界: {} },
      pot: 0, inv: [], skills: [], flags: [], questProgress: {}, time: 1, log: [],
    });
    const addLog = vi.fn((entries) => gameActions.setLog((log) => [...(log || []), ...entries]));
    const act = vi.fn();
    const featureCtxRef = { current: { setVarTree: gameActions.setVarTreeState, addLog, gameActions } };
    const handlers = {};
    function Harness() {
      Object.assign(handlers, useDuel({
        act, addLog, duelPending: null, featureCtxRef,
        setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setDuelingNpc: vi.fn(),
        duelingNpc: npc, pendingQuestBranch: null, noteAction: vi.fn(), jotNote: vi.fn(),
        aiSummarizeFact: vi.fn(), setPendingQuestBranch: vi.fn(), captureUndo: vi.fn(),
        turnGenerationRef: { current: 0 }, narrator,
      }));
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    return { handlers, act, addLog, restoreStore };
  }

  it("logs the system fact lines at once and never starts an AI turn", () => {
    const { handlers, act, addLog, restoreStore } = setup({ canAsk: () => false });
    try {
      handlers.duelFinishHandler("win", null, [{ round: 1, teamText: "一招既定" }], null, [], null, []);
      expect(act).not.toHaveBeenCalled();
      const logs = addLog.mock.calls.flatMap(([entries]) => entries || []);
      expect(logs).toContainEqual(expect.objectContaining({ t: "sys", text: expect.stringContaining("第1回合") }));
      expect(logs).toContainEqual(expect.objectContaining({ t: "sys", duelEnd: true }));
    } finally {
      restoreStore();
    }
  });

  it("inserts the AI lines under their system rows when the narration arrives", async () => {
    let release;
    const ask = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const { handlers, restoreStore } = setup({ canAsk: () => true, ask });
    try {
      handlers.duelFinishHandler("win", null, [{ round: 1, teamText: "一招既定" }], null, [], null, []);
      gameActions.setLog((log) => [...log, { t: "cmd", text: "> 下一场" }]);
      release('{"rounds":["拳风扑面，才旦侧身不及。"],"ending":"才旦抱拳认输。"}');
      await vi.waitFor(() => expect(gameStore.getState().log.some((entry) => entry.duelProse)).toBe(true));
      const texts = gameStore.getState().log.map((entry) => entry.text.trim());
      const round = texts.findIndex((text) => text.startsWith("第1回合"));
      expect(texts[round + 1]).toBe("拳风扑面，才旦侧身不及。");
      expect(texts.indexOf("才旦抱拳认输。")).toBeLessThan(texts.indexOf("> 下一场"));
    } finally {
      restoreStore();
    }
  });
});

describe("narrateDuelInBackground", () => {
  it("leaves the log alone when the AI fails", async () => {
    const setLog = vi.fn();
    await expect(narrateDuelInBackground("k", [], { outcomeText: "胜" }, { canAsk: () => true, ask: async () => null, setLog })).resolves.toBe(false);
    expect(setLog).not.toHaveBeenCalled();
  });
});
