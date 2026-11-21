import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE, turnMonitor } from "../core/turnMonitor.js";
import { gameActions, gameStore } from "../core/gameStore.js";
import { commitRound } from "./act/commitRound.js";
import { runTurn } from "./runTurn.js";
import { playTurn } from "./playTurn.js";
import { createMockAi } from "./ports/ai.js";

vi.mock("./act/commitRound.js", () => ({ commitRound: vi.fn() }));
vi.mock("./runTurn.js", () => ({ runTurn: vi.fn() }));

function makeContext(overrides = {}) {
  return {
    apiCfg: { bookkeepEnabled: true },
    ai: { chat: vi.fn() },
    commitDeps: () => ({}),
    _trace: turnMonitor.start("测试行动"),
    ...overrides,
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

  it("settles an appease attempt before runTurn and passes the result onward", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true, reason: "偷窃未遂" } } } };
    gameActions.setVarTreeState(varTree);
    const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
    const turn = { narrativeText: "八云的神情缓和下来。" };
    const addLog = vi.fn();
    runTurn.mockResolvedValue(turn);
    const ctx = makeContext({ ai, apiCfg: { bookkeepEnabled: false }, bookkeep: false, commitDeps: () => ({ addLog }) });

    const result = await playTurn(ctx, "郑重赔罪", {
      settle: true, settleKind: "appease", settleNpc: "八云",
    });

    expect(result).toMatchObject({ ok: true, turn });
    expect(gameStore.getState().varTree.角色.八云).toEqual({
      好感度: 23,
      生气状态: { active: false, resolvedBy: "persuasion" },
    });
    expect(gameStore.getState().varTree.角色.八云).not.toHaveProperty("生气解除");
    expect(addLog.mock.calls.flatMap(([entries]) => entries)).toEqual([
      { t: "affection", text: "  💗 八云 好感度 +3（→ 23）" },
      { t: "affection", text: "  ✓ 八云的怒气已经消解，这场风波算是揭过去了。" },
    ]);
    expect(runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ ai }),
      "郑重赔罪",
      expect.objectContaining({ softSettle: expect.objectContaining({ choice: "奏效" }) }),
    );
    expect(commitRound).toHaveBeenCalledWith(
      expect.objectContaining({ softSettle: expect.objectContaining({ choice: "奏效" }) }),
    );
    expect(ctx._trace.nodes.map(({ label }) => label)).toContain("结算·软判定");
  });

  it("leaves the old narrator path intact for unknown, offline, or disabled soft settlement", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
    const opts = { settle: true, settleKind: "appease", settleNpc: "八云" };
    const cases = [
      (() => {
        const onRequest = vi.fn();
        return {
          ai: createMockAi(['{"choice":"无法判断","probs":{"无法判断":1}}'], { onRequest }),
          apiCfg: {},
          onRequest,
          calls: 1,
        };
      })(),
      (() => {
        const onRequest = vi.fn();
        return { ai: createMockAi([], { onRequest }), apiCfg: { offline: true }, onRequest, calls: 0 };
      })(),
      (() => {
        const onRequest = vi.fn();
        return { ai: createMockAi([], { onRequest }), apiCfg: { softSettleEnabled: false }, onRequest, calls: 0 };
      })(),
    ];

    for (const { ai, apiCfg, onRequest, calls } of cases) {
      gameActions.setVarTreeState(varTree);
      runTurn.mockResolvedValueOnce({ narrativeText: "仍由旁白处理。" });
      await playTurn(makeContext({ ai, apiCfg, bookkeep: false }), "赔罪", opts);
      expect(runTurn.mock.calls.at(-1)[2]).not.toHaveProperty("softSettle");
      expect(gameStore.getState().varTree).toBe(varTree);
      expect(onRequest).toHaveBeenCalledTimes(calls);
    }
  });

  it("rolls back the soft-settled tree when runTurn fails", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
    gameActions.setVarTreeState(varTree);
    const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
    runTurn.mockRejectedValue(new Error("narration failed"));

    const result = await playTurn(makeContext({ ai, apiCfg: {}, bookkeep: false }), "赔罪", {
      settle: true, settleKind: "appease", settleNpc: "八云",
    });

    expect(result.ok).toBe(false);
    expect(gameStore.getState().varTree).toBe(varTree);
  });

  it("rolls back the soft-settled tree when runTurn becomes stale", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
    gameActions.setVarTreeState(varTree);
    const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
    runTurn.mockResolvedValue({ stale: true });

    const result = await playTurn(makeContext({ ai, apiCfg: {}, bookkeep: false }), "赔罪", {
      settle: true, settleKind: "appease", settleNpc: "八云",
    });

    expect(result.stale).toBe(true);
    expect(gameStore.getState().varTree).toBe(varTree);
  });

  it("keeps varTree unchanged when appeasement does not work", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
    gameActions.setVarTreeState(varTree);
    const ai = createMockAi(['{"choice":"未奏效","probs":{"奏效":0.1,"未奏效":0.9}}']);
    runTurn.mockResolvedValue({ narrativeText: "八云仍不肯原谅。" });

    await playTurn(makeContext({ ai, apiCfg: {}, bookkeep: false }), "赔罪", {
      settle: true, settleKind: "appease", settleNpc: "八云",
    });

    expect(gameStore.getState().varTree).toBe(varTree);
    expect(runTurn.mock.calls[0][2].softSettle.choice).toBe("未奏效");
  });
});
