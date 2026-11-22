import { gameActions, gameStore } from "../store/gameStore.js";
import { getRngState, setRngState } from "../core/rng.js";
import { loadSquares, serializeSquares } from "../domain/rules/map/mapSquares.js";
import { PHASE, turnMonitor, withTurnContext } from "../core/turnMonitor.js";
import { createWebAi } from "./ports/ai.js";
import { createPhaseSetter } from "./turn/phaseSetter.js";
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
  const getGameState = () => gameStore.getState();
  const setVarTreeState = (tree) => gameActions.setVarTreeState(tree);
  try {
    snapshot = captureSnapshot(ctx.refs);
    turnMonitor.add(trace, "app", "事务快照", { kind: "snapshot" });
    turnMonitor.add(trace, "feature", "engine.runTurn");
    turnMonitor.add(trace, "domain", "整理世界状态与叙事上下文");
    ctx.beforeRun?.();
    setPhase("ai");
    const turnOpts = { ...opts };
    soft = await settleTurn({ ctx: turnCtx, ai: turnCtx.ai, trace, turnOpts, cmd, getGameState, setVarTreeState });
    if (soft.stale) return stale();
    const narrated = await narrateTurn(turnCtx, trace, cmd, turnOpts);
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
    if (snapshot) withTurnContext(trace, () => restoreSnapshot(snapshot, ctx.refs));
    turnMonitor.transition(trace, PHASE.ERROR, String(error));
    return { ok: false, error };
  } finally {
    soft?.unsubscribeInvalidation();
  }
}
