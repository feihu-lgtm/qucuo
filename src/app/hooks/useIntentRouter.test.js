import { describe, expect, it, vi } from "vitest";
import { gameStore, initGameStore } from "../../store/gameStore.js";
import { useIntentRouter } from "./useIntentRouter.js";
import { bindTurnRuntime } from "../../features/turnRuntime.js";
import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../../infra/turnMonitor.js";
bindTurnRuntime({ getTurnContext, PHASE, turnMonitor, withTurnContext });


vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useCallback: fn => fn,
  useMemo: fn => fn(),
  useState: value => [value, vi.fn()],
  useRef: current => ({ current }),
  useEffect: (fn) => fn(),
}));

function useRouterHarness({ npcs = [], handleNpcTrade = vi.fn(), handleNpcDuel = vi.fn() } = {}) {
  initGameStore({ flags: [], inv: [], questProgress: {}, room: { name: "曲措乡", npcs }, char: { name: "行旅" } });
  const routerRef = { current: null };
  useIntentRouter(routerRef, {
    apiCfg: {}, act: vi.fn(), addLog: vi.fn(), dispatchCommand: vi.fn((k, fn) => fn?.()),
    handleNpcDuel, handleNpcTrade, setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setTradingShop: vi.fn(),
  });
  return { routerRef, handleNpcTrade, handleNpcDuel };
}

vi.mock("../../engine/intent/aiClassifier.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    createAiClassifier: () => ({
      recognize: async () => ({ actions: [{ kind: "切磋", target: "珍珠", text: "向珍珠提出切磋，点到为止。", confidence: 0.97 }] }),
    }),
  };
});

describe("WO-16F-F2c runDeferred 暴露与守卫", () => {
  it("runDeferred 已暴露到 routerRef.current", () => {
    const { routerRef } = useRouterHarness();
    expect(typeof routerRef.current?.runDeferred).toBe("function");
  });

  it("BUY single：npc 不在场不进 handler，写系统日志", () => {
    const addLog = vi.fn();
    initGameStore({ flags: [], inv: [], questProgress: {}, room: { name: "曲措乡", npcs: [] }, char: { name: "行旅" } });
    const routerRef = { current: null };
    const handleNpcTrade = vi.fn();
    useIntentRouter(routerRef, {
      apiCfg: {}, act: vi.fn(), addLog, dispatchCommand: vi.fn((k, fn) => fn?.()),
      handleNpcDuel: vi.fn(), handleNpcTrade, setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setTradingShop: vi.fn(),
    });
    routerRef.current.runDeferred({ kind: "购买", target: "不存在的人" }, true, { skipCaptureUndo: true });
    expect(handleNpcTrade).not.toHaveBeenCalled();
    expect(addLog).toHaveBeenCalled();
  });

  it("BUY single：npc 在场调 handler 且 opts 透传（skipCaptureUndo 抵达）", () => {
    const handleNpcTrade = vi.fn();
    const { routerRef } = useRouterHarness({ npcs: [{ name: "掌柜" }], handleNpcTrade });
    routerRef.current.runDeferred({ kind: "购买", target: "掌柜" }, true, { skipCaptureUndo: true });
    expect(handleNpcTrade).toHaveBeenCalledTimes(1);
    expect(handleNpcTrade.mock.calls[0][0]?.name).toBe("掌柜");
    expect(handleNpcTrade.mock.calls[0][1]).toEqual({ skipCaptureUndo: true });
  });

  it("DUEL single：opts 同样透传 handleNpcDuel", () => {
    const handleNpcDuel = vi.fn();
    const { routerRef } = useRouterHarness({ npcs: [{ name: "铁匠" }], handleNpcDuel });
    routerRef.current.runDeferred({ kind: "切磋", target: "铁匠" }, true, { skipCaptureUndo: true });
    expect(handleNpcDuel).toHaveBeenCalledTimes(1);
    expect(handleNpcDuel.mock.calls[0][1]).toEqual({ skipCaptureUndo: true });
  });
});

describe("夜班急修：打字路径 deferred 决斗不再空转", () => {
  it("未端详 NPC 的切磋输入——handleNpcDuel 收到 autoProceedAfterLook", async () => {
    const handleNpcDuel = vi.fn();
    initGameStore({ flags: [], inv: [], questProgress: {}, room: { name: "曲措乡", npcs: [{ name: "珍珠", id: "pearl" }] }, char: { name: "行旅" } });
    const routerRef = { current: null };
    useIntentRouter(routerRef, {
      apiCfg: { intentRecognitionEnabled: true }, act: vi.fn(), addLog: vi.fn(), dispatchCommand: vi.fn((k, fn) => fn?.()),
      handleNpcDuel, handleNpcTrade: vi.fn(), setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setTradingShop: vi.fn(),
    });
    await routerRef.current("向珍珠提出切磋，点到为止。", { _trace: turnMonitor.start("向珍珠提出切磋，点到为止。") });
    expect(handleNpcDuel).toHaveBeenCalledTimes(1);
    expect(handleNpcDuel.mock.calls[0][0]?.name).toBe("珍珠");
    expect(handleNpcDuel.mock.calls[0][1]).toEqual(expect.objectContaining({ autoProceedAfterLook: true }));
  });
});
