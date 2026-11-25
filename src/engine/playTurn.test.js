import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE, turnMonitor } from "../infra/turnMonitor.js";
import { gameActions, gameStore, subscribeGameReplaced } from "../store/gameStore.js";
import { commitRound } from "./act/commitRound.js";
import { runShadowJudge } from "./act/shadow/shadowJudge.js";
import { runTurn } from "./runTurn.js";
import { playTurn } from "./playTurn.js";
import { createMockAi } from "./ports/ai.js";

vi.mock("./act/commitRound.js", () => ({ commitRound: vi.fn() }));
vi.mock("./runTurn.js", () => ({ runTurn: vi.fn() }));
vi.mock("./act/shadow/shadowJudge.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runShadowJudge: vi.fn(() => Promise.resolve(null)) };
});

function makeContext(overrides = {}) {
  return {
    apiCfg: { bookkeepEnabled: true },
    ai: { chat: vi.fn() },
    commitDeps: () => ({}),
    getGameState: () => gameStore.getState(),
    gameActions,
    subscribeGameReplaced,
    _trace: turnMonitor.start("测试行动"),
    ...overrides,
  };
}

function refBackedSetter(varTreeRef) {
  return (next) => {
    const value = typeof next === "function" ? next(varTreeRef.current) : next;
    varTreeRef.current = value;
    gameActions.setVarTreeState(value);
  };
}

const originalVarTree = gameStore.getState().varTree;

describe("playTurn background bookkeep", () => {
  beforeEach(() => {
    runTurn.mockReset();
    commitRound.mockReset();
    commitRound.mockReturnValue({});
  });

  afterEach(() => {
    gameActions.setVarTreeState(originalVarTree);
    turnMonitor.clear();
  });

  it("calls the injected hook once after a successful commit", async () => {
    const turn = { narrativeText: "少侠走进鱼定村。" };
    const bookkeep = vi.fn();
    const setVarTree = vi.fn();
    const commitDeps = vi.fn(() => ({ setVarTree }));
    const ctx = makeContext({ bookkeep, commitDeps });
    runTurn.mockResolvedValue(turn);

    const result = await playTurn(ctx, "进村");

    expect(result).toMatchObject({ ok: true, turn });
    expect(bookkeep).toHaveBeenCalledTimes(1);
    expect(bookkeep.mock.calls[0][0]).toMatchObject({ ctx: { ai: ctx.ai, setVarTree }, turn, opts: {} });
    expect(commitDeps).toHaveBeenCalledOnce();
    expect(bookkeep.mock.calls[0][0].trace.phase).toBe(PHASE.DONE);
  });

  it("does not call the hook for stale or failed turns", async () => {
    const bookkeep = vi.fn();
    runTurn.mockResolvedValueOnce({ stale: true });
    const stale = await playTurn(makeContext({ bookkeep }), "过期行动");
    expect(stale.stale).toBe(true);

    runTurn.mockRejectedValueOnce(new Error("turn failed"));
    const failed = await playTurn(makeContext({ bookkeep }), "失败行动");
    expect(failed.ok).toBe(false);
    expect(bookkeep).not.toHaveBeenCalled();
  });

  it("does not wait for a pending background hook", async () => {
    const bookkeep = vi.fn(() => new Promise(() => {}));
    runTurn.mockResolvedValue({ narrativeText: "少侠走进鱼定村。" });
    let timeout;
    const result = await Promise.race([
      playTurn(makeContext({ bookkeep }), "进村"),
      new Promise((resolve) => { timeout = setTimeout(() => resolve("timeout"), 250); }),
    ]);
    clearTimeout(timeout);

    expect(result).not.toBe("timeout");
    expect(result.ok).toBe(true);
    expect(bookkeep).toHaveBeenCalledTimes(1);
  });

});

describe("WO-16D 影子对账接线", () => {
  beforeEach(() => {
    runTurn.mockReset();
    commitRound.mockReset();
    commitRound.mockReturnValue({});
    runShadowJudge.mockClear();
  });

  const shadowCtx = () => makeContext({
    apiCfg: { bookkeepEnabled: true, extractionEnabled: false, shadowJudgeEnabled: true },
  });

  it("commit 成功后 fire-and-forget 影子（单调用+开开关）", async () => {
    runTurn.mockResolvedValue({ narrativeText: "test" });
    const result = await playTurn(shadowCtx(), "test");
    expect(result.ok).toBe(true);
    expect(runShadowJudge).toHaveBeenCalledTimes(1);
    expect(runShadowJudge.mock.calls[0][0]).toMatchObject({ cmd: "test" });
  });

  it("commit 抛错不跑影子", async () => {
    runTurn.mockResolvedValue({ narrativeText: "test" });
    commitRound.mockImplementation(() => { throw new Error("commit boom"); });
    const result = await playTurn(shadowCtx(), "test");
    expect(result.ok).toBe(false);
    expect(runShadowJudge).not.toHaveBeenCalled();
  });

  it("双调用模式不跑影子", async () => {
    runTurn.mockResolvedValue({ narrativeText: "test" });
    await playTurn(makeContext({
      apiCfg: { extractionEnabled: true, shadowJudgeEnabled: true },
    }), "test");
    expect(runShadowJudge).not.toHaveBeenCalled();
  });

  it("开关关闭不跑影子", async () => {
    runTurn.mockResolvedValue({ narrativeText: "test" });
    await playTurn(makeContext({
      apiCfg: { extractionEnabled: false, shadowJudgeEnabled: false },
    }), "test");
    expect(runShadowJudge).not.toHaveBeenCalled();
  });

  it("settle 回合不跑影子（turnCtx.isSettle 信号）", async () => {
    runTurn.mockResolvedValue({ narrativeText: "test" });
    const ctxSettle = { ...shadowCtx(), isSettle: true };
    await playTurn(ctxSettle, "test");
    expect(runShadowJudge).not.toHaveBeenCalled();
  });

  it("opts.settle 直传也不跑影子（创造模式兜底）", async () => {
    runTurn.mockResolvedValue({ narrativeText: "test" });
    await playTurn(shadowCtx(), "test", { settle: true });
    expect(runShadowJudge).not.toHaveBeenCalled();
  });

  it("stale 回合不跑影子", async () => {
    runTurn.mockResolvedValue({ narrativeText: "test" });
    await playTurn(shadowCtx(), "test", { isStale: undefined });
    // 用 isStale 恒 true 的 ctx
    runShadowJudge.mockClear();
    const ctxStale = { ...shadowCtx(), isStale: () => true };
    const r = await playTurn(ctxStale, "test2");
    expect(runShadowJudge).not.toHaveBeenCalled();
    void r;
  });
});
