// 行动识别（设置「行动识别」开启时）的 web 端执行：第一段识别 → 置信度闸门 → 系统闸门 →
import { featureCtx } from "../runtime/gameRuntime.js";
// 原子行动经现有调度器排队 → 第二段合并叙事（结构化裁决上下文）→ 第三段提取照旧（被拒步骤不写效果）。
import { useEffect } from "react";
import { gameStore } from "../../store/gameStore.js";
import { setIntentPending, armIntentTriggers, fireIntentTriggers, expireIntentTriggers } from "../../store/intentPendingStore.js";
import { turnMonitor, getTurnContext } from "../../infra/turnMonitor.js";
import { applyResult } from "../../features/run.js";
import { recognizeNpc, tradeWithNpc } from "../../features/npc/logic.js";
import { ACTION_KINDS, KIND_COMMAND } from "../../domain/rules/intent/actionKinds.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";
import { ROUTES, describeAction } from "../../domain/rules/intent/gate.js";
import { DEFERRED_KINDS, findStepNpc, stepEffect, withoutSettle } from "../../features/intent/logic.js";
import { isFreshTyped, planSteps, recognizeAndGate, rejectionLog, shouldRecognize, stageTracer, traceNode } from "../../features/intent/route.js";
import { formatPlanNote } from "../../domain/rules/intent/planNotes.js";
import { createAiClassifier, INTENT_TRUNCATED } from "../../engine/intent/aiClassifier.js";
import { splitCompositeInput } from "../../domain/rules/input/compositeInput.js";
import { bindTurnAi, createWebAi } from "../../engine/ports/ai.js";
import { setActiveBuilding } from "../../store/sessionUiStore.js";
import { visibleBuildingsAt } from "../../domain/rules/map/placeIntent.js";

const DIR_CMD = { 北: "n", 南: "s", 东: "e", 西: "w" };
// 条件步「到达」匹配用的地名清单，注入 intentPendingStore（store 不反向引 domain）。
const INTENT_PLACE_NAMES = Object.keys(QUCUO_MAP);

export function useIntentRouter(routerRef, {
  apiCfg, act, addLog, dispatchCommand, handleNpcDuel, handleNpcTrade, setActiveTarget, setDuelPending, setTradingShop,
}) {
  useEffect(() => {
    // WO-16F-F2c：第三参 opts 透传 handler（如 skipCaptureUndo）——判官链叙事后
    // 接续的交互不是新玩家动作；旧调用无第三参，行为零变化。
    function runDeferred(step, single, opts = {}) {
      const npc = findStepNpc(gameStore.getState(), step);
      if (step.kind === ACTION_KINDS.MOVE && step.enterBuilding) return enterBuildingStep(step);
      // #670：点名相邻据点的移动强制走外层，免得在有内层地图的据点里被同方向内层房截走。
      if (step.kind === ACTION_KINDS.MOVE) {
        const layer = step.outerDest ? { forceLayer: "outer" } : step.innerDest ? { forceLayer: "inner" } : {};
        return act(DIR_CMD[step.direction] || step.direction, [], { keepUndo: true, intentSkip: true, ...layer });
      }
      // BUY single 守卫：对象不在场/查无此人时不喂 null 进 handler
      if (step.kind === ACTION_KINDS.BUY && single) {
        if (!npc) {
          addLog?.([{ t: "sys", text: `  ${step.target || "对方"}不在眼前，交易无从谈起。` }]);
          return undefined;
        }
        return handleNpcTrade(npc, opts);
      }
      if (step.kind === ACTION_KINDS.BUY && npc) {
        const result = tradeWithNpc(gameStore.getState(), npc);
        if (result.shop) {
          if (result.changes || result.logs?.length) applyResult(featureCtx(), { changes: result.changes, logs: result.logs });
          return setTradingShop(result.shop);
        }
        return applyResult(featureCtx(), result);
      }
      if (step.kind !== ACTION_KINDS.DUEL || !npc) return undefined;
      if (single) return handleNpcDuel(npc, opts);
      return dispatchCommand(KIND_COMMAND[step.kind], () => applyResult(featureCtx(), () => {
        applyResult(featureCtx(), recognizeNpc(gameStore.getState(), npc));
        setActiveTarget(npc.name);
        setDuelPending(npc);
      }, { feature: "intent.duel" }));
    }

    // #670「进某某」：建筑就在眼前直接开门；隔一间房先走到门前（内层移动是本地瞬时结算），
    // 到了且门在眼前才开门，没走到就只留移动结果。
    function enterBuildingStep(step) {
      const building = step.enterBuilding;
      const open = () => {
        const st = gameStore.getState();
        if (!visibleBuildingsAt(st.room?.name, st.innerRoomName).some((b) => b.id === building.id)) return;
        setActiveBuilding(building);
        addLog?.([{ t: "sys", text: `  你走进了「${building.name}」。` }]);
      };
      if (!step.innerDir) return open();
      return Promise.resolve(act(step.innerDir, [], { keepUndo: true, intentSkip: true, forceLayer: "inner" })).then(open);
    }

    // 条件步触发：走原有命令调度器排队；立即结算类照旧 stepEffect，需要交互/自由文本的走原入口。
    // beforeRoute：自动寻路途经点上应验时，排在剩余路程之前（不拖到终点才做）。
    function runTriggerStep(step) {
      // 打字输入路径（条件步触发）autoProceedAfterLook：玩家已明写「切磋/交易」，
      // 未端详只做静默端详直拉邀战，绝不跑整轮说书后再要玩家重输一遍（决斗队列空转复发根因）。
      if (DEFERRED_KINDS.has(step.kind)) return runDeferred(step, true, { autoProceedAfterLook: true });
      if (step.kind === ACTION_KINDS.TALK || step.kind === ACTION_KINDS.OTHER) {
        return dispatchCommand(KIND_COMMAND[step.kind], () => act(step.text, [], { silentCmd: true, intentSkip: true, keepUndo: true }));
      }
      return dispatchCommand(KIND_COMMAND[step.kind], () => {
        const result = stepEffect(gameStore.getState(), step);
        if (result) applyResult(featureCtx(), result, { feature: `intent.${step.kind}` });
      });
    }

    function fireTriggerStep(step, turn, { beforeRoute = false } = {}) {
      traceNode(turn, "行动识别·触发", "pass", `「${step.condition?.detail || ""}」应验，触发：${describeAction(step)}`);
      if (!beforeRoute) return runTriggerStep(step);
      return dispatchCommand(KIND_COMMAND[step.kind], () => runTriggerStep(step), { beforeRoute: true });
    }

    // 行程结束/被打断：剩余「到达」触发算应验，其余触发器过期，统一记进行动树。
    function settleTriggers({ dest } = {}) {
      const turn = getTurnContext();
      for (const entry of fireIntentTriggers("arrive", { dest, travelDone: true, placeNames: INTENT_PLACE_NAMES })) fireTriggerStep(entry.step, turn);
      for (const entry of expireIntentTriggers()) {
        traceNode(turn, "行动识别·触发", "skip", `「${entry.detail}」未成，触发器过期：${describeAction(entry.step)}`);
      }
    }

    function execute(cmd, actions, turn) {
      const state = gameStore.getState();
      const startedAt = Date.now();
      let { plan, note, single } = planSteps(state, actions);
      // 硬行动配额：复合输入（括号/多断句）一句只落一个决定性硬步——
      // 挤出去的步挂进 skipped（裁决备注重算），交给同轮叙事按对白/氛围处理，
      // 否则 note 仍核准它们，提取段会为没落账的步骤删物品。
      if (splitCompositeInput(cmd).length > 1 && plan.valid.length > 1) {
        plan.skipped = [...(plan.skipped || []), ...plan.valid.slice(1)];
        plan.valid = plan.valid.slice(0, 1);
        note = formatPlanNote(plan, state);
      }
      traceNode(turn, "行动识别·系统闸门", plan.rejected ? "warn" : "pass",
        `通过 ${plan.valid.length} 步${plan.rejected ? ` · 第${plan.rejected.index + 1}步拒绝：${plan.rejected.reason}` : ""}`, Date.now() - startedAt);
      const rejected = rejectionLog(plan);
      if (rejected) addLog([rejected]);
      // 条件步不立即执行，挂为待定触发；前提为「被拒」的步此刻立即触发。
      const armed = armIntentTriggers(plan.triggers);
      if (armed.length) traceNode(turn, "行动识别·触发", "pass", `挂起 ${armed.length} 个条件步：${armed.map((entry) => describeAction(entry.step)).join("；")}`);
      for (const step of plan.valid) {
        if (DEFERRED_KINDS.has(step.kind)) continue;
        dispatchCommand(KIND_COMMAND[step.kind], () => {
          const result = stepEffect(gameStore.getState(), step);
          if (!result) return;
          const settled = single ? { ...result, settleOptions: { ...result.settleOptions, intentPlan: plan, intentPlanNote: note } } : withoutSettle(result);
          applyResult(featureCtx(), settled, { feature: `intent.${step.kind}` });
        });
      }
      if (!single && plan.valid.length) act(cmd, [], { intentPlan: plan, intentPlanNote: note, silentCmd: true, keepUndo: true });
      for (const step of plan.valid) if (DEFERRED_KINDS.has(step.kind)) runDeferred(step, single, { autoProceedAfterLook: true });
      // 「被拒」触发在已核准步骤都派完之后才发，免得它抢走前面步骤要用的资源。
      if (plan.refused) fireTriggerStep(plan.refused, turn);
      // 前提判不进封闭集合的从句，按原文各走一趟自由行动。
      for (const step of plan.freeSteps || []) act(step.text, [], { silentCmd: true, intentSkip: true, keepUndo: true });
    }

    routerRef.current = async (cmd, { _trace, opts = {} } = {}) => {
      // 玩家又输入了一句新指令：上一波挂起的条件步到期。
      if (isFreshTyped(opts)) {
        for (const entry of expireIntentTriggers()) {
          traceNode(_trace, "行动识别·触发", "skip", `新指令到来，「${entry.detail}」的触发器过期：${describeAction(entry.step)}`);
        }
      }
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
      addLog([{ t: "cmd", text: `> ${cmd}`, tid: _trace?.id }]);
      if (gate.route === ROUTES.EXECUTE) {
        execute(cmd, gate.recognition.actions, _trace);
        return true;
      }
      addLog([{ t: "sys", text: `  ${gate.confirm}` }]);
      setIntentPending({
        text: gate.confirm,
        onConfirm: () => {
          setIntentPending(null);
          dispatchCommand("typedAction", () => applyResult(featureCtx(),
            () => execute(cmd, gate.recognition.actions, getTurnContext()), { feature: "行动识别·确认" }));
        },
        onCancel: () => {
          setIntentPending(null);
          act(cmd, [], { intentSkip: true, silentCmd: true });
        },
      });
      return true;
    };
    // 供 useTurn / useAutoTravel 在遇敌、到达、行程结束时驱动条件步。
    routerRef.current.fireTriggerStep = fireTriggerStep;
    // WO-16F-F2c：暴露既有 deferred 闭包给判官链交互意向消费——
    // duel→handleNpcDuel/openDuelAfterNarration、trade→handleNpcTrade/setTradingShop
    // 全走这份旧逻辑，不在 useTurn 重穿一份。仅暴露句柄，不改旧行为。
    routerRef.current.runDeferred = runDeferred;
    routerRef.current.fireEvent = (on, opts) => {
      const turn = getTurnContext();
      const beforeRoute = on === "arrive" && opts?.travelDone === false;
      for (const entry of fireIntentTriggers(on, { placeNames: INTENT_PLACE_NAMES, ...opts })) fireTriggerStep(entry.step, turn, { beforeRoute });
    };
    routerRef.current.settleTriggers = settleTriggers;
    routerRef.current.expireTriggers = (trace) => {
      for (const entry of expireIntentTriggers()) {
        traceNode(trace, "行动识别·触发", "skip", `「${entry.detail}」未成，触发器过期：${describeAction(entry.step)}`);
      }
    };
  });
}
