import { describe, expect, it, vi } from "vitest";
import { gameStore, initGameStore } from "../../store/gameStore.js";
import { useIntentRouter } from "./useIntentRouter.js";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useCallback: fn => fn,
  useMemo: fn => fn(),
  useState: value => [value, vi.fn()],
  useRef: current => ({ current }),
  useEffect: (fn) => fn(),
}));

function setupRouter({ npcs = [], handleNpcTrade = vi.fn(), handleNpcDuel = vi.fn() } = {}) {
  initGameStore({ flags: [], inv: [], questProgress: {}, room: { name: "曲措乡", npcs }, char: { name: "行旅" } });
  const routerRef = { current: null };
  useIntentRouter(routerRef, {
    apiCfg: {}, act: vi.fn(), addLog: vi.fn(), dispatchCommand: vi.fn((k, fn) => fn?.()),
    handleNpcDuel, handleNpcTrade, setActiveTarget: vi.fn(), setDuelPending: vi.fn(), setTradingShop: vi.fn(),
  });
  return { routerRef, handleNpcTrade, handleNpcDuel };
}

describe("WO-16F-F2c runDeferred 暴露与守卫", () => {
  it("runDeferred 已暴露到 routerRef.current", () => {
    const { routerRef } = setupRouter();
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
    const { routerRef } = setupRouter({ npcs: [{ name: "掌柜" }], handleNpcTrade });
    routerRef.current.runDeferred({ kind: "购买", target: "掌柜" }, true, { skipCaptureUndo: true });
    expect(handleNpcTrade).toHaveBeenCalledTimes(1);
    expect(handleNpcTrade.mock.calls[0][0]?.name).toBe("掌柜");
    expect(handleNpcTrade.mock.calls[0][1]).toEqual({ skipCaptureUndo: true });
  });

  it("DUEL single：opts 同样透传 handleNpcDuel", () => {
    const handleNpcDuel = vi.fn();
    const { routerRef } = setupRouter({ npcs: [{ name: "铁匠" }], handleNpcDuel });
    routerRef.current.runDeferred({ kind: "切磋", target: "铁匠" }, true, { skipCaptureUndo: true });
    expect(handleNpcDuel).toHaveBeenCalledTimes(1);
    expect(handleNpcDuel.mock.calls[0][1]).toEqual({ skipCaptureUndo: true });
  });
});
