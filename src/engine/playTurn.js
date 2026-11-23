import { getRngState, setRngState } from "../utils/rng.js";
import { loadSquares, serializeSquares } from "../domain/rules/map/mapSquares.js";
import { PHASE, turnMonitor, withTurnContext } from "../infra/turnMonitor.js";
import { createWebAi } from "../infra/ai.js";
import { createPhaseSetter } from "./turn/phaseSetter.js";
import { SOFT_SETTLE_KINDS } from "../domain/rules/settle/softRules.js";
import { runRecall } from "./act/memoryLayer.js";
import { settleTurn } from "./turn/settleTurn.js";
import { narrateTurn } from "./turn/narrateTurn.js";
import { finalizeTurn } from "./turn/finalizeTurn.js";

export const ROLLBACK_KEYS = [
  "room", "char", "dao", "skills", "inv", "exp", "pot", "flags",
  "mapData", "time", "varTree", "convo",
];

function setterForKey(key) {
  return key === "varTree" ? "setVarTreeState" : `set${key[0].toUpperCase()}${key.slice(1)}`;
}

function captureSnapshot(refs = {}, getGameState) {
  const state = getGameState();
  return {
    state: Object.fromEntries(ROLLBACK_KEYS.map((key) => [key, state[key]])),
    rngState: getRngState(),
    squares: serializeSquares(),
    refs: Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, structuredClone(ref.current)])),
  };
}

function restoreSnapshot(snapshot, refs = {}, getGameState, actions) {
  for (const key of ROLLBACK_KEYS) {
    if (getGameState()[key] !== snapshot.state[key]) {
      actions[setterForKey(key)](snapshot.state[key]);
    }
  }
  setRngState(snapshot.rngState);
  loadSquares(snapshot.squares);
  for (const [key, ref] of Object.entries(refs)) ref.current = snapshot.refs[key];
}

// 回合编排器：事务快照 → settleTurn（软结算）→ narrateTurn（主叙事+提取）
// → finalizeTurn（落盘+记账），任一环节过期/抛错走统一回滚或丢弃路径。
export async function playTurn(ctx, cmd, opts = {}) {
  const trace = ctx._trace || turnMonitor.start(cmd, { source: "engine", commandId: "turnCommit" });
  const turnCtx = { ...ctx, ai: ctx.ai || createWebAi() };
  const setPhase = createPhaseSetter(ctx, trace);
  const stale = (error) => {
    turnMonitor.transition(trace, PHASE.DISCARDED, "收到过期结果");
    return { ok: false, stale: true, ...(error && { error }) };
  };
  setPhase("machine");
  let snapshot;
  let soft;
  const getGameState = ctx.getGameState;
  const gameActions = ctx.gameActions;
  const setVarTreeState = (tree) => ctx.gameActions.setVarTreeState(tree);
  try {
    snapshot = captureSnapshot(ctx.refs, getGameState);
    turnMonitor.add(trace, "app", "事务快照", { kind: "snapshot" });
    turnMonitor.add(trace, "feature", "engine.runTurn");
    turnMonitor.add(trace, "domain", "整理世界状态与叙事上下文");
    ctx.beforeRun?.();
    setPhase("ai");
    const turnOpts = { ...opts };
    // 软结算需要调小模型时，提前并发启动只读记忆召回，避免两段网络往返串行叠加；
    // 全程降级安全（catch 兜底空结果），过期或回滚时不会留下未处理拒绝，也不改写任何状态。
    const willSoftSettle = SOFT_SETTLE_KINDS.has(turnOpts.settleKind)
      && !!turnOpts.settleNpc
      && turnCtx.apiCfg?.softSettleEnabled !== false;
    let narrateCtx = turnCtx;
    if (willSoftSettle && turnCtx.memory?.recall) {
      const lastAiText = [...(turnCtx.convo || [])].reverse().find((m) => m.role === "assistant")?.content
        || turnCtx.memory.recall.lastAiText
        || "";
      const prefetchedRecall = runRecall({
        ...turnCtx.memory.recall,
        lastAiText,
        varTreeLatest: turnCtx.memory.varTreeLatest || getGameState().varTree,
      }).catch(() => ({ recallInfo: null, recallBlock: "" }));
      narrateCtx = { ...turnCtx, _prefetchedRecall: prefetchedRecall };
    }
    soft = await settleTurn({ ctx: turnCtx, ai: turnCtx.ai, trace, turnOpts, cmd, getGameState, setVarTreeState });
    if (soft.stale) return stale();
    const narrated = await narrateTurn(narrateCtx, trace, cmd, turnOpts);
    if (narrated.stale) {
      if (soft.applied && !soft.listenerRegistered) {
        withTurnContext(trace, soft.revertOnce);
      }
      return stale();
    }
    soft.unsubscribeInvalidation();
    return await finalizeTurn({
      ctx: turnCtx, trace, turn: narrated.turn, turnOpts, soft, opts, setPhase,
    });
  } catch (error) {
    if (ctx.isStale?.()) {
      if (soft?.applied && !soft.listenerRegistered) {
        withTurnContext(trace, soft.revertOnce);
      }
      return stale(error);
    }
    soft?.unsubscribeInvalidation();
    if (snapshot) withTurnContext(trace, () => restoreSnapshot(snapshot, ctx.refs, getGameState, gameActions));
    turnMonitor.transition(trace, PHASE.ERROR, String(error));
    return { ok: false, error };
  } finally {
    soft?.unsubscribeInvalidation();
  }
}
