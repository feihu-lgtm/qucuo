import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameActions, gameStore, initGameStore, markGameReplaced } from "../../store/gameStore.js";
import { createUndoController } from "./useUndo.js";

const effectEntries = [];
const refs = [];
let refIdx = 0;
let effectIdx = 0;

function flushEffects() {
  for (const entry of effectEntries) {
    if (!entry?.needsRun) continue;
    entry.needsRun = false;
    if (typeof entry.cleanup === "function") entry.cleanup();
    entry.cleanup = entry.fn();
  }
}

function cleanupEffects() {
  for (const entry of effectEntries) {
    if (typeof entry?.cleanup === "function") entry.cleanup();
  }
  effectEntries.length = 0;
  refs.length = 0;
}

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    useCallback: (fn) => fn,
    useDebugValue: () => {},
    useSyncExternalStore: (_sub, getSnapshot) => getSnapshot(),
    useRef: (init) => {
      if (!refs[refIdx]) refs[refIdx] = { current: init };
      return refs[refIdx++];
    },
    useEffect: (fn, deps) => {
      const idx = effectIdx++;
      const prev = effectEntries[idx];
      const changed = !prev
        || deps === undefined
        || prev.deps === undefined
        || deps.length !== prev.deps.length
        || deps.some((d, i) => !Object.is(d, prev.deps[i]));
      effectEntries[idx] = {
        fn,
        deps,
        cleanup: prev?.cleanup,
        needsRun: changed,
      };
    },
  };
  return { ...mocked, default: mocked };
});

vi.mock("zustand", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useStore: (store, selector) => selector(store.getState()),
  };
});

const chatMock = vi.hoisted(() => vi.fn());
vi.mock("../../engine/ports/ai.js", () => ({
  createWebAi: () => ({ chat: chatMock }),
}));

const { useNotes } = await import("./useNotes.js");
const { useDaySummary } = await import("./useDaySummary.js");

function mountDaySummaryHarness({ apiCfg = {}, setVarTree }) {
  const state = {};
  const RenderHarness = () => {
    refIdx = 0;
    effectIdx = 0;
    const notes = useNotes({ apiCfg, setVarTree });
    useDaySummary({ apiCfg, setVarTree, dayMaterialRef: notes.dayMaterialRef, prerunSquares: vi.fn() });
    state.jotNote = notes.jotNote;
    state.dayMaterialRef = notes.dayMaterialRef;
  };
  const flush = () => {
    RenderHarness();
    flushEffects();
  };
  flush();

  const undoSnapshotRef = { current: null };
  const undo = createUndoController({
    undoSnapshotRef,
    buildCurrentSnapshot: () => ({
      time: gameStore.getState().time,
      varTree: structuredClone(gameStore.getState().varTree),
    }),
    applySnapshot: (snap) => {
      gameActions.setTime(snap.time);
      gameActions.setVarTree(snap.varTree);
      markGameReplaced();
    },
    addLog: vi.fn(),
    setQueueCount: vi.fn(),
    autoTravelRef: { current: false },
    queueTimerRef: { current: null },
    setDuelPending: vi.fn(),
    setDuelingNpc: vi.fn(),
    setActiveBuilding: vi.fn(),
    pendingTalksRef: { current: 0 },
    changePendingTalks: vi.fn(),
    talkBusyRef: { current: false },
    setLoading: vi.fn(),
    waitTimerRef: { current: null },
    setWaitSecs: vi.fn(),
    turnGenerationRef: { current: 0 },
  });

  return {
    flush,
    jotNote: (entry) => state.jotNote(entry),
    dayMaterialRef: state.dayMaterialRef,
    ...undo,
  };
}

describe("useDaySummary undo boundary", () => {
  beforeEach(() => {
    cleanupEffects();
    chatMock.mockReset();
    initGameStore({ time: 23, varTree: { 世界: { 日总结: [] } } });
  });

  afterEach(() => {
    cleanupEffects();
    initGameStore({});
  });

  it("preserves yesterday summary across a same-day undo", async () => {
    let resolveAi;
    chatMock.mockImplementation(() => new Promise((r) => { resolveAi = r; }));
    const setVarTree = vi.fn((fn) => gameActions.setVarTree(fn));

    const harness = mountDaySummaryHarness({ setVarTree });
    harness.jotNote({ text: "少侠在村口练剑。" });
    gameActions.setTime(24);
    harness.flush();
    expect(chatMock).toHaveBeenCalledTimes(1);

    // 同日内撤销（从第 1 天 25 回合退回第 1 天 24 回合，不作废昨日总结）
    harness.captureUndo();
    gameActions.setTime(25);
    harness.flush();
    expect(harness.rollbackOneStep()).toBe(true);
    harness.flush();

    resolveAi({ text: "第1日风平浪静。" });
    await vi.waitFor(() => expect(setVarTree).toHaveBeenCalledTimes(1));
    expect(gameStore.getState().varTree.世界.日总结).toHaveLength(1);
    expect(gameStore.getState().varTree.世界.日总结[0].text).toBe("第1日风平浪静。");
  });

  it("discards abandoned summary even after recrossing midnight and restores kept daily notes", async () => {
    let resolveA;
    let resolveB;
    chatMock
      .mockImplementationOnce(() => new Promise((r) => { resolveA = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolveB = r; }));
    const setVarTree = vi.fn((fn) => gameActions.setVarTree(fn));

    initGameStore({ time: 19, varTree: { 世界: { 日总结: [] } } });
    const harness = mountDaySummaryHarness({ setVarTree });

    // 第 19 回合记下要保留的事件，推进到第 23 回合后保存撤销点
    harness.jotNote({ text: "少侠在村口救了一只猫。" });
    gameActions.setTime(23);
    harness.flush();
    harness.captureUndo();

    // 被撤销的一步：写入一条误触笔记并跨过午夜，触发挂起的总结 A
    gameActions.setTime(24);
    harness.jotNote({ text: "被撤销动作记下的误触笔记。" });
    harness.flush();
    expect(chatMock).toHaveBeenCalledTimes(1);

    // 真实走 rollbackOneStep() 回滚到第 23 回合：应还原保留的笔记并永久作废总结 A
    expect(harness.rollbackOneStep()).toBe(true);
    harness.flush();
    expect(harness.dayMaterialRef.current).toEqual([{ turn: 19, text: "少侠在村口救了一只猫。" }]);

    // 不手工回填缓冲，再次跨过第 1 天，触发总结 B，且原料应保留猫笔记并排除误触笔记
    gameActions.setTime(24);
    harness.flush();
    expect(chatMock).toHaveBeenCalledTimes(2);
    const secondPrompt = JSON.stringify(chatMock.mock.calls[1][0]);
    expect(secondPrompt).toContain("少侠在村口救了一只猫。");
    expect(secondPrompt).not.toContain("被撤销动作记下的误触笔记。");

    // 总结 A 在第二次跨天之后才延迟返回：也必须被永久丢弃
    resolveA({ text: "已被撤销的不该落盘总结A。" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(setVarTree).not.toHaveBeenCalled();

    // 只有总结 B 能正常落盘
    resolveB({ text: "重跨后的第1日正确总结B。" });
    await vi.waitFor(() => expect(setVarTree).toHaveBeenCalledTimes(1));
    const summaries = gameStore.getState().varTree.世界.日总结;
    expect(summaries).toHaveLength(1);
    expect(summaries[0].text).toBe("重跨后的第1日正确总结B。");
  });

  it("clears pending notes and stale summary on real game replacement", async () => {
    let resolveAi;
    chatMock.mockImplementationOnce(() => new Promise((r) => { resolveAi = r; }));
    const setVarTree = vi.fn((fn) => gameActions.setVarTree(fn));

    const harness = mountDaySummaryHarness({ setVarTree });
    harness.jotNote({ text: "旧档笔记。" });
    gameActions.setTime(24);
    harness.flush();

    harness.jotNote({ text: "新一天的旧档笔记。" });
    expect(harness.dayMaterialRef.current).toHaveLength(1);

    initGameStore({ time: 1, varTree: { 世界: { 日总结: [] } } });
    expect(harness.dayMaterialRef.current).toEqual([]);

    resolveAi({ text: "切档前残留总结。" });
    await Promise.resolve();
    await Promise.resolve();
    expect(setVarTree).not.toHaveBeenCalled();
  });
});
