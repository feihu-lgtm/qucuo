import React, { useState, useRef, useEffect, useCallback } from "react";
import { gameActions, initGameStore, useGameStore } from "./store/gameStore.js";
import {
  OVERLAY, initializeUiOverlays, openOverlay, toggleOverlay, useOverlay,
} from "./store/uiStore.js";
import OverlayHost from "./app/OverlayHost.jsx";
import GameLayout from "./app/GameLayout.jsx";
import { useAutosave, useInitialRestore } from "./app/hooks/useAutosave.js";
import { useDaySummary } from "./app/hooks/useDaySummary.js";
import { usePrivateTalk } from "./app/hooks/usePrivateTalk.js";
import { useOutfitAdvice } from "./app/hooks/useOutfitAdvice.js";
import { useAiInspect } from "./app/hooks/useAiInspect.js";
import { useTurn, useTurnQueue } from "./app/hooks/useTurn.js";
import { useQuestPanel } from "./app/hooks/useQuestPanel.js";
import { useDuel, useForcedDuelNpc } from "./app/hooks/useDuel.js";
import { usePigeonReplies } from "./app/hooks/usePigeonReplies.js";
import { usePigeonHandlers } from "./app/hooks/usePigeonHandlers.js";
import { useAutoTravel } from "./app/hooks/useAutoTravel.js";
import { useCraftingAI } from "./app/hooks/useCraftingAI.js";
import { useScreenHandlers } from "./app/hooks/useScreenHandlers.js";
import { useCardImportHandlers } from "./app/hooks/useCardImportHandlers.js";
import { useBuildingHandlers } from "./app/hooks/useBuildingHandlers.js";
import { useProgressionHandlers } from "./app/hooks/useProgressionHandlers.js";
import { usePlayerActionHandlers } from "./app/hooks/usePlayerActionHandlers.js";
import { useGameUi, usePresetImport, createInputKeyHandler } from "./app/hooks/useGameUi.js";
import { useWorldRulesRunner } from "./app/hooks/useWorldRulesRunner.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "./core/newGame.js";
import { selectEffectiveStats } from "./features/stats/logic.js";
import { trainCost } from "./features/cultivation/logic.js";
import { attachImportedRegistry } from "./characterMilestones.js";
import { NNPC_STAGE } from "./narrator.js";
import { saveConfig } from "./apiConfig.js";
import { QUCUO_MAP } from "./qucuoMap.js";
import { hasInnerMap, getDistrictAnchor, isNpcVisibleInInnerRoom } from "./innerMap.js";
import { setSnowLeopardForm, setPearlForm } from "./portraits.js";
import { detectNewFaces, markAsSeen, updateLastSeen } from "./npcAwareness.js";
import { writeNote, NOTE_SOURCE } from "./memory/note.js";
import { tallyAdd } from "./memory/tally.js";
import { SECT_ENTRY } from "./sectEntry.js";
import { SEA_OF_MIND, canEnterSea } from "./seaOfMind.js";
import { narratorVars } from "./mvu.js";
import * as importedRegistry from "./cards/importedRegistry.js";

export default function MudRPG({ initialLoadSlotId = null, initialOpenSettings = false } = {}) {
  // "new" 是显式新开局信号，此时无论有没有存档都不恢复。
  const restored = useInitialRestore({ initialLoadSlotId });

  const overlaysInitializedRef = useRef(false);
  if (!overlaysInitializedRef.current) {
    const initialOverlays = [];
    try {
      if (localStorage.getItem("qucuo_tutorial_seen") !== "1") initialOverlays.push(OVERLAY.TUTORIAL);
    } catch { /* unavailable storage means no automatic tutorial */ }
    if (initialOpenSettings) initialOverlays.push(OVERLAY.SETTINGS);
    if (initialLoadSlotId === "new" && !restored) {
      initialOverlays.push(OVERLAY.OPENING, OVERLAY.CHAR_CREATE);
    }
    initializeUiOverlays(initialOverlays);
    overlaysInitializedRef.current = true;
  }

  useState(() => {
    initGameStore(buildInitialGameState(restored));
    return true;
  });
  const showSettings = useOverlay(OVERLAY.SETTINGS);
  const showOpening = useOverlay(OVERLAY.OPENING);
  const showCharCreate = useOverlay(OVERLAY.CHAR_CREATE);
  const showBody = useOverlay(OVERLAY.BODY);
  const showMusicPanel = useOverlay(OVERLAY.MUSIC_PANEL);
  const showHomestead = useOverlay(OVERLAY.HOMESTEAD);
  const {
    setChar, setDao, setSkills, setExp, setPot, setInv, setCompanionState, setPreset,
    setRoom, setInnerRoomName, setMapData, setTime, setLog, setConvo, setNarrator,
    setVarTreeState, setFlags, setQuestProgress, setPersuasionProgress,
    setClaimedMilestones, setDeposit, setDepositedAt, setPledgedItems,
  } = gameActions;
  const preset = useGameStore(s => s.preset);
  const room = useGameStore(s => s.room);
  // 内层箱庭导航——跟 room state 完全独立的新增状态，不改动 room.name 的
  // 语义（room.name 继续只表示"在哪个据点"，MudRPG.jsx 里现有71处引用
  // room.name 的地方全部不用动）。innerRoomName 只在当前据点有内层数据
  // （hasInnerMap(room.name) 为真）时才有意义，值是这个据点内部某个房间
  // 的名字（比如"村口"）。没有内层数据的据点（目前除鱼定村外的13个），
  // 这个值应保持为 null，UI/移动判定据此完全走原有的"整据点即一间房"
  // 逻辑，两套系统不会互相干扰。
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const restoredInnerRef = useRef(null);
  const prevRoomNameRef = useRef(room.name);
  const char = useGameStore(s => s.char);
  const dao = useGameStore(s => s.dao);
  const skills = useGameStore(s => s.skills);
  // 伙伴系统（本轮新增）：雪豹的解锁/出战状态。老存档没有这个字段，用
  // initCompanionState() 兜底成"未解锁"，不影响任何既有存档的兼容性。
  const companionState = useGameStore(s => s.companionState);
  // companionState 的 latest-ref：房间注入 effect（依赖数组刻意不含 companionState，
  // 避免入队/好感变动就整屋重刷）需要读到最新入队状态来决定是否还注入驻场雪豹，
  // 靠这个 ref 拿最新值。用一个同步 effect 维护，不改动现有 setCompanionState 调用点。
  const companionStateRef = useRef(companionState);
  // 装备信息现在完全并入 inv（每个物品对象自带 category/equipped 标记），不再单独维护 equip state
  // 老档补丁：catalog 后续给具名物品补的 sixDim/effect（如红档补七维）不会追溯到
  // 早就生成好的旧实例，这里读档时顺手补一遍，见 backfillInventoryFromCatalog。
  const inv = useGameStore(s => s.inv);
  const log = useGameStore(s => s.log);
  const convo = useGameStore(s => s.convo);
  const exp = useGameStore(s => s.exp);
  const pot = useGameStore(s => s.pot);
  const flags = useGameStore(s => s.flags);
  const questProgress = useGameStore(s => s.questProgress); // { questId: { count } }
  // 说服进度持久化：按 questId|flag 存 { guard, hitKeys, turns, done }，让"关掉再点同一场
  // 说服"能接着上次、且进快照存档。成功/离开时清掉该场。
  // 【必须声明在 useAutosave 之前】——它被快照回调的依赖数组引用，
  // 若声明晚于那里会触发 const 暂时性死区：Cannot access 'persuasionProgress' before initialization。
  const persuasionProgress = useGameStore(s => s.persuasionProgress);
  const mapData = useGameStore(s => s.mapData);
  const deposit = useGameStore(s => s.deposit);
  const depositedAt = useGameStore(s => s.depositedAt);
  const pledgedItems = useGameStore(s => s.pledgedItems);
  const time = useGameStore(s => s.time); // 24回合/天，6=第1日·卯时（晨）
  // time 的即时镜像：起居注在同一个事件循环里可能被连续调用（内层移动等），
  // 闭包里的 time 还是上一帧的值，跨天判定会错一格。跟 varTreeRef 同一套办法。
  const timeRef = useRef(time);
  const narrator = useGameStore(s => s.narrator);
  const varTree = useGameStore(s => s.varTree);
  const claimedMilestones = useGameStore(s => s.claimedMilestones);
  const varTreeRef = useRef(varTree);
  const setVarTree = useCallback((next) => {
    const v = typeof next === "function" ? next(varTreeRef.current) : next;
    varTreeRef.current = v;
    setVarTreeState(v);
  }, []);
  const ui = useGameUi({
    room, innerRoomName, char, inv, log, time, narrator, preset,
    flags, questProgress, varTree, varTreeRef,
  });
  const {
    presets, setPresets, input, setInput, loading, setLoading, loadingRef,
    waitSecs, setWaitSecs, waitTimerRef, pendingTalks, pendingTalksRef,
    changePendingTalks, queueCount, setQueueCount, collapsedGroups, setCollapsedGroups,
    mapBig, setMapBig, mapBigCloseGuard, mapView, setMapView, peoplePanel, setPeoplePanel,
    gm, setGm, isMobile, setIsMobile, mobileDrawer, setMobileDrawer,
    mobileTopMenu, setMobileTopMenu, settingsInitialTab, setSettingsInitialTab,
    interactMode, setInteractMode, talkTarget, setTalkTarget, activeTarget, setActiveTarget,
    nsfwOn, setNsfwOn, outfitState, setOutfitState, pigeonTarget, setPigeonTarget,
    activeNpcMenu, setActiveNpcMenu, activeItemMenu, setActiveItemMenu,
    playerAvatarCustom, setPlayerAvatarCustom, characterPageTarget, setCharacterPageTarget,
    portraits, setPortraits, slForm, setSlFormState, slImgErr, setSlImgErr,
    pearlForm, setPearlFormState, pearlImgErr, setPearlImgErr,
    narratorImgErr, setNarratorImgErr, portraitTarget, setPortraitTarget,
    apiCfg, setApiCfg, uiScale, setUiScale, isDayMode, setIsDayMode,
    cmdHistory, setCmdHistory, histIdx, setHistIdx, forcedDuelNpc, setForcedDuelNpc,
    duelingNpc, setDuelingNpc, duelPending, setDuelPending,
    pendingQuestBranch, setPendingQuestBranch, activePersuasion, setActivePersuasion,
    activeBuilding, setActiveBuilding, gambleNegotiation, setGambleNegotiation,
    buildingPanelMinimized, setBuildingPanelMinimized, justMeditated, setJustMeditated,
    tradingShop, setTradingShop, inputRef, logEnd, composingRef, availableQuestsHere,
    liveNpcMenu, AV_BASE, genderAvatar, playerAvatar, zoneTheme, clr, uiPink, uiGreen,
    uiTurquoise, uiGold, uiCrimson, inkDivider, S, buildBugReportTurns, getLiveBlockText,
  } = ui;
  useEffect(() => {
    if (prevRoomNameRef.current === room.name) return;
    prevRoomNameRef.current = room.name;
    if (restoredInnerRef.current !== null) { restoredInnerRef.current = null; return; }
    setInnerRoomName(hasInnerMap(room.name) ? getDistrictAnchor(room.name) : null);
  }, [room.name]);
  useEffect(() => { companionStateRef.current = companionState; }, [companionState]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { timeRef.current = time; }, [time]);
  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 768;
      setIsMobile(m);
      if (!m) { setMobileDrawer(null); setMobileTopMenu(false); }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
  const { effectiveSpecialNow, maxHpNow, activeBuffs } = selectEffectiveStats({ char, flags, time, inv, skills });

  const autoTravelRef = useRef(false); // 自动寻路进行中标记：途中遇随机遭遇时据此硬中断剩余队列
  const lastMoveRef = useRef(0); // 移动防连点：内层移动是瞬时的(不设loading)，手抖双击会连走两步甚至穿到外层走AI，用时间戳挡住
  const talkBusyRef = useRef(false); // 私聊串行闸门：一条私聊在途时为 true，挡住第二条。用 ref 而非 state，因为 ref 同步更新、不等 re-render，能挡住极快连点
  const undoSnapshotRef = useRef(null); // 回滚：存"上一次行动前"的整局快照，玩家点回滚可还原一步
  const teleportLookRef = useRef(null); // 调试传送落地待触发标记：{dist,inner}，位置更新到位后由 effect 触发一次环顾式 act
  // ── varTreeRef：独立于 React 渲染时机的「绝对最新」varTree ─────────────────
  // 根治病史（切磋后"交情已加、左栏仍显示尚未认识"）：act()/handleNpcDuel 等
  // useCallback 闭包捕获的是"函数被创建那一刻"的 varTree 快照。但凡某个 handler 先
  // setVarTree 写入（认识/交情），紧接着在同一 tick（或 setTimeout 延迟后）调用 act()，
  // act 里 evolveKnowledge 读到的仍是旧 varTree——推演结果再整体 setVarTree(kTree)
  // 覆盖写回，把刚写入的更新全部冲掉。加延迟/双调用都治不了本：闭包引用是旧的，
  // 等多久、调用多少次，读到的都还是旧的。
  // 规约（三条，全文件统一）：
  //   ① 渲染（JSX/左栏此地之人等）仍读 varTree state——它负责触发重渲染；
  //   ② 一切逻辑读取（useCallback/effect/异步回调内部）一律走 varTreeRef.current；
  //   ③ 一切写入走下方包装过的 setVarTree——写入同步刷新 ref；函数式更新拿到的
  //     prev 也是 ref 里的最新值，而非 React 批处理队列里的滞后值。
  // 由此：哪怕 act 是旧闭包，evolveKnowledge 拿到的也是此刻最新的 varTree，
  // 旧快照整体覆盖冲掉新写入的路径从根上消失。
  // 入册角色注册表：独立于存档的全局库（同 presetSystem 的收藏库思路），启动灌一次
  useEffect(() => {
    importedRegistry.init().then(() => {
      // 里程碑查表要能看到入册角色。用 attach 而不是 import，避免
      // characterMilestones ←→ importedRegistry 的循环依赖。
      attachImportedRegistry(importedRegistry);
    });
  }, []);


  // ── 全局快捷键 ──
  // 本作此前只有输入框内的 Enter/↑/↓，没有窗口级监听。这里只收一个 I（入册），
  // 并且严格避让：焦点在输入框/文本域内、或按了修饰键时一律不拦——否则玩家
  // 打字打到"i"就会弹窗，这类快捷键最容易变成事故。
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      if (e.key === "i" || e.key === "I") { e.preventDefault(); toggleOverlay(OVERLAY.CARD_IMPORT); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pendDirRef = useRef(null);
  const outerDepartRef = useRef(null); // 外层移动出发时的内层位置信息（回锚点过渡描述用）
  const pickupJudgmentRef = useRef(null); // 本轮如果触发了拾取判定，保存 { quality, category }，供响应解析时强制校验
  const pickupExtractionFailedRef = useRef(false); // 双调用下本轮提取层是否解析失败——供拾取兜底区分"提取故障(该保底发)"vs"叙事拒捡(该尊重不发)"
  const collectGrantedRef = useRef([]); // 本轮系统已代发的采集物名单，供items_add处理时防止AI重复入袋
  const pendingQueue = useRef([]); // 处理中时暂存排队命令
  const roomMapRef = useRef(restored?.snap.roomMap || { [(restored?.snap.room || DEFAULT_PRESETS[0].room).name]: { items: [...(restored?.snap.room || DEFAULT_PRESETS[0].room).items], npcs: [...(restored?.snap.room || DEFAULT_PRESETS[0].room).npcs] } });

  // API 配置变更时持久化到 localStorage
  useEffect(() => { saveConfig(apiCfg); }, [apiCfg]);
  useEffect(() => { localStorage.setItem("wuxia_mud_ui_scale", String(uiScale)); }, [uiScale]);
  useEffect(() => { localStorage.setItem("wuxia_mud_day_mode", isDayMode ? "1" : "0"); }, [isDayMode]);

  const {
    lastAutoSave, autoSaveError, roundsSinceLastSaveRef, playedThisSessionRef,
    schedulerRef, applySnapshot, buildCurrentSnapshot, loadPreset, prerunSquares,
  } = useAutosave({
    apiCfg, preset, room, char, dao, skills, inv, log, convo, exp, pot, flags,
    mapData, time, narrator, varTree, claimedMilestones, questProgress, deposit,
    depositedAt, pledgedItems, persuasionProgress, innerRoomName, companionState,
    loadingRef, pendingTalksRef, roomMapRef, restoredInnerRef, presets,
    setGm, setPreset, setRoom, setChar, setDao, setSkills, setInv, setLog,
    setConvo, setExp, setPot, setFlags, setMapData, setTime, setNarrator,
    setVarTree, setQuestProgress, setClaimedMilestones, setDeposit, setDepositedAt,
    setPledgedItems, setCompanionState, setInnerRoomName,
  });
  const importPreset = usePresetImport({ loadPreset, setPresets, setLog });

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);
  useEffect(() => { roomMapRef.current[room.name] = { items: [...room.items], npcs: [...room.npcs] }; }, [room]);

  // 当前这轮 act 是否在赌石谈价语境（有则 talk prompt 追加 <deal> 规则）
  const gambleTalkCtx = useRef(null);
  useEffect(() => { setBuildingPanelMinimized(false); }, [activeBuilding?.id]);
  const addLog = useCallback((lines) => setLog(p => [...p, ...lines]), []);

  // 开局新人物检测（本轮补）：新开局时，初始房间(如鱼定村·村口)本就有在场 NPC，
  // 但开局不是一次"移动"、走不到 act() 里那段新人物检测，于是这些人既不报
  // "※新人物出现"、也没被 markAsSeen——导致玩家开局就见着的人，之后走开再回来
  // 或首次互动时，反被当成新人误报。这里在新开局挂载时补跑一次：按初始内层房间
  // 可见性过滤 room.npcs，detectNewFaces 查未见过的，照常报"※新人物出现"(与走路
  // 遇到新人一致)并 markAsSeen。只在新开局(!restored)跑一次；读档恢复的局
  // varTree 里已记过见过谁，不重跑。
  const openingFacesRef = useRef(false);
  useEffect(() => {
    if (openingFacesRef.current) return;
    if (restored) { openingFacesRef.current = true; return; } // 读档局不补
    // 等开场图文序列和创角都结束、真正进入游戏主界面后再补——否则会在开场动画
    // 期间就往日志里塞"新人物出现"，顺序错乱、被开场白淹没。
    if (showOpening || showCharCreate) return;
    openingFacesRef.current = true;
    const visible = (room.npcs || []).filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
    const newFaces = detectNewFaces(varTreeRef.current, visible); // varTree 不在 deps 里，必须走 ref 读最新
    if (newFaces.length) {
      const recordOpeningFaces = () => {
        addLog(newFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` })));
        setVarTree(prev => markAsSeen(prev, newFaces.map(n => n.name)));
        setVarTree(prev => updateLastSeen(prev, visible.map(n => n.name), time));
      };
      const scheduler = schedulerRef.current;
      if (scheduler) scheduler.runSilently(recordOpeningFaces);
      else recordOpeningFaces();
    }
  }, [showOpening, showCharCreate]); // 开场/创角结束后跑一次（内部 ref 保证只补一次）

  // ── 写小纸条·统一便捷入口（latest-ref 模式）──────────────────────────────
  // 系统侧各来源（哑动作/交易/私聊/飞鸽/查看）都用这一个函数写小纸条，只管传
  // text/owner/source，其余（cfg/回合/地点/已知名单）由这里从最新状态里取。
  // 用 ref 兜住最新状态，故 jotNote 本身 deps 为空、恒稳定，可放心进别的 useCallback 依赖，
  // 不引发重建churn，也不会读到过期闭包。定义在此处（早于所有使用它的回调），避免 TDZ。
  // fire-and-forget：没开 embedding 或失败静默。
  const noteEnvRef = useRef({});
  useEffect(() => {
    noteEnvRef.current = { apiCfg, time, roomName: room.name, roomNpcs: room.npcs, varTree: varTreeRef.current };
  });
  // 当日原料缓冲：每张小纸条的文本都攒进来（不管开没开 embedding），跨天时喂给
  // 日总结 AI 归纳成「大纸条」。跨天清空（见下方 rollover useEffect）。
  const dayMaterialRef = useRef([]);
  // 起居注：记一次动作。走 AI 的和不走 AI 的都记（见 memory/tally.js 顶部注释）。
  // 用 timeRef 而不是 time：这个函数会被 tryInnerMove 之类的路径在同一个事件循环里
  // 连续调用，闭包里的 time 可能还是上一帧的值，跨天判定会错一格。
  const noteAction = useCallback((kind, n = 1) => {
    setVarTree(prev => {
      const next = JSON.parse(JSON.stringify(prev || {}));
      if (!next.世界) next.世界 = { 威望: 0 };
      next.世界.起居注 = tallyAdd(next.世界.起居注, kind, timeRef.current, n);
      return next;
    });
  }, []);

  const jotNote = useCallback(({ text, owner = [], source = NOTE_SOURCE.DUMB }) => {
    const env = noteEnvRef.current;
    if (!text || !env.apiCfg) return;
    dayMaterialRef.current.push({ turn: env.time, text }); // 攒进当日原料（日总结用，与 embedding 无关）
    const knownNames = Array.from(new Set([
      ...(env.roomNpcs || []).map(n => n.name),
      ...Object.keys(env.varTree?.角色 || {}),
      ...Object.keys(QUCUO_MAP),
    ]));
    writeNote({ cfg: env.apiCfg, text, turn: env.time, owner, source, place: env.roomName, knownNames })
      .catch(() => {});
  }, []);
  const featureCtxRef = useRef(null);

  // 日总结（大纸条）：跨天时后台归纳刚过去这一天攒下的原料，存进 varTree.世界.日总结。
  // fire-and-forget：AI 失败就不写，缺一天日总结无伤大雅，绝不阻断游戏。
  const { aiSummarizeFact } = useDaySummary({
    time, apiCfg, setVarTree, varTreeRef, dayMaterialRef, prerunSquares,
  });
  const seaReturnRef = useRef(null);
  useWorldRulesRunner({ featureCtxRef, seaReturnRef, setForcedDuelNpc });

  useForcedDuelNpc({ forcedDuelNpc, setDuelingNpc, setForcedDuelNpc });

  const { talkToNarrator } = usePrivateTalk({
    narrator, addLog, apiCfg, convo, time, room, inv, preset, varTree, flags,
    jotNote, char, nsfwOn, questProgress, changePendingTalks, innerRoomName,
    talkBusyRef, schedulerRef, setInput, timeRef, varTreeRef, setLog, setConvo,
    setVarTree, setNarrator, noteAction,
  });


  // 分工照 catalog.js 顶部那条老规矩：AI 只负责"从这张货架上挑哪三件"，
  // 数值一概不由它给——挑完拿名字回 CATALOG_INDEX 查真值。这样既不会凭空冒出
  // 货架上没有的神兵，也不会出现同一件东西这次加 20 下次加 200。
  // 只报字段/描述/加成，不报获取途径：怎么弄到手得自己走一趟。
  const { recommendOutfit } = useOutfitAdvice({ char, apiCfg, setOutfitState });

  const { inspecting, inspectItem } = useAiInspect({
    loading, addLog, jotNote, setTime, setFlags, apiCfg, skills, char, inv,
  });
  const { confessToNarrator, meditate, trainNeigong, trainWaigong, breakthroughSkill } = useProgressionHandlers({
    loading, noteAction, featureCtxRef, setJustMeditated,
  });

  // 送礼：从背包选一件物品送给指定角色，走正常的行动指令流程，
  // 让主引擎 AI 描述场景、判断礼物是否合心意，并通过 <mvu> 自行决定好感度增量
  // （沿用"AI 提议 + 系统裁决"：AI 只能建议合理幅度，最终写入仍由 applyMvuCommands 裁剪）
  // extraReplies：调用方（比如点击NPC头像触发的"细看"）想在这条命令自己的框里
  // 附带插入的日志（气血条之类），必须跟 cmd 回显同一次 addLog 原子提交——
  // 之前 handleNpcLook 是先 addLog 血条、再调 act 补 cmd 行，两次独立的 addLog
  // 调用中间一旦被"上一条命令还在处理中"的排队分支截胡，血条就会插在数组里
  // "cmd行"之前，按分组算法（以cmd为界）被错误地划进上一条命令的框，而不是
  // 这条"look X"自己的框。
  const { act } = useTurn({
    loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset,
    addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget,
    nsfwOn, varTree, pendingTalks, changePendingTalks, lastMoveRef, buildCurrentSnapshot,
    undoSnapshotRef, talkBusyRef, setCmdHistory, setHistIdx, setFlags, setInput, setLoading,
    waitTimerRef, setWaitSecs, pendingQueue, setQueueCount, pendDirRef, featureCtxRef,
    noteAction, roomMapRef, questProgress, innerRoomName, setRoom, setInv, collectGrantedRef,
    autoTravelRef, outerDepartRef, varTreeRef, pickupJudgmentRef, pickupExtractionFailedRef,
    prerunSquares, dayMaterialRef, roundsSinceLastSaveRef, playedThisSessionRef, gambleTalkCtx,
    timeRef, talkTarget, companionState, pendingQuestBranch, effectiveSpecialNow, setVarTree,
    setGambleNegotiation, setChar, setDao, setExp, setPot, setSkills, setMapData, setTime,
    setPendingQuestBranch, setConvo, jotNote, setLog,
  });
  const { forceAdvanceQuest, triggerQuestFromPanel, triggerQuestChoice } = useQuestPanel({
    act, apiCfg, addLog, featureCtxRef, setPendingQuestBranch, setDuelingNpc,
    setActivePersuasion, setInteractMode, setTalkTarget,
  });

  const autoTravelTo = useAutoTravel({
    room, loading, mapData, flags, questProgress, addLog, pendingQueue,
    autoTravelRef, setQueueCount, act, teleportLookRef, innerRoomName, setInteractMode,
  });

  const {
    pigeonDelayShichen, applyPigeonResult, sendPigeonLetter, buyPigeon,
    handleCollectPigeons, handlePostSend,
  } = usePigeonHandlers({
    room, varTree, featureCtxRef, aiSummarizeFact, setInput, setPigeonTarget,
    setInteractMode, setActiveBuilding,
  });

  usePigeonReplies({ room, apiCfg, preset, applyPigeonResult, time, varTree, featureCtxRef });

  const {
    handleNpcDuel, confirmDuel, cancelDuel, duelFinishHandler,
  } = useDuel({
    act, addLog, duelPending, featureCtxRef, setActiveTarget, setDuelPending, setDuelingNpc,
    duelingNpc, pendingQuestBranch, noteAction, jotNote, aiSummarizeFact, setPendingQuestBranch,
  });

  // 拜师学艺：好感度≥40 + 完成该NPC专属支线任务，两个条件同时满足才能学到技能。
  // 不满足时给出具体卡在哪个条件的说明，而不是一句笼统的"不行"。
  // 打开交易界面：只在NPC是手写配置的商人时可用，货品清单固定不变，
  // 保证同一个商人每次进店看到的东西都稳定。
  const {
    handleNpcLook, handleNpcTalk, handleNpcGift, handleInviteCompanion,
    handleConsumeItem, handleCollectGround, handleNpcTrade, handleNpcLearnSkill,
    handleNpcSteal, giftToCharacter, handleToggleEquip, claimMilestone,
  } = useScreenHandlers({
    act, addLog, featureCtxRef, setActiveTarget, setInteractMode, setTalkTarget,
    timeRef, noteAction, inv, setTradingShop, setInv, setClaimedMilestones,
  });

  useTurnQueue({ loading, act, pendingQueue, setQueueCount, autoTravelRef });

  const {
    handleBuildingInn, handleBuildingHeal, handleBuySkill, handleGamble, handleTravel,
    handleServiceOrder, handleCook, handlePray, handleReadBook, handleBuyBook,
    handleDeposit, handleWithdraw, handlePledge, handleRedeem, handleAcceptEscort,
    handleAcceptBounty, handleClaimBounty, handleGambleSettle, handleForgeCommission,
    handleJadeCraft, handleListenRumor, handleJoinSect, handleAuctionWin,
  } = useBuildingHandlers({ activeBuilding, setActiveBuilding, featureCtxRef });

  const { handleGambleTalk, handleGambleInspect, handleForgeDesign, handleJadeDesign } = useCraftingAI({
    gambleTalkCtx, setInteractMode, setTalkTarget, act, apiCfg, addLog, setTime, jotNote,
  });

  const {
    handleImportNpcs, handleImportPlayer, handleImportWorld,
    handleCreateCharacter, handleOpeningFinish, handleBodyProfileChange,
  } = useCardImportHandlers({
    setVarTree, setChar, setSkills, setInv, setCompanionState, addLog,
    featureCtxRef, schedulerRef,
  });

  // ── 心灵之海 · 玄女点破 ──
  // "说过话"直接复用「对话即认识」的结果（commitRound 里 talkTarget/respondedNpcs
  // 会把人标记为已认识），不另造一套"聊过没"的记账。
  // 用 effect 而不是塞进对话结算里，是因为两个条件可能任意顺序满足：先攒够好感再去
  // 见她、或先见过她后来才攒够，两条路都要能触发。
  const {
    handleComfort, handleSwitchCompanion, handleResolveTrauma, enterSeaOfMind, leaveSeaOfMind,
  } = usePlayerActionHandlers({ featureCtxRef, noteAction, setInnerRoomName, seaReturnRef });

  const inSeaOfMind = room.name === SEA_OF_MIND.district;
  const seaGate = canEnterSea({ flags, varTree, districtName: room.name, innerRoomName });

  const onKey = createInputKeyHandler({
    composingRef, interactMode, sendPigeonLetter, pigeonTarget, input, act,
    cmdHistory, histIdx, setHistIdx, setInput,
  });

  // 日志文字配色（本轮补齐日间模式）：原来这套 clr 全部写死死死是暗夜配色，
  // 日间模式切换后完全不跟随——WCAG对比度实测在米色背景下几乎全部低于2.5
  // （正常阅读需要4.5+），叙事正文(desc)、地名(room)首当其冲。clrDay 保留
  // 每种类型的色相基因（错误依然是红系、对话依然是粉系……）但大幅拉深明度，
  // 全部核算达到4.5+对比度。
  // 语义色日夜适配（藏地三色点缀体系，见 theme.js INK）——全文件统一从这组取，
  // 不再到处散写 #d68a8a/#c07050 这类"只有暗夜版"的硬编码（日间米色底下偏淡发灰）。

  const overlayCtx = {
    apiCfg, setApiCfg, buildCurrentSnapshot, applySnapshot, varTree, setVarTree,
    settingsInitialTab, uiScale, setUiScale, narrator, setNarrator, getLiveBlockText,
    showSettings, showCharCreate, showOpening, showBody, showMusicPanel, showHomestead,
    char, setChar, inv, setInv, innerRoomName, addLog, zoneTheme, nsfwOn,
    recommendOutfit, outfitState, handleCreateCharacter, handleOpeningFinish,
    handleBodyProfileChange,
    globalOverlays: {
      zoneTheme, isDayMode,
      char, setChar, inv, setInv, skills,
      varTree, room, innerRoomName, time,
      flags, questProgress,
      effectiveSpecialNow, companionState,
      loading, pendingTalks, waitSecs, addLog,
      characterPageTarget, setCharacterPageTarget,
      claimedMilestones, claimMilestone, giftToCharacter,
      narratorStage: narrator.stage,
      onImportNpcs: handleImportNpcs, onImportPlayer: handleImportPlayer,
      onImportWorld: handleImportWorld,
      portraits, setPortraits,
      buildBugReportTurns,
      activeNpcMenu: liveNpcMenu, setActiveNpcMenu,
      handleNpcLook, handleNpcTalk, handleNpcGift, handleNpcDuel, handleNpcSteal,
      handleNpcLearnSkill, handleNpcTrade, handleInviteCompanion,
      activeItemMenu, setActiveItemMenu, inspectItem, handleConsumeItem,
      handleCollectGround, handleToggleEquip,
      activePersuasion, setActivePersuasion,
      apiCfg, persuasionProgress, setPersuasionProgress,
      forceAdvanceQuest,
      duelingNpc, setDuelingNpc, setPendingQuestBranch, duelFinishHandler,
    },
  };
  const overlayHost = <OverlayHost ctx={overlayCtx} />;
  const layout = {
    overlayHost, uiScale, zoneTheme, isMobile, mobileDrawer, setMobileDrawer,
    mobileTopMenu, setMobileTopMenu, isDayMode, setIsDayMode, uiGold, uiTurquoise,
    uiCrimson, uiPink, setSettingsInitialTab, autoSaveError, lastAutoSave,
    playerAvatarCustom, setPlayerAvatarCustom, AV_BASE, genderAvatar, S, room,
    innerRoomName, time, varTree, char, setChar, peoplePanel, setPeoplePanel, activeBuilding,
    setActiveBuilding, setActiveItemMenu, setActiveNpcMenu, setCharacterPageTarget,
    setPigeonTarget, setInteractMode, inputRef, addLog, pigeonTarget, portraits,
    portraitTarget, setPortraitTarget, interactMode, activeTarget, setActiveTarget,
    talkTarget, setTalkTarget, playerAvatar, slImgErr, setSlImgErr, slForm,
    setSnowLeopardForm, setSlFormState, pearlForm, setPearlForm,
    setPearlFormState, pearlImgErr, setPearlImgErr, narrator,
    narratorImgErr, setNarratorImgErr, companionState, mapView, setMapView,
    mapBig, setMapBig, mapData, questProgress, flags, inv, inSeaOfMind, seaGate,
    enterSeaOfMind, leaveSeaOfMind, loading, act, autoTravelTo, uiGreen,
    setLoading, undoSnapshotRef, applySnapshot, gm, setGm, pot, setPot,
    exp, setExp, dao, setDao, setVarTree, setNarrator, setMapData, setRoom,
    setInnerRoomName, teleportLookRef, setSkills, duelPending, confirmDuel,
    cancelDuel, tradingShop, setTradingShop, buildingPanelMinimized,
    setBuildingPanelMinimized, handleBuildingInn, handleBuildingHeal, skills,
    handleBuySkill, effectiveSpecialNow, inspectItem, jotNote, handleAcceptEscort,
    handleGamble, handleCollectPigeons, buyPigeon, handlePostSend, handleTravel,
    handleServiceOrder, handlePray, handleReadBook, handleBuyBook, deposit,
    depositedAt, handleDeposit, handleWithdraw, pledgedItems, handlePledge,
    handleRedeem, handleAcceptBounty, handleClaimBounty, handleForgeCommission,
    handleForgeDesign, handleJadeDesign, handleJadeCraft, gambleNegotiation,
    handleGambleTalk, handleGambleSettle, handleGambleInspect, handleListenRumor,
    handleJoinSect, handleAuctionWin, handleCook,
    seaTraumaActive: narrator.stage === NNPC_STAGE.SEA_CRASHED && room.name === SEA_OF_MIND.district,
    narratorVarsNow: narratorVars(varTree),
    invNames: inv.map(i => (typeof i === "string" ? i : i?.name)).filter(Boolean),
    handleComfort, handleResolveTrauma,
    sectMasterAffection: varTree.角色?.[SECT_ENTRY.master]?.好感度 ?? 0,
    log, clr, collapsedGroups, setCollapsedGroups, queueCount, pendingTalks, inspecting,
    logEnd, waitSecs, availableQuestsHere, triggerQuestFromPanel, triggerQuestChoice,
    nsfwOn, setNsfwOn, meditate, justMeditated, pigeonDelayShichen,
    input, setInput, composingRef, onKey, handleSwitchCompanion, trainNeigong,
    trainWaigong, trainCost, activeBuffs, breakthroughSkill, confessToNarrator,
    setInv, mapBigCloseGuard,
  };

  if (!apiCfg.apiKey) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a09", color: "#e8e4d6", fontFamily: "'Songti SC','STSong','SimSun',serif", padding: 24, textAlign: "center" }}>
        <div>
          <p style={{ color: "#c45044" }}>尚未配置 API Key</p>
          <p>点击下方按钮打开设置面板，填入你的 API Key 后即可开始游戏。</p>
          <span onClick={() => openOverlay(OVERLAY.SETTINGS)} style={{ cursor: "pointer", color: "#c8323a", padding: "6px 14px", background: "#161510", border: "1px solid #4a453c", borderRadius: 0, display: "inline-block", marginTop: 10 }}>⚙ 打开设置</span>
        </div>
        {overlayHost}
      </div>
    );
  }

  if (showCharCreate || showOpening) return overlayHost;

  return <GameLayout layout={layout} />;

}
