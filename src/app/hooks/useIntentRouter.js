// 行动识别（设置「行动识别」开启时）的 web 端执行：第一段识别 → 置信度闸门 → 系统闸门 →
// 原子行动经现有调度器排队 → 第二段合并叙事（结构化裁决上下文）→ 第三段提取照旧（被拒步骤不写效果）。
import { useEffect } from "react";
import { gameStore } from "../../store/gameStore.js";
import { setIntentPending } from "../../store/intentPendingStore.js";
import { turnMonitor, getTurnContext } from "../../core/turnMonitor.js";
import { applyResult } from "../../features/run.js";
import { recognizeNpc, tradeWithNpc } from "../../features/npc/logic.js";
import { ACTION_KINDS, KIND_COMMAND } from "../../domain/intent/actionKinds.js";
import { ROUTES } from "../../domain/intent/gate.js";
import { DEFERRED_KINDS, findStepNpc, stepEffect, withoutSettle } from "../../features/intent/logic.js";
import { planSteps, recognizeAndGate, rejectionLog, shouldRecognize, stageTracer, traceNode } from "../../features/intent/route.js";
import { createAiClassifier, INTENT_TRUNCATED } from "../../engine/intent/aiClassifier.js";
import { bindTurnAi, createWebAi } from "../../engine/ports/ai.js";

const DIR_CMD = { 北: "n", 南: "s", 东: "e", 西: "w" };

export function useIntentRouter(routerRef, {
  apiCfg, act, addLog, featureCtxRef, dispatchCommand, handleNpcDuel, handleNpcTrade, setActiveTarget, setDuelPending, setTradingShop,
}) {
  useEffect(() => {
    function runDeferred(step, single) {
      const npc = findStepNpc(gameStore.getState(), step);
      if (step.kind === ACTION_KINDS.MOVE) return act(DIR_CMD[step.direction] || step.direction, [], { keepUndo: true });
      if (step.kind === ACTION_KINDS.BUY && single) return handleNpcTrade(npc);
      if (step.kind === ACTION_KINDS.BUY && npc) {
        const result = tradeWithNpc(gameStore.getState(), npc);
        return result.shop ? setTradingShop(result.shop) : applyResult(featureCtxRef.current, result);
      }
      if (step.kind !== ACTION_KINDS.DUEL || !npc) return undefined;
      if (single) return handleNpcDuel(npc);
      return dispatchCommand(KIND_COMMAND[step.kind], () => applyResult(featureCtxRef.current, () => {
        applyResult(featureCtxRef.current, recognizeNpc(gameStore.getState(), npc));
        setActiveTarget(npc.name);
        setDuelPending(npc);
      }, { feature: "intent.duel" }));
    }

    function execute(cmd, actions, turn) {
      const state = gameStore.getState();
      const startedAt = Date.now();
      const { plan, note, single } = planSteps(state, actions);
      traceNode(turn, "行动识别·系统闸门", plan.rejected ? "warn" : "pass",
        `通过 ${plan.valid.length} 步${plan.rejected ? ` · 第${plan.rejected.index + 1}步拒绝：${plan.rejected.reason}` : ""}`, Date.now() - startedAt);
      const rejected = rejectionLog(plan);
      if (rejected) addLog([rejected]);
      for (const step of plan.valid) {
        if (DEFERRED_KINDS.has(step.kind)) continue;
        dispatchCommand(KIND_COMMAND[step.kind], () => {
          const result = stepEffect(gameStore.getState(), step);
          if (!result) return;
          const settled = single ? { ...result, settleOptions: { ...result.settleOptions, intentPlan: plan, intentPlanNote: note } } : withoutSettle(result);
          applyResult(featureCtxRef.current, settled, { feature: `intent.${step.kind}` });
        });
      }
      if (!single && plan.valid.length) act(cmd, [], { intentPlan: plan, intentPlanNote: note, silentCmd: true, keepUndo: true });
      for (const step of plan.valid) if (DEFERRED_KINDS.has(step.kind)) runDeferred(step, single);
    }

    routerRef.current = async (cmd, { _trace, opts = {} } = {}) => {
      if (!shouldRecognize(apiCfg, cmd, opts)) return false;
      const classifier = createAiClassifier(bindTurnAi(createWebAi(), _trace), { cfg: apiCfg });
      const onStage = stageTracer(_trace);
      const gate = await recognizeAndGate(gameStore.getState(), cmd, { classifier, onStage }).catch((error) => {
        const truncated = error.code === INTENT_TRUNCATED;
        traceNode(_trace, "行动识别·闸门", "fail", `${truncated ? "回复被截断" : "识别失败"}，回落自由行动：${error.message || error}`);
        if (truncated) addLog([{ t: "sys", text: "  ⚠ 行动识别的回复被截断（输出预算用尽），本次按自由行动处理。" }]);
        return null;
      });
      if (!gate) return false;
      traceNode(_trace, "行动识别·闸门", gate.route === ROUTES.FALLBACK ? "skip" : "pass",
        `${gate.route} · 置信度 ${(gate.confidence * 100).toFixed(0)}% · ${gate.recognition.actions.map((a) => a.kind).join("→")}`, gate.ms);
      if (gate.route === ROUTES.FALLBACK) return false;
      turnMonitor.activate(_trace);
      addLog([{ t: "cmd", text: `> ${cmd}` }]);
      if (gate.route === ROUTES.EXECUTE) {
        execute(cmd, gate.recognition.actions, _trace);
        return true;
      }
      addLog([{ t: "sys", text: `  ${gate.confirm}` }]);
      setIntentPending({
        text: gate.confirm,
        onConfirm: () => {
          setIntentPending(null);
          dispatchCommand("typedAction", () => applyResult(featureCtxRef.current,
            () => execute(cmd, gate.recognition.actions, getTurnContext()), { feature: "行动识别·确认" }));
        },
        onCancel: () => {
          setIntentPending(null);
          act(cmd, [], { intentSkip: true, silentCmd: true });
        },
      });
      return true;
    };
  });
}
