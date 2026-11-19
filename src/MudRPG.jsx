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
import { buildInitialGameState, DEFAULT_PRESETS } from "./core/newGame.js";
import { applyResult } from "./features/run.js";
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
  recognizeNpc,
  settleNpcDuel,
  stealFromNpc,
  talkToNpc,
  tradeWithNpc,
} from "./features/npc/logic.js";
import {
  applyPigeonReply,
  buyPigeon as buyPigeonLogic,
  collectPigeons as collectPigeonsLogic,
  failPigeonReply,
  pigeonDelayShichen as pigeonDelayShichenLogic,
  processPigeons,
  recordPigeonNpcLocations,
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
import { loadConfig, saveConfig, callModel, callModelStream, cleanJsonString, getPipelineLog, classifyError } from "./apiConfig.js";
import { startTrace, step as traceStep, endTrace, getTraceLog, clearTraceLog, formatTrace, attachPipeline, attachExtractionPipeline, attachInjectionSnapshot, fmtMs } from "./actionTrace.js";
import SettingsPanel from "./SettingsPanel.jsx";
import LogEntry from "./LogEntry.jsx";
import LoreScreen from "./LoreScreen.jsx";
import { initialVarTree, extractMvuBlock, applyMvuCommands, npcAffectionLabel, reputationLabel } from "./mvu.js";
import { QUALITY, QUALITY_COLOR, ITEM_CATEGORY, CATEGORY_LABEL, makeItem, getEquipped, toggleEquip, rollQuality, computeEquippedStats, effectiveSpecial } from "./equipment.js";
import { effectiveMaxHp } from "./kungfu/qucuoKungfu.js";
import { effectBrief } from "./itemEffectText.js";
import { makeItemSmart, describeCatalogForAI, useConsumable, CATALOG_INDEX, CATALOG, makeCatalogItem } from "./items/catalog.js";
// 具名优先的物品生成：AI 发放/掉落/购买的物品名若命中百物录，吃具名的专属
// 数值+特效+六维；否则回退 equipment.makeItem 匿名公式。全项目物品生成走这个。
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

// 入册主角卡的随身物(carry)→背包物品(inv)。carry 的元素两形态：在册物是名字字符串，
// 自造物是完整对象（跟 CarryPicker 存的一致）。都过 makeGameItem 补全数值/词条，配
// 唯一 id。兵器/护具/饰物各把品阶最高的一件标为 equipped（开局即战力，见玩家选择）。
function cardCarryToInvItems(carry, seed = "") {
  const items = (carry || [])
    .map((c, i) => {
      const spec = typeof c === "string" ? { name: c } : c;
      const base = makeGameItem(spec);
      if (!base || !base.name) return null;
      return { ...base, id: `cardcarry_${seed}${i}`, equipped: false, stolen: false };
    })
    .filter(Boolean);
  for (const cat of [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY]) {
    const ofCat = items.filter(it => it.category === cat);
    if (!ofCat.length) continue;
    ofCat.sort((a, b) => QUALITY.indexOf(b.quality) - QUALITY.indexOf(a.quality));
    ofCat[0].equipped = true;
  }
  return items;
}

// 把入册主角卡的技能/装备并进现有 skills / inv。用在开局(CharacterCreate)与游戏中入册
// 两条路径，逻辑一致：武学有就整套替换（覆盖默认三脚猫拳），装备追加进背包并按类别
// 自动穿上最好的一件（同类别的旧装备先卸下，免得两把兵器同时算进战力）。
function applyCardSkills(fromCard, setSkills) {
  if (Array.isArray(fromCard?.skills) && fromCard.skills.length) {
    setSkills(fromCard.skills.map(s => ({ ...s })));
  }
}
function applyCardCarry(fromCard, setInv, seed = "") {
  const cardItems = cardCarryToInvItems(fromCard?.carry, seed);
  if (!cardItems.length) return 0;
  const takenCats = new Set(cardItems.filter(i => i.equipped).map(i => i.category));
  setInv(prev => {
    const base = (prev || []).map(it =>
      (it && typeof it === "object" && it.equipped && takenCats.has(it.category)) ? { ...it, equipped: false } : it);
    return [...base, ...cardItems];
  });
  return cardItems.length;
}

import { getZoneTheme, ink } from "./theme.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";
import CodexScreen from "./CodexScreen.jsx";
import BugReportModal from "./BugReportModal.jsx";
import { QUCUO_MAP, getMapNode, resolveExit, isNodeUnlocked, buildDirectionJudgeRequest, parseDirectionJudgeResponse } from "./qucuoMap.js";
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
import { classifyIntent, buildBudgetInstruction, INTENT } from "./inputIntent.js";
import NpcActionMenu from "./NpcActionMenu.jsx";
import ItemActionMenu from "./ItemActionMenu.jsx";
import { ensureNpcCombatData, generateNpcMoveset, MOVE_POOL, hpFromNeigong } from "./npcGeneration.js";
import { detectNewFaces, markAsSeen, markNpcAsKnown, isNpcKnown, detectReunions, buildReunionBlock, updateLastSeen, REUNION_GAP_THRESHOLD } from "./npcAwareness.js";
import TradingScreen from "./TradingScreen.jsx";
import { recordRumoredNpcs, findTargetedRumor, clearRumor } from "./npcEmergence.js";
import { rollEncounter } from "./encounter.js";
import { evolveKnowledge, buildInfoDomainBlock, factSummaryRequestFromRecall, registerFact, witnessFact, allFactSummaries } from "./knowledge.js";
import { findQuestByGiver, NPC_TEACHABLE_SKILLS, QUCUO_QUESTS } from "./quests/qucuoQuests.js";
import { QUEST_TYPE } from "./quests/questTypes.js";
import { MODE_PRIMER_MESSAGES, NSFW_RULES } from "./modePrimer.js";
import { labelMessage, makeBlock } from "./tavernMapping.js";
import { createQuestProgress, getCurrentStage, advanceQuestStages, lockExclusiveSiblings, canBypassExclusive, isQuestGateOpen } from "./quests/questEngine.js";
import { getQuestScript } from "./quests/questScripts.js";
import { resolveEnding } from "./quests/endingResolver.js";
import { initKeyItemTracking, transferKeyItem, getKeyItemState } from "./quests/itemTracking.js";
import { resolveStageRewards, applyStageRewards } from "./quests/questRewards.js";
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
import { buildExtractionCfg, forgeDesign } from "./extractionEngine.js";
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
import { parseActiveBuffs, makeBuffFlag, applyBuffsToSpecial, activeBuffsWithRemaining, mergeCombatBuff } from "./utils/buffSystem.js";
import { buildSysBase } from "./sysBase.js";
import { DIRS, bar, STAGE_TO_QUALITY, DIR_DXY, parseDir, getTimeStr } from "./utils/mudHelpers.js";
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
import { innerMove as innerMoveLogic, outerArrival as outerArrivalLogic, planAutoTravel } from "./features/map/logic.js";
import { learnNpcSkill as learnNpcSkillLogic } from "./features/npc/logic.js";
import { resolveOuterLock } from "./act/outerMove.js";
import { judgeCollect } from "./act/roundNotes.js";
import { createPromptContext } from "./engine/prompt/index.js";
import { getCompanionDescForm } from "./companionForms.js";
import { playTurn } from "./engine/playTurn.js";
import {
  consumeArrival, getLookText, burnSquare, serializeSquares,
} from "./mapSquares.js";

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
  const effectiveSpecialNow = effectiveSpecial(applyBuffsToSpecial(char.special, flags, time), inv, skills);
  // 有效气血上限 = 存档 hp[1] + 内功被动。面板显示与各处回血封顶都走它。
  const maxHpNow = effectiveMaxHp(char.hp[1], skills);
  const activeBuffs = activeBuffsWithRemaining(flags, time);
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
  const pigeonProcessing = useRef(new Set()); // 防止同一封回信被 [time]/varTree effect 重复生成
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

  useEffect(() => {
    if (forcedDuelNpc) {
      setDuelingNpc(forcedDuelNpc);
      setForcedDuelNpc(null);
    }
  }, [forcedDuelNpc]);

  const localCmd = useCallback((cmd) => {
    const c = cmd.trim().toLowerCase();
    if (c === "help" || c === "帮助") {
      return [
        { t: "sys", text: "── 命令列表 ──" },
        { t: "sys", text: "  look/l        查看房间" },
        { t: "sys", text: "  n/s/e/w/u/d   移动" },
        { t: "sys", text: "  look <目标>   查看NPC/物品" },
        { t: "sys", text: "  kill <NPC>    攻击" },
        { t: "sys", text: "  ask <NPC> about <话题>  对话" },
        { t: "sys", text: "  get/drop <物品>  拿/丢" },
        { t: "sys", text: "  wear/wield <物品>  穿/持" },
        { t: "sys", text: "  eat/drink <物品>  吃喝" },
        { t: "sys", text: "  用/服 <丹药>  服用消耗品（回血等，探索态即时结算）" },
        { t: "sys", text: "  practice <武功>  运功修炼" },
        { t: "sys", text: "  ◈行动/◎对话/◆私聊旁白 三态切换：行动消耗回合，对话与私聊不消耗回合" },
        { t: "sys", text: "  对话模式下只能和房间里的人说话，不能移动或战斗" },
        { t: "sys", text: "  ⊙ 打坐：消耗1回合，恢复部分气血" },
        { t: "sys", text: "  hp/状态  i/背包  skills/武功" },
        { t: "sys", text: "  或输入任意动作，引擎会处理。" },
      ];
    }
    if (c === "hp" || c === "状态") {
      const sp = char.special || {};
      const eff = effectiveSpecialNow;
      // 有 buff 加成的维度显示"基础→有效"，没加成的只显示数值
      const sevenDimLine = Object.entries(sp).map(([k, v]) => {
        const ev = eff[k] ?? v;
        return ev !== v ? `${k}${v}→${ev}` : `${k}${v}`;
      }).join(" ");
      const buffLines = activeBuffs.length
        ? [{ t: "stat", text: `  丹药药力：${activeBuffs.map(b => `${b.attr}+${b.val}(余${b.remaining}回合)`).join("、")}` }]
        : [];
      return [
        { t: "sys", text: "── 状态 ──" },
        // 上限走 maxHpNow（含内功被动）。此前这里读裸 hp[1]，而客栈住宿已经按
        // effectiveMaxHp 把当前血回满，于是回满之后显示成「135/100」，血条还溢出格子。
        { t: "stat", text: `  气血 ${bar(char.hp[0], maxHpNow)} ${char.hp[0]}/${maxHpNow}` },
        { t: "stat", text: `  内功 ${bar(char.neigong ?? 0, 100)} ${char.neigong ?? 0}/100` },
        { t: "stat", text: `  外功 ${bar(char.waigong ?? 0, 100)} ${char.waigong ?? 0}/100` },
        { t: "sys", text: "── 根骨悟性体魄魅力智谋身法气运 ──" },
        { t: "stat", text: `  ${sevenDimLine || "（无数据）"}` },
        ...buffLines,
        { t: "stat", text: `  经验 ${exp}  潜能 ${pot}` },
      ];
    }
    if (c === "i" || c === "背包" || c === "inventory") {
      return [{ t: "sys", text: "── 包袱 ──" }, ...inv.map(i => {
        if (typeof i === "string") return { t: "item", text: `  · ${i}` };
        const eq = i.equipped ? "[已装备] " : "";
        return { t: "item", text: `  · ${eq}${i.name}（${i.quality}）` };
      }), inv.length === 0 ? { t: "sys", text: "  （空空如也）" } : null].filter(Boolean);
    }
    if (c === "skills" || c === "武功") {
      return [{ t: "sys", text: "── 武学 ──" }, ...skills.map(s => ({ t: "skill", text: `  ${s.active ? "▶" : "○"} ${s.name}·${s.stage || "完整"}（${s.quality || "白"}品）` }))];
    }
    if (c === "eq" || c === "装备") {
      const cats = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY];
      return [
        { t: "sys", text: "── 装备 ──" },
        ...cats.map(cat => {
          const items = getEquipped(inv, cat);
          const label = CATEGORY_LABEL[cat];
          return { t: "item", text: `  ${label}：${items.length ? items.map(i => `${i.name}(${i.quality})`).join("、") : "无"}` };
        }),
      ];
    }
    return null;
  }, [char, inv, skills, exp, pot, effectiveSpecialNow, activeBuffs]);

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

  const act = useCallback(async (rawCmd, extraReplies = [], opts = {}) => {
    if (!rawCmd.trim()) return;
    const cmd = rawCmd.trim();

    // 移动防连点：方向按钮/九宫格点击带 forceLayer。内层移动是瞬时的（不设 loading），
    // 手抖或误触双击会在极短时间内连发两次——第二次时 innerRoomName 可能已变、或穿到外层
    // 触发一次多余的 AI 调用（表现为"点一下却出现两个北、还卡在引擎运转"）。300ms 内的重复
    // 移动直接忽略。只拦移动，不影响对话/私聊（那些走 pendingTalks 允许并发）。
    if (opts.forceLayer) {
      const now = Date.now();
      if (now - lastMoveRef.current < 300) return;
      lastMoveRef.current = now;
    }

    // 回滚点：每次实际行动前，存一份当前整局快照，供玩家"回滚一步"。只在真正要执行行动时存
    // （whisper 私聊上面已 return，不算行动步）。存的是"这步之前"的状态，回滚即还原到落子前。
    try { undoSnapshotRef.current = buildCurrentSnapshot(); } catch (e) { /* 存快照失败不阻断行动 */ }

    if (interactMode === "whisper") {
      // 私聊串行：一条还在跑时不允许真的发出第二条——否则两条并发会读到同一份
      // 发送前的 convo（历史一样），且流式占位用的 logIdx.current 是共享 ref，两条
      // 回调互相踩踏，表现为"日志一下出两条/重复"。用 talkBusyRef（同步 ref，不等
      // re-render）挡住极快连点；输入框允许预打字，只拦实际发送。不 startTrace
      // （避免与 talkToNarrator 内部完整 trace 重复的空壳记录）。
      if (talkBusyRef.current || pendingTalks > 0) {
        addLog([{ t: "sys", text: "  旁白还在回话，稍候再说下一句。" }]);
        return;
      }
      talkBusyRef.current = true;
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      // 教程任务「四宅家产」触发点之三：跟旁白聊到溪边小屋（幂等）
      if (/溪边小屋/.test(cmd)) setFlags(f => f.includes("tutorial_estate_started") ? f : [...f, "tutorial_estate_started"]);
      talkToNarrator(cmd); // 不 await；串行由 talkBusyRef 闸门保证
      return;
    }

    // 方向按钮点击时会带 opts.forceLayer（inner/outer），这是明确的"我要移动"信号——
    // 即便此刻交互模式停在"对话"，也必须按移动处理，不能被当成对话发给 AI（否则点
    // 移动按钮却因为模式是对话，整个移动判定被跳过、room.name 不变，表现为"外层走
    // 路变不了"）。所以有 forceLayer 时强制 isTalk=false。
    const isTalk = interactMode === "talk" && !opts.forceLayer;

    // ── 结算轮（绿灯·批一，见 docs/开发_挂载分级与蓝绿灯设计.md §三）──
    // 各建筑面板（住店/求医/送礼/买卖/存取/当押/赌坊/打醮/接交任务/赌石成交…）在调 act 之前，
    // 系统已把钱扣完、物入袋、flag 置好——AI 对状态没有任何裁量权，只负责把这件既定事实
    // 写成一段好看的正文。这类轮次以前统统走 full 档（物件志+认知隔离+全量schema+MVU+世界观全文），
    // 现在切到 settle 轻档。创造模式除外（gm 下玩家是神，要保留全量能力）。
    const isSettle = !!opts.settle && !gm;

    // 意图分类：本地正则判断这句输入的性质，决定这次调用该给多长的篇幅。
    // 对话模式（isTalk）下不分类——对话模式本来就是"跟NPC说话"这个单一意图，
    // 不需要再区分是元问题还是战斗；只有行动模式的自由输入才需要分类。
    const intent = isTalk ? INTENT.UNKNOWN : classifyIntent(cmd);

    // 行动分层日志：为这次行动开一条 trace，沿途各层记录通过/拦截/失败，
    // act 收尾时归档。可在「📋 Pipeline」旁的「🧭行动日志」查看，用于排查
    // "移动没生效/在场名单不对/说服不中"这类问题究竟卡在哪一层。
    const _trace = startTrace(cmd, rawCmd);
    traceStep(_trace, "意图分类", "pass", `模式=${isTalk ? "对话" : "行动"} · 意图=${intent?.label || intent || "未知"}`);

    // 元问题（help/怎么玩/你是谁/卡住了等，regex 精确命中的那几种写法）本地直接
    // 兜底回答，不占旁白的一次生成——玩家问"这游戏怎么玩"要的是准确的操作说明，
    // 不是角色扮演式的拒答，之前全丢给LLM去演"旁白不该被问"，新玩家真按 help
    // 反而什么帮助都得不到。这里不排队、不消耗回合、不调API，秒回。
    // 没被 regex 精确命中的模糊写法（比如"找个人""刷新npc"）不受影响，
    // 依然走 UNKNOWN 交给 narrator.js 里那套"该不该打断"的判断去演绎。
    if (!isTalk && intent.code === "META_QUERY") {
      addLog([{ t: "cmd", text: `> ${cmd}` }]);
      setInput("");
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      addLog([
        { t: "sys", text: "  ▸ 方向 n/s/e/w 移动 · look 查看 · 输入框上方可切换「◈行动 / ◎对话 / ◆私聊旁白」三种模式" },
        { t: "sys", text: "  ▸ 对话模式：只跟房间里的人说话，不移动、不消耗回合；私聊旁白：直接找旁白聊天，同样不消耗回合" },
        { t: "sys", text: "  ▸ 完整玩法说明见右上角 ⚙ 设置 →「玩法说明」" },
      ]);
      return;
    }

    // ── 查看/环顾：当前据点有预跑好的格子文本时纯前端秒回 ──
    // 预跑已写好环顾文本（lookText），不必再劳烦旁白 AI 复述一遍。
    // 格子未就绪（预跑失败）则穿透回下方原有 AI 路径。
    if (!isTalk && intent.code === "LOOK" && QUCUO_MAP[room.name]) {
      const lookText = getLookText(room.name, Math.floor(time / 24));
      if (lookText) {
        addLog([{ t: "cmd", text: `> ${cmd}` }]);
        setInput("");
        setCmdHistory(p => [cmd, ...p].slice(0, 50));
        setHistIdx(-1);
        addLog([{ t: "desc", text: "  " + lookText }]);
        traceStep(_trace, "查看", "pass", "格子预成文本，纯前端秒回");
        endTrace(_trace, "查看（纯前端）");
        setTime(t => t + 1);
        setConvo([...convo, { role: "user", content: cmd }, { role: "assistant", content: lookText.slice(0, 500) }]);
        return;
      }
    }

    // ── 调试指令：#testscript <任务id> <flag> ──（本轮新增，仅供本地测试）
    // 手动模拟"AI这一轮返回了这个flag"，直接跑一遍台本夺舍判断，
    // 不需要真的调AI、不需要精心构造存档去赌AI会不会吐出这个flag——
    // 用于验证 questScripts.js 的固定台本能不能被正确展示出来。
    // 用法示例：
    //   #testscript village2_jieshixiajiu quest_village2_s2
    //   #testscript village2_jieshixiajiu quest_village2_s3_a
    //   #testscript heifengzhai_5_langyanjiuzhang quest_heifengzhai5_s1
    if (!isTalk && cmd.startsWith("#testscript")) {
      addLog([{ t: "cmd", text: `> ${cmd}` }]);
      setInput("");
      const parts = cmd.split(/\s+/);
      const testQuestId = parts[1];
      const testFlag = parts[2];
      if (!testQuestId || !testFlag) {
        addLog([{ t: "sys", text: "  用法：#testscript <任务id> <flag>，比如 #testscript village2_jieshixiajiu quest_village2_s2" }]);
        return;
      }
      const quest = QUCUO_QUESTS.find(q => q.id === testQuestId);
      if (!quest) {
        addLog([{ t: "sys", text: `  ✗ 找不到任务 "${testQuestId}"，检查一下id有没有打对` }]);
        return;
      }
      // 找到这个flag对应的具体stage（可能是普通flag也可能是分支数组里的一个）
      const stage = quest.stages?.find(s => {
        const cf = Array.isArray(s.completionFlag) ? s.completionFlag : [s.completionFlag];
        return cf.includes(testFlag);
      });
      if (!stage) {
        addLog([{ t: "sys", text: `  ✗ 任务 "${testQuestId}" 里没有任何 stage 的 completionFlag 包含 "${testFlag}"` }]);
        return;
      }
      const script = getQuestScript(quest.id, stage.id, [testFlag]);
      if (!script) {
        addLog([{ t: "sys", text: `  ⚠ 这个stage（${stage.id}）在 questScripts.js 里没有登记固定台本，正常情况下会走AI生成` }]);
        return;
      }
      addLog([{ t: "sys", text: `  ── 台本夺舍测试：${quest.title} / ${stage.id} / flag=${testFlag} ──` }]);
      addLog(script.split("\n").filter(line => line.length).map(t => ({ t: "desc", text: "  " + t })));
      addLog([{ t: "sys", text: "  ── 以上为固定台本展示效果，未调用AI ──" }]);
      return;
    }


    // 行动模式处理中时：命令进入排队队列，不阻塞输入。
    // extraReplies 跟着 cmd 一起存进队列，等真正出队执行时再一并带出去，
    // 不能在这里就地 addLog——那样会插进"当前还开着"的上一条命令的框里。
    // 排队提示本身标记 standalone：它说的是"现在系统正忙"这件事，
    // 不属于正在处理的上一条命令，也不属于还没执行的这一条，谁的框都不该进。
    if (!isTalk && loading) {
      pendingQueue.current.push({ cmd, extraReplies, opts });
      setQueueCount(pendingQueue.current.length);
      addLog([{ t: "sys", text: `  ⏳ 「${cmd.slice(0, 20)}${cmd.length > 20 ? "…" : ""}」已入队（前 ${pendingQueue.current.length} 条）`, standalone: true }]);
      setInput("");
      return;
    }

    // 指令显示：默认显示 `> ${cmd}`；但某些内部指令（如战斗结算发给AI写战报的
    // 长prompt）不该原样打印给玩家看——传 opts.silentCmd 则完全不显示，或
    // opts.displayCmd 用一句干净的标题替代真实指令。
    if (!opts.silentCmd) {
      addLog([{ t: "cmd", text: `> ${opts.displayCmd || cmd}` }, ...extraReplies]);
    } else if (extraReplies.length) {
      addLog([...extraReplies]);
    }
    setInput("");
    setCmdHistory(p => [cmd, ...p].slice(0, 50));
    setHistIdx(-1);

    // ④ localCmd 打字命令（hp/i/skills/eq/背包/状态/武功/装备/help）已废除——
    // 这些一律走右栏面板/CharacterPage 按钮，不再从打字框识别。

    // ⑤ 探索态服用消耗品：打字「用/服/吃 X」正则已废除——改由「包袱」里每件消耗品的
    // 「⊙用」按钮打开次级面板（查看/服食/送人/卖掉），走 handleConsumeItem 确定性 handler。

    // loading 态 + 计时器启动已挪到下方"信息域·知识系统"之前——内层移动（上方 early return）
    // 是瞬时纯前端操作，不该进入 loading 态；此前设在这里会导致内层移动也转 spinner，
    // 且 setLoading(true)/false 同 tick 抵消仍可能闪"引擎运转中"。现在只有真正要调 AI
    // 的路径（外层移动/对话/行动）才启动 loading，且在第一个 await 之前，不破并发锁。
    // 方向判定：先走正则（parseDir），命中不了再用小模型兜底（本轮新增）——
    // 正则永远列不全所有口语化的移动表达（"我想去后山逛逛""沿河边往喇嘛庙那边走"
    // 这类），与其不断加正则分支，不如正则失手时，拿当前房间实际的出口列表问一次
    // 小模型"这句话对应哪个方向，还是压根不是移动"。这次调用的输出空间严格封闭在
    // 方向代码集合内（parseDirectionJudgeResponse 会校验），不涉及"去了哪个具体
    // 据点"——目的地依然是下面 resolveExit 查表决定，AI 只是被问了个"更聪明的正则"
    // 式的封闭问题，不违背"AI提议系统裁决"的原则。只有 !isTalk 且当前房间在固定
    // 地图里才会问（对话模式、房间不在地图里的情况不需要判断移动）。
    // 失败/超时静默降级为 null，不能因为这次小调用挂了就导致移动完全瘫痪。
    let movingDir = isTalk ? null : parseDir(cmd);
    // 【已闲置】AI 方向兜底：移动已改为点按钮/点地图节点/自动寻路（纯查表，不走大模型），
    // 这条"打字口语移动+正则失手时问小模型判方向"的兜底不再需要，故用 `false &&` 关掉。
    // 整段逻辑保留未删，日后若想恢复"打字也能口语移动"，去掉下面的 `false &&` 即可。
    if (false && !isTalk && !movingDir && QUCUO_MAP[room.name]) {
      try {
        const node = QUCUO_MAP[room.name];
        const judgeReq = buildDirectionJudgeRequest(cmd, room.name, node.exits);
        const judgeCfg = buildExtractionCfg("DIRECTION_JUDGE", apiCfg);
        const judgeResult = await callModel(judgeCfg, judgeReq.system, judgeReq.messages, { maxTokens: apiCfg.callTokenLimits?.direction ?? judgeReq.maxTokens, callLabel: "方向判定(已闲置)" });
        const aiDir = parseDirectionJudgeResponse(judgeResult.text);
        // 双重校验：AI 说的方向必须真的是当前房间已登记的出口之一，否则视为无效。
        // 这一步保证即便小模型偶尔"创造"了一个不存在的方向代码，也不会被采信。
        if (aiDir && node.exits[aiDir]) movingDir = aiDir;
      } catch (_) { /* 判定失败就当没判断出方向，走原有的"非移动"分支，不阻断游戏 */ }
    }
    pendDirRef.current = movingDir;

    // ── 内层箱庭移动：优先于外层大地图判定（判定在 act/innerMove.js，副作用在此执行）──
    const forceLayer = opts.forceLayer || null;
    const innerResult = !isTalk && movingDir
      ? innerMoveLogic(gameStore.getState(), {
        _trace,
        direction: movingDir,
        forceLayer,
        command: cmd,
        includeCommand: false,
      })
      : null;
    if (innerResult?.changes?.innerRoomName) {
      noteAction("innerMove");
      endTrace(_trace, `内层移动到 ${room.name}·${innerResult.changes.innerRoomName}`);
      setInput("");
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      applyResult(featureCtxRef.current, innerResult);
      // 内层移动是瞬时纯前端操作，early return 前必须把 loading+计时器清掉，
      // 否则 loading 永远停在 true：输入框锁死、spinner 空转、秒数狂涨，且 pendingQueue 因
      // loading 不归零永不出队——彻底卡死（此前"点一下卡住像在等AI"的真凶）。
      setLoading(false);
      if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
      setWaitSecs(0);
      return;
    }
    if (innerResult) {
      const blockedText = innerResult.logs?.find(entry => entry.t === "sys")?.text || "";
      endTrace(_trace, blockedText.includes("内里这个方向没有去处") ? "内层此路不通" : "门锁着");
      // 上锁的门要说清是缺哪把钥匙（lockedMsg），别跟"这个方向没路"混为一谈——
      // 玩家看见门却被告知"没有去处"会以为是 bug。
      applyResult(featureCtxRef.current, innerResult);
      setInput(""); setCmdHistory(p => [cmd, ...p].slice(0, 50)); setHistIdx(-1);
      setLoading(false);
      if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
      setWaitSecs(0);
      return;
    }

    // 系统裁决层：固定拓扑地图决定移动的合法性和目的地，AI 不能自己决定去了哪里。
    // 判定在 act/outerMove.js：方向在 QUCUO_MAP 有登记出口就锁定目的地；没有就明确
    // 告诉 AI 这个方向走不通，不允许它凭空编一个新地方出来。
    const outerLock = resolveOuterLock({ _trace, isTalk, movingDir, roomName: room.name, questProgress, flags, innerRoomName });
    const destinationLock = outerLock.destinationLock;
    const lockedDestName = outerLock.lockedDestName;
    if (outerLock.blocked) { movingDir = null; pendDirRef.current = null; }
    if (outerLock.outerDepart) outerDepartRef.current = outerLock.outerDepart;

    const arrivalResult = !isTalk && lockedDestName
      ? outerArrivalLogic(
        {
          ...gameStore.getState(),
          char,
          convo,
          mapData,
          time,
          questProgress,
          flags,
          varTree: varTreeRef.current,
        },
        {
          direction: movingDir,
          destName: lockedDestName,
          roomMap: roomMapRef.current,
          squares: serializeSquares(),
          command: cmd,
        },
      )
      : null;
    if (arrivalResult?.cached) {
      const traceInfo = arrivalResult.traceInfo;
      traceStep(_trace, "格子移动", "pass", `${room.name}→${lockedDestName} 格子命中，纯前端${traceInfo.hasSquareDesc ? "" : "（格子未就绪，兜底文本）"}`);
      if (traceInfo.item) {
        traceStep(_trace, "拾取判定", "pass", `格子预埋：${traceInfo.item.name}（品质「${traceInfo.item.quality}」）前端发放`);
      }
      if (traceInfo.encounter) {
        traceStep(_trace, "路遇", "pass", `格子预埋路遇：${traceInfo.encounter.name}（${traceInfo.encounter.label}）`);
      }
      applyResult(featureCtxRef.current, arrivalResult);
      outerDepartRef.current = null; pendDirRef.current = null; pickupJudgmentRef.current = null;
      endTrace(_trace, `到达 ${lockedDestName}（格子·纯前端）`);
      prerunSquares(); // 自愈：补齐未跑成的格子（全跑过则空转即返）
      return;
    }
    if (arrivalResult) applyResult(featureCtxRef.current, arrivalResult);

    const targetedRumor = findTargetedRumor(varTreeRef.current, cmd);

    // 系统裁决层：移动时按一定基础概率+气运品质分布，判定本次是否触发路上拾取。
    // 品质由系统骰子决定，AI 只负责给这个已经确定的品质编排一个符合场景的物品名称/描述，
    // 不允许 AI 自行决定"要不要给"或"给什么品质"。
    pickupJudgmentRef.current = null;
    if (!isTalk && movingDir) {
      const PICKUP_CHANCE = 0.35; // 每次移动 35% 基础几率触发拾取判定
      if (Math.random() < PICKUP_CHANCE) {
        const luck = char.special?.气运 ?? 5;
        const quality = rollQuality(luck);
        const cat = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY, ITEM_CATEGORY.MISC][Math.floor(Math.random() * 4)];
        pickupJudgmentRef.current = { quality, category: cat };
      }
    }

    // 系统裁决层：随机遭遇（路遇过路人）。挂在移动时，与拾取并列独立掷骰。
    // 只在真正跨节点移动、且本轮没有"人物涌现"抢占时触发——涌现（顺藤摸瓜找具体人）
    // 优先级更高，一轮里不同时塞两个 NPC 事件，免得场面拥挤。
    // 刷出来的人隶属某已有势力，可捎传闻喂涌现系统（守契诃夫铁律，见 encounter.js）。
    let encounterToDescribe = null;
    if (!isTalk && movingDir && lockedDestName && !targetedRumor) {
      const luck = char.special?.气运 ?? 5;
      const encounter = rollEncounter(lockedDestName, luck);
      if (encounter) {
        encounterToDescribe = encounter;
        // 自动寻路途中撞见路遇 → 硬中断：清掉剩余自动步，把玩家留在此处应对，
        // 本步照常把这次相遇叙述出来。后续要不要继续赶路，由玩家自己再点。
        if (autoTravelRef.current && pendingQueue.current.length > 0) {
          const dropped = pendingQueue.current.length;
          pendingQueue.current = [];
          setQueueCount(0);
          autoTravelRef.current = false;
          addLog([{ t: "sys", text: `  ⚠ 路上撞见生人，自动赶路就此打住（余下 ${dropped} 程未走）。要接着走，另点目的地即可。`, standalone: true }]);
        }
      }
    }

    // ── 采集裁决（系统层）──（判定在 act/roundNotes.js，副作用在此执行）
    // 玩家表达采集意图、且所采之物此刻真在地上时，由系统直接把物搬入背包、
    // 从地上抹去——「采没采到」不交给 AI 决定。推进则由背包变化触发的
    // alreadySatisfiedCollectRule 接管（采齐才推进）。
    let collectNote = "";
    collectGrantedRef.current = [];
    const collectHit = judgeCollect({ isTalk, cmd, room, questProgress, inv });
    if (collectHit) {
      setInv(v => [...v, collectHit.gained]);
      setRoom(r => ({ ...r, items: (r.items || []).filter(i => (typeof i === "string" ? i : i.name) !== collectHit.item) }));
      collectGrantedRef.current = [collectHit.item];
      addLog([{ t: "item", text: `  ✓ 你采得「${collectHit.item}」，收入背包。` }]);
      collectNote = collectHit.note;
    }

    // loading 态 + 计时器：在第一个 await（下方 recall/knowledge）之前启动——
    // 内层移动已在上方 early return（不进 loading），这里之后才真正要调 AI。
    if (isTalk) changePendingTalks(1); else setLoading(true);
    setWaitSecs(0);
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    waitTimerRef.current = setInterval(() => setWaitSecs(s => s + 1), 1000);

    // 本回合开始时的 varTree，逻辑读取走 ref 以包含已发生的同步写入。
    const preActVarTree = varTreeRef.current;
    const callDeps = (memory = {}, prepared = {}) => ({
        varTree: memory.varTree ?? varTreeRef.current, gm, isSettle, isTalk, intent, apiCfg, narrator,
        scenario: preset.scenario, budgetInstruction: prepared.budgetInstruction,
        npcLoreBlockWithQuest: prepared.npcLoreBlockWithQuest || "",
        visibleNpcsCount: prepared.visibleNpcsCount || 0, charName: char.name, charBodyProfile: char.bodyProfile,
        pickupJudgment: pickupJudgmentRef.current, cmd: prepared.cmd || cmd, convo, nsfwOn,
        ctx: prepared.ctx, recallBlock: memory.recallBlock || "", reunionBlock: prepared.reunionBlock || "",
        infoDomainBlock: memory.infoDomainBlock || "", hist: prepared.hist, mainConvo: prepared.mainConvo,
        lockedDestName,
        gambleTalkCtx: gambleTalkCtx.current, recallInfo: memory.recallInfo,
        inSeaOfMind: room.name === SEA_OF_MIND.district,
        settleNpc: opts.settleNpc, settleKind: opts.settleKind, giftInfo: opts.giftInfo, learnInfo: opts.learnInfo, settleBeast: !!opts.settleBeast,
        _trace, addLog, setLog,
      });
    const turnCtx = {
      apiCfg,
      callDeps,
      convo,
      isTalk,
      isSettle,
      _trace,
      prompt: createPromptContext({
        room, char, inv, skills, dao, flags, questProgress, pendingQuestBranch,
        varTree: preActVarTree, time, preset, companionState, nsfwOn, activeTarget, isTalk,
        gm, movingDir, lockedDestName, outerDepart: outerDepartRef.current, innerRoomName, apiCfg,
        destinationLock, pickupJudgment: pickupJudgmentRef.current, categoryLabel: CATEGORY_LABEL,
        encounter: encounterToDescribe, collectNote, intent,
        timeForToday: timeRef.current,
      }, {
        importedNpcLore: importedRegistry.getImportedNpcLore(),
        companionForms: Object.fromEntries(Object.keys(COMPANION_LORE).map(key => [key, getCompanionDescForm(key)])),
      }),
      memory: {
        varTreeLatest: preActVarTree,
        roomNpcNames: room.npcs.map(n => n.name),
        time,
        apiCfg,
        flags,
        recall: { apiCfg, cmd, room, flags, activeTarget, isTalk, talkTarget },
      },
      state: { room, char, inv, dao },
      getPipelineLog,
      getMapNode,
      beforeRun: () => { pickupExtractionFailedRef.current = false; },
      refs: {
        varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
        pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
        roundsSinceLastSaveRef, playedThisSessionRef,
      },
      commitDeps: (turnResult) => {
        pickupExtractionFailedRef.current = turnResult.pickupExtractionFailed;
        return {
          p: turnResult.p, mvuCommands: turnResult.mvuCommands, dealResult: turnResult.dealResult,
          rawFull: turnResult.rawFull, narrativeText: turnResult.narrativeText,
          knowledgeTree: turnResult.knowledgeTree, knowledgeTreeBase: turnResult.knowledgeTreeBase,
          isTalk, gm, lockedDestName, room, innerRoomName, time, mapData,
          pendingQuestBranch, apiCfg, activeTarget, talkTarget, effectiveSpecialNow, newConvo: turnResult.newConvo,
          questProgress, char, preserveHp: opts.preserveHp,
          _trace, addLog,
          setVarTree, setRoom, setGambleNegotiation, setInv, setChar, setDao, setExp, setPot,
          setSkills, setFlags, setMapData, setTime, setPendingQuestBranch, setConvo,
          varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
          pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
          roundsSinceLastSaveRef, playedThisSessionRef,
        };
      },
    };
    const result = await playTurn(turnCtx, cmd, opts);
    if (!result.ok) {
      const e = result.error;
      const ec = classifyError(e);
      traceStep(_trace, "状态写回", "fail", `异常回滚：${ec.title}`);
      endTrace(_trace, "行动出错，已整体回滚");
      addLog([
        { t: "err", text: `  ${ec.icon} ${ec.title}` },
        { t: "err", text: `     ${ec.detail}` },
        { t: "sys", text: `     ▸ ${ec.hint}` },
        { t: "sys", text: `     （本轮状态已整体回滚，未留下半提交脏数据；可直接重试）` },
      ]);
    }
    noteAction(isSettle ? "settle" : isTalk ? "talk" : "action");
    if (isTalk) { changePendingTalks(-1); }
    else { setLoading(false); }
    // 停计时
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    setWaitSecs(0);
  }, [loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset, localCmd, addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget, nsfwOn, varTree, pendingTalks, changePendingTalks]);
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

  // 系统强制推进任务stage（本轮新增，"档2"harness的核心）：不等AI在
  // delta.flags_add 里吐出 completionFlag，直接把这个flag塞进 flags
  // 状态里，然后复用现有的 advanceQuestStages/lockExclusiveSiblings/
  // resolveStageRewards/applyStageRewards 这一整套状态机——"这一步的
  // 效果"完全由系统层面的既有逻辑决定，不依赖AI这次调用是否成功、
  // 也不依赖AI有没有在文字里"演对了"。
  //
  // 实现上刻意不用"setState回调里嵌套setState回调"这种写法（虽然React
  // 允许，但深度嵌套很容易在后续维护时引入隐蔽bug、也难以在没有真实
  // 浏览器环境的地方验证正确性）。改成：先用当前渲染时已经拿到的
  // flags/questProgress 快照算出这次操作的最终结果，再依次调用各个
  // setter——逻辑是线性的，每一步做什么一目了然。
  // 唯一的代价是：如果两次点击在同一个渲染周期内非常连续地发生（正常
  // 点击操作不会），可能读到的是同一份旧快照——这个场景概率极低，且
  // 感叹号点击本身有UI层面的天然间隔（等上一次AI调用完成才会展示下
  // 一次机会），不是需要特别处理的边界情况。
  const forceAdvanceQuest = useCallback((quest, targetFlag) => {
    const nextFlags = flags.includes(targetFlag) ? flags : [...flags, targetFlag];
    let prog = questProgress[quest.id] || createQuestProgress(quest.id);
    const gameState = { flags: nextFlags, char };
    const pendingRewards = [];
    while (prog.status === "active") {
      const result = advanceQuestStages(quest, prog, gameState);
      if (!result.advanced) break;
      prog = result.progress;
      if (result.completedStage) {
        const rewards = resolveStageRewards(result.completedStage, result.hitFlags);
        if (rewards) pendingRewards.push(rewards);
      }
      if (result.justCompleted) break;
    }
    let nextProgress = { ...questProgress, [quest.id]: prog };
    if (prog.status === "completed") {
      nextProgress = lockExclusiveSiblings(nextProgress, QUCUO_QUESTS, quest.id);
    }
    setFlags(nextFlags);
    setQuestProgress(nextProgress);
    for (const rewards of pendingRewards) {
      applyStageRewards(rewards, { setInv, setChar, setVarTree, setFlags });
    }
  }, [flags, questProgress, char, setInv, setChar, setVarTree]);

  // 点击感叹号面板里的某条任务（本轮改造，支持 questTriggerMode 二选一）：
  //   "script" 模式——走原有逻辑，送一句话让主叙事AI自然演绎（这条路径
  //     本身不强制触发，AI依然可能选择怎么演，保留作为对照/备选）
  //   "prompt" 模式（默认）——系统直接强制推进这个stage（forceAdvanceQuest），
  //     不等AI自己判断，随后调用任务专属harness（questHarness.js）单独
  //     生成一段贴合这件事的叙事文字展示出来，AI只负责组织语言，"发生
  //     不发生"这个决定权已经不在AI手里
  const triggerQuestFromPanel = useCallback(async (entry) => {
    const { quest, stage, isNewlyGiven } = entry;
    if (apiCfg.questTriggerMode === "script") {
      const line = isNewlyGiven
        ? `我想找${quest.giver}问问「${quest.title}」这件事`
        : `我继续跟${quest.giver}谈「${quest.title}」的事`;
      act(line);
      return;
    }
    // prompt 模式：系统先强制推进（用这个stage的completionFlag，如果是
    // 数组取第一个作为默认，分支节点应该走 triggerQuestChoice 而不是
    // 这个函数，这里只处理非分支的普通stage）
    const targetFlag = Array.isArray(stage.completionFlag) ? stage.completionFlag[0] : stage.completionFlag;
    forceAdvanceQuest(quest, targetFlag);
    // 点了感叹号先给一句仪式感的系统告示（在 AI 叙事之前），点明这一步是开启还是推进，
    // 并提示去任务面板看详情——让"点一下就推进"这件事有个郑重的落点，不是悄没声地过去。
    addLog([
      { t: "quest", text: `  ❖ ${entry.isNewlyGiven ? "任务开启" : "任务推进"} 「${quest.title}」` },
      { t: "sys", text: `  〔详情可查任务面板〕` },
    ]);
    // 并入主叙事：不再单独调 harness，改走 act() 主管线，把这一步作为"本步已定情节"
    // 追加进主 prompt 末尾（act 会自己记 > 命令行、走时间+1、写小纸条进记忆）。
    await act(`❢ ${quest.title}`, [], { forcedEvent: stage.description, forcedEventNpc: quest.giver });
  }, [act, apiCfg, forceAdvanceQuest, addLog]);

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
  const triggerQuestChoice = useCallback(async (entry, choice) => {
    const { quest, stage } = entry;
    if (apiCfg.questTriggerMode === "script") {
      act(`（关于「${quest.title}」）我选择：${choice.label}`);
      return;
    }
    const resolve = choice.resolve || "auto";

    // ── 选项要动手：进真·切磋，打赢才推进这个分支 ──
    if (resolve === "combat" && choice.combatNpc) {
      addLog([{ t: "cmd", text: `> ❢ ${quest.title}：${choice.label}` }]);
      // 记住这场架是为哪个分支打的，DuelScreen onFinish 里胜了才 forceAdvance
      setPendingQuestBranch({ questId: quest.id, flag: choice.flag, mode: "combat" });
      // 造一个临时敌人 NPC 进战斗（带 tag 供胜利回调识别；hostile 表示是真打不是切磋）
      const foe = ensureNpcCombatData({
        id: `questfoe_${choice.flag}_${Date.now()}`,
        name: choice.combatNpc.name,
        levelCap: choice.combatNpc.levelCap ?? 1,
        tag: choice.combatNpc.tag,
        hostile: true,
        questBranchFlag: choice.flag, // onFinish 用这个认领分支
      }, { levelCap: choice.combatNpc.levelCap ?? 1 });
      setDuelingNpc(foe);
      return;
    }

    // ── 选项要周旋/说服：有 persuade 结构则开说服界面（短对话+攻心判定），
    //    否则退回自由对话模式 ──
    if (resolve === "talk") {
      addLog([{ t: "cmd", text: `> ❢ ${quest.title}：${choice.label}` }]);
      if (choice.persuade) {
        setActivePersuasion({
          persuade: choice.persuade,
          questId: quest.id,
          flag: choice.flag,
        });
        return;
      }
      // 无 persuade：老的自由对话兜底
      setPendingQuestBranch({ questId: quest.id, flag: choice.flag, mode: "talk", goal: choice.talkGoal });
      setInteractMode("talk");
      setTalkTarget(choice.talkTarget || quest.giver);
      addLog([
        { t: "sys", text: `  你决定${choice.label}。` },
        { t: "sys", text: `  〔说赢了对方才会松口。〕` },
      ]);
      return;
    }

    // ── 袖手/无需机制：直接推进结算 ──
    forceAdvanceQuest(quest, choice.flag);
    addLog([
      { t: "quest", text: `  ❖ 任务推进 「${quest.title}」——你选择：${choice.label}` },
      { t: "sys", text: `  〔详情可查任务面板〕` },
    ]);
    await act(`❢ ${quest.title}：${choice.label}`, [], { forcedEvent: `${stage.description}（玩家的选择：${choice.label}）`, forcedEventNpc: quest.giver });
  }, [act, apiCfg, forceAdvanceQuest, addLog]);

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
    const itemName = typeof item === "object" ? item.name : item;
    const consumable = (typeof item === "object" && item.consumable) || CATALOG_INDEX[itemName]?.consumable || null;
    if (!consumable) { addLog([{ t: "sys", text: `  ${itemName}并非可服用之物。` }]); return; }
    const res = useConsumable(consumable, char);
    if (!res.ok) { addLog([{ t: "sys", text: `  ${res.reason}` }]); return; }
    if (res.hpDelta) setChar(c => ({ ...c, hp: [Math.min(effectiveMaxHp(c.hp[1], skills), c.hp[0] + res.hpDelta), c.hp[1]] }));
    if (res.sixDimBuffs && res.sixDimBuffs.length) {
      const nf = res.sixDimBuffs.map(b => makeBuffFlag(b.attr, b.val, time, b.duration));
      setFlags(f => [...f, ...nf]);
    }
    if (res.combatBuff) setChar(c => ({ ...c, pendingCombatBuff: mergeCombatBuff(c.pendingCombatBuff, res.combatBuff) }));
    setInv(prev => { const n = [...prev]; const j = n.findIndex(i => (typeof i === "object" ? i.name : i) === itemName); if (j !== -1) n.splice(j, 1); return n; });
    addLog([{ t: "item", text: `  ⊙ ${res.note}` }]);
    setTime(t => t + 1);
  }, [char, time, addLog]);

  // ⑧ 采摘：把地上物收入背包、从 room.items 抹去（确定性，不调AI）。
  const handleCollectGround = useCallback((item) => {
    noteAction("pickGround");
    const itemName = typeof item === "object" ? item.name : item;
    setInv(prev => [...prev, item]);
    setRoom(r => {
      const items = [...(r.items || [])];
      let j = items.findIndex(it => (typeof item === "object" && item.id != null) ? (typeof it === "object" && it.id === item.id) : it === item);
      if (j === -1) j = items.findIndex(it => (typeof it === "object" ? it.name : it) === itemName);
      if (j !== -1) items.splice(j, 1);
      return { ...r, items };
    });
    addLog([{ t: "item", text: `  ✓ 你拾起「${itemName}」，收入囊中。` }]);
    setTime(t => t + 1);
  }, [addLog]);

  // ⑥ 自动寻路：点已探索地图节点 → BFS 取路（只穿行已探索+已解锁节点）→ 逐步行走。
  // 实现借力现有命令队列：首步走 act()，其余方向**同步**预填 pendingQueue（ref，无 setState
  // 竞态），act 首步结束后由现有出队 useEffect 顺次执行——每步照常耗时/掷遭遇/写叙事，
  // 掷中遭遇/拾取时那一步的叙事自然停在该据点，玩家看得见、可随时改打别的（后续命令仍在队列）。
  const autoTravelTo = useCallback((destName) => {
    if (!destName || destName === room.name) return;
    if (loading) { addLog([{ t: "sys", text: `  正忙着，稍候再另择去处。` }]); return; }
    const route = planAutoTravel({ room, mapData, flags, questProgress }, destName);
    if (route.locked) { addLog([{ t: "sys", text: `  「${destName}」此刻还去不得，路未通。` }]); return; }
    const path = route.path;
    if (!path) { addLog([{ t: "sys", text: `  「${destName}」尚无已探明、可通行的路径。` }]); return; }
    if (path.length === 0) return;
    addLog([{ t: "sys", text: `  ⇢ 起身前往「${destName}」，需行 ${path.length} 程（每程一个时辰）……` }]);
    const words = path.map(d => DIRS[d] || d);
    const [first, ...rest] = words;
    // 自动寻路是跨据点的外层移动，必须标记 forceLayer:"outer"——否则 autoTravelTo 发出的
    // act("西") 不带 forceLayer，当玩家此刻正站在某个内层房间(innerRoomName 有值)时，会被
    // 2713 行的内层判定(forceLayer!=="outer" 即触发)截胡，表现为"外层点方向去已探索据点，
    // 却变成了内层房间移动判定"。首步和队列后续步都要带，队列消费处(4649)会透传 opts。
    rest.forEach(w => pendingQueue.current.push({ cmd: w, extraReplies: [], opts: { forceLayer: "outer" } }));
    autoTravelRef.current = rest.length > 0; // 有后续排队步时才需要"遇遭遇硬停"
    setQueueCount(pendingQueue.current.length);
    act(first, [], { forceLayer: "outer" });
  }, [room.name, loading, mapData, flags, questProgress, act, addLog]);

  // 调试传送落地：位置(据点+内层房间)都更新到目标后，触发一次"环顾"式 act，
  // 让 AI 读新场子、系统跑 look 分支（原地锁定/场内任务注入/主叙事查看/NPC 已投放），
  // 与玩家自己走到此地完全同一条加载链。触发后清标记，只跑一次。
  useEffect(() => {
    const pend = teleportLookRef.current;
    if (!pend) return;
    if (room.name !== pend.dist) return;                    // 据点还没切到位
    if (pend.inner && innerRoomName !== pend.inner) return; // 内层房间还没到位
    teleportLookRef.current = null;
    setInteractMode("action");
    act("环顾四周");
  }, [room.name, innerRoomName, act]);

  // ── 飞鸽传书（本轮新增）──────────────────────────────────────────────
  // 记下每个在场 NPC 此刻的所在据点，作为日后"往哪寄信、隔多远"的依据（最后见到的地方）。
  useEffect(() => {
    applyResult(featureCtxRef.current, recordPigeonNpcLocations(gameStore.getState()));
  }, [room.name, room.npcs]);

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

  // 回信生成：以收信人口吻 + 其独立信件线（记忆独立）+ 共享事实账本（记忆共享）作答。
  const replyPigeonLetter = useCallback(async (letter) => {
    const { npcName, sentContent, id, channel, giftName } = letter;
    const state = gameStore.getState();
    try {
      const npcObj = room.npcs.find(n => n.name === npcName) || {};
      const attrs = state.varTree?.角色?.[npcName] || {};
      const curAff = typeof attrs.好感度 === "number" ? attrs.好感度 : 0;
      const thread = (attrs.飞鸽 || []).map(m => `${m.dir === "send" ? "主角来信" : "你的回信"}：${m.content}${m.gift ? `（附礼：${m.gift}）` : ""}`).join("\n");
      const facts = allFactSummaries(state.varTree, 12).map(f => `· （${getTimeStr(f.诞生回合 || 0)}）${f.摘要}${f.标签 ? `〔${f.标签}〕` : ""}`).join("\n");
      const gaveGift = channel === "postgift" && giftName;
      const canReturnGift = gaveGift; // 只有对方收到礼、且好感够(系统另判≥50)才可能回礼
      const sys = `你是武侠世界「曲措乡」中的【${npcName}】${npcObj.brief ? "，" + npcObj.brief : ""}。${npcObj.fullBio ? npcObj.fullBio + " " : ""}${npcObj.personality ? "性情：" + npcObj.personality + "。" : ""}
你与主角的关系：好感度 ${curAff}/100${attrs.态度 ? "，" + attrs.态度 : ""}。好感越低越冷淡疏离，越高越亲近热络。
剧本背景：${preset.scenario || ""}
你收到主角${gaveGift ? `托驿卒捎来的信，并随信附赠了「${giftName}」` : "寄来的信"}。你们此前往来的信件（须前后连贯、不自相矛盾）：
${thread || "（这是你们第一次通信）"}
${facts ? "你也隐约知道的近来见闻（可自然带一两句，不要生硬罗列）：\n" + facts : ""}
请以【${npcName}】的口吻，用白话古文书信体写一封回信。只写信的正文（可含简短落款），约 80–160 字，关系冷淡则简短公事甚至推拒、亲厚则温言絮语${gaveGift ? "；收了礼要有所表示（谢或却）" : ""}。
写完信正文后，另起附两个隐藏标记（会被系统读走、玩家看不到，不要在正文提它们）：
① ⟦好感X⟧：X 为整数 -3~+8，表示这次通信${gaveGift ? "与收礼" : ""}让你对主角好感升降多少（寻常问候+1~2；说到心坎/贴心/有趣+3~+6；${gaveGift ? "礼物合心意可再高些至+8；" : ""}敷衍冒犯给负数）。
${canReturnGift ? "② ⟦回礼:物品名|类别⟧：若你确实想回赠一件礼（类别取 weapon/armor/accessory/misc 之一），从你身份/处境合理拿得出手的东西里挑一件写在这里（例如僧人回赠念珠、猎户回赠兽皮、富贵者回赠玉器）；不想回或拿不出就整条省略。" : "（这次不涉及回礼，无需第二个标记。）"}`;
      const { text } = await callModel(apiCfg, sys, [{ role: "user", content: `主角的来信：${sentContent}` }], { maxTokens: apiCfg.callTokenLimits?.pigeonReply ?? 3000, callLabel: "飞鸽回信" });
      applyPigeonResult(applyPigeonReply(state, letter, text));
    } catch {
      pigeonProcessing.current.delete(id);
      applyPigeonResult(failPigeonReply(gameStore.getState(), letter));
    }
  }, [room.npcs, apiCfg, preset, applyPigeonResult]);

  // 到点收信：时间推进到 arriveTime 时，逐封生成回信（ref 去重，防重复触发）。
  useEffect(() => {
    const due = processPigeons(gameStore.getState()).filter(l => !pigeonProcessing.current.has(l.id));
    if (!due.length) return;
    due.forEach(l => { pigeonProcessing.current.add(l.id); replyPigeonLetter(l); });
  }, [time, varTree, replyPigeonLetter]);

  const handleNpcDuel = useCallback(async (npc) => {
    // 实质性互动（打过一场架）本来就是认识对方的充分条件，不能只靠"细看/对话"
    // 两个入口才算认识——玩家跟这个人交过手、见过好感度变化，说"尚未认识"是反直觉的。
    applyResult(featureCtxRef.current, recognizeNpc(gameStore.getState(), npc));
    setActiveTarget(npc.name); // 让邀战这段过渡叙事聚焦这个人，而非把在场所有人都发给AI
    // 切磋不再是点了就直接弹战斗界面：先走一次正常的行动结算，让AI描述
    // "抱拳邀战、对方如何应允/摆开架势"这类过渡场景；叙事跑完之后，还要
    // 玩家自己点"确认切磋"才真正开打——中间留一步反悔的余地，不是敬个礼
    // 战斗界面就毫无征兆地砸到眼前。
    await act(`向${npc.name}抱拳邀战，请他切磋一番`);
    setDuelPending(npc);
  }, [act]);
  const confirmDuel = useCallback(() => {
    if (!duelPending) return;
    setDuelingNpc(duelPending);
    setDuelPending(null);
  }, [duelPending]);
  const cancelDuel = useCallback(() => {
    if (!duelPending) return;
    addLog([{ t: "sys", text: `  你收起架势，这场切磋作罢，${duelPending.name}也顺势松了口气。` }]);
    setDuelPending(null);
  }, [duelPending, addLog]);

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

  // loading 变为 false 时，处理队列中的下一条命令。
  // 关键修复：依赖数组必须包含 act 本身——act 是 useCallback，依赖里有 room 等
  // 状态，每次这些状态变化 act 都会重新生成一份新闭包。之前这里只依赖 [loading]，
  // 导致 setTimeout 里调用的是某次渲染时捕获的旧版本 act，其内部闭包的 room 也是
  // 那时的旧快照——如果玩家排队攒了好几条指令，出队执行时用的还是过时的房间状态
  // 去算 resolveExit(旧room.name, dir)，算出来的 lockedDestName 就可能是错的或者
  // 干脆判定"当前房间不在固定地图里"而走了自由生成兜底分支，这正是"移动到了系统
  // 不认识的地名（比如AI自由发挥的'熊曲山谷'过渡场景），后续再次移动时方向判定
  // 用错基准房间"这个bug的根因。加入 act 依赖后，每次都会用最新闭包出队执行。
  useEffect(() => {
    if (!loading && pendingQueue.current.length > 0) {
      const { cmd: nextCmd, extraReplies: nextExtra, opts: nextOpts } = pendingQueue.current.shift();
      setQueueCount(pendingQueue.current.length);
      if (pendingQueue.current.length === 0) autoTravelRef.current = false; // 最后一步出队：自动寻路自然结束
      const timer = setTimeout(() => act(nextCmd, nextExtra, nextOpts || {}), 50);
      return () => clearTimeout(timer);
    }
  }, [loading, act]);

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

  // 赌石谈价：走 act 对话主管线（convo/小纸条/账本/召回/好感全自动挂上），
  // 只额外挂一个轻量标记 gambleTalkCtx —— talk 模式拼 prompt 时据此追加 <deal> 规则，
  // AI 回复里的 <deal>{priceMult,addItem}</deal> 由系统 clamp/校验后落到 gambleNegotiation。
  // 不重构主 prompt、不自造 harness，仿 inspectItem 的轻。
  const handleGambleTalk = useCallback((bidderName, content, ctx) => {
    // 不关闭赌桌（关了会 unmount、每日石头重生成、negotiation 对不上 stoneId）——
    // 由组件自己最小化到角标，主对话框照常聊；谈成的价写进 gambleNegotiation，展开即见。
    gambleTalkCtx.current = ctx || { bidderName };  // { bidderName, stoneId, baseOffer, cash, carry }
    setInteractMode("talk");
    setTalkTarget(bidderName);
    act(content);
  }, [act]);

  // 赌石成交/委托：系统裁决好数值后（gambleStone 已 clamp），照送礼/买卖那套——
  // 拼一句自然语言走 act()，让主叙事演一段，convo/小纸条/账本/召回全自动挂上。
  const handleGambleSettle = useCallback((res) => {
    const result = settleGambleStone(gameStore.getState(), res);
    applyResult(featureCtxRef.current, result);
    if (res.type !== "buy" && result.changes) setActiveBuilding(null);
  }, []);

  // 赌石相石（看皮）：系统先用 readSkinClue 按悟性裁决"能看出哪些线索"（AI 全程读不到
  // 种水真相），这里仿 inspectItem 的轻量单发——不挂预设/世界书/历史，只把线索交给说书人
  // 演一段相石口诀。算一次真端详：+1 回合 + 公共小纸条（组件侧对同一块石头做了缓存，重看不再调）。
  const handleGambleInspect = useCallback(async (stone, clue) => {
    try {
      const sys = `你是曲措乡这个武侠世界的说书人。玩家在天都镇玉石料场端详一块未开的赌石，请一位老师傅的口吻看皮相石。用3-5句章回说书人口吻，把下面的看皮线索演成一段相石评语（可用"雾""砂""蟒带"等行话），只说表象与吉凶暗示，绝不断言内里种水成色，绝不编造线索之外的判断。纯文本，不要JSON。`;
      const lines = [
        `皮壳：${clue.skinLabel}——${clue.skinClue}`,
        clue.changKouHint ? `场口眼力：${clue.changKouHint}` : "（认不出场口来历，悟性眼力未及）",
        clue.mistHint ? `雾象：${clue.mistHint}` : "",
      ].filter(Boolean).join("\n");
      const { text } = await callModel(apiCfg, sys, [{ role: "user", content: lines }], { maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000, callLabel: "赌石相石" });
      const t = (text || "").trim();
      if (t) {
        addLog([{ t: "cmd", text: "> 相石 · 看皮" }, { t: "desc", text: "  " + t }]);
        setTime(x => x + 1);
        jotNote({ text: "在玉石料场相了一块赌石的皮壳，听老师傅讲了一段看皮的门道。", owner: [], source: NOTE_SOURCE.NARRATIVE });
      }
      return t;
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] 相石失败：${e.message}` }]);
      return "";
    }
  }, [apiCfg, addLog, jotNote]);

  // 铁匠铺定制：小模型据三填空出 3 候选，供 ForgeScreen 展示。只做设计，不扣钱不下单。
  const handleForgeDesign = useCallback(async ({ material, category, requirement }) => {
    try {
      return await forgeDesign({ material, category, requirement }, apiCfg);
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] 铁匠铺设计失败：${e.message || e}` }]);
      return { ok: false, candidates: [] };
    }
  }, [apiCfg, addLog]);

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

  // 定制柜：小模型据三填空出 3 候选(玉匠语境)。只设计不下单。
  const handleJadeDesign = useCallback(async ({ material, category, requirement }) => {
    try {
      return await forgeDesign({ material, category, requirement, craft: { shop: "金玉行", maker: "玉匠", wares: "玉器饰物护身之物" } }, apiCfg);
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] 金玉行设计失败：${e.message || e}` }]);
      return { ok: false, candidates: [] };
    }
  }, [apiCfg, addLog]);

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
    applyCardSkills(player, setSkills);
    const carried = applyCardCarry(player, setInv, `ci${Date.now().toString(36)}_`);
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
          applyCardSkills(fromCard, setSkills);
          const n = applyCardCarry(fromCard, setInv, "cc_");
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
