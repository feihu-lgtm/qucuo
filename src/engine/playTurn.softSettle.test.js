import { afterEach, describe, expect, it, vi } from "vitest";
import { PHASE, turnMonitor } from "../infra/turnMonitor.js";
import { gameActions, gameStore } from "../store/gameStore.js";
import { runTurn } from "./runTurn.js";
import { playTurn } from "./playTurn.js";
import { runRecall } from "./act/memoryLayer.js";

vi.mock("./act/commitRound.js", () => ({ commitRound: vi.fn() }));
vi.mock("./runTurn.js", () => ({ runTurn: vi.fn() }));
vi.mock("./act/memoryLayer.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runRecall: vi.fn(actual.runRecall) };
});

const originalVarTree = gameStore.getState().varTree;

afterEach(() => { gameActions.setVarTreeState(originalVarTree); });

describe("playTurn soft settle kinds", () => {
  it.each(["gift", "companion_invite", "learn_skill"])(
    "routes %s settles through the same soft settle path",
    async (kind) => {
      gameActions.setVarTreeState({ 角色: { 卓玛: { 好感度: 10 } } });
      const varTreeRef = { current: gameStore.getState().varTree };
      const setVarTree = (next) => {
        const value = typeof next === "function" ? next(varTreeRef.current) : next;
        varTreeRef.current = value;
        gameActions.setVarTreeState(value);
      };
      const softSettle = vi.fn(() => ({
        kind, target: "卓玛", choice: "成了", probs: {},
        deltas: [{ path: "角色.卓玛.好感度", op: "add", value: 3, finalValue: 13 }],
        note: "成了", varTree: gameStore.getState().varTree,
      }));
      runTurn.mockResolvedValue({ narrativeText: "成了。" });
      const ctx = {
        apiCfg: { bookkeepEnabled: false }, ai: { chat: vi.fn() },
        commitDeps: () => ({}), bookkeep: false, softSettle,
        getGameState: () => gameStore.getState(), gameActions,
        setVarTree, refs: { varTreeRef },
        _trace: turnMonitor.start("测试行动"),
      };

      await playTurn(ctx, "招呼一声", {
        settle: true, settleKind: kind, settleNpc: "卓玛",
        giftInfo: { itemName: "青稞酒" }, learnInfo: { moveBrief: "基础拳" },
      });

      expect(softSettle).toHaveBeenCalledWith(expect.objectContaining({
        kind,
        ctx: expect.objectContaining({ npc: "卓玛", giftInfo: { itemName: "青稞酒" }, learnInfo: { moveBrief: "基础拳" } }),
      }));
      expect(runTurn.mock.calls.at(-1)[2]).toHaveProperty("softSettle");
      expect(varTreeRef.current.角色.卓玛.好感度).toBe(13);
      expect(ctx._trace.nodes.map(({ label }) => label)).toContain("结算·软判定");
      expect(ctx._trace.phase).toBe(PHASE.DONE);
    },
  );

  it("prefetches read-only recall in parallel with softSettle and forwards the promise", async () => {
    gameActions.setVarTreeState({ 角色: { 卓玛: { 好感度: 10 } } });
    const events = [];
    let releaseSoftSettle;
    const softSettle = vi.fn(() => {
      events.push("softSettle:start");
      return new Promise((resolve) => {
        releaseSoftSettle = () => {
          events.push("softSettle:end");
          resolve({
            kind: "gift", target: "卓玛", choice: "成了", probs: {},
            deltas: [], note: "成了", varTree: gameStore.getState().varTree,
          });
        };
      });
    });
    runRecall.mockImplementationOnce(async () => {
      events.push("runRecall:start");
      return { recallInfo: { visible: [{ text: "旧约" }] }, recallBlock: "[往事] 旧约" };
    });
    runTurn.mockResolvedValueOnce({ narrativeText: "成了。" });

    const ctx = {
      apiCfg: { bookkeepEnabled: false }, ai: { chat: vi.fn() },
      convo: [{ role: "assistant", content: "上轮回复" }],
      memory: {
        varTreeLatest: gameStore.getState().varTree,
        recall: { apiCfg: {}, cmd: "送酒", room: { name: "客栈", npcs: [] }, flags: [] },
      },
      commitDeps: () => ({}), bookkeep: false, softSettle,
      getGameState: () => gameStore.getState(), gameActions,
      _trace: turnMonitor.start("并行测试"),
    };

    const p = playTurn(ctx, "送酒", {
      settle: true, settleKind: "gift", settleNpc: "卓玛",
      giftInfo: { itemName: "青稞酒" },
    });
    await Promise.resolve();
    expect(events).toContain("runRecall:start");
    expect(events).toContain("softSettle:start");
    expect(events).not.toContain("softSettle:end");

    releaseSoftSettle();
    await p;
    const passedCtx = runTurn.mock.calls.at(-1)[0];
    expect(passedCtx._prefetchedRecall).toBeDefined();
    await expect(passedCtx._prefetchedRecall).resolves.toEqual({
      recallInfo: { visible: [{ text: "旧约" }] },
      recallBlock: "[往事] 旧约",
    });
  });

  it("swallows prefetched recall errors cleanly when softSettle fails and rolls back", async () => {
    gameActions.setVarTreeState({ 角色: { 卓玛: { 好感度: 10 } } });
    runRecall.mockRejectedValueOnce(new Error("embedding offline"));
    const softSettle = vi.fn().mockRejectedValueOnce(new Error("soft settle boom"));
    const ctx = {
      apiCfg: { bookkeepEnabled: false }, ai: { chat: vi.fn() },
      memory: {
        varTreeLatest: gameStore.getState().varTree,
        recall: { apiCfg: {}, cmd: "送酒", room: { name: "客栈", npcs: [] }, flags: [] },
      },
      commitDeps: () => ({}), bookkeep: false, softSettle,
      getGameState: () => gameStore.getState(), gameActions,
      _trace: turnMonitor.start("回滚隔离测试"),
    };

    const res = await playTurn(ctx, "送酒", {
      settle: true, settleKind: "gift", settleNpc: "卓玛",
    });
    expect(res.ok).toBe(false);
    expect(String(res.error)).toContain("soft settle boom");
    expect(gameStore.getState().varTree.角色.卓玛.好感度).toBe(10);
  });
});
