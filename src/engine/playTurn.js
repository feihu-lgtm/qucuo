import { commitRound } from "./act/commitRound.js";
import { gameActions, gameStore } from "../core/gameStore.js";
import { getRngState, setRngState } from "../core/rng.js";
import { loadSquares, serializeSquares } from "../domain/map/mapSquares.js";
import { runTurn } from "./runTurn.js";
import { PHASE, turnMonitor, withTurnContext } from "../core/turnMonitor.js";
import { bindTurnAi, createWebAi } from "./ports/ai.js";
import { runBookkeepAfterTurn } from "./act/bookkeepTurn.js";
import {
  applySettledDeltas, captureSettledChanges, revertSettled, runSoftSettle,
} from "../domain/settle/settle.js";
import { UNKNOWN_CHOICE } from "../domain/settle/judge.js";
import { applyMvuCommands } from "../domain/prompt/mvu.js";
import { formatAngerResolutionLog, resolveAngerSignals } from "../domain/combat/stealSystem.js";

// 会跑软结算的 settle 类型（其余 settleKind 仍走原有叙事+提取路径）。
const SOFT_SETTLE_KINDS = new Set(["appease", "gift", "companion_invite", "learn_skill"]);

export const ROLLBACK_KEYS = [
  "room", "char", "dao", "skills", "inv", "exp", "pot", "flags",
  "mapData", "time", "varTree", "convo",
];

function setterForKey(key) {
  return key === "varTree" ? "setVarTreeState" : `set${key[0].toUpperCase()}${key.slice(1)}`;
}

function captureSnapshot(refs = {}) {
  const state = gameStore.getState();
  return {
    state: Object.fromEntries(ROLLBACK_KEYS.map((key) => [key, state[key]])),
    rngState: getRngState(),
    squares: serializeSquares(),
    refs: Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, structuredClone(ref.current)])),
  };
}

function restoreSnapshot(snapshot, refs = {}) {
  for (const key of ROLLBACK_KEYS) {
    if (gameStore.getState()[key] !== snapshot.state[key]) {
      gameActions[setterForKey(key)](snapshot.state[key]);
    }
  }
  setRngState(snapshot.rngState);
  loadSquares(snapshot.squares);
  for (const [key, ref] of Object.entries(refs)) ref.current = snapshot.refs[key];
}

export async function playTurn(ctx, cmd, opts = {}) {
  const trace = ctx._trace || turnMonitor.start(cmd, { source: "engine", commandId: "turnCommit" });
  const turnCtx = { ...ctx, ai: ctx.ai || createWebAi() };
  const setCommandPhase = (phase) => {
    ctx.setCommandPhase?.(phase, trace);
    const next = { machine: PHASE.MACHINE, ai: PHASE.AI_WAIT, commit: PHASE.COMMIT }[phase];
    if (trace.phase !== next) turnMonitor.transition(trace, next);
  };
  const stale = (error) => {
    turnMonitor.transition(trace, PHASE.DISCARDED, "收到过期结果");
    return { ok: false, stale: true, ...(error && { error }) };
  };
  setCommandPhase("machine");
  let snapshot;
  let softSettleLogs = [];
  let softSettleRevertRecords = [];
  let softSettleApplied = false;
  let softSettleReverted = false;
  let invalidationListenerRegistered = false;
  let unsubscribeInvalidation;
  const revertSoftSettleOnce = () => {
    if (!softSettleApplied || softSettleReverted) return;
    softSettleReverted = true;
    if (ctx.setVarTree) ctx.setVarTree(prev => revertSettled(prev, softSettleRevertRecords));
    else gameActions.setVarTreeState(revertSettled(gameStore.getState().varTree, softSettleRevertRecords));
  };
  const unsubscribeFromInvalidation = () => {
    const unsubscribe = unsubscribeInvalidation;
    unsubscribeInvalidation = null;
    if (typeof unsubscribe === "function") unsubscribe();
  };
  try {
    snapshot = captureSnapshot(ctx.refs);
    turnMonitor.add(trace, "app", "事务快照", { kind: "snapshot" });
    turnMonitor.add(trace, "feature", "engine.runTurn");
    turnMonitor.add(trace, "domain", "整理世界状态与叙事上下文");
    ctx.beforeRun?.();
    setCommandPhase("ai");
    const turnOpts = { ...opts };
    // 软结算入口：四种 settle 动作的结果（消气与否、收礼与否、答应同行与否、收徒与否）
    // 先由结算段小模型裁决，叙事只照裁决写正文；AI 不再在 <mvu> 里顺手定这些结果。
    if (SOFT_SETTLE_KINDS.has(turnOpts.settleKind) && turnOpts.settleNpc && ctx.apiCfg?.softSettleEnabled !== false) {
      const state = gameStore.getState();
      const softSettle = await (ctx.softSettle || runSoftSettle)({
        ai: bindTurnAi(turnCtx.ai, trace),
        apiCfg: turnCtx.apiCfg,
        kind: turnOpts.settleKind,
        ctx: {
          npc: turnOpts.settleNpc,
          varTree: state.varTree,
          attempt: turnOpts.attempt || cmd,
          time: state.time,
          charm: turnCtx.effectiveSpecialNow?.魅力 ?? 5,
          giftInfo: turnOpts.giftInfo,
          learnInfo: turnOpts.learnInfo,
        },
      });
      if (ctx.isStale?.()) return stale();
      if (softSettle && softSettle.choice !== UNKNOWN_CHOICE) {
        const angerSignalApplied = turnOpts.settleKind === "appease" && softSettle.choice === "奏效" && softSettle.deltas?.some(
          delta => delta.path === `角色.${turnOpts.settleNpc}.生气解除`
            && delta.op === "set" && delta.finalValue === true,
        );
        let settledTree = gameStore.getState().varTree;
        if (angerSignalApplied) {
          softSettleLogs = [
            ...applyMvuCommands(state.varTree, softSettle.deltas, {
              time: state.time,
              charm: turnCtx.effectiveSpecialNow?.魅力 ?? 5,
            }).logs,
            formatAngerResolutionLog(turnOpts.settleNpc),
          ];
        }
        const applySoftSettle = (prev) => {
          settledTree = applySettledDeltas(prev, softSettle.deltas);
          if (angerSignalApplied) settledTree = resolveAngerSignals(settledTree, [turnOpts.settleNpc]);
          const revertPaths = (softSettle.deltas || []).map(delta => delta?.path);
          if (angerSignalApplied) {
            revertPaths.push(`角色.${turnOpts.settleNpc}.生气状态`, `角色.${turnOpts.settleNpc}.生气解除`);
          }
          softSettleRevertRecords = captureSettledChanges(prev, settledTree, revertPaths);
          return settledTree;
        };
        softSettleApplied = true;
        if (ctx.setVarTree) ctx.setVarTree(applySoftSettle);
        else gameActions.setVarTreeState(applySoftSettle(gameStore.getState().varTree));
        if (typeof ctx.onTurnsInvalidated === "function") {
          unsubscribeInvalidation = ctx.onTurnsInvalidated(revertSoftSettleOnce);
          invalidationListenerRegistered = true;
        }
        turnOpts.softSettle = { ...softSettle, varTree: settledTree };
        turnMonitor.add(trace, "engine", "结算·软判定", {
          status: "pass",
          detail: `${softSettle.choice}（${softSettle.note}）`,
        });
      }
    }
    const turn = await runTurn({ ...turnCtx, _trace: trace }, cmd, turnOpts);
    if (turn.stale || ctx.isStale?.()) {
      if (softSettleApplied && !invalidationListenerRegistered) {
        withTurnContext(trace, revertSoftSettleOnce);
      }
      return stale();
    }
    unsubscribeFromInvalidation();
    setCommandPhase("commit");
    const commitDeps = ctx.commitDeps(turn) || {};
    const committed = withTurnContext(trace, () => {
      const result = (ctx.commitRound || commitRound)({
        ...commitDeps,
        softSettle: turnOpts.softSettle || null,
        duelReport: opts.duelReport || null,
        giftSettlement: opts.settleKind === "gift" && opts.giftInfo?.weight
          ? { npc: opts.settleNpc, range: opts.giftInfo.weight.range } : null,
        giftAlreadySettled: !!opts.giftInfo?.weight,
        _trace: trace,
      });
      if (softSettleLogs.length) (commitDeps.addLog || ctx.addLog)?.(softSettleLogs);
      return result;
    });
    await Promise.resolve();
    if (!ctx.deferMonitorFinish) turnMonitor.finish(trace, "行动完成");
    const bookkeep = ctx.bookkeep === false ? null : ctx.bookkeep || runBookkeepAfterTurn;
    const bookkeepCtx = {
      ...turnCtx,
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
  } catch (error) {
    if (ctx.isStale?.()) {
      if (softSettleApplied && !invalidationListenerRegistered) {
        withTurnContext(trace, revertSoftSettleOnce);
      }
      return stale(error);
    }
    unsubscribeFromInvalidation();
    if (snapshot) withTurnContext(trace, () => restoreSnapshot(snapshot, ctx.refs));
    turnMonitor.transition(trace, PHASE.ERROR, String(error));
    return { ok: false, error };
  } finally {
    unsubscribeFromInvalidation();
  }
}
