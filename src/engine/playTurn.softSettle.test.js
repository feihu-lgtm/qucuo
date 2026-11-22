import { afterEach, describe, expect, it, vi } from "vitest";
import { PHASE, turnMonitor } from "../infra/turnMonitor.js";
import { gameActions, gameStore } from "../store/gameStore.js";
import { runTurn } from "./runTurn.js";
import { playTurn } from "./playTurn.js";

vi.mock("./act/commitRound.js", () => ({ commitRound: vi.fn() }));
vi.mock("./runTurn.js", () => ({ runTurn: vi.fn() }));

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
});
