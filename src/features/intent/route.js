// web 与 CLI 共用的识别+闸门编排（不含 UI）：返回 { route, recognition, plan, confirm } 供各端执行。
import { recognizeIntent, clampConfidence } from "../../domain/rules/intent/recognizer.js";
import { HARD_ACTION_RE } from "../../domain/rules/intent/actionKinds.js";
import { isIntimateInput } from "../../domain/rules/prompt/inputIntent.js";
import { gateRecognition, confirmLine, ROUTES } from "../../domain/rules/intent/gate.js";
import { validatePlan } from "../../domain/rules/intent/systemGate.js";
import { formatPlanNote } from "../../domain/rules/intent/planNotes.js";
import { parseDir } from "../../utils/mudHelpers.js";
import { turnRuntime } from "../turnRuntime.js";

// 纯亲密描写（搂抱/亲吻…）里没有任何封闭行动的关键词时，整句不值得问分类模型：
// 那类输入走亲密路径，分类只会白耗一次调用还回落自由行动。带关键词（如「亲她一下再送她一壶酒」）仍照常识别。
export function shouldRecognize(apiCfg, cmd, opts = {}) {
  const text = String(cmd || "").trim();
  return !!apiCfg?.intentRecognitionEnabled && text.length > 1 && !parseDir(text)
    && !(isIntimateInput(text) && !HARD_ACTION_RE.test(text))
    && !opts.forcedEvent && !opts.intentPlan && !opts.intentSkip && !opts.silentCmd && !opts.settle && !opts.forceLayer && !opts.autoTravel;
}

// 玩家亲手输入的新指令（非自动寻路、非手动走图、非查看 NPC、非行动识别内部派生）：上一波条件触发器到此过期。
// useTurn 进路由前总会带 schedulerManaged，不能拿它判断来源。
export function isFreshTyped(opts = {}) {
  return !opts.autoTravel && !opts.forceLayer && !opts.inspect && !opts.intentPlan && !opts.intentSkip && !opts.silentCmd && !opts.settle;
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
  const node = turnRuntime().turnMonitor.add(turn, "domain", label, { status, detail });
  if (durationMs != null) node.durationMs = durationMs;
}

export function stageTracer(turn) {
  return (label, result, ms) => traceNode(turn, `行动识别·${label.replace(/^识别·/, "")}`, "pass",
    (result?.actions || []).map((action) => `${action.kind}（${(clampConfidence(action.confidence) * 100).toFixed(0)}%）`).join(" → ") || "（无行动）", ms);
}
