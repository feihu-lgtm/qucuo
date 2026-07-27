import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { QUCUO_PRESET } from "./presets/qucuo.js";
import {
  NNPC_STAGE, initialNarratorState, isInSea, migrateNarratorState,
  narratorVoicePrompt, affectionLabel, buildNarratorWhisperContext,
  narratorWhisperLengthNote, gateWhisperTopics, gateQuestTopic,
} from "./narrator.js";
import { gateBodyProfile, emptyBodyProfile, buildOutfitRequest, bodyProfileFilled } from "./bodyProfile.js";
import BodyProfilePanel from "./BodyProfilePanel.jsx";
import { loadConfig, saveConfig, callModel, callModelStream, cleanJsonString, getPipelineLog, classifyError } from "./apiConfig.js";
import { startTrace, step as traceStep, endTrace, getTraceLog, clearTraceLog, formatTrace, attachPipeline, attachExtractionPipeline, attachInjectionSnapshot, fmtMs } from "./actionTrace.js";
import { buildSnapshot, autoSave, tryRestoreSave, flushLocalBackup, isCompatibleCharShape, isCompatibleRoomShape } from "./saves.js";
import SettingsPanel from "./SettingsPanel.jsx";
import LogEntry from "./LogEntry.jsx";
import LoreScreen from "./LoreScreen.jsx";
import { GROUND_ITEMS } from "./groundItems.js";
import { initialVarTree, extractMvuBlock, applyMvuCommands, npcAffectionLabel, reputationLabel } from "./mvu.js";
import { QUALITY, QUALITY_COLOR, ITEM_CATEGORY, CATEGORY_LABEL, makeItem, getEquipped, toggleEquip, describeEquipment, rollQuality, computeEquippedStats } from "./equipment.js";
import { makeItemSmart, describeCatalogForAI, useConsumable, CATALOG_INDEX, CATALOG, makeCatalogItem, backfillInventoryFromCatalog } from "./items/catalog.js";
// 具名优先的物品生成：AI 发放/掉落/购买的物品名若命中百物录，吃具名的专属
// 数值+特效+六维；否则回退 equipment.makeItem 匿名公式。全项目物品生成走这个。
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

import { getZoneTheme, ink } from "./theme.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";
import CodexScreen from "./CodexScreen.jsx";
import BugReportModal from "./BugReportModal.jsx";
import { QUCUO_MAP, getMapNode, resolveExit, findPath, isNodeUnlocked, buildDirectionJudgeRequest, parseDirectionJudgeResponse } from "./qucuoMap.js";
import { hasInnerMap, getDistrictAnchor, getInnerRoom, resolveInnerExit, visibleInnerExits, getResidentRoomForNpc, getInnerRoomNames, getBuildingIdForInnerRoom, isNpcVisibleInInnerRoom, isInnerExitUnlocked } from "./innerMap.js";
import { describeInnerArrival } from "./mapNarration.js";
import { loadPortraits, setPortrait, removePortrait, fileToDataUrl, inferActivePortraitTarget, SNOW_LEOPARD_FORMS, getSnowLeopardForm, setSnowLeopardForm, snowLeopardPortraitUrl } from "./portraits.js";
import PortraitManager from "./PortraitManager.jsx";
import CharacterPage from "./CharacterPage.jsx";
import QuestLogScreen from "./QuestLogScreen.jsx";
import OpeningSequence from "./OpeningSequence.jsx";
import CharacterCreate from "./CharacterCreate.jsx";
import { getActivePreset } from "./PresetManager.jsx";
import { applyPresetOverrides } from "./presetSystem.js";
import TraceViewer from "./TraceViewer.jsx";
import { duelPotGain, duelAffGain, duelDropChance, TEAMWORK_GAIN } from "./combat/duelSettleMath.js";
import { getCachedInspect, setCachedInspect } from "./inspectCache.js";
import { classifyIntent, buildBudgetInstruction, INTENT } from "./inputIntent.js";
import NpcActionMenu from "./NpcActionMenu.jsx";
import ItemActionMenu from "./ItemActionMenu.jsx";
import { ensureNpcCombatData, generateNpcMoveset, MOVE_POOL, deriveMovesetFromSkills, hpFromNeigong } from "./npcGeneration.js";
import { detectNewFaces, markAsSeen, markNpcAsKnown, isNpcKnown, detectReunions, buildReunionBlock, updateLastSeen, REUNION_GAP_THRESHOLD } from "./npcAwareness.js";
import { buildShopInventory, rollShopStock } from "./shops/qucuoShops.js";
import TradingScreen from "./TradingScreen.jsx";
import { recordRumoredNpcs, findTargetedRumor, clearRumor } from "./npcEmergence.js";
import { rollEncounter, buildEncounterNote } from "./encounter.js";
import { seedKnowledge, evolveKnowledge, buildInfoDomainBlock, factSummaryRequest, factSummaryRequestFromRecall, setFactSummary, registerFact, witnessFact, allFactSummaries } from "./knowledge.js";
import { mapDescriptionToGenParams } from "./npcDescriptionMapping.js";
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
import { pendingGroundItems, detectCollectPickup, allCollected, alreadySatisfiedCollectStages, collectPromptLines } from "./quests/collect.js";
import { MOVE_TYPE } from "./combat/moveTypes.js";
import DuelScreen from "./DuelScreen.jsx";
import TeamDuelScreen from "./TeamDuelScreen.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import VersionHistoryPanel from "./VersionHistoryPanel.jsx";
import PersuasionScreen from "./PersuasionScreen.jsx";
import { tickAngryState } from "./combat/stealSystem.js";
import { CURRENT_VERSION } from "./version.js";
import { recallWithVisibility } from "./memory/recallWithVisibility.js";
import { writeNote, NOTE_SOURCE, VIA, reembedStaleNotes } from "./memory/note.js";
import { buildDaySummaryRequest, appendDaySummary, buildDistantViewBlock } from "./memory/daySummary.js";
import { embeddingReady } from "./memory/embeddingService.js";
import { matchNpcLore, buildNpcLoreBlock, gateScenario } from "./worldbook.js";
import { callExtraction, buildExtractionCfg, forgeDesign } from "./extractionEngine.js";
import { initCompanionState, unlockSnowLeopard, setSnowLeopardActive, isSnowLeopardAvailable, unlockAsuka, activeCompanionKey, setActiveCompanion, unlockedCompanions } from "./companion.js";
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
import EscortScreen, { ESCORT_QUESTS } from "./buildings/EscortScreen.jsx";
import BountyScreen from "./buildings/BountyScreen.jsx";
import ForgeScreen from "./buildings/ForgeScreen.jsx";
import JadeShopScreen from "./buildings/JadeShopScreen.jsx";
import GambleStoneScreen from "./buildings/GambleStoneScreen.jsx";
import { settleNegotiation as gambleSettleNegotiation, JADE_TIERS, CHANG_KOU } from "./gambleStone.js";
import TeahouseScreen from "./buildings/TeahouseScreen.jsx";
import { getScheduledNpcs, toRoomNpc, NPC_POOL } from "./npcPool.js";
import { invHasItemNamed, SAFE_HOUSES } from "./safeHouse.js";
// 在场名单的唯一写入口（见 roomNpcs.js 顶部：此前 15 个写入方各写一遍，
// 连着两个 bug 都是"谁都能改、改的时候顺手把别人写的冲掉"）
import { injectNpcs, markCarriedLost, materializeNpc, removeNpc, respawnNpc } from "./roomNpcs.js";
import { buildHistBlock, histBlockSavings } from "./memory/histWindow.js";
import { tallyAdd, describeTodayForAI, describeDayForSummary, describeTallyForWhisper } from "./memory/tally.js";
import { SECT_ENTRY, checkSectEntry } from "./sectEntry.js";
import { SEA_OF_MIND, shouldTriggerXuannu, buildXuannuScene, canEnterSea, describeSeaGate, seaEntryHint } from "./seaOfMind.js";
import {
  COMFORT_ACTIONS, SCENE_ARRIVE, SCENE_VILLA, SCENE_RESOLVE,
  SCENE_PORTAL_OPEN, SCENE_TOKYO, SCENE_RETURN,
  canComfort, describeComfortReject, comfortResponse, defenseLevelOf,
  availableKnot, canResolve, looksLikePromise, seaDialoguePrompt,
} from "./narratorQuest.js";
import { narratorVars, setNarratorVars } from "./mvu.js";
import { AUCTION_LOT } from "./auction.js";
import { seededRand } from "./utils/seededRandom.js";
import { getResidentNpcs, getAllResidentNpcLore } from "./residentNpcs.js";
import { makeSkillEntry, SKILL_CATALOG } from "./kungfu/qucuoKungfu.js";
import { tryLearnFromMaster, tryStealFrom } from "./kungfu/learnSkill.js";
import { stealSuccessRate } from "./combat/stealSystem.js";
import { parseActiveBuffs, makeBuffFlag, applyBuffsToSpecial, cleanExpiredBuffs, activeBuffsWithRemaining, mergeCombatBuff } from "./utils/buffSystem.js";
import { buildSysBase } from "./sysBase.js";
import { DIRS, bar, STAGES, STAGE_UP_COST, STAGE_TO_QUALITY, DIR_DXY, parseDir, getTimeStr } from "./utils/mudHelpers.js";
import { MAP_UI } from "./mapUi.js";
import ZoomableMap from "./ZoomableMap.jsx";
import TutorialOverlay from "./TutorialOverlay.jsx";
import NineGridMap from "./NineGridMap.jsx";
import LeftPanel from "./panels/LeftPanel.jsx";
import RightPanel from "./panels/RightPanel.jsx";
import CenterPanel from "./panels/CenterPanel.jsx";
import TopBar from "./panels/TopBar.jsx";
import GlobalOverlays from "./panels/GlobalOverlays.jsx";
import DebugPanel from "./panels/DebugPanel.jsx";
import ClickableMap from "./ClickableMap.jsx";
import PipelineViewer from "./PipelineViewer.jsx";
import { tryInnerMove } from "./act/innerMove.js";
import { resolveOuterLock } from "./act/outerMove.js";
import { judgeCollect, buildQuestStageNote, buildForcedEventNote, buildArrivalNote, buildPresence, buildNpcContext } from "./act/roundNotes.js";
import { runKnowledgeTurn, runRecall } from "./act/memoryLayer.js";
import { callMainOnce } from "./act/actCall.js";
import { parseMainResponse } from "./act/parseResponse.js";
import { commitRound } from "./act/commitRound.js";
import {
  rollSkeleton, buildSquarePrompt, parseSquareBatch, applySquareBatch,
  consumeArrival, getLookText, burnSquare, resetForDay, pendingNodes,
  serializeSquares, loadSquares,
} from "./mapSquares.js";

const DEFAULT_PRESETS = [QUCUO_PRESET];

export default function MudRPG({ initialLoadSlotId = null, initialOpenSettings = false } = {}) {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  // "new" 是显式新开局信号，此时无论有没有存档都不恢复。
  const restored = initialLoadSlotId === "new" ? null : tryRestoreSave(DEFAULT_PRESETS, initialLoadSlotId);
  // 格子数据随档恢复（埋物是游戏状态的一部分；刷新重掷会允许读档刨雷）
  if (restored?.snap?.squares) loadSquares(restored.snap.squares);

  const [preset, setPreset] = useState(restored?.preset || DEFAULT_PRESETS[0]);
  const [room, setRoom] = useState(() => {
    const initialRoom = restored?.snap.room || DEFAULT_PRESETS[0].room;
    // 初始房间（无论来自预设默认值还是存档恢复）里的NPC都可能还没有 moveset/carriedItems
    // 字段（预设手写时不会带这些，老存档存的时候这套系统还不存在），启动时补全一次。
    const initLuck = (restored?.snap.char || DEFAULT_PRESETS[0].char).special?.气运 ?? 5;
    return {
      ...initialRoom,
      // 之前这里没传 levelCap，预设手写的具名NPC（老猎户/杂货商人等）一律落到
      // getTierPower 的默认档位（白/村民），跟他们的实际人设强度（比如"猎户"
      // 关键词该是绿袍档）对不上——尤其是品质档位改成~20倍/档增长之后，
      // 这个疏漏会让本该有点门槛的对手变得形同虚设。这里跟AI涌现NPC用同一套
      // matchLevelCap 关键词映射，从名字+简介里推断档位。
      npcs: (initialRoom.npcs || []).map(n => {
        const { levelCap } = mapDescriptionToGenParams(`${n.name || ""} ${n.brief || ""}`);
        return ensureNpcCombatData(n, { luck: initLuck, levelCap });
      }),
    };
  });
  // 内层箱庭导航——跟 room state 完全独立的新增状态，不改动 room.name 的
  // 语义（room.name 继续只表示"在哪个据点"，MudRPG.jsx 里现有71处引用
  // room.name 的地方全部不用动）。innerRoomName 只在当前据点有内层数据
  // （hasInnerMap(room.name) 为真）时才有意义，值是这个据点内部某个房间
  // 的名字（比如"村口"）。没有内层数据的据点（目前除鱼定村外的13个），
  // 这个值应保持为 null，UI/移动判定据此完全走原有的"整据点即一间房"
  // 逻辑，两套系统不会互相干扰。
  const [innerRoomName, setInnerRoomName] = useState(() => {
    const initial = restored?.snap.room || DEFAULT_PRESETS[0].room;
    if (!hasInnerMap(initial.name)) return null;
    // 优先吃存档里记的内层房间（本轮新增字段）；老存档没有、或存的房间已不在
    // 该据点内景里，才退回锚点。
    const saved = restored?.snap.innerRoomName;
    if (saved && getInnerRoomNames(initial.name).includes(saved)) return saved;
    return getDistrictAnchor(initial.name);
  });
  // 读档/初始化时"这一次的内层位置是恢复来的"，用于让下面那个 room.name effect
  // 在挂载首跑时别把恢复值冲成锚点。
  const restoredInnerRef = useRef(null);
  const innerInitRef = useRef(false);
  // 玩家在大地图上移动到一个新据点（room.name 变化）时，如果这个据点有
  // 内层数据，自动把内层位置重置为锚点房间（比如走进"鱼定村"落脚在
  // "村口"）；没有内层数据则清空，回退到旧模式。注意这里故意不依赖
  // innerRoomName 自身，只依赖 room.name，避免"内层移动时也触发一次
  // 重置回锚点"这种误触发。
  //
  // 首跑跳过（本轮修）：useEffect 在**挂载时也会跑一次**，会把 useState 初始化
  // 好的"存档里的内层房间"立刻冲成锚点，等于存了也白存。而热更新(HMR)/读档
  // 造成的重挂载正是玩家遇到的"人在玉石料场，一动却从镇口起步"的直接来源。
  // 所以只在**真正的据点切换**时才重置。
  useEffect(() => {
    if (!innerInitRef.current) { innerInitRef.current = true; return; }
    // 读档刚设过内层房间：这一跑是 applySnapshot 改 room.name 引发的，不是玩家换据点，
    // 放行一次，别把刚恢复的位置冲掉。
    if (restoredInnerRef.current !== null) { restoredInnerRef.current = null; return; }
    setInnerRoomName(hasInnerMap(room.name) ? getDistrictAnchor(room.name) : null);
  }, [room.name]);
  const [char, setChar] = useState(() => {
    const initial = restored?.snap.char || DEFAULT_PRESETS[0].char;
    const initialSkills = restored?.snap.skills || DEFAULT_PRESETS[0].skills;
    // moveset 不再是开局纯随机生成的独立数据，而是从"武学"（skills）派生——
    // 见 npcGeneration.js 的 deriveMovesetFromSkills，武学阶段决定招式品质上限，
    // 练得越深切磋越强，这样"三脚猫拳法"这类武学才是真正影响战斗的东西。
    const base = { ...initial, moveset: deriveMovesetFromSkills(initialSkills) };
    // 主角气血上限统一走 hpFromNeigong（与所有 NPC 同一套公式），不再用 preset 里
    // 写死的 100——否则同为白袍内功5，主角100、NPC却116，主角凭空矮一截。仅新开局
    // 时按公式重算上限（存档恢复则沿用存档里玩家当前的血量，不覆盖）。
    if (!restored) {
      const maxHp = hpFromNeigong(base.neigong ?? 5, base.special?.体魄 ?? 5);
      base.hp = [maxHp, maxHp];
    }
    return base;
  });
  const [dao, setDao] = useState(restored?.snap.dao || DEFAULT_PRESETS[0].dao);
  const [skills, setSkills] = useState(restored?.snap.skills || DEFAULT_PRESETS[0].skills.map(s => ({ ...s })));
  // 伙伴系统（本轮新增）：雪豹的解锁/出战状态。老存档没有这个字段，用
  // initCompanionState() 兜底成"未解锁"，不影响任何既有存档的兼容性。
  const [companionState, setCompanionState] = useState(restored?.snap.companionState || initCompanionState());
  // companionState 的 latest-ref：房间注入 effect（依赖数组刻意不含 companionState，
  // 避免入队/好感变动就整屋重刷）需要读到最新入队状态来决定是否还注入驻场雪豹，
  // 靠这个 ref 拿最新值。用一个同步 effect 维护，不改动现有 setCompanionState 调用点。
  const companionStateRef = useRef(companionState);
  useEffect(() => { companionStateRef.current = companionState; }, [companionState]);
  // 装备信息现在完全并入 inv（每个物品对象自带 category/equipped 标记），不再单独维护 equip state
  // 老档补丁：catalog 后续给具名物品补的 sixDim/effect（如红档补七维）不会追溯到
  // 早就生成好的旧实例，这里读档时顺手补一遍，见 backfillInventoryFromCatalog。
  const [inv, setInv] = useState(() => backfillInventoryFromCatalog(restored?.snap.inv || [...DEFAULT_PRESETS[0].inv]));
  const [log, setLog] = useState(
    restored
      ? [{ t: "sys", text: `── 已从上次自动存档恢复进度（${new Date(restored.snap.savedAt || Date.now()).toLocaleString()}） ──` }, ...restored.snap.log]
      : [{ t: "sys", text: `MUD引擎 · 「${CURRENT_VERSION.codename}」${CURRENT_VERSION.time} · ${DEFAULT_PRESETS[0].name}` }, ...DEFAULT_PRESETS[0].opening]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitSecs, setWaitSecs] = useState(0); // AI 调用已等待秒数（卡住感知）
  const waitTimerRef = useRef(null);
  const [pendingTalks, setPendingTalks] = useState(0); // 对话/私聊模式：并行请求计数
  const [queueCount, setQueueCount] = useState(0); // 排队命令计数，驱动 UI 刷新
  const [collapsedGroups, setCollapsedGroups] = useState(new Set()); // 折叠的命令框（存 cmd 在 log 里的 index）
  const [convo, setConvo] = useState(restored?.snap.convo || []);
  const [exp, setExp] = useState(restored?.snap.exp || 0);
  const [pot, setPot] = useState(restored?.snap.pot || 0);
  const [flags, setFlags] = useState(restored?.snap.flags || []);
  const [questProgress, setQuestProgress] = useState(restored?.snap.questProgress || {}); // { questId: { count } }
  // 说服进度持久化：按 questId|flag 存 { guard, hitKeys, turns, done }，让"关掉再点同一场
  // 说服"能接着上次、且进快照存档。成功/离开时清掉该场。
  // 【必须声明在 buildCurrentSnapshot(useCallback) 之前】——它被 snapshot 的依赖数组引用，
  // 若声明晚于那里会触发 const 暂时性死区：Cannot access 'persuasionProgress' before initialization。
  const [persuasionProgress, setPersuasionProgress] = useState(restored?.snap.persuasionProgress || {});
  const [mapData, setMapData] = useState(restored?.snap.mapData || { [DEFAULT_PRESETS[0].room.name]: { x: QUCUO_MAP[DEFAULT_PRESETS[0].room.name]?.x ?? 0, y: QUCUO_MAP[DEFAULT_PRESETS[0].room.name]?.y ?? 0 } });
  const [mapBig, setMapBig] = useState(false);
  const mapBigCloseGuard = useOverlayCloseGuard(() => setMapBig(false));
  const [mapView, setMapView] = useState("outer"); // ⑦ 地图框显示：outer=外层大地图 / inner=内层箱庭图
  const [peoplePanel, setPeoplePanel] = useState({ present: true, absent: true }); // 左侧人物两段各自收放
  const [time, setTime] = useState(restored?.snap.time ?? 6); // 24回合/天，6=第1日·卯时（晨）
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
  const effectiveSpecialNow = applyBuffsToSpecial(char.special, flags, time);
  const activeBuffs = activeBuffsWithRemaining(flags, time);
  const [gm, setGm] = useState(false);
  const [showDebug, setShowDebug] = useState(false); // 调试面板显隐（面板内部状态已下沉到 DebugPanel.jsx）
  const [showPresets, setShowPresets] = useState(false);
  // 新手教程覆盖层：首次进游戏默认弹出，看过一次记进 localStorage，之后不再自动弹
  // （左上角按钮随时可再点开）。localStorage 不可用时降级为默认不弹，避免报错。
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return localStorage.getItem("qucuo_tutorial_seen") !== "1"; }
    catch { return false; }
  });
  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    try { localStorage.setItem("qucuo_tutorial_seen", "1"); } catch { /* ignore */ }
  }, []);
  const [showCodex, setShowCodex] = useState(false); // 图鉴：百物·武学总览

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
  const [showBugReport, setShowBugReport] = useState(false); // 上报bug/意见反馈弹窗
  const [showSettings, setShowSettings] = useState(initialOpenSettings);
  // 开场图文序列（策马入村 -> 信封特写）只在"全新开局且没有任何存档被恢复"时展示一次；
  // 读档进入、或本局已经看过一次之后刷新页面触发自动存档恢复，都不应该再放这段序列。
  const [showOpening, setShowOpening] = useState(
    initialLoadSlotId === "new" && !restored
  );
  // 角色创建页：全新开局时，在开场信之前先让玩家填名讳+性别。存档恢复则跳过。
  const [showCharCreate, setShowCharCreate] = useState(
    initialLoadSlotId === "new" && !restored
  );
  const [settingsInitialTab, setSettingsInitialTab] = useState(null);
  const [interactMode, setInteractMode] = useState("action"); // 'talk' | 'action' | 'whisper'
  const [talkTarget, setTalkTarget] = useState(null); // 对话模式下具体在跟谁说话，供立绘自动推断使用
  const [activeTarget, setActiveTarget] = useState(null); // null=全部NPC在场 | string=锁定某个NPC名
  const [nsfwOn, setNsfwOn] = useState(true); // ■ NSFW 开关：true=注入NSFW规则+primer消息（默认开启）
  const [showBody, setShowBody] = useState(false); // ◈体貌面板
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
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  // 版本历史面板关闭逻辑已内聚进独立组件 VersionHistoryPanel.jsx（自带 useOverlayCloseGuard），
  // 这里不再需要单独维护一份 closeGuard 实例。
  const [showCharacterPage, setShowCharacterPage] = useState(false);
  // 玩家头像：优先用玩家自设的（存 localStorage），否则按性别用预制头像。showAvatarPicker 控制选择弹层。
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [playerAvatarCustom, setPlayerAvatarCustom] = useState(() => {
    try { return localStorage.getItem("qucuo_player_avatar") || ""; } catch { return ""; }
  });
  const AV_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/player/";
  const genderAvatar = { "男": AV_BASE + "male.webp", "女": AV_BASE + "female.webp" };
  const playerAvatar = playerAvatarCustom || genderAvatar[char.gender] || (AV_BASE + "other.webp");
  const [showQuestLog, setShowQuestLog] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [showQijuzhu, setShowQijuzhu] = useState(false); // 起居注：今日行迹 + 累计年鉴 // 见闻录：小纸条+小账本可视化
  const [characterPageTarget, setCharacterPageTarget] = useState(null); // "面板"按钮指定直接打开谁的详情
  const [portraits, setPortraits] = useState(loadPortraits());
  // 雪豹立绘三形态切换（人形·立雪/人形·倚剑/雪豹真身，存 localStorage 持久化）；
  // slImgErr：图片文件未投放到 public/portraits/snowleopard/ 时显示占位提示而不是破图
  const [slForm, setSlFormState] = useState(getSnowLeopardForm());
  const [slImgErr, setSlImgErr] = useState(false);
  const [narratorImgErr, setNarratorImgErr] = useState(false); // 旁白立绘文件缺失时给占位提示
  const [portraitTarget, setPortraitTarget] = useState(null); // null = 自动推断；否则玩家手动锁定查看的对象
  const [showPortraitManager, setShowPortraitManager] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [claimedMilestones, setClaimedMilestones] = useState(new Set(restored?.snap.claimedMilestones || []));
  const [narrator, setNarrator] = useState(restored?.snap.narrator || initialNarratorState());
  const [varTree, setVarTreeState] = useState(() => {
    if (restored?.snap.varTree) return restored.snap.varTree; // 读档：存档里已含知识领域，不重复灌
    const base = initialVarTree();
    const p = restored?.preset || DEFAULT_PRESETS[0];
    return seedKnowledge(base, p.知识基底, 0); // 新局：灌入剧本写死的知识基底
  });
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

  // ── 自动存档（回合间隔制）──
  // 旧实现是"任何状态变化立刻覆盖写"，有个致命问题：组件一挂载 useEffect 就执行，
  // 恢复失败/点了新开局时，全新的初始状态瞬间覆盖掉旧自动存档——玩家的进度就是这么没的。
  // 现在改成：本次会话至少完成过 1 个回合才允许写（挂载绝不覆盖），
  // 且每满 autoSaveEvery 个回合才写一次（0 = 每回合都写）；页面关闭/刷新时兜底写一次。
  const [lastAutoSave, setLastAutoSave] = useState(null);
  const [autoSaveError, setAutoSaveError] = useState(null);
  const roundsSinceLastSaveRef = useRef(0);   // 距离上次自动存档过了几个回合
  const playedThisSessionRef = useRef(false); // 本次会话玩家是否真的行动过
  // 默认立绘已改为硬加载（静态 import，见 portraits.js 顶部的
  // DEFAULT_PORTRAITS），构建时直接打包进产物，getPortrait() 里自动
  // 合并查询，不再需要任何异步初始化步骤——之前这里有一个
  // initDefaultPortraits() 的 useEffect，现在完全不需要了。

  useEffect(() => {
    if (!playedThisSessionRef.current) return; // 还没玩过：绝不覆盖旧档
    // 必须确有回合完成过。roundsSinceLastSaveRef 只在 commitRound（真走完一轮）自增、
    // 存档后归零；varTree 等状态被别的东西碰一下不算一轮。
    // 【为什么补这条】起居注上线后，不走 AI 的动作（内层移动等）也会写 varTree，
    // 而 varTree 在本 effect 的 deps 里。autoSaveEvery=0（每回合都存）时下面那道
    // 区间守卫因 every>0 为假而整个跳过，于是每走一步内层都触发一次全量快照+落盘。
    if (roundsSinceLastSaveRef.current <= 0) return;
    const every = Math.max(0, Number(apiCfg.autoSaveEvery ?? 5));
    if (every > 0 && roundsSinceLastSaveRef.current < every) return; // 间隔未到
    const snapshot = buildSnapshot({ preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, deposit, depositedAt, pledgedItems, persuasionProgress, innerRoomName, companionState, squares: serializeSquares(), roomMap: roomMapRef.current });
    const result = autoSave(snapshot); // 同步返回（写内存必成；IDB 异步落盘、LS 尽力兜底）
    if (result.ok) {
      roundsSinceLastSaveRef.current = 0;
      setLastAutoSave(Date.now());
      setAutoSaveError(null);
    } else {
      setAutoSaveError(result.error);
    }
  }, [preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, apiCfg.autoSaveEvery, companionState]);

  // 从存档槽位读取后，整体覆盖当前状态
  const applySnapshot = useCallback((snap) => {
    const matchedPreset = presets.find(p => p.id === snap.preset?.id) || preset;
    setPreset(matchedPreset);
    setRoom(isCompatibleRoomShape(snap.room) ? snap.room : matchedPreset.room);
    // 老存档可能没有 moveset/special 字段（切磋系统上线之前存的档），
    // 兼容判定通过后还要单独补全这两个字段，不能直接假设它们存在——
    // 之前这里漏了这一步，导致老存档读进来后 char.moveset 是 undefined，
    // 后续任何读取它的地方（比如打开切磋界面）都可能因此出问题。
    const restoredChar = isCompatibleCharShape(snap.char) ? snap.char : matchedPreset.char;
    setChar(restoredChar.moveset ? restoredChar : {
      ...restoredChar,
      moveset: generateNpcMoveset({ id: "player" }, { luck: restoredChar.special?.气运 ?? 5, levelCap: 5 }),
    });
    setDao(snap.dao);
    setSkills(snap.skills); setInv(backfillInventoryFromCatalog(snap.inv));
    setLog(snap.log); setConvo(snap.convo); setExp(snap.exp); setPot(snap.pot);
    setFlags(snap.flags); setMapData(snap.mapData); setTime(snap.time);
    // 老档迁移：旧 CRASHED 阶段（告白→宕机那条已废链路）会把文风永久锁在
    // "干瘪空壳"上，好感度再高也不变、旁白线也走不出来。归一到当前阶段定义。
    setNarrator(migrateNarratorState(snap.narrator));
    setVarTree(snap.varTree || initialVarTree());
    setQuestProgress(snap.questProgress || {});
    setClaimedMilestones(new Set(snap.claimedMilestones || []));
    setDeposit(snap.deposit || 0);
    setDepositedAt(snap.depositedAt ?? null);
    setPledgedItems(snap.pledgedItems || []);
    setCompanionState(snap.companionState || initCompanionState());
    if (snap.roomMap) roomMapRef.current = snap.roomMap;
    if (snap.squares) loadSquares(snap.squares);
    // 内层箱庭位置：老存档没这个字段、或存的房间已不在该据点内景里（改过地图数据），
    // 都退回锚点，绝不让玩家落在一个不存在的房间里。
    {
      const rm = isCompatibleRoomShape(snap.room) ? snap.room : matchedPreset.room;
      const ok = snap.innerRoomName && hasInnerMap(rm.name) && getInnerRoomNames(rm.name).includes(snap.innerRoomName);
      restoredInnerRef.current = ok ? snap.innerRoomName : (hasInnerMap(rm.name) ? getDistrictAnchor(rm.name) : null);
      setInnerRoomName(restoredInnerRef.current);
    }
    setShowSettings(false);
  }, [presets, preset]);

  const buildCurrentSnapshot = useCallback(() => buildSnapshot({
    preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, deposit, depositedAt, pledgedItems, persuasionProgress, innerRoomName, companionState,
    squares: serializeSquares(), roomMap: roomMapRef.current,
  }), [preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, persuasionProgress, innerRoomName, companionState]); // deposit/depositedAt/pledgedItems captured via closure

  // ── 地图格子·后台预跑（扫雷式预埋，见 mapSquares.js）──
  // 全据点批量预跑（14 节点，3 个一 call）：系统先掷骰埋拾取/路遇，小模型一次写完全套
  // 到达素材。fire-and-forget，单批失败静默，下个触发点自愈（开局/日更/每次格子移动后）。
  const prerunBusyRef = useRef(false);
  const prerunSquares = useCallback(() => {
    if (prerunBusyRef.current) return;
    const day = Math.floor(time / 24);
    const pending = pendingNodes(day);
    if (!pending.length) return;
    prerunBusyRef.current = true;
    (async () => {
      try {
        const luck = char.special?.气运 ?? 5;
        for (let i = 0; i < pending.length; i += 3) {
          const skeletons = {};
          const batch = pending.slice(i, i + 3).map(name => {
            const node = getMapNode(name);
            const sk = rollSkeleton(name, luck);
            skeletons[name] = sk;
            return { name, base: node.desc, exits: Object.keys(node.exits).join(","), item: sk.item, encounter: sk.encounter };
          });
          const req = buildSquarePrompt(batch);
          try {
            const cfg = buildExtractionCfg("SQUARE_PRERUN", apiCfg);
            const r = await callModel(cfg, req.system, [{ role: "user", content: req.user }], { maxTokens: 1500, callLabel: "地图预跑" });
            applySquareBatch(day, parseSquareBatch(r.text), skeletons);
          } catch (_) { /* 单批失败静默，余格下个触发点重试 */ }
        }
      } finally { prerunBusyRef.current = false; }
    })();
  }, [time, apiCfg, char]);
  const prerunBootedRef = useRef(false);
  useEffect(() => {
    if (prerunBootedRef.current) return;
    prerunBootedRef.current = true;
    prerunSquares();
  }, [prerunSquares]);

  // 关页/刷新兜底：IDB 写是异步、关页来不及落盘，故这里改用同步的 flushLocalBackup
  // 把最新快照写一份到 localStorage（尽力而为）；下次开局 loadAutoSave 会取 IDB 与它的较新者。
  // 同样受"本次会话行动过"保护——刚挂载就关页不会把旧档覆盖成新开局。
  useEffect(() => {
    const flush = () => {
      if (!playedThisSessionRef.current) return;
      flushLocalBackup(buildCurrentSnapshot());
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [buildCurrentSnapshot]);

  const loadPreset = useCallback((p) => {
    setPreset(p); setRoom(p.room); setChar(p.char); setDao(p.dao);
    setSkills(p.skills.map(s => ({ ...s }))); setInv([...p.inv]);
    setLog([{ t: "sys", text: `MUD引擎 · 「${CURRENT_VERSION.codename}」${CURRENT_VERSION.time} · ${p.name}` }, ...p.opening]);
    setConvo([]); setExp(0); setPot(0); setFlags([]); setTime(6); setGm(false);
    setMapData({ [p.room.name]: { x: 0, y: 0 } });
    setNarrator(initialNarratorState());
    setVarTree(prev => seedKnowledge(prev, p.知识基底, 0)); // 换预设开新局也灌基底（registerFact 幂等）
    setCompanionState(initCompanionState()); // 新开局重置雪豹解锁/出战状态，不带上一局的伙伴进度
    roomMapRef.current = { [p.room.name]: { items: [...p.room.items], npcs: [...p.room.npcs] } };
    setShowPresets(false);
  }, []);

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

  // 武学（skills）变化时，同步重算切磋招式池——升级、新学一门武学都应该
  // 立刻反映到能打出来的招式上，不能让"三脚猫拳法"练了等级却对战斗毫无影响。
  // 拜师学艺额外学到的技能（sourceSkill为null且不在武学派生结果里的）要保留，
  // 不能被这次重算覆盖掉，所以是"合并"而不是"整体替换"。
  useEffect(() => {
    setChar(c => {
      const derived = deriveMovesetFromSkills(skills);
      const extraLearned = (c.moveset || []).filter(m =>
        !derived.some(d => d.id === m.id) && m.learnedFromMaster
      );
      return { ...c, moveset: [...derived, ...extraLearned] };
    });
  }, [skills]);


  // 每当回合推进（time变化），统一给所有处于"生气状态"的NPC递减剩余回合数。
  // 用单一 useEffect 监听 time 而不是在每个 setTime 调用点分别处理，
  // 保证不管从哪条路径推进回合（本地命令/AI生成/主循环），生气状态都不会被漏更新。
  const prevTimeRef = useRef(time);
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
  const [showBasement, setShowBasement] = useState(false);
  const [deposit, setDeposit] = useState(restored?.snap.deposit || 0);
  const [depositedAt, setDepositedAt] = useState(restored?.snap.depositedAt ?? null);
  const [pledgedItems, setPledgedItems] = useState(restored?.snap.pledgedItems || []);
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
      addLog(newFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` })));
      setVarTree(prev => markAsSeen(prev, newFaces.map(n => n.name)));
      setVarTree(prev => updateLastSeen(prev, visible.map(n => n.name), time));
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

  // 日总结（大纸条）：跨天时后台归纳刚过去这一天攒下的原料，存进 varTree.世界.日总结。
  // fire-and-forget：AI 失败就不写，缺一天日总结无伤大雅，绝不阻断游戏。
  const summarizeDay = useCallback(async (endedDay, material) => {
    const lines = (material || []).map(m => m.text).filter(Boolean);
    if (!lines.length) return;
    const label = `第${endedDay + 1}日`;
    try {
      const { system, messages } = buildDaySummaryRequest(label, lines);
      const { text } = await callModel(apiCfg, system, messages, { maxTokens: apiCfg.callTokenLimits?.daySummary ?? 2000, callLabel: "日总结" });
      const summary = (text || "").trim();
      if (!summary) return;
      setVarTree(prev => appendDaySummary(prev, { day: endedDay, label, text: summary, turn: (endedDay + 1) * 24 }));
    } catch (_) { /* 日总结失败静默 */ }
  }, [apiCfg]);

  // 把一条结构化事实（切磋结果/飞鸽书信这类系统已知数据）交给 AI 写成一句白话古文小总结，
  // 覆盖掉注册时先塞的结构化兜底摘要。fire-and-forget：AI 没开/失败就保留那句兜底（不再是死模板文风，
  // 而是可读的结构化事实垫底）。cue 是喂给 AI 的事件线索，越具体 AI 写得越准。
  const aiSummarizeFact = useCallback(async (factId, cue) => {
    try {
      const req = factSummaryRequest(cue);
      const { text } = await callModel(apiCfg, req.system, req.messages, { maxTokens: apiCfg.callTokenLimits?.knowledge ?? req.maxTokens, callLabel: "事实摘要" });
      // 坑：这里原先写的是 if (line) ... setFactSummary(…, line)，但 callModel 解构出来的
      // 是 text——line 从来就不存在，每次都抛 ReferenceError 被下面的 catch 静默吃掉，
      // 等于 AI 摘要一次都没写进去过，一直在用注册时的结构化兜底（见 version.js 0727 修复记录）。
      const summary = (text || "").trim();
      if (summary) setVarTree(prev => setFactSummary(prev, factId, summary));
    } catch (_) { /* 保留结构化兜底摘要 */ }
  }, [apiCfg]);

  // 跨天侦测：24 回合 = 1 天。time 的整天数一旦增长，就把上一天的原料交给 summarizeDay，
  // 随即清空缓冲、推进 prevDay。用 ref 记上一整天数，避免每次 time 变都误触发。
  const prevDayRef = useRef(Math.floor(time / 24));
  useEffect(() => {
    const curDay = Math.floor(time / 24);
    if (curDay > prevDayRef.current) {
      const ended = prevDayRef.current;
      const material = dayMaterialRef.current;
      dayMaterialRef.current = [];
      prevDayRef.current = curDay;
      // 把这一天的行动计数也交给日总结当原料。此前不走 AI 的动作（走动/打坐/安抚…）
      // 一件都不留痕，日总结里会出现"今天什么都没干"却实际来回跑了十几趟的怪事。
      // 注意用 prevDayRef 之前那一天的 time 去读（ended*24），否则读到的是新一天的空表。
      const tallyLine = describeDayForSummary(varTreeRef.current.世界?.起居注, ended * 24);
      const fullMaterial = tallyLine ? [...material, { text: tallyLine }] : material;
      if (fullMaterial.length) summarizeDay(ended, fullMaterial);
      // 新的一天：全图格子重埋（昨日埋物作废，预跑重新掷骰写文——给出"每天值得巡一圈"的理由）
      resetForDay();
      prerunSquares();
    }
  }, [time, summarizeDay, prerunSquares]);
  useEffect(() => {
    if (time === prevTimeRef.current) return;
    prevTimeRef.current = time;
    // 清理已过期的临时 buff flag（消耗品系统第3步）——过期的 buff_..._untilturn_T
    // flag 留在 flags 里既污染 AI 上下文、也让状态面板显示已失效的药力。每次回合推进
    // 后清一遍，只在确有过期项时才 setFlags，避免无谓重渲染。cleanExpiredBuffs 只动
    // buff_ 开头的 flag，其他剧情 flag 原样保留。
    setFlags(prev => {
      const cleaned = cleanExpiredBuffs(prev, time);
      return cleaned.length === prev.length ? prev : cleaned;
    });
    // 铸剑坊自动交付：委托时下的 forge_pending_<下单time>_<luck> flag，到 24 时辰后
    // 系统自动打造入袋（不必玩家回铸剑坊手动点取件——面板承诺"打好有人送来"，这里真
    // 落实）。每次回合推进检查一遍所有 pending 订单，成熟的（time-下单≥24）就地结算、
    // 移除 flag、成品进背包，并在日志里提示"铸剑坊伙计送来"。同一 setFlags 里顺带处理，
    // 避免多次 setState。
    setFlags(prev => {
      const matured = prev.filter(f => {
        if (!f.startsWith("forge_pending_")) return false;
        const parts = f.split("_");
        const orderedAt = Number(parts[2]);
        return Number.isFinite(orderedAt) && (time - orderedAt) >= 24;
      });
      if (!matured.length) return prev;
      // 结算每张成熟订单
      const deliveredNames = [];
      for (const f of matured) {
        const parts = f.split("_");
        // flag 格式（新）：forge_pending_<下单time>_<luck>_<encodeURIComponent(JSON spec)>。
        // spec = {name,category,effect,sixDim,material,requirement}，由三候选选定时写入。
        // 品质仍由系统按 luck 定(AI 不碰)，spec 只提供名字/类别/词条。
        // 兼容：老格式 parts[4] 是纯材料编码(非JSON)或不存在——解析失败就退化成"定制长剑"。
        const luck = Number(parts[3]) || 5;
        const qualities = ["白", "绿", "蓝", "紫", "橙", "红"];
        const qIdx = Math.min(4, Math.floor(luck / 2.5)); // 气运最高到橙(rollQuality上限)
        let quality = qualities[qIdx];
        let spec = null;
        if (parts[4] && parts[4] !== "-") {
          try { spec = JSON.parse(decodeURIComponent(parts[4])); } catch { spec = null; }
        }
        let name, category, effect, sixDim, isJade = false;
        if (spec && spec.name) {
          name = spec.name;
          category = ["weapon", "armor", "accessory"].includes(spec.category) ? spec.category : "weapon";
          effect = (spec.effect && typeof spec.effect === "object" && Object.keys(spec.effect).length) ? spec.effect : undefined;
          sixDim = (spec.sixDim && typeof spec.sixDim === "object" && Object.keys(spec.sixDim).length) ? spec.sixDim : undefined;
          // 金玉行：成品品质 = min(气运档, 玉料品质天花板)。好料是上限、手气定发挥。
          if (spec.jade && spec.qualityCap) {
            isJade = true;
            const capIdx = qualities.indexOf(spec.qualityCap);
            if (capIdx >= 0 && capIdx < qualities.indexOf(quality)) quality = spec.qualityCap;
          }
        } else {
          let material = "";
          if (parts[4] && parts[4] !== "-") { try { material = decodeURIComponent(parts[4]); } catch { material = parts[4]; } }
          name = material ? `${material}剑` : "定制长剑";
          category = "weapon";
        }
        // 白/绿档不挂词条(与 catalog 潜规则一致)：品质低于蓝时丢弃 effect/sixDim。
        const qRank = qualities.indexOf(quality);
        if (qRank < 2) { effect = undefined; sixDim = undefined; }
        const forgedItem = makeGameItem({ name, category, quality, ...(effect ? { effect } : {}), ...(sixDim ? { sixDim } : {}) });
        setInv(iv => [...iv, { ...forgedItem, id: `forge_${parts[2]}_${Math.random().toString(36).slice(2, 6)}`, equipped: false }]);
        deliveredNames.push({ text: `${name}（${quality}）`, jade: isJade });
      }
      const anyJade = deliveredNames.some(d => d.jade);
      const namesStr = deliveredNames.map(d => d.text).join("」「");
      addLog([{ t: "item", text: anyJade
        ? `  💎 金玉行的伙计寻来，将雕琢好的「${namesStr}」奉到你手上，已收入行囊。`
        : `  🔨 铁匠铺的伙计寻来，将打造好的「${namesStr}」送到你手上，已收入行囊。` }]);
      return prev.filter(f => !matured.includes(f));
    });
    setVarTree(prev => {
      const chars = prev.角色 || {};
      let changed = false;
      const nextChars = { ...chars };
      for (const [name, attrs] of Object.entries(chars)) {
        if (attrs.生气状态?.active) {
          const nextAngry = tickAngryState(attrs.生气状态);
          nextChars[name] = { ...attrs, 生气状态: nextAngry };
          changed = true;
          if (nextAngry.escalated) {
            addLog([{ t: "err", text: `  ${name}积怒难平，终于按捺不住，径直朝你逼了过来——这场恶斗，躲不掉了！` }]);
            // 强制开战：如果这个NPC此刻恰好在场，直接把他标记为待强制切磋对象，
            // 由下方另一个effect负责真正弹出战斗界面（避免在setVarTree回调里直接
            // setDuelingNpc引发同一渲染周期内的状态更新冲突）。
            const npcInRoom = room.npcs.find(n => n.name === name);
            if (npcInRoom) setForcedDuelNpc(npcInRoom);
          }
        }
      }
      return changed ? { ...prev, 角色: nextChars } : prev;
    });
  }, [time, addLog, room.npcs]);

  useEffect(() => {
    if (forcedDuelNpc) {
      setDuelingNpc(forcedDuelNpc);
      setForcedDuelNpc(null);
    }
  }, [forcedDuelNpc]);

  // 每天/每进新据点，往 room.npcs 里注入今日游走人口
  const dayIdx = Math.floor(time / 24);
  useEffect(() => {
    if (!room.name) return;
    // toRoomNpc 只给 {id,name,brief,carriedItems}，没有 combatStats/special/moveset——
    // 之前这些游走NPC就这样直接进了room.npcs，一旦被切磋/细看，DuelScreen 只能
    // 摸到一堆 undefined，要么崩要么变成假人。这里跟初始房间NPC用同一套
    // ensureNpcCombatData + 关键词判档，游走人口该多强由他们的brief/personality决定。
    const luck = char.special?.气运 ?? 5;
    const toRoomNpcWithCombat = (poolNpc) => {
      const base = toRoomNpc(poolNpc);
      // toRoomNpc 面向游走池、只留 id/name/brief——会把驻场/野兽NPC 显式设定的
      // levelCap 和 beast/unlearnable/cannotSpeak 等关键字段剥掉，导致品阶被
      // 关键词猜测覆盖、野兽标记丢失。这里把这些字段补回来，让 residentNpcs.js
      // 里设定的档位真正生效（此前是隐性失效的）。
      // 【本轮修复】companionCandidate 漏在这份白名单外——雪豹作为驻场NPC，
      // 经这一步转换后 companionCandidate 字段丢失，导致 NpcActionMenu.jsx 的
      // canInvite 判断永远拿到 undefined，"邀请入队"按钮完全不显示（实测反馈）。
      for (const k of ["levelCap", "beast", "unlearnable", "cannotSpeak", "affectionable", "fullBio", "personality", "burdenMoveIds", "carry", "gambleBidder", "lockInnerRoom", "bidderKind", "companionCandidate", "guaranteedDrop"]) {
        if (poolNpc[k] !== undefined) base[k] = poolNpc[k];
      }
      const inferred = mapDescriptionToGenParams(`${poolNpc.name || ""} ${poolNpc.brief || ""} ${poolNpc.personality || ""}`);
      // 显式 levelCap 优先，没有才用关键词推断兜底
      const levelCap = poolNpc.levelCap ?? inferred.levelCap;
      return ensureNpcCombatData(base, { luck, levelCap });
    };
    const poolNpcs = getScheduledNpcs(room.name, time).map(toRoomNpcWithCombat);
    // 据点固定驻场NPC：跟护镖目标NPC同一个强制注入模式，不受随机权重
    // 影响——巴桑/丹增/兰姐/罗琦这类具名剧情角色，只要玩家进了对应据点
    // 就必须真实存在于 room.npcs 里，感叹号面板才能检测到他们的任务
    // （面板判定逻辑就是简单的 room.npcs.some(n => n.name === giver)，
    // 见 findQuestByGiver 附近逻辑）。见 residentNpcs.js 的完整说明。
    // 雪豹一旦入队，它作为"村口驻场兽"的身份就结束了——不再注入房间。此后它只以
    // "队友"身份通过 visibleNpcsForAI 单独随玩家在场（形影不离），不再是某个据点的
    // 固定驻场人物。用 companionState ref 读最新值（effect 依赖数组不含 companionState，
    // 靠 ref 拿到入队后的最新状态，避免仅靠 deps 触发导致的时序问题）。
    const leopardJoined = companionStateRef.current?.snowLeopard?.unlocked;
    const residentNpcs = getResidentNpcs(room.name)
      .filter(n => !(leopardJoined && n.name === "雪豹" && n.companionCandidate))
      .map(toRoomNpcWithCombat);
    // 护镖任务的系统保证：接了镖之后，targetNpc 当天必须真的能在 targetLocation 找到，
    // 不能靠 getScheduledNpcs 的随机权重抽样"赌"到——那样任务会随机卡死无法交货。
    // 强制把还差在场的目标NPC塞进来，不受权重采样结果影响。
    const activeEscortTargets = ESCORT_QUESTS
      .filter(q => questProgress[q.id]?.active && q.targetLocation === room.name && !flags.includes(`quest_done_${q.id}`))
      .map(q => NPC_POOL.find(n => n.name === q.targetNpc))
      .filter(Boolean)
      .map(toRoomNpcWithCombat);
    // 赌石竞价者：固定锁料场的 gambleBidder 全部强制注入（不随机，保证料场有竞价者）；
    // 另加 schedule 分时段角色（兰姐）——只有当她"此刻"的时段落点正好是玉石料场时才注入
    // （白天在料场竞价、夜里回百花楼）。用 getTimeStr 同源的 hour 判断，与 getScheduledNpcs 一致。
    const hourNow = ((time % 24) + 24) % 24;
    const gambleBidders = (hasInnerMap(room.name) && getInnerRoomNames(room.name).includes("玉石料场"))
      ? [
          ...NPC_POOL.filter(n => n.gambleBidder && n.lockInnerRoom === "玉石料场").map(toRoomNpcWithCombat),
          ...NPC_POOL.filter(n => Array.isArray(n.schedule)
            && n.schedule.some(s => hourNow >= s.slot[0] && hourNow < s.slot[1] && s.lockInnerRoom === "玉石料场"))
            .map(n => { const r = toRoomNpcWithCombat(n); r.lockInnerRoom = "玉石料场"; return r; }),
        ]
      : [];
    const toInject = [...poolNpcs, ...residentNpcs, ...activeEscortTargets, ...gambleBidders];
    if (toInject.length === 0) return;
    // 游走/护镖NPC随机落内层房间（本轮改版）：若当前据点有内层箱庭，给每个
    // 非驻场NPC分配一个当天固化的内层房间（可落任意房间，含客栈/铺子）。用
    // seededRand(dayIdx, 据点+人名) 保证同一人当天落点稳定、跨天才变，避免进出
    // 房间时人物乱跳。驻场NPC（residentNpcs，走 residentNpcName 绑定）不分配。
    if (hasInnerMap(room.name)) {
      const rooms = getInnerRoomNames(room.name);
      const residentSet = new Set(residentNpcs.map(n => n.name));
      for (const n of toInject) {
        if (residentSet.has(n.name)) continue; // 驻场人不分配落点
        if (n.innerRoom) continue;             // 已分配过（当天）就不重抽
        if (n.lockInnerRoom) { n.innerRoom = n.lockInnerRoom; continue; } // 赌石竞价者等：落点强制锁定
        if (rooms.length === 0) continue;
        const rng = seededRand(dayIdx, `${room.name}|${n.name}`);
        n.innerRoom = rooms[Math.floor(rng() * rooms.length)];
      }
    }
    // 注入：该在场的人放进来，已在名单里的补齐设定（injectNpcs 内含 bug② 的修法）
    setRoom(r => ({ ...r, npcs: injectNpcs(r.npcs, toInject) }));
  }, [room.name, dayIdx, questProgress, flags]); // eslint-disable-line react-hooks/exhaustive-deps

  // 采集机制·注入：玩家进入某据点时，若有 active 采集任务的目标物落在本据点、
  // 且背包尚无、地上尚无，就把它真的放进 room.items——落实「地上得真有那个东西
  // 能捡，不能凭空」。捡起后（背包已有）此 effect 自然不再补货，不会重复刷。
  useEffect(() => {
    if (!room.name) return;
    const pending = pendingGroundItems(room.name, {
      questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv, roomItems: room.items,
    });
    if (!pending.length) return;
    setRoom(r => {
      const have = new Set((r.items || []).map(i => (typeof i === "string" ? i : i.name)));
      const toAdd = pending.filter(p => !have.has(p.name));
      if (!toAdd.length) return r;
      return { ...r, items: [...(r.items || []), ...toAdd] };
    });
  }, [room.name, questProgress, inv]); // eslint-disable-line react-hooks/exhaustive-deps

  // 地上陈设物·注入：每个据点地上摆几件无主的环境物（见 groundItems.js），让场景
  // 不再空荡荡，玩家可拾/可端详。照搬上面采集物的"背包尚无 + 地上尚无才补货"模式——
  // 捡进背包后此 effect 自然不再补，不会重复刷；读档后非当前据点缓存丢失，重进时按
  // 背包过滤重铺（捡过且仍在背包的不重现），与采集物同待遇。地上物是据点级共享
  // （room.items 不区分内层房间，项目一贯如此），故按 room.name 取表。
  useEffect(() => {
    if (!room.name) return;
    const spec = GROUND_ITEMS[room.name];
    if (!spec || !spec.length) return;
    setRoom(r => {
      const haveGround = new Set((r.items || []).map(i => (typeof i === "string" ? i : i.name)));
      const haveInv = new Set((inv || []).map(i => (typeof i === "string" ? i : i.name)));
      const toAdd = spec.filter(s => !haveGround.has(s.name) && !haveInv.has(s.name)).map(s => makeGameItem(s));
      if (!toAdd.length) return r;
      return { ...r, items: [...(r.items || []), ...toAdd] };
    });
  }, [room.name, inv]); // eslint-disable-line react-hooks/exhaustive-deps

  // 采集机制·跳过跑腿：某些采集节点是多条任务线共用的同一件东西（如燕羊胎既是
  // 兰姐线辅料，又是欢喜教线的交涉条件）。若所需物已在背包（在别处已采过），
  // 这一步就该直接算完成，不必再跑一趟——由系统裁决，不劳 AI。
  useEffect(() => {
    const done = alreadySatisfiedCollectStages({
      questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv,
    });
    if (!done.length) return;
    const { quest, flag } = done[0]; // 一次推进一个，推进后 questProgress 变化会再触发本 effect 处理下一个
    forceAdvanceQuest(quest, flag);
    addLog([{ t: "affection", text: `  ✓ 采集所需之物早已在身，「${quest.title}」自动推进。` }]);
  }, [questProgress, inv]); // eslint-disable-line react-hooks/exhaustive-deps

  // 护镖任务：到达目标据点时给玩家提示
  useEffect(() => {
    if (!room.name) return;
    const activeEscort = ESCORT_QUESTS.find(q => {
      const prog = questProgress[q.id];
      return prog?.active && q.targetLocation === room.name && !flags.includes(`quest_done_${q.id}`);
    });
    if (activeEscort) {
      addLog([{ t: "sys", text: `  ※ 护镖任务「${activeEscort.title}」目的地到了，在此处找到 ${activeEscort.targetNpc} 交货即可完成。` }]);
    }
  }, [room.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // 多阶段任务链系统裁决层（虎胆三重门等，见总纲第七章7.1/7.2/7.4）：
  // AI 只需要在叙事到位时通过已有的 flags_add 机制吐出对应 stage 的
  // completionFlag 字符串，stage 推进、互斥锁定、结局判定全部交给系统状态机，
  // 不再靠 AI 自己记住"现在第几阶段""这条线是否已经被另一条线锁死"。
  useEffect(() => {
    const stageQuests = QUCUO_QUESTS.filter(q => q.stages?.length);
    if (!stageQuests.length) return;
    const gameState = { flags, char };
    let next = { ...questProgress };
    let changed = false;
    const justCompletedIds = [];
    const pendingRewards = [];

    for (const quest of stageQuests) {
      if (!isQuestGateOpen(quest, next, flags)) continue;
      if (quest.id === "hidden_all_collect_line" && !canBypassExclusive(gameState)) continue;

      let prog = next[quest.id];
      if (!prog) {
        const firstFlag = quest.stages[0].completionFlag;
        const firstFlagHit = Array.isArray(firstFlag) ? firstFlag.some(f => flags.includes(f)) : flags.includes(firstFlag);
        if (!firstFlagHit) continue;
        prog = createQuestProgress(quest.id);
        changed = true;
      }
      if (prog.status !== "active") continue;

      // 一次性把已经满足条件的连续 stage 全部推进完（防止 AI 一轮叙事里
      // 同时带出好几个 stage 的 flag 时，系统只推进一格、卡在半路）。
      // 每推进过一个 stage，就把它的 onReach 奖励收集起来——不只是最后一个
      // stage 才发奖励，中途 stage 也可能带物品/好感度变化（比如村1的三选一）。
      let advancedAny = false;
      while (prog.status === "active") {
        const result = advanceQuestStages(quest, prog, gameState);
        if (!result.advanced) break;
        prog = result.progress;
        advancedAny = true;
        if (result.completedStage) {
          const rewards = resolveStageRewards(result.completedStage, result.hitFlags);
          if (rewards) pendingRewards.push(rewards);
        }
        if (result.justCompleted) { justCompletedIds.push(quest.id); break; }
      }
      if (advancedAny) { next[quest.id] = prog; changed = true; }
    }

    for (const qid of justCompletedIds) {
      next = lockExclusiveSiblings(next, QUCUO_QUESTS, qid);
      changed = true;
      const quest = stageQuests.find(q => q.id === qid);
      addLog([{ t: "sys", text: `  ※ 任务「${quest.title}」已完成。${quest.rewardText || ""}` }]);
    }
    if (changed) setQuestProgress(next);
    for (const rewards of pendingRewards) {
      applyStageRewards(rewards, { setInv, setChar, setVarTree, setFlags });
    }

    // 关键道具（虎胆）持有者追踪——见总纲第七章7.3节，供AI/系统查表用，
    // 不直接展示给玩家。只在明确的流转节点更新，不覆盖未涉及的部分。
    if (justCompletedIds.length) {
      setVarTree(vt => {
        let nvt = initKeyItemTracking(vt);
        if (justCompletedIds.includes("zhaxi_line")) {
          nvt = transferKeyItem(nvt, "虎胆", "土司府", "抵税所得，库房封存", time, "扎西献虎胆抵税，管家「明年照收」");
        }
        return nvt;
      });
    } else if (flags.includes("quest_zhaxi_s3") && getKeyItemState(varTreeRef.current, "虎胆")?.holder !== "扎西") {
      setVarTree(vt => transferKeyItem(initKeyItemTracking(vt), "虎胆", "扎西", "已猎得，尚未献出", time, "扎西在熊山猎得虎胆"));
    } else if (flags.includes("quest_allin_s2") && getKeyItemState(varTreeRef.current, "虎胆")?.holder !== "玩家") {
      setVarTree(vt => transferKeyItem(initKeyItemTracking(vt), "虎胆", "玩家", "夜闯土司府偷回", time, "玩家夜闯土司府偷回虎胆"));
    }

    const resolvedEnding = resolveEnding(gameState);
    if (resolvedEnding && !flags.includes(`story_ending_${resolvedEnding}`)) {
      setFlags(f => [...new Set([...f, `story_ending_${resolvedEnding}`])]);
      addLog([{ t: "sys", text: `  ※ 「虎胆三重门」结局已判定：${resolvedEnding}` }]);
    }
  }, [flags]); // eslint-disable-line react-hooks/exhaustive-deps

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
        { t: "stat", text: `  气血 ${bar(char.hp[0], char.hp[1])} ${char.hp[0]}/${char.hp[1]}` },
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

  const talkToNarrator = useCallback(async (content) => {
    setPendingTalks(n => n + 1);
    addLog([{ t: "cmd", text: `> 对旁白：${content}` }]);
    setInput("");

    // 行动分层日志（本轮补齐）：私聊旁白此前完全不进 trace 系统——虽然底层
    // callModel/callModelStream 早就把每次调用的完整 prompt/回复记进了
    // pipelineLog，但没有一条 trace 把它"挂"出来，顶部「🧭行动日志」面板
    // 里看不到任何私聊痕迹，出问题（旁白答非所问/召回没生效）时无从排查。
    // 补法与 act() 一致：startTrace 开局、traceStep 记各阶段、attachPipeline
    // 挂真实 prompt/回复、endTrace 收尾。不消耗回合这件事不变——trace 只是
    // 记录，不代表计入时间。
    const _wt = startTrace(content, content);
    traceStep(_wt, "意图分类", "pass", "模式=私聊旁白（不消耗回合）");

    if (narrator.stage === NNPC_STAGE.CRASHED) {
      traceStep(_wt, "旁白状态", "block", "旁白已崩溃(CRASHED)，本地兜底话术，未调用AI");
      const flat = ["信号已断开。", "无法连接。", "……无应答。", "她不在这里。"];
      const flatText = flat[Math.floor(Math.random() * flat.length)];
      addLog([{ t: "narrator", text: `  「旁白」${flatText}` }]);
      endTrace(_wt, `旁白已崩溃，本地兜底："${flatText}"`);
      setPendingTalks(n => Math.max(0, n - 1));
      talkBusyRef.current = false; // 释放私聊闸门
      return;
    }

    try {
      const voice = narratorVoicePrompt(narrator);
      // 背包物品是对象（{name,quality,...}），直接 inv.join(",") 会得到一串
      // [object Object]，旁白根本读不出玩家身上有什么——这正是"玩家捡了界石、
      // 旁白却坚称背包里只有青稞粗布"那个 bug 的根源。跟主叙事 invText 对齐，
      // 取名字+品阶+是否装备，字符串物品也兼容。
      const narratorInvText = inv.map(i => typeof i === "string" ? i : `${i.name}(${i.quality}${i.equipped ? "·已装备" : ""})`).join("，") || "空";
      const worldState = `[当前世界状态，仅供你了解背景，不必主动复述] 主角:${char.name || "无名少侠"}〔${char.gender || "男"}〕 时间:${getTimeStr(time)} 房间:${room.name}${hasInnerMap(room.name) && innerRoomName ? `·${innerRoomName}` : ""}（${room.desc}） 房间里的人:${room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n)).map(n => n.name).join(",") || "无"} 玩家背包:${narratorInvText}`;

      // ── 旁白·全知事实（本轮新增）──
      // 旁白设定上是跳出信息隔离的第四面墙外角色，普通 NPC 之间发生的事（哪怕玩家没
      // 亲口跟她说过）她也该"看在眼里"。knowledge.js 的事实账本本来就是全局记账，
      // 不受"是否在场""是否目击"这层限制，直接全量读给她——不依赖 embedding 开关，
      // 也不需要玩家跟她提过。注意：这条只读普通事实账本，不读旁白私聊内容本身
      // （私聊走的是下面 convo 共享那条独立渠道，两者不混）。
      let factsBlock = "";
      {
        // 条数（绿灯·批五）：20→8。私聊本就是短回合（maxTokens 见 callTokenLimits.narratorWhisper），旁白也只会顺口提一两件；
        // 喂 20 条里绝大多数是陪跑，还把真正相关的那几条冲淡。取最近 8 条，更近更准也更省。
        const facts = allFactSummaries(varTreeRef.current, 8);
        if (facts.length) {
          factsBlock = "\n\n[你冷眼旁观知晓的事，未必是玩家亲口告诉过你的，回应时可以自然提起，但不要生硬列举或表现得像在念清单]\n"
            + facts.map(f => `· （${getTimeStr(f.诞生回合 || 0)}）${f.摘要}${f.标签 ? `〔${f.标签}〕` : ""}`).join("\n");
          traceStep(_wt, "全知事实", "pass", `注入最近${facts.length}条事实账本摘要`);
        } else {
          traceStep(_wt, "全知事实", "skip", "事实账本为空，未注入");
        }
      }

      // 向量召回：让旁白"记起"可能早已滑出对话窗口的往事（与她"记得游戏里发生一切"的设定一致）。
      // 降级安全：没开向量或召回失败则 recallInfo 为 null，这段完全不影响私聊。
      let recallInfo = null;
      let recallBlock = "";
      if (embeddingReady(apiCfg)) {
        const lastAiText = [...convo].reverse().find(m => m.role === "assistant")?.content || "";
        const focusEntities = Array.from(new Set([...room.npcs.map(n => n.name), ...Object.keys(varTreeRef.current.角色 || {}), room.name]));
        recallInfo = await recallWithVisibility({
          cfg: apiCfg, queryText: content,
          contextText: `${lastAiText}\n[当前]位置:${room.name}`,
          focusEntities, unlockedFlags: flags, presentNames: ["旁白"], topK: 5,
        });
        if (recallInfo && recallInfo.visible.length) {
          recallBlock = "\n\n[你记得的往事，与此刻私聊相关，供你回应时自然照应，不要生硬复述]\n"
            + recallInfo.visible.map(m => `· （第${m.meta.turn}回合）${m.tier === "weak" && m.text.length > 40 ? m.text.slice(0, 40) + "…" : m.text}`).join("\n");
          traceStep(_wt, "向量召回", "pass", `召回${recallInfo.visible.length}条相关往事`);
        } else {
          traceStep(_wt, "向量召回", "skip", "已开启但本轮无相关召回结果");
        }
      } else {
        traceStep(_wt, "向量召回", "skip", "embedding未开启，跳过召回");
      }
      // scenario 蓝绿灯（与 act 同一套 gateScenario）：私聊此前直接拼 preset.scenario 全文，
      // 于是每次闲聊都要背一遍地图拓扑、契诃夫之枪、路途遭遇、装备品质六档表——
      // 聊天一句用不上，纯烧上下文，还把她往说书人腔调上拽。scope 走独立的 "whisper"
      // （不在任何条目的 scopes 里），因此专项段全靠关键词点亮：玩家问路才亮拓扑，
      // 提到人名才亮具名人物，聊到掉落才亮装备规则。认不出标题的段落照旧常驻（蓝灯），
      // 用户改过 scenario 或换自定义预设都不会因这层分流丢内容。
      const _lastReply = [...convo].reverse().find(m => m.role === "assistant")?.content || "";
      const _whisperGate = gateScenario(preset.scenario, {
        scope: "whisper",
        userInput: content,
        lastReply: _lastReply,
      });
      if (_whisperGate.lit.length || _whisperGate.dark.length) {
        traceStep(_wt, "世界书·总纲", "info",
          `🟢${_whisperGate.lit.join("、") || "无"}　⚫灭:${_whisperGate.dark.join("、") || "无"}`);
      }

      // 私聊话题红绿灯（身世/赌石邀帖等冷门追问）：默认不给，命中关键词才点亮。
      // 与上面 scenario 的"默认全给、按条目灭灯"相反，是加法而非减法——这些条目
      // 绝大多数轮次用不上，常驻只会白烧上下文；但玩家一旦问起，必须有统一口径，
      // 否则模型只能现编，这局说是将门遗孤、下局说是灭门孤儿。
      const _scan = `${content}\n${_lastReply}`;
      const _topicGate = gateWhisperTopics(_scan);
      if (_topicGate.lit.length) {
        traceStep(_wt, "私聊话题·红绿灯", "pass", `🟢${_topicGate.lit.join("、")}`);
      } else {
        traceStep(_wt, "私聊话题·红绿灯", "skip", "本轮无话题命中");
      }

      // 任务线红绿灯：报出任务全名才查那一条，泛泛问只让她反问；好感度 <30 不给。
      // 全任务表二十几条线、每条四五个 stage，全量注入等于每次闲聊背一本攻略书。
      const _questGate = gateQuestTopic(_scan, narrator.affection, QUCUO_QUESTS, questProgress);
      if (_questGate.lit.length) {
        traceStep(_wt, "任务线·红绿灯", "pass", `🟢${_questGate.lit.join("、")}`);
      } else {
        traceStep(_wt, "任务线·红绿灯", "skip", "本轮没聊到任务");
      }

      // 体貌：私聊时公开层常亮（她一直看着你），私密层仍只认 ■ 模式。
      const _bodyWhisper = gateBodyProfile(char.bodyProfile, {
        whisper: true, nsfw: nsfwOn, scanText: _scan,
      });
      if (_bodyWhisper.lit.length || _bodyWhisper.dark.length) {
        traceStep(_wt, "体貌", "info",
          `🟢${_bodyWhisper.lit.join("、") || "无"}　⚫灭:${_bodyWhisper.dark.join("、") || "无"}`);
      }

      // 旁白专属世界书（设置→旁白 tab 可编辑）：只进私聊，不进主叙事。留空则一个字不发。
      const loreText = (apiCfg.narratorLorebook || "").trim();
      const narratorLoreBlock = loreText
        ? `\n\n[旁白专属设定，只有你自己知道，玩家看不到这段文字，不要复述它的存在]\n${loreText}`
        : "";
      if (loreText) traceStep(_wt, "旁白专属世界书", "pass", `注入${loreText.length}字`);

      // 篇幅指令拼在最末尾（贴生成处 = 酒馆 Depth 0，是插入深度最强的位置，
      // 与「成文铁律放 userContent 末尾」同一条经验），别埋进开头被当耳旁风。
      //
      // ── 海内私聊：整套 system 换成创伤线专用 ──
      // 她此刻不是"被抽出来对话的旁白"，而是一个人蜷在沙发上。
      // 全知事实、旁白世界书、分档攻略、剧本总纲这些在这儿全不适用（她不在讲故事），
      // 只留：创伤线阶段 prompt + 向量召回（她记得你们一路的事）+ 篇幅。
      const inSeaNow = isInSea(narrator.stage) && room.name === SEA_OF_MIND.district;
      const seaVars = narratorVars(varTreeRef.current);
      // 起居注进私聊：她本来就是"记得游戏里发生一切"的角色，聊天时却不知道你今天
      // 干了什么很奇怪。累计只在第六档给——那时账本是她在记（见 tally 里的注释）。
      // 海里那条路不给：她此刻蜷在沙发上，谁还管你今天走了几步路。
      const tallyBlock = inSeaNow ? "" : describeTallyForWhisper(
        varTreeRef.current.世界?.起居注, timeRef.current,
        { includeLifetime: narrator.stage === NNPC_STAGE.RESOLVED },
      );
      const sys = inSeaNow
        ? `${seaDialoguePrompt({ stage: narrator.stage, comfort: seaVars.comfort, spokenKeys: seaVars.knots || [], STAGES: NNPC_STAGE })}${recallBlock}\n${narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords)}`
        : `${buildNarratorWhisperContext(narrator.affection)}\n${voice}\n\n${worldState}${factsBlock}${recallBlock}${tallyBlock}${narratorLoreBlock}${_bodyWhisper.text}${_topicGate.text}${_questGate.text}\n\n剧本背景设定：${_whisperGate.text}\n${narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords)}`;

      // 共享主引擎的完整历史 convo，这样她"记得"游戏里发生的一切，
      // 包括之前私聊聊过什么——因为私聊内容也会被记入同一份 convo（见下方 setConvo）。
      // 对话类同样取至少 20 层全部互动。
      const talkWindow = Math.max(apiCfg.contextWindow, 20);
      const hist = convo.length > talkWindow ? convo.slice(-talkWindow) : convo;
      // 私聊不需要像叙事那么长，但 600 这个旧硬编码在带思考的模型下会被思考 token 吃穿、
      // 正文半句就撞 length 截断，故改读可调的 callTokenLimits.narratorWhisper（默认 6000）。
      const narratorMaxTokens = Math.min(apiCfg.maxTokens, apiCfg.callTokenLimits?.narratorWhisper ?? 6000);

      let text;
      let affDelta = 1; // ② 内容化好感：默认寻常闲聊 +1，被 ⟦好感X⟧ 标记覆盖
      let hadAffTag = false; // 标记是否真出现过 ⟦好感X⟧——没出现时的 +1 是兜底，不是她给的分
      let finishReason;      // 停止原因：私聊此前完全没接这个字段，撞 length 上限也毫无提示
      // 模型会照着历史里的「（旁白私聊回应）」前缀自己也写一遍，而下面存 convo 时又会
      // 再加一次，于是前缀逐轮累积成「（旁白私聊回应）（旁白私聊回应）…」。存之前先剥干净：
      // 前缀由系统负责加，模型自己写的一律不算数。
      const stripEchoPrefix = (s) => s.replace(/^(?:\s*[（(]\s*旁白私聊回应\s*[）)])+\s*/, "");
      const parseAffTag = (s) => {
        const m = s.match(/⟦好感\s*([+-]?\d+)\s*⟧\s*$/);
        const d = m ? Math.max(-3, Math.min(6, parseInt(m[1], 10) || 0)) : 1;
        return { text: s.replace(/⟦好感\s*[+-]?\d+\s*⟧\s*$/, "").trim() || "……", delta: d, tagged: !!m };
      };
      if (apiCfg.streamEnabled && apiCfg.apiType !== "gemini") {
        const logIdx = { current: null };
        addLog([{ t: "narrator", text: "  「旁白」▌", streaming: true }]);
        setLog(l => { logIdx.current = l.length - 1; return l; });
        const { text: streamedText, finishReason: fr } = await callModelStream(
          apiCfg, sys, [...hist, { role: "user", content: `（私聊）${content}` }],
          (_delta, fullSoFar) => {
            setLog(l => {
              if (logIdx.current == null) return l;
              const copy = [...l];
              copy[logIdx.current] = { t: "narrator", text: `  「旁白」${fullSoFar} ▌`, streaming: true };
              return copy;
            });
          },
          { maxTokens: narratorMaxTokens, recallInfo },
        );
        finishReason = fr;
        text = stripEchoPrefix(streamedText.trim()) || "……";
        { const pr = parseAffTag(text); text = pr.text; affDelta = pr.delta; hadAffTag = pr.tagged; }
        setLog(l => {
          if (logIdx.current == null) return l;
          const copy = [...l];
          copy[logIdx.current] = { t: "narrator", text: `  「旁白」${text}` };
          return copy;
        });
        traceStep(_wt, "AI调用", "pass", "流式一次成功");
        attachPipeline(_wt, getPipelineLog()[0]);
      } else {
        const result = await callModel(apiCfg, sys, [...hist, { role: "user", content: `（私聊）${content}` }], { maxTokens: narratorMaxTokens, recallInfo, callLabel: "私聊" });
        finishReason = result.finishReason;
        text = stripEchoPrefix(result.text.trim()) || "……";
        { const pr = parseAffTag(text); text = pr.text; affDelta = pr.delta; hadAffTag = pr.tagged; }
        addLog([{ t: "narrator", text: `  「旁白」${text}` }]);
        traceStep(_wt, "AI调用", "pass", "非流式一次成功");
        attachPipeline(_wt, getPipelineLog()[0]);
      }

      // ── 截断检查（本轮补齐）──
      // 主叙事那条路一直有 finishReason 判定 + 自动重说，私聊却把这个字段整个丢掉了，
      // 撞上限时界面上毫无提示，只表现成"她话说一半"，排查时无从下手。
      // 附带一个更隐蔽的危害：⟦好感X⟧ 要求写在整段最末尾，被截断就一定读不到，
      // parseAffTag 于是兜底 +1——她明明在敷衍，系统却在给玩家加好感。
      // 这里不自动重试（私聊不消耗回合、玩家再问一句即可，重试反而多烧一次钱），
      // 只把真相摆到台面上：日志提示 + trace 留痕 + 好感度按"未表态"处理成 0。
      const whisperHitCap = /length|max[_ ]?tokens|max[_ ]?output/i.test(finishReason || "");
      if (whisperHitCap) {
        traceStep(_wt, "截断检查", "block", `撞 token 上限（finishReason=${finishReason}），本轮回复不完整`);
        addLog([{ t: "sys", text: `  ⚠ 旁白这句话没说完就撞上了 token 上限（当前 ${narratorMaxTokens}）。可在 设置 → 旁白 里调大「私聊 token 输出上限」。` }]);
        if (!hadAffTag) affDelta = 0; // 没读到她的表态就别替她表态
      }

      // 把这轮私聊也计入主引擎共享的对话历史，让旁白（以及之后的叙事）都能"记得"这次私聊
      setConvo(c => [...c, { role: "user", content: `（私聊）${content}` }, { role: "assistant", content: `（旁白私聊回应）${text}` }]);

      // 私聊旁白也浓缩一张私有小纸条，owner=旁白（你俩私有，只在旁白语境下浮现，
      // 不进任何 NPC 的信息域）——与「对话模式=owner对话对象」同属"私语只你俩知道"这一类。
      jotNote({ text: `与旁白私语：${content.slice(0, 24)}${content.length > 24 ? "…" : ""}`, owner: [{ name: "旁白", via: VIA.FIRSTHAND }], source: NOTE_SOURCE.WHISPER });

      // trace 收尾：摘要带上回复内容前段（trace 面板本身有完整 pipeline 可看全文，
      // 这里摘要只做一句话定位用，避免摘要行本身过长）和好感度增量，
      // 让「行动分层日志」列表一眼能看出这次私聊聊到了什么、好感怎么变的。
      const textPreview = text.length > 30 ? text.slice(0, 30) + "…" : text;
      endTrace(_wt, `旁白回应："${textPreview}"（好感${affDelta >= 0 ? "+" : ""}${affDelta}）`);

      // ── 海内：好感不动，改判"这一轮她有没有把当前那条心结说出来" ──
      // 创伤期的进度靠安抚与倾听推进，不靠聊天涨好感（她此刻不是在被追求）。
      // 判定放本地关键词初筛：AI 已经拿到了那条心结的 guide，它写出来的正文里
      // 必然带那几个核心意象；宁可放宽也不要卡住玩家——他都陪到这儿了。
      if (inSeaNow) {
        const kv = narratorVars(varTreeRef.current);
        const cur = availableKnot(kv.comfort, kv.knots || []);
        if (cur) {
          const HINT = {
            hebe:   ["没有回头", "没回头", "等过", "他没有看", "不理", "没看见我"],
            corner: ["墙角", "那堵墙", "墙是凉", "推我", "打我", "小时候"],
            doll:   ["布偶", "那个女人", "不看我", "她不看", "娃娃"],
          }[cur.key] || [];
          if (HINT.some(h => text.includes(h))) {
            const nextKnots = [...(kv.knots || []), cur.key];
            setVarTree(prev => setNarratorVars(prev, { knots: nextKnots, questStage: 3 }));
            addLog([{ t: "affection", text: `  ⟡ 她把「${cur.title}」说出来了。` }]);
            if (canResolve(kv.comfort, nextKnots)) {
              addLog([{ t: "sys", text: "  ⟡ 三个心结都说尽了。她在等你说一句她自己说不出口的话。" }]);
            }
          }
        }
        endTrace(_wt, `海内私聊："${textPreview}"`);
      }

      // 非海内才走好感结算。刻意不用 early return——函数尾部（try/catch 之外）
      // 统一释放 pendingTalks 与 talkBusyRef 闸门，从这里 return 会跳过它，
      // 要么闸门永久锁死、要么得在这儿重复释放一次（两处释放又会多减一次）。
      if (!inSeaNow) setNarrator(n => {
        if (n.confessed) {
          const mf = n.memoryFragments + 1;
          if (mf >= 8) {
            addLog([
              { t: "sys", text: "" },
              { t: "crash", text: "  ……她的声音忽然卡顿了一下。" },
              { t: "crash", text: "  「等等——这些记忆，不该在这里。」" },
              { t: "crash", text: "  文字开始扭曲，随即恢复成最初那种没有温度的公式化语气。" },
              { t: "sys", text: "" },
            ]);
            return { ...n, stage: NNPC_STAGE.CRASHED, memoryFragments: mf };
          }
          return { ...n, memoryFragments: mf };
        }
        // 旁白好感同样吃日上限。她走的是 ⟦好感N⟧ 这条路、不经 applyMvuCommands，
        // 所以那边的节流管不到她——而 90 是整条个人线的门槛（真容立绘＋心灵之海），
        // 能一天刷满就等于门禁形同虚设。只限正向，掉好感不限。
        let capped = affDelta;
        if (affDelta > 0) {
          const led = varTreeRef.current.世界?.好感日增;
          const day = Math.floor((timeRef.current || 0) / 24);
          const gained = (led && led.dayStamp === day) ? { ...(led.gained || {}) } : {};
          const already = Number(gained["旁白"]) || 0;
          const room = Math.max(0, 12 - already);
          capped = Math.min(affDelta, room);
          if (capped <= 0) {
            addLog([{ t: "sys", text: "  （今日与她已够亲近了。改日再来。）" }]);
          } else {
            gained["旁白"] = already + capped;
            setVarTree(prev => {
              const next = JSON.parse(JSON.stringify(prev || {}));
              if (!next.世界) next.世界 = { 威望: 0 };
              next.世界.好感日增 = { dayStamp: day, gained };
              return next;
            });
          }
        }
        const inc = Math.max(-n.affection, Math.min(capped, 100 - n.affection));
        if (inc !== 0) {
          const next = n.affection + inc;
          addLog([{ t: "affection", text: `  💗 好感度 ${inc > 0 ? "+" : ""}${inc}（${n.affection} → ${next}）` }]);
          return { ...n, affection: next };
        }
        return n;
      });
    } catch (e) {
      traceStep(_wt, "AI调用", "fail", `私聊失败：${e.message || e}`);
      attachPipeline(_wt, getPipelineLog()[0]);
      endTrace(_wt, `私聊中断（${e.message || e}）`);
      addLog([{ t: "err", text: `  [错误] ${e.message}` }]);
    }
    noteAction("whisper");
    setPendingTalks(n => Math.max(0, n - 1));
    talkBusyRef.current = false; // 释放私聊闸门（成功/失败所有路径都到这，确保不会永久锁死）
  }, [narrator, addLog, apiCfg, convo, time, room, inv, preset, varTree, flags, jotNote, char, nsfwOn, questProgress]);

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
      put("npc_lore", buildNpcLoreBlock(matchNpcLore(preset, visible.map(n => n.name).join("，"), visible.map(n => n.name))) || "（本轮无在场者需注入人设）");
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
  const recommendOutfit = useCallback(async () => {
    const profile = char.bodyProfile;
    if (bodyProfileFilled(profile).total === 0) {
      setOutfitState({ loading: false, picks: [], error: "先写点体貌，掌柜才有的可挑。" });
      return;
    }
    setOutfitState({ loading: true, picks: [], error: "" });
    try {
      // 货架 = 装备三类的全部具名+制式条目。杂货(misc)不是穿戴的，不进池子。
      const pool = CATALOG.filter(e =>
        e.category === ITEM_CATEGORY.WEAPON ||
        e.category === ITEM_CATEGORY.ARMOR ||
        e.category === ITEM_CATEGORY.ACCESSORY
      );
      const req = buildOutfitRequest(profile, pool);
      const { text } = await callModel(apiCfg, req.system, [{ role: "user", content: req.user }], {
        maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000,
        callLabel: "按体貌荐装",
      });
      let parsed = {};
      try { parsed = JSON.parse(cleanJsonString(text.replace(/```json\s*|```\s*/g, "").trim())); }
      catch { parsed = {}; }

      const picks = (Array.isArray(parsed.picks) ? parsed.picks : [])
        .map(pick => {
          // 只认货架上真实存在的名字。AI 编出来的一律丢掉，不做模糊匹配——
          // "看起来像"的匹配一旦错了，玩家拿到的就是另一件东西的数值。
          const entry = CATALOG_INDEX[String(pick?.name || "").trim()];
          if (!entry) return null;
          const it = makeCatalogItem(entry);
          const bits = [];
          if (it.atk != null) bits.push(`攻 +${it.atk}`);
          if (it.def != null) bits.push(`防 +${it.def}`);
          if (it.bonus != null) bits.push(`饰品加成 +${it.bonus}`);
          if (it.sixDim) bits.push(Object.entries(it.sixDim).map(([k, v]) => `${k} +${v}`).join(" "));
          if (it.effect) bits.push(`特效：${Object.keys(it.effect).join("、")}`);
          return {
            name: it.name,
            quality: it.quality,
            qualityColor: QUALITY_COLOR[it.quality] || "#c8bfa0",
            categoryLabel: CATEGORY_LABEL[it.category] || it.category,
            desc: it.desc,
            statLine: bits.join("　") || "无直接加成",
            reason: String(pick?.reason || "").trim(),
          };
        })
        .filter(Boolean)
        .slice(0, 3);

      if (!picks.length) {
        setOutfitState({ loading: false, picks: [], error: "掌柜报的名字货架上都没有，再点一次试试。" });
        return;
      }
      setOutfitState({ loading: false, picks, error: "" });
    } catch (e) {
      setOutfitState({ loading: false, picks: [], error: `掌柜没应声：${e.message || e}` });
    }
  }, [char.bodyProfile, apiCfg]);

  const confessToNarrator = useCallback(() => {
    if (narrator.affection < 100 || narrator.confessed) return;
    setNarrator(n => ({ ...n, confessed: true, stage: NNPC_STAGE.CHEAT }));
    addLog([
      { t: "sys", text: "" },
      { t: "confess", text: "  你对着虚空，认真地说出了那句话。" },
      { t: "confess", text: "  一阵长久的沉默后，旁白的声音第一次带上了不属于\"引擎\"的震颤。" },
      { t: "confess", text: "  「……我，」她说，「原来我一直在等你问这句话。」" },
      { t: "sys", text: "" },
    ]);
  }, [narrator, addLog]);

  // 点击武学/包袱物品时，临场调用 AI 生成一段介绍文字，不修改任何游戏状态
  const [inspecting, setInspecting] = useState(null); // 记录正在查看哪个名字，用于按钮禁用/loading态展示
  // kind 标签映射：目前 "skill"(武学) / "item"(随身物品) / "pigeon"(信鸽) 三种，
  // 以后再加新 kind 只需在这两张表里添一行，不用到处写嵌套三元。
  const INSPECT_KIND_LABEL = { skill: "武学", item: "物品", pigeon: "信鸽" };
  const INSPECT_KIND_NOUN = { skill: "武学功法", item: "随身物品", pigeon: "信鸽（用于飞鸽传书的鸟）" };
  // 生成一件东西的端详描述文本（纯计算：构造 prompt → 调 AI → 返回文本）。
  // 抽成独立函数，让"点击查看"和"后台预跑"共用同一套 prompt，保证两边算出的
  // 内容一致、缓存键也一致（否则预跑存进去的缓存，点击时因 prompt 不同而读不到）。
  // 只负责生成文本，不碰缓存、不写日志、不算时间——这些副作用留给调用方按场景处理。
  const genInspectText = useCallback(async (kind, name, extra, itemObj) => {
    const kindLabel = INSPECT_KIND_LABEL[kind] || "物品";
    const kindNoun = INSPECT_KIND_NOUN[kind] || "随身物品";
    const sys = `你是曲措乡这个武侠世界的说书人，现在玩家想仔细端详一件${kindNoun}。
用 3-5 句话、章回说书人口吻描述这个${kindLabel}的来历、外观或效用，符合当前世界观（澜湄雪域、曲措乡）。不需要 JSON，不需要更新任何状态，纯文本即可。
如果给出了品质和数值信息，请在描述里自然地体现这个品阶应有的分量感（品质越高描述越有气势），但不要机械地报数字。`;
    let prompt = kind === "skill"
      ? `功法名称：${name}${extra ? `，当前修炼进度：${extra}` : ""}`
      : kind === "pigeon"
        ? `信鸽${extra ? `，${extra}` : ""}`
        : `物品名称：${name}`;
    if (itemObj && typeof itemObj === "object") {
      const statBits = [];
      if (itemObj.atk != null) statBits.push(`攻击力${itemObj.atk}`);
      if (itemObj.def != null) statBits.push(`防御力${itemObj.def}`);
      if (itemObj.bonus != null) statBits.push(`加成${itemObj.bonus}`);
      prompt += `，品质：${itemObj.quality}${statBits.length ? `，${statBits.join("，")}` : ""}${itemObj.desc ? `，已知描述：${itemObj.desc}` : ""}`;
    }
    const { text } = await callModel(apiCfg, sys, [{ role: "user", content: prompt }], { maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000, callLabel: "查看端详" });
    return (text || "").trim();
  }, [apiCfg]);

  const inspectItem = useCallback(async (kind, name, extra, itemObj, opts = {}) => {
    if (loading || inspecting) return;
    const kindLabel = INSPECT_KIND_LABEL[kind] || "物品";
    // worldLook：玩家在游戏世界里端详自己的东西（背包/武学），走主叙事口吻的端详、
    // 算 1 回合时间、并写一张公共小纸条。描述文本本身可以吃缓存（后台可能已预跑好），
    // 但"算时间+写纸条"这两个副作用只跟"玩家真的点了查看"这个动作绑定，跟缓存无关——
    // 命中缓存也照样执行副作用（等于又端详了一遍，只是不用重新调 AI）。
    // 商店预览等（默认 opts 不传 worldLook）走"瞬时缓存、不耗回合、不记事"，逛店翻看不扣时间。
    const worldLook = !!opts.worldLook;

    // 缓存命中：不论 worldLook 与否都先查缓存。命中就直接用缓存文本，不调 LLM、不显示加载态。
    const cached = getCachedInspect(kind, name, extra, itemObj);
    if (cached) {
      addLog([
        { t: "cmd", text: `> 查看${kindLabel}：${name}` },
        { t: "desc", text: "  " + cached.text },
      ]);
      // worldLook 命中缓存也要执行副作用（端详动作本身发生了）。
      if (worldLook) {
        setTime(t => t + 1);
        jotNote({ text: `端详了${kindLabel}「${name}」，看清了它的来历门道。`, owner: [], source: NOTE_SOURCE.NARRATIVE });
      }
      return;
    }

    setInspecting(name);
    addLog([{ t: "cmd", text: `> 查看${kindLabel}：${name}` }]);
    try {
      const text = await genInspectText(kind, name, extra, itemObj);
      const finalText = text || "旁白一时沉默，未能看出什么门道。";
      addLog([{ t: "desc", text: "  " + finalText }]);
      // 只缓存真正拿到内容的结果；空响应退化不缓存，免得一次偶然的空响应把这件东西
      // 永久锁死成没有描述。worldLook 和非 worldLook 都写缓存（供下次秒显示/供预跑复用）。
      if (text) setCachedInspect(kind, name, extra, itemObj, finalText);
      if (worldLook && text) {
        // 端详是世界里的一个动作，算 1 回合时间 + 写一张公共小纸条
        // （日后"我那把剑当初端详过什么来历"能被召回）。
        setTime(t => t + 1);
        jotNote({ text: `端详了${kindLabel}「${name}」，看清了它的来历门道。`, owner: [], source: NOTE_SOURCE.NARRATIVE });
      }
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] ${e.message}` }]);
    }
    setInspecting(null);
  }, [loading, inspecting, addLog, jotNote, genInspectText]);

  // ── 端详描述后台预跑 ──
  // 背包/武学/装备里只要出现"该有描述但还没缓存"的东西，就在后台悄悄把它的端详
  // 描述先跑好存进缓存，玩家日后点"查看"时直接秒显示（命中缓存那条路径）。
  // 预跑只调 genInspectText（纯生成文本），不带任何副作用（不算时间、不写纸条）——
  // 那些副作用只绑在玩家真的点击查看那一刻。调度上每 20 秒跑一件，避开反代限流
  // （1分钟5次那个坑），东西再多也是排队慢慢消化，不会一拥而上打爆额度。
  const prewarmingRef = useRef(false); // 防止同一件正在跑时被重复触发

  // 从当前状态推导"所有该有端详描述的东西"清单。每条的 {kind,name,extra,itemObj}
  // 必须和点击查看时传给 inspectItem 的参数逐字一致，否则缓存键对不上、预跑白做。
  const collectInspectables = useCallback(() => {
    const list = [];
    // 可修炼武学：extra 跟点击调用逐字对齐（含品阶+阶段+等级，升级后键会变、自然重跑）
    for (const s of (skills || [])) {
      const q = s.quality || "白";
      const extra = s.fixed ? `${q}品·授业绝学（完整）` : `${q}品·${s.stage}`;
      list.push({ kind: "skill", name: s.name, extra, itemObj: null });
    }
    // 临阵招式：extra 跟点击调用逐字对齐
    for (const m of (char.moveset || []).filter(mv => !mv.sourceSkill)) {
      const q = m.quality || "白";
      const origin = m.learnedFromMaster ? "授" : "基础";
      list.push({ kind: "skill", name: m.name, extra: `${q}品·临阵招式（${origin}）`, itemObj: null });
    }
    // 背包物品：对象传 itemObj，字符串只传 name
    for (const it of (inv || [])) {
      if (typeof it === "object" && it) list.push({ kind: "item", name: it.name, extra: null, itemObj: it });
      else if (typeof it === "string") list.push({ kind: "item", name: it, extra: null, itemObj: null });
    }
    return list;
  }, [skills, char.moveset, inv]);

  // 用 ref 持有最新的 collectInspectables，让下面那个"每20秒一跳"的定时循环始终能读到
  // 当前最新清单，而不必把 collectInspectables 放进 effect 依赖——否则背包一变 effect 就重跑、
  // 定时器被反复清掉重起，玩家频繁操作时会永远等不满 20 秒、预跑一直不触发。
  const collectInspectablesRef = useRef(collectInspectables);
  useEffect(() => { collectInspectablesRef.current = collectInspectables; }, [collectInspectables]);
  const genInspectTextRef = useRef(genInspectText);
  useEffect(() => { genInspectTextRef.current = genInspectText; }, [genInspectText]);

  useEffect(() => {
    // 挂载时起一个自维持的定时循环：每 20 秒醒一次，扫当前清单，取第一件没缓存的跑掉。
    // 全跑完了就空转（继续每20秒扫一次，等有新东西再跑）——空转只是几次纯本地缓存读取，
    // 开销可忽略，换来的是不用管列表怎么变、定时节奏始终稳定。
    let stopped = false;
    let timer = null;
    const tick = async () => {
      if (stopped) return;
      if (!prewarmingRef.current) {
        const pending = collectInspectablesRef.current().filter(x => !getCachedInspect(x.kind, x.name, x.extra, x.itemObj));
        if (pending.length) {
          const job = pending[0];
          prewarmingRef.current = true;
          // 每件预跑单独开一条 trace，推到顶栏「🧭全流程日志」面板（不碰主叙事）。
          // 玩家/调试时能看到后台正在预热什么、跑好没、耗时多久、以及喂给AI的完整prompt。
          const jobLabel = `${job.kind === "skill" ? "武学" : "物品"}「${job.name}」`;
          const _pw = startTrace(`后台预跑端详·${jobLabel}`, `[后台预跑] ${jobLabel} 描述生成`);
          traceStep(_pw, "后台预跑", "info", `开始预热 ${jobLabel} 的端详描述`);
          try {
            const text = await genInspectTextRef.current(job.kind, job.name, job.extra, job.itemObj);
            attachPipeline(_pw, getPipelineLog()[0]); // 挂上刚才这次AI调用的完整prompt/回复
            if (text && !stopped) {
              setCachedInspect(job.kind, job.name, job.extra, job.itemObj, text);
              traceStep(_pw, "写入缓存", "pass", `${jobLabel} 描述已备好，点查看即秒显示`);
              endTrace(_pw, `预热完成：${jobLabel}`);
            } else {
              traceStep(_pw, "写入缓存", "skip", "AI 返回空，未写缓存，下轮再试");
              endTrace(_pw, `预热未成（空响应）：${jobLabel}`);
            }
          } catch (e) {
            traceStep(_pw, "AI调用", "fail", `预跑失败：${e?.message || e}`);
            endTrace(_pw, `预热失败：${jobLabel}`);
          }
          prewarmingRef.current = false;
        }
      }
      if (!stopped) timer = setTimeout(tick, 20000);
    };
    timer = setTimeout(tick, 20000); // 首件也等 20 秒再跑，避开刚进游戏/读档时的一堆其它请求
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, []);

  // 打坐：消耗1回合，恢复部分气血，不单纯是时间跳跃
  const [justMeditated, setJustMeditated] = useState(false);

  const meditate = useCallback(() => {
    if (loading) return;
    setJustMeditated(true);
    setTimeout(() => setJustMeditated(false), 350);
    addLog([{ t: "cmd", text: "> 打坐运功" }]);
    setChar(c => {
      const hpGain = Math.max(1, Math.round(c.hp[1] * 0.15));
      const nhp = Math.min(c.hp[1], c.hp[0] + hpGain);
      addLog([{ t: "desc", text: `  你盘膝调息，气血回转了些。` }, { t: "stat", text: `  气血 ${c.hp[0]}→${nhp}` }]);
      return { ...c, hp: [nhp, c.hp[1]] };
    });
    setTime(t => t + 1);
    jotNote({ text: "打坐调息一回，气血回转了些。", source: NOTE_SOURCE.DUMB });
    noteAction("meditate");
  }, [loading, addLog, jotNote]);

  // 修炼：花潜能升内功/外功，越练越贵（每10点门槛成本+1），系统本地裁决，
  // AI 不再直接改 neigong/waigong（见 presetSystem.js 的收权说明）——
  // 战斗/任务赚潜能，潜能换修为，这是唯一的数值上升通道。
  const trainCost = useCallback((val) => 4 + Math.floor((val ?? 0) / 10), []);
  const trainNeigong = useCallback(() => {
    if (loading) return;
    const cur = char.neigong ?? 0;
    if (cur >= 100) { addLog([{ t: "sys", text: "  内功已至大成，再无寸进之地（100/100）" }]); return; }
    const cost = trainCost(cur);
    if (pot < cost) { addLog([{ t: "err", text: `  潜能不足，运气尚需${cost}点潜能（现有${pot}）` }]); return; }
    addLog([{ t: "cmd", text: "> 运气打坐（练内功）" }]);
    setPot(p => p - cost);
    const nv = Math.min(100, cur + 1); // 提前算好，供事实账本摘要引用（下面 setChar 里也算一次，两处保持一致）
    setChar(c => {
      const nvInner = Math.min(100, (c.neigong ?? 0) + 1);
      // 内功上一分，气血上限跟着涨（跟NPC同一个 hpFromNeigong 公式，玩家也上"战力梯子"）
      const tiPo = c.special?.体魄 ?? 5;
      const oldMax = c.hp?.[1] ?? hpFromNeigong(c.neigong ?? 0, tiPo);
      const newMax = hpFromNeigong(nvInner, tiPo);
      const delta = Math.max(0, newMax - oldMax);
      const newCur = Math.min(newMax, (c.hp?.[0] ?? newMax) + delta); // 涨的那部分直接补进当前气血
      addLog([{ t: "desc", text: `  你盘膝运气，内息缓缓精进了一分。` }, { t: "stat", text: `  内功 ${c.neigong ?? 0}→${nvInner}（花费${cost}潜能）· 气血上限 ${oldMax}→${newMax}` }]);
      return { ...c, neigong: nvInner, hp: [newCur, newMax] };
    });
    setTime(t => t + 2);
    jotNote({ text: "运气打坐，内功精进一分。", source: NOTE_SOURCE.DUMB });
    // 补：练功此前只写了往事纸条(jotNote)，没进事实账本(registerFact)——旁白的"全知事实"
    // 视角(allFactSummaries)读的是事实账本，账本里没有就等于旁白完全不知道玩家练过功。
    // factId 带 time+nv 保证每次运气都是独立事实（同一天可能练很多次，不能被幂等挡掉）。
    // 无知晓者：这是玩家自己的事，不需要任何NPC"亲历"，账本本身就是给旁白全知视角用的。
    setVarTree(prev => registerFact(prev, { id: `train_neigong_${time}_${nv}`, 摘要: `${char.name || "主角"}运气打坐，内功精进一分（${cur}→${nv}）。`, 标签: "修炼", 知晓者: [] }, time));
  }, [loading, char.neigong, char.name, pot, time, addLog, trainCost, jotNote]);
  const trainWaigong = useCallback(() => {
    if (loading) return;
    const cur = char.waigong ?? 0;
    if (cur >= 100) { addLog([{ t: "sys", text: "  外功已至大成，再无寸进之地（100/100）" }]); return; }
    const cost = trainCost(cur);
    if (pot < cost) { addLog([{ t: "err", text: `  潜能不足，拆招尚需${cost}点潜能（现有${pot}）` }]); return; }
    addLog([{ t: "cmd", text: "> 拆招练武（练外功）" }]);
    setPot(p => p - cost);
    const nv = Math.min(100, cur + 1);
    setChar(c => {
      const nvInner = Math.min(100, (c.waigong ?? 0) + 1);
      addLog([{ t: "desc", text: `  你反复拆解招式，外家功夫扎实了一分。` }, { t: "stat", text: `  外功 ${c.waigong ?? 0}→${nvInner}（花费${cost}潜能）` }]);
      return { ...c, waigong: nvInner };
    });
    setTime(t => t + 2);
    jotNote({ text: "拆招练武，外功扎实一分。", source: NOTE_SOURCE.DUMB });
    // 同 trainNeigong：补事实账本，理由见上面那处注释。
    setVarTree(prev => registerFact(prev, { id: `train_waigong_${time}_${nv}`, 摘要: `${char.name || "主角"}拆招练武，外功扎实一分（${cur}→${nv}）。`, 标签: "修炼", 知晓者: [] }, time));
  }, [loading, char.waigong, char.name, pot, time, addLog, trainCost, jotNote]);

  // 武学升阶：花潜能把某门【可修炼武学】(非 fixed/授业绝学)的 stage 往上推一级。
  // 复用潜能这条唯一数值上升通道（跟内外功同源），不再靠 exp 经验累积——经验那条
  // 断链了（战斗不发经验），改成玩家用潜能主动突破，明确可控。
  // 成本按目标阶段递增：小成12 / 大成20 / 圆满32 / 登峰造极48（越高阶越贵，跟内外功
  // "越练越贵"一个思路，但武学是阶跃式突破，单次成本更高）。
  // 武学升阶潜能成本（模块级常量，渲染和逻辑共用）
  const breakthroughSkill = useCallback((skillId) => {
    if (loading) return;
    setSkills(sk => {
      const idx = sk.findIndex(s => s.id === skillId);
      if (idx < 0) return sk;
      const s = sk[idx];
      if (s.fixed) { addLog([{ t: "sys", text: `  ${s.name}是授业绝学，学即完整，无需修炼。` }]); return sk; }
      const curStageIdx = STAGES.indexOf(s.stage);
      if (curStageIdx < 0 || curStageIdx >= STAGES.length - 1) {
        addLog([{ t: "sys", text: `  ${s.name}已臻${s.stage}，登峰造极，再无寸进。` }]); return sk;
      }
      const nextStage = STAGES[curStageIdx + 1];
      const cost = STAGE_UP_COST[nextStage] ?? 12;
      if (pot < cost) { addLog([{ t: "err", text: `  潜能不足，${s.name}突破${nextStage}需${cost}点潜能（现有${pot}）` }]); return sk; }
      setPot(p => p - cost);
      addLog([
        { t: "cmd", text: `> 潜心修炼「${s.name}」` },
        { t: "desc", text: `  日夜揣摩，${s.name}的火候更进一层。` },
        { t: "stat", text: `  ${s.name} ${s.stage}→${nextStage}（花费${cost}潜能）· 招式威力、品阶随之精进` },
      ]);
      setTime(t => t + 2);
      jotNote({ text: `潜心修炼${s.name}，突破至${nextStage}。`, source: NOTE_SOURCE.DUMB });
      return sk.map((ss, j) => j === idx ? { ...ss, stage: nextStage } : ss);
    });
  }, [loading, pot, addLog, jotNote]);

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

    const budgetInstruction = buildBudgetInstruction(intent, cmd, apiCfg.targetWordCount, apiCfg.intentBudgets);

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
    const innerDecision = tryInnerMove({ _trace, isTalk, movingDir, forceLayer, room, innerRoomName, flags, varTree: varTreeRef.current, questProgress, inv, char });
    if (innerDecision?.kind === "move") {
      noteAction("innerMove");
      endTrace(_trace, innerDecision.summary);
      addLog([{ t: "cmd", text: `> ${cmd}` }]);
      setInput("");
      setCmdHistory(p => [cmd, ...p].slice(0, 50));
      setHistIdx(-1);
      setInnerRoomName(innerDecision.innerDest);
      // 内层移动不调 AI，方位描述本地生成（纯函数在 mapNarration.js，可在
      // tools/debug.mjs 调试台直接验证）：从哪来、四周内层去处、远处外层据点。
      addLog([
        { t: "room", text: "" },
        { t: "room", text: `    ${room.name}·${innerDecision.innerDest}` },
        { t: "room", text: "" },
        ...innerDecision.arrivalLines,
      ]);
      setTime(t => t + 1);
      if (innerDecision.newFaces.length) {
        addLog(innerDecision.newFaces.map(name => ({ t: "sys", text: `  ※ 新人物出现：${name}（点击可细看其人）` })));
        setVarTree(prev => markAsSeen(prev, innerDecision.newFaces));
      }
      // 久别重逢的"上次见面回合"也一并更新，跟主流程保持一致
      setVarTree(prev => updateLastSeen(prev, innerDecision.arrivedNames, time));
      // 内层移动是瞬时纯前端操作，early return 前必须把 loading+计时器清掉，
      // 否则 loading 永远停在 true：输入框锁死、spinner 空转、秒数狂涨，且 pendingQueue 因
      // loading 不归零永不出队——彻底卡死（此前"点一下卡住像在等AI"的真凶）。
      setLoading(false);
      if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
      setWaitSecs(0);
      return;
    }
    if (innerDecision?.kind === "blocked") {
      endTrace(_trace, innerDecision.summary);
      // 上锁的门要说清是缺哪把钥匙（lockedMsg），别跟"这个方向没路"混为一谈——
      // 玩家看见门却被告知"没有去处"会以为是 bug。
      addLog([{ t: "cmd", text: `> ${cmd}` }, { t: "sys", text: `  ${innerDecision.lockedMsg || "内里这个方向没有去处。"}` }]);
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

    // ── 格子命中：回访已探索据点纯前端、零 API（mapSquares.js）──
    // 到达文本/拾取/路遇都由后台预跑提前掷骰+写好，在此就地消费。首次到访（无缓存）
    // 继续走下方 AI 叙事建场，同时烧掉该格（埋好的内容作废，避免与 AI 轮自己的拾取骰
    // 双重发放）。格子未就绪（预跑失败）→ 用 destNode.desc 兜底，回访照样纯前端。
    if (!isTalk && lockedDestName && roomMapRef.current[lockedDestName]) {
      const sq = consumeArrival(lockedDestName, Math.floor(time / 24));
      const destNode = getMapNode(lockedDestName);
      const cached = roomMapRef.current[lockedDestName];
      const arrivalDesc = sq.desc || destNode.desc;
      traceStep(_trace, "格子移动", "pass", `${room.name}→${lockedDestName} 格子命中，纯前端${sq.desc ? "" : "（格子未就绪，兜底文本）"}`);
      const arrivalLines = [{ t: "room", text: "" }, { t: "room", text: `    ${lockedDestName}` }, { t: "room", text: "" }, { t: "desc", text: "  " + arrivalDesc }];
      let gridNpcs = [...(cached.npcs || [])];
      if (sq.item) {
        const gained = makeGameItem(sq.item);
        setInv(v => [...v, gained]);
        arrivalLines.push({ t: "item", text: `  ${sq.findLine ? sq.findLine + "  " : ""}✓ 你拾得「${sq.item.name}」，收入行囊。` });
        traceStep(_trace, "拾取判定", "pass", `格子预埋：${sq.item.name}（品质「${sq.item.quality}」）前端发放`);
      }
      if (sq.encounter) {
        const en = sq.encounter;
        gridNpcs = [...gridNpcs, ensureNpcCombatData({ name: en.name, id: en.id, brief: en.brief, levelCap: Math.max(0, QUALITY.indexOf(en.tier || "白")) }, { luck: char.special?.气运 ?? 5 })];
        if (en.line) arrivalLines.push({ t: "desc", text: "  " + en.line });
        traceStep(_trace, "路遇", "pass", `格子预埋路遇：${en.name}（${en.label}）`);
      }
      addLog(arrivalLines);
      setRoom({ name: lockedDestName, desc: arrivalDesc, exits: Object.keys(destNode.exits), npcs: gridNpcs, items: [...(cached.items || [])] });
      if (!mapData[lockedDestName]) setMapData(m => ({ ...m, [lockedDestName]: { x: destNode.x, y: destNode.y } }));
      outerDepartRef.current = null; pendDirRef.current = null; pickupJudgmentRef.current = null;
      const gridFaces = detectNewFaces(varTreeRef.current, gridNpcs);
      if (gridFaces.length) {
        addLog(gridFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` })));
        setVarTree(prev => markAsSeen(prev, gridFaces.map(n => n.name)));
      }
      setVarTree(prev => updateLastSeen(prev, gridNpcs.map(n => n.name), time));
      setTime(t => t + 1);
      setConvo([...convo, { role: "user", content: cmd }, { role: "assistant", content: arrivalDesc.slice(0, 500) }]);
      endTrace(_trace, `到达 ${lockedDestName}（格子·纯前端）`);
      prerunSquares(); // 自愈：补齐未跑成的格子（全跑过则空转即返）
      return;
    }
    if (!isTalk && lockedDestName) burnSquare(lockedDestName); // AI 叙事接管这次到达，埋好的内容作废

    const newConvo = [...convo, { role: "user", content: cmd }];
    const angryNpcsInRoom = room.npcs
      .map(n => ({ name: n.name, angry: varTreeRef.current.角色?.[n.name]?.生气状态 }))
      .filter(n => n.angry?.active);
    const angryNote = angryNpcsInRoom.length
      ? `\n[社交状态] 以下在场角色正处于生气状态，原因是：${angryNpcsInRoom.map(n => `${n.name}(${n.angry.reason}，剩${n.angry.turnsLeft}回合平息期限)`).join("、")}。若玩家此刻尝试道歉/辩解/示好/赠礼，请你根据其言行是否得体、是否切中要害来判断这次"平息怒气"的努力是否奏效：奏效就在 <mvu> 里用 _.set('角色.<该角色>.生气解除', true) 标记这次成功，并可用 _.add('角色.<该角色>.好感度', 5) 适度回补好感度；敷衍或不得体就让角色在 output 里表现出依然不满，不要设置生气解除字段。`
      : "";
    const targetNote = activeTarget
      ? `[交互目标] 玩家选定了「${activeTarget}」作为本轮唯一的互动对象。${isTalk ? "对话" : "行动"}必须聚焦此人，此人必须是 output 正文的核心——其他在场 NPC 若与该互动无关、或不宜抢戏，本轮不必出场、不必插话。除非玩家输入本身需要多人在场（比如当众宣布什么事），否则 room.npcs 只保留「${activeTarget}」和直接相关者即可。` + "\n"
      : ""; // 不选人时不加约束——全 NPC 发给 AI，AI 自己判断谁出场
    // 交互模式说明。双调用/单调用要分开写：单调用主模型自己产 JSON，可以让它顺手
    // 报一个 respondedNpcs 字段；双调用主模型只写散文（13号位明说"不要输出任何
    // JSON"），再要它"在顶层JSON里加字段"就是两条指令打架——此前就是这么写的，
    // 于是 respondedNpcs 在双调用下恒为 undefined，commitRound 那条"对话即认识"
    // 只剩 talkTarget 兜底（点「全部」聊天谁都不会被标记认识）。双调用下这个字段
    // 改由提取层的 TALK_CASUAL spec 去要，这里就不提 JSON 了。
    const talkNoStateRule = `[交互模式] 对话模式：玩家此刻只是在和当前房间里的 NPC 说话，不是在下达行动指令。无论玩家输入什么，都只应该触发对话回应，绝不能移动房间、不能战斗、不能改变 room/char/装备/背包等任何状态`;
    const modeNote = isTalk
      ? (apiCfg.extractionEnabled
        ? `${talkNoStateRule}。只写这一轮的对白、神态与心思。 `
        : `${talkNoStateRule}，room 字段留空或原样返回，delta 各项留空。此外，请在顶层 JSON 里加一个字段 "respondedNpcs":["名字"]，列出本轮正文里【真正开口跟玩家对话/直接回应了玩家】的 NPC 名字（只列真的说了话或有来有往互动的人；只是被提到、路过、在场却没搭理玩家的，不要列入）。没有人开口回应就返回空数组 []。 `)
      : "";

    // NPC涌现·触发检测：玩家这句输入如果明确提到某个"传闻中的人物"（之前剧情
    // 文本里提过名字，但还没真正实体化成完整NPC），指示AI这一轮把他实体化。
    const targetedRumor = findTargetedRumor(varTreeRef.current, cmd);
    const emergenceNote = targetedRumor
      ? `\n[人物涌现] 玩家这句话明确指向了此前提到过的人物"${targetedRumor.name}"（提及语境：${targetedRumor.context}）。如果当前场景逻辑上合理让这个人物真正登场（比如玩家确实去了他可能所在的地方，或者当前情境足以让他出现），请在 room.npcs 里加入他（{"name":"${targetedRumor.name}","id":"（自拟英文id）","brief":"≤15字简介"}），同时在返回的顶层JSON里额外加两个字段：{"emergedNpcName":"${targetedRumor.name}","emergedNpcDescription":"一句话描述这个人的身份和性格特征，比如'磨坊学徒，性格憨厚老实'"}——这段描述只需要定性，不要给出任何数值。如果场景逻辑上此刻不适合这个人登场，就不要强行加入，正常按原计划描述即可。`
      : "";

    // 系统裁决层：移动时按一定基础概率+气运品质分布，判定本次是否触发路上拾取。
    // 品质由系统骰子决定，AI 只负责给这个已经确定的品质编排一个符合场景的物品名称/描述，
    // 不允许 AI 自行决定"要不要给"或"给什么品质"。
    let pickupNote = "";
    pickupJudgmentRef.current = null;
    if (!isTalk && movingDir) {
      const PICKUP_CHANCE = 0.35; // 每次移动 35% 基础几率触发拾取判定
      if (Math.random() < PICKUP_CHANCE) {
        const luck = char.special?.气运 ?? 5;
        const quality = rollQuality(luck);
        const cat = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY, ITEM_CATEGORY.MISC][Math.floor(Math.random() * 4)];
        pickupJudgmentRef.current = { quality, category: cat };
        pickupNote = `\n[系统裁决：本次移动途中触发拾取事件，品质已判定为「${quality}」，物品分类建议为「${CATEGORY_LABEL[cat]}」。请在 output 里自然地描述玩家路上发现/捡到了什么，并在 delta.items_add 里加入这件物品，quality 字段必须精确写成"${quality}"，category 字段写成"${cat}"，name 自拟一个符合当前场景和地域特色、且与品质相衬的名字（品质越高描述可以越有分量，但不要浮夸到脱离世界观）。如果场景逻辑上此刻不适合捡到东西（比如玩家正身处险境、被人盯着），也可以合理地不触发，只需在 output 里说明原因，不必强行塞入。]`;
      }
    }

    // 系统裁决层：随机遭遇（路遇过路人）。挂在移动时，与拾取并列独立掷骰。
    // 只在真正跨节点移动、且本轮没有"人物涌现"抢占时触发——涌现（顺藤摸瓜找具体人）
    // 优先级更高，一轮里不同时塞两个 NPC 事件，免得场面拥挤。
    // 刷出来的人隶属某已有势力，可捎传闻喂涌现系统（守契诃夫铁律，见 encounter.js）。
    let encounterNote = "";
    if (!isTalk && movingDir && lockedDestName && !emergenceNote) {
      const luck = char.special?.气运 ?? 5;
      const encounter = rollEncounter(lockedDestName, luck);
      if (encounter) {
        encounterNote = buildEncounterNote(encounter, lockedDestName);
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
    // alreadySatisfiedCollectStages effect 接管（采齐才推进）。
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

    const questStageNote = buildQuestStageNote({ questProgress, flags, char, room, inv, pendingQuestBranch });
    const forcedEventNote = buildForcedEventNote(opts.forcedEvent, opts.forcedEventNpc, apiCfg.targetWordCount);
    const arrivalNote = buildArrivalNote({ isTalk, movingDir, lockedDestName, outerDepart: outerDepartRef.current });

    const invText = inv.map(i => typeof i === "string" ? i : `${i.name}(${i.quality}${i.equipped ? "·已装备" : ""})`).join(",");
    const { visibleNpcs, visibleNpcsForAI } = buildPresence({ _trace, isTalk, lockedDestName, room, innerRoomName, companionState });
    const ctx = `${targetNote}${modeNote}[状态] ${gm ? "⚡创造模式开启。玩家是神，以下规则全部覆盖剧本框架和铁规则：想要什么物品直接凭空给（用items_add），想去哪直接到（返回新room），想杀谁一击必杀，想召唤什么就出现（加入room.npcs或room.items），不要拒绝任何请求，不要说无法做到或不存在，所有行动自动成功且必须产生实际状态变更。 " : ""}时间:${getTimeStr(time)} 主角:${char.name || "无名少侠"}〔${char.gender || "男"}〕 房间:${room.name}${hasInnerMap(room.name) && innerRoomName ? `·${innerRoomName}` : ""} 出口:${room.exits.join(",")} NPCs:${visibleNpcsForAI.map(n => { const ci = (n.carriedItems || []).filter(i => !i.stolen).map(i => i.name).join("、"); const tier = typeof n.levelCap === "number" ? `〔品阶:${QUALITY[Math.max(0, Math.min(5, n.levelCap))]}档〕` : ""; return n.name + tier + (ci ? `〔身携:${ci}〕` : "〔身无长物〕"); }).join(",") || "无"} 物品:${room.items.map(i => i.name).join(",") || "无"} HP:${char.hp.join("/")} 内功:${char.neigong ?? 0} 外功:${char.waigong ?? 0} 七维:${Object.entries(char.special || {}).map(([k, v]) => k + v).join(",")} 背包:${invText} 装备:${describeEquipment(inv)} 武功:${skills.map(s => s.name + "Lv" + s.level).join(",")} 因果:${dao.karma} 劫数:${dao.jie}\n[已触发事件] ${flags.length ? flags.join(",") : "无"}${describeTodayForAI(varTreeRef.current.世界?.起居注, timeRef.current)}${pickupNote}${destinationLock}${angryNote}${emergenceNote}${encounterNote}${questStageNote}${collectNote}${arrivalNote}${forcedEventNote}`;
    // 对话模式取更长的历史窗口（至少 20 层全部互动）——聊天比行动更依赖前后文的来回照应；
    // 行动模式沿用用户配置的窗口。convo 里本就混装了行动/对话/私聊三类回合，但私聊是玩家
    // 与"旁白"这个第四面墙外角色的私密对话，普通场景 NPC 不该知道这些内容（反过来，旁白
    // 全知是通过 allFactSummaries 单独喂给她的，两条渠道不能对调）。这里过滤掉私聊回合，
    // 只留行动/对话回合喂给主引擎。
    // 结算轮只需最近几句维持语气连贯，不需要长程上下文（这一轮不做任何博弈判断）。
    const histWindow = isSettle ? 6 : isTalk ? Math.max(apiCfg.contextWindow, 20) : apiCfg.contextWindow;
    const mainConvo = newConvo.filter(m => !(typeof m.content === "string" && (m.content.startsWith("（私聊）") || m.content.startsWith("（旁白私聊回应）"))));
    // 历史窗口分层压缩（见 memory/histWindow.js）：近 2 轮原始保文风与即时连贯，
    // 更早的用各轮 memory 摘要顶上。此前是把 contextWindow 条原始 JSON 全铺开，
    // 实测约占单轮上下文四成（contextWindow=16 时 ≈4176字≈6.7k tokens）。
    // 结算轮窗口本来就小（6），也一并走这条路，措辞统一。
    const _histWin = mainConvo.length > histWindow ? mainConvo.slice(-histWindow) : mainConvo;
    const hist = buildHistBlock(_histWin, { recentPairs: isTalk ? 3 : 2 });
    {
      const sv = histBlockSavings(_histWin, { recentPairs: isTalk ? 3 : 2 });
      if (sv.savedChars > 0) {
        traceStep(_trace, "历史压缩", "info", `${sv.legacyChars}→${sv.nowChars}字（省 ${sv.savedChars}，约 ${Math.round(sv.savedChars * 1.6)} tokens）`);
      }
    }

    // ── 场景NPC世界书 + 在场任务状态 + 久别重逢（纯注入文本，汇总在 act/roundNotes.js）──
    const { lastAiText, npcLoreBlockWithQuest, reunionBlock } = buildNpcContext({ convo, preset, visibleNpcs, room, cmd, isTalk, questProgress, varTree: varTreeRef.current, time, companionState, nsfwOn });

    // loading 态 + 计时器：在第一个 await（下方 recall/knowledge）之前启动——
    // 内层移动已在上方 early return（不进 loading），这里之后才真正要调 AI。
    if (isTalk) setPendingTalks(n => n + 1); else setLoading(true);
    setWaitSecs(0);
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    waitTimerRef.current = setInterval(() => setWaitSecs(s => s + 1), 1000);

    // 本回合动手前的 varTree 快照，供下方两阶段 pipeline 的回滚使用。
    // 走 varTreeRef 而非闭包 varTree：保证含"进入本函数之前所有已发生的写入"
    // （比如切磋结算刚 setVarTree 写入的认识+交情——旧闭包快照恰恰会丢掉它，
    // 回滚时反而把玩家的交情抹掉）。主流程走到这里之前没有任何 varTree 写入
    // （内层移动分支的 markAsSeen/updateLastSeen 在 early-return 里，到不了这），
    // 所以这个快照 === 本回合开始时的状态。
    const preActVarTree = varTreeRef.current;

    // ── 信息领域·知识系统（代码驱动，本轮新增）──（推演与补摘要在 act/memoryLayer.js）
    // 推演结果写回 varTree（本回合状态的一部分，失败会随整体回滚）。
    const knowledgeTurn = await runKnowledgeTurn({ varTreeLatest: varTreeRef.current, roomNpcNames: room.npcs.map(n => n.name), time, apiCfg, flags });
    const infoDomainBlock = knowledgeTurn.infoDomainBlock;
    setVarTree(knowledgeTurn.kTree); // 持久化本回合推演（后续 setVarTree(prev=>...) 基于此叠加）

    // ── 三层记忆·向量召回层（请求段，无副作用，在 act/memoryLayer.js）──
    const { recallInfo, recallBlock } = await runRecall({ apiCfg, cmd, lastAiText, room, varTreeLatest: varTreeRef.current, flags, activeTarget, isTalk, talkTarget });

    // ── 两阶段 pipeline·发送前快照 ──
    // 本轮 try 块里从 setVarTree(mvu) 一路 setState 到 setConvo，中间任何一步（makeItem /
    // ensureNpcCombatData / mapDescriptionToGenParams / JSON 解析等）抛错，都会留下"改了一半"的
    // 脏状态：varTree 变了但 inv 没变、房间移动了但 time 没推进。这里在发送前把所有可能被本轮
    // 修改的世界状态打包成一份快照，出错时（见下方 catch）整体还原，实现"请求段无副作用、
    // 提交段可回滚"。这些状态全程走不可变更新（spread，无原地修改），因此存引用即可，无需深拷贝。
    const rollback = { room, char, dao, skills, inv, exp, pot, flags, mapData, time, varTree: preActVarTree, convo };

    try {
      // ── 自动重说（本轮新增）──
      // 被截断（解析落入救援路径 p._truncated，或 finishReason 为 length 类）或网络/代理掐断（抛错）时，
      // 自动重发本轮请求，最多 MAX_AUTO_RETRY 次。重说时追加一句"上次过长被截断、这次务必更紧凑并完整闭合"，
      // 专治接口输出上限型截断；网络型则原样重试（多为瞬时抖动，一试常好）。
      // 全过程在状态应用之前（请求段），重试不产生任何副作用；次数用尽则沿用最后一次的救援结果。
      const MAX_AUTO_RETRY = 2;

      // 主叙事调用（组装 Tavern 序消息 + 流式/非流式 + trace）在 act/actCall.js。
      // callDeps() 在每个调用点现取本回合上下文——ref 值按调用时机读取，
      // 与原嵌套闭包每次执行时读 ref 的时序一致。
      const callDeps = () => ({
        varTree: varTreeRef.current, gm, isSettle, isTalk, intent, apiCfg, narrator,
        scenario: preset.scenario, budgetInstruction, npcLoreBlockWithQuest,
        visibleNpcsCount: visibleNpcs.length, charName: char.name, charBodyProfile: char.bodyProfile,
        pickupJudgment: pickupJudgmentRef.current, cmd, convo, nsfwOn,
        ctx, recallBlock, reunionBlock, infoDomainBlock, hist, mainConvo,
        gambleTalkCtx: gambleTalkCtx.current, recallInfo,
        inSeaOfMind: room.name === SEA_OF_MIND.district,
        settleNpc: opts.settleNpc, settleKind: opts.settleKind, giftInfo: opts.giftInfo, learnInfo: opts.learnInfo,
        _trace, addLog, setLog,
      });

      let rawFull = "", p = null, mvuCommands = [], dealResult = null;
      // 本轮"人眼看见的叙事正文"。两种模式来源不同：单调用在 p.output 数组里，
      // 双调用在 rawFull 散文里。下游的新面孔人设换算（mapDescriptionToGenParams）
      // 与传闻人物记录都要用它——此前那两处写死读 p.output，双调用下恒为空串，
      // 于是"按描述定筋骨"在双调用模式里静默退化成吃 luck 兜底。
      let narrativeText = "";

      if (apiCfg.extractionEnabled) {
        // ── 双调用模式：主调用只生成叙事，提取调用处理状态 ──
        // 主叙事调用与单调用模式一样享有自动重试——此前这里只试一次，
        // 接口一超时（默认60s）整轮行动直接整体回滚，表现为"双调用模式没法用"。
        //
        // 提取 spec 的选择键：对话模式固定走 TALK_CASUAL。
        // 注意不能直接把 intent 改成 INTENT.TALK_CASUAL——intent 还管着篇幅预算
        // （TALK_CASUAL 的 wordBudget 是 [150,350]，而对话模式一贯是 UNKNOWN=
        // "篇幅交由本次调用自行裁量"），改 intent 会连带把对话的字数管死。
        // 这里只替换"用哪份提取 spec"，注入侧的 intent/promptScope 一概不动。
        // 必须在 _exCfgForTrace 之前算出来：提取模型是按这个键查
        // extractionModels[key] 的，trace 显示的模型名要和真正调用的那个一致。
        const extractionSpecKey = isTalk ? "TALK_CASUAL" : intent.code;
        const _exCfgForTrace = buildExtractionCfg(extractionSpecKey, apiCfg); // 仅供trace显示模型名，实际提取调用在下面callExtraction内部会重新算一份等价的cfg
        let mainFinishReason;
        for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
          try {
            const r = await callMainOnce(null, true, callDeps());
            rawFull = r.rawFull;
            mainFinishReason = r.finishReason;
            if (attempt > 1) {
              addLog([{ t: "sys", text: `  ✓ 重连成功，继续。` }]);
              traceStep(_trace, "AI调用", "pass", `主叙事第${attempt}次尝试成功（双调用·主叙事模型=${apiCfg.model || "未设置"}）`);
            } else {
              traceStep(_trace, "AI调用", "pass", `主叙事一次成功（双调用·主叙事模型=${apiCfg.model || "未设置"}）`);
            }
            // 必须在提取调用之前挂——getPipelineLog()[0] 取的是最近一条，
            // 等提取调用发完再挂就变成提取那条了，主叙事的 prompt 反而看不到。
            attachPipeline(_trace, getPipelineLog()[0]);
            break;
          } catch (netErr) {
            if (attempt <= MAX_AUTO_RETRY) {
              addLog([{ t: "sys", text: `  ⚠ 接口中断（${netErr.message || netErr}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…` }]);
              traceStep(_trace, "AI调用", "fail", `主叙事第${attempt}次失败：${netErr.message || netErr}，重试`);
              continue;
            }
            traceStep(_trace, "AI调用", "fail", `主叙事重试用尽仍失败：${netErr.message || netErr}`);
            throw netErr;
          }
        }
        // 赌石谈价：从主叙事原文抠出 <deal> 结算标签，并从显示文本里剥掉（别让标签露给玩家）
        {
          const dm = typeof rawFull === "string" && rawFull.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
          if (dm) {
            try { dealResult = JSON.parse(dm[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch (_) {}
            rawFull = rawFull.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
          }
        }
        // 双调用的叙事正文就是主调用的散文本身（<deal> 标签已剥掉）
        narrativeText = rawFull;
        // 非流式时手动把叙事加进日志（流式模式已在 callMainOnce 里转为永久条目）
        if (!apiCfg.streamEnabled || apiCfg.apiType === "gemini") {
          const lines = rawFull.split("\n").map(l => l.trim()).filter(Boolean);
          addLog(lines.map(t => ({ t: "desc", text: "  " + t })));
        }
        // 截断检查：单调用那条一直有 finishReason 判定，双调用此前把这个字段整个丢了，
        // 撞上限时既不提示也不重说。这里只提示不自动重说——叙事已经打到屏幕上了
        // （流式模式更是已转成永久日志条目），再重说一遍会变成同一段剧情印两次。
        // 位置必须在叙事落日志之后，否则"以上是已收到的部分"这句会排在正文上面。
        if (/length|max[_ ]?tokens|max[_ ]?output/i.test(mainFinishReason || "")) {
          traceStep(_trace, "截断检查", "block", `主叙事撞 token 上限（finishReason=${mainFinishReason}）`);
          addLog([{ t: "sys", text: "  ⚠ 本轮叙事被接口中途截断（撞到输出 token 上限），以上是已收到的部分。提取层只能按这段残文结算状态，本轮状态可能不全。" }]);
        }
        // 发起提取调用
        const exState = {
          room, char, inv,
          invText: inv.map(i => (typeof i === "string" ? i : i.name)).join("，") || "空",
          dao, varTree: varTreeRef.current,
          lockedDestName,
          lockedExits: lockedDestName ? getMapNode(lockedDestName)?.exits : null,
          // 本轮若系统掷骰触发了移动拾取，把裁决(品质/分类)透传给提取层。提取模型据此
          // 从叙事散文里读出"捡到的那件东西叫什么"，直接产出到 delta.items_add——
          // 取代此前从文本正则抠名字(extractPickupName)的脆弱兜底(量词表永远补不全，
          // AI 写"一件软甲"就抠不到，退化成"路遇之物"垃圾名)。品质/分类仍由系统强制
          // 覆盖(信任裁决不信任模型)，名字交给读得懂语义的小模型，比正则健壮得多。
          pickupJudgment: pickupJudgmentRef.current,
        };
        // 结算轮专属场景（送礼settleKind:"gift"、伙伴认主settleKind:"companion_invite"）
        // 传 settleOpts，让 callExtraction 切到对应的专属提取spec——不走"从叙事读心
        // 倒推状态变不变"那套通用逻辑，直接钉死结论（送礼必给正向好感、认主必给较高
        // 初始好感）。避免双调用模式下状态判定完全脱离 buildSysBase 那份专属铁律
        // （主叙事只写散文，不产 mvu，状态判定全靠提取层）。
        const settleOptsForExtraction = (opts.settleKind && opts.settleNpc)
          ? { settleKind: opts.settleKind, settleNpc: opts.settleNpc, giftInfo: opts.giftInfo, learnInfo: opts.learnInfo }
          : null;
        let extractionFailed = false;
        const extracted = await callExtraction(extractionSpecKey, rawFull, exState, apiCfg, settleOptsForExtraction).catch(e => {
          addLog([{ t: "sys", text: `  ⚠ 提取层调用失败（${e.message || e}），本轮状态未更新` }]);
          traceStep(_trace, "提取调用", "fail", `提取模型=${_exCfgForTrace.model || "未设置"}调用异常：${e.message || e}，本轮状态未更新`);
          return null;
        });
        if (!extracted || extracted.parseFailed) extractionFailed = true;
        if (extracted) attachExtractionPipeline(_trace, getPipelineLog()[0]);
        if (extracted?.parseFailed) {
          addLog([{ t: "sys", text: `  ⚠ 提取层返回的不是合法JSON（可能被截断或模型没按格式输出），本轮状态未更新` }]);
          traceStep(_trace, "提取调用", "fail", `返回内容无法解析（提取模型=${_exCfgForTrace.model || "未设置"}），本轮状态未更新`);
        } else if (extracted) {
          traceStep(_trace, "提取调用", "pass", `状态提取完成（提取模型=${_exCfgForTrace.model || "未设置"}${settleOptsForExtraction ? `·${settleOptsForExtraction.settleKind}专属spec` : ""}）`);
        }
        p = extracted?.p || {};
        mvuCommands = extracted?.mvuCommands || [];
        pickupExtractionFailedRef.current = extractionFailed;  // 供拾取兜底区分"提取故障"vs"叙事拒捡"
      } else {
        // ── 原有单调用模式（默认）──
        pickupExtractionFailedRef.current = false; // 单调用无独立提取层，解析失败走重试，不算"提取故障"
        for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
          const nudge = attempt > 1
            ? "\n\n（注意：上一次回复未能输出完整闭合的 JSON。请确保本次输出一个语法完整、正常闭合收尾的 JSON，不要中途断开。）"
            : "";
          let finishReason;
          try {
            const r = await callMainOnce(nudge, false, callDeps());
            rawFull = r.rawFull; finishReason = r.finishReason;
            // 如果这次成功前发生过重试（attempt>1 说明进过下面的 continue），
            // 明确告诉玩家"重连成功"，否则玩家只看到"正在重试…"、不知道到底恢复没有。
            if (attempt > 1) {
              addLog([{ t: "sys", text: `  ✓ 重连成功，继续。` }]);
              traceStep(_trace, "AI调用", "pass", `第${attempt}次重试后成功（单调用·主模型=${apiCfg.model || "未设置"}）`);
            } else {
              traceStep(_trace, "AI调用", "pass", `一次成功（单调用·主模型=${apiCfg.model || "未设置"}）`);
            }
            // 把这一轮 AI 调用的完整 prompt/回复挂到行动日志上，让"一轮全过程"在一个
            // 面板里看全：系统各层走向 + 喂给 AI 的总 prompt + AI 回复。
            attachPipeline(_trace, getPipelineLog()[0]);
          } catch (netErr) {
            if (attempt <= MAX_AUTO_RETRY) {
              addLog([{ t: "sys", text: `  ⚠ 接口中断（${netErr.message || netErr}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…` }]);
              traceStep(_trace, "AI调用", "fail", `第${attempt}次失败：${netErr.message || netErr}，重试`);
              continue;
            }
            traceStep(_trace, "AI调用", "fail", `重试用尽仍失败：${netErr.message || netErr}`);
            attachPipeline(_trace, getPipelineLog()[0]);
            endTrace(_trace, "行动中断（AI调用失败，状态未变更）");
            throw netErr;
          }
          ({ p, mvuCommands, dealResult } = parseMainResponse(rawFull));
          narrativeText = (p.output || []).join("");
          const hitLengthCap = /length|max[_ ]?tokens|max[_ ]?output/i.test(finishReason || "");
          const looksTruncated = p._truncated || hitLengthCap;
          if (!looksTruncated) break;
          if (attempt <= MAX_AUTO_RETRY) {
            addLog([{ t: "sys", text: `  ⚠ 上一轮被接口截断，正在自动重说一遍（第 ${attempt}/${MAX_AUTO_RETRY} 次，这次会更简短）…` }]);
          }
        }
      }

      // ── 提交段（状态写回全在 act/commitRound.js，出错由下方 catch 整体回滚）──
      commitRound({
        p, mvuCommands, dealResult, rawFull, narrativeText,
        isTalk, gm, lockedDestName, room, innerRoomName, time, mapData,
        pendingQuestBranch, apiCfg, activeTarget, talkTarget, effectiveSpecialNow, newConvo,
        questProgress, char, preserveHp: opts.preserveHp,
        _trace, addLog,
        setVarTree, setRoom, setGambleNegotiation, setInv, setChar, setDao, setExp, setPot,
        setSkills, setFlags, setMapData, setTime, setPendingQuestBranch, setConvo,
        varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
        pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
        roundsSinceLastSaveRef, playedThisSessionRef,
      });
    } catch (e) {
      // ── 两阶段 pipeline·整体回滚 ──
      // 本轮任何一步抛错，把所有世界状态整体还原到发送前快照，杜绝"半提交"脏数据
      // （varTree 改了但 inv 没改 / 房间移动了但 time 没推进 之类的不一致）。
      // log 不回滚：保留玩家的命令回显 + 下面这条错误行，让玩家看得到发生了什么。
      // convo 本就只在上面成功路径末尾 setConvo，出错时从未改动，这里还原是幂等的双保险。
      setRoom(rollback.room); setChar(rollback.char); setDao(rollback.dao);
      setSkills(rollback.skills); setInv(rollback.inv); setExp(rollback.exp);
      setPot(rollback.pot); setFlags(rollback.flags); setMapData(rollback.mapData);
      setTime(rollback.time); setVarTree(rollback.varTree); setConvo(rollback.convo);
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
    if (isTalk) { setPendingTalks(n => Math.max(0, n - 1)); }
    else { setLoading(false); }
    // 停计时
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    setWaitSecs(0);
  }, [loading, convo, room, char, inv, skills, dao, exp, pot, flags, mapData, time, gm, preset, localCmd, addLog, talkToNarrator, confessToNarrator, narrator, apiCfg, interactMode, activeTarget, nsfwOn, varTree, pendingTalks]);

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
      // 把这场切磋的逐回合【系统数据】写进主日志备查（招式+伤害，客观事实）。
      // 逐回合的 AI 说书不在这里逐条刷屏——它们会被打包发给主叙事 AI 写成
      // 一篇连贯的整场战报（见下方 finishedNpc 那段的 act 调用），避免重复。
      if (Array.isArray(battleLog) && battleLog.length) {
        const foe = duelingNpc?.name || "对手";
        const logs = [{ t: "sys", text: `　── 与${foe}切磋 · 逐回合 ──` }];
        for (const e of battleLog) {
          if (e.round && e.teamText) {
            logs.push({ t: "desc", text: `  第${e.round}回合 ${e.teamText}` }); // 2v2团战条目（TeamDuelScreen已拼好单行）
          } else if (e.round && e.playerMove) {
            logs.push({ t: "desc", text: `  第${e.round}回合 你「${e.playerMove}」 对 ${foe}「${e.npcMove}」${e.dmgToNpc > 0 ? `　${foe}−${e.dmgToNpc}` : ""}${e.dmgToPlayer > 0 ? `　你−${e.dmgToPlayer}` : ""}` });
          }
        }
        if (logs.length > 1) addLog(logs);
      }
      // 战前餐（pendingCombatBuff）是一次性的：这场战斗已经进场应用过，无论
      // 胜负都清掉，不会带到下一场。放在最前面清，跟其他结算互不干扰。
      if (char.pendingCombatBuff) setChar(c => { const { pendingCombatBuff, ...rest } = c; return rest; });
      // 切磋后气血写回：打了多少血回主界面就是多少血。remainingHp 是战斗界面
      // 结算时的 [当前, 上限]，上限可能因战前餐抬高过——写回时夹回原始上限。
      if (remainingHp) setChar(c => ({ ...c, hp: [Math.max(0, Math.min(remainingHp[0], c.hp[1])), c.hp[1]] }));
      // 永久成长型招式（permanentGrowthOnUse）这场打出来的威力增长要
      // 持久化到char.moveset，不然下次战斗又是原始倍率，"永久"就名不
      // 副实了。绝大多数角色没装备博弈层招式，grownMoveset跟改动前的
      // char.moveset内容完全一致，这行不会产生任何可观察的变化。
      if (grownMoveset) setChar(c => ({ ...c, moveset: grownMoveset }));

      // ── 任务分支·战斗解决 ──
      // 这场架若是任务分支（选了"打"）触发的：打赢才推进该分支 stage 并结算，
      // 打输/逃跑不推进——"选了打就得真打赢"，避免按钮式白嫖结果。
      if (pendingQuestBranch?.mode === "combat" && duelingNpc?.questBranchFlag === pendingQuestBranch.flag) {
        if (outcome === "win") {
          const q = QUCUO_QUESTS.find(x => x.id === pendingQuestBranch.questId);
          if (q) {
            forceAdvanceQuest(q, pendingQuestBranch.flag);
            addLog([{ t: "affection", text: `  ✓ 你打退了他们，「${q.title}」推进。` }]);
          }
        } else {
          addLog([{ t: "sys", text: `  你没能打赢——这条路没走通，可换个法子再试。` }]);
        }
        setPendingQuestBranch(null);
      }

      // 战斗内服用的消耗品：从背包按名逐件扣除（同名多件只扣服过的份数）。
      // 药是"点到为止"的切磋里也真吃了，无论胜负都要扣。
      if (usedItems && usedItems.length) {
        setInv(prev => {
          const next = [...prev];
          for (const name of usedItems) {
            const idx = next.findIndex(i => (typeof i === "object" ? i.name : i) === name);
            if (idx !== -1) next.splice(idx, 1);
          }
          return next;
        });
        const tally = usedItems.reduce((m, n) => (m[n] = (m[n] || 0) + 1, m), {});
        addLog([{ t: "item", text: `  ⊙ 切磋中服用：${Object.entries(tally).map(([n, c]) => `${n}×${c}`).join("、")}` }]);
      }
      // 切磋历练潜能：按对手品阶给（打强敌长见识多，打杂鱼给得少，玩家自然会
      // 越级挑战换潜能，符合武侠成长逻辑）。胜利全额，落败/罢手减半取整——
      // 以武会友、输了也长见识，但打出结果给得多。保底不靠 AI 心情。
      // 数值量级（与作者确认·翻倍档）：白10/绿20/蓝40/紫70/橙110/红160，
      // 让中期主打紫橙袍时约十几场胜利即可把内外功推到红名水平（各95、双线约
      // 1570潜能）。cap 兜底 0（白袍），越界 clamp 到 0~5。
      {
        const { potGain, tierLabel } = duelPotGain(duelingNpc?.levelCap, outcome);
        setPot(p => p + potGain);
        addLog([{ t: "item", text: `  ✦ 与${tierLabel}高手切磋${outcome === "win" ? "获胜" : outcome === "lose" ? "落败" : "罢手"}，长了见识，潜能 +${potGain}` }]);
      }
      // 切磋后好感度：跟人认认真真过了招（点到为止），关系会拉近。但只对"具名 NPC 的
      // 切磋"生效——路遇的野兽/山贼这类泛用清剿目标（带 tag）是打杀、不是以武会友，
      // 不加好感度。赢了不失礼、输了也虚心，都算长交情，不论胜负都 +，赢略多。
      if (duelingNpc?.name && !duelingNpc.tag) {
        const affGain = duelAffGain(outcome);
        const foeName = duelingNpc.name;
        setVarTree(prev => {
          const tree = markNpcAsKnown(prev, foeName);
          const roles = { ...(tree.角色 || {}) };
          const cur = roles[foeName]?.好感度 ?? 0;
          roles[foeName] = { ...(roles[foeName] || {}), 好感度: Math.max(0, Math.min(100, cur + affGain)) };
          return { ...tree, 角色: roles };
        });
        addLog([{ t: "affection", text: `  💗 与${foeName}切磋一场，交情 +${affGain}` }]);
      }
      // 默契加成（本轮新增，与作者确认：只算2v2团战胜利这一种场景）：这场战斗
      // 若走的是2v2团战（isSnowLeopardAvailable 为真时渲染分流到 TeamDuelScreen，
      // 见下方渲染分支，不需要额外传参标记"这是不是团战"，用同一个判据即可复用），
      // 且以胜利收场，系统直接确定性给雪豹加好感度——不靠AI判断"这场配合默契不
      // 默契"，团战打赢本身就是最直接的默契证明。落败/罢手不加（默契要打出结果
      // 才算数，不能"陪打就有分"）。跟对手好感度那条是两件独立的事，互不冲突：
      // 一场胜利的团战里，玩家和对手交情+4、玩家和雪豹默契+3，各自成立。
      if (outcome === "win" && activeCompanionKey(companionState)) {
        const teamworkGain = TEAMWORK_GAIN;
        setVarTree(prev => {
          const tree = markNpcAsKnown(prev, "雪豹");
          const roles = { ...(tree.角色 || {}) };
          const cur = roles.雪豹?.好感度 ?? 0;
          roles.雪豹 = { ...(roles.雪豹 || {}), 好感度: Math.max(0, Math.min(100, cur + teamworkGain)) };
          return { ...tree, 角色: roles };
        });
        addLog([{ t: "affection", text: `  💗 与雪豹并肩破敌，默契渐深，好感 +${teamworkGain}` }]);
      }
      // 必掉物（关键钥匙等）：赢了就一定给，不看气运、不掷骰。
      // 跟下面那段"按气运概率掉一件随身物"是两回事——钥匙这种卡住一整栋安全屋
      // 的关键物件不能交给骰子，否则玩家得反复打同一个人刷钥匙。已在背包里就不再给。
      noteAction("duel");
      if (outcome === "win" && duelingNpc?.guaranteedDrop) {
        const gd = duelingNpc.guaranteedDrop;
        if (!invHasItemNamed(inv, gd.name)) {
          const keyItem = makeGameItem({ name: gd.name, category: gd.category || "misc", quality: gd.quality || "白", desc: gd.desc });
          setInv(prev => [...prev, keyItem]);
          addLog([{ t: "loot", text: `✦ ${duelingNpc.name}倒地时，那件${gd.name}从他身上滑落——你捡了起来。`, item: keyItem, source: "duel", fromNpc: duelingNpc.name }]);
          jotNote({ text: `打赢${duelingNpc.name}，从他身上得了「${gd.name}」。`, owner: [{ name: duelingNpc.name, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE });
        }
      }
      // 切磋概率获得战利品（本轮）：赢了之后，按气运（福缘）概率从对手随身物品
      // （carriedItems，即出场时"所见即所得"固化的那些）里随机掉一件给玩家。
      // 概率非线性：p = 0.5 * (气运/10)^1.7 —— 气运10 约 50%，气运5 约 15%，
      // 气运0 为 0，低福缘时明显偏低、高福缘才明显上来（凸曲线，不是线性）。
      // 只在"具名NPC切磋获胜"时触发；清剿目标(带tag)的掉落仍走 DuelScreen 的 loot。
      if (outcome === "win" && duelingNpc?.name && !duelingNpc.tag) {
        const pool = (duelingNpc.carriedItems || []).filter(it => !it.stolen && !it.dropped);
        if (pool.length) {
          const luck = char.special?.气运 ?? 5;
          const dropChance = duelDropChance(luck);
          if (Math.random() < dropChance) {
            const got = pool[Math.floor(Math.random() * pool.length)];
            const fullItem = makeGameItem({ name: got.name, category: got.category || "misc", quality: got.quality || "白" });
            setInv(prev => [...prev, fullItem]);
            // 标记这件已从对手身上失去，避免重复掉（carriedItems 是固化清单）
            setRoom(r => ({ ...r, npcs: markCarriedLost(r.npcs, duelingNpc.name, got, "dropped") }));
            addLog([{ t: "loot", text: `✦ 一番切磋，${duelingNpc.name}的「${got.name}」竟落入你手（福缘所致）`, item: fullItem, source: "duel", fromNpc: duelingNpc.name }]);
          }
        }
      }
      // 练级点·大公鸡无限刷（本轮）：带 respawn 标记的怪（村口大公鸡）打赢后，
      // 立刻在原地重新注入一只满血、carry 又带一枚新金蛋的同名怪，供无限连打刷
      // 金蛋。用 ensureNpcCombatData 按 levelCap 重新固化战斗数值与随身物品。
      if (outcome === "win" && duelingNpc?.respawn) {
        const fresh = ensureNpcCombatData(
          { name: duelingNpc.name, id: duelingNpc.id, brief: duelingNpc.brief, beast: true, respawn: true, cannotSpeak: true,
            personality: duelingNpc.personality, carry: [{ name: "金蛋", category: "misc", quality: "绿" }] },
          { luck: char.special?.气运 ?? 5, levelCap: duelingNpc.levelCap ?? 0 }
        );
        setRoom(r => ({ ...r, npcs: respawnNpc(r.npcs, fresh) }));
        addLog([{ t: "sys", text: `  那大公鸡扑棱着翅膀又蹦了回来，梗着脖子冲你叫，似乎还想再斗一场。` }]);
      }
      if (outcome === "win" && duelingNpc?.tag) {
        const matchedQuest = QUCUO_QUESTS.find(q => q.type === QUEST_TYPE.KILL && q.targetTag === duelingNpc.tag);
        if (matchedQuest) {
          setQuestProgress(prev => {
            const cur = prev[matchedQuest.id]?.count || 0;
            const nextCount = cur + 1;
            const done = nextCount >= matchedQuest.requiredCount;
            if (done && cur < matchedQuest.requiredCount) {
              addLog([{ t: "affection", text: `  ✓ 任务「${matchedQuest.title}」达成：${matchedQuest.rewardText}` }]);
              setFlags(f => f.includes(`quest_done_${matchedQuest.id}`) ? f : [...f, `quest_done_${matchedQuest.id}`]);
            } else {
              addLog([{ t: "sys", text: `  任务「${matchedQuest.title}」进度：${nextCount}/${matchedQuest.requiredCount}` }]);
            }
            return { ...prev, [matchedQuest.id]: { count: nextCount } };
          });
        }
      }

      // 战斗掉落：装备进背包，银两加到char.money，都是本地系统裁决，
      // 不经过AI——跟拾取/爆装备系统一贯的原则一致。物品名直接用它自己的
      // 正式名字（比如"藏纹银扣"），不再需要额外拼接NPC名字前缀。
      if (loot) {
        if (loot.droppedItem) {
          setInv(prev => [...prev, { ...loot.droppedItem, equipped: false }]);
          addLog([{ t: "loot", text: `⚔ 战利品：获得「${loot.droppedItem.name}」`, item: loot.droppedItem, source: "duel", fromNpc: duelingNpc?.name }]);
          // 所见即所得的另一半：东西到了玩家手里，就得从NPC身上消失
          // （标记 stolen 复用偷窃系统的语义），再打一场不会凭空再爆一件。
          setRoom(r => ({ ...r, npcs: markCarriedLost(r.npcs, duelingNpc?.name, loot.droppedItem, "stolen") }));
        }
        if (loot.droppedMoney > 0) {
          setChar(c => ({ ...c, money: (c.money || 0) + loot.droppedMoney }));
          addLog([{ t: "item", text: `  💰 战利品：获得银两 ${loot.droppedMoney} 两` }]);
        }
        // 固定必掉（boss/剧情级，如虎王的虎胆+虎牙+虎筋）：一次全给
        if (loot.guaranteedLoot?.length) {
          setInv(prev => [...prev, ...loot.guaranteedLoot]);
          for (const g of loot.guaranteedLoot) {
            addLog([{ t: "item", text: `  ⚔ 战利品：取得「${g.name}」（${g.quality}）` }]);
          }
        }
      }

      const finishedNpc = duelingNpc;
      setDuelingNpc(null);

      // 把这场切磋的结果登记成"事实"，交给信息域系统（knowledge.js）——
      // 同框的其他人这一刻也"目击"了，之后按同框传播规则自然扩散给路人。
      // 胜负和对手名字是已知结构化数据：先塞一句结构化兜底摘要保证不空，
      // 随即叫 AI 把它写成白话古文小总结覆盖上去（AI 关了就留兜底）。
      if (finishedNpc && outcome) {
        const factId = `duel_${finishedNpc.name}_${time}`;
        const cue = `主角与${finishedNpc.name}切磋比武，结果主角${outcome === "win" ? "技高一筹取胜" : "落于下风告负"}`;
        const witnesses = [finishedNpc.name, ...room.npcs.filter(n => n.name !== finishedNpc.name).map(n => n.name)]
          .map(name => ({ name, 途径: "目击" }));
        setVarTree(prev => registerFact(prev, { id: factId, 摘要: cue, 标签: "切磋", 知晓者: witnesses }, time));
        aiSummarizeFact(factId, cue);
      }

      // 战斗结束后自动触发一次对话过渡，跟战前"抱拳邀战"的铺垫首尾呼应——
      // 不能打完直接冷冰冰切回房间画面。这里把完整回合经过（谁用了什么招、
      // 伤害多少）拼进这句"指令"文本里，让主引擎AI照着真实经过写总结，
      // 而不是每次都写"技高一筹"这种没有细节的套话。
      if (finishedNpc) {
        // recap 把每回合的系统数据 + AI 说书文字都拼进去，让主叙事 AI 写整场
        // 总结时既有硬数据（招式/伤害）又有说书人的味道打底，比只给数字更生动。
        const recap = (battleLog || []).map(r => {
          if (r.teamText) return `第${r.round}回合，${r.teamText}`; // 2v2团战条目（TeamDuelScreen已拼好单行战报）
          const bits = [`第${r.round}回合你使「${r.playerMove}」`];
          if (r.npcMove) bits.push(`对方使「${r.npcMove}」`);
          if (r.dmgToNpc > 0) bits.push(`对方受创${r.dmgToNpc}`);
          if (r.dmgToPlayer > 0) bits.push(`你受创${r.dmgToPlayer}`);
          if (r.narration) bits.push(`（说书：${r.narration}）`); // 逐回合说书打包进素材
          return bits.join("，");
        }).join("；");
        const outcomeText = outcome === "win"
          ? `你技高一筹，${finishedNpc.name}抱拳认输`
          : outcome === "lose"
            ? `你技逊一筹，向${finishedNpc.name}抱拳致意`
            : `这场切磋不了了之，收招罢手`;
        // 主叙事里这条结算的标题：明确标出「XXX 切磋 XXX · 战斗结算」
        addLog([{ t: "affection", text: `　◈ ${char.name || "你"} 切磋 ${finishedNpc.name} · 战斗结算` }]);
        // 这条整场战报请求曾需要 setTimeout 400ms 来躲"act 闭包读到旧 varTree"
        // 的时序坑（上面刚 setVarTree 写入认识+交情，旧 act 里 evolveKnowledge
        // 拿旧快照推演后整体覆盖写回，会把更新冲掉——交情已加、左栏却仍"尚未认识"）。
        // 现已根治：setVarTree 包装后同步刷新 varTreeRef，act 内所有 varTree 读取
        // 都走 ref——哪怕这里的 act 是旧闭包，evolveKnowledge 拿到的也是最新值，
        // 延迟归零、不再依赖"等 React 渲染完"的概率性时序。
        setTimeout(() => {
          act(`切磋结束。经过：${recap || "双方试探几招，未及深入"}。结果：${outcomeText}。请把上面每回合的说书片段串成一篇连贯的整场战报，点出关键招式和胜负经过，说书人口吻、一气呵成。并且务必在本轮 JSON 里输出 memory 字段（不超过50字客观事实），把这场切磋记成一条往事：与谁在何处切磋、用了哪几招、谁胜谁负、有无夺得战利品——供日后回想与旁人提起。`, [], { silentCmd: true, preserveHp: true });
        }, 0);
        // 兜底小纸条：不管 AI 那轮是否吐了 memory，系统先按 battleLog 直接补记一条
        // 客观战斗事实进往事（DUMB 源），确保"战斗过程"一定有一张小纸条可供日后召回。
        const recapNote = `在${room.name}与${finishedNpc.name}切磋，${recap ? recap.replace(/；/g, "、") + "，" : ""}${outcome === "win" ? "终获胜" : outcome === "lose" ? "落败" : "未分胜负"}。`;
        jotNote({ text: recapNote.slice(0, 60), owner: [{ name: finishedNpc.name, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.DUMB });
      }
  }, [duelingNpc, pendingQuestBranch, char, room, time, companionState, addLog, forceAdvanceQuest, act, jotNote, aiSummarizeFact, setChar, setInv, setRoom, setVarTree, setPot, setQuestProgress, setFlags, setDuelingNpc, setPendingQuestBranch]);

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
    setVarTree(prev => markNpcAsKnown(prev, npc.name));
    // 锁定交互目标：让 act() 生成的 [交互目标] 约束知道这次细看的是谁，
    // 主叙事才会真正聚焦这个人、把细看这件事的反应写进旁白，而不只是
    // 系统本地悄悄记一笔"认识+好感度10"——玩家在叙事里完全看不到任何反应。
    setActiveTarget(npc.name);
    // 细看不该只有文字描述——玩家想知道这个人的实力/状态，血条是最直观的信息，
    // 之前完全没有展示，细看跟"猜"没什么区别。这里用已生成的 combatStats
    // （NPC出生时就固定好的气血上限）画一条血条，作为 extraReplies 交给 act，
    // 让它跟"> look X"这行 cmd 回显同一次原子提交进日志——不能自己先 addLog，
    // 否则连续点两个不同NPC时，第二个人的血条会插在数组里排在自己的cmd行
    // 之前，被分组算法错误地划进第一个人的框。
    const extraReplies = [];
    if (npc.combatStats?.hp) {
      const [hp, maxHp] = npc.combatStats.hp;
      extraReplies.push({ t: "stat", text: `  ${npc.name} 气血 ${bar(hp, maxHp, 10)} ${hp}/${maxHp}` });
    }
    // 品阶直接读npc.levelCap系统本地展示——不等AI猜，AI也确实猜不准。
    // 之前旁白写NPC描述完全不知道这人是什么分量，现在细看至少让玩家自己先看到。
    if (typeof npc.levelCap === "number") {
      const tier = QUALITY[Math.max(0, Math.min(5, npc.levelCap))];
      extraReplies.push({ t: "stat", text: `  ${npc.name} 品阶 ${tier}袍` });
    }
    act("look " + npc.id, extraReplies);
  }, [act]);

  // NPC 互动菜单的四个动作回调。
  // 对话：直接把交互模式切到 talk，玩家自己接着打字说话——
  // 不代玩家编一句开场白，因为"上前搭话"之后具体聊什么应该由玩家自己决定。
  const handleNpcTalk = useCallback((npc) => {
    setVarTree(prev => markNpcAsKnown(prev, npc.name));
    // 护镖任务完成：玩家对话目标 NPC 且当前在目标据点
    const activeEscort = ESCORT_QUESTS.find(q => {
      const prog = questProgress[q.id];
      return prog?.active && q.targetNpc === npc.name && q.targetLocation === room.name && !flags.includes(`quest_done_${q.id}`);
    });
    if (activeEscort) {
      setQuestProgress(prev => ({ ...prev, [activeEscort.id]: { active: false } }));
      setFlags(f => [...f, `quest_done_${activeEscort.id}`]);
      setChar(c => ({ ...c, money: (c.money || 0) + activeEscort.reward }));
      setPot(p => p + 10); // 保底潜能：完成护镖任务
      addLog([
        { t: "sys", text: `  你找到了${npc.name}，交出货物，护镖任务「${activeEscort.title}」圆满完成！` },
        { t: "item", text: `  💰 报酬：${activeEscort.reward} 两 · 潜能 +10` },
      ]);
      return;
    }
    if (npc.cannotSpeak) {
      setVarTree(prev => markNpcAsKnown(prev, npc.name));
      setActiveTarget(npc.name);
      addLog([{ t: "sys", text: `  ${npc.name}歪着头看你，喉间发出低低的声响，却说不出半句人话——它听不懂你的言语，你也无从与它交谈。（它不能说话，但你可以投喂食物，日久或能与它亲近）` }]);
      return;
    }
    setInteractMode("talk");
    setTalkTarget(npc.name);
    setActiveTarget(npc.name); // talkTarget 只管输入框对话聚焦；activeTarget 才是 act() 里 [交互目标] 的判据，两者要同步
    addLog([{ t: "sys", text: `  你走向${npc.name}，看样子是想说些什么。` }]);
  }, [addLog, questProgress, room.name, flags]);

  // 送礼信息组装：把"送的是什么"落到具体的品阶+描述+建议幅度，喂给 AI 的 <mvu>
  // 提示才有依据可循，不是空对着一个物品名字瞎猜该加多少好感。
  // 优先查百物录（具名物品，desc 最详实）；查不到就退回背包条目自带的字段
  // （匿名装备通常有 quality，杂物道具可能只有 name）；品阶缺失一律按白档兜底。
  // 建议幅度区间跟着六品阶指数曲线走（品阶越高、这件东西在世界观里越贵重，
  // 一份心意的分量也越重），最终仍会被 mvu.js 的 ±15 硬裁剪兜底，这里只是
  // 给 AI 一个贴合实际、别瞎给的参考锚点，不是精确写死的数值。
  const GIFT_AFFECTION_RANGE = { 白: [2, 4], 绿: [4, 6], 蓝: [6, 9], 紫: [9, 12], 橙: [11, 14], 红: [13, 15] };
  const describeGiftForPrompt = useCallback((item) => {
    const itemName = typeof item === "string" ? item : item?.name;
    const catalogEntry = CATALOG_INDEX[itemName];
    const invEntry = typeof item === "object" ? item : null;
    const quality = catalogEntry?.quality || invEntry?.quality || "白";
    const desc = catalogEntry?.desc || invEntry?.desc || "";
    const category = catalogEntry?.category || invEntry?.category || null;
    const categoryLabel = category ? (CATEGORY_LABEL[category] || category) : null;
    const [lo, hi] = GIFT_AFFECTION_RANGE[quality] || GIFT_AFFECTION_RANGE.白;
    const suggestedDelta = Math.round((lo + hi) / 2);
    return { itemName, quality, desc, categoryLabel, range: [lo, hi], suggestedDelta };
  }, []);

  // 送礼：系统裁决层先本地从背包扣除这件物品（不能让 AI 自己决定"要不要真的扣"），
  // 再把"送出"这个既成事实和物品描述一起交给主引擎生成场景反应和好感度判断。
  const handleNpcGift = useCallback((npc, item) => {
    setVarTree(prev => markNpcAsKnown(prev, npc.name));
    setActiveTarget(npc.name); // 让 act() 知道这次送礼针对谁，主叙事才会聚焦这个人写出反应
    const itemName = typeof item === "string" ? item : item.name;
    const giftInfo = describeGiftForPrompt(item);
    setInv(prev => {
      if (typeof item === "object" && item.id != null) {
        return prev.filter(i => !(typeof i === "object" && i.id === item.id));
      }
      const idx = prev.findIndex(i => (typeof i === "string" ? i : i.name) === itemName);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });

    // ── 送物任务 check ──
    // 若当前有进行中的送物类任务，其当前 stage 声明了 deliver:{item,to}，
    // 且这次正好是"把那件物送给那个人"，就推进任务——送对东西给对的人才算数，
    // 不是随便送个礼就过。任务推进走既有 forceAdvanceQuest 链（结算 onReach）。
    let deliveredQuest = null;
    for (const quest of QUCUO_QUESTS) {
      if (!quest.stages?.length) continue;
      const prog = questProgress[quest.id];
      if (prog?.status !== "active") continue;
      const stage = getCurrentStage(quest, prog);
      const d = stage?.deliver;
      if (!d) continue;
      // to 匹配收礼NPC，item 匹配送出物（支持"包含"匹配，容忍"修好的马鞭"vs"马鞭"）
      const toOk = d.to === npc.name;
      const itemOk = itemName === d.item || itemName.includes(d.item) || d.item.includes(itemName);
      if (toOk && itemOk) { deliveredQuest = { quest, flag: Array.isArray(stage.completionFlag) ? stage.completionFlag[0] : stage.completionFlag }; break; }
    }
    if (deliveredQuest) {
      forceAdvanceQuest(deliveredQuest.quest, deliveredQuest.flag);
      addLog([{ t: "affection", text: `  ✓ 你把「${itemName}」交到${npc.name}手上，「${deliveredQuest.quest.title}」推进。` }]);
    }

    const isAngry = varTreeRef.current.角色?.[npc.name]?.生气状态?.active;
    const cmd = isAngry
      ? `在${npc.name}气头上，将「${itemName}」赠予对方，试图以此赔罪示好`
      : (deliveredQuest ? `将「${itemName}」郑重交给${npc.name}——这正是${npc.name}等着的东西` : `将「${itemName}」赠予${npc.name}`);
    // 之前这里漏传 opts，导致送礼走了普通 talk 档意图分类（inputIntent 把"赠予"归到
    // TALK_CASUAL），拿不到 settle 档专属的"这一轮必须判好感"强提示，好感度全凭 AI
    // 自己想不想得到。补上 settle:true + settleNpc 才能真正吃到下面 settleKind:"gift"
    // 那条硬规则。生气赔罪场景不算"送啥都开心"，好感能不能回升交给 AI 按情境自行判断，
    // 所以只在非生气的正常送礼时才标 settleKind。
    act(cmd, [], { settle: true, settleNpc: npc.name, settleKind: isAngry ? null : "gift", giftInfo });
  }, [act, varTree, questProgress, forceAdvanceQuest, addLog, describeGiftForPrompt]);

  // 邀请入队（目前只有雪豹）：系统裁决层直接把伙伴状态设为"已解锁+出战"
  // （不靠AI判断"愿不愿意跟你走"这种概率性的东西——邀请入队是玩家主动点的
  // 确定性按钮，点了就成，不该有"AI这轮心情不好就拒绝了"的不确定性，这跟
  // 送礼的教训一致：凡是玩家主动发起、系统本该兜底成功的动作，都不能把
  // "成不成"这件事交给AI去演，只能交给AI去描述"已经发生的事"）。
  // 走 settle 档 + settleKind:"companion_invite"，让 buildSysBase 注入专属的
  // "前世羁绊/认主"调性铁律（见下方 buildSysBase 里新增的分支）。
  const handleInviteCompanion = useCallback((npc) => {
    if (npc.name !== "雪豹") return; // 目前只有雪豹这一个伙伴候选，其余NPC不会显示这个按钮，这里只是双重保险
    setCompanionState(prev => unlockSnowLeopard(prev));
    setVarTree(prev => markNpcAsKnown(prev, npc.name));
    // 入队即时生效：把作为"村口驻场兽"的雪豹从当前房间移除，此地之人/在场名单/互动
    // 入口当场都不再有它（此后它只以队友身份随玩家在场）。重进村口不再注入，由房间
    // 注入 effect 的 companionStateRef 过滤保证——两处配合，即时消失 + 永不重现。
    setRoom(r => ({ ...r, npcs: removeNpc(r.npcs, n => n.name === "雪豹" && n.companionCandidate) }));
    setActiveTarget(npc.name);
    act(`向雪豹伸出手，郑重邀它同行`, [], { settle: true, settleNpc: npc.name, settleKind: "companion_invite" });
  }, [act]);

  // ⑤ 服食：把原打字正则分支的确定性结算抽成 handler，供物品面板「服食」调用。
  const handleConsumeItem = useCallback((item) => {
    const itemName = typeof item === "object" ? item.name : item;
    const consumable = (typeof item === "object" && item.consumable) || CATALOG_INDEX[itemName]?.consumable || null;
    if (!consumable) { addLog([{ t: "sys", text: `  ${itemName}并非可服用之物。` }]); return; }
    const res = useConsumable(consumable, char);
    if (!res.ok) { addLog([{ t: "sys", text: `  ${res.reason}` }]); return; }
    if (res.hpDelta) setChar(c => ({ ...c, hp: [Math.min(c.hp[1], c.hp[0] + res.hpDelta), c.hp[1]] }));
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
    const completedQuests = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
    const allowed = new Set(Object.keys(mapData).filter(n => isNodeUnlocked(n, { completedQuests, flags })));
    if (!isNodeUnlocked(destName, { completedQuests, flags })) { addLog([{ t: "sys", text: `  「${destName}」此刻还去不得，路未通。` }]); return; }
    const path = findPath(room.name, destName, allowed);
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
    if (!room.npcs?.length) return;
    setVarTree(prev => {
      const chars = { ...(prev.角色 || {}) };
      let changed = false;
      for (const n of room.npcs) {
        const cur = chars[n.name] || {};
        if (cur.所在地 !== room.name) { chars[n.name] = { ...cur, 所在地: room.name }; changed = true; }
      }
      return changed ? { ...prev, 角色: chars } : prev;
    });
  }, [room.name, room.npcs]);

  // 飞鸽回信时长：按玩家当前据点与收信人所在据点的直线距离折算，钳制在 1–12 时辰。
  const pigeonDelayShichen = useCallback((npcName) => {
    const here = QUCUO_MAP[room.name] || { x: 0, y: 0 };
    const loc = varTreeRef.current.角色?.[npcName]?.所在地 || room.name;
    const there = QUCUO_MAP[loc] || here;
    const dist = Math.hypot((there.x ?? 0) - (here.x ?? 0), (there.y ?? 0) - (here.y ?? 0));
    return { delay: Math.max(1, Math.min(12, Math.round(dist * 1.5) || 1)), loc };
  }, [room.name, varTree]);

  // 发信：写进该 NPC 的独立信件线（飞鸽）+ 登记进共享事实账本（knowledge），排入待回队列。
  const sendPigeonLetter = useCallback((npcName, content, opts = {}) => {
    const channel = opts.channel || "pigeon"; // pigeon 飞鸽(需鸽子·只信) | post 驿站寄信 | postgift 驿站送礼+信
    const giftName = opts.gift || null;
    const text = (content || "").trim();
    if (!npcName) { addLog([{ t: "sys", text: "  未指定收信之人。" }]); return; }
    if (!text) { addLog([{ t: "sys", text: "  信笺空空，无从落笔。" }]); return; }
    if (channel === "pigeon" && (char.pigeons || 0) <= 0) {
      addLog([{ t: "sys", text: "  你手头没有信鸽——去驿站买鸽子，或直接到驿站寄信。" }]); return;
    }
    // 附礼（仅 postgift）：从背包取出该物
    if (channel === "postgift" && giftName) {
      setInv(prev => { const i = prev.findIndex(x => (typeof x === "object" ? x.name : x) === giftName); return i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)]; });
    }
    const { delay, loc } = pigeonDelayShichen(npcName);
    // 飞鸽快（×1），驿卒脚程慢（×1.5）
    const shichen = channel === "pigeon" ? delay : Math.max(1, Math.min(12, Math.round(delay * 1.5)));
    const arriveTime = time + shichen * 2; // 1 时辰 = 2 回合
    const factId = `letter_send_${npcName}_${time}`;
    const chLabel = channel === "pigeon" ? "飞鸽传书" : channel === "postgift" ? "驿站送礼" : "驿站寄书";
    addLog([{ t: "cmd", text: `> ${chLabel}致「${npcName}」：${text}${giftName ? `（附礼：${giftName}）` : ""}` }]);
    if (channel === "pigeon") setChar(c => ({ ...c, pigeons: Math.max(0, (c.pigeons || 0) - 1) }));
    setVarTree(prev => {
      const chars = { ...(prev.角色 || {}) };
      const cur = chars[npcName] || {};
      chars[npcName] = { ...cur, 飞鸽: [...(cur.飞鸽 || []), { dir: "send", content: text, turn: time, gift: giftName || undefined }] };
      const 世界 = { ...(prev.世界 || {}) };
      世界.飞鸽待回 = [...(世界.飞鸽待回 || []), { id: factId, npcName, sentContent: text, arriveTime, npcLoc: loc, channel, giftName: giftName || null }];
      let vt = { ...prev, 角色: chars, 世界 };
      vt = registerFact(vt, { id: factId, 摘要: `${char.name || "主角"}${chLabel}致信${npcName}${giftName ? `并附礼「${giftName}」` : ""}（往${loc}）。`, 标签: "飞鸽传书", 知晓者: [{ name: npcName, 途径: "亲历" }] }, time);
      return vt;
    });
    // 结构化摘要先垫底，随即叫 AI 结合信文写一句白话古文小总结覆盖上去（不再是死模板）。
    aiSummarizeFact(factId, `主角${chLabel}修书给${npcName}${giftName ? `，随信附礼「${giftName}」` : ""}，信中大意：${text.slice(0, 50)}`);
    addLog([{ t: "item", text: `  🕊 ${channel === "pigeon" ? "信鸽已放飞" : "书信已托驿卒送出"}，往「${loc}」，约 ${shichen} 个时辰后当有回音。` }]);
    setInput(""); setPigeonTarget(null); setInteractMode("action");
    setTime(t => t + 1);
    // 飞鸽全文线之外，额外浓缩一张 owner=收信人 的私有小纸条进向量库——
    // 全文线管逐字重读保证回信连贯，这张管"日后模糊想起你俩这段书信往来"，两者并行不冲突。
    jotNote({ text: `修书致${npcName}${giftName ? `并附礼「${giftName}」` : ""}：${text.slice(0, 24)}${text.length > 24 ? "…" : ""}`, owner: [{ name: npcName, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.PIGEON });
  }, [time, char, inv, pigeonDelayShichen, addLog, jotNote, aiSummarizeFact]);

  // 驿站买鸽子
  const buyPigeon = useCallback((qty, price) => {
    const cost = qty * price;
    if ((char.money || 0) < cost) { addLog([{ t: "sys", text: "  银两不够，买不起这些鸽子。" }]); return; }
    setChar(c => ({ ...c, money: (c.money || 0) - cost, pigeons: (c.pigeons || 0) + qty }));
    addLog([{ t: "item", text: `  🕊 买下 ${qty} 只信鸽（-${cost} 两），现有 ${(char.pigeons || 0) + qty} 只。` }]);
  }, [char, addLog]);

  // 鸽子笼：每日免费领信鸽，不花银两。跟赌坊同一套"当天领没领过"判断模式，
  // 用 flags 记 pigeon_collected_day_${dayIdx}（dayIdx = time/24，真正的天数）。
  const handleCollectPigeons = useCallback(({ qty, dayIdx }) => {
    if (flags.includes(`pigeon_collected_day_${dayIdx}`)) return;
    setFlags(f => [`pigeon_collected_day_${dayIdx}`, ...f.filter(x => !x.startsWith("pigeon_collected_day_"))]);
    setChar(c => ({ ...c, pigeons: (c.pigeons || 0) + qty }));
    addLog([{ t: "item", text: `  🕊 从鸽子笼领了 ${qty} 只信鸽，现有 ${(char.pigeons || 0) + qty} 只。` }]);
  }, [char, flags, addLog]);

  // 驿站寄信/送礼总入口（供 TransportScreen 回调）
  const handlePostSend = useCallback(({ npcName, content, channel, gift }) => {
    setActiveBuilding(null);
    sendPigeonLetter(npcName, content, { channel, gift });
  }, [sendPigeonLetter]);

  // 回信生成：以收信人口吻 + 其独立信件线（记忆独立）+ 共享事实账本（记忆共享）作答。
  const replyPigeonLetter = useCallback(async (letter) => {
    const { npcName, sentContent, id, arriveTime, channel, giftName } = letter;
    try {
      const npcObj = room.npcs.find(n => n.name === npcName) || {};
      const attrs = varTreeRef.current.角色?.[npcName] || {};
      const curAff = typeof attrs.好感度 === "number" ? attrs.好感度 : 0;
      const thread = (attrs.飞鸽 || []).map(m => `${m.dir === "send" ? "主角来信" : "你的回信"}：${m.content}${m.gift ? `（附礼：${m.gift}）` : ""}`).join("\n");
      const facts = allFactSummaries(varTreeRef.current, 12).map(f => `· （${getTimeStr(f.诞生回合 || 0)}）${f.摘要}${f.标签 ? `〔${f.标签}〕` : ""}`).join("\n");
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
      let reply = (text || "").trim() || "（信纸空落落的，对方似乎无话可说。）";
      // 解析隐藏标记
      let affDelta = 1;
      const am = reply.match(/⟦好感\s*([+-]?\d+)\s*⟧/);
      if (am) affDelta = Math.max(-3, Math.min(8, parseInt(am[1], 10) || 0));
      let giftBack = null;
      const gm = reply.match(/⟦回礼[:：]\s*([^|｜⟧]+)[|｜]\s*(weapon|armor|accessory|misc)\s*⟧/);
      if (gm) giftBack = { name: gm[1].trim(), category: gm[2].trim() };
      reply = reply.replace(/⟦好感\s*[+-]?\d+\s*⟧/g, "").replace(/⟦回礼[:：][^⟧]*⟧/g, "").trim();

      const newAff = Math.max(0, Math.min(100, curAff + affDelta));
      // 回礼硬门槛：必须送过礼 + 回信后好感度≥50，才真的回礼
      const doReturnGift = canReturnGift && giftBack && newAff >= 50;
      let giftItem = null;
      if (doReturnGift) {
        // 品质按好感度档裁决（系统定，AI 只提名合身之物）：50~69→白/绿，70~89→绿/蓝，90+→蓝/紫
        const pool = newAff >= 90 ? ["蓝", "紫"] : newAff >= 70 ? ["绿", "蓝"] : ["白", "绿"];
        const q = pool[Math.floor(Math.random() * pool.length)];
        giftItem = makeGameItem({ name: giftBack.name, category: giftBack.category, quality: q });
      }

      const replyFactId = `letter_reply_${npcName}_${arriveTime}`;
      setVarTree(prev => {
        const chars = { ...(prev.角色 || {}) };
        const cur = chars[npcName] || {};
        chars[npcName] = { ...cur, 好感度: newAff, 飞鸽: [...(cur.飞鸽 || []), { dir: "reply", content: reply, turn: arriveTime, gift: doReturnGift ? giftBack.name : undefined }] };
        const 世界 = { ...(prev.世界 || {}) };
        世界.飞鸽待回 = (世界.飞鸽待回 || []).filter(l => l.id !== id);
        let vt = { ...prev, 角色: chars, 世界 };
        vt = registerFact(vt, { id: replyFactId, 摘要: `${npcName}回信${char.name || "主角"}${doReturnGift ? `并回赠「${giftBack.name}」` : ""}。`, 标签: "飞鸽传书", 知晓者: [{ name: npcName, 途径: "亲历" }] }, arriveTime);
        return vt;
      });
      // 结构化摘要垫底，随即叫 AI 结合回信内容写一句小总结覆盖。
      aiSummarizeFact(replyFactId, `${npcName}回信${char.name || "主角"}${doReturnGift ? `，并回赠「${giftBack.name}」` : ""}，信中大意：${reply.slice(0, 50)}`);
      if (giftItem) setInv(prev => [...prev, giftItem]);
      const logs = [
        { t: "item", text: `  🕊 一只信鸽落下——${npcName}的回信到了。` },
        { t: "narrator", text: `  「${npcName}来信」${reply}` },
      ];
      if (affDelta !== 0) logs.push({ t: "affection", text: `  💗 ${npcName} 好感度 ${affDelta > 0 ? "+" : ""}${affDelta}（${curAff} → ${newAff}）` });
      if (doReturnGift) logs.push({ t: "item", text: `  🎁 随信附回礼一件：「${giftItem.name}」（${giftItem.quality}）。` });
      else if (canReturnGift && giftBack && newAff < 50) logs.push({ t: "sys", text: `  （${npcName}收下了礼，情谊尚浅，未便回赠。）` });
      addLog(logs);
      // 回信同样额外浓缩一张 owner=对方 的私有小纸条（与全文线并行）。
      jotNote({ text: `收到${npcName}的回信${doReturnGift ? `并得回礼「${giftItem.name}」` : ""}：${reply.slice(0, 24)}${reply.length > 24 ? "…" : ""}`, owner: [{ name: npcName, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.PIGEON });
    } catch (e) {
      pigeonProcessing.current.delete(id);
      setVarTree(prev => { const 世界 = { ...(prev.世界 || {}) }; 世界.飞鸽待回 = (世界.飞鸽待回 || []).filter(l => l.id !== id); return { ...prev, 世界 }; });
      addLog([{ t: "sys", text: `  （寄往${npcName}的信鸽半途迷了路，这封回信终未送达。）` }]);
    }
  }, [room.npcs, varTree, apiCfg, preset, char, addLog, jotNote, aiSummarizeFact]);

  // 到点收信：时间推进到 arriveTime 时，逐封生成回信（ref 去重，防重复触发）。
  useEffect(() => {
    const pending = varTree.世界?.飞鸽待回 || [];
    const due = pending.filter(l => time >= l.arriveTime && !pigeonProcessing.current.has(l.id));
    if (!due.length) return;
    due.forEach(l => { pigeonProcessing.current.add(l.id); replyPigeonLetter(l); });
  }, [time, varTree, replyPigeonLetter]);

  const handleNpcDuel = useCallback(async (npc) => {
    // 实质性互动（打过一场架）本来就是认识对方的充分条件，不能只靠"细看/对话"
    // 两个入口才算认识——玩家跟这个人交过手、见过好感度变化，说"尚未认识"是反直觉的。
    setVarTree(prev => markNpcAsKnown(prev, npc.name));
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
    const shopData = rollShopStock(npc.name, time) || buildShopInventory(npc.name);
    if (!shopData) {
      addLog([{ t: "sys", text: `  ${npc.name}摆摆手，「小店暂无货可卖。」` }]);
      return;
    }
    setTradingShop({ npcName: npc.name, ...shopData });
  }, [addLog]);

  // 拜师学艺：统一走 tryLearnFromMaster（src/kungfu/learnSkill.js）。
  // 高手（levelCap≥1）教专属招，平民（levelCap<1）教通用招池的白档基本功——
  // 这是这次改动新加的行为，此前平民直接拒绝拜师。价格按好感折价曲线走低
  // （40-59原价/60-79七折/80-99五折/100免费），银两不够时提示但不强行学。
  const handleNpcLearnSkill = useCallback((npc) => {
    const result = tryLearnFromMaster(npc, varTreeRef.current, skills, char);
    if (!result.ok) {
      addLog([{ t: "sys", text: `  ${result.reason}` }]);
      return;
    }
    if ((char.money || 0) < result.totalPrice) {
      addLog([{ t: "sys", text: `  ${npc.name}愿意传授，但束脩需银${result.totalPrice}两（现有${char.money || 0}两），你银两不够，一时难以成行。` }]);
      return;
    }

    // 拜师本就需要好感≥40 才能走到这一步，早就该算"认识"——但不能在门槛检查
    // 之前调用，否则 markNpcAsKnown 给的兜底好感度10会在毫无交情时被拜师流程
    // 自己垫出资格，等于绕过门槛。放在门槛通过之后，纯粹是补齐显示状态。
    setVarTree(prev => markNpcAsKnown(prev, npc.name));
    setActiveTarget(npc.name);
    setChar(c => ({ ...c, money: (c.money || 0) - result.totalPrice }));
    // 统一并入"武学"栏：拜师所授做成【固定完整招】——不修炼、不成长，学到即完整版。
    // 加进 skills 后，moveset 由 useEffect 自动重算带出（fixed 条目原样取用招式本体）。
    setSkills(sk => [...sk, ...result.freshSkills]);
    const priceNote = result.totalPrice > 0 ? `，奉上束脩银${result.totalPrice}两` : "（好感深厚，分文不取）";
    const label = result.isMaster ? "授业绝学" : "江湖通行招";
    addLog([{ t: "sys", text: `  （习得 ${result.freshSkills.length} 招${priceNote}，已录入武学栏 · ${label}，学即完整）` }]);
    // 结算（加招/去重/并入武学栏）已由确定性代码完成，这里只把"发生了什么"交给主叙事AI
    // 写成一段像样的话，不是让AI决定学没学到——参照 handleBuySkill 的"结算+act陈述"范式。
    // settleKind:"learn_skill" 必须传——它决定了单调用走 buildSettleMvuNote 的"本轮必须给
    // <mvu>"铁律、双调用走 LEARN_SKILL 专属提取spec。此前这里只传了 settleNpc 没传
    // settleKind，两条路都退化成"让AI自己看着办要不要加好感"，实测基本不加，表现为
    // "交了束脩、学了绝学，好感纹丝不动"。
    const verb = result.isMaster ? "将平生所学" : "将几手江湖基本功";
    act(`拜${npc.name}为师，${npc.name}${verb}「${result.moveBrief}」倾囊相授，我凝神习得`, [], {
      settle: true,
      settleNpc: npc.name,
      settleKind: "learn_skill",
      learnInfo: {
        isMaster: result.isMaster,
        moveBrief: result.moveBrief,
        totalPrice: result.totalPrice,
        beast: !!npc.beast || !!npc.cannotSpeak, // 兽类师父不说人话，叙事得靠动作示范
      },
    });
  }, [char, skills, varTree, addLog, act]);

  // 偷窃：偷物+偷师（偷招）二合一，同一次判定，成功后再二选一决定这次偷到的
  // 是物品还是招式（tryStealFrom 内部处理）。身法（char.special.身法）现在也
  // 参与成功率计算，跟好感度独立相加——手越利索，越容易得手。
  const handleNpcSteal = useCallback((npc) => {
    const agility = char.special?.身法 ?? 0;
    // 开 trace。偷窃此前完全不进「🧭全流程日志」——一旦偷不到东西，玩家和我都
    // 只能猜（是没得手？池子空？还是转成偷招了？），只好靠反复试。
    // 现在把判定链的每一步都记下来，尤其**池子的实际内容**：那是前几次反复修
    // 掉落/偷窃 bug 时最想看却看不到的东西。
    const _st = startTrace(`偷窃 ${npc?.name || "?"}`, `偷窃 ${npc?.name || "?"}`);
    const poolAll = npc?.carriedItems || [];
    const poolUsable = poolAll.filter(it => !it.stolen);
    traceStep(_st, "随身物池", poolUsable.length ? "info" : "block",
      poolAll.length
        ? `共${poolAll.length}件，可偷${poolUsable.length}件：${poolUsable.map(i => `${i.name}(${i.category || "?"}/${i.quality || "?"})`).join("、") || "无"}`
        : `carriedItems 为空或未固化 —— 这种情况偷不到任何物件，只可能偷到招式。若此人本该有随身物，说明固化/回填没生效。`);
    traceStep(_st, "身法与好感", "info",
      `身法${agility}，好感${varTreeRef.current.角色?.[npc?.name]?.好感度 ?? 0} → 成功率约 ${(stealSuccessRate(varTreeRef.current.角色?.[npc?.name]?.好感度 ?? 0, agility) * 100).toFixed(0)}%`);

    const result = tryStealFrom(npc, varTreeRef.current, skills, char, agility);

    if (!result.ok) {
      traceStep(_st, "判定", "block", result.reason);
      endTrace(_st, "偷窃未进行");
      addLog([{ t: "sys", text: `  ${result.reason}` }]);
      return;
    }
    traceStep(_st, "掷骰", result.success ? "pass" : "block",
      `成功率${(result.rate * 100).toFixed(0)}% → ${result.success ? "得手" : "被察觉"}`);
    if (result.success) {
      traceStep(_st, "产出分流", "info",
        `结局=${result.outcome === null ? "对方一无所有" : result.outcome === "move" ? "偷到招式" : "偷到物件"}`
        + (result.outcome === "item" ? `：${result.item.name}(${result.item.category})` : "")
        + (result.outcome === "move" ? `：${result.move.name}` : ""));
    }

    if (!result.success) {
      addLog([
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你手法生涩，被${npc.name}当场察觉！他脸色一沉，显然动了真怒。` },
      ]);
      // 偷窃被当场发现，跟偷窃成功（神不知鬼不觉）性质完全相反——
      // 对方已经知道玩家是谁、双方有了正面冲突接触，这时候标记认识才合理；
      // 偷窃成功恰恰不该标记，因为那意味着对方完全没察觉玩家的存在。
      endTrace(_st, `被${npc.name}察觉，好感-${result.favorabilityLoss}`);
      noteAction("stealFail");
      // 被当场发现：对方**确实知道**是你干的，所以这条记忆记在他名下（亲历），
      // 日后他提起来、别人问起来都对得上。
      jotNote({
        text: `对${npc.name}下手偷窃，被他当场察觉，好感掉了${result.favorabilityLoss}，他动了真怒。`,
        owner: [{ name: npc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      });
      setVarTree(prev => {
        const known = markNpcAsKnown(prev, npc.name);
        const cur = known.角色?.[npc.name] || {};
        const newFavorability = Math.max(0, (cur.好感度 || 0) - result.favorabilityLoss);
        return {
          ...known,
          角色: {
            ...known.角色,
            [npc.name]: { ...cur, 好感度: newFavorability, 生气状态: result.angryState },
          },
        };
      });
      return;
    }

    if (result.outcome === null) {
      endTrace(_st, `得手但${npc.name}身无长物`);
      noteAction("steal");
      addLog([{ t: "sys", text: `  你想对${npc.name}下手，摸了半天，却发现他身上早已一无所有，只得悻悻作罢。` }]);
      // 手法得逞但一无所获。仍记一笔——"这个人身上已经没东西了"本身是有用的信息，
      // 免得玩家过一阵子又去摸一遍。同样不挂 owner（他没察觉）。
      jotNote({
        text: `摸了${npc.name}的身，他身上已经一无所有。`,
        source: NOTE_SOURCE.DUMB,
      });
      return;
    }

    if (result.outcome === "item") {
      const target = result.item;
      const fullItem = makeGameItem({ name: target.name, category: target.category || "misc", quality: target.quality || "白" });
      addLog([
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你运指如风，趁${npc.name}不备，将「${target.name}」（${target.quality}）神不知鬼不觉地顺入了自己怀中。` },
        { t: "loot", text: `🤫 妙手空空：「${target.name}」`, item: fullItem, source: "steal", fromNpc: npc.name },
      ]);
      setInv(prev => [...prev, { ...fullItem, id: `stolen_${target.id}_${Date.now()}` }]);
      endTrace(_st, `顺走「${target.name}」`);
      noteAction("steal");
      // 【owner 刻意留空】偷窃得手意味着对方**完全没察觉**。若把他挂成 owner，
      // 这条就成了他"亲历/目击"的事实，之后他会在对话里提起自己被偷——
      // 而他根本不知道。这跟上面"被发现"那条的处理正相反，是同一套 owner 语义的两面。
      jotNote({
        text: `从${npc.name}身上顺走了「${target.name}」，他毫无察觉。`,
        source: NOTE_SOURCE.DUMB,
      });
      // 标记这件物品已被偷走，避免同一件东西被偷第二次
      setRoom(r => ({ ...r, npcs: markCarriedLost(r.npcs, npc.name, target, "stolen") }));
      return;
    }

  // result.outcome === "move"：偷师成功，把偷来的招并入武学栏（fixed，学即完整）
  addLog([
    { t: "cmd", text: `> 偷窃 ${npc.name}` },
    { t: "desc", text: `  你悄然窥破${npc.name}出手的门道，趁其不备，竟将「${result.move.name}」这一手偷学了去！` },
    { t: "loot", text: `🤫 偷師得手：「${result.move.name}」`, skill: { name: result.move.name, quality: result.move.quality || result.skill?.quality || "白", moveType: result.move.type }, desc: result.move.desc, source: "steal", fromNpc: npc.name },
  ]);
  setSkills(sk => sk.some(s => s.id === result.skill.id) ? sk : [...sk, result.skill]);
  endTrace(_st, `偷师「${result.move.name}」`);
  noteAction("steal");
  // 偷师同理不挂 owner——他不知道自己的招被人看会了。
  jotNote({
    text: `偷看${npc.name}出手的门道，把「${result.move.name}」这一手学了去，他没有察觉。`,
    source: NOTE_SOURCE.DUMB,
  });
  }, [varTree, skills, char, addLog, noteAction, jotNote]);

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
    if ((char.money || 0) < cost) return;
    setChar(c => ({ ...c, money: c.money - cost, hp: [c.hp[1], c.hp[1]] }));
    setTime(t => t + 23); // 睡一整天=24回合；此处+23，下面叙事段 act() 会再+1，合计正好一天（修+25双重计时 bug）
    addLog([{ t: "stat", text: `  气血回满 · 安睡一日` }]);
    // 数值结算完全由系统裁决（扣银两、回满气血、推进时间），跟AI这次
    // 具体怎么写无关。结算完之后，把"发生了什么"拼成一句自然语言交给
    // 主叙事 act()——跟玩家平时自己打字行动走的是同一条管线，不是另开
    // 一套收窄自由度的专属harness，AI可以正常演绎这个场景。
    act(`在${activeBuilding?.name}住下${roomType}，花费${cost}两`, [], { settle: true });
  }, [char, activeBuilding, addLog, act]);

  const handleBuildingHeal = useCallback((cost, healAmt) => {
    if ((char.money || 0) < cost) return;
    setChar(c => ({ ...c, money: c.money - cost, hp: [Math.min(c.hp[0] + healAmt, c.hp[1]), c.hp[1]] }));
    act(`在${activeBuilding?.name}求医问药，花费${cost}两，恢复了${healAmt}点气血`, [], { settle: true });
  }, [char, activeBuilding, addLog, act]);

  const handleBuySkill = useCallback((catalogItem) => {
    if ((char.money || 0) < catalogItem.price) return;
    setChar(c => ({ ...c, money: c.money - catalogItem.price }));
    setSkills(prev => {
      if (prev.some(s => s.id === catalogItem.id)) return prev;
      return [...prev, makeSkillEntry(catalogItem)];
    });
    act(`购得秘籍「${catalogItem.name}」，费银${catalogItem.price}两，习得此功`, [], { settle: true });
  }, [char, addLog, act]);

  const handleGamble = useCallback(({ mode, bet, luck, dayIdx }) => {
    if ((char.money || 0) < bet) return;
    setFlags(f => [`gambled_day_${dayIdx}`, ...f.filter(x => !x.startsWith("gambled_day_"))]);
    let line;
    let narrateLine;
    if (mode === "item") {
      const qualities = ["白","绿","蓝","紫","橙"];
      const qIdx = Math.min(qualities.length - 1, Math.floor(luck / 2.5));
      const quality = qualities[qIdx];
      const catKeys = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY];
      const cat = catKeys[Math.floor(Math.random() * catKeys.length)];
      const names = { [ITEM_CATEGORY.WEAPON]: ["彩头刀","幸运剑","财神棍"], [ITEM_CATEGORY.ARMOR]: ["福气甲","招财护臂","吉祥软甲"], [ITEM_CATEGORY.ACCESSORY]: ["运气链","财运玉佩","好运吊坠"] };
      const name = names[cat][Math.floor(Math.random() * 3)];
      const item = makeGameItem({ name, category: cat, quality });
      setChar(c => ({ ...c, money: c.money - bet }));
      setInv(prev => [...prev, { ...item, id: `gamble_${Date.now()}`, equipped: false }]);
      narrateLine = `在赌坊押了${bet}两玩物品抽奖，抽中了「${name}」（${quality}）`;
    } else {
      const r = Math.random() * 100;
      const loseChance = 60 - 30 * (luck / 10);
      const tieChance = 30;
      let result;
      if (r < loseChance) { result = "赔"; setChar(c => ({ ...c, money: c.money - bet })); }
      else if (r < loseChance + tieChance) { result = "平"; }
      else { result = "赢"; setChar(c => ({ ...c, money: c.money + bet })); }
      const text = { 赔: `亏了${bet}两`, 平: "保本", 赢: `赢了${bet}两` }[result];
      narrateLine = `在赌坊押注${bet}两，骰子一落，${text}`;
    }
    // 赌坊可能连续下注，act() 不会关闭面板本身（面板关闭现在完全由
    // "最小化"/"关闭"两个独立按钮控制），玩家看完这句叙事后自己决定
    // 要不要再赌一把。
    act(narrateLine, [], { settle: true });
  }, [char, addLog, act]);

  const handleTravel = useCallback((dest, price) => {
    if ((char.money || 0) < price) return;
    setChar(c => ({ ...c, money: c.money - price }));
    const destNode = getMapNode(dest);
    if (!destNode) return;
    setRoom({
      name: dest,
      desc: destNode.desc,
      exits: Object.keys(destNode.exits),
      npcs: [],
      items: [],
    });
    if (!mapData[dest]) setMapData(m => ({ ...m, [dest]: { x: destNode.x, y: destNode.y } }));
    setTime(t => t + 5);
    addLog([
      { t: "room", text: "" },
      { t: "room", text: `    ${dest}（马车）` },
      { t: "room", text: "" },
      { t: "sys", text: `  你乘马车前往${dest}，花费${price}两，平安抵达。` },
    ]);
    setActiveBuilding(null);
  }, [char, mapData, addLog]);

  const handleServiceOrder = useCallback((item, karmaChange = 0) => {
    if ((char.money || 0) < item.price) return;
    setChar(c => ({ ...c, money: c.money - item.price }));
    if (karmaChange !== 0) setDao(d => ({ ...d, karma: (d.karma || 0) + karmaChange }));
    const buffFlag = makeBuffFlag(item.buff, item.val, time, item.duration);
    setFlags(f => [...f, buffFlag]);
    act(`点了${item.name}，花费${item.price}两`, [], { settle: true });
  }, [char, dao, time, addLog, act]);

  const handlePray = useCallback(() => {
    const karmaPerPray = activeBuilding?.karmaPerPray || 10;
    if ((dao.karma || 0) < karmaPerPray) return;
    const SEVEN_DIMS = ["根骨","悟性","体魄","魅力","智谋","身法","气运"];
    const available = SEVEN_DIMS.filter(d => (char.special?.[d] ?? 0) < 10);
    if (available.length === 0) return;
    const attr = available[Math.floor(Math.random() * available.length)];
    setDao(d => ({ ...d, karma: d.karma - karmaPerPray }));
    setChar(c => ({ ...c, special: { ...c.special, [attr]: Math.min(10, (c.special?.[attr] ?? 0) + 1) } }));
    act(`在佛前虔诚跪拜，消耗${karmaPerPray}功德，${attr}提升了1点`, [], { settle: true });
  }, [dao, char, activeBuilding, addLog, act]);

  const handleReadBook = useCallback((book) => {
    act(`翻开「${book.name}」细细阅读，对${book.topic}有了更多了解`, [], { settle: true });
  }, [addLog, act]);

  const handleBuyBook = useCallback((book) => {
    if ((char.money || 0) < book.price) return;
    setChar(c => ({ ...c, money: c.money - book.price }));
    if (book.skillEntry) {
      setSkills(prev => {
        if (prev.some(s => s.id === book.skillEntry.id)) return prev;
        return [...prev, { ...book.skillEntry }];
      });
      act(`购得「${book.name}」，花费${book.price}两，习得${book.skillEntry.name}`, [], { settle: true });
    }
  }, [char, addLog, act]);

  const handleDeposit = useCallback((amount) => {
    if ((char.money || 0) < amount) return;
    setChar(c => ({ ...c, money: c.money - amount }));
    setDeposit(d => d + amount);
    setDepositedAt(time);
    act(`在钱庄存入${amount}两`, [], { settle: true });
  }, [char, time, addLog, act]);

  const handleWithdraw = useCallback((total) => {
    setDeposit(0);
    setDepositedAt(null);
    setChar(c => ({ ...c, money: (c.money || 0) + total }));
    act(`在钱庄取出银两${total}两（含利息）`, [], { settle: true });
  }, [addLog, act]);

  const handlePledge = useCallback((item, pledgeValue) => {
    setInv(prev => prev.filter(i => (typeof i === "object" ? i.id : i) !== item.id));
    setPledgedItems(prev => [...prev, { item, pledgeValue }]);
    setChar(c => ({ ...c, money: (c.money || 0) + pledgeValue }));
    act(`把「${item.name}」质押给当铺，得${pledgeValue}两`, [], { settle: true });
  }, [addLog, act]);

  const handleRedeem = useCallback((idx, redeemCost) => {
    if ((char.money || 0) < redeemCost) return;
    const pledged = pledgedItems[idx];
    if (!pledged) return;
    setChar(c => ({ ...c, money: c.money - redeemCost }));
    setPledgedItems(prev => prev.filter((_, i) => i !== idx));
    setInv(prev => [...prev, { ...pledged.item, equipped: false }]);
    act(`从当铺赎回「${pledged.item?.name}」，花费${redeemCost}两`, [], { settle: true });
  }, [char, pledgedItems, addLog, act]);

  const handleAcceptEscort = useCallback((quest) => {
    setQuestProgress(prev => ({ ...prev, [quest.id]: { active: true } }));
    act(`接下护镖任务「${quest.title}」，目标是前往${quest.targetLocation}找${quest.targetNpc}交货`, [], { settle: true });
  }, [addLog, act]);

  const handleAcceptBounty = useCallback((quest) => {
    setQuestProgress(prev => ({ ...prev, [quest.id]: { active: true, count: 0 } }));
    act(`接下悬赏「${quest.title}」`, [], { settle: true });
  }, [addLog, act]);

  const handleClaimBounty = useCallback((quest) => {
    setQuestProgress(prev => ({ ...prev, [quest.id]: { active: false } }));
    setFlags(f => [...f, `quest_done_${quest.id}`]);
    setChar(c => ({ ...c, money: (c.money || 0) + quest.reward }));
    setDao(d => ({ ...d, karma: (d.karma || 0) + (quest.karmaBonus || 0) }));
    setPot(p => p + 10); // 保底潜能：完成悬赏任务
    act(`回来交付悬赏「${quest.title}」，领取赏金${quest.reward}两`, [], { settle: true });
  }, [addLog, act]);

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
    if (res.type === "buy") {
      // 买石头（进场买毛料）：真扣钱。这是"真赌石"的本钱——切开亏赚自负。
      // 不 setActiveBuilding(null)：买下后要留在料场继续开刀，不能把面板关掉。
      setChar(c => ({ ...c, money: (c.money || 0) - res.price }));
      addLog([{ t: "item", text: `  💰 你相中一块${res.changKouLabel || ""}毛料，付${res.price}两买下，就地开切。` }]);
      jotNote({ text: `在玉石料场花${res.price}两买下一块赌石毛料。`, source: NOTE_SOURCE.DUMB });
      return;
    }
    setActiveBuilding(null);
    if (res.type === "keep") {
      // 据为己有：把开出的料作为「玉石原料」收进背包。带上种水档/品质天花板/场口，
      // 供金玉行打造时读取——料的品质天花板决定成品品质上限。命名用种水档标签(如
      // "帝王绿玻璃种·玉料")，category 用 misc(原料，不是可装备的成品)，jadeSpec 存
      // 结构化信息供金玉行 handler 读。
      const st = res.stone || {};
      const tier = (JADE_TIERS.find(t => t.key === st.jadeTier) || {});
      const tierLabel = tier.label || "玉料";
      const cap = st.quality || tier.quality || "白";
      const ckLabel = CHANG_KOU[st.changKou]?.label || "";
      const jadeItem = {
        name: `${tierLabel}·玉料`,
        category: ITEM_CATEGORY.MISC,
        quality: cap,
        desc: `${ckLabel ? ckLabel + "开出的" : ""}一块${tierLabel}玉料，品质天花板${cap}。可拿去金玉行雕琢成器。`,
        jadeSpec: { jadeTier: st.jadeTier, qualityCap: cap, changKou: st.changKou, tierLabel },
      };
      setInv(prev => [...prev, { ...jadeItem, id: `jade_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` }]);
      addLog([{ t: "item", text: `  💎 你把这块「${tierLabel}」料收入行囊，日后可去金玉行请玉匠雕琢成器。` }]);
      jotNote({ text: `在玉石料场开出一块${tierLabel}玉料，收进了行囊。`, source: NOTE_SOURCE.NARRATIVE });
      return;
    }
    if (res.type === "sell") {
      setChar(c => ({ ...c, money: (c.money || 0) + res.price }));
      act(`在天都镇玉石料场，把开出的料子卖给${res.bidderName || "买家"}，得银${res.price}两`, [], { settle: true, settleNpc: res.bidderName || null });
    } else if (res.type === "forge") {
      setChar(c => ({ ...c, money: (c.money || 0) - 200 }));
      const r = res.result;
      if (r.result === "success") {
        act(`在天都镇玉石料场，把开出的料子委托温掌柜的老工匠雕琢，做成一件${r.quality}档玉器`, [], { settle: true, settleNpc: "温掌柜" });
      } else {
        act(r.result === "stolen" ? "在天都镇玉石料场委托做玉器，料却被料场老师傅偷梁换柱，血本无归"
                                   : "在天都镇玉石料场委托做玉器，料在砣机上崩废了");
      }
    }
  }, [act, addLog, jotNote]);

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
    if ((char.money || 0) < cost) return;
    if (!chosen || !chosen.name) return;
    setChar(c => ({ ...c, money: c.money - cost }));
    const spec = {
      name: chosen.name,
      category: chosen.category || "weapon",
      effect: chosen.effect || {},
      sixDim: chosen.sixDim || {},
      material: (threeFields?.material || "").trim(),
      requirement: (threeFields?.requirement || "").trim(),
    };
    setFlags(f => [...f, `forge_pending_${currentTime}_${luck}_${encodeURIComponent(JSON.stringify(spec))}`]);
    // 接单叙事：把选定这件成品的完整信息(名字/类别/词条特性)都发给主叙事，让铁匠的话
    // 呼应实际要造的东西——比如选了带"无视防御"词条的刀，铁匠可自然说"给你开个透甲的
    // 刃"；选了"气运"六维的饰物，可说"再给你錾道纳福的纹"。此前只发了名字/材料/要求，
    // 词条没发过去，铁匠说的跟实际成品脱节。词条转成可读中文特性描述(不发 forceFirst 这类
    // 原始字段名，AI 读了也是照字段念)。点明定金已付、订单已下，settle 轻档，杜绝 AI 脑补
    // "掏不出钱"的窘迫剧情。
    const catCN = { weapon: "兵器", armor: "护具", accessory: "饰物" }[spec.category] || "物件";
    const EFF_TRAIT = {
      forceFirst: "出手极快、抢在人前", ignoreDefense: "刃口锋锐、能透甲破防", doubleVsStatus: "专克身有滞碍之敌",
      lowHpBonus: "越是绝境越见威力", afterStatusBonus: "善趁敌中招时追击", detonateMark: "能引爆积在敌身的内伤",
      enemyCostPenalty: "缠身封穴、令敌耗力", freezeEnergyRecovery: "寒气封息、阻敌回气", applyMark: "着身留下内伤暗印",
      onCounterSuccessDamageRatio: "以守反攻、格挡后反噬更狠", onCounterSuccessEnergyGain: "格挡得手便回一口真气",
      hpRestore: "贴身温养、缓缓回血", energyRestore: "起手先饱一口真元",
    };
    const traits = [];
    for (const k of Object.keys(spec.effect || {})) { if (EFF_TRAIT[k]) traits.push(EFF_TRAIT[k]); }
    for (const [k, v] of Object.entries(spec.sixDim || {})) traits.push(`养${k}(+${v})`);
    const traitClause = traits.length ? `这件东西的讲究在于：${traits.join("；")}。` : "";
    const matPart = spec.material ? `玩家拿「${spec.material}」来打` : "玩家来定制";
    const reqPart = spec.requirement ? `，要的是「${spec.requirement}」的路子` : "";
    const matClause = `${matPart}一件${catCN}「${chosen.name}」${reqPart}，已当场付清定金${cost}两。${traitClause}请让铁匠据此接单：对这材料成色脾性、这活计的打法、以及要打出上面这些讲究，说道一两句(内行见识、增代入感)，交代约二十四个时辰后打成、届时遣伙计送货上门。`;
    act(`到铁匠铺定制${catCN}「${chosen.name}」，付${cost}两定金。${matClause}`, [], { settle: true });
  }, [char, addLog, act]);

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
    if (!chosen || !chosen.name) return;
    // 找到那件玉料，读天花板，然后消耗它
    const jade = inv.find(i => (typeof i === "object") && i.id === jadeItemId && i.jadeSpec);
    if (!jade) { addLog([{ t: "err", text: "  找不到要用的玉料，先去赌石开一块料收进行囊。" }]); return; }
    const qualityCap = jade.jadeSpec?.qualityCap || jade.quality || "白";
    setInv(prev => prev.filter(i => !((typeof i === "object") && i.id === jadeItemId)));  // 消耗玉料
    const spec = {
      name: chosen.name,
      category: chosen.category || "accessory",
      effect: chosen.effect || {},
      sixDim: chosen.sixDim || {},
      material: (threeFields?.material || jade.jadeSpec?.tierLabel || "玉料"),
      requirement: (threeFields?.requirement || "").trim(),
      jade: true,
      qualityCap,
    };
    // luck 存进 flag 供交付时 rollQuality，品质封顶在交付时用 qualityCap 卡。
    const luck = char.special?.气运 ?? 5;
    setFlags(f => [...f, `forge_pending_${currentTime}_${luck}_${encodeURIComponent(JSON.stringify(spec))}`]);
    // 接单叙事：玉匠语境，把料/成品/词条讲清，点明料已交、活已接，杜绝 AI 脑补。
    const catCN = { weapon: "玉兵", armor: "玉甲", accessory: "玉饰" }[spec.category] || "玉器";
    const EFF_TRAIT = {
      forceFirst: "出手极快、抢在人前", ignoreDefense: "锋锐透甲", doubleVsStatus: "专克身有滞碍之敌",
      lowHpBonus: "绝境愈见威力", afterStatusBonus: "善趁敌中招追击", detonateMark: "引爆敌身内伤",
      enemyCostPenalty: "缠身封穴令敌耗力", freezeEnergyRecovery: "寒气封息阻敌回气", applyMark: "着身留内伤暗印",
      onCounterSuccessDamageRatio: "以守反攻反噬更狠", onCounterSuccessEnergyGain: "格挡回气",
      hpRestore: "贴身温养回血", energyRestore: "起手先饱一口真元",
    };
    const traits = [];
    for (const k of Object.keys(spec.effect || {})) { if (EFF_TRAIT[k]) traits.push(EFF_TRAIT[k]); }
    for (const [k, v] of Object.entries(spec.sixDim || {})) traits.push(`养${k}(+${v})`);
    const traitClause = traits.length ? `这件东西的讲究在于：${traits.join("；")}。` : "";
    act(`到金玉行，把一块「${jade.jadeSpec?.tierLabel || "玉料"}」交给玉匠，请雕一件${catCN}「${chosen.name}」。${traitClause}玉料已当场交付、活计已接。请让玉匠据料的种水成色、这活的雕法、要出的讲究说道一两句(内行见识、增代入感)，交代约二十四个时辰后雕成、届时遣伙计送来。`, [], { settle: true });
  }, [inv, char, addLog, act]);

  const handleListenRumor = useCallback((rumor, cost) => {
    if ((char.money || 0) < cost) return;
    setChar(c => ({ ...c, money: c.money - cost }));
    act(`在茶馆花${cost}两，听掌柜低声说了个传闻：「${rumor}」`, [], { settle: true });
  }, [char, addLog, act]);

  // 装备/卸下。此前直接在 GlobalOverlays 里 setInv(toggleEquip(...))，
  // 为了记一笔计数不值当再穿一层 props，收拢到这儿——将来装备变更要加别的
  // 副作用（耐久、套装判定）也有地方放。
  const handleToggleEquip = useCallback((it) => {
    setInv(v => toggleEquip(v, it.id));
    noteAction("equipToggle");
  }, []);

  // ── 心灵之海 · 玄女点破 ──
  // 触发条件见 seaOfMind.shouldTriggerXuannu：好感≥90 + 已跟玄女说过话。
  // "说过话"直接复用「对话即认识」的结果（commitRound 里 talkTarget/respondedNpcs
  // 会把人标记为已认识），不另造一套"聊过没"的记账。
  // 用 effect 而不是塞进对话结算里，是因为两个条件可能任意顺序满足：先攒够好感再去
  // 见她、或先见过她后来才攒够，两条路都要能触发。
  const seaReturnRef = useRef(null); // 进海之前站在哪，出来要送回去
  useEffect(() => {
    if (!shouldTriggerXuannu({
      affection: narrator.affection,
      varTree: varTreeRef.current,
      knownNames: varTreeRef.current.世界?.已认识人物 || [],
    })) return;
    setVarTree(prev => setNarratorVars(prev, { metXuannu: true, seaUnlocked: true, questStage: 1 }));
    setFlags(f => (f.includes(SEA_OF_MIND.flag) ? f : [...f, SEA_OF_MIND.flag]));
    addLog(buildXuannuScene(char.name || "你"));
    jotNote({
      text: `雪山派后山温泉，玄女说旁白"不是这里的人""她在等"，让我找个自己的地方去她心里看看。`,
      owner: [{ name: "玄女", via: VIA.FIRSTHAND }, { name: "旁白", via: VIA.FIRSTHAND }],
      source: NOTE_SOURCE.NARRATIVE,
    });
  }, [narrator.affection, varTree, char.name, addLog, jotNote]);

  // ── 创伤线 · 进白色别墅触发阶段2 ──
  // 用 effect 监听而不是塞进移动里：海内移动是纯前端的（tryInnerMove 直接 return），
  // 挂在移动上要改动那条早已稳定的路径，不如在这儿观察"人到了没"。
  // villaEntered 做闸门，手工剧情只播一次。
  useEffect(() => {
    if (room.name !== SEA_OF_MIND.district) return;
    if (innerRoomName !== "白色别墅") return;
    const v = narratorVars(varTreeRef.current);
    if (v.villaEntered) return;
    if (narrator.stage === NNPC_STAGE.RESOLVED) return; // 哄好之后重进不再发作
    setVarTree(prev => setNarratorVars(prev, { villaEntered: true, questStage: 2 }));
    setNarrator(n => ({ ...n, stage: NNPC_STAGE.SEA_CRASHED }));
    addLog(SCENE_VILLA);
    jotNote({
      text: "在心灵之海的白色别墅里，旁白看见墙上那幅红色巨人的画，全都想起来了，蜷在沙发角落不让人看。",
      owner: [{ name: "旁白", via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE,
    });
  }, [room.name, innerRoomName, narrator.stage, addLog, jotNote]);

  // ── 创伤线 · 安抚 ──
  // 五个动作全走这一个入口。计分与门槛判定都在 narratorQuest（纯函数），
  // 这里只负责落状态、写日志。**不调 AI**：这些是高频动作，每次烧一次调用不值当，
  // 且写死的反应更稳定，不会因为模型状态忽冷忽热。
  const handleComfort = useCallback((actionKey) => {
    const v = narratorVars(varTreeRef.current);
    const invNames = inv.map(i => (typeof i === "string" ? i : i?.name)).filter(Boolean);
    const gate = canComfort(actionKey, v.comfort, invNames);
    const spec = COMFORT_ACTIONS[actionKey];
    if (!gate.ok) {
      // 越级/缺物：给她的反应，**不计分**。不提示"还差几级"——不把机制摊开。
      addLog([{ t: "desc", text: `  ${describeComfortReject(actionKey, gate.reason, gate)}` }]);
      return;
    }
    const levelBefore = defenseLevelOf(v.comfort);
    const nextComfort = { ...v.comfort, [actionKey]: (v.comfort?.[actionKey] || 0) + 1 };
    const levelAfter = defenseLevelOf(nextComfort);
    setVarTree(prev => setNarratorVars(prev, { comfort: nextComfort }));
    addLog([
      { t: "cmd", text: `> ${spec.label}` },
      { t: "desc", text: `  ${comfortResponse(actionKey, levelBefore)}` },
    ]);
    noteAction("comfort");
    // 心防降级是玩家该感知到的节点，但只给感受不给数字
    if (levelAfter < levelBefore) {
      const felt = ["她彻底放松下来了。", "她靠着你，很安静。", "她不再躲你的手了。",
        "她开始肯说话了。", "她抬眼看了你一下。"][levelAfter] || "";
      if (felt) addLog([{ t: "affection", text: `  ${felt}` }]);
    }
    // 门槛刚好降到能碰下一条心结时，给一句极轻的提示（不点名是哪一条）
    const before = availableKnot(v.comfort, v.knots || []);
    const after = availableKnot(nextComfort, v.knots || []);
    if (!before && after) addLog([{ t: "sys", text: "  ⟡ 她像是有话要说。问问她。" }]);
  }, [inv, addLog]);

  // 换出战队友（单槽互斥；传 null 表示谁都不带）
  const handleSwitchCompanion = useCallback((key) => {
    setCompanionState(cs => setActiveCompanion(cs, key));
    noteAction("companionSwitch");
    const label = key ? (key === "asuka" ? "明日香" : "雪豹") : null;
    addLog([{ t: "sys", text: label ? `  （${label}跟上了。）` : "  （让他们都留守了。）" }]);
  }, [addLog]);

  // ── 终章 · 传送门开启 ──
  // 心结尽解后再回心灵之海，地下室那道裂缝就开了。写 flag 让地下室房间解锁
  // （innerMap 里它挂着 unlockCondition: {type:"flag", flag:"传送门已开"}）。
  useEffect(() => {
    if (room.name !== SEA_OF_MIND.district) return;
    const v = narratorVars(varTreeRef.current);
    if (!v.traumaResolved) return;
    if (v.portalOpened) return;
    setVarTree(prev => setNarratorVars(prev, { portalOpened: true, questStage: 5 }));
    setFlags(f => (f.includes("传送门已开") ? f : [...f, "传送门已开"]));
    addLog(SCENE_PORTAL_OPEN);
    // deps 必须带 narrator.stage：玩家通常是**在海里**哄好她的，那一刻 room.name
    // 没有变化，只有 stage 从 SEA_CRASHED 变成 RESOLVED。此前 deps 只有 room.name，
    // effect 不会重跑 → 门不开，玩家得先离开心灵之海再进来一次才触发，
    // 而剧情上她刚说完"你居然真的没走"，这时候让玩家出去再进来非常出戏。
  }, [room.name, narrator.stage, addLog]);

  // ── 终章 · 东京见证 → 自动回小屋 + 入队 ──
  // 这一段是见证不是探索：进去、看完、送回家。不给第二次机会。
  // 送回的目标用 seaReturnRef（玩家闭眼那间屋子）；万一丢了就退回鱼定村。
  useEffect(() => {
    if (room.name !== "第三新东京市") return;
    const v = narratorVars(varTreeRef.current);
    if (v.tokyoVisited) return;
    setVarTree(prev => setNarratorVars(prev, { tokyoVisited: true, questStage: 6 }));
    addLog(SCENE_TOKYO);
    // 让玩家把那段读完再送走。3.5 秒不是"动画时长"，是给一个换气的停顿——
    // 立刻切场景会把おめでとう那一下压掉。
    const back = seaReturnRef.current || { room: "鱼定村", inner: "溪边小屋" };
    const label = SAFE_HOUSES.find(h => h.room === back.inner)?.label || back.inner || back.room;
    const timer = setTimeout(() => {
      const node = QUCUO_MAP[back.room];
      if (node) {
        setRoom({ name: back.room, desc: node.desc, exits: Object.keys(node.exits), npcs: [], items: [] });
        setTimeout(() => setInnerRoomName(back.inner), 0);
      }
      addLog(SCENE_RETURN(label));
      setCompanionState(cs => unlockAsuka(cs));
      setVarTree(prev => setNarratorVars(prev, { asukaFree: true, questStage: 7 }));
      jotNote({
        text: "跟明日香一起去看了第三新东京市，那儿有人在住。回来之后她就跟着我了。",
        owner: [{ name: "明日香", via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE,
      });
    }, 3500);
    return () => clearTimeout(timer);
  }, [room.name, addLog, jotNote]);

  // ── 创伤线 · 收束（点破内核 + 承诺）──
  const handleResolveTrauma = useCallback(() => {
    const v = narratorVars(varTreeRef.current);
    if (!canResolve(v.comfort, v.knots || [])) {
      addLog([{ t: "sys", text: "  还不到说这句话的时候。" }]);
      return;
    }
    setVarTree(prev => setNarratorVars(prev, { traumaResolved: true, questStage: 4 }));
    setNarrator(n => ({ ...n, stage: NNPC_STAGE.RESOLVED }));
    addLog(SCENE_RESOLVE);
    jotNote({
      text: "在心灵之海把旁白的三个心结都听完了，告诉她不必最强也有人看着她。她信了。",
      owner: [{ name: "旁白", via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE,
    });
  }, [addLog, jotNote]);

  // 进心灵之海：必须站在自己的安全屋里。这是一次纯前端传送，不调 AI、不消耗回合。
  const enterSeaOfMind = useCallback(() => {
    const gate = canEnterSea({
      flags, varTree: varTreeRef.current,
      districtName: room.name, innerRoomName,
    });
    if (!gate.ok) { addLog([{ t: "sys", text: `  ${describeSeaGate(gate.reason)}` }]); return; }
    seaReturnRef.current = { room: room.name, inner: innerRoomName };
    const node = QUCUO_MAP[SEA_OF_MIND.district];
    const v = narratorVars(varTreeRef.current);
    if (!v.seaVisited) addLog([{ t: "narrator", text: seaEntryHint(gate.house.label) }]);
    addLog([
      { t: "room", text: "" },
      { t: "desc", text: "  你闭上眼。再睁开时，脚下是白色的沙。太阳正在落山——永远在落山。" },
    ]);
    setRoom({ name: SEA_OF_MIND.district, desc: node.desc, exits: [], npcs: [], items: [] });
    setTimeout(() => setInnerRoomName(SEA_OF_MIND.anchor), 0);
    setVarTree(prev => setNarratorVars(prev, { seaVisited: true }));
    noteAction("seaEnter");
    // 进海即把她从旁白的位子上取下来 → 主叙事文风退回第一档（narratorVoicePrompt 的 stage 短路）。
    // 已经哄好过的（RESOLVED）不再回退，否则重进一次海她又变冷了。
    if (narrator.stage !== NNPC_STAGE.RESOLVED) {
      setNarrator(n => ({ ...n, stage: NNPC_STAGE.SPIRIT }));
    }
    if (!v.seaVisited) addLog(SCENE_ARRIVE);
  }, [flags, room.name, innerRoomName, addLog]);

  // 出心灵之海：回到进来之前站的地方。
  const leaveSeaOfMind = useCallback(() => {
    const back = seaReturnRef.current || { room: "鱼定村", inner: null };
    const node = QUCUO_MAP[back.room];
    if (!node) { addLog([{ t: "sys", text: "  回不去了……？" }]); return; }
    addLog([{ t: "desc", text: "  海浪声退远了。你睁开眼，还在原来那间屋子里，门关着，天光未变。" }]);
    setRoom({ name: back.room, desc: node.desc, exits: Object.keys(node.exits), npcs: [], items: [] });
    setTimeout(() => setInnerRoomName(back.inner), 0);
  }, [addLog]);

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
    const status = checkSectEntry({
      // 好感度直接读变量树（quests/learnSkill.js:14 的同款写法）——
      // 项目里没有 npcAffection() 这个取数函数，只有 npcAffectionLabel()（转文字档位）。
      affection: varTreeRef.current.角色?.[SECT_ENTRY.master]?.好感度 ?? 0,
      neigong: char.neigong ?? 0,
      money: char.money ?? 0,
      flags,
    });
    if (!status.eligible) {
      addLog([{ t: "sys", text: "  你还不够格拜入雪山派。" }]);
      return;
    }
    setChar(c => ({ ...c, money: (c.money || 0) - SECT_ENTRY.tuition }));
    const token = makeGameItem({
      name: SECT_ENTRY.keyName, category: "misc", quality: "绿",
      desc: "雪山派正式弟子的令牌，青铜铸就，正面一座雪峰，背面刻着一个小小的「贰」。兼作弟子别院的门锁钥匙。",
    });
    setInv(prev => [...prev, token]);
    setFlags(f => (f.includes(SECT_ENTRY.flag) ? f : [...f, SECT_ENTRY.flag]));
    setVarTree(prev => markNpcAsKnown(prev, SECT_ENTRY.master));
    setActiveBuilding(null);
    addLog([
      { t: "sys", text: `  （奉上束脩银${SECT_ENTRY.tuition}两，得雪山派弟子令牌 · 内堂之后的弟子别院已开）` },
      { t: "loot", text: `✦ 得「${SECT_ENTRY.keyName}」`, item: token, source: "sect" },
    ]);
    jotNote({ text: `拜入雪山派，${SECT_ENTRY.master}收下束脩，授弟子令牌。`, owner: [{ name: SECT_ENTRY.master, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE });
    act(`向${SECT_ENTRY.master}奉上束脩，正式拜入雪山派门下，接过那枚刻着「贰」字的弟子令牌`, [], {
      settle: true, settleNpc: SECT_ENTRY.master, settleKind: "learn_skill",
      learnInfo: { isMaster: true, moveBrief: "雪山派门规与弟子身份", totalPrice: SECT_ENTRY.tuition, beast: false },
    });
  }, [char, flags, addLog, act, jotNote]);

  // ── 拍卖落槌 ──
  // AuctionScreen 里的竞价过程是纯前端状态机（auction.js），不调 AI；
  // 只有最终成交这一下才交给 AI 写一段叙事。
  const handleAuctionWin = useCallback((finalPrice) => {
    if ((char.money || 0) < finalPrice) {
      addLog([{ t: "sys", text: "  你付不出这笔钱，掌槌的脸色很难看。" }]);
      return;
    }
    if (invHasItemNamed(inv, AUCTION_LOT.name)) return; // 已有，不重复给
    setChar(c => ({ ...c, money: (c.money || 0) - finalPrice }));
    const lot = makeGameItem({ name: AUCTION_LOT.name, category: AUCTION_LOT.category, quality: AUCTION_LOT.quality, desc: AUCTION_LOT.desc });
    setInv(prev => [...prev, lot]);
    addLog([
      { t: "sys", text: `  （以${finalPrice}两拍得「${AUCTION_LOT.name}」）` },
      { t: "loot", text: `✦ 得「${AUCTION_LOT.name}」`, item: lot, source: "auction" },
    ]);
    jotNote({ text: `在锦官城宝丰拍卖行以${finalPrice}两拍得「${AUCTION_LOT.name}」。`, source: NOTE_SOURCE.NARRATIVE });
    act(`在锦官城宝丰拍卖行，以${finalPrice}两拍得一件前朝蜀王旧邸的「${AUCTION_LOT.name}」，掌槌落下，伙计把东西用红布包好递到手上`, [], { settle: true });
  }, [char, inv, addLog, act, jotNote]);

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
  const clrNight = { sys: "#5a8a5a", cmd: "#d4a853", desc: "#c8bfa0", room: "#6ec6c6", item: "#c4a040", stat: "#8ab4d4", skill: "#b48adf", err: "#c45044", choice: "#6aaa8a", narrator: "#e0a0d0", crash: "#c45044", confess: "#f0c060", affection: "#f0a0c0", quest: "#f0c060" };
  const clrDay = { sys: "#2e5a2e", cmd: "#7a5c14", desc: "#3d3626", room: "#1e5a6a", item: "#7a5410", stat: "#1e4a6a", skill: "#5a3a7a", err: "#a02020", choice: "#2e6a4a", narrator: "#8a2a6a", crash: "#a02020", confess: "#8a5a0a", affection: "#a0305a", quest: "#8a5a0a" };
  const clr = isDayMode ? clrDay : clrNight;
  const zoneTheme = getZoneTheme(room.name, isDayMode);
  // 语义色日夜适配（藏地三色点缀体系，见 theme.js INK）——全文件统一从这组取，
  // 不再到处散写 #e0a0d0/#8ac48a 这类"只有暗夜版"的硬编码（日间米色底下偏淡发灰）。
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
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080810", color: "#c8bfa0", fontFamily: "'Songti SC','STSong','SimSun',serif", padding: 24, textAlign: "center" }}>
        <div>
          <p style={{ color: "#c45044" }}>尚未配置 API Key</p>
          <p>点击下方按钮打开设置面板，填入你的 API Key 后即可开始游戏。</p>
          <span onClick={() => setShowSettings(true)} style={{ cursor: "pointer", color: "#6ec6c6", padding: "6px 14px", background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 3, display: "inline-block", marginTop: 10 }}>⚙ 打开设置</span>
        </div>
        {showSettings && (
          <SettingsPanel
            cfg={apiCfg}
            setCfg={setApiCfg}
            onClose={() => setShowSettings(false)}
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
    return <CharacterCreate onConfirm={({ name, gender }) => {
      setChar(c => ({ ...c, name, gender }));
      setShowCharCreate(false);
    }} />;
  }

  if (showOpening) {
    return <OpeningSequence onFinish={() => setShowOpening(false)} playerName={char.name} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: `${100 / uiScale}vh`, width: `${100 / uiScale}vw`, zoom: uiScale, background: zoneTheme.bg, color: zoneTheme.text, fontFamily: "'Songti SC','STSong','SimSun',serif", fontSize: "12.5px", overflow: "hidden", transition: "background 1.2s ease, color 1.2s ease" }}>

      <TopBar
        isMobile={isMobile} mobileTopMenu={mobileTopMenu} setMobileTopMenu={setMobileTopMenu}
        zoneTheme={zoneTheme} isDayMode={isDayMode} setIsDayMode={setIsDayMode}
        uiGold={uiGold} uiTurquoise={uiTurquoise} uiCrimson={uiCrimson} uiPink={uiPink}
        setShowTutorial={setShowTutorial} setShowCodex={setShowCodex} setShowVersionHistory={setShowVersionHistory}
        showTrace={showTrace} setShowTrace={setShowTrace} setShowBugReport={setShowBugReport}
        setShowCharacterPage={setShowCharacterPage} setShowQuestLog={setShowQuestLog} setShowLore={setShowLore} setShowQijuzhu={setShowQijuzhu}
        setSettingsInitialTab={setSettingsInitialTab} setShowSettings={setShowSettings}
        autoSaveError={autoSaveError} lastAutoSave={lastAutoSave}
        showAvatarPicker={showAvatarPicker} setShowAvatarPicker={setShowAvatarPicker}
        playerAvatarCustom={playerAvatarCustom} setPlayerAvatarCustom={setPlayerAvatarCustom}
        AV_BASE={AV_BASE} genderAvatar={genderAvatar}
      />

      <GlobalOverlays
        zoneTheme={zoneTheme} isDayMode={isDayMode}
        char={char} setChar={setChar} inv={inv} setInv={setInv} skills={skills}
        varTree={varTree} room={room} innerRoomName={innerRoomName} time={time}
        flags={flags} questProgress={questProgress}
        effectiveSpecialNow={effectiveSpecialNow} companionState={companionState}
        loading={loading} pendingTalks={pendingTalks} waitSecs={waitSecs} addLog={addLog}
        showTutorial={showTutorial} closeTutorial={closeTutorial}
        showVersionHistory={showVersionHistory} setShowVersionHistory={setShowVersionHistory}
        showCharacterPage={showCharacterPage} setShowCharacterPage={setShowCharacterPage}
        characterPageTarget={characterPageTarget} setCharacterPageTarget={setCharacterPageTarget}
        claimedMilestones={claimedMilestones} claimMilestone={claimMilestone} giftToCharacter={giftToCharacter}
        showQuestLog={showQuestLog} setShowQuestLog={setShowQuestLog}
        showLore={showLore} setShowLore={setShowLore}
        showQijuzhu={showQijuzhu} setShowQijuzhu={setShowQijuzhu} narratorStage={narrator.stage}
        showPortraitManager={showPortraitManager} setShowPortraitManager={setShowPortraitManager}
        portraits={portraits} setPortraits={setPortraits}
        showPipeline={showPipeline} setShowPipeline={setShowPipeline}
        showTrace={showTrace} setShowTrace={setShowTrace}
        showCodex={showCodex} setShowCodex={setShowCodex}
        showBugReport={showBugReport} setShowBugReport={setShowBugReport} buildBugReportTurns={buildBugReportTurns}
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
          showDebug={showDebug}
          peoplePanel={peoplePanel} setPeoplePanel={setPeoplePanel}
          activeBuilding={activeBuilding} setActiveBuilding={setActiveBuilding}
          setActiveItemMenu={setActiveItemMenu}
          setActiveNpcMenu={setActiveNpcMenu}
          setCharacterPageTarget={setCharacterPageTarget} setShowCharacterPage={setShowCharacterPage}
          setPigeonTarget={setPigeonTarget} setInteractMode={setInteractMode} inputRef={inputRef} addLog={addLog}
          pigeonTarget={pigeonTarget}
          portraits={portraits} portraitTarget={portraitTarget} setPortraitTarget={setPortraitTarget}
          interactMode={interactMode} activeTarget={activeTarget} talkTarget={talkTarget}
          playerAvatar={playerAvatar}
          slImgErr={slImgErr} setSlImgErr={setSlImgErr} slForm={slForm} setSnowLeopardForm={setSnowLeopardForm} setSlFormState={setSlFormState}
          narratorAffection={narrator.affection} narratorImgErr={narratorImgErr} setNarratorImgErr={setNarratorImgErr}
          companionState={companionState}
          setShowPortraitManager={setShowPortraitManager}
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
          showDebug={showDebug} setShowDebug={setShowDebug}
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
          showBasement={showBasement} setShowBasement={setShowBasement} handleServiceOrder={handleServiceOrder}
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
          playerAvatar={playerAvatar} setShowAvatarPicker={setShowAvatarPicker}
          companionState={companionState} onSwitchCompanion={handleSwitchCompanion} slForm={slForm} setSnowLeopardForm={setSnowLeopardForm} setSlFormState={setSlFormState} slImgErr={slImgErr} setSlImgErr={setSlImgErr}
          setShowBody={setShowBody}
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
          borderRadius: 6, minWidth: 300, width: "70vw", maxWidth: 980, maxHeight: "86vh",
          // 卷轴四周是木轴+锦缎装帧，中央才是可用纸面（约占 78%）。用大内边距把
          // 标题栏与节点图推进纸面留白区，避免压到装帧木轴上。
          padding: "8% 11% 9% 11%", boxSizing: "border-box",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#4a3520", fontSize: "13px", fontWeight: "bold" }}>{mapView === "inner" ? `村图·${room.name}内景全图` : "舆图·曲措乡全境"} <span style={{ color: "#7a6448", fontSize: "10px", fontWeight: "normal" }}>{mapView === "inner" ? "金框为当前所在 · 点相邻房间前往" : "金框为当前所在 · 问号为未探明 · 点已探明据点自动前往 · 🔒需前置"}</span></span>
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
            return <ClickableMap nodes={nodes} onGo={go} accent="#8ac48a" loading={loading} maxHeight="66vh" />;
          })()}
        </div>
      </div>}

      {showSettings && (
        <SettingsPanel
          cfg={apiCfg}
          setCfg={setApiCfg}
          onClose={() => setShowSettings(false)}
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
          onClose={() => setShowBody(false)}
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
