import { useCallback, useMemo, useRef } from "react";
import { gameStore } from "../../store/gameStore.js";
import { snapshotIntentPending } from "../../store/intentPendingStore.js";
import { applyResult } from "../../features/run.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { shouldThrottleMovement } from "../../features/map/logic.js";
import { consumeDuelRequest } from "./useDuel.js";
import { callModel } from "../../infra/apiConfig.js"; import { classifyError } from "../../utils/apiErrors.js";
import { step as traceStep } from "../../infra/actionTrace.js";
import { getTurnContext, PHASE, turnMonitor } from "../../core/turnMonitor.js";
import { burnSquare, consumeArrival } from "../../domain/rules/map/mapSquares.js";
import { createTurnStaleCheck } from "./useUndo.js";
import { resolveInnerBlockedSummary, showOuterNoExitNotice } from "./blockedMovementNotice.js";
import { classifyActCommand } from "../../engine/commands/index.js";
import { parseDir } from "../../utils/mudHelpers.js";
import { playTurn } from "../../engine/playTurn.js";
import { resolveIntent } from "../../engine/turn/resolveIntent.js";
import { createTurnContext } from "../../engine/turn/turnContext.js";

// 回合入口的 React 胶水：组 env → resolveIntent（识别/裁决）→ createTurnContext
// → playTurn（settleTurn → narrateTurn → finalizeTurn）→ setState。
// 例外路径（不进四段）：whisper 私聊旁白走 talkToNarrator 旁路；本地命令、
// META_QUERY、内层移动、格子命中等由 resolveIntent 判 { proceed:false } 就地了结。
export function useTurn({
  loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset,
  addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget, activeGroundItem, setActiveTarget, setDuelPending,
  nsfwOn, varTree, pendingTalks, changePendingTalks, lastMoveRef, captureUndo,
  turnGenerationRef, onTurnsInvalidated, talkBusyRef, setCmdHistory, setHistIdx, setFlags, setInput, setLoading,
  waitTimerRef, setWaitSecs, pendDirRef, featureCtxRef,
  noteAction, roomMapRef, questProgress, innerRoomName, setRoom, setInv, collectGrantedRef,
  autoTravelRef, clearRouteQueue, setCommandPhase, dispatchCommand,
  outerDepartRef, varTreeRef, pickupJudgmentRef, pickupExtractionFailedRef,
  prerunSquares, dayMaterialRef, roundsSinceLastSaveRef, playedThisSessionRef, gambleTalkCtx,
  timeRef, talkTarget, companionState, pendingQuestBranch, effectiveSpecialNow, setVarTree,
  setGambleNegotiation, setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
  setPendingQuestBranch, setConvo, jotNote, setLog, intentRouterRef,
}) {
  const actRef = useRef(null);
  const act = useCallback(async (rawCmd, extraReplies = [], opts = {}) => {
    if (!rawCmd.trim()) return;
    if (!opts.schedulerManaged) {
      const commandText = rawCmd.trim();
      const isTalkCommand = interactMode === "talk" && !opts.forceLayer;
      const localCommand = isTalkCommand ? null : parseLocalCommand(commandText, { ...gameStore.getState(), isTalk: isTalkCommand, convo }, { surface: "web" });
      const commandId = classifyActCommand({ rawCmd: commandText, opts, interactMode, localCommand, isMove: !!parseDir(commandText) });
      setInput("");
      return dispatchCommand(commandId, () => actRef.current(rawCmd, extraReplies, { ...opts, schedulerManaged: true }), { displayText: opts.displayCmd || commandText });
    }
    const cmd = rawCmd.trim(), isStale = createTurnStaleCheck(turnGenerationRef);
    const parent = getTurnContext() || opts.turn;
    const _trace = parent?.phase === PHASE.MACHINE && (!parent.background || parent.commandId === "actWhisper")
      ? parent
      : turnMonitor.start(opts.displayCmd || cmd, { raw: rawCmd, source: opts.forceLayer ? "button" : "command", parentId: parent?.id, passive: loading, commandId: "actRouter" });
    if (parent === _trace) _trace.awaitingSettlement = true;
    const applyLocal = (result, feature) => applyResult(featureCtxRef.current, result, { turn: _trace, feature });
    let summary, result;
    try {
    const stopAutoTravel = (encounter) => {
      const hostile = Boolean(encounter?.hostile); if (!autoTravelRef.current) return void intentRouterRef?.current?.fireEvent?.("encounter", { hostile }); // 只有 hostile 路遇应验「遇敌」，手动走动同样
      const dropped = clearRouteQueue();
      autoTravelRef.current = false;
      const message = `  ⚠ 路上撞见生人，自动赶路就此打住（余下 ${dropped} 程未走）。要接着走，另点目的地即可。`;
      addLog([{ t: "sys", text: message, standalone: true }]);
      intentRouterRef?.current?.fireEvent?.("encounter", { hostile }); intentRouterRef?.current?.expireTriggers?.(_trace); // 路遇应验遇敌步；行程中断，其余触发器过期
    };

    // 移动节流属调度职责，留在 hook；须先于 whisper 分支判定（原顺序）。
    if (opts.forceLayer) {
      const now = Date.now();
      if (shouldThrottleMovement({
        forceLayer: opts.forceLayer,
        autoTravel: opts.autoTravel,
        elapsed: now - lastMoveRef.current,
      })) return;
      if (!opts.autoTravel) lastMoveRef.current = now;
    }

    // 例外路径：私聊旁白不经四段流水线——串行锁 + talkToNarrator 旁路。
    // 一条还在跑时不允许真的发出第二条——否则两条并发会读到同一份
    // 发送前的 convo（历史一样），且流式占位用的 logIdx.current 是共享 ref，两条
    // 回调互相踩踏，表现为"日志一下出两条/重复"。用 talkBusyRef（同步 ref，不等
    // re-render）挡住极快连点；输入框允许预打字，只拦实际发送。
    if (interactMode === "whisper") {
      if (talkBusyRef.current || pendingTalks > 0) {
        addLog([{ t: "sys", text: "  旁白还在回话，稍候再说下一句。" }]);
        return;
      }
      talkBusyRef.current = true;
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      // 教程任务「四宅家产」触发点之三：跟旁白聊到溪边小屋（幂等）
      if (/溪边小屋/.test(cmd)) setFlags(f => f.includes("tutorial_estate_started") ? f : [...f, "tutorial_estate_started"]);
      await talkToNarrator(cmd, { isStale, turn: _trace });
      return;
    }
    if (!opts.keepUndo) captureUndo(_trace);

    const env = {
      cmd, opts, extraReplies, interactMode, apiCfg, gm, _trace,
      pending: snapshotIntentPending(),
      state: {
        room, char, inv, skills, dao, exp, pot, flags, mapData, time, convo,
        questProgress, pendingQuestBranch, innerRoomName, activeTarget,
        activeGroundItem, talkTarget, companionState, narrator, preset, nsfwOn,
        varTree, effectiveSpecialNow,
      },
      refs: {
        lastMoveRef, pendDirRef, outerDepartRef, varTreeRef, roomMapRef,
        pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef,
        autoTravelRef, intentRouterRef, gambleTalkCtx, dayMaterialRef,
        roundsSinceLastSaveRef, playedThisSessionRef, timeRef, featureCtxRef,
      },
      io: {
        addLog, setInput, setCmdHistory, setHistIdx, setLoading, setWaitSecs,
        waitTimerRef, setInv, setRoom, setFlags, setVarTree, setGambleNegotiation,
        setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
        setPendingQuestBranch, setConvo, setLog, jotNote, noteAction,
        changePendingTalks, setCommandPhase, onTurnsInvalidated,
        getGameState: () => gameStore.getState(),
        applyLocal, stopAutoTravel, showOuterNoExitNotice,
        resolveInnerBlockedSummary, prerunSquares,
        traceStep, callModel,
        beforeRun: () => { pickupExtractionFailedRef.current = false; },
      },
    };

    // ── 第一段：意图识别 + 前置裁决（本地命令/META/路由/移动/采集）──
    const resolved = await resolveIntent(cmd, env);
    if (!resolved.proceed) { summary = resolved.summary; return; }
    const { isTalk, isSettle } = resolved.plan;

    // loading 态 + 计时器：在第一个 await（下方 recall/knowledge）之前启动——
    // 内层移动已在 resolveIntent 内 early return（不进 loading），这里之后才
    // 真正要调 AI，且在第一个 await 之前，不破并发锁。
    if (isTalk) changePendingTalks(1); else setLoading(true);
    setWaitSecs(0); if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    waitTimerRef.current = setInterval(() => setWaitSecs(s => s + 1), 1000);

    // ── 第二~四段：软结算 → 叙事 → 落盘（playTurn 内部编排）──
    const turnCtx = createTurnContext({ plan: resolved.plan, env });
    result = await playTurn(turnCtx, cmd, opts);
    if (result.stale) return;
    if (!result.ok) {
      const e = result.error;
      const ec = classifyError(e);
      traceStep(_trace, "状态写回", "fail", `异常回滚：${ec.title}`);
      addLog([
        { t: "err", text: `  ${ec.icon} ${ec.title}` },
        { t: "err", text: `     ${ec.detail}` },
        { t: "sys", text: `     ▸ ${ec.hint}` },
        { t: "sys", text: `     （本轮状态已整体回滚，未留下半提交脏数据；可直接重试）` },
      ]);
    }
    consumeDuelRequest(result, { opts, isStale, isTalk, interactMode, setActiveTarget, setDuelPending, featureCtxRef, trace: _trace });
    noteAction(isSettle ? "settle" : isTalk ? "talk" : "action");
    if (isTalk) changePendingTalks(-1); else setLoading(false);
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    setWaitSecs(0);
    } catch (error) {
      if (_trace.totalMs == null && !isStale()) turnMonitor.transition(_trace, PHASE.ERROR, String(error));
      throw error;
    } finally {
      if (opts.duelReportFallback && (!result?.ok || result.stale || isStale())) opts.duelReportFallback(); await Promise.resolve();
      if (isStale() && _trace.totalMs == null) turnMonitor.transition(_trace, PHASE.DISCARDED, "收到过期结果");
      else turnMonitor.finish(_trace, summary);
    }
  }, [loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset, addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget, activeGroundItem, setActiveTarget, setDuelPending, nsfwOn, varTree, questProgress, pendingTalks, changePendingTalks, captureUndo, dispatchCommand, setCommandPhase, clearRouteQueue, onTurnsInvalidated]);
  actRef.current = act;
  const featureCtx = useMemo(() => ({
    addLog,
    jotNote,
    setVarTree,
    act,
    applySquareOps: (ops) => {
      for (const { op, key, day } of ops) {
        if (op === "consume") consumeArrival(key, day);
        else if (op === "burn") burnSquare(key);
      }
    },
  }), [addLog, jotNote, setVarTree, act]);
  featureCtxRef.current = featureCtx;

  return { act };
}
