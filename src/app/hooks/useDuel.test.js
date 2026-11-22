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
    const aiSummarizeFact = vi.fn();
    const handlers = {};
    function Harness() {
      Object.assign(handlers, useDuel({
        act, addLog, duelPending: null, featureCtxRef,
        setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setDuelingNpc: vi.fn(),
        duelingNpc: npc, pendingQuestBranch: null, noteAction: vi.fn(), jotNote: vi.fn(),
        aiSummarizeFact, setPendingQuestBranch: vi.fn(), captureUndo: vi.fn(),
        turnGenerationRef: { current: 0 }, narrator,
      }));
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    return { handlers, act, addLog, restoreStore, aiSummarizeFact, featureCtxRef };
  }

  it("logs the system fact lines at once and never starts an AI turn", () => {
    const { handlers, act, addLog, restoreStore } = setup({ canAsk: () => false });
    try {
      handlers.duelFinishHandler("win", null, [{ round: 1, teamText: "一招既定" }], null, [], null, []);
      expect(act).not.toHaveBeenCalled();
      const logs = addLog.mock.calls.flatMap(([entries]) => entries || []);
      expect(logs).toContainEqual(expect.objectContaining({ t: "sys", text: expect.stringContaining("第1回合") }));
      expect(logs).toContainEqual(expect.objectContaining({ t: "sys", fillSlot: "end" }));
    } finally {
      restoreStore();
    }
  });

  it("asks for the fact summary inside the battle report instead of a separate call", async () => {
    const ask = vi.fn(async () => '{"rounds":["拳风扑面。"],"ending":"才旦认输。","summary":"你与才旦切磋得胜"}');
    const { handlers, restoreStore, aiSummarizeFact, featureCtxRef } = setup({ canAsk: () => true, ask });
    const setVarTree = vi.fn(featureCtxRef.current.setVarTree);
    featureCtxRef.current.setVarTree = setVarTree;
    try {
      handlers.duelFinishHandler("win", null, [{ round: 1, teamText: "一招既定" }], null, [], null, []);
      await vi.waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
      expect(ask.mock.calls[0][0]).toContain('"summary"');
      expect(aiSummarizeFact).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(gameStore.getState().log.some((entry) => entry.fillProse)).toBe(true));
      await vi.waitFor(() => expect(setVarTree).toHaveBeenCalled());
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
      await vi.waitFor(() => expect(gameStore.getState().log.some((entry) => entry.fillProse)).toBe(true));
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
  const rounds = [{ round: 1, text: "你一拳直捣中宫，老孙侧身没能卸开" }];
  const factLog = [{ t: "sys", text: "  第1回合", fillKey: "k", fillSlot: 0 }, { t: "sys", text: "  结局 胜", fillKey: "k", fillSlot: "end" }];
  const applied = (setLog) => setLog.mock.calls[0][0](factLog);

  it("leaves the log alone when the AI fails and no phrase text exists", async () => {
    const setLog = vi.fn();
    await expect(narrateDuelInBackground("k", [], { outcomeText: "胜" }, { canAsk: () => true, ask: async () => null, setLog })).resolves.toBe(false);
    expect(setLog).not.toHaveBeenCalled();
  });

  it("falls back to phrase-pool lines without an API key", async () => {
    const setLog = vi.fn();
    const ask = vi.fn();
    await expect(narrateDuelInBackground("k", rounds, { outcomeText: "胜" }, { canAsk: () => false, ask, setLog })).resolves.toBe("phrase");
    expect(ask).not.toHaveBeenCalled();
    expect(applied(setLog).map((entry) => entry.text)).toEqual(["  第1回合", "  你一拳直捣中宫，老孙侧身没能卸开", "  结局 胜"]);
  });

  it("falls back to phrase-pool lines when the AI call throws", async () => {
    const setLog = vi.fn();
    await expect(narrateDuelInBackground("k", rounds, {}, { canAsk: () => true, ask: async () => { throw new Error("down"); }, setLog })).resolves.toBe("phrase");
    expect(applied(setLog)[1].fillProse).toBe(true);
  });

  it("waits for a live stream before inserting phrase-pool lines", async () => {
    let log = [...factLog, { t: "desc", text: "  ▌", streaming: true }];
    let calls = 0;
    const setLog = (fn) => {
      if (++calls === 2) log = log.map((entry) => ({ ...entry, streaming: false }));
      log = fn(log);
    };
    await expect(narrateDuelInBackground("k", rounds, {}, { canAsk: () => false, setLog, retryMs: 0 })).resolves.toBe("phrase");
    expect(calls).toBe(2);
    expect(log.map((entry) => entry.text)).toEqual(["  第1回合", "  你一拳直捣中宫，老孙侧身没能卸开", "  结局 胜", "  ▌"]);
  });

  it("saves the fact summary from the same reply", async () => {
    const setLog = vi.fn();
    const saveSummary = vi.fn();
    const ask = async () => '{"rounds":["拳来脚往。"],"ending":"收势。","summary":"你与老孙切磋得胜"}';
    await expect(narrateDuelInBackground("k", rounds, { factId: "f1" }, { canAsk: () => true, ask, setLog, saveSummary })).resolves.toBe("ai");
    expect(saveSummary).toHaveBeenCalledWith("f1", "你与老孙切磋得胜");
  });

  it("keeps the structured summary when the report fails", async () => {
    const saveSummary = vi.fn();
    await narrateDuelInBackground("k", rounds, { factId: "f1" }, { canAsk: () => true, ask: async () => null, setLog: vi.fn(), saveSummary, retryMs: 0 });
    expect(saveSummary).not.toHaveBeenCalled();
  });

  it("prefers AI prose when it parses", async () => {
    const setLog = vi.fn();
    const ask = async () => JSON.stringify({ rounds: ["拳风呼呼"], ending: "老孙认输" });
    await expect(narrateDuelInBackground("k", rounds, {}, { canAsk: () => true, ask, setLog })).resolves.toBe("ai");
    expect(applied(setLog).map((entry) => entry.text)).toEqual(["  第1回合", "  拳风呼呼", "  结局 胜", "  老孙认输"]);
  });
});

describe("端详门槛", () => {
  function setupGate() {
    const npc = { name: "才旦", id: "caidan", levelCap: 1 };
    const restoreStore = freshStore({
      room: { name: "鱼定村", npcs: [npc], items: [] },
      char: { name: "测试主角", hp: [10, 10] },
      varTree: { 角色: {}, 世界: {} },
      pot: 0, inv: [], skills: [], flags: [], questProgress: {}, time: 1, log: [],
    });
    const addLog = vi.fn();
    const act = vi.fn();
    const setDuelPending = vi.fn();
    const featureCtxRef = { current: { setVarTree: gameActions.setVarTreeState, addLog, gameActions } };
    const handlers = {};
    function Harness() {
      Object.assign(handlers, useDuel({
        act, addLog, duelPending: null, featureCtxRef,
        setActiveTarget: vi.fn(), setDuelPending, setDuelingNpc: vi.fn(),
        duelingNpc: null, pendingQuestBranch: null, noteAction: vi.fn(), jotNote: vi.fn(),
        aiSummarizeFact: vi.fn(), setPendingQuestBranch: vi.fn(), captureUndo: vi.fn(),
        turnGenerationRef: { current: 0 }, narrator: { canAsk: () => false },
      }));
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    return { npc, handlers, act, setDuelPending, restoreStore };
  }

  it("looks at an un-looked NPC instead of opening the duel, then duels on the next click", async () => {
    const { npc, handlers, act, setDuelPending, restoreStore } = setupGate();
    try {
      await handlers.handleNpcDuel(npc);
      expect(act).toHaveBeenCalledWith("look caidan", expect.any(Array), expect.objectContaining({ inspect: true }));
      expect(setDuelPending).not.toHaveBeenCalled();
      expect(gameStore.getState().varTree.世界.端详过人物).toContain("才旦");
      await handlers.handleNpcDuel(npc);
      expect(setDuelPending).toHaveBeenCalledWith(npc);
    } finally {
      restoreStore();
    }
  });
});
