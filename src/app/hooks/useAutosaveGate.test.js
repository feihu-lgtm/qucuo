import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave.js";
import { autoSave } from "../../infra/saves.js";
import { noteRoundCompleted, noteAutosaveSaved, resetAutosaveProgress, getRoundsSinceLastSave } from "../../features/autosaveScheduler.js";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useCallback: fn => fn,
  useMemo: fn => fn(),
  useState: value => [value, vi.fn()],
  useRef: current => ({ current }),
  // 契约测试只关心「自动存档 effect」的触发/跳过条件：把每个 effect 的回调存起来手动调，
  // 第 0 个是挂载接线（arm 监听 + 建 scheduler），第 1 个就是自动存档判定。
  useEffect: (fn) => { capturedEffects.push(fn); },
}));
vi.mock("../../infra/saves.js", async (importOriginal) => ({
  ...await importOriginal(),
  autoSave: vi.fn(() => ({ ok: true })),
  buildSnapshot: vi.fn(() => ({ fake: "snapshot" })),
}));
vi.mock("../../features/autosaveScheduler.js", async (importOriginal) => ({
  ...await importOriginal(),
  createAutosaveScheduler: vi.fn((cfg) => {
    capturedSchedulerCfg = cfg;
    return {
      dispose: vi.fn(), runSilently: (fn) => fn(),
      touch: vi.fn(), resetPlayed: vi.fn(), flushNow: vi.fn(),
    };
  }),
}));

const capturedEffects = [];
let capturedSchedulerCfg = null;

function useTestAutosave({ autoSaveEvery = 5 } = {}) {
  capturedEffects.length = 0;
  const apiCfg = { autoSaveEvery };
  const hook = useAutosave({
    apiCfg,
    loadingRef: { current: false },
    pendingTalksRef: { current: 0 },
    restoredInnerRef: { current: null },
    presets: [],
    setGm: vi.fn(),
    setVarTree: vi.fn(),
  });
  // effect[0] 是挂载接线：注册 arm 监听并创建 scheduler——跑它需要最薄的 window stub。
  capturedEffects[0]();
  return { hook, runAutosaveEffect: () => capturedEffects[1](), schedulerCfg: capturedSchedulerCfg };
}

globalThis.window = { addEventListener: vi.fn(), removeEventListener: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  capturedSchedulerCfg = null;
  resetAutosaveProgress();
});

describe("useAutosave 存档 effect 的触发条件", () => {
  // 契约：本次会话还没行动过（playedThisSessionRef=false）→ 绝不写档，防止覆盖旧自动档。
  it("never saves before the session has played", () => {
    const { runAutosaveEffect } = useTestAutosave();

    runAutosaveEffect();

    expect(autoSave).not.toHaveBeenCalled();
  });

  // 契约：行动过但本回合数计数为 0（没有真走完一轮）→ 不写档；
  // varTree 等依赖变化本身不算一轮。
  it("skips saving when no round has committed since the last save", () => {
    const { hook, runAutosaveEffect, schedulerCfg } = useTestAutosave();
    schedulerCfg.onPlayed();

    // WO-06：计数收进 autosaveScheduler 模块状态——零轮即不存
    runAutosaveEffect();

    expect(autoSave).not.toHaveBeenCalled();
    expect(getRoundsSinceLastSave()).toBe(0);
  });

  // 契约：回合数未达 autoSaveEvery 间隔 → 跳过；达到 → 存档并归零计数。
  it("saves only once the every-interval is reached", () => {
    const { hook, runAutosaveEffect, schedulerCfg } = useTestAutosave({ autoSaveEvery: 5 });
    schedulerCfg.onPlayed();

    for (let i = 0; i < 3; i += 1) noteRoundCompleted();
    runAutosaveEffect();
    expect(autoSave).not.toHaveBeenCalled();

    for (let i = 0; i < 2; i += 1) noteRoundCompleted();
    runAutosaveEffect();
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(getRoundsSinceLastSave()).toBe(0);
  });

  // 契约：autoSaveEvery=0（每回合都存）也要过「确有一轮 commit」这道闸——
  // 内层移动等不走 AI 的动作写 varTree 不触发全量落盘。
  it("still requires a committed round when autoSaveEvery is 0", () => {
    const { hook, runAutosaveEffect, schedulerCfg } = useTestAutosave({ autoSaveEvery: 0 });
    schedulerCfg.onPlayed();

    runAutosaveEffect();
    expect(autoSave).not.toHaveBeenCalled();

    noteRoundCompleted();
    runAutosaveEffect();
    expect(autoSave).toHaveBeenCalledTimes(1);
  });
});
