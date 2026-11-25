// 回合流水线第四段：事务落盘 + 后台记账调度。
// commitRound 在 withTurnContext 里一次性提交；随后异步派发记账，
// 记账失败只记监控、不阻塞回合。

import { commitRound } from "../act/commitRound.js";
import { runBookkeepAfterTurn } from "../act/bookkeepTurn.js";
import { PHASE, turnMonitor, withTurnContext } from "../../infra/turnMonitor.js";

export async function finalizeTurn({ ctx, trace, turn, turnOpts, opts, setPhase }) {
  setPhase("commit");
  const commitDeps = ctx.commitDeps(turn) || {};
  const committed = withTurnContext(trace, () => {
    const result = (ctx.commitRound || commitRound)({
      ...commitDeps,
      giftSettlement: opts.settleKind === "gift" && opts.giftInfo?.weight
        ? { npc: opts.settleNpc, range: opts.giftInfo.weight.range } : null,
      giftAlreadySettled: !!opts.giftInfo?.weight,
      settleKind: opts.settleKind,
      settleNpc: opts.settleNpc,
      // 本轮已确定性结算过的交付件（❢ deliver 通道）：叙事回执的 items_rm
      // 不得再扣——会重复扣件，或把剧情里还回来的 keep 件误删。
      deliveredItems: opts.deliveredItems || null,
      // WO-13：判官管线 materializeFacts 产物（changes/patches/receipts/logs）经此落盘
      materialized: turn.judgeEffects?.materialized || null,
      _trace: trace,
    });
    return result;
  });
  await Promise.resolve();
  if (!ctx.deferMonitorFinish) turnMonitor.finish(trace, "行动完成");
  const bookkeep = ctx.bookkeep === false ? null : ctx.bookkeep || runBookkeepAfterTurn;
  const bookkeepCtx = {
    ...ctx,
    setVarTree: commitDeps.setVarTree || ctx.setVarTree,
  };
  const recordBookkeepError = (error) => {
    const detail = error?.message || String(error);
    const backgroundTrace = turnMonitor.start("回合记账", {
      source: "background",
      background: true,
      parentId: trace.id,
    });
    turnMonitor.add(backgroundTrace, "engine", "记账失败", { kind: "bookkeep", status: "fail", detail });
    turnMonitor.transition(backgroundTrace, PHASE.ERROR, detail);
  };
  if (bookkeep) {
    try {
      Promise.resolve(bookkeep({ ctx: bookkeepCtx, turn, opts, trace })).catch((error) => {
        recordBookkeepError(error);
      });
    } catch (error) {
      recordBookkeepError(error);
    }
  }
  return { ok: true, turn, duelRequest: committed?.duelRequest ?? turn.p?.duelRequest };
}
