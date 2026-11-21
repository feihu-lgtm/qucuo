// 把系统裁决结果交给第二段（叙事）做结构化上下文，并约束第三段（写入）不得为被拒步骤落任何效果。
import { describeAction } from "./gate.js";
import { giftWeightBand } from "./systemGate.js";
import { ACTION_KINDS, SILVER } from "./actionKinds.js";

export function planToContext(plan) {
  const view = (action) => ({ step: action.index + 1, kind: action.kind, target: action.target ?? null, item: action.item ?? null, amount: action.amount ?? null, text: action.text });
  const viewTrigger = (action) => ({ ...view(action), on: action.condition?.on ?? null, detail: action.condition?.detail ?? null });
  return {
    valid: (plan?.valid || []).map(view),
    rejected: plan?.rejected ? { ...view(plan.rejected), reason: plan.rejected.reason } : null,
    skipped: (plan?.skipped || []).map(view),
    triggers: (plan?.triggers || []).map(viewTrigger),
    freeSteps: (plan?.freeSteps || []).map(view),
  };
}

export function formatPlanNote(plan, state) {
  if (!plan) return "";
  const lines = (plan.valid || []).map((action) => {
    const band = action.kind === ACTION_KINDS.GIFT ? giftWeightBand(action, state) : "";
    return `${action.index + 1}. ${describeAction(action)}（系统已核准${band ? `，${band}` : ""}）`;
  });
  if (plan.rejected) lines.push(`${plan.rejected.index + 1}. ${describeAction(plan.rejected)}（系统拒绝：${plan.rejected.reason}；写成没能做成）`);
  for (const action of plan.skipped || []) lines.push(`${action.index + 1}. ${describeAction(action)}（前一步受阻，未执行）`);
  for (const action of plan.triggers || []) lines.push(`${action.index + 1}. ${describeAction(action)}（条件步，暂缓执行，等前提发生再触发）`);
  for (const action of plan.freeSteps || []) lines.push(`${action.index + 1}. ${action.text}（按原话自由发挥）`);
  return `\n[行动识别·系统裁决] 本回合玩家依次：\n${lines.join("\n")}\n只叙述已核准的步骤及其直接结果，被拒或未执行的步骤不得写成已发生。\n结构化：${JSON.stringify(planToContext(plan))}`;
}

function blockedNames(plan) {
  const allowed = new Set((plan?.valid || []).map((action) => action.target).filter(Boolean));
  const blocked = [plan?.rejected, ...(plan?.skipped || []), ...(plan?.triggers || [])]
    .map((action) => action?.target).filter(Boolean);
  return [...new Set(blocked)].filter((name) => !allowed.has(name) && name !== "无");
}

export function planExtractionNote(plan) {
  const steps = [plan?.rejected, ...(plan?.skipped || []), ...(plan?.triggers || [])].filter(Boolean);
  if (!steps.length) return "";
  return `\n[行动识别] 以下步骤已被系统拒绝、未执行或挂起待触发，不得为其输出任何状态变化：${steps.map(describeAction).join("、")}。`;
}

// 第三段写入的确定性兜底：只出现在被拒/跳过步骤里的人物，其相关 MVU 命令一律丢弃。
export function filterRejectedEffects(mvuCommands, plan) {
  const names = blockedNames(plan);
  if (!names.length || !Array.isArray(mvuCommands)) return mvuCommands;
  return mvuCommands.filter((command) => {
    const text = typeof command === "string" ? command : JSON.stringify(command);
    return !names.some((name) => text.includes(name));
  });
}

// 第三段提取的 delta.items_rm 按名字删光同名物品：被拒/跳过步骤涉及的物品、以及系统已按步骤扣过的物品都不得再删。
export function filterPlanDelta(p, plan) {
  const rm = p?.delta?.items_rm;
  if (!plan || !Array.isArray(rm) || !rm.length) return p;
  const steps = [...(plan.valid || []), ...(plan.rejected ? [plan.rejected] : []), ...(plan.skipped || [])];
  const guarded = new Set(steps.filter((step) => step.item && step.item !== SILVER).map((step) => step.item));
  const items = rm.filter((entry) => !guarded.has(typeof entry === "string" ? entry : entry?.name));
  return items.length === rm.length ? p : { ...p, delta: { ...p.delta, items_rm: items } };
}
