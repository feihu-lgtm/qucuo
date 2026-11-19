import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { gameActions, gameStore, initGameStore, useGameStore } from "./store/gameStore.js";
import {
  OVERLAY, closeOverlay, initializeUiOverlays, openOverlay, toggleOverlay, useOverlay,
} from "./store/uiStore.js";
import { useAutosave, useInitialRestore } from "./app/hooks/useAutosave.js";
import { useDaySummary } from "./app/hooks/useDaySummary.js";
import { usePrivateTalk } from "./app/hooks/usePrivateTalk.js";
import { useOutfitAdvice } from "./app/hooks/useOutfitAdvice.js";
import { useAiInspect } from "./app/hooks/useAiInspect.js";
import { useTurn, useTurnQueue } from "./app/hooks/useTurn.js";
import { useQuestPanel } from "./app/hooks/useQuestPanel.js";
import { useDuel, useForcedDuelNpc } from "./app/hooks/useDuel.js";
import { usePigeonReplies } from "./app/hooks/usePigeonReplies.js";
import { useAutoTravel } from "./app/hooks/useAutoTravel.js";
import { useCraftingAI } from "./app/hooks/useCraftingAI.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "./core/newGame.js";
import { applyResult } from "./features/run.js";
import { selectEffectiveStats } from "./features/stats/logic.js";
import { applyCharacterCard } from "./features/character/logic.js";
import { pickGroundItem, consumeItem } from "./features/items/logic.js";
import { comfort, resolveTrauma, enterSeaOfMind as enterSeaLogic, leaveSeaOfMind as leaveSeaLogic, confessToNarrator as confessLogic } from "./features/narrator/logic.js";
import { switchCompanion } from "./features/companion/logic.js";
import { joinSect } from "./features/sect/logic.js";
import { auctionWin } from "./features/auction/logic.js";
import { createCoalescedCheck, createWorldRules } from "./engine/worldRules.js";
import { timeAdvanceRule } from "./features/time/rules.js";
import { residentNpcRule } from "./features/npc/rules.js";
import {
  alreadySatisfiedCollectRule,
  collectGroundItemsRule,
  estateAnnouncementRule,
  estateProgressRule,
  estateStartRule,
  escortArrivalRule,
  questFlagRule,
} from "./features/quest/rules.js";
import { innerGroundItemsRule } from "./features/map/rules.js";
import { derivedMovesetRule } from "./features/skills/rules.js";
import {
  finishTokyoReturn,
  portalOpenedRule,
  scheduleTokyoReturnRule,
  villaArrivalRule,
  xuannuTriggerRule,
} from "./features/narrator/rules.js";
import {
  breakthroughSkill as breakthroughSkillLogic,
  meditate as meditateLogic,
  trainCost,
  trainNeigong as trainNeigongLogic,
  trainWaigong as trainWaigongLogic,
} from "./features/cultivation/logic.js";
import {
  deposit as depositFeature,
  pledge as pledgeFeature,
  redeem as redeemFeature,
  withdraw as withdrawFeature,
} from "./features/bank/logic.js";
import {
  describeGiftForPrompt,
  giftNpc,
  inviteCompanion,
  lookNpc,
  settleNpcDuel,
  stealFromNpc,
  talkToNpc,
  tradeWithNpc,
} from "./features/npc/logic.js";
import {
  buyPigeon as buyPigeonLogic,
  collectPigeons as collectPigeonsLogic,
  pigeonDelayShichen as pigeonDelayShichenLogic,
  sendPigeonLetter as sendPigeonLetterLogic,
} from "./features/pigeon/logic.js";
import { attachImportedRegistry } from "./characterMilestones.js";
import {
  NNPC_STAGE, isInSea,
  narratorVoicePrompt, affectionLabel, buildNarratorWhisperContext,
  narratorWhisperLengthNote, gateWhisperTopics, gateQuestTopic,
} from "./narrator.js";
import { gateBodyProfile, emptyBodyProfile, buildOutfitRequest, bodyProfileFilled } from "./bodyProfile.js";
import BodyProfilePanel from "./BodyProfilePanel.jsx";
import { loadConfig, saveConfig } from "./apiConfig.js";
import { startTrace, step as traceStep, endTrace, getTraceLog, clearTraceLog, formatTrace, attachPipeline, attachExtractionPipeline, attachInjectionSnapshot, fmtMs } from "./actionTrace.js";
import SettingsPanel from "./SettingsPanel.jsx";
import LogEntry from "./LogEntry.jsx";
import LoreScreen from "./LoreScreen.jsx";
import { initialVarTree, extractMvuBlock, applyMvuCommands, npcAffectionLabel, reputationLabel } from "./mvu.js";
import { QUALITY_COLOR, ITEM_CATEGORY, CATEGORY_LABEL, getEquipped, toggleEquip, rollQuality, computeEquippedStats } from "./equipment.js";
import { effectBrief } from "./itemEffectText.js";
import { describeCatalogForAI, CATALOG, makeCatalogItem } from "./items/catalog.js";

import { getZoneTheme, ink } from "./theme.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";
import CodexScreen from "./CodexScreen.jsx";
import BugReportModal from "./BugReportModal.jsx";
import { QUCUO_MAP, isNodeUnlocked } from "./qucuoMap.js";
import { hasInnerMap, getDistrictAnchor, getInnerRoom, resolveInnerExit, visibleInnerExits, getResidentRoomForNpc, getInnerRoomNames, getBuildingIdForInnerRoom, isNpcVisibleInInnerRoom, isInnerExitUnlocked } from "./innerMap.js";
import { describeInnerArrival } from "./mapNarration.js";
import { loadPortraits, setPortrait, removePortrait, fileToDataUrl, inferActivePortraitTarget, SNOW_LEOPARD_FORMS, PEARL_FORMS, getSnowLeopardForm, setSnowLeopardForm, snowLeopardPortraitUrl, getPearlForm, setPearlForm, pearlPortraitUrl, getCompanionForms, getCompanionForm, setCompanionForm, companionPortraitUrl } from "./portraits.js";
import PortraitManager from "./PortraitManager.jsx";
import CharacterPage from "./CharacterPage.jsx";
import QuestLogScreen from "./QuestLogScreen.jsx";
import OpeningSequence from "./OpeningSequence.jsx";
import CharacterCreate from "./CharacterCreate.jsx";
import { getActivePreset } from "./PresetManager.jsx";
import { applyPresetOverrides } from "./presetSystem.js";
import TraceViewer from "./TraceViewer.jsx";
import { buildBudgetInstruction, INTENT } from "./inputIntent.js";
import NpcActionMenu from "./NpcActionMenu.jsx";
import ItemActionMenu from "./ItemActionMenu.jsx";
import { ensureNpcCombatData, generateNpcMoveset, MOVE_POOL, hpFromNeigong } from "./npcGeneration.js";
import { detectNewFaces, markAsSeen, markNpcAsKnown, isNpcKnown, detectReunions, buildReunionBlock, updateLastSeen, REUNION_GAP_THRESHOLD } from "./npcAwareness.js";
import TradingScreen from "./TradingScreen.jsx";
import { evolveKnowledge, buildInfoDomainBlock, factSummaryRequestFromRecall, registerFact, witnessFact, allFactSummaries } from "./knowledge.js";
import { findQuestByGiver, NPC_TEACHABLE_SKILLS, QUCUO_QUESTS } from "./quests/qucuoQuests.js";
import { QUEST_TYPE } from "./quests/questTypes.js";
import { MODE_PRIMER_MESSAGES, NSFW_RULES } from "./modePrimer.js";
import { labelMessage, makeBlock } from "./tavernMapping.js";
import { getCurrentStage, canBypassExclusive, isQuestGateOpen } from "./quests/questEngine.js";
import { resolveEnding } from "./quests/endingResolver.js";
import { initKeyItemTracking, transferKeyItem, getKeyItemState } from "./quests/itemTracking.js";
  // runQuestPromptHarness 已并入主叙事（act 的 forcedEvent 参数），不再单独调用；
  // quests/questHarness.js 文件暂留作参考，不再引用。
import { detectCollectPickup, allCollected, collectPromptLines } from "./quests/collect.js";
import { MOVE_TYPE } from "./combat/moveTypes.js";
import DuelScreen from "./DuelScreen.jsx";
import TeamDuelScreen from "./TeamDuelScreen.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import VersionHistoryPanel from "./VersionHistoryPanel.jsx";
import PersuasionScreen from "./PersuasionScreen.jsx";
import { CURRENT_VERSION } from "./version.js";
import { recallWithVisibility } from "./memory/recallWithVisibility.js";
import { writeNote, NOTE_SOURCE, VIA, reembedStaleNotes } from "./memory/note.js";
import { buildDistantViewBlock } from "./memory/daySummary.js";
import { embeddingReady } from "./memory/embeddingService.js";
import { matchNpcLore, buildNpcLoreBlock, gateScenario } from "./worldbook.js";
import { setSnowLeopardActive, isSnowLeopardAvailable, unlockedCompanions, unlockImportedCompanion, COMPANION_LORE } from "./companion.js";
import InnScreen from "./buildings/InnScreen.jsx";
import WuguanScreen from "./buildings/WuguanScreen.jsx";
import GamblingScreen from "./buildings/GamblingScreen.jsx";
import PigeonCoopScreen from "./buildings/PigeonCoopScreen.jsx";
import TransportScreen from "./buildings/TransportScreen.jsx";
import ServiceScreen, { BasementScreen } from "./buildings/ServiceScreen.jsx";
import TempleScreen from "./buildings/TempleScreen.jsx";
import LibraryScreen from "./buildings/LibraryScreen.jsx";
import BankScreen from "./buildings/BankScreen.jsx";
import PawnScreen from "./buildings/PawnScreen.jsx";
import EscortScreen from "./buildings/EscortScreen.jsx";
import { ESCORT_QUESTS } from "./quests/escortQuests.js";
import BountyScreen from "./buildings/BountyScreen.jsx";
import ForgeScreen from "./buildings/ForgeScreen.jsx";
import JadeShopScreen from "./buildings/JadeShopScreen.jsx";
import GambleStoneScreen from "./buildings/GambleStoneScreen.jsx";
import { settleNegotiation as gambleSettleNegotiation } from "./gambleStone.js";
import TeahouseScreen from "./buildings/TeahouseScreen.jsx";
import {
  buySkill as buySkillFeature,
  buyBook as buyBookFeature,
  cookMeal,
  gamble as gambleFeature,
  healAtHospital,
  listenToRumor,
  orderService,
  pray as prayFeature,
  readBook as readBookFeature,
  restAtInn,
  travelByCarriage,
} from "./features/buildings/logic.js";
import {
  commissionForge,
  craftJade,
  settleGambleStone,
} from "./features/crafting/logic.js";
import {
  acceptBounty,
  acceptEscort,
  claimBounty,
} from "./features/quest/logic.js";
// 在场名单的唯一写入口（见 roomNpcs.js 顶部：此前 15 个写入方各写一遍，
// 连着两个 bug 都是"谁都能改、改的时候顺手把别人写的冲掉"）
import { injectNpcs, materializeNpc, removeNpc } from "./roomNpcs.js";
import { tallyAdd } from "./memory/tally.js";
import { SECT_ENTRY } from "./sectEntry.js";
import { SEA_OF_MIND, canEnterSea } from "./seaOfMind.js";
import {
  availableKnot, canResolve, looksLikePromise, seaDialoguePrompt,
} from "./narratorQuest.js";
import { narratorVars, setNarratorVars } from "./mvu.js";
import { getAllResidentNpcLore } from "./residentNpcs.js";
import { SKILL_CATALOG } from "./kungfu/qucuoKungfu.js";
import { stealSuccessRate } from "./combat/stealSystem.js";
import { buildSysBase } from "./sysBase.js";
import { DIRS, bar, STAGE_TO_QUALITY, DIR_DXY, getTimeStr } from "./utils/mudHelpers.js";
import { MAP_UI } from "./mapUi.js";
import ZoomableMap from "./ZoomableMap.jsx";
import TutorialOverlay from "./TutorialOverlay.jsx";
import NineGridMap from "./NineGridMap.jsx";
import LeftPanel from "./panels/LeftPanel.jsx";
import RightPanel from "./panels/RightPanel.jsx";
import CenterPanel from "./panels/CenterPanel.jsx";
import TopBar from "./panels/TopBar.jsx";
import MusicPanel from "./MusicPanel.jsx";
import HomesteadPanel from "./buildings/HomesteadPanel.jsx";
import { getHomestead } from "./homestead.js";
import GlobalOverlays from "./panels/GlobalOverlays.jsx";
import * as importedRegistry from "./cards/importedRegistry.js";
import DebugPanel from "./panels/DebugPanel.jsx";
import ClickableMap from "./ClickableMap.jsx";
import PipelineViewer from "./PipelineViewer.jsx";
import { learnNpcSkill as learnNpcSkillLogic } from "./features/npc/logic.js";
import { getCompanionDescForm } from "./companionForms.js";

export default function MudRPG({ initialLoadSlotId = null, initialOpenSettings = false } = {}) {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
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
  // Outer-district changes reset inner navigation; restored locations are preserved once.
  useEffect(() => {
    if (prevRoomNameRef.current === room.name) return;
    prevRoomNameRef.current = room.name;
    if (restoredInnerRef.current !== null) { restoredInnerRef.current = null; return; }
    setInnerRoomName(hasInnerMap(room.name) ? getDistrictAnchor(room.name) : null);
  }, [room.name]);
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
  useEffect(() => { companionStateRef.current = companionState; }, [companionState]);
  // 装备信息现在完全并入 inv（每个物品对象自带 category/equipped 标记），不再单独维护 equip state
  // 老档补丁：catalog 后续给具名物品补的 sixDim/effect（如红档补七维）不会追溯到
  // 早就生成好的旧实例，这里读档时顺手补一遍，见 backfillInventoryFromCatalog。
  const inv = useGameStore(s => s.inv);
  const log = useGameStore(s => s.log);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  const [waitSecs, setWaitSecs] = useState(0); // AI 调用已等待秒数（卡住感知）
  const waitTimerRef = useRef(null);
  const [pendingTalks, setPendingTalks] = useState(0); // 对话/私聊模式：并行请求计数
  const pendingTalksRef = useRef(0);
  const changePendingTalks = useCallback((delta) => {
    const next = Math.max(0, pendingTalksRef.current + delta);
    pendingTalksRef.current = next;
    setPendingTalks(next);
  }, []);
  const [queueCount, setQueueCount] = useState(0); // 排队命令计数，驱动 UI 刷新
  const [collapsedGroups, setCollapsedGroups] = useState(new Set()); // 折叠的命令框（存 cmd 在 log 里的 index）
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
  const [mapBig, setMapBig] = useState(false);
  const mapBigCloseGuard = useOverlayCloseGuard(() => setMapBig(false));
  const [mapView, setMapView] = useState("outer"); // ⑦ 地图框显示：outer=外层大地图 / inner=内层箱庭图
  const [peoplePanel, setPeoplePanel] = useState({ present: true, absent: true }); // 左侧人物两段各自收放
  const time = useGameStore(s => s.time); // 24回合/天，6=第1日·卯时（晨）
  // time 的即时镜像：起居注在同一个事件循环里可能被连续调用（内层移动等），
  // 闭包里的 time 还是上一帧的值，跨天判定会错一格。跟 varTreeRef 同一套办法。
  const timeRef = useRef(time);
  useEffect(() => { timeRef.current = time; }, [time]);

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
  const [gm, setGm] = useState(false);

  // ── 手机端响应式：窄屏时三栏改成"叙事占满 + 左右抽屉 + 顶栏收成菜单" ──
  // 桌面(≥768px)维持原三栏并排；手机点小按钮才滑出左栏(天地)/右栏(行动)，
  // 顶栏一排按钮收进一个☰菜单。纯前端布局，不改任何游戏逻辑。
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileDrawer, setMobileDrawer] = useState(null); // null | "left" | "right"
  const [mobileTopMenu, setMobileTopMenu] = useState(false);
  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 768;
      setIsMobile(m);
      if (!m) { setMobileDrawer(null); setMobileTopMenu(false); } // 转横屏/放大回桌面就收起抽屉
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [settingsInitialTab, setSettingsInitialTab] = useState(null);
  const [interactMode, setInteractMode] = useState("action"); // 'talk' | 'action' | 'whisper'
  const [talkTarget, setTalkTarget] = useState(null); // 对话模式下具体在跟谁说话，供立绘自动推断使用
  const [activeTarget, setActiveTarget] = useState(null); // null=全部NPC在场 | string=锁定某个NPC名
  const [nsfwOn, setNsfwOn] = useState(true); // ■ NSFW 开关：true=注入NSFW规则+primer消息（默认开启）
  const [outfitState, setOutfitState] = useState({ loading: false, picks: [], error: "" }); // 按体貌荐装的结果
  const [pigeonTarget, setPigeonTarget] = useState(null); // 飞鸽传书当前收信人（进入 pigeon 模式时设置）
  const autoTravelRef = useRef(false); // 自动寻路进行中标记：途中遇随机遭遇时据此硬中断剩余队列
  const lastMoveRef = useRef(0); // 移动防连点：内层移动是瞬时的(不设loading)，手抖双击会连走两步甚至穿到外层走AI，用时间戳挡住
  const talkBusyRef = useRef(false); // 私聊串行闸门：一条私聊在途时为 true，挡住第二条。用 ref 而非 state，因为 ref 同步更新、不等 re-render，能挡住极快连点
  const undoSnapshotRef = useRef(null); // 回滚：存"上一次行动前"的整局快照，玩家点回滚可还原一步
  const teleportLookRef = useRef(null); // 调试传送落地待触发标记：{dist,inner}，位置更新到位后由 effect 触发一次环顾式 act
  const [activeNpcMenu, setActiveNpcMenu] = useState(null); // 当前弹出互动菜单的NPC对象，null表示未打开
  const [activeItemMenu, setActiveItemMenu] = useState(null); // ⑤⑧ 物品次级面板：{ item, mode:"inventory"|"ground", canConsume } | null
  const [playerAvatarCustom, setPlayerAvatarCustom] = useState(() => {
    try { return localStorage.getItem("qucuo_player_avatar") || ""; } catch { return ""; }
  });
  const AV_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/player/";
  const genderAvatar = { "男": AV_BASE + "male.webp", "女": AV_BASE + "female.webp" };
  const playerAvatar = playerAvatarCustom || genderAvatar[char.gender] || (AV_BASE + "other.webp");
  const [characterPageTarget, setCharacterPageTarget] = useState(null); // "面板"按钮指定直接打开谁的详情
  const [portraits, setPortraits] = useState(loadPortraits());
  // 雪豹立绘三形态切换（人形·立雪/人形·倚剑/雪豹真身，存 localStorage 持久化）；
  // slImgErr：图片文件未投放到 public/portraits/snowleopard/ 时显示占位提示而不是破图
  const [slForm, setSlFormState] = useState(getSnowLeopardForm());
  const [slImgErr, setSlImgErr] = useState(false);
  const [pearlForm, setPearlFormState] = useState(getPearlForm());
  const [pearlImgErr, setPearlImgErr] = useState(false);
  const [narratorImgErr, setNarratorImgErr] = useState(false); // 旁白立绘文件缺失时给占位提示
  const [portraitTarget, setPortraitTarget] = useState(null); // null = 自动推断；否则玩家手动锁定查看的对象
  const claimedMilestones = useGameStore(s => s.claimedMilestones);
  const narrator = useGameStore(s => s.narrator);
  const varTree = useGameStore(s => s.varTree);
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
  const varTreeRef = useRef(varTree);
  const setVarTree = useCallback((next) => {
    const v = typeof next === "function" ? next(varTreeRef.current) : next;
    varTreeRef.current = v;
    setVarTreeState(v);
  }, []);
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

  const [apiCfg, setApiCfg] = useState(loadConfig());
  const [uiScale, setUiScale] = useState(() => {
    const saved = localStorage.getItem("wuxia_mud_ui_scale");
    return saved ? parseFloat(saved) : 1;
  });
  // 日间模式（本轮新增）：米色底+棕框+深字的浅色主题，六个地理分区各自的
  // 色相基因保留，只是换算成浅色版本（见 theme.js 的 ZONE_THEMES_DAY）。
  // 一键切换，存 localStorage 持久化，跟 uiScale 同样的模式。
  const [isDayMode, setIsDayMode] = useState(() => {
    return localStorage.getItem("wuxia_mud_day_mode") === "1";
  });
  const pendDirRef = useRef(null);
  const outerDepartRef = useRef(null); // 外层移动出发时的内层位置信息（回锚点过渡描述用）
  const pickupJudgmentRef = useRef(null); // 本轮如果触发了拾取判定，保存 { quality, category }，供响应解析时强制校验
  const pickupExtractionFailedRef = useRef(false); // 双调用下本轮提取层是否解析失败——供拾取兜底区分"提取故障(该保底发)"vs"叙事拒捡(该尊重不发)"
  const collectGrantedRef = useRef([]); // 本轮系统已代发的采集物名单，供items_add处理时防止AI重复入袋
  const logEnd = useRef(null);
  const inputRef = useRef(null);
  const pendingQueue = useRef([]); // 处理中时暂存排队命令
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
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
  const importPreset = useCallback(() => {
    const el = document.createElement("input"); el.type = "file"; el.accept = ".json";
    el.onchange = (e) => {
      const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = (ev) => {
        try {
          const p = JSON.parse(ev.target.result);
          if (!p.name || !p.scenario || !p.room) throw new Error("缺少必要字段");
          const np = { ...DEFAULT_PRESETS[0], ...p, id: p.id || Date.now().toString() };
          setPresets(ps => [...ps.filter(x => x.id !== np.id), np]);
          loadPreset(np);
        } catch (err) { setLog(l => [...l, { t: "err", text: `  导入失败：${err.message}` }]); }
      };
      r.readAsText(f);
    };
    el.click();
  }, [loadPreset]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);
  useEffect(() => { roomMapRef.current[room.name] = { items: [...room.items], npcs: [...room.npcs] }; }, [room]);

  const [forcedDuelNpc, setForcedDuelNpc] = useState(null);
  const [duelingNpc, setDuelingNpc] = useState(null);
  const [duelPending, setDuelPending] = useState(null); // 邀战叙事跑完、等玩家点确认才真正开打的NPC
  // 任务分支的"真机制解决"挂起态：选了"打/说服"后，先进战斗/对话，
  // 打赢/说服成功才回来推进这个分支 stage。记录 { quest, stage, choice }。
  const [pendingQuestBranch, setPendingQuestBranch] = useState(null);
  // 说服界面：{ persuade, quest, flag } —— 打开 PersuasionScreen，说动了推进该分支
  const [activePersuasion, setActivePersuasion] = useState(null);
  const [activeBuilding, setActiveBuilding] = useState(null);
  // 赌石谈价勾连（轻量）：
  // gambleTalkCtx —— 当前这轮 act 是否在赌石谈价语境（有则 talk prompt 追加 <deal> 规则）
  // gambleNegotiation —— { [stoneId]: { [bidderName]: 调整后报价 } }，谈成的协议落到这里，赌桌读它更新报价
  const gambleTalkCtx = useRef(null);
  const [gambleNegotiation, setGambleNegotiation] = useState({});
  // 建筑面板"最小化"——跟"关闭"不同：关闭会把 activeBuilding 置 null，
  // 状态整个丢弃；最小化只是把渲染区收起来，activeBuilding 本身还留着，
  // 玩家可以在房间里跟人说话、随便走动，之后随时点回来重新展开这个面板，
  // 不需要重新走一遍"点建筑名进入"的流程。
  const [buildingPanelMinimized, setBuildingPanelMinimized] = useState(false);
  useEffect(() => { setBuildingPanelMinimized(false); }, [activeBuilding?.id]);
  const addLog = useCallback((lines) => setLog(p => [...p, ...lines]), []);

  // 把主日志按回合分组，供 bug 上报弹窗"按编号勾选要附带的记录"用。
  // 分组规则与主日志渲染一致：每个玩家指令(cmd)带它后面的回应(replies)算一组，
  // room/standalone 单独成组。每组给出 label(编号+指令摘要)、preview(纯文本预览)、
  // entries(原始条目，提交时发这个)。
  const buildBugReportTurns = useCallback(() => {
    const groups = [];
    let current = null;
    for (const entry of log) {
      const isStandalone = entry.t === "room" || entry.standalone;
      if (isStandalone) {
        if (current) { groups.push(current); current = null; }
        groups.push({ entries: [entry] });
      } else if (entry.t === "cmd") {
        if (current) groups.push(current);
        current = { entries: [entry] };
      } else {
        if (!current) current = { entries: [] };
        current.entries.push(entry);
      }
    }
    if (current) groups.push(current);
    return groups.map((g, i) => {
      const cmdEntry = g.entries.find(e => e.t === "cmd");
      const firstText = (cmdEntry?.text || g.entries[0]?.text || "").replace(/^[>\s]+/, "").trim();
      const label = `#${i + 1} ${firstText.slice(0, 20) || "（场景/系统）"}`;
      const preview = g.entries.map(e => (e.text || "").trim()).filter(Boolean).join("\n");
      return { label, preview, entries: g.entries };
    });
  }, [log]);

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
  const worldRulesRunnerRef = useRef(null);
  useEffect(() => {
    const cancelTokyoReturn = () => {
      if (tokyoReturnTimerRef.current) clearTimeout(tokyoReturnTimerRef.current);
      tokyoReturnTimerRef.current = null;
    };
    const scheduleTokyoReturn = ({ back, label }) => {
      cancelTokyoReturn();
      tokyoReturnTimerRef.current = setTimeout(() => {
        tokyoReturnTimerRef.current = null;
        if (gameStore.getState().room?.name !== "第三新东京市") return;
        const { result, innerRoomName: returnInnerRoomName } = finishTokyoReturn(back, label);
        applyResult(featureCtxRef.current, result);
        if (returnInnerRoomName !== undefined) {
          setTimeout(() => gameActions.setInnerRoomName(returnInnerRoomName), 0);
        }
      }, 3500);
    };
    if (!worldRulesRunnerRef.current) {
      worldRulesRunnerRef.current = createWorldRules([
        timeAdvanceRule,
        residentNpcRule,
        collectGroundItemsRule,
        innerGroundItemsRule,
        derivedMovesetRule,
        alreadySatisfiedCollectRule,
        escortArrivalRule,
        questFlagRule,
        estateStartRule,
        estateAnnouncementRule,
        estateProgressRule,
        xuannuTriggerRule,
        villaArrivalRule,
        portalOpenedRule,
        scheduleTokyoReturnRule,
      ], {
        getState: () => ({
          ...gameStore.getState(),
          importedVer: importedRegistry.getImportedRevision(),
        }),
        ctx: {
          importedRegistry,
          get companionState() {
            return gameStore.getState().companionState;
          },
          getSeaReturn: () => seaReturnRef.current,
          cancelTokyoReturn,
          scheduleTokyoReturn,
          getNow: () => Date.now(),
        },
        applyResult: (result) => {
          applyResult(featureCtxRef.current, result);
          if (result.forcedDuelNpc) setForcedDuelNpc(result.forcedDuelNpc);
        },
      });
    }
    const scheduler = createCoalescedCheck(() => worldRulesRunnerRef.current.check());
    const unsubscribeStore = gameStore.subscribe(scheduler.schedule);
    const unsubscribeImported = importedRegistry.subscribeImported(scheduler.schedule);
    scheduler.schedule();
    return () => {
      unsubscribeStore();
      unsubscribeImported();
      scheduler.dispose();
      cancelTokyoReturn();
    };
  }, []);

  useForcedDuelNpc({ forcedDuelNpc, setDuelingNpc, setForcedDuelNpc });

  const { talkToNarrator } = usePrivateTalk({
    narrator, addLog, apiCfg, convo, time, room, inv, preset, varTree, flags,
    jotNote, char, nsfwOn, questProgress, changePendingTalks, innerRoomName,
    talkBusyRef, schedulerRef, setInput, timeRef, varTreeRef, setLog, setConvo,
    setVarTree, setNarrator, noteAction,
  });

  // 「拉取目前」：把当前这一局的动态块真值抓出来，按 blockId 返回一张表。
  // 刻意不拼成一整篇——注入结构面板是一块一块看的，拼成全文等于又回到"一堵墙"。
  // 拿不到的块不放进表里，面板那边就继续显示模板说明。
  const getLiveBlockText = useCallback((view) => {
    const out = {};
    const put = (k, v) => { if (v != null && String(v).trim()) out[k] = String(v); };
    try {
      const scope = view?.scope || "full";
      const preset = getActivePreset();

      if (scope === "whisper") {
        put("whisper_ctx", buildNarratorWhisperContext(narrator.affection));
        put("voice", narratorVoicePrompt(narrator));
        const invText = inv.map(i => typeof i === "string" ? i : `${i.name}(${i.quality}${i.equipped ? "·已装备" : ""})`).join("，") || "空";
        put("world_state", `主角:${char.name || "无名少侠"}〔${char.gender || "男"}〕 时间:${getTimeStr(time)} 房间:${room.name}（${room.desc}） 房间里的人:${room.npcs.map(n => n.name).join(",") || "无"} 玩家背包:${invText}`);
        const facts = allFactSummaries(varTreeRef.current, 8);
        put("facts", facts.length ? facts.map(f => `· （${getTimeStr(f.诞生回合 || 0)}）${f.摘要}${f.标签 ? `〔${f.标签}〕` : ""}`).join("\n") : "（事实账本当前为空）");
        put("narrator_lore", (apiCfg.narratorLorebook || "").trim() || "（未填写，本块一个字都不发）");
        const bg = gateBodyProfile(char.bodyProfile, { whisper: true, nsfw: nsfwOn, scanText: "" });
        put("body_gate", bg.text || `（当前灭灯：${bg.dark.join("、") || "体貌未填写"}）`);
        put("topic_gate", "（默认不给。命中身世/赌石邀帖等关键词才点亮——这里没有输入，故灭灯）");
        const qg = gateQuestTopic("任务", narrator.affection, QUCUO_QUESTS, questProgress);
        put("quest_gate", qg.text || "（本轮没聊到任务）");
        put("whisper_scenario", gateScenario(preset.scenario, { scope: "whisper", userInput: "", lastReply: "" }).text);
        put("whisper_length", narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords));
        return out;
      }

      // act / talk 三条：能给真值的都给
      put("voice", narratorVoicePrompt(narrator));
      const intentCode = view?.intent || "UNKNOWN";
      const fakeIntent = INTENT[intentCode] || INTENT.UNKNOWN;
      put("length", buildBudgetInstruction(fakeIntent, "", apiCfg.targetWordCount, apiCfg.intentBudgets));
      put("preset_scenario", gateScenario(preset.scenario, { scope, userInput: "", lastReply: "" }).text);
      // 预设条目原文：按 id 从当前激活预设里取
      for (const [blockId, promptId] of [["preset_genrules", "generalRules"], ["preset_wenfeng", "styleRules"]]) {
        const found = (preset.prompts || []).find(x => x.id === promptId || (x.name || "").includes(blockId === "preset_genrules" ? "通用规则" : "文体"));
        if (found?.content) put(blockId, found.content);
      }
      const visible = room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
      put("npc_lore", buildNpcLoreBlock(matchNpcLore(
        [...(preset.npcLore || []), ...importedRegistry.getImportedNpcLore()],
        { roomNpcNames: visible.map(n => n.name), userInput: "", lastReply: "", includeLastReply: false }
      )) || "（本轮无在场者需注入人设）");
      if (scope === "full") put("catalog", describeCatalogForAI());
      const bg2 = gateBodyProfile(char.bodyProfile, { scope, nsfw: nsfwOn, scanText: "" });
      put("body_gate", bg2.text || `（当前灭灯：${bg2.dark.join("、") || "体貌未填写"}）`);
      put("user_ctx", `时间:${getTimeStr(time)} 主角:${char.name || "无名少侠"}〔${char.gender || "男"}〕 房间:${room.name} 出口:${room.exits.join(",")} NPCs:${visible.map(n => n.name).join(",") || "无"} HP:${char.hp.join("/")} 内功:${char.neigong ?? 0} 外功:${char.waigong ?? 0} 背包:${inv.map(i => typeof i === "string" ? i : i.name).join("，") || "空"}`);
    } catch (e) {
      out.__error = `拉取时出错：${e.message || e}`;
    }
    return out;
  }, [narrator, inv, char, time, room, innerRoomName, varTree, apiCfg, nsfwOn, questProgress]);


  // 分工照 catalog.js 顶部那条老规矩：AI 只负责"从这张货架上挑哪三件"，
  // 数值一概不由它给——挑完拿名字回 CATALOG_INDEX 查真值。这样既不会凭空冒出
  // 货架上没有的神兵，也不会出现同一件东西这次加 20 下次加 200。
  // 只报字段/描述/加成，不报获取途径：怎么弄到手得自己走一趟。
  const { recommendOutfit } = useOutfitAdvice({ char, apiCfg, setOutfitState });

  const confessToNarrator = useCallback(() => {
    applyResult(featureCtxRef.current, confessLogic(gameStore.getState()));
  }, []);

  const { inspecting, inspectItem } = useAiInspect({
    loading, addLog, jotNote, setTime, setFlags, apiCfg, skills, char, inv,
  });
  // 打坐：消耗1回合，恢复部分气血，不单纯是时间跳跃
  const [justMeditated, setJustMeditated] = useState(false);

  const meditate = useCallback(() => {
    if (loading) return;
    setJustMeditated(true);
    setTimeout(() => setJustMeditated(false), 350);
    applyResult(featureCtxRef.current, meditateLogic(gameStore.getState()));
    noteAction("meditate");
  }, [loading, noteAction]);

  // 修炼：花潜能升内功/外功，越练越贵（每10点门槛成本+1），系统本地裁决，
  // AI 不再直接改 neigong/waigong（见 presetSystem.js 的收权说明）——
  // 战斗/任务赚潜能，潜能换修为，这是唯一的数值上升通道。
  const trainNeigong = useCallback(() => {
    if (loading) return;
    applyResult(featureCtxRef.current, trainNeigongLogic(gameStore.getState()));
  }, [loading]);
  const trainWaigong = useCallback(() => {
    if (loading) return;
    applyResult(featureCtxRef.current, trainWaigongLogic(gameStore.getState()));
  }, [loading]);

  // 武学升阶：花潜能把某门【可修炼武学】(非 fixed/授业绝学)的 stage 往上推一级。
  // 复用潜能这条唯一数值上升通道（跟内外功同源），不再靠 exp 经验累积——经验那条
  // 断链了（战斗不发经验），改成玩家用潜能主动突破，明确可控。
  // 成本按目标阶段递增：小成12 / 大成20 / 圆满32 / 登峰造极48（越高阶越贵，跟内外功
  // "越练越贵"一个思路，但武学是阶跃式突破，单次成本更高）。
  const breakthroughSkill = useCallback((skillId) => {
    if (loading) return;
    applyResult(featureCtxRef.current, breakthroughSkillLogic(gameStore.getState(), skillId));
  }, [loading]);

  // 送礼：从背包选一件物品送给指定角色，走正常的行动指令流程，
  // 让主引擎 AI 描述场景、判断礼物是否合心意，并通过 <mvu> 自行决定好感度增量
  // （沿用"AI 提议 + 系统裁决"：AI 只能建议合理幅度，最终写入仍由 applyMvuCommands 裁剪）
  const claimMilestone = useCallback((charName, threshold) => {
    setClaimedMilestones(prev => new Set(prev).add(`${charName}:${threshold}`));
  }, []);

  // extraReplies：调用方（比如点击NPC头像触发的"细看"）想在这条命令自己的框里
  // 附带插入的日志（气血条之类），必须跟 cmd 回显同一次 addLog 原子提交——
  // 之前 handleNpcLook 是先 addLog 血条、再调 act 补 cmd 行，两次独立的 addLog
  // 调用中间一旦被"上一条命令还在处理中"的排队分支截胡，血条就会插在数组里
  // "cmd行"之前，按分组算法（以cmd为界）被错误地划进上一条命令的框，而不是
  // 这条"look X"自己的框。
  // ── 感叹号任务面板：当前房间可确定性触发的任务（本轮新增）──
  // 复用现有 isQuestGateOpen/questProgress 状态机判断（跟 questStageNote
  // 给AI看的那份提示是同一套判断逻辑，两者互不冲突：questStageNote 是
  // "软提示"给AI参考，这里是"硬列表"给玩家点击）。核心区别在触发方式：
  // 点击这里的任务后，不是等AI自己判断"该不该在这轮引出"，而是系统直接
  // 拼一句确定的话通过 act() 送出去，AI 依然按老规矩生成具体怎么演，
  // 只是"要不要触发"这个决策权从AI手里挪到了玩家点击这个动作本身——
  // 感叹号是确定性保底通道，玩家自己在对话框里打字触发剧情的路径依然
  // 保留、两者并行。
  //
  // 只统计"待接取"（还没在 questProgress 里、giver在当前房间）和
  // "进行中下一步的giver在当前房间"这两种情况——已完成/被互斥锁定的
  // 不显示。novel/续接型任务（giver为null）不出现在这里，因为它们本来
  // 就不是靠"找NPC聊"触发的，感叹号面板只服务于"有明确对话对象"的任务。
  const availableQuestsHere = useMemo(() => {
    const result = [];
    for (const quest of QUCUO_QUESTS) {
      if (!quest.stages?.length) continue;
      const prog = questProgress[quest.id];
      if (prog?.status === "locked_by_exclusive" || prog?.status === "completed") continue;
      if (!isQuestGateOpen(quest, questProgress, flags)) continue;
      if (quest.id === "hidden_all_collect_line" && !canBypassExclusive({ char, flags })) continue;
      const isNewlyGiven = !prog;
      const stage = isNewlyGiven ? quest.stages[0] : (prog.status === "active" ? getCurrentStage(quest, prog) : null);
      if (!stage) continue;
      // 触发条件二选一：有giver（真实NPC）就查这个人是否在场——原逻辑；
      // giver为null（狼曲路途/上山/密室触发这类没有对话对象的节点）就改查
      // 这个stage自己声明的at据点是否等于当前房间。两条路都是同一个原则：
      // "满足确定性条件就出❢"，只是判断依据从"人在不在"换成"人到没到地方"，
      // 没声明at的giver:null节点保持原样不出现（不强行瞎猜地点）。
      // giver 在场判定：必须用和左栏「此地之人」同一套内层房间过滤（isNpcVisibleInInnerRoom）——
      // 否则会出现"左栏按内层房间只显示村口的人、任务栏却因为 giver 在整个 room.npcs 里就
      // 判可推进"的割裂：老猎户明明在猎户小屋、不在村口，任务栏却显示村1 可推进。统一后，
      // giver 在哪个内层房间，就只有走到那个房间才出现该任务的推进入口，与左栏一致。
      const giverNpc = quest.giver ? room.npcs?.find(n => n.name === quest.giver) : null;
      const here = quest.giver
        ? !!(giverNpc && isNpcVisibleInInnerRoom(room.name, innerRoomName, giverNpc))
        : stage.at === room.name;
      if (!here) continue;
      // 位置门槛（本轮新增）：stage 若声明 requireLocation，则玩家必须真的到了那个
      // 地方，这一步的选项才展开——不能在别处（比如村口刚听完 giver 说话）就地触发。
      // requireLocation.district 约束外层据点(room.name)，.inner 约束内层房间(innerRoomName)。
      // 只声明 district 就只校验据点；同时声明 inner 就连内层房间一起校验。
      // 这样"村1 s2 必须走到大草甸·熊山口"这类动线才真正由系统把关，而不是只写在
      // 给 AI 看的 description 文案里、代码却不认。
      if (stage.requireLocation) {
        const rl = stage.requireLocation;
        if (rl.district && rl.district !== room.name) continue;
        if (rl.inner && rl.inner !== innerRoomName) continue;
      }
      result.push({ quest, stage, isNewlyGiven });
    }
    return result;
  }, [room, questProgress, flags, char, innerRoomName]);

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

  // 切磋结算共享 handler：1v1(DuelScreen) 与 2v2(TeamDuelScreen) 两个界面
  // 的收尾逻辑完全一致——交情/战利品/任务分支/事实账本/整场战报都跟战斗
  // 形态无关，提取成同一个函数供两处复用（battleLog 条目形状略有差异：
  // 1v1 是 {playerMove,npcMove,...}，2v2 是 TeamDuelScreen 拼好的 {teamText}）。
  const duelFinishHandler = useCallback((outcome, loot, battleLog, grownMoveset, usedItems, remainingHp) => {
    const finishedNpc = duelingNpc;
    const result = settleNpcDuel(gameStore.getState(), finishedNpc, {
      outcome,
      loot,
      battleLog,
      grownMoveset,
      usedItems,
      remainingHp,
      pendingQuestBranch,
      createRespawnNpc: ensureNpcCombatData,
    });
    if (pendingQuestBranch?.mode === "combat" && finishedNpc?.questBranchFlag === pendingQuestBranch.flag) {
      setPendingQuestBranch(null);
    }
    noteAction("duel");
    setDuelingNpc(null);
    applyResult(featureCtxRef.current, result);
    if (result.factId) aiSummarizeFact(result.factId, result.cue);
    if (finishedNpc) {
      setTimeout(() => {
        act(`切磋结束。经过：${result.recap || "双方试探几招，未及深入"}。结果：${result.outcomeText}。请把上面每回合的说书片段串成一篇连贯的整场战报，点出关键招式和胜负经过，说书人口吻、一气呵成。并且务必在本轮 JSON 里输出 memory 字段（不超过50字客观事实），把这场切磋记成一条往事：与谁在何处切磋、用了哪几招、谁胜谁负、有无夺得战利品——供日后回想与旁人提起。`, [], { silentCmd: true, preserveHp: true });
      }, 0);
      jotNote({
        text: result.recapNote,
        owner: [{ name: finishedNpc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      });
    }
  }, [duelingNpc, pendingQuestBranch, noteAction, act, jotNote, aiSummarizeFact, setDuelingNpc, setPendingQuestBranch]);

  // 分支节点的具体选项点击（本轮改造，同样支持二选一模式）：
  //   "script" 模式——送一句明确的话给主叙事AI（此前的实现）
  //   "prompt" 模式（默认）——系统直接强制写入这个选项对应的flag、推进
  //     stage、结算奖励，然后调用专属harness生成这个具体选择的叙事文字
  // 细看：恢复原本"点NPC名字直接查看"的行为，走正常行动指令流程，
  // 让主引擎描述这个人的外貌举止细节
  const handleNpcLook = useCallback((npc) => {
    const result = lookNpc(gameStore.getState(), npc);
    applyResult(featureCtxRef.current, result);
    setActiveTarget(npc.name);
    act("look " + npc.id, result.extraReplies || []);
  }, [act]);

  // NPC 互动菜单的四个动作回调。
  // 对话：直接把交互模式切到 talk，玩家自己接着打字说话——
  // 不代玩家编一句开场白，因为"上前搭话"之后具体聊什么应该由玩家自己决定。
  const handleNpcTalk = useCallback((npc) => {
    const result = talkToNpc(gameStore.getState(), npc);
    applyResult(featureCtxRef.current, result);
    if (result.completedEscort) return;
    if (npc.cannotSpeak) {
      setActiveTarget(npc.name);
      return;
    }
    setInteractMode("talk");
    setTalkTarget(npc.name);
    setActiveTarget(npc.name);
  }, []);

  // 送礼信息组装：把"送的是什么"落到具体的品阶+描述+建议幅度，喂给 AI 的 <mvu>
  // 提示才有依据可循，不是空对着一个物品名字瞎猜该加多少好感。
  // 优先查百物录（具名物品，desc 最详实）；查不到就退回背包条目自带的字段
  // （匿名装备通常有 quality，杂物道具可能只有 name）；品阶缺失一律按白档兜底。
  // 建议幅度区间跟着六品阶指数曲线走（品阶越高、这件东西在世界观里越贵重，
  // 一份心意的分量也越重），最终仍会被 mvu.js 的 ±15 硬裁剪兜底，这里只是
  // 给 AI 一个贴合实际、别瞎给的参考锚点，不是精确写死的数值。
  // 送礼：系统裁决层先本地从背包扣除这件物品（不能让 AI 自己决定"要不要真的扣"），
  // 再把"送出"这个既成事实和物品描述一起交给主引擎生成场景反应和好感度判断。
  const handleNpcGift = useCallback((npc, item) => {
    setActiveTarget(npc.name);
    applyResult(featureCtxRef.current, giftNpc(gameStore.getState(), npc, item));
  }, []);

  // 邀请入队（目前只有雪豹）：系统裁决层直接把伙伴状态设为"已解锁+出战"
  // （不靠AI判断"愿不愿意跟你走"这种概率性的东西——邀请入队是玩家主动点的
  // 确定性按钮，点了就成，不该有"AI这轮心情不好就拒绝了"的不确定性，这跟
  // 送礼的教训一致：凡是玩家主动发起、系统本该兜底成功的动作，都不能把
  // "成不成"这件事交给AI去演，只能交给AI去描述"已经发生的事"）。
  // 走 settle 档 + settleKind:"companion_invite"，让 buildSysBase 注入专属的
  // "前世羁绊/认主"调性铁律（见下方 buildSysBase 里新增的分支）。
  const handleInviteCompanion = useCallback((npc) => {
    const result = inviteCompanion(gameStore.getState(), npc);
    if (!result.changes) return;
    setActiveTarget(npc.name);
    applyResult(featureCtxRef.current, result);
  }, []);

  // ⑤ 服食：把原打字正则分支的确定性结算抽成 handler，供物品面板「服食」调用。
  const handleConsumeItem = useCallback((item) => {
    applyResult(featureCtxRef.current, consumeItem(gameStore.getState(), item));
  }, []);

  // ⑧ 采摘：把地上物收入背包、从 room.items 抹去（确定性，不调AI）。
  const handleCollectGround = useCallback((item) => {
    applyResult(featureCtxRef.current, pickGroundItem(gameStore.getState(), item, { tallyTime: timeRef.current }));
  }, []);

  const autoTravelTo = useAutoTravel({
    room, loading, mapData, flags, questProgress, addLog, pendingQueue,
    autoTravelRef, setQueueCount, act, teleportLookRef, innerRoomName, setInteractMode,
  });

  // ── 飞鸽传书（本轮新增）──────────────────────────────────────────────
  // 飞鸽回信时长：按玩家当前据点与收信人所在据点的直线距离折算，钳制在 1–12 时辰。
  const pigeonDelayShichen = useCallback(
    (npcName) => pigeonDelayShichenLogic(gameStore.getState(), npcName),
    [room.name, varTree],
  );

  const applyPigeonResult = useCallback((result) => {
    applyResult(featureCtxRef.current, result);
    if (result.factSummary) aiSummarizeFact(result.factSummary.id, result.factSummary.cue);
    return result;
  }, [aiSummarizeFact]);

  usePigeonReplies({ room, apiCfg, preset, applyPigeonResult, time, varTree, featureCtxRef });

  const sendPigeonLetter = useCallback((npcName, content, opts = {}) => {
    const result = sendPigeonLetterLogic(gameStore.getState(), npcName, content, opts);
    applyPigeonResult(result);
    if (result.sent) {
      setInput("");
      setPigeonTarget(null);
      setInteractMode("action");
    }
    return result;
  }, [applyPigeonResult]);

  // 驿站买鸽子
  const buyPigeon = useCallback((qty, price) => {
    applyPigeonResult(buyPigeonLogic(gameStore.getState(), qty, price));
  }, [applyPigeonResult]);

  // 鸽子笼：每日免费领信鸽，不花银两。跟赌坊同一套"当天领没领过"判断模式，
  // 用 flags 记 pigeon_collected_day_${dayIdx}（dayIdx = time/24，真正的天数）。
  const handleCollectPigeons = useCallback(({ qty, dayIdx }) => {
    applyPigeonResult(collectPigeonsLogic(gameStore.getState(), { qty, dayIdx }));
  }, [applyPigeonResult]);

  // 驿站寄信/送礼总入口（供 TransportScreen 回调）
  const handlePostSend = useCallback(({ npcName, content, channel, gift }) => {
    setActiveBuilding(null);
    sendPigeonLetter(npcName, content, { channel, gift });
  }, [sendPigeonLetter]);

  const { handleNpcDuel, confirmDuel, cancelDuel } = useDuel({
    act, addLog, duelPending, featureCtxRef, setActiveTarget, setDuelPending, setDuelingNpc,
  });

  // 拜师学艺：好感度≥40 + 完成该NPC专属支线任务，两个条件同时满足才能学到技能。
  // 不满足时给出具体卡在哪个条件的说明，而不是一句笼统的"不行"。
  // 打开交易界面：只在NPC是手写配置的商人时可用，货品清单固定不变，
  // 保证同一个商人每次进店看到的东西都稳定。
  const [tradingShop, setTradingShop] = useState(null); // { name: 商人名, shopName, items }
  const handleNpcTrade = useCallback((npc) => {
    const result = tradeWithNpc(gameStore.getState(), npc);
    if (result.shop) setTradingShop(result.shop);
    else applyResult(featureCtxRef.current, result);
  }, []);

  // 拜师学艺：统一走 tryLearnFromMaster（src/kungfu/learnSkill.js）。
  // 高手（levelCap≥1）教专属招，平民（levelCap<1）教通用招池的白档基本功——
  // 这是这次改动新加的行为，此前平民直接拒绝拜师。价格按好感折价曲线走低
  // （40-59原价/60-79七折/80-99五折/100免费），银两不够时提示但不强行学。
  const handleNpcLearnSkill = useCallback((npc) => {
    const result = learnNpcSkillLogic(gameStore.getState(), npc);
    if (result.changes) setActiveTarget(npc.name);
    applyResult(featureCtxRef.current, result);
  }, []);

  // 偷窃：偷物+偷师（偷招）二合一，同一次判定，成功后再二选一决定这次偷到的
  // 是物品还是招式（tryStealFrom 内部处理）。身法（char.special.身法）现在也
  // 参与成功率计算，跟好感度独立相加——手越利索，越容易得手。
  const handleNpcSteal = useCallback((npc) => {
    const state = gameStore.getState();
    const agility = state.char?.special?.身法 ?? 0;
    const _st = startTrace(`偷窃 ${npc?.name || "?"}`, `偷窃 ${npc?.name || "?"}`);
    const poolAll = npc?.carriedItems || [];
    const poolUsable = poolAll.filter(it => !it.stolen);
    traceStep(_st, "随身物池", poolUsable.length ? "info" : "block",
      poolAll.length
        ? `共${poolAll.length}件，可偷${poolUsable.length}件：${poolUsable.map(i => `${i.name}(${i.category || "?"}/${i.quality || "?"})`).join("、") || "无"}`
        : `carriedItems 为空或未固化 —— 这种情况偷不到任何物件，只可能偷到招式。若此人本该有随身物，说明固化/回填没生效。`);
    const favorability = state.varTree?.角色?.[npc?.name]?.好感度 ?? 0;
    traceStep(_st, "身法与好感", "info",
      `身法${agility}，好感${favorability} → 成功率约 ${(stealSuccessRate(favorability, agility) * 100).toFixed(0)}%`);
    const result = stealFromNpc(state, npc);
    const steal = result.steal;
    if (result.kind === "blocked") {
      traceStep(_st, "判定", "block", steal?.reason || "此地没有这位人物。");
      endTrace(_st, "偷窃未进行");
      applyResult(featureCtxRef.current, result);
      return;
    }
    traceStep(_st, "掷骰", steal.success ? "pass" : "block",
      `成功率${(steal.rate * 100).toFixed(0)}% → ${steal.success ? "得手" : "被察觉"}`);
    if (steal.success) {
      traceStep(_st, "产出分流", "info",
        `结局=${steal.outcome === null ? "对方一无所有" : steal.outcome === "move" ? "偷到招式" : "偷到物件"}`
        + (steal.outcome === "item" ? `：${steal.item.name}(${steal.item.category})` : "")
        + (steal.outcome === "move" ? `：${steal.move.name}` : ""));
    }
    if (result.kind === "caught") {
      endTrace(_st, `被${npc.name}察觉，好感-${steal.favorabilityLoss}`);
    } else {
      endTrace(_st, result.kind === "empty"
        ? `得手但${npc.name}身无长物`
        : result.kind === "item" ? `顺走「${steal.item.name}」` : `偷师「${steal.move.name}」`);
    }
    if (result.noteAction) noteAction(result.noteAction);
    applyResult(featureCtxRef.current, result);
  }, [noteAction]);

  useTurnQueue({ loading, act, pendingQueue, setQueueCount, autoTravelRef });

  const giftToCharacter = useCallback((charName) => {
    if (inv.length === 0) {
      addLog([{ t: "err", text: `  背包空空如也，没有什么可以送给${charName}的。` }]);
      return;
    }
    const itemNames = inv.map(i => typeof i === "string" ? i : i.name);
    const choice = window.prompt(`要把哪件东西送给${charName}？\n${itemNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n输入序号：`);
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= itemNames.length) return;
    const itemName = itemNames[idx];
    const giftInfo = describeGiftForPrompt(inv[idx]);
    setInteractMode("action");
    act(`把${itemName}送给${charName}`, [], { settle: true, settleNpc: charName, settleKind: "gift", giftInfo });
  }, [inv, addLog, act, describeGiftForPrompt]);

  // ── 建筑交互处理 ──

  const handleBuildingInn = useCallback((cost, roomType) => {
    const result = restAtInn(gameStore.getState(), {
      cost,
      roomType,
      buildingName: activeBuilding?.name,
    });
    applyResult(featureCtxRef.current, result);
  }, [activeBuilding]);

  const handleBuildingHeal = useCallback((cost, healAmt) => {
    applyResult(featureCtxRef.current, healAtHospital(gameStore.getState(), {
      cost,
      healAmt,
      buildingName: activeBuilding?.name,
    }));
  }, [activeBuilding]);

  const handleBuySkill = useCallback((catalogItem) => {
    applyResult(featureCtxRef.current, buySkillFeature(gameStore.getState(), catalogItem));
  }, []);

  const handleGamble = useCallback(({ mode, bet, luck, dayIdx }) => {
    applyResult(featureCtxRef.current, gambleFeature(gameStore.getState(), {
      mode,
      bet,
      luck,
      dayIdx,
      maxBet: activeBuilding?.maxBet,
    }));
  }, [activeBuilding]);

  const handleTravel = useCallback((dest, price) => {
    const result = travelByCarriage(gameStore.getState(), dest, price);
    applyResult(featureCtxRef.current, result);
    if (result.changes) setActiveBuilding(null);
  }, []);

  const handleServiceOrder = useCallback((item, karmaChange = 0) => {
    applyResult(featureCtxRef.current, orderService(gameStore.getState(), item, karmaChange));
  }, []);

  // 烹饪台：系统裁决（扣料/回血/挂 buff flag），叙事交给主管线写一段「小总结」。
  // dish 由 CookingScreen 算好（固定配方 computeDish / 自由组合 genericDishEffect）。
  // freestyle（妙手偶得）时菜名也由主叙事 AI 即兴起——想象归 AI、数值归系统。
  const handleCook = useCallback(({ materials, technique, cookware, freestyle, dish }) => {
    applyResult(featureCtxRef.current, cookMeal(gameStore.getState(), {
      materials,
      technique,
      cookware,
      freestyle,
      dish,
      buildingName: activeBuilding?.name,
    }));
  }, [activeBuilding]);

  const handlePray = useCallback(() => {
    applyResult(featureCtxRef.current, prayFeature(
      gameStore.getState(),
      activeBuilding?.karmaPerPray || 10,
    ));
  }, [activeBuilding]);

  const handleReadBook = useCallback((book) => {
    applyResult(featureCtxRef.current, readBookFeature(gameStore.getState(), book));
  }, []);

  const handleBuyBook = useCallback((book) => {
    applyResult(featureCtxRef.current, buyBookFeature(gameStore.getState(), book));
  }, []);

  const handleDeposit = useCallback((amount) => {
    applyResult(featureCtxRef.current, depositFeature(gameStore.getState(), amount));
  }, []);

  const handleWithdraw = useCallback(() => {
    applyResult(featureCtxRef.current, withdrawFeature(gameStore.getState()));
  }, []);

  const handlePledge = useCallback((item, pledgeValue) => {
    applyResult(featureCtxRef.current, pledgeFeature(gameStore.getState(), item.id, pledgeValue));
  }, []);

  const handleRedeem = useCallback((index, redeemCost) => {
    applyResult(featureCtxRef.current, redeemFeature(gameStore.getState(), index, redeemCost));
  }, []);

  const handleAcceptEscort = useCallback((quest) => {
    applyResult(featureCtxRef.current, acceptEscort(gameStore.getState(), quest));
  }, []);

  const handleAcceptBounty = useCallback((quest) => {
    applyResult(featureCtxRef.current, acceptBounty(gameStore.getState(), quest));
  }, []);

  const handleClaimBounty = useCallback((quest) => {
    applyResult(featureCtxRef.current, claimBounty(gameStore.getState(), quest));
  }, []);

  const { handleGambleTalk, handleGambleInspect, handleForgeDesign, handleJadeDesign } = useCraftingAI({
    gambleTalkCtx, setInteractMode, setTalkTarget, act, apiCfg, addLog, setTime, jotNote,
  });

  // 赌石成交/委托：系统裁决好数值后（gambleStone 已 clamp），照送礼/买卖那套——
  // 拼一句自然语言走 act()，让主叙事演一段，convo/小纸条/账本/召回全自动挂上。
  const handleGambleSettle = useCallback((res) => {
    const result = settleGambleStone(gameStore.getState(), res);
    applyResult(featureCtxRef.current, result);
    if (res.type !== "buy" && result.changes) setActiveBuilding(null);
  }, []);

  // 玩家从 3 候选里选定一个下单。候选完整规格(name/category/effect/sixDim + 三填空原文)
  // 编码进 pending flag——因为 effect/sixDim 是对象，塞不进下划线分隔的老格式，改成把整个
  // spec JSON 用 encodeURIComponent 存进 flag 末段，24 时辰自动交付时解出、原样造出成品。
  // flag 格式：forge_pending_<下单time>_<luck>_<encodeURIComponent(JSON.stringify(spec))>
  const handleForgeCommission = useCallback((chosen, luck, currentTime, cost, threeFields) => {
    applyResult(featureCtxRef.current, commissionForge(gameStore.getState(), {
      chosen, luck, currentTime, cost, threeFields,
    }));
  }, []);

  // ══ 金玉行（一个 building 两柜台，都消耗背包里的玉料）══
  // 玉料 = 赌石开出后"据为己有"收进背包的物品(带 jadeSpec.qualityCap 品质天花板)。
  // 成品品质 = min(玉料天花板, 气运rollQuality)——好料是上限，手气定实际发挥。
  // 两柜台都走延时打造(复用 forge_pending flag + 自动交付)，spec 里带 jade:true + qualityCap，
  // 交付时据此把品质封顶。下单即消耗那件玉料(从 inv 移除)。

  // 下单打造（两柜台共用）：chosen=选定成品规格，jadeItemId=要消耗的玉料物品id。
  // preset=true 表示预制柜(选购成品，词条来自 JADE_WARES 该成品本身)；false 为定制柜。
  const handleJadeCraft = useCallback((chosen, jadeItemId, currentTime, threeFields) => {
    applyResult(featureCtxRef.current, craftJade(gameStore.getState(), {
      chosen, jadeItemId, currentTime, threeFields,
    }));
  }, []);

  const handleListenRumor = useCallback((rumor, cost) => {
    applyResult(featureCtxRef.current, listenToRumor(gameStore.getState(), rumor, cost));
  }, []);

  // ── 角色入册的落册回调 ──
  // 人物只进全局注册表，不进存档：导入的卡是玩家资产，跨存档通用。
  // 好感度只在作者明确配了非 0 初值时才写 varTree——写了就会出现在「人物关系」页，
  // 而一个还没见过面的人出现在关系页是不对的。初值 0 的等自然相遇再建交情。
  const handleImportNpcs = useCallback((npcs) => {
    const n = importedRegistry.registerImported(npcs, {});
    const withAff = npcs.filter(x => (x.affection || 0) !== 0);
    if (withAff.length) {
      setVarTree(t => {
        const chars = { ...(t.角色 || {}) };
        for (const x of withAff) {
          chars[x.name] = { ...(chars[x.name] || {}), 好感度: Math.max(0, Math.min(100, x.affection)) };
        }
        return { ...t, 角色: chars };
      });
    }
    // 不必手动推版本号：registerImported 内部的 persist 会通知订阅者，
    // registry 的 revision 通知会调度驻场 world rule 重算
    // 有几个人此刻就该站在这个据点里？如实说，别让玩家对着空屋子猜落册成没成。
    const here = importedRegistry.getImportedResidentNames()
      .filter(nm => npcs.some(x => x.name === nm));
    addLog([
      { t: "sys", text: `  ${n} 人已入册：${npcs.map(x => x.name).join("、")}` },
      { t: "sys", text: "  他们的人设已挂上世界书，行走江湖时遇到便会照此登场。" },
      ...(here.length
        ? [{ t: "sys", text: `  其中 ${here.join("、")} 驻场于此，此刻已在场。` }]
        : []),
    ]);
  }, [setVarTree, addLog]);

  // 玩家档案：名讳 / 体貌公开层 / 七维。气血必须在体魄定下之后重算，顺序不能反。
  const handleImportPlayer = useCallback((player, opening) => {
    setChar(c => {
      const next = { ...c };
      if (player.name) next.name = player.name;
      if (player.gender) next.gender = player.gender;
      if (player.special) next.special = { ...(c.special || {}), ...player.special };
      // bodyProfile 的十二项在数据结构上是平的（公开层七项＋私密层五项同一个对象），
      // 界面上分两层只是为了标清"哪些能从卡里抽、哪些只能手填"。
      if (player.bodyProfile || player.bodyProfilePrivate) {
        next.bodyProfile = { ...(c.bodyProfile || {}), ...(player.bodyProfile || {}), ...(player.bodyProfilePrivate || {}) };
      }
      if (Number.isFinite(player.neigong)) next.neigong = player.neigong;
      if (Number.isFinite(player.waigong)) next.waigong = player.waigong;
      const maxHp = hpFromNeigong(next.neigong ?? 5, next.special?.体魄 ?? 5);
      const curRatio = (c.hp?.[1] ? c.hp[0] / c.hp[1] : 1);
      next.hp = [Math.max(1, Math.round(maxHp * curRatio)), maxHp];
      return next;
    });
    // 主角卡的初始武学/装备，跟开局路径同一套（武学整套替换、装备追加+自动上身）。
    // seed 带时间戳：游戏中可能反复入册，避免 carry 物品 id 撞号（撞了会一起被装备/卸下）。
    const cardResult = applyCharacterCard(gameStore.getState(), player, `ci${Date.now().toString(36)}_`);
    applyResult(featureCtxRef.current, cardResult);
    const carried = cardResult.carriedCount;
    const filled = Object.values(player.bodyProfile || {}).filter(v => (v || "").trim()).length;
    const sk = (player.skills || []).length;
    addLog([
      { t: "sys", text: `  已按卡改写自身：体貌填了 ${filled}/7 项，七维已录${sk ? `，带 ${sk} 门武学` : ""}${carried ? `，${carried} 件随身物已入包` : ""}。` },
      ...(filled < 7 ? [{ t: "sys", text: "  余下几项去右栏「◈ 体貌」自己补，私密层那五项只能手填。" }] : []),
      ...(opening?.rewritten ? [{ t: "narr", text: opening.rewritten }] : []),
    ]);
  }, [setChar, setSkills, setInv, addLog]);

  // 世界观条目走关键词点灯那条路（跟人物同一个机制，见 registerImportedWorld 注释）
  const handleImportWorld = useCallback((items) => {
    const n = importedRegistry.registerImportedWorld(items, {});
    if (n) addLog([{ t: "sys", text: `  ${n} 条地理与规矩已入册，提到时自会浮现。` }]);
  }, [addLog]);

  // 装备/卸下。此前直接在 GlobalOverlays 里 setInv(toggleEquip(...))，
  // 为了记一笔计数不值当再穿一层 props，收拢到这儿——将来装备变更要加别的
  // 副作用（耐久、套装判定）也有地方放。
  const handleToggleEquip = useCallback((it) => {
    setInv(v => toggleEquip(v, it.id));
    noteAction("equipToggle");
  }, []);

  // ── 心灵之海 · 玄女点破 ──
  // "说过话"直接复用「对话即认识」的结果（commitRound 里 talkTarget/respondedNpcs
  // 会把人标记为已认识），不另造一套"聊过没"的记账。
  // 用 effect 而不是塞进对话结算里，是因为两个条件可能任意顺序满足：先攒够好感再去
  // 见她、或先见过她后来才攒够，两条路都要能触发。
  const seaReturnRef = useRef(null); // 进海之前站在哪，出来要送回去
  const tokyoReturnTimerRef = useRef(null);

  // ── 创伤线 · 安抚 ──
  // 五个动作全走这一个入口。计分与门槛判定都在 narratorQuest（纯函数），
  // 这里只负责落状态、写日志。**不调 AI**：这些是高频动作，每次烧一次调用不值当，
  // 且写死的反应更稳定，不会因为模型状态忽冷忽热。
  const handleComfort = useCallback((actionKey) => {
    const result = comfort(gameStore.getState(), actionKey);
    applyResult(featureCtxRef.current, result);
    if (result.changes) noteAction("comfort");
  }, []);

  // 换出战队友（单槽互斥；传 null 表示谁都不带）
  const handleSwitchCompanion = useCallback((key) => {
    applyResult(featureCtxRef.current, switchCompanion(gameStore.getState(), key));
    noteAction("companionSwitch");
  }, []);

  // ── 创伤线 · 收束（点破内核 + 承诺）──
  const handleResolveTrauma = useCallback(() => {
    applyResult(featureCtxRef.current, resolveTrauma(gameStore.getState()));
  }, []);

  // 进心灵之海：必须站在自己的安全屋里。这是一次纯前端传送，不调 AI、不消耗回合。
  const enterSeaOfMind = useCallback(() => {
    const state = gameStore.getState();
    const result = enterSeaLogic(state);
    if (result.changes) seaReturnRef.current = { room: state.room.name, inner: state.innerRoomName };
    applyResult(featureCtxRef.current, result);
    if (result.changes) {
      setTimeout(() => setInnerRoomName(SEA_OF_MIND.anchor), 0);
      noteAction("seaEnter");
    }
  }, []);

  // 出心灵之海：回到进来之前站的地方。
  const leaveSeaOfMind = useCallback(() => {
    const back = seaReturnRef.current || { room: "鱼定村", inner: null };
    const result = leaveSeaLogic(gameStore.getState(), back);
    applyResult(featureCtxRef.current, result);
    if (result.changes) setTimeout(() => setInnerRoomName(back.inner), 0);
  }, []);

  // 互动菜单读当前真值，而不是点开那一刻的快照。
  // 【为什么】activeNpcMenu 存的是点击时的对象引用；菜单开着的这段时间里
  // room.npcs 可能被驻场注入 effect 补上 carriedItems（那个 effect 按据点/换天触发）。
  // 用旧快照去偷窃/切磋，读到的 carriedItems 还是 undefined，于是表现为
  // "偷不到装备""切磋不掉东西"——而池子在 room.npcs 里明明已经有了。
  // 按名字重新取一次；取不到才退回快照（队友走 RightPanel 那条入口，
  // 它的对象本来就不在 room.npcs 里）。
  const liveNpcMenu = activeNpcMenu
    ? (room.npcs.find(n => n.name === activeNpcMenu.name) || activeNpcMenu)
    : null;

  const inSeaOfMind = room.name === SEA_OF_MIND.district;
  const seaGate = canEnterSea({ flags, varTree, districtName: room.name, innerRoomName });

  // ── 拜入雪山派 ──
  // 系统这边一次做完：扣束脩、发弟子令牌（同时是别院钥匙）、写身份 flag、
  // 标记认识何雨谢。AI 只负责把这件既成事实写成一段像样的入门叙事。
  // settleKind:"learn_skill" 复用授业那套铁律——拜入门派同样是"对方认可你、
  // 把你收进门里"，好感只该往上走。
  const handleJoinSect = useCallback(() => {
    const result = joinSect(gameStore.getState());
    if (result.changes) setActiveBuilding(null);
    applyResult(featureCtxRef.current, result);
  }, []);

  // ── 拍卖落槌 ──
  // AuctionScreen 里的竞价过程是纯前端状态机（auction.js），不调 AI；
  // 只有最终成交这一下才交给 AI 写一段叙事。
  const handleAuctionWin = useCallback((finalPrice) => {
    applyResult(featureCtxRef.current, auctionWin(gameStore.getState(), finalPrice));
  }, []);

  const composingRef = useRef(false); // 输入法组合态：中文/日文等 IME 正在拼字时为 true

  const onKey = (e) => {
    if (e.key === "Enter") {
      // 输入法组合态防护：用 IME 拼字时，回车是"确认候选词"而非"提交命令"。
      // 若此时提交并 setInput("")，会打断正在进行的 composition，造成"卡输入法"、
      // 或把半截未上屏的内容当命令发出去。英文直接键入没有 composition，正常提交不受影响。
      if (composingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229) return;
      if (interactMode === "pigeon") { sendPigeonLetter(pigeonTarget, input, { channel: "pigeon" }); return; }
      act(input); return;
    }
    if (e.key === "ArrowUp") { e.preventDefault(); if (cmdHistory.length) { const ni = Math.min(histIdx + 1, cmdHistory.length - 1); setHistIdx(ni); setInput(cmdHistory[ni]); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (histIdx > 0) { setHistIdx(histIdx - 1); setInput(cmdHistory[histIdx - 1]); } else { setHistIdx(-1); setInput(""); } return; }
  };

  // 日志文字配色（本轮补齐日间模式）：原来这套 clr 全部写死死死是暗夜配色，
  // 日间模式切换后完全不跟随——WCAG对比度实测在米色背景下几乎全部低于2.5
  // （正常阅读需要4.5+），叙事正文(desc)、地名(room)首当其冲。clrDay 保留
  // 每种类型的色相基因（错误依然是红系、对话依然是粉系……）但大幅拉深明度，
  // 全部核算达到4.5+对比度。
  const clrNight = { sys: "#5a8a5a", cmd: "#d4a853", desc: "#e8e4d6", room: "#c8323a", item: "#c4a040", stat: "#8ab4d4", skill: "#b48adf", err: "#c45044", choice: "#6aaa8a", narrator: "#d68a8a", crash: "#c45044", confess: "#c8663a", affection: "#f0a0c0", quest: "#c8663a" };
  const clrDay = { sys: "#2e5a2e", cmd: "#7a5c14", desc: "#3d3626", room: "#1e5a6a", item: "#7a5410", stat: "#1e4a6a", skill: "#5a3a7a", err: "#a02020", choice: "#2e6a4a", narrator: "#8a2a6a", crash: "#a02020", confess: "#8a5a0a", affection: "#a0305a", quest: "#8a5a0a" };
  const clr = isDayMode ? clrDay : clrNight;
  const zoneTheme = getZoneTheme(room.name, isDayMode);
  // 语义色日夜适配（藏地三色点缀体系，见 theme.js INK）——全文件统一从这组取，
  // 不再到处散写 #d68a8a/#c07050 这类"只有暗夜版"的硬编码（日间米色底下偏淡发灰）。
  const uiPink = ink("pink", isDayMode);       // 好感/私聊粉
  const uiGreen = ink("green", isDayMode);     // NPC名/对话绿
  const uiTurquoise = ink("turquoise", isDayMode); // 松石绿：设置/交互
  const uiGold = ink("gold", isDayMode);       // 鎏金：重要入口
  const uiCrimson = ink("crimson", isDayMode); // 绛红：警示
  // 顶栏按钮统一规格 topBtn() 已随顶栏一并内聚进 panels/TopBar.jsx（只有那里用）。
  const inkDivider = `linear-gradient(90deg, transparent, ${zoneTheme.border}, transparent)`;
  const S = {
    panel: { display: "flex", flexDirection: "column", borderRight: `1px solid ${zoneTheme.border}`, minWidth: 0, overflow: "hidden" },
    label: {
      padding: "10px 14px", color: zoneTheme.accentDim, fontSize: "11px", letterSpacing: "2px",
      borderBottom: "none", backgroundImage: `linear-gradient(180deg, transparent, transparent calc(100% - 1px), ${zoneTheme.border} calc(100% - 1px))`,
      flexShrink: 0,
    },
    scroll: { flex: 1, padding: "10px 16px", overflowY: "auto", overflowX: "hidden", fontSize: "12.5px", lineHeight: 1.8, wordBreak: "break-word" },
  };

  if (!apiCfg.apiKey) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a09", color: "#e8e4d6", fontFamily: "'Songti SC','STSong','SimSun',serif", padding: 24, textAlign: "center" }}>
        <div>
          <p style={{ color: "#c45044" }}>尚未配置 API Key</p>
          <p>点击下方按钮打开设置面板，填入你的 API Key 后即可开始游戏。</p>
          <span onClick={() => openOverlay(OVERLAY.SETTINGS)} style={{ cursor: "pointer", color: "#c8323a", padding: "6px 14px", background: "#161510", border: "1px solid #4a453c", borderRadius: 0, display: "inline-block", marginTop: 10 }}>⚙ 打开设置</span>
        </div>
        {showSettings && (
          <SettingsPanel
            onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
            cfg={apiCfg}
            setCfg={setApiCfg}
            onClose={() => closeOverlay(OVERLAY.SETTINGS)}
            currentSnapshot={buildCurrentSnapshot}
            onLoadSnapshot={applySnapshot}
            varTree={varTree}
            setVarTree={setVarTree}
            initialTab={settingsInitialTab}
            uiScale={uiScale}
            setUiScale={setUiScale}
            narrator={narrator}
            setNarrator={setNarrator}
          />
        )}
      </div>
    );
  }

  if (showCharCreate) {
    return <CharacterCreate onConfirm={({ name, gender, fromCard }) => {
      const createCharacter = () => {
        setChar(c => {
          const next = { ...c, name, gender };
          if (fromCard) {
            // 顺序要紧：七维先落，气血才能按体魄算对。反了就会用旧体魄算出错的上限。
            if (fromCard.special) next.special = { ...(c.special || {}), ...fromCard.special };
            if (fromCard.bodyProfile || fromCard.bodyProfilePrivate) {
              next.bodyProfile = { ...(c.bodyProfile || {}), ...(fromCard.bodyProfile || {}), ...(fromCard.bodyProfilePrivate || {}) };
            }
            if (Number.isFinite(fromCard.neigong)) next.neigong = fromCard.neigong;
            if (Number.isFinite(fromCard.waigong)) next.waigong = fromCard.waigong;
            const maxHp = hpFromNeigong(next.neigong ?? 5, next.special?.体魄 ?? 5);
            next.hp = [maxHp, maxHp];
          }
          return next;
        });
        // 主角卡的初始武学与装备（AI 现编/AI 配的那两项）。武学整套替换默认三脚猫拳，
        // setSkills 会触发 moveset 重算（见 skills 依赖的那个 effect）；装备追加进背包并
        // 自动穿上兵器/护具/饰物各一件。
        if (fromCard) {
          const cardResult = applyCharacterCard(gameStore.getState(), fromCard, "cc_");
          applyResult(featureCtxRef.current, cardResult);
          const n = cardResult.carriedCount;
          const sk = (fromCard.skills || []).length;
          if (fromCard.persona || sk || n) {
            addLog([{ t: "sys", text: `  （已按入册的角色卡定下体貌与天赋${sk ? `，带 ${sk} 门武学` : ""}${n ? `，${n} 件随身物已入包、装备已上身` : ""}）` }]);
          }
        }
        // 开局同行：开局向导指定了「1 人开局就随队」，在这里把它解锁进 companionState
        // （唯一出战位）。importedRegistry 的 getImportedNpc 返回入册时的完整档案，
        // unlockImportedCompanion 会 createImportedCompanion 建出可出战的队友。
        // 用完即清，避免下次新开局又凭空冒出来。
        const starterName = importedRegistry.getPendingStarterCompanion();
        if (starterName) {
          const npcData = importedRegistry.getImportedNpc(starterName);
          importedRegistry.clearPendingStarterCompanion();
          if (npcData) {
            setCompanionState(prev => unlockImportedCompanion(prev, npcData));
            addLog([{ t: "sys", text: `  （开局同行「${starterName}」已随队）` }]);
          }
        }
      };
      const scheduler = schedulerRef.current;
      if (scheduler) scheduler.runSilently(createCharacter);
      else createCharacter();
      scheduler?.resetPlayed();
      closeOverlay(OVERLAY.CHAR_CREATE);
    }} />;
  }

  if (showOpening) {
    return <OpeningSequence onFinish={() => {
      schedulerRef.current?.resetPlayed();
      closeOverlay(OVERLAY.OPENING);
    }} playerName={char.name} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: `${100 / uiScale}vh`, width: `${100 / uiScale}vw`, zoom: uiScale, background: zoneTheme.bg, color: zoneTheme.text, fontFamily: "'Songti SC','STSong','SimSun',serif", fontSize: "12.5px", overflow: "hidden", transition: "background 1.2s ease, color 1.2s ease" }}>

      <TopBar
        isMobile={isMobile} mobileTopMenu={mobileTopMenu} setMobileTopMenu={setMobileTopMenu}
        zoneTheme={zoneTheme} isDayMode={isDayMode} setIsDayMode={setIsDayMode}
        uiGold={uiGold} uiTurquoise={uiTurquoise} uiCrimson={uiCrimson} uiPink={uiPink}
        setSettingsInitialTab={setSettingsInitialTab}
        autoSaveError={autoSaveError} lastAutoSave={lastAutoSave}
        playerAvatarCustom={playerAvatarCustom} setPlayerAvatarCustom={setPlayerAvatarCustom}
        AV_BASE={AV_BASE} genderAvatar={genderAvatar}
      />

      {showMusicPanel && <MusicPanel onClose={() => closeOverlay(OVERLAY.MUSIC_PANEL)} />}
      {showHomestead && innerRoomName && getHomestead(innerRoomName) && (
        <HomesteadPanel
          roomName={innerRoomName} inv={inv} setInv={setInv}
          char={char} setChar={setChar} zoneTheme={zoneTheme}
          onClose={() => closeOverlay(OVERLAY.HOMESTEAD)} addLog={addLog}
        />
      )}

      <GlobalOverlays
        zoneTheme={zoneTheme} isDayMode={isDayMode}
        char={char} setChar={setChar} inv={inv} setInv={setInv} skills={skills}
        varTree={varTree} room={room} innerRoomName={innerRoomName} time={time}
        flags={flags} questProgress={questProgress}
        effectiveSpecialNow={effectiveSpecialNow} companionState={companionState}
        loading={loading} pendingTalks={pendingTalks} waitSecs={waitSecs} addLog={addLog}
        characterPageTarget={characterPageTarget} setCharacterPageTarget={setCharacterPageTarget}
        claimedMilestones={claimedMilestones} claimMilestone={claimMilestone} giftToCharacter={giftToCharacter}
        narratorStage={narrator.stage}
        onImportNpcs={handleImportNpcs} onImportPlayer={handleImportPlayer}
        onImportWorld={handleImportWorld}
        portraits={portraits} setPortraits={setPortraits}
        buildBugReportTurns={buildBugReportTurns}
        activeNpcMenu={liveNpcMenu} setActiveNpcMenu={setActiveNpcMenu}
        handleNpcLook={handleNpcLook} handleNpcTalk={handleNpcTalk} handleNpcGift={handleNpcGift}
        handleNpcDuel={handleNpcDuel} handleNpcSteal={handleNpcSteal}
        handleNpcLearnSkill={handleNpcLearnSkill} handleNpcTrade={handleNpcTrade}
        handleInviteCompanion={handleInviteCompanion}
        activeItemMenu={activeItemMenu} setActiveItemMenu={setActiveItemMenu}
        inspectItem={inspectItem} handleConsumeItem={handleConsumeItem} handleCollectGround={handleCollectGround} handleToggleEquip={handleToggleEquip}
        activePersuasion={activePersuasion} setActivePersuasion={setActivePersuasion}
        apiCfg={apiCfg} persuasionProgress={persuasionProgress} setPersuasionProgress={setPersuasionProgress}
        forceAdvanceQuest={forceAdvanceQuest}
        duelingNpc={duelingNpc} setDuelingNpc={setDuelingNpc}
        setPendingQuestBranch={setPendingQuestBranch} duelFinishHandler={duelFinishHandler}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

        {/* 手机抽屉遮罩：点击关闭 */}
        {isMobile && mobileDrawer && (
          <div onClick={() => setMobileDrawer(null)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,.55)" }} />
        )}

        <LeftPanel
          isMobile={isMobile} mobileDrawer={mobileDrawer} setMobileDrawer={setMobileDrawer}
          zoneTheme={zoneTheme} S={S}
          room={room} innerRoomName={innerRoomName} time={time}
          varTree={varTree} char={char}
          peoplePanel={peoplePanel} setPeoplePanel={setPeoplePanel}
          activeBuilding={activeBuilding} setActiveBuilding={setActiveBuilding}
          setActiveItemMenu={setActiveItemMenu}
          setActiveNpcMenu={setActiveNpcMenu}
          setCharacterPageTarget={setCharacterPageTarget}
          setPigeonTarget={setPigeonTarget} setInteractMode={setInteractMode} inputRef={inputRef} addLog={addLog}
          pigeonTarget={pigeonTarget}
          portraits={portraits} portraitTarget={portraitTarget} setPortraitTarget={setPortraitTarget}
          interactMode={interactMode} activeTarget={activeTarget} talkTarget={talkTarget}
          playerAvatar={playerAvatar}
          slImgErr={slImgErr} setSlImgErr={setSlImgErr} slForm={slForm} setSnowLeopardForm={setSnowLeopardForm} setSlFormState={setSlFormState}
          pearlForm={pearlForm} setPearlForm={setPearlForm} setPearlFormState={setPearlFormState} pearlImgErr={pearlImgErr} setPearlImgErr={setPearlImgErr}
          narratorAffection={narrator.affection} narratorImgErr={narratorImgErr} setNarratorImgErr={setNarratorImgErr}
          companionState={companionState}
          mapView={mapView} setMapView={setMapView} mapBig={mapBig} setMapBig={setMapBig}
          mapData={mapData} questProgress={questProgress} flags={flags} inv={inv}
          inSeaOfMind={inSeaOfMind} seaGate={seaGate} enterSeaOfMind={enterSeaOfMind} leaveSeaOfMind={leaveSeaOfMind}
          loading={loading} act={act} autoTravelTo={autoTravelTo}
          uiGreen={uiGreen} uiPink={uiPink}
        />

        <CenterPanel
          isMobile={isMobile} mobileDrawer={mobileDrawer} setMobileDrawer={setMobileDrawer}
          zoneTheme={zoneTheme} S={S}
          loading={loading} setLoading={setLoading} addLog={addLog}
          undoSnapshotRef={undoSnapshotRef} applySnapshot={applySnapshot}
          gm={gm} setGm={setGm}
          char={char} setChar={setChar} pot={pot} setPot={setPot} exp={exp} setExp={setExp}
          dao={dao} setDao={setDao}
          varTree={varTree} setVarTree={setVarTree} narrator={narrator} setNarrator={setNarrator}
          room={room} innerRoomName={innerRoomName}
          mapData={mapData} setMapData={setMapData} setRoom={setRoom} setInnerRoomName={setInnerRoomName}
          setInteractMode={setInteractMode} act={act} teleportLookRef={teleportLookRef}
          setSkills={setSkills} setInv={setInv}
          duelPending={duelPending} confirmDuel={confirmDuel} cancelDuel={cancelDuel}
          activeBuilding={activeBuilding} setActiveBuilding={setActiveBuilding}
          tradingShop={tradingShop} setTradingShop={setTradingShop}
          buildingPanelMinimized={buildingPanelMinimized} setBuildingPanelMinimized={setBuildingPanelMinimized}
          handleBuildingInn={handleBuildingInn} handleBuildingHeal={handleBuildingHeal}
          skills={skills} handleBuySkill={handleBuySkill}
          time={time} inv={inv} effectiveSpecialNow={effectiveSpecialNow}
          inspectItem={inspectItem} jotNote={jotNote}
          flags={flags} questProgress={questProgress}
          handleAcceptEscort={handleAcceptEscort} handleGamble={handleGamble}
          handleCollectPigeons={handleCollectPigeons} buyPigeon={buyPigeon}
          handlePostSend={handlePostSend} handleTravel={handleTravel}
          handleServiceOrder={handleServiceOrder}
          handlePray={handlePray} handleReadBook={handleReadBook} handleBuyBook={handleBuyBook}
          deposit={deposit} depositedAt={depositedAt} handleDeposit={handleDeposit} handleWithdraw={handleWithdraw}
          pledgedItems={pledgedItems} handlePledge={handlePledge} handleRedeem={handleRedeem}
          handleAcceptBounty={handleAcceptBounty} handleClaimBounty={handleClaimBounty}
          handleForgeCommission={handleForgeCommission} handleForgeDesign={handleForgeDesign}
          handleJadeDesign={handleJadeDesign} handleJadeCraft={handleJadeCraft}
          gambleNegotiation={gambleNegotiation} handleGambleTalk={handleGambleTalk}
          handleGambleSettle={handleGambleSettle} handleGambleInspect={handleGambleInspect}
          handleListenRumor={handleListenRumor}
          handleJoinSect={handleJoinSect} handleAuctionWin={handleAuctionWin}
          handleCook={handleCook}
          seaTraumaActive={narrator.stage === NNPC_STAGE.SEA_CRASHED && room.name === SEA_OF_MIND.district}
          narratorVarsNow={narratorVars(varTree)}
          invNames={inv.map(i => (typeof i === "string" ? i : i?.name)).filter(Boolean)}
          handleComfort={handleComfort} handleResolveTrauma={handleResolveTrauma}
          sectMasterAffection={varTree.角色?.[SECT_ENTRY.master]?.好感度 ?? 0}
          log={log} isDayMode={isDayMode} clr={clr}
          collapsedGroups={collapsedGroups} setCollapsedGroups={setCollapsedGroups}
          queueCount={queueCount} pendingTalks={pendingTalks} inspecting={inspecting}
          logEnd={logEnd} waitSecs={waitSecs}
          availableQuestsHere={availableQuestsHere}
          triggerQuestFromPanel={triggerQuestFromPanel} triggerQuestChoice={triggerQuestChoice}
          uiGreen={uiGreen} uiPink={uiPink} uiCrimson={uiCrimson}
          nsfwOn={nsfwOn} setNsfwOn={setNsfwOn}
          meditate={meditate} justMeditated={justMeditated}
          interactMode={interactMode} activeTarget={activeTarget} setActiveTarget={setActiveTarget}
          setTalkTarget={setTalkTarget}
          pigeonTarget={pigeonTarget} setPigeonTarget={setPigeonTarget} pigeonDelayShichen={pigeonDelayShichen}
          input={input} setInput={setInput} inputRef={inputRef} onKey={onKey} composingRef={composingRef}
        />

        <RightPanel
          isMobile={isMobile} mobileDrawer={mobileDrawer} setMobileDrawer={setMobileDrawer}
          zoneTheme={zoneTheme} S={S}
          char={char} inv={inv} skills={skills} exp={exp} pot={pot}
          playerAvatar={playerAvatar}
          companionState={companionState} onSwitchCompanion={handleSwitchCompanion} slForm={slForm} setSnowLeopardForm={setSnowLeopardForm} setSlFormState={setSlFormState} slImgErr={slImgErr} setSlImgErr={setSlImgErr}
          pearlForm={pearlForm} setPearlForm={setPearlForm} setPearlFormState={setPearlFormState} pearlImgErr={pearlImgErr} setPearlImgErr={setPearlImgErr}
          trainNeigong={trainNeigong} trainWaigong={trainWaigong} trainCost={trainCost}
          effectiveSpecialNow={effectiveSpecialNow} activeBuffs={activeBuffs}
          varTree={varTree}
          setActiveNpcMenu={setActiveNpcMenu}
          setSkills={setSkills} inspectItem={inspectItem} inspecting={inspecting}
          breakthroughSkill={breakthroughSkill}
          setActiveItemMenu={setActiveItemMenu}
          narrator={narrator} confessToNarrator={confessToNarrator}
          setInv={setInv}
        />

      </div>

      {mapBig && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={mapBigCloseGuard.onMouseDown} onClick={mapBigCloseGuard.onClick}>
        <div style={{
          background: `url("${MAP_UI.scroll}") center/100% 100% no-repeat`,
          borderRadius: 0, minWidth: 300, width: "70vw", maxWidth: 980, maxHeight: "86vh",
          // 卷轴四周是木轴+锦缎装帧，中央才是可用纸面（约占 78%）。用大内边距把
          // 标题栏与节点图推进纸面留白区，避免压到装帧木轴上。
          padding: "8% 11% 9% 11%", boxSizing: "border-box",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#4a3520", fontSize: "13px", fontWeight: "bold" }}>{mapView === "inner" ? `村图·${room.name}内景全图` : "舆图·曲措乡全境"} <span style={{ color: "#7a6448", fontSize: "10px", fontWeight: "normal" }}>{mapView === "inner" ? "朱红为当前所在 · 点相邻房间前往" : "朱红为当前所在 · 点已探明据点自动前往 · 🔒需前置"}</span></span>
            <span style={{ color: "#6a4a2a", fontSize: "11px", cursor: "pointer", fontWeight: "bold" }} onClick={() => setMapBig(false)}>× 关闭</span>
          </div>
          {/* ── 放大 = 完整拓扑全图（ClickableMap），不再是把九宫格放大一遍 ──
              小地图（右栏）看的是"我周围八格怎么走"，放大看的是"整片江湖长什么样、
              我在哪、还有哪没去过"。两者信息量本该不同，此前都渲染 NineGridMap，
              放大等于什么也没多给。外层画 13 据点全拓扑，内层画本据点全部内景房间。 */}
          {mapView === "outer" && (() => {
            const completed = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
            const exitByDir = QUCUO_MAP[room.name]?.exits || {};
            const reachableDests = new Set(Object.values(exitByDir));
            // ── 只画"走过的地方" ──
            // 舆图是玩家自己一步步走出来的图，因此**只渲染已探明节点**，不画未探明的问号。
            // 若把 13 个据点连同未探明的一起摆在真坐标上，等于一开局就把整张图的疆域、
            // 有几个据点、各自在哪全泄露了——地图的边界不该被暗示。探索仍归右栏那张
            // 九宫格：它以玩家为中心、无限延展，天然不透露"世界有多大、到哪为止"。
            const explored = new Set(Object.keys(mapData || {}));
            explored.add(room.name);
            const nodes = Object.entries(QUCUO_MAP)
              .filter(([name]) => explored.has(name))
              .map(([name, node]) => {
              const dirTo = Object.entries(exitByDir).find(([, d]) => d === name)?.[0] || null;
              const unlocked = isNodeUnlocked(name, { completedQuests: completed, flags });
              return {
                name, x: node.x, y: node.y, explored: true,
                current: name === room.name,
                // 连线也只连已探明的两端，免得一条线指向图外某个未知点、变相暴露那里有东西
                links: Object.values(node.exits || {}).filter(d => explored.has(d)),
                reachable: name !== room.name && unlocked,
                locked: reachableDests.has(name) && !unlocked,
                dir: dirTo, dest: name,
              };
            });
            const go = (dir, dest, locked) => {
              if (loading) return;
              setMapBig(false);
              if (locked) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" }); return; }
              if (dest && mapData[dest] && dest !== room.name) { autoTravelTo(dest); return; }
              if (dir) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" }); }
            };
            return <ClickableMap nodes={nodes} onGo={go} accent={zoneTheme.accent} loading={loading} maxHeight="66vh" />;
          })()}
          {mapView === "inner" && (() => {
            if (!hasInnerMap(room.name)) return <div style={{ color: zoneTheme.textDim }}>此地无内景可绘。</div>;
            const curRoom = innerRoomName || getDistrictAnchor(room.name);
            // 上锁房间（安全屋等）要连"名字"都不出现在放大地图上——内层虽不设战争
            // 迷雾，但没钥匙的门后是什么不该被剧透。visibleInnerExits 已按 inv/flags
            // 滤过出口，这里再把房间列表本身也滤一遍。
            const curExits = visibleInnerExits(room.name, curRoom, { questProgress, flags, inv, char });
            const adjacent = new Set(Object.values(curExits));
            const nodes = getInnerRoomNames(room.name).filter((rn) => {
              const rr = getInnerRoom(room.name, rn);
              return !rr?.unlockCondition || rr.unlockCondition.type === "stat" || isInnerExitUnlocked(rr.unlockCondition, { questProgress, flags, inv, char });
            }).map((rn) => {
              const r = getInnerRoom(room.name, rn) || {};
              const dirTo = Object.entries(curExits).find(([, d]) => d === rn)?.[0] || null;
              return {
                name: rn, x: r.x ?? 0, y: r.y ?? 0, explored: true,
                current: rn === curRoom,
                links: Object.values(r.exits || {}).filter(d => typeof d === "string"),
                reachable: adjacent.has(rn),
                dir: dirTo, dest: rn,
              };
            });
            const go = (dir) => { if (!loading && dir) { setMapBig(false); setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); } };
            return <ClickableMap nodes={nodes} onGo={go} accent="#c07050" loading={loading} maxHeight="66vh" />;
          })()}
        </div>
      </div>}

      {showSettings && (
        <SettingsPanel
          onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
          cfg={apiCfg}
          setCfg={setApiCfg}
          onClose={() => closeOverlay(OVERLAY.SETTINGS)}
          currentSnapshot={buildCurrentSnapshot}
          onLoadSnapshot={applySnapshot}
          varTree={varTree}
          setVarTree={setVarTree}
          initialTab={settingsInitialTab}
          uiScale={uiScale}
          setUiScale={setUiScale}
          narrator={narrator}
          setNarrator={setNarrator}
          getLiveBlockText={getLiveBlockText}
        />
      )}

      {showBody && (
        <BodyProfilePanel
          profile={char.bodyProfile || emptyBodyProfile()}
          onChange={(next) => setChar(c => ({ ...c, bodyProfile: next }))}
          onClose={() => closeOverlay(OVERLAY.BODY)}
          zoneTheme={zoneTheme}
          nsfwOn={nsfwOn}
          onRecommend={recommendOutfit}
          recommendState={outfitState}
        />
      )}


      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${zoneTheme.border};border-radius:2px}
        ::selection{background:${zoneTheme.accentDim}}
        input::placeholder{color:${zoneTheme.textDim}}
        .log-streaming{opacity:0.92}
        .qbtn{transition:filter .15s ease,border-color .15s ease}
        .qbtn:hover{filter:brightness(1.25)}
      `}</style>
    </div>
  );
}
