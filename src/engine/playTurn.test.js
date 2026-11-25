import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE, turnMonitor } from "../infra/turnMonitor.js";
import { gameActions, gameStore, subscribeGameReplaced } from "../store/gameStore.js";
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
      { t: "affection", text: "  💗 八云 好感度 +3（20 → 23）" },
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

  it.each([[0, 22, 2], [10, 24, 4]])(
    "applies effective charm %i to the affection gain",
    async (charm, expectedFavor, expectedDelta) => {
      const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
      gameActions.setVarTreeState(varTree);
      const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
      const addLog = vi.fn();
      runTurn.mockResolvedValue({ narrativeText: "八云的神情缓和下来。" });

      await playTurn(makeContext({
        ai, apiCfg: {}, bookkeep: false, effectiveSpecialNow: { 魅力: charm },
        commitDeps: () => ({ addLog }),
      }), "赔罪", { settle: true, settleKind: "appease", settleNpc: "八云" });

      expect(gameStore.getState().varTree.角色.八云.好感度).toBe(expectedFavor);
      expect(addLog.mock.calls.flatMap(([entries]) => entries)).toContainEqual({
        t: "affection",
        text: `  💗 八云 好感度 +${expectedDelta}（20 → ${expectedFavor}）`,
      });
    },
  );

  it("keeps a ref-backed setter current for the commit's functional update", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
    gameActions.setVarTreeState(varTree);
    const varTreeRef = { current: varTree };
    const setVarTree = refBackedSetter(varTreeRef);
    const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
    let commitTree;
    runTurn.mockResolvedValue({ narrativeText: "八云的神情缓和下来。" });
    commitRound.mockImplementation(({ setVarTree: commitSetVarTree }) => {
      commitSetVarTree((prev) => {
        commitTree = prev;
        return prev;
      });
    });

    await playTurn(makeContext({
      ai, apiCfg: {}, bookkeep: false, setVarTree, refs: { varTreeRef },
      commitDeps: () => ({ setVarTree }),
    }), "赔罪", { settle: true, settleKind: "appease", settleNpc: "八云" });

    expect(varTreeRef.current.角色.八云).toMatchObject({
      好感度: 23,
      生气状态: { active: false, resolvedBy: "persuasion" },
    });
    expect(commitTree).toBe(varTreeRef.current);
  });

  it("applies successful settlement deltas to the latest tree", async () => {
    const varTree = {
      角色: { 八云: { 好感度: 20, 生气状态: { active: true } } },
      世界: { 威望: 0 },
    };
    gameActions.setVarTreeState(varTree);
    const varTreeRef = { current: varTree };
    const setVarTree = refBackedSetter(varTreeRef);
    const started = Promise.withResolvers();
    const response = Promise.withResolvers();
    const softSettle = vi.fn(({ ctx: settleCtx }) => {
      started.resolve(settleCtx);
      return response.promise;
    });
    runTurn.mockResolvedValue({ narrativeText: "八云的神情缓和下来。" });
    const pending = playTurn(makeContext({
      apiCfg: {}, bookkeep: false, setVarTree, refs: { varTreeRef }, softSettle,
      commitDeps: () => ({ setVarTree }),
    }), "赔罪", { settle: true, settleKind: "appease", settleNpc: "八云" });

    const settleCtx = await started.promise;
    expect(settleCtx.varTree).toBe(varTree);
    const bookkeptTree = {
      ...varTree,
      角色: { ...varTree.角色, 八云: { ...varTree.角色.八云, 旧账: { lines: ["后台记下的旧账"] } } },
    };
    setVarTree(bookkeptTree);
    const ledger = { dayStamp: 0, gained: { 八云: 3 } };
    response.resolve({
      choice: "奏效",
      note: "八云消了气",
      deltas: [
        { path: "角色.八云.生气解除", op: "set", value: true, finalValue: true },
        { path: "角色.八云.好感度", op: "add", value: 3, actualDelta: 3, finalValue: 23 },
        { path: "世界.好感日增", op: "set", value: ledger, finalValue: ledger },
      ],
      varTree: { 角色: { 八云: { 好感度: 23, 生气解除: true, 生气状态: { active: true } } } },
    });

    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(varTreeRef.current.角色.八云).toEqual({
      好感度: 23,
      生气状态: { active: false, resolvedBy: "persuasion" },
      旧账: { lines: ["后台记下的旧账"] },
    });
    expect(varTreeRef.current.世界.好感日增).toEqual(ledger);
  });

  it("preserves concurrent writes when appeasement does not work", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
    gameActions.setVarTreeState(varTree);
    const varTreeRef = { current: varTree };
    const setVarTree = refBackedSetter(varTreeRef);
    const started = Promise.withResolvers();
    const response = Promise.withResolvers();
    const softSettle = vi.fn(() => {
      started.resolve();
      return response.promise;
    });
    runTurn.mockResolvedValue({ narrativeText: "八云仍不肯原谅。" });
    const pending = playTurn(makeContext({
      apiCfg: {}, bookkeep: false, setVarTree, refs: { varTreeRef }, softSettle,
      commitDeps: () => ({ setVarTree }),
    }), "赔罪", { settle: true, settleKind: "appease", settleNpc: "八云" });

    await started.promise;
    const bookkeptTree = {
      ...varTree,
      角色: { ...varTree.角色, 八云: { ...varTree.角色.八云, 旧账: { lines: ["后台记下的旧账"] } } },
    };
    setVarTree(bookkeptTree);
    response.resolve({ choice: "未奏效", note: "仍在气头上", deltas: [], varTree });

    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(varTreeRef.current).toBe(bookkeptTree);
    expect(varTreeRef.current.角色.八云.旧账).toEqual({ lines: ["后台记下的旧账"] });
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
    const varTreeRef = { current: varTree };
    const setVarTree = refBackedSetter(varTreeRef);
    const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
    runTurn.mockRejectedValue(new Error("narration failed"));

    const result = await playTurn(makeContext({
      ai, apiCfg: {}, bookkeep: false, setVarTree, refs: { varTreeRef },
    }), "赔罪", {
      settle: true, settleKind: "appease", settleNpc: "八云",
    });

    expect(result.ok).toBe(false);
    // WO-06：事务快照只覆盖 store；refs 已清退，不再参与回滚断言
    expect(gameStore.getState().varTree).toBe(varTree);
  });

  it("preserves an undo-restored tree when runTurn becomes stale", async () => {
    const varTree = { 角色: { 八云: { 好感度: 20, 生气状态: { active: true } } } };
    gameActions.setVarTreeState(varTree);
    const varTreeRef = { current: varTree };
    const setVarTree = refBackedSetter(varTreeRef);
    const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
    const started = Promise.withResolvers();
    const response = Promise.withResolvers();
    runTurn.mockImplementation(() => {
      started.resolve();
      return response.promise;
    });
    const generation = { current: 0 };
    const pending = playTurn(makeContext({
      ai, apiCfg: {}, bookkeep: false, setVarTree, refs: { varTreeRef },
      isStale: () => generation.current !== 0,
    }), "赔罪", {
      settle: true, settleKind: "appease", settleNpc: "八云",
    });
    await started.promise;
    const restoredTree = {
      角色: { 八云: { 好感度: 12, 生气状态: { active: true }, 旧账: { lines: ["撤销后状态"] } } },
    };
    setVarTree(restoredTree);
    generation.current += 1;
    response.resolve({ stale: true });

    const result = await pending;

    expect(result.stale).toBe(true);
    expect(gameStore.getState().varTree).toBe(restoredTree);
    expect(varTreeRef.current).toBe(restoredTree);
  });

  it.each([["without concurrent writes", false], ["with concurrent 旧账", true]])(
    "reverts stopped settlement %s",
    async (_label, writeLedger) => {
      const varTree = {
        角色: { 八云: { 好感度: 20, 生气状态: { active: true, reason: "偷窃未遂" } } },
        世界: { 威望: 0 },
      };
      gameActions.setVarTreeState(varTree);
      const varTreeRef = { current: varTree };
      const setVarTree = refBackedSetter(varTreeRef);
      const ai = createMockAi(['{"choice":"奏效","probs":{"奏效":0.9,"未奏效":0.1}}']);
      const started = Promise.withResolvers();
      const response = Promise.withResolvers();
      let stopped = false;
      runTurn.mockImplementation(() => {
        started.resolve();
        return response.promise;
      });
      const pending = playTurn(makeContext({
        ai, apiCfg: {}, bookkeep: false, setVarTree, refs: { varTreeRef },
        isStale: () => stopped,
      }), "赔罪", { settle: true, settleKind: "appease", settleNpc: "八云" });

      await started.promise;
      if (writeLedger) {
        const settledTree = varTreeRef.current;
        setVarTree({
          ...settledTree,
          角色: {
            ...settledTree.角色,
            八云: { ...settledTree.角色.八云, 旧账: { lines: ["后台记下的旧账"] } },
          },
        });
      }
      stopped = true;
      response.resolve({ narrativeText: "八云的神情缓和下来。" });

      const result = await pending;

      expect(result.stale).toBe(true);
      expect(gameStore.getState().varTree.角色.八云.好感度).toBe(20);
      expect(gameStore.getState().varTree.角色.八云.生气状态).toEqual(varTree.角色.八云.生气状态);
      expect(gameStore.getState().varTree.角色.八云).not.toHaveProperty("生气解除");
      expect(gameStore.getState().varTree.世界).not.toHaveProperty("好感日增");
      if (!writeLedger) expect(varTreeRef.current).toEqual(varTree);
      else expect(varTreeRef.current.角色.八云.旧账).toEqual({ lines: ["后台记下的旧账"] });
    },
  );

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
