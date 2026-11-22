// 回合流水线第二段：软结算调度（系统裁决，先于叙事）。
// 四种 settle 动作的结果（消气与否、收礼与否、答应同行与否、收徒与否）先由
// 结算段小模型裁决，叙事只照裁决写正文；AI 不再在 <mvu> 里顺手定这些结果。
// 返回一个结算控制器：logs 待 finalizeTurn 回吐，revertOnce 供过期/回滚路径
// 幂等撤销；引擎层不直接 import store，gameStore 读写经注入的 accessors 传入。

import {
  settledToPatches, captureSettledChanges, revertSettled,
} from "../../domain/rules/settle/settle.js";
import { applyPatches } from "../../domain/rules/state/applyPatches.js";
import { UNKNOWN_CHOICE } from "../../domain/rules/settle/judge.js";
import { SOFT_SETTLE_KINDS } from "../../domain/rules/settle/softRules.js";
import { applyMvuCommands } from "../../domain/rules/prompt/mvu.js";
import { formatAngerResolutionLog, resolveAngerSignals } from "../../domain/rules/combat/stealSystem.js";
import { runSoftSettle } from "../ports/softSettle.js";
import { bindTurnAi } from "../ports/ai.js";
import { turnMonitor } from "../../core/turnMonitor.js";

export async function settleTurn({ ctx, ai, trace, turnOpts, cmd, getGameState, setVarTreeState }) {
  const ctl = {
    applied: false,
    reverted: false,
    logs: [],
    listenerRegistered: false,
    unsubscribe: null,
    // 幂等撤销：过期丢弃且未注册失效监听时，由调用方在 withTurnContext 里调。
    revertOnce: () => {
      if (!ctl.applied || ctl.reverted) return;
      ctl.reverted = true;
      if (ctx.setVarTree) ctx.setVarTree(prev => revertSettled(prev, ctl.revertRecords));
      else setVarTreeState(revertSettled(getGameState().varTree, ctl.revertRecords));
    },
    unsubscribeInvalidation: () => {
      const unsubscribe = ctl.unsubscribe;
      ctl.unsubscribe = null;
      if (typeof unsubscribe === "function") unsubscribe();
    },
  };
  if (!SOFT_SETTLE_KINDS.has(turnOpts.settleKind) || !turnOpts.settleNpc || ctx.apiCfg?.softSettleEnabled === false) {
    return ctl;
  }

  const state = getGameState();
  const softSettle = await (ctx.softSettle || runSoftSettle)({
    ai: bindTurnAi(ai, trace),
    apiCfg: ctx.apiCfg,
    kind: turnOpts.settleKind,
    ctx: {
      npc: turnOpts.settleNpc,
      varTree: state.varTree,
      attempt: turnOpts.attempt || cmd,
      time: state.time,
      charm: ctx.effectiveSpecialNow?.魅力 ?? 5,
      giftInfo: turnOpts.giftInfo,
      learnInfo: turnOpts.learnInfo,
    },
  });
  if (ctx.isStale?.()) { ctl.stale = true; return ctl; }
  if (!softSettle || softSettle.choice === UNKNOWN_CHOICE) return ctl;

  const angerSignalApplied = turnOpts.settleKind === "appease" && softSettle.choice === "奏效" && softSettle.deltas?.some(
    delta => delta.path === `角色.${turnOpts.settleNpc}.生气解除`
      && delta.op === "set" && delta.finalValue === true,
  );
  let settledTree = getGameState().varTree;
  if (angerSignalApplied) {
    ctl.logs = [
      ...applyMvuCommands(state.varTree, softSettle.deltas, {
        time: state.time,
        charm: ctx.effectiveSpecialNow?.魅力 ?? 5,
      }).logs,
      formatAngerResolutionLog(turnOpts.settleNpc),
    ];
  }
  const applySoftSettle = (prev) => {
    settledTree = applyPatches({ varTree: prev }, settledToPatches(softSettle.deltas)).state.varTree;
    if (angerSignalApplied) settledTree = resolveAngerSignals(settledTree, [turnOpts.settleNpc]);
    const revertPaths = (softSettle.deltas || []).map(delta => delta?.path);
    if (angerSignalApplied) {
      revertPaths.push(`角色.${turnOpts.settleNpc}.生气状态`, `角色.${turnOpts.settleNpc}.生气解除`);
    }
    ctl.revertRecords = captureSettledChanges(prev, settledTree, revertPaths);
    return settledTree;
  };
  ctl.applied = true;
  if (ctx.setVarTree) ctx.setVarTree(applySoftSettle);
  else setVarTreeState(applySoftSettle(getGameState().varTree));
  if (typeof ctx.onTurnsInvalidated === "function") {
    ctl.unsubscribe = ctx.onTurnsInvalidated(ctl.revertOnce);
    ctl.listenerRegistered = true;
  }
  turnOpts.softSettle = { ...softSettle, varTree: settledTree };
  turnMonitor.add(trace, "engine", "结算·软判定", {
    status: "pass",
    detail: `${softSettle.choice}（${softSettle.note}）`,
  });
  return ctl;
}
