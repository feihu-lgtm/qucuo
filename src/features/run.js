import { registerFact } from "../domain/rules/prompt/knowledge.js";
import { canBackfillSettle } from "../domain/rules/settle/settleBrief.js";
import { turnRuntime } from "./turnRuntime.js";

// 状态写入口由调用方经 ctx.gameActions 注入（features 不反依赖 store，同
// intentPendingStore 的参数注入约定）。
function actionForKey(ctx, key) {
  const actionName = `set${key[0].toUpperCase()}${key.slice(1)}`;
  return ctx?.gameActions?.[actionName];
}

export function applyResult(ctx, result, { turn, feature, background = false } = {}) {
  const { getTurnContext, PHASE, turnMonitor, withTurnContext } = turnRuntime();
  const action = typeof result === "function";
  feature ||= result.feature || result.settle || result.kind || "本地操作";
  turn ??= getTurnContext();
  const trace = turn || turnMonitor.start(feature, {
    source: background ? "background" : "button", background,
    commandId: background ? "pigeonReply" : "actLocal",
  });
  const inRules = getTurnContext() === trace && trace.inRules;
  if (!inRules) {
    if (action || !trace.nodes.some((node) => node.layer === "feature")) turnMonitor.add(trace, "feature", feature);
    if (!action) turnMonitor.add(trace, "domain", "裁决结果", {
      detail: Object.keys(result.changes || {}).join("、") || result.logs?.map(({ text }) => text).join("\n"),
    });
  }
  try {
    const applied = withTurnContext(trace, () => action ? result() : writeResult(ctx, result, trace));
    if (!turn && !trace.awaitingSettlement) turnMonitor.finish(trace);
    return applied;
  } catch (error) {
    if (!turn) turnMonitor.transition(trace, PHASE.ERROR, String(error));
    throw error;
  }
}

function writeResult(ctx, result, trace) {
  if (result.squareOps?.length) ctx.applySquareOps?.(result.squareOps);

  for (const [key, value] of Object.entries(result.changes || {})) {
    if (key === "varTree") {
      if (typeof ctx.setVarTree !== "function") {
        throw new Error("Feature result changes.varTree requires ctx.setVarTree");
      }
      ctx.setVarTree(value);
      continue;
    }

    const action = actionForKey(ctx, key);
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
    if (ctx.settleInBackground && canBackfillSettle(settleOptions)) {
      ctx.settleInBackground(result.settle, settleOptions);
    } else if (ctx.act) {
      const { PHASE, withTurnContext } = turnRuntime();
      const join = trace.phase === PHASE.MACHINE;
      withTurnContext(join ? trace : undefined, () =>
        ctx.act(result.settle, [], { ...settleOptions, settle: settleOptions.settle ?? true, keepUndo: true }));
    }
  }
  return result;
}
