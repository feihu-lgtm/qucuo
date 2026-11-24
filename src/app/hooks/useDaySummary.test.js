import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameActions, gameStore, initGameStore, markGameReplaced, markNextReplaceAsUndo } from "../../store/gameStore.js";

const effects = [];
const refs = [];
let refIdx = 0;

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
    useEffect: (fn) => { effects.push(fn); },
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

const { useDaySummary } = await import("./useDaySummary.js");

function createRunner(props) {
  let prevDay = Math.floor((gameStore.getState().time ?? 0) / 24);
  const RenderOnce = () => {
    refIdx = 0;
    effects.length = 0;
    useDaySummary(props);
  };
  const flush = () => {
    RenderOnce();
    const curDay = Math.floor((gameStore.getState().time ?? 0) / 24);
    if (curDay !== prevDay) {
      prevDay = curDay;
      for (const fn of effects) fn();
    }
  };
  RenderOnce();
  effects.length = 0;
  return flush;
}

describe("useDaySummary undo boundary", () => {
  beforeEach(() => {
    refs.length = 0;
    chatMock.mockReset();
    initGameStore({ time: 23, varTree: { 世界: { 日总结: [] } } });
  });

  afterEach(() => {
    initGameStore({});
  });

  it("preserves yesterday summary across a same-day undo", async () => {
    let resolveAi;
    chatMock.mockImplementation(() => new Promise((r) => { resolveAi = r; }));
    const setVarTree = vi.fn((fn) => gameActions.setVarTree(fn));
    const dayMaterialRef = { current: [{ text: "少侠在村口练剑。" }] };

    const flush = createRunner({ apiCfg: {}, setVarTree, dayMaterialRef, prerunSquares: vi.fn() });
    gameActions.setTime(24);
    flush();
    expect(chatMock).toHaveBeenCalledTimes(1);

    // 同日内撤销（仍然停在第 1 天，time=24）
    markNextReplaceAsUndo();
    markGameReplaced();
    resolveAi({ text: "第1日风平浪静。" });
    await vi.waitFor(() => expect(setVarTree).toHaveBeenCalledTimes(1));
    expect(gameStore.getState().varTree.世界.日总结).toHaveLength(1);
  });

  it("discards pending summary on cross-day undo and re-triggers when crossing day again", async () => {
    let resolveAi;
    chatMock.mockImplementationOnce(() => new Promise((r) => { resolveAi = r; }));
    const setVarTree = vi.fn((fn) => gameActions.setVarTree(fn));
    const dayMaterialRef = { current: [{ text: "少侠在村口练剑。" }] };

    const flush = createRunner({ apiCfg: {}, setVarTree, dayMaterialRef, prerunSquares: vi.fn() });
    gameActions.setTime(24);
    flush();

    // 跨天撤销退回第 0 天（time=23）
    markNextReplaceAsUndo();
    gameActions.setTime(23);
    markGameReplaced();
    flush();

    resolveAi({ text: "不该落盘的总结。" });
    await Promise.resolve();
    await Promise.resolve();
    expect(setVarTree).not.toHaveBeenCalled();

    // 重新跨过第 1 天，应能再次触发总结
    chatMock.mockResolvedValueOnce({ text: "重跨后的第1日总结。" });
    dayMaterialRef.current = [{ text: "少侠在村口练剑。" }];
    gameActions.setTime(24);
    flush();
    await vi.waitFor(() => expect(setVarTree).toHaveBeenCalledTimes(1));
    expect(gameStore.getState().varTree.世界.日总结[0].text).toBe("重跨后的第1日总结。");
  });
});
