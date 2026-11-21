// CLI 端的行动识别（--intent 开启）：与 web 共用 src/domain/intent + src/features/intent，
// 中置信度时打印确认句，下一行输入「是/不是」作答。
import { ACTION_KINDS } from "../src/domain/intent/actionKinds.js";
import { ROUTES, describeAction } from "../src/domain/intent/gate.js";
import { armIntentTriggers, expireIntentTriggers } from "../src/store/intentPendingStore.js";
import { createAiClassifier, INTENT_TRUNCATED } from "../src/engine/intent/aiClassifier.js";
import { bindTurnAi } from "../src/engine/ports/ai.js";
import { DEFERRED_KINDS, findStepNpc, stepEffect, withoutSettle } from "../src/features/intent/logic.js";
import { planSteps, recognizeAndGate, rejectionLog, shouldRecognize, stageTracer, traceNode } from "../src/features/intent/route.js";

const DIR_CMD = { 北: "n", 南: "s", 东: "e", 西: "w" };
const YES = /^(是|是的|对|确认|好|y|yes)$/i;
const NO = /^(不是|否|不|不对|n|no)$/i;

export function createCliIntentRouter({ ai, apiCfg, emit, getState, getTurn, applyFeature, runFreeText, runCommand }) {
  let pending = null;

  async function runDeferred(step, single) {
    const npc = findStepNpc(getState(), step);
    if (step.kind === ACTION_KINDS.MOVE) return runCommand(DIR_CMD[step.direction] || step.direction);
    if (step.kind === ACTION_KINDS.OTHER || step.kind === ACTION_KINDS.TALK) return runFreeText(step.text, { echoCommand: true });
    if (!npc) return 0;
    if (step.kind === ACTION_KINDS.BUY) return runCommand(`交易 ${npc.name}`);
    const status = single ? await runFreeText(`向${npc.name}抱拳邀战，请他切磋一番`, { echoCommand: true }) : 0;
    emit(`（${npc.name}已应下邀战；正式切磋需在 web 端点「确认切磋」，CLI 暂无对战界面。）`);
    return status;
  }

  // 条件步触发：CLI 里按单步走原路径——立即结算类走 stepEffect，交互类走 runDeferred，自由文本照原文。
  async function fireTriggerStep(step, turn) {
    traceNode(turn, "行动识别·触发", "pass", `「${step.condition?.detail || ""}」应验，触发：${describeAction(step)}`);
    if (DEFERRED_KINDS.has(step.kind)) return runDeferred(step, true);
    if (step.kind === ACTION_KINDS.OTHER || step.kind === ACTION_KINDS.TALK) return runFreeText(step.text, { echoCommand: true });
    const result = stepEffect(getState(), step);
    if (!result) return 0;
    if (result.logs?.length) emit(result.logs.map((entry) => entry.text).join("\n"));
    return applyFeature(result);
  }

  async function execute(line, actions) {
    const turn = getTurn();
    const startedAt = Date.now();
    const { plan, note, single } = planSteps(getState(), actions);
    traceNode(turn, "行动识别·系统闸门", plan.rejected ? "warn" : "pass", `通过 ${plan.valid.length} 步`, Date.now() - startedAt);
    const rejected = rejectionLog(plan);
    if (rejected) emit(rejected.text.trim());
    let status = 0;
    const armed = armIntentTriggers(plan.triggers);
    if (armed.length) traceNode(turn, "行动识别·触发", "pass", `挂起 ${armed.length} 个条件步：${armed.map((entry) => describeAction(entry.step)).join("；")}`);
    for (const step of plan.valid) {
      if (DEFERRED_KINDS.has(step.kind)) continue;
      const result = stepEffect(getState(), step);
      if (!result) continue;
      const settled = single ? { ...result, settleOptions: { ...result.settleOptions, intentPlan: plan, intentPlanNote: note } } : withoutSettle(result);
      status = Math.max(status, await applyFeature(settled));
      if (result.logs?.length) emit(result.logs.map((entry) => entry.text).join("\n"));
    }
    if (!single && plan.valid.length) {
      status = Math.max(status, await runFreeText(line, { intentPlan: plan, intentPlanNote: note, echoCommand: true }));
    }
    for (const step of plan.valid) if (DEFERRED_KINDS.has(step.kind)) status = Math.max(status, await runDeferred(step, single));
    // 「被拒」触发在已核准步骤都跑完之后才发，免得它抢走前面步骤要用的资源。
    if (plan.refused) status = Math.max(status, await fireTriggerStep(plan.refused, turn));
    for (const step of plan.freeSteps || []) status = Math.max(status, await runFreeText(step.text, { echoCommand: true }));
    return status;
  }

  return async function route(line) {
    if (pending) {
      const { line: original, actions } = pending;
      pending = null;
      if (YES.test(line)) return execute(original, actions);
      if (NO.test(line)) return runFreeText(original, { intentSkip: true });
    }
    // 新的输入：上一波挂起的条件步到期（CLI 无自动寻路，遇敌/到达触发不会被点燃）。
    for (const entry of expireIntentTriggers()) {
      traceNode(getTurn(), "行动识别·触发", "skip", `新指令到来，「${entry.detail}」的触发器过期：${describeAction(entry.step)}`);
    }
    if (!ai || !shouldRecognize(apiCfg, line)) return null;
    const turn = getTurn();
    const classifier = createAiClassifier(bindTurnAi(ai, turn), { cfg: apiCfg });
    const gate = await recognizeAndGate(getState(), line, { classifier, onStage: stageTracer(turn) }).catch((error) => {
      const truncated = error.code === INTENT_TRUNCATED;
      traceNode(turn, "行动识别·闸门", "fail", `${truncated ? "回复被截断" : "识别失败"}，回落自由行动：${error.message || error}`);
      if (truncated) emit("⚠ 行动识别的回复被截断（输出预算用尽），本次按自由行动处理。");
      return null;
    });
    if (!gate) return null;
    traceNode(turn, "行动识别·闸门", gate.route === ROUTES.FALLBACK ? "skip" : "pass", `${gate.route} · 置信度 ${(gate.confidence * 100).toFixed(0)}%`, gate.ms);
    if (gate.route === ROUTES.FALLBACK) return null;
    if (gate.route === ROUTES.CONFIRM) {
      pending = { line, actions: gate.recognition.actions };
      emit(`${gate.confirm}（是/不是）`);
      return 0;
    }
    return execute(line, gate.recognition.actions);
  };
}
