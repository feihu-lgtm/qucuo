// web 与 CLI 共用的识别+闸门编排（不含 UI）：返回 { route, recognition, plan, confirm } 供各端执行。
import { recognizeIntent } from "../../domain/intent/recognizer.js";
import { gateRecognition, confirmLine, ROUTES } from "../../domain/intent/gate.js";
import { validatePlan } from "../../domain/intent/systemGate.js";
import { formatPlanNote } from "../../domain/intent/planNotes.js";
import { parseDir } from "../../utils/mudHelpers.js";
import { turnMonitor } from "../../core/turnMonitor.js";

export function shouldRecognize(apiCfg, cmd, opts = {}) {
  const text = String(cmd || "").trim();
  return !!apiCfg?.intentRecognitionEnabled && text.length > 1 && !parseDir(text)
    && !opts.intentPlan && !opts.intentSkip && !opts.silentCmd && !opts.settle && !opts.forceLayer && !opts.autoTravel;
}

export async function recognizeAndGate(state, cmd, { classifier, onStage, thresholds } = {}) {
  const startedAt = Date.now();
  const recognition = await recognizeIntent(state, cmd, { classifier, onStage });
  const decision = gateRecognition(recognition, thresholds);
  return { ...decision, recognition, ms: Date.now() - startedAt, confirm: decision.route === ROUTES.CONFIRM ? confirmLine(recognition.actions) : null };
}

export function planSteps(state, actions) {
  const plan = validatePlan(state, actions);
  return { plan, note: formatPlanNote(plan, state), single: plan.valid.length === 1 && !plan.rejected };
}

export function rejectionLog(plan) {
  return plan?.rejected ? { t: "sys", text: `  第${plan.rejected.index + 1}步没能做成：${plan.rejected.reason}。` } : null;
}

export function traceNode(turn, label, status, detail, durationMs) {
  if (!turn) return;
  const node = turnMonitor.add(turn, "domain", label, { status, detail });
  if (durationMs != null) node.durationMs = durationMs;
}

export function stageTracer(turn) {
  return (label, result, ms) => traceNode(turn, `行动识别·${label.replace(/^识别·/, "")}`, "pass",
    Array.isArray(result) ? result.join(" | ") : `${result.choice}（${((result.probs?.[result.choice] ?? 0) * 100).toFixed(0)}%）`, ms);
}
