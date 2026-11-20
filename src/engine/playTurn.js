import { commitRound } from "./act/commitRound.js";
import { gameActions, gameStore } from "../core/gameStore.js";
import { getRngState, setRngState } from "../core/rng.js";
import { loadSquares, serializeSquares } from "../domain/map/mapSquares.js";
import { runTurn } from "./runTurn.js";
import { PHASE, turnMonitor, withTurnContext } from "../core/turnMonitor.js";

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
  try {
    snapshot = captureSnapshot(ctx.refs);
    turnMonitor.add(trace, "app", "事务快照", { kind: "snapshot" });
    turnMonitor.add(trace, "feature", "engine.runTurn");
    turnMonitor.add(trace, "domain", "整理世界状态与叙事上下文");
    ctx.beforeRun?.();
    setCommandPhase("ai");
    const turn = await runTurn({ ...ctx, _trace: trace }, cmd, opts);
    if (turn.stale || ctx.isStale?.()) return stale();
    setCommandPhase("commit");
    withTurnContext(trace, () => (ctx.commitRound || commitRound)({ ...ctx.commitDeps(turn), _trace: trace }));
    await Promise.resolve();
    if (!ctx.deferMonitorFinish) turnMonitor.finish(trace, "行动完成");
    return { ok: true, turn };
  } catch (error) {
    if (ctx.isStale?.()) return stale(error);
    if (snapshot) withTurnContext(trace, () => restoreSnapshot(snapshot, ctx.refs));
    turnMonitor.transition(trace, PHASE.ERROR, String(error));
    return { ok: false, error };
  }
}
