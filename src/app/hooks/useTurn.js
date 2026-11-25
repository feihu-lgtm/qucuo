import { useCallback, useMemo, useRef } from "react";
import { gameActions, gameStore, subscribeGameReplaced } from "../../store/gameStore.js";
import { snapshotIntentPending } from "../../store/intentPendingStore.js";
import { applyResult } from "../../features/run.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { shouldThrottleMovement } from "../../features/map/logic.js";
import { consumeDuelRequest } from "./useDuel.js";
import { classifyError } from "../../utils/apiErrors.js";
import { step as traceStep } from "../../infra/actionTrace.js";
import { getTurnContext, PHASE, turnMonitor } from "../../infra/turnMonitor.js";
import { burnSquare, consumeArrival } from "../../domain/rules/map/mapSquares.js";
import { createTurnStaleCheck } from "./useUndo.js";
import { resolveInnerBlockedSummary, showOuterNoExitNotice } from "./blockedMovementNotice.js";
import { classifyActCommand } from "../../engine/commands/index.js";
import { routeAutoInput, findLookTargetsInText } from "../../domain/rules/input/compositeInput.js";
import { lookNpc } from "../../features/npc/social.js";
import { parseDir } from "../../utils/mudHelpers.js";
import { playTurn } from "../../engine/playTurn.js";
import { resolveIntent } from "../../engine/turn/resolveIntent.js";
import { createTurnContext } from "../../engine/turn/turnContext.js";
import { settleInBackground } from "./settleBackfill.js";
import { lookInBackground } from "./lookBackfill.js";
import { lookNpcInBackground } from "./npcLookBackfill.js";
import { companionChatterTick } from "../../features/npc/companionChatter.js";
import { askStoryteller } from "../../engine/ports/storyteller.js";
import { stampLogEntries } from "../../domain/rules/log/logTypes.js";
import { applySquareOps, featureCtx as runtimeCtx, registerRuntime } from "../runtime/gameRuntime.js";

// 回合入口的 React 胶水：组 env → resolveIntent（识别/裁决）→ createTurnContext
// → playTurn（settleTurn → narrateTurn → finalizeTurn）→ setState。
// 例外路径（不进四段）：whisper 私聊旁白走 talkToNarrator 旁路；本地命令、
// META_QUERY、内层移动、格子命中等由 resolveIntent 判 { proceed:false } 就地了结。
export function useTurn({
  loading, gm, apiCfg, interactMode, activeTarget, activeGroundItem, talkTarget,
  pendingTalks, pendingQuestBranch, nsfwOn, effectiveSpecialNow,
  talkToNarrator, changePendingTalks, lastMoveRef, captureUndo,
  turnGenerationRef, onTurnsInvalidated, talkBusyRef, setCmdHistory, setHistIdx, setInput, setLoading,
  waitTimerRef, setWaitSecs, pendDirRef,
  noteAction, roomMapRef, collectGrantedRef,
  autoTravelRef, clearRouteQueue, setCommandPhase, dispatchCommand,
  outerDepartRef, pickupJudgmentRef, pickupExtractionFailedRef,
  prerunSquares, dayMaterialRef, roundsSinceLastSaveRef, playedThisSessionRef, gambleTalkCtx,
  setVarTree, setGambleNegotiation, setActiveTarget, setDuelPending,
  setPendingQuestBranch, jotNote, intentRouterRef, addLog: addLogProp,
}) {
  // Store 直读（路线一）：游戏状态字段在回调内 gameStore.getState() 现取进 env.state；
  // 各 setter 写走 gameActions；varTreeRef/timeRef 退化为以 store 为源的读写 shim
  // 透给 env.refs（varTree 真正的写仍走传入的 setVarTree——Worker 4 收口前不动）。
  const { setLog, setConvo, setTime, setFlags, setInv, setRoom, setChar, setDao, setExp, setPot, setSkills, setMapData } = gameActions;
  turnMonitor.setGameClockReader(() => gameStore.getState().time);
  // 缺省走 gameActions（路线一）；测试可直接注入自己的 addLog。
  const addLog = useCallback(addLogProp || ((lines) => setLog((p) => [...p, ...stampLogEntries(lines, gameStore.getState().time)])), [addLogProp]);
  const varTreeRef = useMemo(() => ({
    get current() { return gameStore.getState().varTree ?? {}; },
    set current(v) { gameActions.setVarTreeState(v); },
  }), []);
  const timeRef = useMemo(() => ({
    get current() { return gameStore.getState().time ?? 0; },
    set current(v) { gameActions.setTime(v); },
  }), []);
  const actRef = useRef(null);
  const act = useCallback(async (rawCmd, extraReplies = [], opts = {}) => {
    if (!rawCmd.trim()) return;
    if (!opts.schedulerManaged) {
      const commandText = rawCmd.trim();
      // 单轨自动分流（docs 终版）：裸输入（玩家亲手敲的一句话，不带任何内部
      // opts/extraReplies）按内容路由——整句纯看走免费端详，整句纯搭话走免费
      // talk 路，其余整句进行动扣 1 回合。interactMode 的 action/talk 都按
      // 自动处理，只有 whisper/pigeon 保持原有语义。
      const nakedSubmit = !extraReplies?.length && !Object.values(opts).some(Boolean);
      if (nakedSubmit && (interactMode === "action" || interactMode === "talk")) {
        const route = routeAutoInput(commandText, gameStore.getState().room?.npcs);
        if (route.kind === "lookNpc") {
          setInput("");
          setCmdHistory(p => [commandText, ...p].slice(0, 50));
          setHistIdx(-1);
          applyResult(runtimeCtx(), lookNpc(gameStore.getState(), route.npc));
          setActiveTarget(route.npc.name);
          lookNpcInBackground(route.npc, [], { addLog, setTime, setConvo, setLog, noteAction });
          return;
        }
        if (route.kind === "talk") opts = { ...opts, talk: true };
        else if (interactMode === "talk") opts = { ...opts, forceAction: true };
      }
      const isTalkCommand = (opts.talk || interactMode === "talk") && !opts.forceLayer && !opts.forceAction;
      const st0 = gameStore.getState();
      const localCommand = isTalkCommand ? null : parseLocalCommand(commandText, { ...st0, isTalk: isTalkCommand, convo: st0.convo }, { surface: "web" });
      const effModeForClassify = opts.talk ? "talk" : (opts.forceAction ? "action" : interactMode);
      const commandId = classifyActCommand({ rawCmd: commandText, opts, interactMode: effModeForClassify, localCommand, isMove: !!parseDir(commandText) });
      setInput("");
      return dispatchCommand(commandId, () => actRef.current(rawCmd, extraReplies, { ...opts, schedulerManaged: true }), { displayText: opts.displayCmd || commandText });
    }
    const cmd = rawCmd.trim(), isStale = createTurnStaleCheck(turnGenerationRef);
    const effMode = opts.talk ? "talk" : (opts.forceAction ? "action" : interactMode);
    const parent = getTurnContext() || opts.turn;
    const _trace = parent?.phase === PHASE.MACHINE && (!parent.background || parent.commandId === "actWhisper")
      ? parent
      : turnMonitor.start(opts.displayCmd || cmd, { raw: rawCmd, source: opts.forceLayer ? "button" : "command", parentId: parent?.id, passive: loading, commandId: "actRouter" });
    if (parent === _trace) _trace.awaitingSettlement = true;
    const applyLocal = (result, feature) => applyResult(runtimeCtx(), result, { turn: _trace, feature });
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
      cmd, opts, extraReplies, interactMode: effMode, apiCfg, gm, _trace, isStale,
      pending: snapshotIntentPending(),
      state: {
        ...gameStore.getState(),
        pendingQuestBranch, activeTarget, activeGroundItem, talkTarget,
        nsfwOn, effectiveSpecialNow,
      },
      refs: {
        lastMoveRef, pendDirRef, outerDepartRef, varTreeRef, roomMapRef,
        pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef,
        autoTravelRef, intentRouterRef, gambleTalkCtx, dayMaterialRef,
        roundsSinceLastSaveRef, playedThisSessionRef, timeRef,
      },
      io: {
        addLog, setInput, setCmdHistory, setHistIdx, setLoading, setWaitSecs,
        waitTimerRef, setInv, setRoom, setFlags, setVarTree, setGambleNegotiation,
        setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
        setPendingQuestBranch, setConvo, setLog, jotNote, noteAction,
        changePendingTalks, setCommandPhase, onTurnsInvalidated,
        getGameState: () => gameStore.getState(),
        gameActions, subscribeGameReplaced,
        applyLocal, stopAutoTravel, showOuterNoExitNotice,
        resolveInnerBlockedSummary, prerunSquares,
        traceStep,
        lookInBackground: (cmd) => lookInBackground(cmd, { addLog, setTime, setConvo, setLog, noteAction }),
        beforeRun: () => { pickupExtractionFailedRef.current = false; },
      },
    };

    // ── 第一段：意图识别 + 前置裁决（本地命令/META/路由/移动/采集）──
    const resolved = await resolveIntent(cmd, env);
    if (!resolved.proceed) { summary = resolved.summary; return; }
    const { isTalk, isSettle } = resolved.plan;

    // 复合句里点到名的「看X」段：行动回合照常跑，同轮插系统端详卡+后台
    // 补写（免费，同 lookNpcInBackground 路径），不写进行动配额。
    for (const npc of resolved.plan.lookNpcs || []) {
      applyResult(runtimeCtx(), lookNpc(gameStore.getState(), npc));
      lookNpcInBackground(npc, [], { addLog, setTime, setConvo, setLog, noteAction, advanceTime: false });
    }

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
        { t: "sys", text: ec.retryable === false
          ? `     （本轮状态已整体回滚，未留下半提交脏数据；改好设置后再试）`
          : `     （本轮状态已整体回滚，未留下半提交脏数据；可直接重试）` },
      ]);
    }
    consumeDuelRequest(result, { opts, isStale, isTalk, interactMode: effMode, setActiveTarget, setDuelPending, trace: _trace });
    noteAction(isSettle ? "settle" : isTalk ? "talk" : "action");
    // 随行同伴随机插话（评价玩家活动）：概率触发、AI 现写（无 API 兜底句），记日志 + 进记忆
    if (result.ok && !isStale()) {
      const cur = gameStore.getState();
      companionChatterTick({
        companionState: cur.companionState, roomName: cur.room?.name, state: cur,
        activity: { text: cmd, intent: resolved.plan?.intent?.code }, ask: askStoryteller,
      }).then((c) => {
        if (!c || isStale()) return;
        addLog([{ t: "desc", text: `  ${c.speaker}：“${c.line}”` }]);
        jotNote({ text: `${c.speaker}见状说道：“${c.line}”`, owner: [c.speaker] });
      }).catch(() => {});
    }
    if (isTalk) changePendingTalks(-1); else setLoading(false);
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    setWaitSecs(0);
    } catch (error) {
      if (_trace.totalMs == null && !isStale()) turnMonitor.transition(_trace, PHASE.ERROR, String(error));
      throw error;
    } finally {
      await Promise.resolve();
      if (isStale() && _trace.totalMs == null) turnMonitor.transition(_trace, PHASE.DISCARDED, "收到过期结果");
      else turnMonitor.finish(_trace, summary);
    }
  }, [loading, gm, apiCfg, interactMode, activeTarget, activeGroundItem, talkTarget, pendingTalks, pendingQuestBranch, nsfwOn, effectiveSpecialNow, addLog, talkToNarrator, changePendingTalks, captureUndo, setInput, setCmdHistory, setHistIdx, setLoading, setWaitSecs, waitTimerRef, lastMoveRef, talkBusyRef, turnGenerationRef, autoTravelRef, intentRouterRef, setActiveTarget, setDuelPending, setGambleNegotiation, setPendingQuestBranch, setVarTree, jotNote, noteAction, outerDepartRef, roomMapRef, pendDirRef, pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef, roundsSinceLastSaveRef, playedThisSessionRef, gambleTalkCtx, prerunSquares, dispatchCommand, setCommandPhase, clearRouteQueue, onTurnsInvalidated]);
  actRef.current = act;
  const featureCtx = useMemo(() => ({
    addLog,
    jotNote,
    gameActions,
    setVarTree,
    act,
    settleInBackground: (cmd, opts) => settleInBackground(cmd, opts, {
      addLog, setTime, setConvo, setVarTree, setLog, jotNote, noteAction,
    }),
    lookNpcInBackground: (npc, extraReplies) => lookNpcInBackground(npc, extraReplies, {
      addLog, setTime, setConvo, setLog, noteAction,
    }),
    applySquareOps,
  }), [addLog, jotNote, setVarTree, act, noteAction]);
  registerRuntime(featureCtx); // 模块级 runtime 注册：hook 可经 gameRuntime.featureCtx() 取，不再收 featureCtxRef

  return { act };
}
