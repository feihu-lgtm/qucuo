import { commitRound } from "../act/commitRound.js";
import { gameActions, gameStore } from "../core/gameStore.js";
import { getRngState, setRngState } from "../core/rng.js";
import { loadSquares, serializeSquares } from "../mapSquares.js";
import { runTurn } from "./runTurn.js";

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
    state: structuredClone(Object.fromEntries(ROLLBACK_KEYS.map((key) => [key, state[key]]))),
    rngState: getRngState(),
    squares: serializeSquares(),
    refs: Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, structuredClone(ref.current)])),
  };
}

function restoreSnapshot(snapshot, refs = {}) {
  for (const key of ROLLBACK_KEYS) gameActions[setterForKey(key)](snapshot.state[key]);
  setRngState(snapshot.rngState);
  loadSquares(snapshot.squares);
  for (const [key, ref] of Object.entries(refs)) ref.current = snapshot.refs[key];
}

export async function playTurn(ctx, cmd, opts = {}) {
  let snapshot;
  try {
    snapshot = captureSnapshot(ctx.refs);
    ctx.beforeRun?.();
    const turn = await runTurn(ctx, cmd, opts);
    (ctx.commitRound || commitRound)(ctx.commitDeps(turn));
    return { ok: true, turn };
  } catch (error) {
    if (snapshot) restoreSnapshot(snapshot, ctx.refs);
    return { ok: false, error };
  }
}
