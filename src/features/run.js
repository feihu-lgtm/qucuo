import { gameActions } from "../core/gameStore.js";
import { registerFact } from "../domain/prompt/knowledge.js";

function actionForKey(key) {
  const actionName = `set${key[0].toUpperCase()}${key.slice(1)}`;
  return gameActions[actionName];
}

export function applyResult(ctx, result) {
  if (result.squareOps?.length) ctx.applySquareOps?.(result.squareOps);

  for (const [key, value] of Object.entries(result.changes || {})) {
    if (key === "varTree") {
      if (typeof ctx.setVarTree !== "function") {
        throw new Error("Feature result changes.varTree requires ctx.setVarTree");
      }
      ctx.setVarTree(value);
      continue;
    }

    const action = actionForKey(key);
    if (!action) throw new Error(`Unknown game state key: ${key}`);
    action(value);
  }

  if (result.logs?.length) ctx.addLog?.(result.logs);
  if (result.note) ctx.jotNote?.(result.note);
  if (result.fact) {
    const { currentTurn, ...fact } = result.fact;
    ctx.setVarTree?.((prev) => registerFact(prev, fact, currentTurn));
  }
  if (result.settle) {
    const settleOptions = result.settleOptions || {};
    ctx.act?.(result.settle, [], { ...settleOptions, settle: settleOptions.settle ?? true });
  }
  return result;
}
