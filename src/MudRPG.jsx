import React, { useRef, useEffect, useCallback } from "react";
import {
  OVERLAY, openOverlay, useOverlay,
} from "./store/uiStore.js";
import OverlayHost from "./ui/OverlayHost.jsx";
import GameLayout from "./ui/GameLayout.jsx";
import { useAutosave } from "./app/hooks/useAutosave.js";
import { useUndo } from "./app/hooks/useUndo.js";
import { useCommandScheduler } from "./app/hooks/useCommandScheduler.js";
import { useDaySummary } from "./app/hooks/useDaySummary.js";
import { usePrivateTalk } from "./app/hooks/usePrivateTalk.js";
import { useOutfitAdvice } from "./app/hooks/useOutfitAdvice.js";
import { useAiInspect } from "./app/hooks/useAiInspect.js";
import { useTurn } from "./app/hooks/useTurn.js";
import { useQuestPanel } from "./app/hooks/useQuestPanel.js";
import { useDuel, useForcedDuelNpc } from "./app/hooks/useDuel.js";
import { usePigeonReplies } from "./app/hooks/usePigeonReplies.js";
import { usePigeonHandlers } from "./app/hooks/usePigeonHandlers.js";
import { useAutoTravel } from "./app/hooks/useAutoTravel.js";
import { useCraftingAI } from "./app/hooks/useCraftingAI.js";
import { useScreenHandlers } from "./app/hooks/useScreenHandlers.js";
import { useIntentRouter } from "./app/hooks/useIntentRouter.js";
import { useCardImportHandlers } from "./app/hooks/useCardImportHandlers.js";
import { useBuildingHandlers } from "./app/hooks/useBuildingHandlers.js";
import { useProgressionHandlers } from "./app/hooks/useProgressionHandlers.js";
import { usePlayerActionHandlers } from "./app/hooks/usePlayerActionHandlers.js";
import { useGameUi, usePresetImport, createInputKeyHandler } from "./app/hooks/useGameUi.js";
import { useGameStoreBindings } from "./app/hooks/useGameStoreBindings.js";
import { useNotes } from "./app/hooks/useNotes.js";
import {
  useGameStartup, useGameStartupBindings, useGameStartupOpeningFaces,
  useGameStartupRegistry, useGameStartupShortcut,
} from "./app/hooks/useGameStartup.js";
import { buildLayoutCtx, buildOverlayCtx } from "./app/contextBuilders.js";
import { useWorldRulesRunner } from "./app/hooks/useWorldRulesRunner.js";
import { DEFAULT_PRESETS } from "./engine/newGame.js";
import { selectEffectiveStats } from "./features/stats/logic.js";
import { hasApiCredentials, saveConfig } from "./infra/apiConfig.js";
import { chromeBtn } from "./utils/theme.js";

export default function MudRPG({ initialLoadSlotId = null, initialOpenSettings = false, onReturnToStart } = {}) {
  const bootedForSettingsRef = useRef(initialOpenSettings);
  const { restored } = useGameStartup({ initialLoadSlotId, initialOpenSettings });
  const showSettings = useOverlay(OVERLAY.SETTINGS);
  const showOpening = useOverlay(OVERLAY.OPENING);
  const showCharCreate = useOverlay(OVERLAY.CHAR_CREATE);
  const showBody = useOverlay(OVERLAY.BODY);
  const showMusicPanel = useOverlay(OVERLAY.MUSIC_PANEL);
  const showHomestead = useOverlay(OVERLAY.HOMESTEAD);
  const markGameStarted = useCallback(() => {
    bootedForSettingsRef.current = false;
    try {
      if (localStorage.getItem("qucuo_tutorial_seen") !== "1") openOverlay(OVERLAY.TUTORIAL);
    } catch {}
  }, []);
  useEffect(() => {
    if (showCharCreate || showOpening) markGameStarted();
  }, [showCharCreate, showOpening, markGameStarted]);
  const bindings = useGameStoreBindings({ restored });
  const {
    setChar, setDao, setSkills, setExp, setPot, setInv, setCompanionState, setPreset,
    setRoom, setInnerRoomName, setMapData, setTime, setLog, setConvo, setNarrator,
    setFlags, setQuestProgress, setPersuasionProgress, setClaimedMilestones,
    setDeposit, setDepositedAt, setPledgedItems, preset, room, innerRoomName,
    restoredInnerRef, prevRoomNameRef, char, dao, skills, companionState, companionStateRef,
    inv, log, convo, exp, pot, flags, questProgress, persuasionProgress, mapData, deposit,
    depositedAt, pledgedItems, time, timeRef, narrator, varTree, claimedMilestones,
    varTreeRef, setVarTree,
  } = bindings;
  const ui = useGameUi({
    room, innerRoomName, char, inv, log, time, narrator, preset,
    flags, questProgress, varTree, varTreeRef,
  });
  const {
    presets, setPresets, input, setInput, loading, setLoading, loadingRef,
    setWaitSecs, waitTimerRef, pendingTalks, pendingTalksRef, changePendingTalks,
    queueCount,
    setQueueCount, gm, setGm, setIsMobile, setMobileTopMenu,
    interactMode, setInteractMode, talkTarget, setTalkTarget, activeTarget, setActiveTarget,
    activeGroundItem,
    nsfwOn, setOutfitState, pigeonTarget, setPigeonTarget, apiCfg, uiScale, font, isDayMode,
    cmdHistory, setCmdHistory, histIdx, setHistIdx, forcedDuelNpc, setForcedDuelNpc,
    duelingNpc, setDuelingNpc, duelPending, setDuelPending, pendingQuestBranch,
    setPendingQuestBranch,
    setActivePersuasion, activeBuilding, setActiveBuilding, setGambleNegotiation,
    setBuildingPanelMinimized, setJustMeditated, tradingShop, setTradingShop,
    setPlayerAvatarCustom, inputRef, logEnd, composingRef,
  } = ui;
  useGameStartupBindings({
    room, prevRoomNameRef, restoredInnerRef, setInnerRoomName, companionState,
    companionStateRef, loading, loadingRef, time, timeRef, setIsMobile,
    setMobileTopMenu,
  });

  // ── 临时七维 buff 的读取端（消耗品系统第3步）──
  // buff flag 写在 flags 里（buff_属性+M_untilturn_T，T 是到期的 time 值，makeBuffFlag
  // 已用 time 作计时基准）。此前只有写入端（点菜/吃 B 档药），读取端从未接通，导致 buff
  // 挂了不生效（"死 buff"）。这里把当前生效的临时增益叠到基础七维上，得到"有效七维"，
  // 探索态状态面板、以及进入战斗时传给 DuelScreen 的都用这个。
  // 计时基准一律用 time（游戏时辰），不是 turnCount——项目没有 turnCount。
  // 三层叠加，顺序有讲究：先 buff（applyBuffsToSpecial 内部按设计封顶 10），
  // 再叠装备 sixDim 与武学 speedBonus（这两者按 equipment.js 的注释"装备加成可以
  // 突破10"，不设上限）。反过来嵌套会让装备加成被 buff 的封顶吃掉。
  // 此前这里只有 buff 一层：装备的 sixDim 与内功轻功的 speedBonus 在面板上完全
  // 看不见（战斗里倒是通过 effectiveSpecial 生效了，两边显示对不上）。
  const { effectiveSpecialNow, activeBuffs } = selectEffectiveStats({ char, flags, time, inv, skills });

  const autoTravelRef = useRef(false); // 自动寻路进行中标记：途中遇随机遭遇时据此硬中断剩余队列
  const lastMoveRef = useRef(0); // 移动防连点：内层移动是瞬时的(不设loading)，手抖双击会连走两步甚至穿到外层走AI，用时间戳挡住
  const talkBusyRef = useRef(false); // 私聊串行闸门：一条私聊在途时为 true，挡住第二条。用 ref 而非 state，因为 ref 同步更新、不等 re-render，能挡住极快连点
  const undoSnapshotRef = useRef(null); // 回滚：存"上一次行动前"的整局快照，玩家点回滚可还原一步
  const teleportLookRef = useRef(null); // 调试传送落地待触发标记：{dist,inner}，位置更新到位后由 effect 触发一次环顾式 act
  useGameStartupRegistry();


  useGameStartupShortcut();

  const pendDirRef = useRef(null);
  const outerDepartRef = useRef(null); // 外层移动出发时的内层位置信息（回锚点过渡描述用）
  const pickupJudgmentRef = useRef(null); // 本轮如果触发了拾取判定，保存 { quality, category }，供响应解析时强制校验
  const pickupExtractionFailedRef = useRef(false); // 双调用下本轮提取层是否解析失败——供拾取兜底区分"提取故障(该保底发)"vs"叙事拒捡(该尊重不发)"
  const collectGrantedRef = useRef([]); // 本轮系统已代发的采集物名单，供items_add处理时防止AI重复入袋
  const queueTimerRef = useRef(null);
  const roomMapRef = useRef(restored?.snap.roomMap || { [(restored?.snap.room || DEFAULT_PRESETS[0].room).name]: { items: [...(restored?.snap.room || DEFAULT_PRESETS[0].room).items], npcs: [...(restored?.snap.room || DEFAULT_PRESETS[0].room).npcs] } });

  // API 配置变更时持久化到 localStorage
  useEffect(() => { saveConfig(apiCfg); }, [apiCfg]);
  useEffect(() => { localStorage.setItem("wuxia_mud_ui_scale", String(uiScale)); }, [uiScale]);
  useEffect(() => { localStorage.setItem("wuxia_mud_ui_font", font); }, [font]);
  useEffect(() => { localStorage.setItem("wuxia_mud_day_mode", isDayMode ? "1" : "0"); }, [isDayMode]);

  const autosave = useAutosave({
    apiCfg, loadingRef, pendingTalksRef, roomMapRef, restoredInnerRef, presets, setGm, setVarTree,
  });
  const {
    roundsSinceLastSaveRef, playedThisSessionRef, schedulerRef,
    applySnapshot, buildCurrentSnapshot, loadPreset, prerunSquares,
  } = autosave;
  const importPreset = usePresetImport({ loadPreset, setPresets, setLog });

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);
  useEffect(() => { roomMapRef.current[room.name] = { items: [...room.items], npcs: [...room.npcs] }; }, [room]);

  // 当前这轮 act 是否在赌石谈价语境（有则 talk prompt 追加 <deal> 规则）
  const gambleTalkCtx = useRef(null);
  useEffect(() => { setBuildingPanelMinimized(false); }, [activeBuilding?.id]);
  const addLog = useCallback((lines) => setLog(p => [...p, ...lines]), []);
  const commandScheduler = useCommandScheduler({ addLog, setQueueCount });
  const {
    dispatch: dispatchCommand, clearQueue: clearCommandQueue,
    clearRouteQueue, setPhase: setCommandPhase, scheduler: coreScheduler,
  } = commandScheduler;
  const scheduledPrerunSquares = useCallback(
    () => commandScheduler.dispatch("squarePrerun", () => prerunSquares()),
    [commandScheduler.dispatch, prerunSquares],
  );
  const { captureUndo, rollbackOneStep, invalidateTurns, onTurnsInvalidated, turnGenerationRef } = useUndo({
    undoSnapshotRef, buildCurrentSnapshot, applySnapshot,
    addLog, setQueueCount, autoTravelRef, queueTimerRef,
    setDuelPending, setDuelingNpc, setActiveBuilding, pendingTalksRef, changePendingTalks, talkBusyRef,
    setLoading, waitTimerRef, setWaitSecs, clearCommandQueue,
  });
  const scheduledRollback = useCallback(
    () => commandScheduler.dispatch("rollback", rollbackOneStep),
    [commandScheduler.dispatch, rollbackOneStep],
  );
  const stopGeneration = useCallback(() => {
    return commandScheduler.dispatch("stopGeneration", () => {
      invalidateTurns();
      commandScheduler.stopRunning();
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
      waitTimerRef.current = null;
      setWaitSecs(0);
      setLoading(false);
      addLog([{ t: "sys", text: "  ⏹ 已停止等待本次生成（若结果稍后返回将被忽略）。" }]);
    });
  }, [invalidateTurns, commandScheduler.stopRunning, waitTimerRef, setWaitSecs, setLoading, addLog]);

  useGameStartupOpeningFaces({
    restored, showOpening, showCharCreate, room, innerRoomName, varTreeRef,
    addLog, setVarTree, time, schedulerRef,
  });

  const { noteAction, jotNote, dayMaterialRef } = useNotes({
    apiCfg, time, room, varTreeRef, timeRef, setVarTree,
  });
  const featureCtxRef = useRef(null);

  // 日总结（大纸条）：跨天时后台归纳刚过去这一天攒下的原料，存进 varTree.世界.日总结。
  // fire-and-forget：AI 失败就不写，缺一天日总结无伤大雅，绝不阻断游戏。
  const { aiSummarizeFact: summarizeFact } = useDaySummary({
    time, apiCfg, setVarTree, varTreeRef, dayMaterialRef, prerunSquares: scheduledPrerunSquares,
  });
  const aiSummarizeFact = useCallback(
    (...args) => commandScheduler.dispatch("daySummary", () => summarizeFact(...args)),
    [commandScheduler.dispatch, summarizeFact],
  );
  const seaReturnRef = useRef(null);
  useWorldRulesRunner({
    featureCtxRef, seaReturnRef, setForcedDuelNpc, schedulerRef, roomMapRef,
    dispatchCommand,
  });

  useForcedDuelNpc({ forcedDuelNpc, setDuelingNpc, setForcedDuelNpc });

  const { talkToNarrator } = usePrivateTalk({
    narrator, addLog, apiCfg, convo, room, preset, flags,
    jotNote, char, nsfwOn, questProgress, changePendingTalks,
    talkBusyRef, schedulerRef, setInput, timeRef, varTreeRef, setLog, setConvo,
    setVarTree, setNarrator, noteAction,
  });


  // 分工照 catalog.js 顶部那条老规矩：AI 只负责"从这张货架上挑哪三件"，
  // 数值一概不由它给——挑完拿名字回 CATALOG_INDEX 查真值。这样既不会凭空冒出
  // 货架上没有的神兵，也不会出现同一件东西这次加 20 下次加 200。
  // 只报字段/描述/加成，不报获取途径：怎么弄到手得自己走一趟。
  const outfitAdvice = commandScheduler.wrapHandlers("useOutfitAdvice", useOutfitAdvice({ char, apiCfg, setOutfitState }));
  const aiInspect = commandScheduler.wrapHandlers("useAiInspect", useAiInspect({
    addLog, jotNote, setTime, setFlags, apiCfg, skills, char, inv,
    dispatchCommand,
  }));
  const progressionHandlers = commandScheduler.wrapHandlers("useProgressionHandlers", useProgressionHandlers({
    loading, noteAction, featureCtxRef, setJustMeditated, captureUndo,
  }));
  const { confessToNarrator } = progressionHandlers;

  // 送礼：从背包选一件物品送给指定角色，走正常的行动指令流程，
  // 让主引擎 AI 描述场景、判断礼物是否合心意，并通过 <mvu> 自行决定好感度增量
  // （沿用"AI 提议 + 系统裁决"：AI 只能建议合理幅度，最终写入仍由 applyMvuCommands 裁剪）
  // extraReplies：调用方（比如点击NPC头像触发的"细看"）想在这条命令自己的框里
  // 附带插入的日志（气血条之类），必须跟 cmd 回显同一次 addLog 原子提交——
  // 之前 handleNpcLook 是先 addLog 血条、再调 act 补 cmd 行，两次独立的 addLog
  // 调用中间一旦被"上一条命令还在处理中"的排队分支截胡，血条就会插在数组里
  // "cmd行"之前，按分组算法（以cmd为界）被错误地划进上一条命令的框，而不是
  // 这条"look X"自己的框。
  const intentRouterRef = useRef(null);
  const { act } = useTurn({
    loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset,
    addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget, activeGroundItem,
    setActiveTarget, setDuelPending,
    nsfwOn, varTree, pendingTalks, changePendingTalks, lastMoveRef, captureUndo,
    turnGenerationRef, onTurnsInvalidated, talkBusyRef, setCmdHistory, setHistIdx, setFlags, setInput, setLoading,
    waitTimerRef, setWaitSecs, pendDirRef, featureCtxRef,
    noteAction, roomMapRef, questProgress, innerRoomName, setRoom, setInv, collectGrantedRef,
    autoTravelRef, clearRouteQueue,
    dispatchCommand, setCommandPhase,
    outerDepartRef, varTreeRef, pickupJudgmentRef, pickupExtractionFailedRef,
    prerunSquares: scheduledPrerunSquares, dayMaterialRef, roundsSinceLastSaveRef, playedThisSessionRef, gambleTalkCtx,
    timeRef, talkTarget, companionState, pendingQuestBranch, effectiveSpecialNow, setVarTree,
    setGambleNegotiation, setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
    setPendingQuestBranch, setConvo, jotNote, setLog, intentRouterRef,
  });
  const questPanel = commandScheduler.wrapHandlers("useQuestPanel", useQuestPanel({
    act, apiCfg, addLog, featureCtxRef, setPendingQuestBranch, setDuelingNpc, captureUndo,
    setActivePersuasion, setInteractMode, setTalkTarget, setPersuasionProgress, setChar,
  }));

  const autoTravelTo = useAutoTravel({
    room, mapData, flags, questProgress, addLog,
    autoTravelRef, scheduler: coreScheduler,
    act, teleportLookRef, innerRoomName, setInteractMode, intentRouterRef,
  });

  const pigeonHandlers = commandScheduler.wrapHandlers("usePigeonHandlers", usePigeonHandlers({
    room, varTree, featureCtxRef, aiSummarizeFact, setInput, setPigeonTarget,
    setInteractMode, setActiveBuilding, captureUndo,
  }));
  const { applyPigeonResult, sendPigeonLetter } = pigeonHandlers;

  usePigeonReplies({ room, apiCfg, preset, applyPigeonResult, time, varTree, featureCtxRef });

  const duelHandlers = commandScheduler.wrapHandlers("useDuel", useDuel({
    act, addLog, duelPending, featureCtxRef, setActiveTarget, setDuelPending, setDuelingNpc,
    duelingNpc, pendingQuestBranch, noteAction, jotNote, aiSummarizeFact, setPendingQuestBranch,
    captureUndo, turnGenerationRef, interactMode,
  }));

  // 拜师学艺：好感度≥40 + 完成该NPC专属支线任务，两个条件同时满足才能学到技能。
  // 不满足时给出具体卡在哪个条件的说明，而不是一句笼统的"不行"。
  // 打开交易界面：只在NPC是手写配置的商人时可用，货品清单固定不变，
  // 保证同一个商人每次进店看到的东西都稳定。
  const screenHandlers = commandScheduler.wrapHandlers("useScreenHandlers", useScreenHandlers({
    act, addLog, featureCtxRef, setActiveTarget, setInteractMode, setTalkTarget,
    timeRef, noteAction, inv, setTradingShop, captureUndo,
  }));
  useIntentRouter(intentRouterRef, {
    apiCfg, act, addLog, featureCtxRef, dispatchCommand, setActiveTarget, setDuelPending, setTradingShop,
    handleNpcDuel: duelHandlers.handleNpcDuel, handleNpcTrade: screenHandlers.handleNpcTrade,
  });

  const buildingHandlers = commandScheduler.wrapHandlers("useBuildingHandlers", useBuildingHandlers({
    activeBuilding, setActiveBuilding, featureCtxRef, roomMapRef, captureUndo,
    setPendingQuestBranch, setDuelingNpc,
  }));

  const craftingAI = commandScheduler.wrapHandlers("useCraftingAI", useCraftingAI({
    gambleTalkCtx, setInteractMode, setTalkTarget, act, apiCfg, addLog, setTime, jotNote,
  }));

  const cardImportHandlers = commandScheduler.wrapHandlers("useCardImportHandlers", useCardImportHandlers({
    setVarTree, setChar, setSkills, setInv, setCompanionState, addLog,
    setPlayerAvatarCustom, featureCtxRef, schedulerRef,
  }));

  // ── 心灵之海 · 玄女点破 ──
  // "说过话"直接复用「对话即认识」的结果（commitRound 里 talkTarget/respondedNpcs
  // 会把人标记为已认识），不另造一套"聊过没"的记账。
  // 用 effect 而不是塞进对话结算里，是因为两个条件可能任意顺序满足：先攒够好感再去
  // 见她、或先见过她后来才攒够，两条路都要能触发。
  const playerActionHandlers = commandScheduler.wrapHandlers("usePlayerActionHandlers", usePlayerActionHandlers({
    featureCtxRef, noteAction, setInnerRoomName, seaReturnRef, captureUndo,
  }));

  const onKey = createInputKeyHandler({
    composingRef, interactMode, sendPigeonLetter, pigeonTarget, input, act,
    cmdHistory, histIdx, setHistIdx, setInput,
  });

  const actions = {
    act, autoTravelTo, captureUndo, rollbackOneStep: scheduledRollback, teleportLookRef,
    effectiveSpecialNow, onKey, rollbackBlocked: commandScheduler.rollbackBlocked, stopRunning: stopGeneration,
    dispatchCommand: commandScheduler.dispatch,
    questPanel, pigeonHandlers, duelHandlers, screenHandlers, buildingHandlers,
    craftingAI, playerActionHandlers, progressionHandlers, aiInspect, outfitAdvice,
    cardImportHandlers,
  };
  const overlayState = {
    showSettings, showCharCreate, showOpening, showBody, showMusicPanel, showHomestead,
  };
  const overlayCtx = buildOverlayCtx({
    ui, game: bindings, overlayState, autosave, actions, addLog, effectiveSpecialNow,
    onGameStarted: markGameStarted,
  });
  const apiReady = hasApiCredentials(apiCfg);
  const returnToStart = useCallback(() => onReturnToStart?.(), [onReturnToStart]);
  const overlayHost = <OverlayHost ctx={overlayCtx} apiReady={apiReady}
    onCloseInitialSettings={() => { if (bootedForSettingsRef.current) returnToStart(); }} />;
  const layout = buildLayoutCtx({
    ui, game: bindings, overlayHost, autosave, actions, activeBuffs, addLog, jotNote,
  });

  if (!apiReady) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)", padding: 24, textAlign: "center" }}>
        <div>
          <p style={{ color: "var(--red-soft)" }}>尚未配置 API 凭证</p>
          <p>打开设置，填入 API Key 或导入 Vertex AI 的 ADC JSON 文件后即可开始游戏。</p>
          <span onClick={() => openOverlay(OVERLAY.SETTINGS)} style={{ cursor: "pointer", color: "var(--accent)", padding: "6px 14px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0, display: "inline-block", marginTop: 10 }}>⚙ 打开设置</span>
          <button type="button" onClick={returnToStart} style={{ ...chromeBtn(ui.zoneTheme), marginTop: 10, marginLeft: 8 }}>返回主菜单</button>
        </div>
        {overlayHost}
      </div>
    );
  }

  if (showCharCreate || showOpening) return overlayHost;

  return <GameLayout layout={layout} />;

}
