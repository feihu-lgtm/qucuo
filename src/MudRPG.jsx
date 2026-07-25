import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { QUCUO_PRESET } from "./presets/qucuo.js";
import {
  NNPC_STAGE, initialNarratorState,
  narratorVoicePrompt, affectionLabel, buildNarratorWhisperContext,
  narratorWhisperLengthNote, gateWhisperTopics, gateQuestTopic,
} from "./narrator.js";
import { gateBodyProfile, emptyBodyProfile, buildOutfitRequest, bodyProfileFilled } from "./bodyProfile.js";
import BodyProfilePanel from "./BodyProfilePanel.jsx";
import { loadConfig, saveConfig, callModel, callModelStream, cleanJsonString, getPipelineLog, clearPipelineLog, classifyError } from "./apiConfig.js";
import { startTrace, step as traceStep, endTrace, getTraceLog, clearTraceLog, formatTrace, attachPipeline, fmtMs } from "./actionTrace.js";
import { buildSnapshot, autoSave, loadAutoSave, loadSlot, flushLocalBackup } from "./saves.js";
import SettingsPanel from "./SettingsPanel.jsx";
import LogEntry from "./LogEntry.jsx";
import LoreScreen from "./LoreScreen.jsx";
import { initialVarTree, extractMvuBlock, applyMvuCommands, listCharacters, npcAffectionLabel, reputationLabel, MVU_SYSTEM_INSTRUCTIONS } from "./mvu.js";
import { QUALITY, QUALITY_COLOR, ITEM_CATEGORY, CATEGORY_LABEL, makeItem, getEquipped, toggleEquip, describeEquipment, rollQuality, computeEquippedStats, statsForQuality } from "./equipment.js";
import { makeItemSmart, describeCatalogForAI, useConsumable, CATALOG_INDEX, CATALOG, makeCatalogItem } from "./items/catalog.js";
// 具名优先的物品生成：AI 发放/掉落/购买的物品名若命中百物录，吃具名的专属
// 数值+特效+六维；否则回退 equipment.makeItem 匿名公式。全项目物品生成走这个。
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

// 从"路上拾取"的叙事原文里抠出捡到的物品名，供 AI 漏填 items_add 时系统兜底补发。
// 匹配常见句式："拾起一看，竟是一枚铜制马铃"/"捡起…是把短刀"/"收入怀中"前面那个物件名。
// 抠不到返回 null，由调用方用通用名兜底。宁可少抠（返回 null 走通用名），
// 也不要抠错把半句话当成物品名，所以只认"是(一)+量词+名字"这种明确指认句式。
function extractPickupName(text) {
  if (!text || typeof text !== "string") return null;
  // 优先："竟是一枚铜制马铃"/"原来是把锈剑"/"是一卷旧帛书" —— 是+可选(一)+可选量词+名字
  const m = text.match(/(?:竟|原来|却|居然)?是\s*一?\s*[枚把柄卷张块面串根条尊坛壶盏][\u4e00-\u9fa5]{1,8}/);
  if (m) {
    // 去掉引导词和"是一+量词"，留下物品名主体
    const name = m[0].replace(/^(?:竟|原来|却|居然)?是\s*一?\s*[枚把柄卷张块面串根条尊坛壶盏]/, "").trim();
    if (name.length >= 1 && name.length <= 8) return name;
  }
  return null;
}

import { getZoneTheme, ink } from "./theme.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";
import CodexScreen from "./CodexScreen.jsx";
import BugReportModal from "./BugReportModal.jsx";
import { QUCUO_MAP, getMapNode, resolveExit, findPath, isNodeUnlocked, buildDirectionJudgeRequest, parseDirectionJudgeResponse } from "./qucuoMap.js";
import { hasInnerMap, getDistrictAnchor, getInnerRoom, resolveInnerExit, visibleInnerExits, getResidentRoomForNpc, getInnerRoomNames, getBuildingIdForInnerRoom, isNpcVisibleInInnerRoom } from "./innerMap.js";
import { describeInnerArrival } from "./mapNarration.js";
import { loadPortraits, setPortrait, removePortrait, getPortrait, fileToDataUrl, inferActivePortraitTarget, SNOW_LEOPARD_FORMS, getSnowLeopardForm, setSnowLeopardForm, snowLeopardPortraitUrl } from "./portraits.js";
import PortraitManager from "./PortraitManager.jsx";
import CharacterPage from "./CharacterPage.jsx";
import QuestLogScreen from "./QuestLogScreen.jsx";
import OpeningSequence from "./OpeningSequence.jsx";
import CharacterCreate from "./CharacterCreate.jsx";
import { getActivePreset } from "./PresetManager.jsx";
import { assemblePrompt, applyPresetOverrides } from "./presetSystem.js";
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
import PersuasionScreen from "./PersuasionScreen.jsx";
import { tickAngryState } from "./combat/stealSystem.js";
import { CURRENT_VERSION, VERSION_HISTORY } from "./version.js";
import { recallWithVisibility } from "./memory/recallWithVisibility.js";
import { writeNote, NOTE_SOURCE, VIA, reembedStaleNotes } from "./memory/note.js";
import { buildDaySummaryRequest, appendDaySummary, buildDistantViewBlock } from "./memory/daySummary.js";
import { embeddingReady } from "./memory/embeddingService.js";
import { matchNpcLore, buildNpcLoreBlock, gateScenario } from "./worldbook.js";
import { ENGINE_IDENTITY, GM_RULE, ISOLATION, MAP_LAW, FORMAT_LAW, CATALOG_TAIL } from "./enginePrompts.js";
import { callExtraction, buildExtractionCfg } from "./extractionEngine.js";
import { initCompanionState, unlockSnowLeopard, setSnowLeopardActive, isSnowLeopardAvailable } from "./companion.js";
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
import GambleStoneScreen from "./buildings/GambleStoneScreen.jsx";
import { settleNegotiation as gambleSettleNegotiation } from "./gambleStone.js";
import TeahouseScreen from "./buildings/TeahouseScreen.jsx";
import { BUILDING_TYPE, getBuildingsForLocation, BUILDING_TYPE_LABEL } from "./buildings/qucuoBuildings.js";
import { getScheduledNpcs, toRoomNpc, NPC_POOL } from "./npcPool.js";
import { seededRand } from "./utils/seededRandom.js";
import { getResidentNpcs, getAllResidentNpcLore } from "./residentNpcs.js";
import { makeSkillEntry, SKILL_CATALOG } from "./kungfu/qucuoKungfu.js";
import { tryLearnFromMaster, tryStealFrom } from "./kungfu/learnSkill.js";
import { parseActiveBuffs, makeBuffFlag, applyBuffsToSpecial, cleanExpiredBuffs, activeBuffsWithRemaining, mergeCombatBuff } from "./utils/buffSystem.js";

// narrativeOnly=true：提取层模式下主调用只输出散文，去掉 JSON 格式要求和 MVU 指令。
function buildSysBase(targetWordCount, narratorState, scenario, budgetInstruction, embeddingEnabled, npcLoreBlock, narrativeOnly = false, scope = "full", opts = {}) {
  // memory 摘要统一用玩家角色名字第三人称叙述，不用"你/我/玩家"这几种代词混着写——
  // 事实账本(knowledge.js)的摘要要在多处被复用（旁白全知视角、其他NPC传闻转述、飞鸽书信
  // 里提起），人称一旦不统一，转述出来的句子会主客体错乱、读起来别扭。
  const playerName = opts.playerName || "主角";
  // scope 动态注入（借鉴 worldbook 蓝绿灯，解决"走一步路却喂一整套战斗/物品/schema"的臃肿）：
  //   "settle" 结算叙事——系统已把钱扣完/物入袋/flag置好，AI 只把这件既定事实演成叙事，
  //          对状态无任何裁量权。故砍掉「物件志」「认知隔离」「全量schema」，schema 缩成
  //          {output,memory}；MVU 仅在该轮确实牵涉某个 NPC（送礼/拜师等）时才挂。
  //          详见 docs/开发_挂载分级与蓝绿灯设计.md §三。
  //   "move" 移动到达——AI 只需读场景写到达叙事，不发物品、无 NPC 对白博弈，
  //          故砍掉「物件志」「认知隔离」，并改用只含 room 字段的精简 schema。
  //   "talk" 对话——保留认知隔离（对白要守信息域），砍掉物件志（对话一般不发物品）。
  //   "full" 其余（战斗/行动/查看/创造模式）——全量注入。
  const isSettle = scope === "settle";
  // 物件志（绿灯·批四）：只有"这一轮真可能发出物品"才挂——移动拾取判定命中、战斗（掉落）、
  // 创造模式（凭空发物）。寻常行动轮 AI 本就不该平白发物，挂了反而诱它发。
  const wantCatalog = scope === "full" && opts.mayGrantItem !== false;
  const wantIsolation = scope !== "move" && !isSettle;
  // MVU（绿灯·批二）：只有"这一轮可能改好感/变量"才挂——即场上真有人。
  // 独自赶路、荒野探索、无人结算这类轮次灭灯，每轮省 717 字；
  // 创造模式(gm)强制挂（要能凭空设变量）。move 档本就无 MVU 段，不受影响。
  const wantMvu = !narrativeOnly && (isSettle ? !!opts.settleNpc : (opts.hasNpc !== false || opts.gm === true));
  // 直接用目标汉字数生成明确的字数指令，而不是通过 maxTokens 反推一个粗略的档位——
  // 汉字和 token 不是 1:1 关系（一个汉字通常占 1.5-2 个 token），之前"用 maxTokens 分四档"
  // 的做法既不精确，也只能控制"每条output"的上限，控制不了整轮回复的总字数。
  //
  // budgetInstruction 由 inputIntent.js 根据这轮玩家输入的性质动态生成——
  // "什么情况"这种系统元问题应该只有一两句话，"拔剑迎战"这种战斗场面应该完整展开，
  // 不该用同一个固定字数套所有输入。传了就用动态版本，不传（比如旧调用点或测试场景）
  // 就退回原来的全局固定字数，保证向后兼容。
  const lenNote = budgetInstruction || `本轮 output 数组里所有行拼起来，总字数应控制在约 ${targetWordCount} 字左右（允许±15%浮动），不要明显少写，也不要为了凑数硬拖长。根据这个总字数目标，自行决定要写几行、每行写多长。`;

  // ── settleKind 专属铁律（本轮抽成独立函数）──────────────────────────
  // 之前"送礼铁律"是直接堆在下面那个巨型模板字符串里的三元表达式，每加一个新的
  // settleKind 都要在同一行里再叠一层三元，容易出现作用域引用错误（cmd 变量不在
  // buildSysBase 作用域内那次事故）、可读性也持续下降。现在把"narrativeOnly分支
  // 该说什么"和"isSettle分支的MVU该怎么写"分别抽成独立函数，settleKind 的判断
  // 逻辑集中在这里，后续新增伙伴/新增结算类型时只需要在这两个函数里各加一段
  // if 分支，不用再动下面那坨模板字符串本身。
  //
  // narrativeOnly 分支：管"这一轮的散文该怎么写"（双调用模式下主叙事只产文本，
  // 好感度等状态判定转交提取层，这里不涉及MVU）。
  function buildSettleNarrativeNote(o) {
    if (o.settleKind === "gift") {
      return `\n【送礼世界观铁律】曲措乡这方水土人情厚重，收礼从不是件让人为难或起疑的事——不管东西贵重与否，只要是当面郑重递到手上的心意，对方都会真心生出一份惊喜与暖意；纵是相熟不深，出于最起码的礼貌、江湖上讲究的信义，或纯是那一刻的好心情，也断没有板起脸不领情、把这份情谊晾在一边的道理。这一轮${o.settleNpc}面对${o.giftInfo?.itemName ? `「${o.giftInfo.itemName}」` : "这件礼物"}${o.giftInfo?.desc ? `（${o.giftInfo.desc}）` : ""}，务必写成她欣然收下、态度转暖，不许写成推辞、质疑来意或婉拒不受——这是本轮叙事唯一的走向，不接受其他写法。`;
    }
    if (o.settleKind === "companion_invite") {
      return `\n【伙伴认主铁律】雪豹与主角之间，非比寻常的人与兽的相逢——这是前世便结下的羁绊，它认准了主角便是这片雪域高原真正的主人，忠贞无二，此心早定，不是这一刻才临时起意。这一轮务必写成雪豹欣然应邀、心意早决——它或以额头抵掌、或绕身一圈、或伏低身姿以示臣服归顺，用兽类特有的、不必言语的方式表明这份认主之心；不许写成犹豫、观望、抗拒或需要主角再三哄劝——雪豹的答应是必然的、毫无保留的，这是本轮叙事唯一的走向，不接受其他写法。它不能说话（cannotSpeak），全程不出人言，情感全靠动作、眼神、姿态传达。`;
    }
    return "";
  }
  // isSettle 分支：管"MVU 那部分该怎么写"（单调用模式下，主模型直接产 JSON+MVU，
  // 好感度等状态判定就在这一次调用里完成）。
  function buildSettleMvuNote(o) {
    if (o.settleKind === "gift") {
      return `\n【送礼世界观铁律】曲措乡这方水土人情厚重，收礼从不是件让人为难或起疑的事——不管东西贵重与否，只要是当面郑重递到手上的心意，对方都会真心生出一份惊喜与暖意；纵是相熟不深，出于最起码的礼貌、江湖上讲究的信义，或纯是那一刻的好心情，也断没有板起脸不领情、把这份情谊晾在一边的道理。所以这一轮${o.settleNpc}收下${o.giftInfo?.itemName ? `「${o.giftInfo.itemName}」` : "这件礼物"}时，对玩家的观感只能是变好、绝不会不变或变差——下面这条 <mvu> 块本轮必须给出，且必须是正向增量。\n这件礼物的实际来历（好感幅度请依此掂量分量，越贵重、越用心，情谊越重）：品阶【${o.giftInfo?.quality || "白"}】${o.giftInfo?.categoryLabel ? `，类别「${o.giftInfo.categoryLabel}」` : ""}${o.giftInfo?.desc ? `。物件描述：${o.giftInfo.desc}` : "（无特别来历，寻常物件）"}`;
    }
    if (o.settleKind === "companion_invite") {
      return `\n【伙伴认主铁律】雪豹与主角之间，非比寻常的人与兽的相逢——这是前世便结下的羁绊，它认准了主角便是这片雪域高原真正的主人，忠贞无二，此心早定。这一轮务必写成雪豹欣然应邀、心意早决，用动作/眼神/姿态（额头抵掌、绕身而行、伏低臣服等，它不能说话）表明认主之心，不许写成犹豫或抗拒——下面这条 <mvu> 块本轮必须给出，且必须是正向增量（这是雪豹认你为主的时刻，好感度理应给一个较高的起始值）。`;
    }
    return "";
  }
  function buildSettleMvuExample(o) {
    if (o.settleKind === "gift") {
      return `\n依上面这件礼物的品阶与来历，本轮好感度增量建议落在 +${o.giftInfo?.range?.[0] ?? 2}~+${o.giftInfo?.range?.[1] ?? 4} 这个区间内自行斟酌（品阶越高、描述越贵重可取区间上沿，寻常物件取下沿），不得为 0 或负数。示例写法：\n_.add('角色.${o.settleNpc}.好感度', ${o.giftInfo?.suggestedDelta ?? 3});`;
    }
    if (o.settleKind === "companion_invite") {
      return `\n雪豹是初登场的伙伴角色，好感度应有一个较高的初始值（毕竟是"前世羁绊、认主忠贞"的设定，不是从0慢慢培养的陌生关系），建议直接 _.set 到 40~55 之间，示例写法：\n_.set('角色.${o.settleNpc}.好感度', 45);`;
    }
    return "";
  }

  // 预设系统负责的部分：文体/通用规则/剧本设定的拼装顺序和内容，可由用户在设置面板里自由编辑，
  // 完整兼容酒馆格式导入。scenario 通过 marker 占位符注入，不需要在这里手动拼接。
  const preset = getActivePreset();
  // scenario 绿灯（批三）：世界观总纲按"关键词 OR 状态"分条点灯，见 worldbook.js gateScenario。
  // 蓝灯段（地理概要/地图铁律/好感度规则）常驻；专项段（拓扑路线/契诃夫之枪/路途遭遇/
  // 装备掉落）只在玩家或上轮回复提到、或该 scope 确需时才亮。opts.gateCtx 不传则不裁剪。
  const gated = opts.gateCtx
    ? gateScenario(scenario, { ...opts.gateCtx, scope })
    : { text: scenario, lit: [], dark: [] };
  if (opts.onGateReport) opts.onGateReport(gated);
  const presetContent = assemblePrompt(preset, { scenario: gated.text, charDescription: gated.text });

  // 这几段是引擎正常运作的硬性技术规范（JSON 结构、MVU 语法、创造模式），
  // 不受用户预设编辑影响，避免用户不小心删掉后整个解析链路崩溃。
  //
  // 静态文案已抽到 enginePrompts.js —— 设置里的「Prompt 注入结构」面板要展示
  // 真正喂出去的那份字，两边 import 同一份常量，改一处两处一起变，不会漂移。
  return `${ENGINE_IDENTITY}

${GM_RULE}

篇幅要求：${lenNote}
${narratorVoicePrompt(narratorState)}

${presetContent}${npcLoreBlock || ""}
${wantCatalog ? `
── 曲措乡物件志（叙事引用规范）──
${describeCatalogForAI()}
${CATALOG_TAIL}
` : ""}${wantIsolation ? `
${ISOLATION}
` : ""}

${MAP_LAW}

${FORMAT_LAW}

${narrativeOnly ? `直接输出叙事散文正文，写完即结束。不要输出任何 JSON，不要输出 <mvu> 块，不要在末尾附加任何结构化内容。${buildSettleNarrativeNote(opts)}` : isSettle ? `回复纯JSON，字符串不换行。这一轮的所有数值与状态变化，系统均已结算完毕，你不负责也无权改动任何状态——只把这件已经确定发生的事写成生动的正文：
{"output":["行1","行2"],"memory":"≤50字客观事实"}
不要输出 room / char / dao / delta 任何字段（写了也不会生效，只会拖长回复）。不要重复结算任何奖励、物品、银两或状态。
"memory" 用不超过50字的纯客观事实概括本轮发生了什么（谁在何处做了什么、花了多少、得了什么），一律用"${playerName}"称呼玩家角色，不要用"你/我/玩家"，供日后回想与旁人提起；确实无足记的琐事可省略此字段。${wantMvu ? `
${buildSettleMvuNote(opts)}
在 JSON 输出完毕之后，${(opts.settleKind === "gift" || opts.settleKind === "companion_invite") ? `这一轮必须` : "如果这一轮牵涉的人物（" + opts.settleNpc + "）对玩家的观感确有变化，"}另起一行输出 <mvu> 块（不要放进 JSON 内部）：
${MVU_SYSTEM_INSTRUCTIONS}${buildSettleMvuExample(opts)}` : ""}` : scope === "move" ? `回复纯JSON，字符串不换行。这是一次移动到达，你只需生成到达新地点的叙事与该地点的场景/在场人物，不涉及发放物品或复杂状态变更：
{"output":["行1","行2"],"room":{"name":"名","desc":"≤80字","exits":["n"],"npcs":[{"name":"名","id":"id","brief":"≤15字","carry":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}]}]}}
npcs 的 carry 字段只在该 NPC 首次登场那一轮写（0-3件肉眼可见随身物，出场叙事需描述其外观）。
可选字段 "memory"：用不超过50字纯客观事实概括本轮到达了何处、路上是否有值得记的事，一律用"${playerName}"称呼玩家角色，不要用"你/我/玩家"，寻常赶路可省略。
若这次移动让某个从未出现的具名人物被提及，加 "mentionedNewNpcs":["名"]。` : `回复纯JSON，字符串不换行：
{"output":["行1","行2"],"room":{"name":"名","desc":"≤80字","exits":["n"],"npcs":[{"name":"名","id":"id","brief":"≤15字","carry":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}]}],"items":[{"name":"名","id":"id"}]},"char":{"hp":[60,100],"neigong":5,"waigong":8,"special":{"根骨":5,"悟性":6,"体魄":5,"魅力":5,"智谋":5,"身法":5,"气运":5}},"dao":{"karma":0,"jie":0,"sign":"天象","rumor":["事"]},"delta":{"items_add":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}],"items_rm":[],"skill_up":{},"exp":0,"pot":0,"flags_add":[]}}
items_add 里的元素也可以是纯字符串（不需要装备系统参与的剧情道具/杂物），结构化写法仅用于武器/护甲/饰品类物品。
npcs 的 carry 字段只在该 NPC 首次登场那一轮写：列出出场描述里玩家肉眼可见的随身物品（兵器、猎具、饰物、包裹等，0-3件，寻常人多为白/绿档），出场叙事必须描述其外观且提到这些东西——所见即所得，之后系统会固化这份清单作为他的全部随身家当（掉落/偷窃都只出自这里），后续轮次不必再写 carry。
npcs 里某个 NPC 如果是路途遭遇生成的生态猛兽/山贼游哨这类"泛用清剿目标"（不是具名剧情人物），可选加一个 "tag" 字段（比如 "熊山野兽""黑风寨山贼"，具体归属看当前地域的路途遭遇说明），系统会用它核对是否推进对应的清剿类任务进度；具名剧情人物不要加这个字段。
如果这一轮的旁白/对话文本里，你让某个此前从未出现过的具名人物被提及（比如"我那侄子阿福在山下磨坊"），在顶层JSON里加 "mentionedNewNpcs":["阿福"] 字段列出这些名字，不需要每次都有，绝大多数时候留空或省略这个字段即可，只有真的提到全新的具名人物时才加。
如果收到"人物涌现"指令且这一轮确实让对应人物登场，在顶层JSON里额外加 "emergedNpcName" 和 "emergedNpcDescription" 两个字段（一句话定性描述，不含任何数值），其余情况完全不要出现这两个字段。
可选字段 "memory"：用不超过50字的纯客观事实，概括本轮真正发生、日后可能需要回想起来的关键事件（谁做了什么、得到或失去了什么、去了何处、结下或了断了什么关系、许下或应承了什么）。一律用"${playerName}"称呼玩家角色，不要用"你/我/玩家"这几种代词。只记事实，不写情绪，不写心理，不加评述。若这一轮只是寻常闲谈、查看状态、无关紧要的往来，省略这个字段即可，不必硬凑。这条会被单独存档，供日后当作往事重新想起，因此务必写得具体（写清人名地名，不要用"那人""某处"这类含糊指代）。这条摘要除了供你自己日后回想，也会被登记为在场者共同"目击"的事实，供其他 NPC 之后自然提起（比如路人听说"${playerName}在鱼定村打伤了谁"），所以只在真有值得旁人知道的事发生时才写，纯私密心理活动或不宜外传的隐秘不要写进来。

${wantMvu ? `
在这个 JSON 对象输出完毕之后，如果需要维护角色/世界状态变量，另起一行输出 <mvu> 块（不要放在 JSON 字符串内部，作为 JSON 后面独立的一段纯文本）：
${MVU_SYSTEM_INSTRUCTIONS}` : ""}`}`;
}

const DIRS = { n: "北", s: "南", e: "东", w: "西", u: "上", d: "下", ne: "东北", nw: "西北", se: "东南", sw: "西南" };
const bar = (v, mx, len = 10) => { const f = Math.max(0, Math.round((v / mx) * len)); return "█".repeat(f) + "░".repeat(len - f); };
const STAGES = ["入门", "小成", "大成", "圆满", "登峰造极"];
// 武学升阶潜能成本（模块级，渲染和逻辑共用）：越高阶越贵，阶跃式突破单次成本较高
const STAGE_UP_COST = { 小成: 12, 大成: 20, 圆满: 32, 登峰造极: 48 };
const STAGE_TO_QUALITY = { 入门: "白", 小成: "绿", 大成: "蓝", 圆满: "紫", 登峰造极: "橙" };
const DIR_DXY = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1], u: [0, 0], d: [0, 0] };
// 方向解析：之前要求方向词必须是字符串开头（如"北""往北"），但"向北走""朝北边走"
// "往北面走走"这类更符合口语习惯的说法反而识别不了——"向""朝"这类前置词没被覆盖，
// 导致这么打字的玩家的移动请求被系统误判为"没有明确移动方向"，于是不走系统裁决的
// 固定地图分支，AI 就有机可乘地自由发挥编出不存在的过渡地名（比如"熊曲山谷"）、
// 还擅自把 room.name 改成这个编造的地方，绕开了"AI 不能决定去哪里"这条硬规则。
// 修复只放宽"移动类前缀"（向/往/朝/去/到）+ 方向字的组合，不能简单放宽成"方向字
// 出现在字符串前几位就算"——那样"看看北边有没有人""北面风景不错"这类根本不是
// 移动指令的句子也会被误判成移动，反而制造新 bug。
const DIR_PREFIX = "(?:向|往|朝|去|到)?"; // 移动类前缀，可选（兼容"北""往北""向北走"）
const parseDir = (cmd) => {
  const c = cmd.trim().toLowerCase();
  // 特殊别名：保留精确开头匹配，避免"锦官城"这类地名词被过度泛化误判
  if (/^(往西南|西南|去锦官城|去锦官|锦官城)/.test(c)) return "sw";
  // 排除游戏地图不支持的复合方向（东南/东北/西北），否则会被"东/西"这类单字
  // 前缀正则提前命中、误判成一个游戏根本没有的方向，导致"此路不通"该有的提示
  // 变成了错误地移动到别处。
  if (/^(?:向|往|朝|去|到)?(东南|东北|西北)/.test(c)) return null;
  const DIR_PATTERNS = [
    ["n", new RegExp(`^(?:${DIR_PREFIX}(?:north|n)|${DIR_PREFIX}北)`)],
    ["s", new RegExp(`^(?:${DIR_PREFIX}(?:south|s)|${DIR_PREFIX}南)`)],
    ["e", new RegExp(`^(?:${DIR_PREFIX}(?:east|e)|${DIR_PREFIX}东)`)],
    ["w", new RegExp(`^(?:${DIR_PREFIX}(?:west|w)|${DIR_PREFIX}西)`)],
    ["u", new RegExp(`^(?:${DIR_PREFIX}(?:up|u)|${DIR_PREFIX}上)`)],
    ["d", new RegExp(`^(?:${DIR_PREFIX}(?:down|d)|${DIR_PREFIX}下)`)],
  ];
  for (const [d, re] of DIR_PATTERNS) if (re.test(c)) return d;
  return null;
};

// 目标汉字数 → API 侧的 maxTokens 安全上限（真正的换算函数在 apiConfig.js，
// 这里是历史注释保留：中文一个汉字约占 1.5-2 个 token，用 2.2 倍系数 + 300 固定余量兜底）
const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
// 24 回合/天，每时辰 2 回合。一个时辰劈两半：上半（偶数回合）为「初」、下半（奇数回合）为「正」。
// 如 t%24=2→丑初、=3→丑正、=6→卯初。子正即半夜正中，与古法一致。
const getTimeStr = (t) => { const idx = ((t % 24) + 24) % 24; const day = Math.floor(t / 24) + 1; const shi = SHICHEN[Math.min(11, Math.floor(idx / 2))]; const half = idx % 2 === 0 ? "初" : "正"; return `第${day}日·${shi}${half}`; };

const DEFAULT_PRESETS = [QUCUO_PRESET];

// 尝试从自动存档恢复；找不到时返回 null，调用方 fallback 到 preset 默认值。
// 关键防御：如果存档是旧版本结构（比如缺少 neigong/waigong/special 字段），
// 直接判定为不兼容，丢弃存档而不是硬塞进新代码导致渲染崩溃。
function isCompatibleCharShape(char) {
  return !!char
    && Array.isArray(char.hp)
    && typeof char.neigong === "number"
    && typeof char.waigong === "number"
    && char.special && typeof char.special === "object";
}

function isCompatibleRoomShape(room) {
  return !!room
    && typeof room.name === "string"
    && typeof room.desc === "string"
    && Array.isArray(room.exits)
    && Array.isArray(room.npcs)
    && Array.isArray(room.items);
}

// 行动分层日志查看器：列出最近的行动 trace，每条展开看它经过的各层（通过/拦截/失败）。
function TraceViewer({ onClose, onReport }) {
  const [, forceTick] = React.useState(0);
  // 实时刷新：行动进行中每步会陆续写入 traceLog，定时重渲染让面板"边跑边长"
  React.useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 400);
    return () => clearInterval(id);
  }, []);
  const traces = getTraceLog();
  const [copied, setCopied] = React.useState(false);
  const [plOpen, setPlOpen] = React.useState(null); // 当前展开 AI 请求全文的那条 trace 的 ts
  const ICON = { pass: "✓", block: "⛔", fail: "✗", skip: "·", info: "•" };
  const COLOR = { pass: "#8ac48a", block: "#c8a860", fail: "#c46060", skip: "#5a5a4a", info: "#7a9ab8" };
  const copyAll = () => {
    const text = traces.map((t, i) => formatTrace(t, traces.length - i)).join("\n\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(8,10,14,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 620, maxHeight: "84vh", background: "#0e1116", border: "1px solid #2a3a3a", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #1a2020" }}>
          <span style={{ color: "#8ac8b8", fontSize: "13px" }}>🧭 行动全流程日志（最近 {traces.length} 条 · 含各层耗时与 AI 请求）</span>
          <span style={{ marginLeft: "auto", cursor: "pointer", color: "#6a8a8a", fontSize: "11px" }} onClick={copyAll}>{copied ? "✓已复制" : "复制全部"}</span>
          {onReport && <span style={{ cursor: "pointer", color: "#e08a6a", fontSize: "11px" }} onClick={() => { onClose(); onReport(); }}>🐞 上报bug</span>}
          <span style={{ cursor: "pointer", color: "#8a6a4a", fontSize: "11px" }} onClick={() => { clearTraceLog(); onClose(); }}>清空</span>
          <span style={{ cursor: "pointer", color: "#8a8a7a", fontSize: "13px" }} onClick={onClose}>✕</span>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 12px" }}>
          {traces.length === 0 && <div style={{ color: "#5a5a4a", fontSize: "12px", padding: 12 }}>还没有行动记录。做点什么（移动、对话、行动）就会出现在这里，每一步花了多久也会实时显示。</div>}
          {traces.map((t, i) => (
            <div key={t.ts} style={{ borderBottom: "1px solid #14181c", padding: "8px 4px" }}>
              <div style={{ fontSize: "11px", color: "#c8bfa0", marginBottom: 4 }}>
                <span style={{ color: "#5a5a4a" }}>#{traces.length - i}</span>
                <span style={{ color: "#4a4a3a", marginLeft: 6, fontSize: "9.5px" }}>{new Date(t.ts).toLocaleTimeString()}</span>
                {t.totalMs != null && <span style={{ color: "#c8a860", marginLeft: 6, fontSize: "9.5px" }}>共 {fmtMs(t.totalMs)}</span>}
                {t._running && <span style={{ color: "#8ac8b8", marginLeft: 6, fontSize: "9.5px" }}>⏳ 进行中·当前「{t.steps.length ? t.steps[t.steps.length - 1].layer : "启动"}」</span>}
              </div>
              {/* raw 原始输入：terminal 风格，等宽字体、$ 前缀，完整不删减——看系统到底收到了什么 */}
              <div style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: "11px", color: "#8ac8b8", background: "#0a0c10", border: "1px solid #1a2430", borderRadius: 3, padding: "4px 8px", marginBottom: 6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ color: "#4a6a5a" }}>$ </span>{t.raw != null ? t.raw : t.cmd}
              </div>
              {t.steps.map((s, si) => {
                const isAI = /AI|召回|模型|生成/.test(s.layer); // AI 步骤特殊标记
                return (
                  <div key={si} style={{ fontSize: "10.5px", lineHeight: 1.75, paddingLeft: 8, display: "flex", gap: 4 }}>
                    <span style={{ color: COLOR[s.status] || "#7a9ab8", width: 14, flexShrink: 0 }}>{ICON[s.status] || "•"}</span>
                    <span style={{ flexShrink: 0, fontSize: "9px", color: isAI ? "#c88ae0" : "#5a7a8a" }}>{isAI ? "🤖AI" : "⚙系统"}</span>
                    <span style={{ color: isAI ? "#c8a8d8" : "#8a8a7a", flexShrink: 0 }}>[{s.layer}]</span>
                    <span style={{ color: "#a8a898", flex: 1 }}>{s.detail}</span>
                    {s.dt != null && <span style={{ color: s.dt > 3000 ? "#c8a860" : "#4a5a4a", flexShrink: 0, fontSize: "9.5px" }}>{fmtMs(s.dt)}</span>}
                  </div>
                );
              })}
              {t._running
                ? <div style={{ fontSize: "10.5px", color: "#8ac8b8", paddingLeft: 22, marginTop: 2 }}>⏳ 正在进行……当前「{t.steps.length ? t.steps[t.steps.length - 1].layer : "启动"}」</div>
                : <div style={{ fontSize: "10.5px", color: "#8ac48a", paddingLeft: 22, marginTop: 2 }}>✓ 已完成{t.summary ? `：${t.summary}` : ""}（全程 {fmtMs(t.totalMs)}）</div>}
              {/* 这一轮若调了 AI，把喂给 AI 的完整 prompt 和 AI 回复一并展开——系统各层
                  和 AI 请求合并在同一条里，一次看清"系统走到哪、AI 走到哪、总 prompt 是
                  什么、有没有回复"。默认折叠，点标题展开，避免面板太长。 */}
              {t.pipeline && (() => {
                const pl = t.pipeline;
                const open = plOpen === t.ts;
                const sys = pl.systemPrompt || "";
                const usr = (pl.userMessages || []).map(m => `[${m.role}] ${m.content}`).join("\n\n");
                const resp = pl.response || pl.text || (pl.error ? `（无回复）报错：${pl.error}` : "（无回复）");
                return (
                  <div style={{ marginTop: 6, paddingLeft: 8 }}>
                    <div onClick={() => setPlOpen(open ? null : t.ts)} style={{ cursor: "pointer", fontSize: "10.5px", color: "#c8a860", userSelect: "none" }}>
                      {open ? "▾" : "▸"} AI 请求全文（总 prompt {Math.round((sys.length + usr.length))} 字 · 回复 {(pl.response || pl.text || "").length} 字{pl.error ? " · ✗有错误" : ""}）
                    </div>
                    {open && (
                      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
                        {[["System Prompt（系统提示全文）", sys], ["输入（本轮 user 消息）", usr], ["AI 回复", resp]].map(([label, body]) => (
                          <div key={label}>
                            <div style={{ fontSize: "9.5px", color: "#6a8a8a", marginBottom: 2 }}>{label}</div>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "9.5px", lineHeight: 1.5, color: "#9a9a8a", background: "#0a0c10", border: "1px solid #1a2020", borderRadius: 3, padding: "6px 8px", maxHeight: 220, overflowY: "auto" }}>{body || "（空）"}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 小地图缩放：最稳的实现——只用 +/− 按钮改缩放（不用 wheel、不用手动拖拽，
// 因为游戏整体套了 CSS zoom，wheel 常被外层截、pointer 的 clientX 坐标会错乱）。
// 缩放靠"内层 div 变宽"，外层 overflow:auto 出滚动条，平移就拖滚动条/双指滑动
// （原生滚动不受 zoom 影响）。按钮 z-index 拉满，保证任何时候可点。
function ZoomableMap({ children, maxHeight = 100 }) {
  const [scale, setScale] = React.useState(1);
  const zoomBy = (f) => setScale(s => Math.max(1, Math.min(5, Math.round(s * f * 100) / 100)));
  return (
    <div style={{ position: "relative" }}>
      <div style={{ overflow: scale > 1 ? "auto" : "hidden", maxHeight }}>
        <div style={{ width: `${scale * 100}%`, transition: "width 0.12s" }}>
          {children}
        </div>
      </div>
      <div style={{ position: "absolute", right: 2, bottom: 2, display: "flex", flexDirection: "column", gap: 3, zIndex: 20 }}>
        <button onClick={() => zoomBy(1.5)} style={zmBtn}>＋</button>
        <button onClick={() => zoomBy(1 / 1.5)} style={zmBtn}>－</button>
        {scale > 1 && <button onClick={() => setScale(1)} title="复位" style={{ ...zmBtn, fontSize: "10px" }}>⤢</button>}
      </div>
    </div>
  );
}
const zmBtn = {
  cursor: "pointer", width: 20, height: 20, padding: 0, lineHeight: "18px", textAlign: "center",
  fontSize: "14px", color: "#8ac8b8", background: "rgba(10,12,18,0.92)",
  border: "1px solid #3a4a4a", borderRadius: 3, userSelect: "none", display: "block",
};

// 地图 UI 贴图（藏地卷轴风，见 docs/美术_地图UI素材提示词.md）。
// BASE 前缀适配 GitHub Pages 子路径部署（/qucuo/），本地开发时为 "/"。
const MAP_UI_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "stones/mapui/";
const MAP_UI = {
  scroll:  MAP_UI_BASE + "scroll_bg.png",
  frame:   MAP_UI_BASE + "frame.png",
  idle:    MAP_UI_BASE + "cell_idle.png",    // 已探索
  fog:     MAP_UI_BASE + "cell_fog.png",     // 未探索·迷雾
  current: MAP_UI_BASE + "cell_current.png", // 当前所在
};

// 可点击移动地图：节点即操作。点相邻据点/房间 = 往那个方向走（复用 act 移动链）。
// nodes: [{name,x,y,explored,current,reachable,dir,dest,locked}]  onGo(dir,dest,locked)
// explored=去过（亮·实心）; !explored=战争迷雾（问号·虚线）; reachable=当前有出口可点；
// locked=有路但未解锁（点了触发 AI 叙事拦截）。current=当前所在（金框脉冲）。
// 固定九宫格视窗地图：玩家永远居中不动，走一步"世界卷一格"（周围八格内容刷新）。
// 像老式 RPG 主角居中、地图卷动。内外层通用。
// props:
//   centerLabel — 中心格显示（我当前所在地名）
//   cells — { n,ne,e,se,s,sw,w,nw: {name?,explored,dir} }：八方向格数据
//           explored=false 显问号（战争迷雾，点了才知有没有路）；有 name 且 explored 显地名
//   onGo(dir) — 点某方向格
//   accent, loading, big
// 新手教程覆盖层：半透明遮罩铺满全屏，按三栏（左/中/右）+ 顶部 + 底部按钮区的
// 实际位置贴说明便签，指向它介绍的界面区域。点任意处或右上角最小化收起。
function TutorialOverlay({ onClose }) {
  const note = {
    background: "rgba(14,18,26,0.96)", border: "1px solid #6a5d40", borderRadius: 8,
    padding: "12px 16px", color: "#e8dcc0", fontSize: "12.5px", lineHeight: 1.7,
    boxShadow: "0 6px 24px rgba(0,0,0,0.6)", maxWidth: 260,
  };
  const title = { color: "#f0c060", fontWeight: "bold", fontSize: "13px", marginBottom: 6, display: "block" };
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(6,6,12,0.72)", cursor: "pointer",
        display: "flex", flexDirection: "column", fontFamily: "'Songti SC','STSong','SimSun',serif" }}
    >
      {/* 顶部提示条 */}
      <div style={{ textAlign: "center", padding: "14px 0 8px", color: "#f0e0c0", fontSize: "15px", fontWeight: "bold", letterSpacing: "1px" }}>
        📖 新手教程 · 界面导览
        <span style={{ display: "block", fontSize: "11px", color: "#b0a080", fontWeight: "normal", marginTop: 4 }}>点任意处收起（最小化）</span>
      </div>

      {/* 三栏说明便签，按 flex 25/55/30 的实际位置横向铺开 */}
      <div style={{ display: "flex", flex: 1, alignItems: "flex-start", padding: "0 14px", gap: 12, overflow: "hidden" }}>
        {/* 左栏 flex 25 */}
        <div style={{ flex: 25, display: "flex", justifyContent: "center", paddingTop: 20 }}>
          <div style={note}>
            <span style={title}>◀ 左栏 · 天地</span>
            你此刻在<b>哪里</b>、周围的<b>出口</b>、<b>此地之人</b>（谁在场）、你的<b>状态</b>（气血/银两/背包）和<b>小地图</b>都在这里。
            <div style={{ marginTop: 8, color: "#c0a86a" }}>🕐 一天 24 小时：每行动一次约走一个时辰，昼夜会变，时间显示在地点下方。</div>
            <div style={{ marginTop: 8, color: "#9ac0a0" }}>🚶 移动：在底部输入框打 <b>n/s/e/w</b>（北南东西），或点小地图上已探明的据点自动前往。</div>
            <div style={{ marginTop: 8, color: "#a0b8c0" }}>🗺️ <b>外层与内层</b>：外层是<b>大地图</b>（据点与据点之间，如鱼定村↔天都镇）；进了一个据点，内部又是一片<b>箱庭</b>——一个个可走动的内层房间（如村口、药铺、饭馆）。小地图右上角可切换<b>「外 / 内」</b>两层视图。</div>
          </div>
        </div>
        {/* 中栏 flex 55 */}
        <div style={{ flex: 55, display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ ...note, maxWidth: 340 }}>
            <span style={title}>▼ 中栏 · 江湖（叙事）</span>
            故事在这里展开——旁白的叙述、NPC 的<b>「对话」</b>、你的行动结果，都会一行行写在这块。这是游戏的<b>正文</b>，读它了解发生了什么。
            <div style={{ marginTop: 8, color: "#b0a080" }}>「」里是对话，*斜体*是心理活动，其余是旁白叙述。</div>
          </div>
        </div>
        {/* 右栏 flex 30 */}
        <div style={{ flex: 30, display: "flex", justifyContent: "center", paddingTop: 20 }}>
          <div style={note}>
            <span style={title}>▶ 右栏 · 行动</span>
            这里是<b>此刻能做的事</b>：可推进的<b>任务节点</b>（金色感叹号）、当前地点的<b>行动抉择</b>、<b>人物互动</b>入口。想推进剧情、跟人打交道，都从这一栏点。
          </div>
        </div>
      </div>

      {/* 底部按钮区说明，贴着底部（对应输入框上方那排模式按钮） */}
      <div style={{ padding: "0 14px 16px", display: "flex", justifyContent: "center" }}>
        <div style={{ ...note, maxWidth: 620 }}>
          <span style={title}>▼ 底部 · 交互模式（输入框上方那排按钮）</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
            <div><b style={{ color: "#6ec6c6" }}>◈ 行动</b>：正常移动、战斗、开箱、买卖等，<b>每次消耗一个回合</b>（时间前进）。</div>
            <div><b style={{ color: "#8ac48a" }}>◎ 对话</b>：只和当前在场 NPC 交谈，<b>不移动、不消耗回合</b>。</div>
            <div><b style={{ color: "#e0a0d0" }}>◆ 私聊旁白</b>：打破第四面墙，直接和「旁白」说话，<b>不消耗回合</b>。</div>
            <div><b style={{ color: "#c85a6a" }}>NSFW</b>：开关。开启后注入成人向写作规则；关闭则为常规叙事。默认关闭，按需点亮。</div>
          </div>
          <div style={{ marginTop: 8, color: "#9a9080", fontSize: "11.5px" }}>
            ⬆️ <b>顶栏</b>（界面最上方一排）：<b>📜任务</b> 看接了什么任务、进度如何；<b>👥人物关系</b> 看各角色好感；<b>📖见闻录</b> 看已知世界情报。
          </div>
          <div style={{ marginTop: 6, color: "#9a9080", fontSize: "11.5px" }}>
            ⚙ <b>其他功能</b>：<b>⚙设置</b> 里配置 API 密钥、存档、字号；<b>💾存档</b>随时读写；<b>⏻主菜单</b>返回开始界面；<b>🧭全流程日志</b>看系统每一步怎么跑的（喂给 AI 的完整 prompt 和回复）。
          </div>
        </div>
      </div>
    </div>
  );
}

function NineGridMap({ centerLabel, cells, onGo, accent = "#6ec6c6", loading, big = false }) {
  const [hover, setHover] = React.useState(null);
  // 3×3 布局：行=北/中/南，列=西/中/东
  const layout = [
    ["nw", "n", "ne"],
    ["w", "center", "e"],
    ["sw", "s", "se"],
  ];
  const DIR_CN = { n: "北", s: "南", e: "东", w: "西", ne: "东北", nw: "西北", se: "东南", sw: "西南" };
  const gap = big ? 8 : 5;
  const cellH = big ? 62 : 42;
  const fontMain = big ? 14 : 11;
  const short = (nm) => nm ? (nm.includes("·") ? nm.split("·").pop() : nm) : "";
  // tile: 三态贴图之一（MAP_UI.idle/fog/current），铺满格底。三张贴图原始尺寸略有差异，
  // 统一用 backgroundSize:100% 100% 拉伸到等大格子里，不叠加任何外发光（避免光晕溢出到
  // 格缝，看起来像竖线）。hover 高亮改用贴图自身 brightness，不再用 boxShadow。
  const cellStyle = (extra = {}, tile = null) => ({
    height: cellH, display: "flex", alignItems: "center", justifyContent: "center",
    textAlign: "center", lineHeight: 1.2, padding: "2px 4px", overflow: "hidden",
    transition: "filter .15s", border: "none", background: "transparent",
    backgroundImage: tile ? `url("${tile}")` : "none",
    backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    ...extra,
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap, width: "100%" }}>
      {layout.flat().map((key) => {
        if (key === "center") {
          return (
            <div key="center" style={cellStyle({}, MAP_UI.current)}>
              <span style={{ color: "#fff", fontWeight: "bold", fontSize: fontMain, textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>{short(centerLabel) || "我"}</span>
            </div>
          );
        }
        const c = cells[key] || { explored: false };
        const clickable = !loading;
        const hov = hover === key;
        // 未探索：战争迷雾（fog 贴图），只留一个问号，不显方向字
        if (!c.explored) {
          return (
            <div key={key} onClick={() => clickable && onGo(key)}
              onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)}
              style={cellStyle({ cursor: clickable ? "pointer" : "default", opacity: hov ? 1 : 0.82, filter: hov ? "brightness(1.25)" : "none" }, MAP_UI.fog)}>
              <span style={{ color: hov ? "#c0a060" : "#6a6a58", fontSize: big ? 18 : 14, fontWeight: "bold", textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}>?</span>
            </div>
          );
        }
        // 已探索：idle 贴图 + 地名（不显方向字）
        return (
          <div key={key} onClick={() => clickable && onGo(key)}
            onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)}
            style={cellStyle({ cursor: clickable ? "pointer" : "default", filter: hov ? "brightness(1.3)" : "none" }, MAP_UI.idle)}>
            <span style={{ color: hov ? "#eaf4ee" : "#cddcd4", fontSize: fontMain, fontWeight: hov ? "bold" : "normal", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{short(c.name)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ClickableMap({ nodes, onGo, cell, pad = 40, maxHeight = "62vh", accent = "#6ec6c6", loading }) {
  const [hover, setHover] = React.useState(null);
  // 拖动+缩放状态：view = {tx, ty, scale}。tx/ty 是平移量，scale 是缩放倍数。
  const [view, setView] = React.useState({ tx: 0, ty: 0, scale: 1 });
  const dragRef = React.useRef(null); // 拖动中：{ startX, startY, baseTx, baseTy }
  const [dragging, setDragging] = React.useState(false);
  if (!nodes.length) return null;

  // 节点用固定尺寸的正方贴图格子（贴图是正方，显示也正方，统一比例）。
  const NW = 84, NH = 84; // 节点贴图显示宽高（正方）
  const CELL = cell || 132; // 格间距（含节点+留白），略大于节点保证连线看得清
  // 统一字号：取全图最长地名的字数当基准，所有节点用同一字号，大小一致不参差。
  const labelLen = (n) => [...(n.name ? (n.name.includes("·") ? n.name.split("·").pop() : n.name) : "")].length;
  const maxLabelLen = Math.max(2, ...nodes.map(labelLen));
  const uniformFs = maxLabelLen >= 5 ? 12 : maxLabelLen >= 4 ? 13 : 15;
  // 坐标防撞：数据里偶有两个节点坐标相同，展示层螺旋偏移到最近空格。
  const occupied = new Set();
  const SPIRAL = [[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[0,2],[-2,0],[0,-2]];
  nodes = nodes.map(n => {
    for (const [dx, dy] of SPIRAL) {
      const nx = n.x + dx, ny = n.y + dy, k = nx + "," + ny;
      if (!occupied.has(k)) { occupied.add(k); return (dx || dy) ? { ...n, x: nx, y: ny } : n; }
    }
    return n;
  });
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const mnX = Math.min(...xs), mxX = Math.max(...xs), mnY = Math.min(...ys), mxY = Math.max(...ys);
  const w = (mxX - mnX + 1) * CELL + pad * 2, h = (mxY - mnY + 1) * CELL + pad * 2;
  const px = (x) => (x - mnX) * CELL + pad + CELL / 2;
  const py = (y) => (y - mnY) * CELL + pad + CELL / 2;
  const byName = {}; nodes.forEach(n => { if (n.name) byName[n.name] = n; });
  const cur = nodes.find(n => n.current);

  // ── 拖动 ──
  const onPointerDown = (e) => {
    // 只在点空白处开始拖动（点节点交给节点自己的 onClick）
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseTx: view.tx, baseTy: view.ty, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX, dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    setView(v => ({ ...v, tx: dragRef.current.baseTx + dx, ty: dragRef.current.baseTy + dy }));
  };
  const onPointerUp = () => { dragRef.current = null; setDragging(false); };
  // ── 缩放（滚轮）──
  const onWheel = (e) => {
    e.preventDefault();
    setView(v => {
      const next = Math.min(3, Math.max(0.4, v.scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      return { ...v, scale: next };
    });
  };
  const zoomBtn = (factor) => setView(v => ({ ...v, scale: Math.min(3, Math.max(0.4, v.scale * factor)) }));
  const resetView = () => setView({ tx: 0, ty: 0, scale: 1 });

  return (
    <div style={{ position: "relative", width: "100%", maxHeight, overflow: "hidden" }}>
      {/* 缩放控制按钮 */}
      <div style={{ position: "absolute", top: 6, right: 6, zIndex: 3, display: "flex", flexDirection: "column", gap: 4 }}>
        <span onClick={() => zoomBtn(1.25)} style={cmZoomBtn}>＋</span>
        <span onClick={() => zoomBtn(0.8)} style={cmZoomBtn}>－</span>
        <span onClick={resetView} style={{ ...cmZoomBtn, fontSize: "10px" }}>⤢</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`}
        style={{ width: "100%", maxHeight, display: "block", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onWheel={onWheel}>
        <defs>
          <style>{`@keyframes cmPulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} style={{ transformOrigin: "center" }}>
          {/* 连线 */}
          {nodes.flatMap(n => (n.links || []).map(dest => {
            const d = byName[dest]; if (!d || !n.explored || !d.explored) return null;
            const diag = n.x !== d.x && n.y !== d.y;
            return <line key={`${n.name}-${dest}`.split("").sort().join("")} x1={px(n.x)} y1={py(n.y)} x2={px(d.x)} y2={py(d.y)}
              stroke="#7a6448" strokeWidth={2.5} strokeDasharray={diag ? "6,4" : "none"} opacity={0.75} />;
          }).filter(Boolean))}
          {cur && nodes.filter(n => n.reachable || n.locked).map(n => (
            <line key={`go-${n.dir}-${n.name || n.dest}`} x1={px(cur.x)} y1={py(cur.y)} x2={px(n.x)} y2={py(n.y)}
              stroke={n.locked ? "#8a6a3a" : "#5a8a6a"} strokeWidth={2} strokeDasharray={n.explored ? "none" : "6,5"} opacity={0.6} />
          ))}
          {/* 节点：用九宫格三态贴图 */}
          {nodes.map(n => {
            const cx = px(n.x), cy = py(n.y);
            const label = n.name ? (n.name.includes("·") ? n.name.split("·").pop() : n.name) : "";
            const clickable = !loading && (n.reachable || n.locked);
            const hov = hover === (n.name || n.dir);
            const tile = !n.explored ? MAP_UI.fog : n.current ? MAP_UI.current : MAP_UI.idle;
            const fs = uniformFs;
            const onClickNode = (e) => {
              // 拖动过就不触发点击（避免拖完误跳转）
              if (dragRef.current?.moved) return;
              if (clickable) onGo(n.dir, n.explored ? n.name : n.dest, n.locked);
            };
            return <g key={n.name || n.dir} style={{ cursor: clickable ? "pointer" : "default" }}
              onClick={onClickNode}
              onMouseEnter={() => setHover(n.name || n.dir)} onMouseLeave={() => setHover(null)}>
              <image href={tile} x={cx - NW/2} y={cy - NH/2} width={NW} height={NH} preserveAspectRatio="none"
                style={{ filter: hov && clickable ? "brightness(1.25)" : "none",
                  animation: n.current ? "cmPulse 2.4s ease-in-out infinite" : "none" }} />
              {!n.explored ? (
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={hov ? "#c0a060" : "#7a7a68"} fontSize="18" fontWeight="bold" style={{ pointerEvents: "none", textShadow: "0 1px 2px #000" }}>?</text>
              ) : (
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                  fill={n.current ? "#fff" : "#eae0cc"} fontSize={fs} fontFamily="inherit" fontWeight={n.current ? "bold" : "normal"}
                  style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#000", strokeWidth: 2.5, strokeLinejoin: "round" }}>{label}</text>
              )}
              {n.locked && <text x={cx + NW/2 - 10} y={cy - NH/2 + 14} textAnchor="middle" fontSize="12" style={{ pointerEvents: "none" }}>🔒</text>}
            </g>;
          })}
        </g>
      </svg>
    </div>
  );
}

const cmZoomBtn = {
  cursor: "pointer", width: 22, height: 22, lineHeight: "20px", textAlign: "center",
  fontSize: "15px", color: "#4a3520", background: "rgba(240,232,210,0.85)",
  border: "1px solid #8a6a3a", borderRadius: 3, userSelect: "none", display: "block", fontWeight: "bold",
};

function PipelineViewer({ onClose, loading, waitSecs }) {
  // 遮罩误触修复：这个面板专门用来给玩家复制长段 prompt/回复文本排查问题，
  // 选字拖拽是最高频操作，正是最容易踩中"选字划出边界导致弹窗自己关了"
  // 这个bug的地方，必须修。见 utils/overlayClose.js。
  const closeGuard = useOverlayCloseGuard(onClose);
  const [expanded, setExpanded] = React.useState({});
  const [subTab, setSubTab] = React.useState({}); // 每条日志内部的子标签页：'sys' | 'user' | 'response' | 'recall'
  const toggle = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }));
  const setTab = (i, tab) => setSubTab(s => ({ ...s, [i]: tab }));
  const entries = getPipelineLog();

  const TAB_LABELS = { sys: "System", user: "输入", response: "输出", recall: "召回" };

  const [copied, setCopied] = React.useState(null); // 'all' | 索引，用于短暂显示"已复制"

  // 把一条日志整理成一段纯文本：System prompt + 输入 + 输出（失败则给错误），
  // 附上元信息头，方便直接粘给 AI 排查"这轮 prompt 长这样、结果长这样、哪里不对"。
  function formatEntry(entry, n) {
    const head = `=== Pipeline #${n} | ${new Date(entry.ts).toLocaleString()} | ${entry.apiType}/${entry.model}`
      + `${entry.intent ? ` | ${entry.intent.label}` : ""}${entry.streamed ? " | 流式" : ""}`
      + `${entry.durationMs != null ? ` | ${entry.durationMs}ms` : ""} | ${entry.success === false ? "✗失败" : (entry.finishReason || "✓")} ===`;
    const userText = (entry.userMessages || [])
      .map(m => `[${m.role}]\n${m.content}`).join("\n\n");
    const outText = entry.success === false
      ? `【错误】\n${entry.error || "(无错误信息)"}`
      : `【输出 / Response】\n${entry.response || "(空)"}`;
    let recallText = "";
    if (entry.recall && entry.recall.visible?.length) {
      recallText = "\n\n【召回 / RecalledMemories】\n" + entry.recall.visible
        .map(m => `· sim=${m.similarity?.toFixed(3) ?? "-"} [${m.tier || "-"}] (第${m.meta?.turn ?? "?"}回合) ${m.text}`)
        .join("\n");
    }
    return `${head}\n\n【System Prompt】\n${entry.systemPrompt || "(空)"}\n\n【输入 / User】\n${userText}\n\n${outText}${recallText}`;
  }

  // 剪贴板写入：优先 navigator.clipboard，非安全上下文（部分 http/局域网）降级到 textarea+execCommand。
  async function copyText(text, tag) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      setCopied(tag);
      setTimeout(() => setCopied(c => (c === tag ? null : c)), 1500);
    } catch (e) {
      alert("复制失败，请手动选中复制：" + (e.message || e));
    }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 6, padding: 16, width: 820, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto", fontFamily: "monospace", fontSize: "11px", color: "#8a8a7a" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: "#f0c060", fontSize: "13px" }}>Pipeline 日志（最近 {entries.length} 条）</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ cursor: "pointer", color: copied === "all" ? "#8ac48a" : "#6a8a6a" }}
              onClick={() => copyText(entries.map((e, k) => formatEntry(e, entries.length - k)).join("\n\n\n"), "all")}>
              {copied === "all" ? "✓ 已复制全部" : "复制全部"}
            </span>
            <span style={{ cursor: "pointer", color: "#8a6a4a" }} onClick={() => { clearPipelineLog(); onClose(); }}>清空</span>
            <span style={{ cursor: "pointer", color: "#5a5a4a", fontSize: "13px" }} onClick={onClose}>×</span>
          </div>
        </div>
        {loading && (
          <div style={{
            marginBottom: 10, padding: "6px 10px", borderRadius: 4,
            background: waitSecs >= 30 ? "#3a1a1a" : waitSecs >= 12 ? "#3a2a12" : "#12180a",
            color: waitSecs >= 30 ? "#e08a6a" : waitSecs >= 12 ? "#e0b060" : "#8ab48a",
            border: `1px solid ${waitSecs >= 30 ? "#5a2a2a" : "#2a3a1a"}`,
          }}>
            {waitSecs >= 30 ? "🐢" : "⏳"} 正在等待接口响应… 已 {waitSecs}s
            {waitSecs >= 30 ? "（疑似卡住，>60s 自动超时）" : waitSecs >= 12 ? "（偏慢）" : ""}
          </div>
        )}
        {entries.length === 0 && <div style={{ color: "#3a3830" }}>暂无 API 调用记录</div>}
        {entries.map((entry, i) => {
          const open = expanded[i];
          const tab = subTab[i] || "response";
          const recall = entry.recall; // { visible, filtered, stats } | null
          return (
            <div key={i} style={{ borderBottom: "1px solid #14161e", padding: "8px 0" }}>
              <div onClick={() => toggle(i)} style={{ cursor: "pointer", marginBottom: 4, userSelect: "none", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: "#6ec6c6" }}>{open ? "▼" : "▶"} #{entries.length - i}</span>
                <span style={{ color: "#5a5a4a" }}>{new Date(entry.ts).toLocaleTimeString()}</span>
                <span style={{ color: "#5a5a4a" }}>{entry.apiType}/{entry.model}</span>
                {entry.streamed && <span style={{ color: "#5a7a9a" }}>流式</span>}
                {entry.intent && <span style={{ color: "#8ac48a" }}>{entry.intent.label}</span>}
                {entry.usage && <span style={{ color: "#5a5a4a" }}>入{entry.usage.prompt_tokens ?? entry.usage.promptTokenCount ?? entry.usage.input_tokens ?? "?"}/出{entry.usage.completion_tokens ?? entry.usage.candidatesTokenCount ?? entry.usage.output_tokens ?? "?"}</span>}
                {entry.durationMs != null && <span style={{ color: "#5a5a4a" }}>{entry.durationMs}ms</span>}
                {recall && <span style={{ color: "#c48a4a" }}>召回{recall.visible?.length ?? 0}{recall.filtered ? `(隐${recall.filtered})` : ""}</span>}
                <span
                  onClick={(e) => { e.stopPropagation(); copyText(formatEntry(entry, entries.length - i), i); }}
                  title="复制本条：System prompt + 输入 + 输出"
                  style={{ color: copied === i ? "#8ac48a" : "#6a8a6a", cursor: "pointer", border: "1px solid #24302a", borderRadius: 3, padding: "0 6px", fontSize: "10.5px" }}
                >
                  {copied === i ? "✓已复制" : "📋复制"}
                </span>
                <span style={{ color: entry.success === false ? "#c46060" : "#5a8a5a", marginLeft: "auto" }}>
                  {entry.success === false ? "✗ 失败" : (entry.finishReason || "✓")}
                </span>
              </div>
              {open && (
                <div style={{ paddingLeft: 12 }}>
                  <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                    {["sys", "user", "response", ...(recall ? ["recall"] : [])].map(t => (
                      <span
                        key={t}
                        onClick={() => setTab(i, t)}
                        style={{
                          cursor: "pointer", padding: "2px 10px", borderRadius: 3,
                          background: tab === t ? "#1a2530" : "transparent",
                          color: tab === t ? "#c8bfa0" : "#5a5a4a",
                        }}
                      >
                        {TAB_LABELS[t]}
                      </span>
                    ))}
                  </div>

                  {tab === "sys" && (
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#0d0f18", padding: "8px", borderRadius: 3, maxHeight: 400, overflowY: "auto" }}>
                      {entry.systemPrompt}
                    </div>
                  )}

                  {tab === "user" && (
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#0d0f18", padding: "8px", borderRadius: 3, maxHeight: 400, overflowY: "auto" }}>
                      {(entry.userMessages || []).map((m, mi) => (
                        <div key={mi} style={{ marginBottom: 8 }}>
                          <div style={{ color: "#5a8a5a" }}>[{m.role}]</div>
                          <div>{m.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "response" && (
                    <div>
                      {entry.success === false ? (
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#1a0d0d", color: "#e08080", padding: "8px", borderRadius: 3 }}>
                          错误：{entry.error}
                        </div>
                      ) : (
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#0d0f18", padding: "8px", borderRadius: 3, maxHeight: 400, overflowY: "auto" }}>
                          {entry.response}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "recall" && recall && (
                    <div>
                      {recall.stats && (
                        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap", color: "#5a5a4a" }}>
                          {Object.entries(recall.stats).map(([k, v]) => (
                            <span key={k}>{k}: <span style={{ color: "#c8bfa0" }}>{String(v)}</span></span>
                          ))}
                        </div>
                      )}
                      <div style={{ color: "#5a8a5a", marginBottom: 4 }}>▸ 可见（已通过权限过滤，实际进入 prompt）</div>
                      {(recall.visible || []).map((m, mi) => (
                        <div key={mi} style={{ background: "#0d0f18", padding: "6px 8px", borderRadius: 3, marginBottom: 4 }}>
                          <div style={{ color: "#5a5a4a" }}>sim={m.similarity?.toFixed(3) ?? "-"} · {m.meta?.id || m.id}</div>
                          <div>{m.text}</div>
                        </div>
                      ))}
                      {recall.filtered > 0 && (
                        <div style={{ color: "#8a6a4a", marginTop: 6 }}>
                          另有 {recall.filtered} 条召回结果因可见性权限被隐藏（flag 未解锁）
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// loadSlotId 含义：
//   "auto"/null/undefined → 自动存档；其他字符串 → 手动槽位 id。
// 存档已在启动时由 saves.init() 全量灌入内存缓存，故 loadAutoSave/loadSlot 是同步读缓存，
// 这里保持同步、MudRPG 一整套 useState(restored?…) 初始化不受影响。
function tryRestoreSave(presets, loadSlotId) {
  let snap = null;
  if (loadSlotId === "auto" || loadSlotId === undefined || loadSlotId === null) {
    snap = loadAutoSave();
  } else {
    snap = loadSlot(loadSlotId);
  }
  if (!snap) return null;
  const matchedPreset = presets.find(p => p.id === snap.preset?.id);
  if (!matchedPreset) return null;
  if (!isCompatibleCharShape(snap.char) || !isCompatibleRoomShape(snap.room)) {
    console.warn("检测到旧版本存档结构，已自动丢弃并使用默认角色/房间数据");
    return null;
  }
  // 老存档装备迁移：早期有物品（如"无主的青锋剑"）误用了 atkMul/defMul 倍率字段，
  // 但战斗/装备系统只读 atk/def 实际值——倍率字段从来没人读，导致装备了却加不到攻防。
  // 读档时统一补算：凡是有倍率但缺实际值的武器/护甲，用「品质基准 × 倍率」折出 atk/def。
  // 通用处理（不针对单个 id），这类死字段坑一次堵死，将来别的漏网物品也自动修好。
  if (Array.isArray(snap.inv)) {
    snap.inv = snap.inv.map(it => {
      if (!it || typeof it !== "object") return it;
      const fixed = { ...it };
      if (fixed.atkMul != null && fixed.atk == null && fixed.category === "weapon") {
        const base = statsForQuality("weapon", fixed.quality);
        if (base.atk != null) fixed.atk = Math.round(base.atk * fixed.atkMul);
      }
      if (fixed.defMul != null && fixed.def == null && fixed.category === "armor") {
        const base = statsForQuality("armor", fixed.quality);
        if (base.def != null) fixed.def = Math.round(base.def * fixed.defMul);
      }
      return fixed;
    });
  }
  return { snap, preset: matchedPreset };
}

export default function MudRPG({ initialLoadSlotId = null, initialOpenSettings = false } = {}) {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  // "new" 是显式新开局信号，此时无论有没有存档都不恢复。
  const restored = initialLoadSlotId === "new" ? null : tryRestoreSave(DEFAULT_PRESETS, initialLoadSlotId);

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
  // 装备信息现在完全并入 inv（每个物品对象自带 category/equipped 标记），不再单独维护 equip state
  const [inv, setInv] = useState(restored?.snap.inv || [...DEFAULT_PRESETS[0].inv]);
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

  // ── 临时七维 buff 的读取端（消耗品系统第3步）──
  // buff flag 写在 flags 里（buff_属性+M_untilturn_T，T 是到期的 time 值，makeBuffFlag
  // 已用 time 作计时基准）。此前只有写入端（点菜/吃 B 档药），读取端从未接通，导致 buff
  // 挂了不生效（"死 buff"）。这里把当前生效的临时增益叠到基础七维上，得到"有效七维"，
  // 探索态状态面板、以及进入战斗时传给 DuelScreen 的都用这个。
  // 计时基准一律用 time（游戏时辰），不是 turnCount——项目没有 turnCount。
  const effectiveSpecialNow = applyBuffsToSpecial(char.special, flags, time);
  const activeBuffs = activeBuffsWithRemaining(flags, time);
  const [gm, setGm] = useState(false);
  const [showDebug, setShowDebug] = useState(false); // 调试面板显隐
  const [dbgFav, setDbgFav] = useState("");   // 调试·好感度目标NPC名
  const [dbgDist, setDbgDist] = useState(""); // 调试·传送目标大地点
  const [dbgInner, setDbgInner] = useState(""); // 调试·传送目标小地点
  const [dbgSkillType, setDbgSkillType] = useState("全部"); // 调试·增加武学·类型筛选
  const [dbgSkillQuality, setDbgSkillQuality] = useState("全部"); // 调试·增加武学·品阶筛选
  const [dbgItemName, setDbgItemName] = useState("");   // 调试·增加物品·名称（手打自定义用）
  const [dbgItemCat, setDbgItemCat] = useState("weapon"); // 调试·增加物品·类别
  const [dbgItemQuality, setDbgItemQuality] = useState("白"); // 调试·增加物品·品阶
  const [dbgPickedSkill, setDbgPickedSkill] = useState("");  // 调试·增加武学·选中的武学id
  const [dbgItemCatF, setDbgItemCatF] = useState("全部");   // 调试·从目录选物品·类别筛选
  const [dbgItemQualF, setDbgItemQualF] = useState("全部");  // 调试·从目录选物品·品阶筛选
  const [dbgPickedItem, setDbgPickedItem] = useState("");   // 调试·从目录选中的物品名
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
  const [nsfwOn, setNsfwOn] = useState(false); // ■ NSFW 开关：true=注入NSFW规则+primer消息
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
  // 遮罩误触修复见 utils/overlayClose.js。这两个弹窗用内联 () => setShowXxx(false)
  // 而非 onClose prop，closeGuard 接受任意回调，用法一致；必须在组件顶层建实例
  // （不能放进下面的条件渲染 JSX 里，否则违反 hooks 规则）。
  const versionHistoryCloseGuard = useOverlayCloseGuard(() => setShowVersionHistory(false));
  const [showCharacterPage, setShowCharacterPage] = useState(false);
  // 玩家头像：优先用玩家自设的（存 localStorage），否则按性别用预制头像。showAvatarPicker 控制选择弹层。
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const avatarPickerCloseGuard = useOverlayCloseGuard(() => setShowAvatarPicker(false));
  const [playerAvatarCustom, setPlayerAvatarCustom] = useState(() => {
    try { return localStorage.getItem("qucuo_player_avatar") || ""; } catch { return ""; }
  });
  const AV_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/player/";
  const genderAvatar = { "男": AV_BASE + "male.png", "女": AV_BASE + "female.png" };
  const playerAvatar = playerAvatarCustom || genderAvatar[char.gender] || (AV_BASE + "other.png");
  const [showQuestLog, setShowQuestLog] = useState(false);
  const [showLore, setShowLore] = useState(false); // 见闻录：小纸条+小账本可视化
  const [characterPageTarget, setCharacterPageTarget] = useState(null); // "面板"按钮指定直接打开谁的详情
  const [portraits, setPortraits] = useState(loadPortraits());
  // 雪豹立绘三形态切换（人形·立雪/人形·倚剑/雪豹真身，存 localStorage 持久化）；
  // slImgErr：图片文件未投放到 public/portraits/snowleopard/ 时显示占位提示而不是破图
  const [slForm, setSlFormState] = useState(getSnowLeopardForm());
  const [slImgErr, setSlImgErr] = useState(false);
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
  const collectGrantedRef = useRef([]); // 本轮系统已代发的采集物名单，供items_add处理时防止AI重复入袋
  const logEnd = useRef(null);
  const inputRef = useRef(null);
  const pendingQueue = useRef([]); // 处理中时暂存排队命令
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const roomMapRef = useRef({ [(restored?.snap.room || DEFAULT_PRESETS[0].room).name]: { items: [...(restored?.snap.room || DEFAULT_PRESETS[0].room).items], npcs: [...(restored?.snap.room || DEFAULT_PRESETS[0].room).npcs] } });

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
    const every = Math.max(0, Number(apiCfg.autoSaveEvery ?? 5));
    if (every > 0 && roundsSinceLastSaveRef.current < every) return; // 间隔未到
    const snapshot = buildSnapshot({ preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, deposit, depositedAt, pledgedItems, persuasionProgress, innerRoomName, companionState });
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
    setSkills(snap.skills); setInv(snap.inv);
    setLog(snap.log); setConvo(snap.convo); setExp(snap.exp); setPot(snap.pot);
    setFlags(snap.flags); setMapData(snap.mapData); setTime(snap.time);
    setNarrator(snap.narrator || initialNarratorState());
    setVarTree(snap.varTree || initialVarTree());
    setQuestProgress(snap.questProgress || {});
    setClaimedMilestones(new Set(snap.claimedMilestones || []));
    setDeposit(snap.deposit || 0);
    setDepositedAt(snap.depositedAt ?? null);
    setPledgedItems(snap.pledgedItems || []);
    setCompanionState(snap.companionState || initCompanionState());
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
  }), [preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, persuasionProgress, innerRoomName, companionState]); // deposit/depositedAt/pledgedItems captured via closure

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
      if (line) setVarTree(prev => setFactSummary(prev, factId, line));
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
      if (material.length) summarizeDay(ended, material);
    }
  }, [time, summarizeDay]);
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
      for (const k of ["levelCap", "beast", "unlearnable", "cannotSpeak", "affectionable", "fullBio", "personality", "burdenMoveIds", "carry", "gambleBidder", "lockInnerRoom", "bidderKind"]) {
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
    const residentNpcs = getResidentNpcs(room.name).map(toRoomNpcWithCombat);
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
    setRoom(r => {
      const existingNames = new Set((r.npcs || []).map(n => n.name));
      const toAdd = toInject.filter((n, i) => !existingNames.has(n.name) && toInject.findIndex(x => x.name === n.name) === i);
      if (toAdd.length === 0) return r;
      return { ...r, npcs: [...(r.npcs || []), ...toAdd] };
    });
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
      return [{ t: "sys", text: "── 武学 ──" }, ...skills.map(s => ({ t: "skill", text: `  ${s.active ? "▶" : "○"} ${s.name}·${s.stage}  Lv.${s.level}  [${bar(s.exp, s.maxExp, 8)}] ${s.exp}/${s.maxExp}` }))];
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
      const sys = `${buildNarratorWhisperContext(narrator.affection)}\n${voice}\n\n${worldState}${factsBlock}${recallBlock}${narratorLoreBlock}${_bodyWhisper.text}${_topicGate.text}${_questGate.text}\n\n剧本背景设定：${_whisperGate.text}\n${narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords)}`;

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

      setNarrator(n => {
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
        const inc = Math.max(-n.affection, Math.min(affDelta, 100 - n.affection));
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
      const extra = s.fixed ? `${q}品·授业绝学（完整）` : `${q}品·${s.stage} Lv.${s.level}`;
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

    // ── 内层箱庭移动：优先于外层大地图判定 ──
    // 如果当前据点有内层数据（hasInnerMap(room.name)为真）且这个方向是
    // 内层当前房间的有效出口，这次移动完全在纯前端处理：只改 innerRoomName，
    // 不触碰 room.name/room.exits，也不进入下面的AI调用流程。这跟总纲
    // 第十章"内层移动不该消耗AI调用"的设计意图一致——在同一个据点内部
    // 从村口走到老孙饭馆，属于UI层面的场景切换，不需要每步都请求AI
    // 重新生成场景描述（房间的描述本身是innerMap.js里钉死的固定文字）。
    // 只有内层房间没有这个方向的出口时，才继续走下面外层大地图/AI叙事
    // 的原有逻辑——这样"从内层某个房间的锚点走出据点"依然能触发外层
    // resolveExit，两套移动无缝衔接。
    // 命令区分内外层（本轮）：内/外方向按钮点击时通过 opts.forceLayer 明确指定这次
    // 是"内层移动"还是"外层移动"，不再靠"内层优先"猜——那会在锚点房间同方向既有内层
    // 出口又有外层出口时撞车（村口按西：内层通杂货铺、外层通鱼定土司，内层优先就永远
    // 到不了土司）。forceLayer="outer" 时直接跳过内层判定走外层；="inner" 时只在内层
    // 找，内层没这方向就明确"此路不通"，不越权去走外层。打字移动（无 forceLayer）保持
    // 旧行为：内层优先、内层没有再 fallback 外层。
    const forceLayer = opts.forceLayer || null;
    if (!isTalk && movingDir && hasInnerMap(room.name) && innerRoomName && forceLayer !== "outer") {
      const innerDest = resolveInnerExit(room.name, innerRoomName, movingDir);
      traceStep(_trace, "内层移动", "info", `判定：当前内层「${innerRoomName}」往${DIRS[movingDir] || movingDir}${innerDest ? `通向「${innerDest}」` : "无出口"}`);
      if (innerDest) {
        traceStep(_trace, "内层移动", "pass", `${innerRoomName} → ${innerDest}（纯前端，不调AI）`);
        endTrace(_trace, `内层移动到 ${room.name}·${innerDest}`);
        addLog([{ t: "cmd", text: `> ${cmd}` }]);
        setInput("");
        setCmdHistory(p => [cmd, ...p].slice(0, 50));
        setHistIdx(-1);
        const fromRoom = innerRoomName;
        setInnerRoomName(innerDest);
        // 内层移动不调 AI，方位描述本地生成（纯函数在 mapNarration.js，可在
        // tools/debug.mjs 调试台直接验证）：从哪来、四周内层去处、远处外层据点。
        addLog([
          { t: "room", text: "" },
          { t: "room", text: `    ${room.name}·${innerDest}` },
          { t: "room", text: "" },
          ...describeInnerArrival(room.name, fromRoom, innerDest, movingDir, { flags }),
        ]);
        setTime(t => t + 1);
        // 新人物检测（本轮修）：内层箱庭移动此前直接 return，完全跳过了下方主流程的
        // 新人物检测——于是从 B 箱庭走到绑着新 NPC 的 A 箱庭（如走进"猎户小屋"遇到
        // 只属于该房间的老猎户），明明有没见过的人却不报"※新人物出现"。这里用与主流程
        // 同一套判据补上：按目标内层房间(innerDest)的可见性过滤 room.npcs，再 detectNewFaces
        // 查没见过的。纯本地、不调 AI，跟内层移动"瞬时"的性质一致。
        {
          const arrivedNpcs = (room.npcs || []).filter(n => isNpcVisibleInInnerRoom(room.name, innerDest, n));
          const newFaces = detectNewFaces(varTreeRef.current, arrivedNpcs);
          if (newFaces.length) {
            addLog(newFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` })));
            setVarTree(prev => markAsSeen(prev, newFaces.map(n => n.name)));
          }
          // 久别重逢的"上次见面回合"也一并更新，跟主流程保持一致
          setVarTree(prev => updateLastSeen(prev, arrivedNpcs.map(n => n.name), time));
        }
        // 内层移动是瞬时纯前端操作，early return 前必须把上面 setLoading(true)+计时器清掉，
        // 否则 loading 永远停在 true：输入框锁死、spinner 空转、秒数狂涨，且 pendingQueue 因
        // loading 不归零永不出队——彻底卡死（此前"点一下卡住像在等AI"的真凶）。
        setLoading(false);
        if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
        setWaitSecs(0);
        return;
      }
      // 内层这个方向没出口。若玩家明确点的是「内」按钮（forceLayer==="inner"），
      // 就到此为止、告诉他内层此路不通，不越权走外层。
      if (forceLayer === "inner") {
        traceStep(_trace, "内层移动", "block", `内层「${innerRoomName}」往${DIRS[movingDir] || movingDir}无出口`);
        endTrace(_trace, "内层此路不通");
        addLog([{ t: "cmd", text: `> ${cmd}` }, { t: "sys", text: `  内里这个方向没有去处。` }]);
        setInput(""); setCmdHistory(p => [cmd, ...p].slice(0, 50)); setHistIdx(-1);
        setLoading(false);
        if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
        setWaitSecs(0);
        return;
      }
      // 打字移动（无 forceLayer）：内层没这方向，放行继续走下面外层判定（旧行为）。
    } else if (!isTalk && movingDir) {
      // 是移动指令，但没进内层判定分支——记录为什么，便于排查"内层移动为何走了AI/外层"。
      const why = !hasInnerMap(room.name) ? "此据点无内层地图"
        : !innerRoomName ? "内层房间未定位(innerRoomName为空)"
        : forceLayer === "outer" ? "明确指定外层(forceLayer=outer)"
        : "未知";
      traceStep(_trace, "内层移动", "skip", `跳过内层判定（${why}）→ 转外层/AI`);
    }

    // 系统裁决层：固定拓扑地图决定移动的合法性和目的地，AI 不能自己决定去了哪里。
    // 如果这个方向在 QUCUO_MAP 里有登记的出口，锁定目的地；如果没有，明确告诉 AI
    // 这个方向走不通，不允许它凭空编一个新地方出来。
    let destinationLock = "";
    let lockedDestName = null;
    if (!isTalk && movingDir) {
      const dest = resolveExit(room.name, movingDir);
      if (dest && !isNodeUnlocked(dest, { completedQuests: new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id)), flags })) {
        // ⑥ 解锁门禁：目标据点尚未解锁（如黑风寨需先完成 heifengzhai_2）——此路未通，不移动。
        destinationLock = `\n[系统裁决：此路未通] 玩家想往${DIRS[movingDir] || movingDir}去「${dest}」，但此地此刻尚未对玩家开启（前置条件未达成）。请在 output 里合理写出这条路走不通/被拦/时机未到，room.name 必须保持"${room.name}"不变，不要移动、不要凭空编新地点。`;
        traceStep(_trace, "外层移动", "block", `往${DIRS[movingDir] || movingDir}→${dest} 未解锁（前置未达成），不移动`);
        movingDir = null; pendDirRef.current = null;
      } else if (dest) {
        lockedDestName = dest;
        // 内层→外层移动规则（用户拍板）：玩家在任意内层房间走外层出口时，逻辑上是
        // "先自动寻路回本据点锚点房间，再从锚点走到目标据点的锚点房间"。玩家一步指令
        // 完成、不拆回合，但这段"回锚点"要在到达描述里交代，否则会突兀（人在塔顶怎么
        // 一下就到了喇嘛庙）。这里捕获出发时的内层房间和本区锚点，供 arrivalNote 用。
        const _fromAnchor = hasInnerMap(room.name) ? getDistrictAnchor(room.name) : null;
        const _leftFromInner = (hasInnerMap(room.name) && innerRoomName && innerRoomName !== _fromAnchor) ? innerRoomName : null;
        outerDepartRef.current = { fromInner: _leftFromInner, fromAnchor: _fromAnchor, fromDistrict: room.name };
        if (_leftFromInner) traceStep(_trace, "外层移动", "info", `先自本区内层「${_leftFromInner}」寻路回锚点「${_fromAnchor}」，再出据点`);
        traceStep(_trace, "外层移动", "pass", `锁定目的地 ${room.name}→${dest}，待AI生成到达描述后写回`);
        const destNode = getMapNode(dest);
        destinationLock = `\n[系统裁决：固定地图] 玩家往${DIRS[movingDir] || movingDir}走，这个方向确定通向"${dest}"，地图上这个据点的基础设定：${destNode.desc}
你必须把 room.name 设为"${dest}"，room.exits 必须严格等于该据点在固定地图上的实际出口方向列表：${Object.keys(destNode.exits).join(",")}（不能增删出口）。
你只负责基于上述基础设定，结合当前时间/剧情进展，生成更具体生动的场景描述文本（room.desc）、当前在场的 NPC、地上的物品——这些细节由你发挥，但地点本身、出口列表是固定的，不能更改。`;
      } else if (QUCUO_MAP[room.name]) {
        // 当前房间在固定地图里，但这个方向没有登记出口——明确告知此路不通
        destinationLock = `\n[系统裁决：固定地图] 玩家尝试往${DIRS[movingDir] || movingDir}走，但曲措乡的固定地图里，"${room.name}"这个方向没有已知出口。你应该在 output 里合理描述"此路不通"或"是荒野/断崖/无路可走"，room.name 保持不变（不要移动），不要凭空编造一个新地点。`;
        traceStep(_trace, "外层移动", "block", `往${DIRS[movingDir] || movingDir} 无出口，不移动`);
      }
      // 如果当前房间不在 QUCUO_MAP 里（不应该发生，但作为兜底），不加任何锁定说明，走原有自由生成逻辑
    } else if (!isTalk && !movingDir && QUCUO_MAP[room.name]) {
      // 之前这里完全不给AI任何位置约束——玩家一句没有明确方向词的自由输入
      // （"随便走走""四处逛逛"之类），AI 会不受约束地凭感觉叙述"走到了别处"，
      // 而系统状态其实并未移动（下面应用响应时 name/exits 会被强制按原地锁回），
      // 导致"文字说去了新地方，但地图/据点其实没变"的错位观感，也是玩家反馈
      // "乱走会莫名跳到不该连通的地方"的真正来源——不是拓扑图连错了，是这里
      // 叙事和状态在打架。明确告诉AI这回合不会真的挪地方，把两边说法对齐。
      destinationLock = `\n[系统裁决：固定地图] 玩家这句输入没有明确的移动方向（不是"往东/南/西/北/上/下"这类清晰指令）。无论玩家写了什么（哪怕提到了别的地名），本回合都不会真的改变所在位置：room.name 必须保持"${room.name}"不变，room.exits 必须严格等于：${Object.keys(QUCUO_MAP[room.name].exits).join(",")}。output 里可以自由描述这个动作本身（比如打量四周、随便走走的心境、跟人搭话等），但不能暗示"已经到了别的地方"。`;
    }

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
    const modeNote = isTalk
      ? `[交互模式] 对话模式：玩家此刻只是在和当前房间里的 NPC 说话，不是在下达行动指令。无论玩家输入什么，都只应该触发对话回应，绝不能移动房间、不能战斗、不能改变 room/char/装备/背包等任何状态，room 字段留空或原样返回，delta 各项留空。此外，请在顶层 JSON 里加一个字段 "respondedNpcs":["名字"]，列出本轮正文里【真正开口跟玩家对话/直接回应了玩家】的 NPC 名字（只列真的说了话或有来有往互动的人；只是被提到、路过、在场却没搭理玩家的，不要列入）。没有人开口回应就返回空数组 []。 `
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

    // ── 采集裁决（系统层）──
    // 玩家表达采集意图、且所采之物此刻真在地上（系统先前已注入）时，由系统直接
    // 把物搬入背包、从地上抹去——「采没采到」不交给 AI 决定。推进则由背包变化
    // 触发的 alreadySatisfiedCollectStages effect 接管（采齐才推进）。
    // AI 只负责把这次采集叙述得好看，不得重复发物、不得写"没采到"。
    let collectNote = "";
    collectGrantedRef.current = [];
    if (!isTalk) {
      const hit = detectCollectPickup(cmd, room.name, room.items, {
        questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv,
      });
      if (hit) {
        const cEntry = (Array.isArray(hit.stage.collect) ? hit.stage.collect : [hit.stage.collect])
          .find(c => c.item === hit.item) || {};
        const gained = makeGameItem({ name: hit.item, category: "misc", quality: cEntry.quality || "白", desc: cEntry.hint || "" });
        setInv(v => [...v, gained]);
        setRoom(r => ({ ...r, items: (r.items || []).filter(i => (typeof i === "string" ? i : i.name) !== hit.item) }));
        collectGrantedRef.current = [hit.item];
        addLog([{ t: "item", text: `  ✓ 你采得「${hit.item}」，收入背包。` }]);
        // 是否采齐（用投影后的背包判断，避免读到旧 state）
        const projected = [...inv, gained];
        const done = allCollected(hit.stage, projected);
        collectNote = `\n[系统裁决：玩家已采得「${hit.item}」，系统已将其收入背包。请在 output 里自然叙述采集/挖取的过程与手感（贴合本地域），但**不要**在 delta.items_add 里再加这件物品（否则会重复），也不要写"没找到""采不到"。${done ? `此物一到手，《${hit.quest.title}》本阶段所需已齐。` : `本阶段还需其余材料，可点出还差什么。`}]`;
      }
    }

    // 多阶段任务链（虎胆三重门等）：告诉AI当前哪些任务阶段可以推进/开启，
    // 以及对应要在 delta.flags_add 里吐出的 flag 字符串——AI 只管在叙事到位
    // 时触发这个 flag，阶段推进/互斥锁定/结局判定全部由系统状态机接管
    // （见 quests/questEngine.js、quests/endingResolver.js），不需要 AI 自己
    // 记住"现在第几阶段""这条线是否已经被另一条线锁死"。
    let questStageNote = "";
    {
      const describeFlag = (f) => Array.isArray(f) ? f.map(x => `"${x}"`).join("/或") + "（按玩家实际选择的分支，只加其中一个）" : `"${f}"`;
      const noteLines = [];
      for (const quest of QUCUO_QUESTS) {
        if (!quest.stages?.length) continue;
        const prog = questProgress[quest.id];
        if (prog?.status === "locked_by_exclusive" || prog?.status === "completed") continue;
        if (!isQuestGateOpen(quest, questProgress, flags)) continue;
        if (quest.id === "hidden_all_collect_line" && !canBypassExclusive({ char, flags })) continue;
        if (prog?.status === "active") {
          const stage = getCurrentStage(quest, prog);
          if (stage) noteLines.push(`《${quest.title}》当前阶段：${stage.description}——叙事推进到此处后，在 flags_add 加入${describeFlag(stage.completionFlag)}`);
        } else if (quest.giver && room.npcs.some(n => n.name === quest.giver)) {
          noteLines.push(`${quest.giver}可引出《${quest.title}》——若玩家与其互动触及此事，在 flags_add 加入${describeFlag(quest.stages[0].completionFlag)}`);
        }
      }
      if (noteLines.length) questStageNote = `\n[任务阶段] ${noteLines.join("；")}。`;
      // 本据点地上有哪些采集物在等着采（系统已注入到 room.items），提示 AI 心里有数：
      // 玩家若想采，直接顺势叙述（真正的入袋/推进由系统裁决，不劳 AI 动 items_add）。
      const cLines = collectPromptLines(room.name, { questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv });
      if (cLines.length) questStageNote += `\n[可采集] ${cLines.join("；")}。玩家表达采集意图时顺势叙述采集过程即可，系统会自动结算入袋，你不要写"采不到"。`;
    }

    // ── 说服型任务分支的成功判定注入 ──
    // 玩家选了"周旋/说服"进对话，AI 要把这当成一场真交锋来演：只有玩家
    // 的话在理、把对方驳倒/说动时，才在 flags_add 吐出成功 flag 推进；
    // 玩家词不达意、被反驳、气势输了，就让对方继续刁难，不给过。
    if (pendingQuestBranch?.mode === "talk" && pendingQuestBranch.goal) {
      const pq = QUCUO_QUESTS.find(x => x.id === pendingQuestBranch.questId);
      questStageNote += `\n[说服判定] 玩家正试图通过言辞达成：${pendingQuestBranch.goal}。这是一场真正的言语交锋，不是走过场——评估玩家这句话是否切中要害、有理有据、气势压得住对方。若确实说动/驳倒了对方，在 flags_add 加入「${pendingQuestBranch.flag}」并让对方让步；若玩家只是空喊、被驳倒或理亏，让对方继续刁难，不要吐这个 flag，玩家可以再想说辞。`;
    }

    // ── 本步已定情节（原任务专属 harness 并入主叙事，取代单独一次 AI 调用）──
    // 感叹号任务节点点击时，系统已用 forceAdvanceQuest 结算好这一步该产生的
    // 效果（好感/道具/flag），这里只把"这件已确定发生的事"作为一段末尾强指令
    // 追加进主叙事 prompt（酒馆 @Depth 0 位置，约束力最强），让主叙事把它自然
    // 写进正文。把原 harness 的收窄约束一并搬来：只写这一件、别引入别的情节/
    // 新角色、结果不可改写；且【奖励已由系统结算，AI 不要在 delta/items_add/
    // flags_add 里重复结算任何奖励或状态】，避免双重发奖。
    let forcedEventNote = "";
    if (opts.forcedEvent) {
      forcedEventNote = `\n[本步已定情节] 这一回合确定发生了下面这件事，请把它自然演绎进 output 正文（这是剧情/任务节点，篇幅给足，约 ${apiCfg.targetWordCount} 字，允许±15%浮动，有场景、有对话、有起伏，不要草草几句带过）：${opts.forcedEvent}${opts.forcedEventNpc ? `（关键人物：${opts.forcedEventNpc}）` : ""}。严格要求：只写这一件事，不要引入这件事之外的情节、不要让其他角色突然登场、不要铺垫别的伏笔；结果已定，不可改写、不可让它"没发生"或变成别的事。这件事的奖励与状态变化已由系统结算完毕，你【不要】在 delta / items_add / flags_add 里重复结算任何奖励或状态，只管把它写成生动的正文。`;
    }

    // ③ 入场叙事：跨据点抵达新地点时，让本轮叙事先给一段"立此存照"的场景开场——
    // 交代此地的地貌气候、建筑、在场之人、地上显眼之物，再承接玩家这一步的后续。
    let arrivalNote = "";
    if (!isTalk && movingDir && lockedDestName) {
      const bld = getBuildingsForLocation(lockedDestName).map(b => b.name).join("、");
      const destAnchor = hasInnerMap(lockedDestName) ? getDistrictAnchor(lockedDestName) : null;
      const dep = outerDepartRef.current;
      // 若玩家是从本据点某个非锚点内层房间出发走的外层，描述要先交代"自内层某处
      // 归至本区门户（锚点），再离开本据点"，最后落到目标据点的锚点房间——不要让
      // 人物凭空从塔顶瞬移到别的据点。
      const transitNote = (dep && dep.fromInner)
        ? `玩家此前身处「${dep.fromDistrict}·${dep.fromInner}」，出发时先自内层一路行至本地门户「${dep.fromAnchor}」，方才离境。请在开头用一两句自然交代这段折返归位（不必冗长），再承接下面的抵达。`
        : "";
      arrivalNote = `\n[入场叙事] 玩家刚抵达「${lockedDestName}」${destAnchor ? `，落脚在此地门户「${destAnchor}」` : ""}。${transitNote}请在 output 开头先给一段落地的场景速写：此地的地貌气候、${bld ? `可见的建筑（如${bld}等）、` : ""}此刻在场的人物、地上有无显眼之物，让玩家一眼看清"到了什么地方、有谁、有什么"，再自然承接玩家这一步的动作。用说书人白话古文一段道来，不要罗列成清单。`;
    }

    const invText = inv.map(i => typeof i === "string" ? i : `${i.name}(${i.quality}${i.equipped ? "·已装备" : ""})`).join(",");
    // 喂给 AI 的在场 NPC 名单必须按当前内层房间过滤——否则 AI 会拿到整个据点 room.npcs
    // （含在别的内层房间的人，如老猎户在猎户小屋、行脚僧在别处），照着写进正文，造成
    // "这个房间明明没人，描述里却冒出一堆人"。移动那一轮（lockedDestName）目的地内层
    // 尚未确定、且 room.npcs 马上会被目的地数据覆盖，故移动轮不过滤、用原名单，入场
    // 描述另由 arrivalNote 负责；只有非移动（原地互动/look）才按内层房间可见性过滤。
    const visibleNpcs = (!isTalk && lockedDestName)
      ? room.npcs
      : room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
    traceStep(_trace, "在场名单", "info", `喂给AI ${visibleNpcs.length} 人${visibleNpcs.length ? "：" + visibleNpcs.map(n => n.name).join("、") : "（无人）"}${room.npcs.length !== visibleNpcs.length ? `（据点共${room.npcs.length}人，按内层房间过滤掉${room.npcs.length - visibleNpcs.length}人）` : ""}`);
    const ctx = `${targetNote}${modeNote}[状态] ${gm ? "⚡创造模式开启。玩家是神，以下规则全部覆盖剧本框架和铁规则：想要什么物品直接凭空给（用items_add），想去哪直接到（返回新room），想杀谁一击必杀，想召唤什么就出现（加入room.npcs或room.items），不要拒绝任何请求，不要说无法做到或不存在，所有行动自动成功且必须产生实际状态变更。 " : ""}时间:${getTimeStr(time)} 主角:${char.name || "无名少侠"}〔${char.gender || "男"}〕 房间:${room.name}${hasInnerMap(room.name) && innerRoomName ? `·${innerRoomName}` : ""} 出口:${room.exits.join(",")} NPCs:${visibleNpcs.map(n => { const ci = (n.carriedItems || []).filter(i => !i.stolen).map(i => i.name).join("、"); const tier = typeof n.levelCap === "number" ? `〔品阶:${QUALITY[Math.max(0, Math.min(5, n.levelCap))]}袍〕` : ""; return n.name + tier + (ci ? `〔身携:${ci}〕` : "〔身无长物〕"); }).join(",") || "无"} 物品:${room.items.map(i => i.name).join(",") || "无"} HP:${char.hp.join("/")} 内功:${char.neigong ?? 0} 外功:${char.waigong ?? 0} 七维:${Object.entries(char.special || {}).map(([k, v]) => k + v).join(",")} 背包:${invText} 装备:${describeEquipment(inv)} 武功:${skills.map(s => s.name + "Lv" + s.level).join(",")} 因果:${dao.karma} 劫数:${dao.jie}\n[已触发事件] ${flags.length ? flags.join(",") : "无"}${pickupNote}${destinationLock}${angryNote}${emergenceNote}${encounterNote}${questStageNote}${collectNote}${arrivalNote}${forcedEventNote}`;
    // 对话模式取更长的历史窗口（至少 20 层全部互动）——聊天比行动更依赖前后文的来回照应；
    // 行动模式沿用用户配置的窗口。convo 里本就混装了行动/对话/私聊三类回合，但私聊是玩家
    // 与"旁白"这个第四面墙外角色的私密对话，普通场景 NPC 不该知道这些内容（反过来，旁白
    // 全知是通过 allFactSummaries 单独喂给她的，两条渠道不能对调）。这里过滤掉私聊回合，
    // 只留行动/对话回合喂给主引擎。
    // 结算轮只需最近几句维持语气连贯，不需要长程上下文（这一轮不做任何博弈判断）。
    const histWindow = isSettle ? 6 : isTalk ? Math.max(apiCfg.contextWindow, 20) : apiCfg.contextWindow;
    const mainConvo = newConvo.filter(m => !(typeof m.content === "string" && (m.content.startsWith("（私聊）") || m.content.startsWith("（旁白私聊回应）"))));
    const hist = (mainConvo.length > histWindow ? mainConvo.slice(-histWindow) : mainConvo).map(m => (m.role === "user" ? "[玩家] " : "[引擎] ") + m.content).join("\n");

    // ── 场景 NPC 世界书（按"在场/被提及"动态注入人设，不再每轮全发）──
    // 触发三源：当前 room.npcs（在场）+ 玩家本轮输入 + 上轮引擎回复。命中谁才注入谁的人设。
    // 合并两处人设来源：preset.npcLore（旧的6个已建档角色+老猎户/行脚僧）
    // + residentNpcs.js的24人固定驻场NPC（getAllResidentNpcLore转换成
    // 兼容格式）——之前这24人写了fullBio却没接进这套注入机制，是死数据，
    // 现在统一走同一条matchNpcLore判断逻辑，不用改matchNpcLore本身。
    const lastAiText = [...convo].reverse().find(m => m.role === "assistant")?.content || "";
    const combinedNpcLore = [...(preset.npcLore || []), ...getAllResidentNpcLore()];
    // 只有真正的对话场景才需要"上一轮回复提到谁"这个信号（NPC刚说"我那侄子
    // 阿福在磨坊"，玩家紧接着追问阿福是谁）。查看/端详间隙的行动/移动/战斗/
    // 结算/调查这些跟对话无关的动作，不该被上一轮叙事（尤其是篇幅长、人名多
    // 的战斗战报）的用词殃及——否则会出现"上一轮切磋战报提过的人，这一轮
    // 随便做点什么不相干的事都被拽出来插一脚"的串场穿帮。isTalk 已经区分了
    // 对话/非对话两条路，这里直接复用。
    const npcLoreBlock = buildNpcLoreBlock(
      matchNpcLore(combinedNpcLore, {
        roomNpcNames: visibleNpcs.map(n => n.name),
        userInput: cmd,
        lastReply: lastAiText,
        includeLastReply: isTalk,
      })
    );

    // ── 在场NPC任务状态注入 ──
    // 之前questProgress只是个纯数值state，从未被拼进对话prompt——AI跟
    // NPC对话时完全不知道玩家的任务进度，表现得好像"你刚接了他的任务，
    // 回头跟他说话，他跟没事人一样"。这里反查当前在场每个NPC，看
    // QUCUO_QUESTS里giver是他的任务，玩家目前是什么状态，拼成简短文字
    // 注入prompt，AI才能据此调整台词（比如"任务进行中"该催问进度，
    // "已完成"该表达感谢，而不是从头再问一遍）。
    // 兼容两套历史遗留的状态字段命名：一部分任务用status:"active"/
    // "completed"，另一部分（护镖/悬赏类）用active:true/false，两者
    // 都要覆盖到，不能只认一种，否则会漏掉一半任务类型的进度信息。
    const roomNpcNamesForQuest = room.npcs.map(n => n.name);
    const questStatusLines = [];
    for (const quest of QUCUO_QUESTS) {
      if (!quest.giver || !roomNpcNamesForQuest.includes(quest.giver)) continue;
      const prog = questProgress[quest.id];
      if (!prog) continue; // 玩家还没接触过这个任务，没有状态可说
      const isDone = prog.status === "completed";
      const isActive = prog.status === "active" || prog.active === true;
      if (isDone) {
        questStatusLines.push(`${quest.giver}交代的「${quest.title}」玩家已经完成过`);
      } else if (isActive) {
        questStatusLines.push(`${quest.giver}交代的「${quest.title}」玩家正在进行中，尚未交付`);
      }
    }
    const questStatusBlock = questStatusLines.length
      ? `\n\n【在场人物与玩家的任务关系】（据此调整台词语气，已完成的该表达感谢/推进后续，进行中的该关心进度而非从头重复交代）\n${questStatusLines.join("\n")}`
      : "";
    const npcLoreBlockWithQuest = npcLoreBlock + questStatusBlock;

    // ── 久别重逢·记忆断层（本轮新增）──
    // 本轮在场者里，凡已认识、且距上次同框超过阈值的，提示 AI 补写这段时间的合理变化，
    // 免得人物像时间静止。纯本地时间戳判定，无副作用。
    const reunionBlock = buildReunionBlock(
      detectReunions(varTreeRef.current, room.npcs, time, REUNION_GAP_THRESHOLD)
    );

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

    // ── 信息领域·知识系统（代码驱动，本轮新增）──
    // 每回合由代码确定性推演"谁知道什么"：同框传播 + 传闻淡忘（见 knowledge.js）。
    // 推演产物是"待补摘要"——在场者涉及、但账上还没有一句话描述的事实。此时才把 AI 当
    // 工具点一下：发一个独立小 prompt 要一句话，收回来存进账里（agents 式：代码调度，AI 填词）。
    // 最后据此账生成【信息域】硬约束块注入主剧情，让 NPC 言行严格符合各自知情状态。
    // 推演结果写回 varTree（本回合状态的一部分，失败会随整体回滚）。
    let infoDomainBlock = "";
    {
      const roomNpcNames = room.npcs.map(n => n.name);
      // 必须读 ref 里的最新 varTree：哪怕 act 是旧闭包（切磋结算后 setTimeout 调来的），
      // evolveKnowledge 也基于最新状态推演——否则推演结果整体覆盖写回时会把刚进账的
      // 认识/好感度更新冲掉（"交情已加但仍显示尚未认识"bug 的根源，见 varTreeRef 注释）。
      const evo = evolveKnowledge(varTreeRef.current, { roomNpcNames, currentTurn: time });
      let kTree = evo.varTree;
      // 按需补摘要（最多 2 条/回合，失败静默——摘要非关键，不阻断游戏）
      // 内容层优先从向量库召回真旧事据以归纳；召不回才让 AI 现编兜底。
      for (const fid of evo.待补摘要.slice(0, 2)) {
        try {
          // 1) 先拿事实名当查询词，去现成向量库召回相关的真旧事
          let recallTexts = [];
          if (embeddingReady(apiCfg)) {
            const rc = await recallWithVisibility({
              cfg: apiCfg, queryText: fid, contextText: "",
              focusEntities: [], unlockedFlags: flags, topK: 3,
            });
            recallTexts = (rc?.visible || []).map(v => v.text).filter(Boolean);
          }
          // 2) 有命中→据素材归纳（有据不瞎编）；无命中→纯现编兜底
          const req = recallTexts.length
            ? factSummaryRequestFromRecall(fid, recallTexts)
            : factSummaryRequest(fid);
          const r = await callModel(apiCfg, req.system, req.messages, { maxTokens: apiCfg.callTokenLimits?.knowledge ?? req.maxTokens, callLabel: "事实摘要" });
          const line = (r.text || "").trim().split("\n")[0].slice(0, 40);
          if (line) kTree = setFactSummary(kTree, fid, line);
        } catch (_) { /* 补词失败就留空，下回合再试 */ }
      }
      infoDomainBlock = buildInfoDomainBlock(kTree, roomNpcNames);
      setVarTree(kTree); // 持久化本回合推演（后续 setVarTree(prev=>...) 基于此叠加）
    }

    // ── 三层记忆·向量召回层（请求段，无副作用）──
    // 从长期记忆库里捞出与"当前这句输入 + 当前情境"语义相关、但可能早已滑出最近对话窗口的旧事，
    // 拼成一段 RecalledMemories 注入 prompt，让 AI"想起"窗口外的伏笔/承诺/旧账。
    // 双路查询：Q_intent=玩家这句话；Q_context=上轮引擎回复 + 当前位置/在场人物。
    // 全程降级安全：没开向量开关或召回失败，recallInfo 为 null，这段完全不影响后续流程。
    let recallInfo = null;
    let recallBlock = "";
    if (embeddingReady(apiCfg)) {
      // 召回前对账（后台自愈，不阻塞本轮）：把换模型后指纹过期、召不回的老纸条重算向量写回。
      // 有界(每回合最多几条)，逐回合把库里过期纸条慢慢补齐，不影响本轮召回时序。
      reembedStaleNotes({ cfg: apiCfg }).catch(() => {});
      const focusEntities = Array.from(new Set([
        ...room.npcs.map(n => n.name),
        ...Object.keys(varTreeRef.current.角色 || {}),
        room.name,
      ]));
      recallInfo = await recallWithVisibility({
        cfg: apiCfg,
        queryText: cmd,
        contextText: `${lastAiText}\n[当前]位置:${room.name} 在场:${room.npcs.map(n => n.name).join("、") || "无"}`,
        focusEntities,
        unlockedFlags: flags,
        presentNames: Array.from(new Set([...room.npcs.map(n => n.name), ...(activeTarget ? [activeTarget] : []), ...(isTalk && talkTarget ? [talkTarget] : [])])),
        topK: 5,
      });
      if (recallInfo && recallInfo.visible.length) {
        recallBlock = "\n\n[往事·与此刻情形相关的旧记忆，可能不在最近对话里，供你行文时自然照应，不要生硬复述]\n"
          + recallInfo.visible.map(m => {
            // 强相关给全文，弱相关只给截断摘要（强/弱回忆分层）
            const line = m.tier === "weak" && m.text.length > 40 ? m.text.slice(0, 40) + "…" : m.text;
            return `· （第${m.meta.turn}回合）${line}`;
          }).join("\n");
      }
    }

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

      // 解析一次原始返回 → { p, mvuCommands }；p._truncated 表示只救回了部分完整行。
      const parseMainResponse = (rawText) => {
        // 赌石谈价：先抠出末尾 <deal>{...}</deal> 结算标签（在 JSON 解析之前，因它是 JSON 外的尾巴），
        // 抠完把标签从文本里剔除，剩下的照常走主叙事解析。
        let dealResult = null;
        let rawForParse = rawText;
        const dealMatch = typeof rawText === "string" && rawText.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
        if (dealMatch) {
          try { dealResult = JSON.parse(dealMatch[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch (_) { dealResult = null; }
          rawForParse = rawText.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
        }
        const { cleanText: raw, commands } = extractMvuBlock(rawForParse);
        let js = raw.replace(/```json\s*|```\s*/g, "").trim();
        const i0 = js.indexOf("{"), i1 = js.lastIndexOf("}");
        if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
        js = js.replace(/\r?\n/g, " ").replace(/[\x00-\x1f]/g, " ");
        js = cleanJsonString(js);
        let parsed;
        try { parsed = JSON.parse(js); } catch (_) {
          const nm = js.match(/"output"\s*:\s*\[(.*?)\]/s);
          if (nm) { try { parsed = { output: JSON.parse("[" + nm[1] + "]") }; } catch (__) { parsed = null; } }
          // 截断救援：从 "output":[ 之后只抓闭合完整的字符串，丢掉末尾半句
          if (!parsed) {
            const oi = js.search(/"output"\s*:\s*\[/);
            if (oi >= 0) {
              const after = js.slice(js.indexOf("[", oi) + 1);
              const strs = after.match(/"(?:[^"\\]|\\.)*"/g);
              if (strs && strs.length) { try { parsed = { output: strs.map(s => JSON.parse(s)), _truncated: true }; } catch (__) { parsed = null; } }
            }
          }
          if (!parsed) {
            const nm2 = js.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (nm2) { parsed = { output: [nm2[1]] }; }
          }
          if (!parsed) {
            const clean = (raw || "").trim();
            // 区分两种"没解析出 JSON"：
            //   ① AI 干脆没写 JSON，直接吐了一句纯文本——通常是"打断拒答"（玩家问系统元问题时，
            //      narrator.js 要求只回一句、本轮到此为止）或纯口语应答。原始返回里根本没有 '{' 或
            //      "output" 的痕迹，说明这不是坏掉的 JSON、是 AI 有意为之。截断的 JSON 一定以 '{' 开头
            //      （截的是尾巴不是头），所以"完全没有 '{'"能可靠地把这两种情况分开。这种直接当作干净
            //      的旁白正文展示，不加"格式异常"吓人（此前会把一句正常的打断硬套上错误前缀）。
            //   ② 确实是残缺/畸形的 JSON（有 '{' 或 "output" 碎片但拼不出来）——保留"格式异常"提示 + 原文供排查。
            const looksLikeBrokenJson = /[{}]|"output"\s*:/.test(clean);
            if (clean && !looksLikeBrokenJson) {
              parsed = { output: clean.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 6) };
            } else if (clean) {
              parsed = { output: [`（引擎回应格式异常，原始内容）${clean.slice(0, 300)}`] };
            } else {
              parsed = { output: ["（旁白一时语塞，似是被这荒僻之地的信号阻隔——可重新输入试试，或打开「📋 Pipeline」查看这次请求究竟发生了什么）"] };
            }
          }
        }
        return { p: parsed, mvuCommands: commands, dealResult };
      };

      // 调用一次主剧情（流式/非流式），返回 { rawFull, finishReason }。流式占位日志每次调用各自管理。
      // narrativeOnly=true：提取层模式，主调用只输出散文；流式时将文本直接展示并保留在日志里。
      const callMainOnce = async (extraNudge, narrativeOnly = false) => {
        const cmdSuffix = narrativeOnly ? "处理最新命令，直接输出叙事正文。" : "处理最新命令。纯JSON，字符串不换行。";
        // 成文铁律放在 user 块最末尾（酒馆语义里插入深度=0、贴着生成处的最强位，
        // 见 ST prompt-manager：Depth 0 = 提示末尾 = 最强）。文体规则若埋在 system 里
        // 位置太靠前、常被模型当耳旁风，这条挪到最低深度逼它逐段照做。
        const proseRule = "\n\n【成文铁律·逐段自查（本条最优先，落笔前先过一遍）】每写完一段，先在心里核两样再往下写：其一，这一段每个句子都要是完整句——主谓宾齐全、该带的定状补都补上，不许出现半截话、掐头去尾、省略到看不明白的残句；其二，这一段凡涉及到的，时间、地点、人物、起因、经过、结果都要交代到实处（这一段确实用不上的那几样可以不写，但只要沾边就得写全，不许用『那人』『某处』『后来』这类含糊词一笔带过）。宁可句子写得实、写得满，也绝不为省字丢主语宾语或掐断句子。";
        // 远景（日总结）作背景垫底，放在 ctx 之后、回忆之前——比"最近对话/回忆"更靠前=分量更轻，
        // 只保连贯不喧宾夺主。
        const distantBlock = buildDistantViewBlock(varTreeRef.current, 5);
        let userContent = ctx + distantBlock + recallBlock + reunionBlock + infoDomainBlock + "\n\n" + hist + proseRule + "\n\n" + cmdSuffix + (extraNudge || "");
        // 动态注入 scope：结算轮只演既定事实（砍物件志/认知隔离/远景/极简schema），移动只喂场景相关，
        // 对话保留认知隔离，其余全量。创造模式必须全量（要能凭空发物品/召唤NPC），故 gm 时强制 full。
        const promptScope = gm ? "full"
          : isSettle ? "settle"
          : isTalk ? "talk"
          : intent.code === "MOVE" ? "move"
          : intent.code === "LOOK" ? "talk"  // 查看/环顾：只描述当前场景与在场人物，不发物品，砍物件志（同 talk 档）
          : "full";
        // 结算轮：远景/召回/信息域灭灯——这一轮只是把一件已定的事写好看，不需要"记起往事"
        // 或"守信息域"，那些块是给有博弈的轮次用的。但牵涉具体某人时保留「重逢」块
        // （久别重逢那句招呼要认得人，是这类轮次唯一真正用得上的记忆信号）。
        if (isSettle) {
          userContent = ctx + (opts.settleNpc ? reunionBlock : "") + "\n\n" + hist + proseRule + "\n\n" + cmdSuffix + (extraNudge || "");
        }
        let _gateReport = null;
        let sys = buildSysBase(
          apiCfg.targetWordCount, narrator, preset.scenario, budgetInstruction,
          // 结算轮灭 lore——但牵涉具体某人的结算（送礼/拜师/赌石成交）仍要人设，
          // 否则那人只剩个名字，写出来的对白没脾气。此时保留 lore（本就是绿灯，只注入在场者）。
          embeddingReady(apiCfg), (isSettle && !opts.settleNpc) ? "" : npcLoreBlockWithQuest, narrativeOnly, promptScope,
          {
            settleNpc: opts.settleNpc || null,
            settleKind: opts.settleKind || null,
            giftInfo: opts.giftInfo || null,
            hasNpc: visibleNpcs.length > 0,
            gm,
            playerName: char.name || "主角", // memory摘要统一用这个称呼，不用你/我，避免人称混乱
            // 物件志（批四）：只有本轮真可能发出物品才挂——移动拾取命中/战斗/创造模式。
            mayGrantItem: gm || intent.code === "COMBAT" || !!pickupJudgmentRef.current,
            // scenario 绿灯扫描源（批三）：玩家本轮输入 + 上轮引擎回复，等同酒馆"扫描深度2"。
            // 战斗轮把 scope 记作 combat，好让装备掉落规则那条按状态点灯。
            gateCtx: gm ? null : {
              scope: intent.code === "COMBAT" ? "combat" : promptScope,
              userInput: cmd,
              lastReply: [...convo].reverse().find(m => m.role === "assistant")?.content || "",
            },
            onGateReport: (g) => { _gateReport = g; },
          }
        ) + (nsfwOn ? "\n" + NSFW_RULES : "");
        // ── 体貌·蓝绿灯 ──
        // 公开层跟着"这一轮有没有人近距离看着你"走（full/talk 亮，赶路结算灭），
        // 私密层只认 ■ 模式。灭灯不只是省 token——赶路轮塞一段私处描写，模型真的会
        // 顺着那个方向写。详见 bodyProfile.js 顶部。
        const _bodyGate = gateBodyProfile(char.bodyProfile, {
          scope: promptScope,
          nsfw: nsfwOn,
          scanText: `${cmd}\n${[...convo].reverse().find(m => m.role === "assistant")?.content || ""}`,
        });
        if (_bodyGate.text) sys += _bodyGate.text;
        if (_bodyGate.lit.length || _bodyGate.dark.length) {
          traceStep(_trace, "体貌", "info",
            `🟢${_bodyGate.lit.join("、") || "无"}　⚫灭:${_bodyGate.dark.join("、") || "无"}`);
        }
        // ── 赌石谈价·轻量挂载（借世界书"蓝灯/绿灯"思路：谈价这轮，重量条目全灭灯）──
        // 谈价是一对一、目标单一的对手戏，之前却挂着全量 talk 档（预设全文+在场全员lore+任务+
        // 认知隔离+远景/召回/重逢/信息域+20条历史+MVU），一轮砍价烧掉整套世界书。现在仿
        // inspectItem 的轻：sys/userContent 整体换成"文风+这一位竞价者的人设+石头局面+<deal>
        // 结算规则+近8条对话"。S2 convo/S3 小纸条/S4 账本照旧落（p.memory 仍写），记忆链不断。
        if (isTalk && gambleTalkCtx.current) {
          const g = gambleTalkCtx.current;
          const pers = g.persona || {};
          const dealWords = Math.min(apiCfg.targetWordCount || 220, 220);
          const dealFmt = narrativeOnly
            ? `直接输出对白叙事正文（散文），写完即止。若这一轮谈成了明确协议（对方加价/让价/搭赠物件），在正文最末尾另起一行附：<deal>{"priceMult":1.0,"addItem":null}</deal>；没谈成就不附。`
            : `回复纯JSON，字符串不换行：{"output":["行1","行2"],"memory":"≤50字本轮谈价关键事实（无实质进展可省略此字段）"}
若这一轮谈成了明确协议（对方加价/让价/搭赠物件），在 JSON 之后另起一行附：<deal>{"priceMult":1.0,"addItem":null}</deal>；没谈成就不附标签。`;
          sys = `你是曲措乡这个武侠世界的说书人。此刻玩家在天都镇玉石料场的赌桌前，与竞价者「${g.bidderName}」就一块开出的玉料讨价还价——这是一场一对一的砍价对手戏，只演这一件事。

[这位竞价者]
${g.bidderName}${pers.brief ? `，${pers.brief}` : ""}。${pers.personality || ""}
${pers.bio || ""}
随身可搭赠之物：${(g.carry || []).map(i => i.name || i).join("、") || "无"}

[局面] ${g.scene || "赌桌上一块开出的玉料"}。${g.bidderName}当前报价约 ${g.baseOffer || "?"} 两（兜里现银上限 ${g.cash || "?"} 两）。

[砍价规则] 按其性格接招：玩家说得在理便松口，胡搅蛮缠便顶回去，也可主动搭赠随身物件促成交易；不要一轮就把价谈死，留出拉扯余地。本轮不改变房间/物品/任何游戏状态，只有对白、神态与心思。
对话用「」包裹，旁白叙述不加标记，心理用*斜体*。总字数约 ${dealWords} 字。

[结算标签说明] priceMult 是对原报价 ${g.baseOffer || "?"} 两的倍率（对方肯多出→>1，让利→<1，没谈拢→1.0；系统只认 0.8~1.5，超出无效）；addItem 只能填其随身确有且愿搭的物件名，否则填 null。标签只给系统看，玩家看不到。

${dealFmt}`;
          const dealHist = mainConvo.slice(-8).map(m => (m.role === "user" ? "[玩家] " : "[引擎] ") + m.content).join("\n");
          userContent = `[最近对话]\n${dealHist}\n\n处理最新命令${narrativeOnly ? "，直接输出叙事正文。" : "。纯JSON，字符串不换行。"}${extraNudge || ""}`;
        }
        const _scopeLabel = (isTalk && gambleTalkCtx.current) ? "谈价·轻量"
          : ({ settle: "结算·轻量", move: "移动·精简", talk: "对话·中", full: "全量" }[promptScope] || promptScope);
        const _scopeWhy = _scopeLabel === "谈价·轻量" ? "，已砍预设/世界书/lore/召回/远景/MVU，仅留人设+局面+近8条对话"
          : promptScope === "settle" ? `，已砍物件志/认知隔离/lore/远景/召回/全量schema${opts.settleNpc ? `（保留MVU：牵涉${opts.settleNpc}）` : "/MVU"}`
          : promptScope === "move" ? "，已砍物件志/认知隔离/复杂schema/拓扑外的世界观"
          : promptScope === "talk" ? "，已砍物件志/拓扑与装备规则" : "";
        traceStep(_trace, "Prompt注入", "info", `级别=${_scopeLabel}（system ${sys.length}字${_scopeWhy}）`);
        // 调用模式标注：单调用/双调用是两条完全不同的 prompt 结构（前者主模型直接
        // 出JSON+MVU，后者主模型只写散文、好感度等状态判定全部转交提取层的另一
        // 个模型），排查"好感度怎么没变/怎么变得莫名其妙"时第一步就该确认走的
        // 是哪条路、双调用时具体是哪个模型在判——不写清楚，排查者会误以为
        // 主模型和判定好感度的模型是同一个。
        if (apiCfg.extractionEnabled) {
          const exCfg = buildExtractionCfg(intent.code, apiCfg);
          traceStep(_trace, "调用模式", "info",
            `双调用（叙事/状态分离）　主叙事模型=${apiCfg.model || "未设置"}　提取模型(意图=${intent.code})=${exCfg.model || "未设置"}${exCfg.model === apiCfg.model ? "（未单独配置，沿用主模型）" : ""}`);
        } else {
          traceStep(_trace, "调用模式", "info", `单调用（叙事+状态一次性产出）　主模型=${apiCfg.model || "未设置"}`);
        }
        // 世界书点灯明细：🟢亮了哪条（被什么词/哪个状态点亮）、⚫灭了哪条。排"AI 怎么不知道 X"用。
        if (_gateReport && (_gateReport.lit.length || _gateReport.dark.length)) {
          traceStep(_trace, "世界书·总纲", "info",
            `🟢${_gateReport.lit.join("、") || "无"}　⚫灭:${_gateReport.dark.join("、") || "无"}`);
        }
        // 把当前激活的 Chat Completion 预设里配置的采样参数（temperature/maxTokens/
        // topP/topK/frequencyPenalty/presencePenalty）融合进这次调用的 cfg——只有预设
        // 里显式配置过（非 null）的字段才覆盖，其余沿用 apiCfg 原有的全局设置。
        // 主叙事这一路是唯一真正受"叙事风格采样参数"影响的调用点，私聊旁白/方向判定
        // /提取层等辅助调用不套用这份覆盖，避免预设改动意外影响到不相关的小任务。
        const effectiveCfg = applyPresetOverrides(apiCfg, getActivePreset());
        if (effectiveCfg.streamEnabled && effectiveCfg.apiType !== "gemini") {
          const streamLogIndex = { current: null };
          addLog([{ t: "desc", text: "  ▌", streaming: true }]);
          setLog(l => { streamLogIndex.current = l.length - 1; return l; });
          const { text, finishReason } = await callModelStream(
            effectiveCfg, sys,
            [{ role: "user", content: userContent }, ...(nsfwOn ? MODE_PRIMER_MESSAGES : [])],
            (_delta, fullSoFar) => {
              setLog(l => {
                if (streamLogIndex.current == null) return l;
                const copy = [...l];
                // 叙事模式：直接展示散文文本；JSON模式：只看最后200字（避免长 JSON 刷屏）
                copy[streamLogIndex.current] = { t: "desc", text: "  " + (narrativeOnly ? fullSoFar : fullSoFar.slice(-200)) + " ▌", streaming: true };
                return copy;
              });
            },
            { intent: { code: intent.code, label: intent.label }, recallInfo },
          );
          if (narrativeOnly) {
            // 叙事模式：把流式条目转为永久日志项（而不是移除它）。谈价 <deal> 标签仅供系统，显示时剥掉。
            const shown = text.replace(/<deal>[\s\S]*?<\/deal>/gi, "").replace(/<deal>[\s\S]*$/i, "").trim();
            setLog(l => {
              if (streamLogIndex.current == null) return l;
              const copy = [...l];
              copy[streamLogIndex.current] = { t: "desc", text: "  " + shown, streaming: false };
              return copy;
            });
          } else {
            // JSON 模式：移除占位条目（正式 output 会在解析后追加）
            setLog(l => (streamLogIndex.current == null ? l : l.filter((_, i) => i !== streamLogIndex.current)));
          }
          return { rawFull: text, finishReason };
        }
        const result = await callModel(effectiveCfg, sys, [{ role: "user", content: userContent }, ...(nsfwOn ? MODE_PRIMER_MESSAGES : [])], { intent: { code: intent.code, label: intent.label }, recallInfo, callLabel: "主叙事" });
        return { rawFull: result.text, finishReason: result.finishReason };
      };

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
        const _exCfgForTrace = buildExtractionCfg(intent.code, apiCfg); // 仅供trace显示模型名，实际提取调用在下面callExtraction内部会重新算一份等价的cfg
        let mainFinishReason;
        for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
          try {
            const r = await callMainOnce(null, true);
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
        };
        // 结算轮专属场景（送礼settleKind:"gift"、伙伴认主settleKind:"companion_invite"）
        // 传 settleOpts，让 callExtraction 切到对应的专属提取spec——不走"从叙事读心
        // 倒推状态变不变"那套通用逻辑，直接钉死结论（送礼必给正向好感、认主必给较高
        // 初始好感）。避免双调用模式下状态判定完全脱离 buildSysBase 那份专属铁律
        // （主叙事只写散文，不产 mvu，状态判定全靠提取层）。
        const settleOptsForExtraction = (opts.settleKind && opts.settleNpc)
          ? { settleKind: opts.settleKind, settleNpc: opts.settleNpc, giftInfo: opts.giftInfo }
          : null;
        const extracted = await callExtraction(intent.code, rawFull, exState, apiCfg, settleOptsForExtraction).catch(e => {
          addLog([{ t: "sys", text: `  ⚠ 提取层调用失败（${e.message || e}），本轮状态未更新` }]);
          traceStep(_trace, "提取调用", "fail", `提取模型=${_exCfgForTrace.model || "未设置"}调用异常：${e.message || e}，本轮状态未更新`);
          return null;
        });
        if (extracted?.parseFailed) {
          addLog([{ t: "sys", text: `  ⚠ 提取层返回的不是合法JSON（可能被截断或模型没按格式输出），本轮状态未更新` }]);
          traceStep(_trace, "提取调用", "fail", `返回内容无法解析（提取模型=${_exCfgForTrace.model || "未设置"}），本轮状态未更新`);
        } else if (extracted) {
          traceStep(_trace, "提取调用", "pass", `状态提取完成（提取模型=${_exCfgForTrace.model || "未设置"}${settleOptsForExtraction ? `·${settleOptsForExtraction.settleKind}专属spec` : ""}）`);
        }
        p = extracted?.p || {};
        mvuCommands = extracted?.mvuCommands || [];
      } else {
        // ── 原有单调用模式（默认）──
        for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
          const nudge = attempt > 1
            ? "\n\n（注意：上一次回复未能输出完整闭合的 JSON。请确保本次输出一个语法完整、正常闭合收尾的 JSON，不要中途断开。）"
            : "";
          let finishReason;
          try {
            const r = await callMainOnce(nudge);
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

      // ── 系统采纳的在场名单（提前算，供好感度过滤 + 新面孔检测共用）──
      // 判据同下方新面孔检测：移动到缓存目的地取 cached.npcs，否则取当前 room.npcs，
      // 涌现登场的人(emergedNpcName)算合法新增。AI 凭空报的名字不在此列。
      const _movingToCached = lockedDestName ? roomMapRef.current[lockedDestName]
        : (p.room?.name && p.room.name !== room.name ? roomMapRef.current[p.room.name] : null);
      const _systemBaseNpcs = _movingToCached?.npcs || room.npcs || [];
      const systemAcceptedNames = new Set(_systemBaseNpcs.map(n => n.name));
      if (p.emergedNpcName) systemAcceptedNames.add(p.emergedNpcName);
      // 已在 varTree.角色 里有记录的人（历史交互过的、驻场登记的）也算数——他们是
      // 系统认可的真实角色，即便此刻 AI 没把他们列进本轮在场名单，对他们的好感度
      // 变化仍是合法的（比如飞鸽传书、隔空事件）。只拦"系统从来不认识"的纯幽灵。
      const _knownChars = new Set(Object.keys(varTreeRef.current.角色 || {}));

      if (mvuCommands.length) {
        // 好感度反幽灵过滤：AI 若对一个"既不在系统在场名单、也不在已知角色表"里的
        // 名字开好感度（开局旁白顺口报的假村民就是这样），把这条 MVU 指令丢掉——
        // 不建角色节点、不刷好感度、不打 💗 字幕。真实在场者与历史已知角色不受影响。
        mvuCommands = mvuCommands.filter(cmd => {
          const m = /^角色\.([^.]+)\.好感度$/.exec(cmd.path || "");
          if (!m) return true; // 非好感度指令，放行
          const who = m[1];
          if (systemAcceptedNames.has(who) || _knownChars.has(who)) return true;
          console.warn(`[反幽灵] 忽略对非在场/未知角色「${who}」的好感度指令`);
          return false;
        });
      }
      if (mvuCommands.length) {
        setVarTree(prev => {
          const { tree, applied, rejected } = applyMvuCommands(prev, mvuCommands, { charm: effectiveSpecialNow?.魅力 ?? 5 });
          if (rejected.length) console.warn("MVU 指令被系统裁决拒绝：", rejected);
          const affectionChanges = applied.filter(c => c.path.endsWith(".好感度") && (c.op === "add" ? c.actualDelta : true));
          if (affectionChanges.length) {
            addLog(affectionChanges.map(c => {
              const name = c.path.split(".")[1];
              const delta = c.op === "add" ? c.actualDelta : null;
              const text = delta != null
                ? `  💗 ${name} 好感度 ${delta > 0 ? "+" : ""}${delta}（→ ${c.finalValue}）`
                : `  💗 ${name} 好感度 → ${c.finalValue}`;
              return { t: "affection", text };
            }));
          }

          // "生气解除" 是一个信号字段，不是真正要存的数据——AI通过它告诉系统
          // "这次嘴辩说服成功了"，系统裁决层据此清空该角色真正的生气状态对象，
          // 并删掉这个临时信号字段本身，避免它留在 varTree 里污染数据。
          const resolvedNames = applied
            .filter(c => c.path.endsWith(".生气解除") && c.finalValue === true)
            .map(c => c.path.split(".")[1]);
          let finalTree = tree;
          if (resolvedNames.length) {
            const nextChars = { ...finalTree.角色 };
            for (const name of resolvedNames) {
              if (nextChars[name]) {
                const { 生气解除, ...rest } = nextChars[name];
                nextChars[name] = { ...rest, 生气状态: { active: false, resolvedBy: "persuasion" } };
              }
            }
            finalTree = { ...finalTree, 角色: nextChars };
            addLog(resolvedNames.map(name => ({ t: "affection", text: `  ✓ ${name}的怒气已经消解，这场风波算是揭过去了。` })));
          }
          return finalTree;
        });
      }

      // ── 赌石谈价结算（轻量勾连）──
      // 若这轮在谈价语境、且 AI 回了 <deal> 标签：系统 clamp 倍率 + 校验赠物，
      // 把调整后报价写进 gambleNegotiation[stoneId][bidderName]，赌桌读它更新报价、按新价结算。
      // 数值全由系统裁决（settleNegotiation clamp[0.8,1.5]），AI 越权无效。
      if (dealResult && gambleTalkCtx.current) {
        const ctx = gambleTalkCtx.current;
        const baseOffer = ctx.baseOffer || 0;
        const settled = gambleSettleNegotiation(
          { offer: baseOffer, cash: ctx.cash || Infinity },
          dealResult,
          ctx.carry || []
        );
        if (ctx.stoneId && ctx.bidderName && settled.finalOffer !== baseOffer) {
          setGambleNegotiation(prev => ({
            ...prev,
            [ctx.stoneId]: { ...(prev[ctx.stoneId] || {}), [ctx.bidderName]: settled.finalOffer },
          }));
          const diff = settled.finalOffer - baseOffer;
          addLog([{ t: "affection", text: `  🤝 谈妥了：${ctx.bidderName} 的出价 ${diff > 0 ? "抬到" : "变为"} ${settled.finalOffer} 两${settled.addItem ? `，另搭「${settled.addItem.name || settled.addItem}」` : ""}。回赌桌可按此价结算。` }]);
        }
      }
      // 谈价这轮处理完就清标记（下一句普通对话不再当谈价）
      if (gambleTalkCtx.current) gambleTalkCtx.current = null;

      // AI 依然承担"判断玩家这轮行为是否达成了某个任务节点"这件事（通过
      // 一如既往地在 delta.flags_add 里吐出对应的 completionFlag），但一旦
      // 判定命中的这个节点在 questScripts.js 里登记了固定台本，这一轮
      // 展示给玩家的文字就不再用AI自己写的 p.output，而是原样展示设计
      // 文档里的完整原文——AI 这一轮的"生成"实际上只被当作触发判定用，
      // 生成的正文本身被完全丢弃不展示。只要命中，就整体替换（不跟AI的
      // output 拼接），避免AI现场编的文字和固定台本的文风混在一起显得突兀。
      // 一次AI返回可能同时命中好几个stage的flag（理论上少见，但为免遗漏，
      // 按 QUCUO_QUESTS 顺序找到第一个命中的即可，不叠加展示多段台本）。
      let scriptOverride = null;
      const thisTurnFlags = p.delta?.flags_add || [];
      if (thisTurnFlags.length) {
        outer: for (const quest of QUCUO_QUESTS) {
          if (!quest.stages?.length) continue;
          const prog = questProgress[quest.id];
          // 只在这个任务确实"活跃"（已经开始、还没完成/锁定）时才检查，
          // 避免玩家复述过去已经完成的flag文字时被误判重新触发一次台本
          if (prog && prog.status !== "active") continue;
          const stageIndex = prog?.currentStageIndex ?? 0;
          const stage = quest.stages[stageIndex];
          if (!stage) continue;
          const candidateFlags = Array.isArray(stage.completionFlag) ? stage.completionFlag : [stage.completionFlag];
          const hitFlags = candidateFlags.filter(f => thisTurnFlags.includes(f));
          if (!hitFlags.length) continue;
          const script = getQuestScript(quest.id, stage.id, hitFlags);
          if (script) { scriptOverride = script; break outer; }
        }
      }
      if (scriptOverride) {
        addLog(scriptOverride.split("\n").filter(line => line.length).map(t => ({ t: "desc", text: "  " + t })));
      } else if (p.output) {
        addLog(p.output.map(t => ({ t: "desc", text: "  " + t })));
      }
      if (p._truncated) addLog([{ t: "sys", text: "  ⚠ 本轮回复被接口中途截断，以上仅为已收到的完整部分（多为中转站/模型输出上限所致，可换接口或调低目标字数；详见 📋 Pipeline 的停止原因）" }]);

      // NPC涌现·第一阶段：AI如果在这一轮显式声明"提到了新的具名人物"
      // （通过顶层JSON的 mentionedNewNpcs 字段），记为"传闻中的人物"，
      // 不立即生成技能/属性——不用正则猜人名，中文人名边界靠字符规则
      // 猜测误判率太高，改为让AI自己判断这是语义理解的强项。
      if (p.mentionedNewNpcs && p.mentionedNewNpcs.length) {
        // 用统一的 narrativeText 而不是 p.output——双调用模式下叙事在 rawFull 里，
        // 读 p.output 会拿到空串，传闻人物就成了没有上下文的光杆名字。
        setVarTree(prev => recordRumoredNpcs(prev, p.mentionedNewNpcs, narrativeText));
      }

      // 系统裁决：AI每次返回的NPC列表里，凡是还没有 moveset/carriedItems 的
      // （通常是新出现的NPC），本地补全一份固定的技能位和随身物品，供切磋/偷窃使用。
      // 关键：AI 每轮返回的都是全新的 {name,id,brief} 裸对象，直接喂给
      // ensureNpcCombatData 会导致同一个 NPC 每轮重新随机一套随身物品——
      // "出生即固定"彻底失效，战利品变成四次元口袋。所以先按名字和场上已有
      // NPC 合并，老面孔继承出生时固化的全部数据，只有真正的新面孔才走生成
      // （新面孔如果带 carry 字段，随身物品就按 carry 所见即所得地固化）。
      //
      // 生成顺序（硬规则）：人眼看见的描述 -> 角色出现 -> 才据此设置人设/装备/行囊，
      // 不能反过来。之前只有"传闻人物涌现"这条特殊分支会把描述喂给
      // mapDescriptionToGenParams 换算人设强度，常规新面孔（刷新出的/新地点遇到的）
      // 完全绕开了这一步，直接吃 luck 兜底——猎户和商贩长出同一副筋骨。
      // 现在统一用 brief + 本轮叙事文本作为"看见的描述"，新面孔都走同一套映射。
      const luck = char.special?.气运 ?? 5;
      // narrativeText 已在上面按模式各自赋好（单调用=p.output 拼接，双调用=rawFull 散文），
      // 不要在这里重新从 p.output 取——那样双调用会拿到空串，新面孔全部退化成吃 luck 兜底。
      if (p.room && Array.isArray(p.room.npcs)) {
        p.room.npcs = p.room.npcs.map(n => {
          const existing = room.npcs.find(o => o.name === n.name);
          if (existing?.carriedItems) {
            return { ...existing, brief: n.brief || existing.brief };
          }
          const { levelCap, personalityProfile } = mapDescriptionToGenParams(`${n.brief || ""} ${narrativeText}`);
          return ensureNpcCombatData({ ...n, personalityProfile }, { luck, levelCap });
        });

        // 复用 MVU 块之前算好的系统采纳名单（systemAcceptedNames），判据一致：
        // 只认系统真正会放进场的人 + 涌现登场者，AI 凭空多报的幽灵一律不计入。
        // 再叠一层内层房间过滤（isNpcVisibleInInnerRoom）：与左栏「此地之人」、任务栏
        // giver 判定用同一套——否则会出现"老猎户明明绑在猎户小屋，却因为在整个 room.npcs
        // 里就在村口被判成『新人物出现』"的割裂。三处必须同一份可见性判据。
        const acceptedNpcs = p.room.npcs
          .filter(n => systemAcceptedNames.has(n.name))
          .filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));

        // "新人物出现"检测：只对系统真正采纳、且从未见过的面孔插入这条日志。
        const newFaces = detectNewFaces(varTreeRef.current, acceptedNpcs);
        if (newFaces.length) {
          addLog(newFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` })));
          setVarTree(prev => markAsSeen(prev, newFaces.map(n => n.name)));
        }
        // 久别重逢·记忆断层：同样只记系统采纳的在场人物。
        setVarTree(prev => updateLastSeen(prev, acceptedNpcs.map(n => n.name), time));
      }

      // NPC涌现·第二阶段：如果这次AI返回里，有一个"传闻中的人物"被真正实体化
      // 进了 room.npcs（通过下面注入的涌现指令引导AI这么做），系统读取AI给出的
      // emergedNpcDescription（身份/性格定性描述），本地映射成数值，清除传闻标记。
      if (p.emergedNpcDescription && p.emergedNpcName) {
        const { levelCap, personalityProfile } = mapDescriptionToGenParams(p.emergedNpcDescription);
        setVarTree(prev => clearRumor(prev, p.emergedNpcName));
        setRoom(r => ({
          ...r,
          npcs: r.npcs.map(n => n.name === p.emergedNpcName
            ? ensureNpcCombatData({ ...n, personalityProfile }, { luck, levelCap })
            : n),
        }));
      }

      if (!isTalk) {
        if (lockedDestName) {
          // 系统裁决：目的地、出口列表强制来自固定地图，不信任 AI 返回的 room.name/exits，
          // 只采用 AI 给出的 desc（场景描述文本）——这是本轮改造的核心："AI 只负责怎么形容，
          // 不负责去哪里"。
          const destNode = getMapNode(lockedDestName);
          const cached = roomMapRef.current[lockedDestName];
          const finalDesc = (p.room && p.room.desc) ? p.room.desc : destNode.desc;
          setRoom({
            name: lockedDestName,
            desc: finalDesc,
            exits: Object.keys(destNode.exits),
            npcs: (cached && cached.npcs) || (p.room && p.room.npcs) || [],
            items: (cached && cached.items) || (p.room && p.room.items) || [],
          });
          addLog([{ t: "room", text: "" }, { t: "room", text: `    ${lockedDestName}` }, { t: "room", text: "" }]);
          traceStep(_trace, "状态写回", "pass", `room.name → ${lockedDestName}（移动完成）${outerDepartRef.current?.fromInner ? `，内层落点自动归为新据点锚点` : ""}`);
          outerDepartRef.current = null;
          if (!mapData[lockedDestName]) {
            setMapData(m => ({ ...m, [lockedDestName]: { x: destNode.x, y: destNode.y } }));
          }
        } else if (p.room && QUCUO_MAP[room.name]) {
          // 当前在固定地图范围内，且这次没有触发移动（比如原地互动/战斗），
          // 只允许 AI 更新 desc/items，name/exits/npcs 依然锁定为系统已有状态。
          // npcs 不能信任 AI 这次返回的名单——AI 每个回合都会重新交一份"它认为
          // 在场的人"的完整列表，如果直接铺盖过去，等于每次非移动动作都让AI
          // 重新发明一次在场人物，这正是"此地的人一会好几个一会都走光"的乱动
          // 根因。在场人物只应通过明确渠道变化：每日游走人口刷新（见下方
          // useEffect）、人物涌现（emergedNpcName，就发生在这行之前）、或玩家
          // 自己的动作——不该被这句话顺手覆盖。
          const node = QUCUO_MAP[room.name];
          setRoom(r => ({ ...r, ...p.room, name: room.name, exits: Object.keys(node.exits), npcs: r.npcs }));
        } else if (p.room) {
          // 兜底：房间不在固定地图里（理论上不应该出现，只有 AI 未遵守系统裁决时才会
          // 落入这条路径）。这次修复已经从源头堵住了主要诱因——之前"向北走"这类带
          // 前缀词的移动指令会被 parseDir 误判为"非移动"，导致本该走上面 lockedDestName
          // 强锁分支的请求错误地流落到这里，AI 因此有机会自由发挥编出不在地图里的
          // 过渡地名（比如"熊曲山谷"）。parseDir 修好之后，只要玩家的移动意图能被正确
          // 识别，就不会再落入这条分支；这里维持原有的兜底自由生成逻辑，不额外强行拉回
          // 固定地图，避免打断正在进行的、AI已经开始编排的野生场景剧情。
          const moved = p.room.name && p.room.name !== room.name;
          if (moved) {
            const cached = roomMapRef.current[p.room.name];
            if (cached) setRoom(r => ({ ...r, ...p.room, items: cached.items, npcs: cached.npcs }));
            else setRoom(r => ({ ...r, ...p.room }));
            addLog([{ t: "room", text: "" }, { t: "room", text: `    ${p.room.name}` }, { t: "room", text: "" }]);
            if (pendDirRef.current && !mapData[p.room.name]) {
              const d = pendDirRef.current, [dx, dy] = DIR_DXY[d] || [0, 0];
              const cur = mapData[room.name] || { x: 0, y: 0 };
              setMapData(m => ({ ...m, [p.room.name]: { x: cur.x + dx, y: cur.y + dy } }));
            }
          } else {
            setRoom(r => ({ ...r, ...p.room }));
          }
        }
        pendDirRef.current = null;
      }
      if (p.char && !isTalk) { setChar(c => { const nc = { ...c, ...p.char }; if (gm) { nc.hp = [nc.hp[1], nc.hp[1]]; } return nc; }); }
      if (p.dao) { setDao(d => ({ ...d, ...p.dao })); }
      if (p.delta && !isTalk) {
        const judgment = pickupJudgmentRef.current;
        let usedJudgment = false;
        if (p.delta.items_add?.length) {
          // 系统本轮已代发的采集物：即便 AI 又在 items_add 里塞了一份，也剔除，防重复入袋。
          const granted = collectGrantedRef.current || [];
          const rawAdds = granted.length
            ? p.delta.items_add.filter(i => !granted.includes(typeof i === "string" ? i : i.name))
            : p.delta.items_add;
          const newItems = rawAdds.map(i => {
            if (typeof i === "string") return i; // 兼容纯文本物品（杂物/剧情道具，不参与装备系统）
            // 系统裁决：如果本轮有拾取判定在先，第一件结构化物品的品质/分类强制对齐判定结果，
            // 不信任 AI 自己回传的 quality（防止其绕过气运概率机制乱给稀有品）
            let quality = i.quality || "白";
            let category = i.category || "misc";
            if (judgment && !usedJudgment) {
              quality = judgment.quality;
              category = judgment.category;
              usedJudgment = true;
            } else if (!QUALITY.includes(quality)) {
              quality = "白"; // AI 给了非法品质字符串时兜底
            }
            return makeGameItem({ name: i.name, category, quality, desc: i.desc || "" });
          });
          const addedNames = newItems.map(i => typeof i === "string" ? i : i.name);
          setInv(v => [...v, ...newItems]);
          setRoom(r => ({ ...r, items: r.items.filter(i => !addedNames.includes(i.name) && !addedNames.includes(i)) }));
        }
        // 拾取判定兜底：本轮系统掷骰触发了拾取（judgment 有值），但 AI 叙事里
        // 明明写了"捡到某物"、却忘了在 delta.items_add 里放这件物品（judgment
        // 没被上面消费掉）——这正是"叙事说收入怀中、背包里却没有"那个 bug。
        // 系统在这里补发一件：物品名尽量从叙事原文里抠（"拾起/捡起/收入…是一枚X"
        // 之类），抠不到就用品质对应的通用名，绝不让掷到的拾取凭空蒸发。
        if (judgment && !usedJudgment) {
          const narrativeText = typeof rawFull === "string" ? rawFull : "";
          const guessName = extractPickupName(narrativeText)
            || `${judgment.quality === "白" ? "" : judgment.quality}路遇之物`;
          const gained = makeGameItem({ name: guessName, category: judgment.category, quality: judgment.quality, desc: "路上拾得的物件。" });
          setInv(v => [...v, gained]);
          addLog([{ t: "item", text: `  ✓ 你拾得「${guessName}」，收入行囊。` }]);
        }
        pickupJudgmentRef.current = null;
        if (p.delta.items_rm?.length) {
          const names = p.delta.items_rm.map(i => typeof i === 'string' ? i : i.name || String(i));
          setInv(v => v.filter(i => { const s = typeof i === 'string' ? i : i.name; return !names.includes(s); }));
          setRoom(r => ({ ...r, items: [...r.items, ...names.map(n => ({ name: n, id: n }))] }));
        }
        if (p.delta.exp) setExp(e => e + (p.delta.exp || 0));
        if (p.delta.pot) setPot(e => e + (p.delta.pot || 0));
        if (p.delta.skill_up) {
          // 经验升阶已退役——stage 改由潜能主动突破（breakthroughSkill）。
          // skill_up 仅保留累积 exp 数值以兼容老存档/AI 叙事，不再自动改 stage/level。
          // 固定招（fixed，无 stage）直接跳过。
          setSkills(sk => sk.map(s => {
            if (s.fixed || s.stage == null) return s;
            const up = p.delta.skill_up[s.name];
            if (!up) return s;
            return { ...s, exp: (s.exp ?? 0) + up };
          }));
        }
        if (p.delta.skills_add?.length) {
          const allCatalog = Object.values(SKILL_CATALOG).flat();
          setSkills(sk => [...sk, ...p.delta.skills_add.map(n => {
            const name = typeof n === "string" ? n : n.name || n;
            const hit = allCatalog.find(c => c.name === name);
            if (hit) return makeSkillEntry(hit); // 那10门可修炼武学：保留 stage，能潜能升阶
            // 非目录武学（AI 叙事里赠予/自创的招）：固定招，无 stage、不升阶，学即完整
            return { id: `learned_${name}`, name, type: "招式", quality: "白", moveType: null, fixed: true, stage: null, active: false };
          })]);
        }
      }
      if (p.delta?.flags_add?.length) {
        setFlags(f => [...new Set([...f, ...p.delta.flags_add])]);
        // 说服型任务分支：AI 吐出了成功 flag，说明玩家把对方说动了——
        // 清挂起态（停止继续注入说服判定），forceAdvance 交给现有的 flag→stage 推进链。
        if (pendingQuestBranch?.mode === "talk" && p.delta.flags_add.includes(pendingQuestBranch.flag)) {
          const pq2 = QUCUO_QUESTS.find(x => x.id === pendingQuestBranch.questId);
          if (pq2) addLog([{ t: "affection", text: `  ✓ 你把话说到了点子上，「${pq2.title}」推进。` }]);
          setPendingQuestBranch(null);
        }
      }
      // 选项在叙事之后、隔一拍再浮现——不要跟叙事同一帧糊在一起。让玩家先把这段
      // 剧情读进去，行动选项再"卡一下"缓缓出来，读感上先有戏、后给抉择。
      if (p.choices?.length) {
        const choiceLog = [{ t: "sys", text: "" }, { t: "choice", text: "  你可以：" }, ...p.choices.map((c, i) => ({ t: "choice", text: `  [${String.fromCharCode(65 + i)}] ${c}`, action: c }))];
        setTimeout(() => addLog(choiceLog), 650);
      }
      if (!isTalk) setTime(t => t + 1);

      // ── 小纸条·向量写入（提交段·异步副作用）──
      // AI 若吐了 memory 字段（≤50字纯事实），本轮成功结算后写进统一小纸条库供日后召回。
      // fire-and-forget：不 await，不阻塞 UI，失败静默；只在成功路径执行，故回滚路径不会误写。
      // owner 三态：行动模式=公共见闻（owner 空，谁都能语义捞）；对话模式=私有给对话对象
      // （只在该 NPC 在场/对话时浮现，外人捞不到内容）——这正是「私聊你俩私有」的落点。
      if (embeddingReady(apiCfg) && p.memory) {
        const roomNpcs = (p.room && Array.isArray(p.room.npcs) ? p.room.npcs : room.npcs) || [];
        const knownNames = Array.from(new Set([
          ...roomNpcs.map(n => n.name),
          ...Object.keys(varTreeRef.current.角色 || {}),
          ...Object.keys(QUCUO_MAP),
        ]));
        const noteOwner = (activeTarget || (isTalk && talkTarget)) ? [{ name: activeTarget || talkTarget, via: VIA.FIRSTHAND }] : [];
        const noteSource = isTalk ? NOTE_SOURCE.TALK : NOTE_SOURCE.NARRATIVE;
        writeNote({ cfg: apiCfg, text: p.memory, turn: time, knownNames, owner: noteOwner, source: noteSource, place: room.name })
          .catch(err => console.warn("小纸条写入失败（不影响本轮）：", err));
      }

      // ── 信息领域·把 memory 同时登记为可传播事实 ──
      // 与上面的向量小纸条并行的第二条路：注册进 knowledge.js 事实账本，供 NPC 自然提起、
      // 按同框传播扩散。不依赖 embeddingReady（纯文本记账）。
      // 隔离：对话模式下这段是「你俩私下说的」，只让对话对象一人当场"亲历"入账，
      // 不把内容摊给同屋其他 NPC（外人不该凭空知道你私下答应了谁什么）；
      // 行动模式才是当众见闻，在场者共同"目击"。
      if (p.memory) {
        dayMaterialRef.current.push({ turn: time, text: p.memory }); // 主叙事/对话的事实也进当日原料（日总结用）
        const roomNpcs = (p.room && Array.isArray(p.room.npcs) ? p.room.npcs : room.npcs) || [];
        const witnesses = (activeTarget || (isTalk && talkTarget))
          ? [{ name: activeTarget || talkTarget, 途径: "亲历" }]
          : roomNpcs.map(n => ({ name: n.name, 途径: "目击" }));
        if (witnesses.length) {
          const factId = `turn_${time}_${witnesses[0].name}`;
          setVarTree(prev => registerFact(prev, { id: factId, 摘要: p.memory, 标签: isTalk ? "私语" : "见闻", 知晓者: witnesses }, time));
        }
      }

      // 对话即认识（本轮统一）：只要这次是对话模式(isTalk)、且明确选定了对话对象
      // (talkTarget)、并真正走完了对话结算(到这里说明没被拦截/回滚)，就把对方标记为
      // 已认识。此前只有"点NPC名字→互动菜单→对话"(handleNpcTalk)会标记，而"底部💬对话"
      // "侧栏选人对话"这两个入口漏了，导致跟人从底部聊了半天头上还挂"尚未认识"。
      // 判定放在这里(而非各UI入口)的好处：捕捉的是"真的选人+真的说了话"这个动作本身，
      // 所有对话入口自动一致，不用每个入口分别补，也不会"一点聚焦就算认识"。
      if (isTalk) {
        const toKnow = new Set();
        if (talkTarget) toKnow.add(talkTarget); // 选定了对象：直接算认识
        // 没选人(或即便选了人)时，AI 回包的 respondedNpcs 报出本轮真正开口回应玩家的
        // NPC——用它精准标记，不靠解析正文猜"谁说话了"(那样极易误判被提及/路过的人)。
        // 只认在场名单里的名字，AI 若报了不在场的名字(幻觉)一律丢弃。
        if (Array.isArray(p.respondedNpcs)) {
          const presentNames = new Set((room.npcs || []).map(n => n.name));
          p.respondedNpcs.forEach(name => { if (typeof name === "string" && presentNames.has(name)) toKnow.add(name); });
        }
        if (toKnow.size) {
          setVarTree(prev => Array.from(toKnow).reduce((tree, name) => markNpcAsKnown(tree, name), prev));
        }
      }

      setConvo([...newConvo, { role: "assistant", content: rawFull.slice(0, 500) }]);

      // 回合完成登记：驱动"每 N 回合自动存档"。出错回滚的轮次不计数——
      // 状态没变，存了也是重复盘。
      roundsSinceLastSaveRef.current += 1;
      playedThisSessionRef.current = true;
      endTrace(_trace, "行动完成");
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
    rest.forEach(w => pendingQueue.current.push({ cmd: w, extraReplies: [] }));
    autoTravelRef.current = rest.length > 0; // 有后续排队步时才需要"遇遭遇硬停"
    setQueueCount(pendingQueue.current.length);
    act(first);
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
    const verb = result.isMaster ? "将平生所学" : "将几手江湖基本功";
    act(`拜${npc.name}为师，${npc.name}${verb}「${result.moveBrief}」倾囊相授，我凝神习得`, [], { settle: true, settleNpc: npc.name });
  }, [char, skills, varTree, addLog, act]);

  // 偷窃：偷物+偷师（偷招）二合一，同一次判定，成功后再二选一决定这次偷到的
  // 是物品还是招式（tryStealFrom 内部处理）。身法（char.special.身法）现在也
  // 参与成功率计算，跟好感度独立相加——手越利索，越容易得手。
  const handleNpcSteal = useCallback((npc) => {
    const agility = char.special?.身法 ?? 0;
    const result = tryStealFrom(npc, varTreeRef.current, skills, char, agility);

    if (!result.ok) {
      addLog([{ t: "sys", text: `  ${result.reason}` }]);
      return;
    }

    if (!result.success) {
      addLog([
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你手法生涩，被${npc.name}当场察觉！他脸色一沉，显然动了真怒。` },
      ]);
      // 偷窃被当场发现，跟偷窃成功（神不知鬼不觉）性质完全相反——
      // 对方已经知道玩家是谁、双方有了正面冲突接触，这时候标记认识才合理；
      // 偷窃成功恰恰不该标记，因为那意味着对方完全没察觉玩家的存在。
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
      addLog([{ t: "sys", text: `  你想对${npc.name}下手，摸了半天，却发现他身上早已一无所有，只得悻悻作罢。` }]);
      return;
    }

    if (result.outcome === "item") {
      const target = result.item;
      addLog([
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你运指如风，趁${npc.name}不备，将「${target.name}」（${target.quality}）神不知鬼不觉地顺入了自己怀中。` },
      ]);
      setInv(prev => [...prev, { ...target, id: `stolen_${target.id}_${Date.now()}` }]);
      // 标记这件物品已被偷走，避免同一件东西被偷第二次
      setRoom(r => ({
        ...r,
        npcs: r.npcs.map(n => n.id === npc.id
          ? { ...n, carriedItems: n.carriedItems.map(it => it.id === target.id ? { ...it, stolen: true } : it) }
          : n),
      }));
      return;
    }

    // result.outcome === "move"：偷师成功，把偷来的招并入武学栏（fixed，学即完整）
    addLog([
      { t: "cmd", text: `> 偷窃 ${npc.name}` },
      { t: "desc", text: `  你悄然窥破${npc.name}出手的门道，趁其不备，竟将「${result.move.name}」这一手偷学了去！` },
    ]);
    setSkills(sk => sk.some(s => s.id === result.skill.id) ? sk : [...sk, result.skill]);
  }, [varTree, skills, char, addLog]);

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

  const handleSkillBreakthrough = useCallback((skill, req) => {
    if ((char.money || 0) < req.price || skill.level < req.minLevel) return;
    setChar(c => ({ ...c, money: c.money - req.price }));
    setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, stage: req.nextStage } : s));
    act(`在武馆高人指点下，「${skill.name}」突破至${req.nextStage}`, [], { settle: true });
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
    setActiveBuilding(null);
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
  }, [act]);

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

  const handleForgeCommission = useCallback((material, luck, currentTime, cost) => {
    if ((char.money || 0) < cost) return;
    setChar(c => ({ ...c, money: c.money - cost }));
    setFlags(f => [...f, `forge_pending_${currentTime}_${luck}`]);
    act(`委托铸剑坊打造武器，花费${cost}两`, [], { settle: true });
  }, [char, addLog, act]);

  const handleForgePickup = useCallback(() => {
    const pendingFlag = flags.find(f => f.startsWith("forge_pending_"));
    if (!pendingFlag) return;
    const parts = pendingFlag.split("_");
    const luck = Number(parts[parts.length - 1]) || 5;
    const qualities = ["白","绿","蓝","紫","橙"];
    const qIdx = Math.min(qualities.length - 1, Math.floor(luck / 2.5));
    const quality = qualities[qIdx];
    const name = "定制长剑";
    setFlags(f => f.filter(x => x !== pendingFlag));
    const forgedItem = makeGameItem({ name, category: ITEM_CATEGORY.WEAPON, quality });
    setInv(prev => [...prev, { ...forgedItem, id: `forge_${Date.now()}`, equipped: false }]);
    act(`到铸剑坊取回打造完成的「${name}」（${quality}）`, [], { settle: true });
  }, [flags, addLog, act]);

  const handleListenRumor = useCallback((rumor, cost) => {
    if ((char.money || 0) < cost) return;
    setChar(c => ({ ...c, money: c.money - cost }));
    act(`在茶馆花${cost}两，听掌柜低声说了个传闻：「${rumor}」`, [], { settle: true });
  }, [char, addLog, act]);

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
  // 顶栏按钮统一规格：此前每个按钮各自 padding/字号/色系，一字排开像彩虹糖纸。
  // 收敛成"同一副骨架 + 三色语义"：金=重要入口，松石绿=设置/切换，绛红=上报，其余用正文/次要色。
  const topBtn = (color) => ({
    cursor: "pointer", color, padding: "2px 9px", fontSize: "10.5px",
    border: `1px solid ${zoneTheme.border}`, borderRadius: 3, background: "transparent",
  });
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

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: `1px solid ${zoneTheme.border}`, flexShrink: 0, fontSize: "11px", backgroundImage: `linear-gradient(180deg, ${zoneTheme.bgPanel}, transparent)`, flexWrap: "wrap", rowGap: 6 }}>
        {/* 手机端：顶栏收成一个☰按钮，点开才展开全部功能入口 */}
        {isMobile && (
          <>
            <span onClick={() => setMobileTopMenu(v => !v)}
              style={{ cursor: "pointer", color: "#e8d0a0", padding: "3px 12px", background: "#1a140c", border: "1px solid #4a3a1a", borderRadius: 3, fontWeight: "bold", fontSize: "13px" }}>☰ 菜单</span>
            <span style={{ color: "#8a7a5a", fontSize: "10px" }}>{CURRENT_VERSION.time}</span>
            <span style={{ flex: 1 }} />
            {mobileTopMenu && <span onClick={() => setMobileTopMenu(false)} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "11px" }}>收起 ✕</span>}
          </>
        )}
        {/* 顶栏功能入口：桌面常显；手机仅在展开菜单时显示（换行铺开） */}
        <div style={{
          display: (!isMobile || mobileTopMenu) ? "flex" : "none",
          alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 6,
          width: isMobile ? "100%" : "auto", flex: isMobile ? "none" : 1,
        }}>
        <span
          className="qbtn"
          onClick={() => setShowTutorial(true)}
          style={{ ...topBtn(uiGold), fontWeight: "bold" }}
        >📖 新手教程</span>
        <span
          className="qbtn"
          onClick={() => setShowCodex(true)}
          title="百物·武学总览：看全所有物品与武学的介绍、品阶、效果"
          style={{ ...topBtn(uiGold), fontWeight: "bold" }}
        >📖 图鉴</span>
        <span
          className="qbtn"
          onClick={() => setShowVersionHistory(true)}
          title="点击查看版本历史目录"
          style={{ ...topBtn(zoneTheme.textDim), fontSize: "10px" }}
        >📅 {CURRENT_VERSION.time}</span>

        {/* 中组：日志 · 上报bug */}
        <span className="qbtn" onClick={() => setShowTrace(p => !p)} style={{ ...topBtn(showTrace ? uiTurquoise : zoneTheme.textDim), marginLeft: 12 }}>🧭 全流程日志</span>
        <span className="qbtn" onClick={() => setShowBugReport(true)} title="遇到问题或有建议，点这里上报" style={topBtn(uiCrimson)}>🐞 上报bug</span>

        <span style={{ flex: 1 }} />

        {/* 右组：其余全部右对齐 */}
        <span
          className="qbtn"
          onClick={() => setShowCharacterPage(true)}
          style={topBtn(uiPink)}
        >👥 人物关系</span>
        <span
          className="qbtn"
          onClick={() => setShowQuestLog(true)}
          style={topBtn(zoneTheme.text)}
        >📜 任务</span>
        <span
          className="qbtn"
          onClick={() => setShowLore(true)}
          style={topBtn(zoneTheme.text)}
        >📖 见闻录</span>
        <span
          className="qbtn"
          onClick={() => {
            if (window.confirm("返回开始菜单？当前进度已自动保存，可以随时继续。")) {
              sessionStorage.setItem("wuxia_mud_force_start_screen", "1");
              window.location.reload();
            }
          }}
          style={topBtn(zoneTheme.textDim)}
        >⏻ 主菜单</span>
        <span
          className="qbtn"
          onClick={() => { setSettingsInitialTab("saves"); setShowSettings(true); }}
          style={topBtn(uiGold)}
        >💾 存档</span>
        <span className="qbtn" onClick={() => { setSettingsInitialTab(null); setShowSettings(true); }} style={topBtn(uiTurquoise)}>⚙ 设置</span>
        <span
          className="qbtn"
          onClick={() => setIsDayMode(d => !d)}
          title={isDayMode ? "切回暗夜模式" : "切换到日间模式（米色底+棕框）"}
          style={topBtn(uiTurquoise)}
        >{isDayMode ? "☀ 日间" : "☾ 夜间"}</span>
        {autoSaveError && (
          <span
            title={`自动存档失败：${autoSaveError}。当前进度可能无法保存，建议尽快手动导出或清理浏览器存储空间。`}
            style={{ color: "#e0526a", fontSize: "9.5px", cursor: "help" }}
          >⚠ 存档失败</span>
        )}
        {!autoSaveError && lastAutoSave && (
          <span style={{ color: "#3a4a3a", fontSize: "9.5px", transition: "opacity 0.3s" }}>● 已保存</span>
        )}
        </div>
      </div>


      {showAvatarPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(4,4,10,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={avatarPickerCloseGuard.onMouseDown} onClick={avatarPickerCloseGuard.onClick}>
          <div style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 8, padding: 24, width: 460, maxWidth: "90vw", color: "#c8bfa0" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ color: "#6ec6c6", fontSize: "15px" }}>选择头像</span>
              <span style={{ color: "#5a5a4a", fontSize: "12px", cursor: "pointer" }} onClick={() => setShowAvatarPicker(false)}>× 关闭</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "#8a8a7a", marginBottom: 14 }}>
              选一张预制头像，或上传自己的图片（建议 2:3 竖版）。选择只影响你自己的显示，存在本地浏览器。
            </div>
            {/* 预制头像：从 public/portraits/player/ 读，共8张同一批唐卡风格厚涂立绘
                （male=藏剑大叔/female=花商/other=朔风刀客·默认兜底/preset1~5=飞贼·猎手·
                猫人·假小子·穿越者）。文件名约定 male/female/other + preset1..N，2:3竖版。 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[genderAvatar["男"], genderAvatar["女"], AV_BASE + "other.png",
                AV_BASE + "preset1.png", AV_BASE + "preset2.png", AV_BASE + "preset3.png",
                AV_BASE + "preset4.png", AV_BASE + "preset5.png"].map((src, i) => (
                <div key={i}
                  onClick={() => { setPlayerAvatarCustom(src); try { localStorage.setItem("qucuo_player_avatar", src); } catch { /* ignore */ } setShowAvatarPicker(false); }}
                  style={{ aspectRatio: "2/3", borderRadius: 5, overflow: "hidden", cursor: "pointer", border: playerAvatarCustom === src ? "2px solid #6ec6c6" : "1px solid #2a3a3a", background: "#0c0e14" }}
                >
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ cursor: "pointer", fontSize: "11.5px", color: "#6ec6c6", padding: "6px 12px", border: "1px solid #1a2d2a", borderRadius: 4 }}>
                ⬆ 上传图片
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = reader.result;
                      setPlayerAvatarCustom(dataUrl);
                      try { localStorage.setItem("qucuo_player_avatar", dataUrl); } catch { alert("图片太大，无法存入本地存储，请换小一点的图。"); }
                      setShowAvatarPicker(false);
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
              {playerAvatarCustom && (
                <span onClick={() => { setPlayerAvatarCustom(""); try { localStorage.removeItem("qucuo_player_avatar"); } catch { /* ignore */ } setShowAvatarPicker(false); }}
                  style={{ cursor: "pointer", fontSize: "11.5px", color: "#c47070", padding: "6px 12px", border: "1px solid #3a1a1a", borderRadius: 4 }}>
                  恢复默认（按性别）
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showTutorial && <TutorialOverlay onClose={closeTutorial} />}

      {showVersionHistory && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={versionHistoryCloseGuard.onMouseDown} onClick={versionHistoryCloseGuard.onClick}>
          <div style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 6, padding: 20, width: 420, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto", fontSize: "12px", color: "#c8bfa0" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: "#6ec6c6", fontSize: "14px" }}>版本历史</span>
              <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={() => setShowVersionHistory(false)}>× 关闭</span>
            </div>
            {VERSION_HISTORY.map((v, i) => (
              <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < VERSION_HISTORY.length - 1 ? "1px solid #14161e" : "none" }}>
                <div style={{ color: i === 0 ? "#e0a0d0" : "#c8bfa0", fontSize: "12.5px" }}>「{v.codename}」{i === 0 && <span style={{ color: zoneTheme.accentDim, fontSize: "10px" }}> · 当前版本</span>}</div>
                <div style={{ color: "#5a5a4a", fontSize: "10.5px", marginBottom: 4 }}>{v.time}</div>
                {/* notes 两种写法都认：数组=一行一条逐行列出（长条目请写数组）；
                    字符串=老写法，整段显示。数组里以 ①②③ 或 一、二、开头的行
                    悬挂缩进一下，看起来才像个更新日志而不是一堵墙。 */}
                {Array.isArray(v.notes) ? (
                  <div style={{ display: "grid", gap: 3 }}>
                    {v.notes.map((line, j) => {
                      const isItem = /^[①-⑳【]|^[一二三四五六七八九十]、/.test(String(line).trim());
                      return (
                        <div key={j} style={{
                          color: isItem ? "#8a8a7a" : "#a09a86",
                          fontSize: "11px", lineHeight: 1.65,
                          paddingLeft: isItem ? 12 : 0,
                          textIndent: isItem ? -12 : 0,
                        }}>{line}</div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: "#8a8a7a", fontSize: "11px", lineHeight: 1.6 }}>{v.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showCharacterPage && (
        <CharacterPage
          varTree={varTree}
          claimedMilestones={claimedMilestones}
          onClaimMilestone={claimMilestone}
          onGift={giftToCharacter}
          initialSelected={characterPageTarget}
          onClose={() => { setShowCharacterPage(false); setCharacterPageTarget(null); }}
        />
      )}

      {showQuestLog && (
        <QuestLogScreen
          questProgress={questProgress}
          zoneTheme={zoneTheme}
          onClose={() => setShowQuestLog(false)}
        />
      )}

      {showLore && (
        <LoreScreen
          varTree={varTree}
          time={time}
          turnToStr={getTimeStr}
          zoneTheme={zoneTheme}
          onClose={() => setShowLore(false)}
        />
      )}

      {showPortraitManager && (
        <PortraitManager
          portraits={portraits}
          onChange={setPortraits}
          knownNames={["旁白", "你", ...listCharacters(varTree).map(c => c.name), ...room.npcs.map(n => n.name)]}
          onClose={() => setShowPortraitManager(false)}
        />
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

        {/* 手机抽屉遮罩：点击关闭 */}
        {isMobile && mobileDrawer && (
          <div onClick={() => setMobileDrawer(null)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,.55)" }} />
        )}

        <div style={isMobile
          ? { position: "fixed", top: 0, bottom: 0, left: 0, width: "82vw", maxWidth: 340, zIndex: 41,
              transform: mobileDrawer === "left" ? "translateX(0)" : "translateX(-100%)",
              transition: "transform .28s ease", boxShadow: mobileDrawer === "left" ? "4px 0 24px rgba(0,0,0,.6)" : "none",
              background: zoneTheme.bg, display: "flex", flexDirection: "column", overflow: "hidden" }
          : { flex: 25, ...S.panel }}>
          {isMobile && (
            <div onClick={() => setMobileDrawer(null)} style={{ textAlign: "right", padding: "8px 12px", color: zoneTheme.textDim, cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>关闭 ✕</div>
          )}
          <div style={S.label}>天地 <span style={{ fontSize: "9.5px", color: zoneTheme.textDim, letterSpacing: "1px" }}>· {zoneTheme.name}</span></div>
          <div style={S.scroll}>
            <div style={{ color: zoneTheme.accent, fontWeight: "bold", fontSize: "14px", marginBottom: 4, letterSpacing: "1px" }}>
              {room.name}
              {hasInnerMap(room.name) && innerRoomName && (
                <span style={{ color: zoneTheme.accentDim, fontWeight: "normal", fontSize: "11px", marginLeft: 6, letterSpacing: 0 }}>· {innerRoomName}</span>
              )}
            </div>
            <div style={{ color: zoneTheme.textDim, fontSize: "10.5px", marginBottom: 10 }}>{getTimeStr(time)} <span style={{ opacity: 0.6 }}>({time})</span></div>
            <div style={{ color: zoneTheme.text, fontSize: "12px", marginBottom: 14, lineHeight: 1.9 }}>{room.desc}</div>

            <div style={{ color: zoneTheme.accentDim, fontSize: "10.5px", marginBottom: 5, letterSpacing: "1px" }}>出口 <span style={{ color: zoneTheme.textDim, fontSize: "9.5px" }}>（在下方输入框打字移动）</span></div>
            <div style={{ marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {room.exits.map(e => (<span key={e} style={{ color: zoneTheme.accent }}>{DIRS[e] || e}</span>))}
              {room.exits.length === 0 && <span style={{ color: zoneTheme.textDim }}>无路可走</span>}
            </div>

            {(() => {
              // 建筑过滤（本轮改版）：若当前据点有内层箱庭且玩家站在某内层房间，
              // 只显示该房间 buildingId 对应的那一个建筑（站在"歇马居"就只能用客栈，
              // 站在"村口广场"这种无 buildingId 的房间则没有建筑）；没有内层数据的
              // 据点维持原样，铺该据点全部建筑。
              const all = getBuildingsForLocation(room.name);
              let list = all;
              if (hasInnerMap(room.name) && innerRoomName) {
                const bid = getBuildingIdForInnerRoom(room.name, innerRoomName);
                list = bid ? all.filter(b => b.id === bid) : [];
              }
              return list.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: zoneTheme.accentDim, fontSize: "10.5px", marginBottom: 5, letterSpacing: "1px" }}>此地建筑</div>
                {list.map(b => (
                  <div key={b.id} onClick={() => setActiveBuilding(activeBuilding?.id === b.id ? null : b)}
                    style={{ cursor: "pointer", marginBottom: 3 }}>
                    <span style={{ color: activeBuilding?.id === b.id ? zoneTheme.accent : "#8ac8b8", fontSize: "12px" }}>{b.name}</span>
                    <span style={{ color: "#5a5a4a", fontSize: "10.5px", marginLeft: 6 }}>{BUILDING_TYPE_LABEL[b.type] || ""}</span>
                  </div>
                ))}
              </div>
              );
            })()}

            <div style={{ color: zoneTheme.accentDim, fontSize: "11px", marginBottom: 3 }}>此地之物</div>
            <div style={{ marginBottom: 10 }}>
              {(room.items || []).length === 0 && <div style={{ color: zoneTheme.textDim, fontSize: "11px" }}>地上空无一物</div>}
              {(room.items || []).map((it, i) => {
                const nm = typeof it === "object" ? it.name : it;
                const col = (typeof it === "object" && QUALITY_COLOR[it.quality]) || "#c4a040";
                return (
                  <div key={(typeof it === "object" && it.id) || i}
                    onClick={() => setActiveItemMenu({ item: it, mode: "ground" })}
                    style={{ fontSize: "11.5px", color: col, cursor: "pointer", marginBottom: 2, textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim }}>
                    · {nm}{typeof it === "object" && it.quality ? `（${it.quality}）` : ""}
                  </div>
                );
              })}
            </div>

            {/* 此地之人：在场 / 曾遇不在场 两段，各可点标题收放，随 room.npcs/varTree 每回合刷新 */}
            {(() => {
              const present = room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
              const everSeen = varTree.世界?.曾经出现人物 || [];
              const presentNames = new Set(room.npcs.map(n => n.name));
              const absent = everSeen.filter(nm => !presentNames.has(nm));
              // 调试：开「🛠调试」后显示 room.npcs 真实全员、各自内层归属、当前内层房间，
              // 用于排查"左栏人数/look 前后变化/和任务栏对不上"这类在场名单问题。
              const dbgPeople = showDebug && (
                <div style={{ fontSize: "9.5px", color: "#7a6a4a", background: "#12100a", border: "1px solid #2a2410", borderRadius: 3, padding: "4px 6px", marginBottom: 6, lineHeight: 1.5, wordBreak: "break-all" }}>
                  <div>当前内层房间: {innerRoomName || "(无/全显示)"} · room.npcs 共 {room.npcs.length} 人</div>
                  {room.npcs.map((n, i) => {
                    const bound = hasInnerMap(room.name) ? getResidentRoomForNpc(room.name, n.name) : null;
                    const vis = isNpcVisibleInInnerRoom(room.name, innerRoomName, n);
                    return <div key={i}>{vis ? "●" : "○"} {n.name} · 驻{bound || "-"} · 落{n.innerRoom || "-"}</div>;
                  })}
                </div>
              );
              const header = (label, count, key, color, rightContent) => (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", marginBottom: 4 }}>
                  <span onClick={() => setPeoplePanel(p => ({ ...p, [key]: !p[key] }))}
                    style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", flex: 1 }}>
                    <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>{peoplePanel[key] ? "▾" : "▸"}</span>
                    <span style={{ color }}>{label}</span>
                    <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>（{count}）</span>
                  </span>
                  {rightContent}
                </div>
              );
              // 全局信鸽数量展示：挂在"此地之人·在场"分组标题行右侧，跟具体哪个NPC无关，
              // 纯粹是玩家当前信鸽库存的一处快捷可见位置（另一处在人物信息栏，这里方便
              // 在查看在场人物时顺带看一眼够不够用）。原本这个数字挂在"曾遇·不在场"里每个
              // 人自己那一行的飞鸽按钮上，现在挪到这里做全局展示，不在场那边的飞鸽功能本身
              // 不受影响（点名字旁边的🕊按钮仍能单独给某人飞鸽，只是不再显示数字在那一行）。
              const pigeonBadge = (
                <span style={{ fontSize: "10px", color: (char.pigeons || 0) > 0 ? "#c4a040" : zoneTheme.textDim, flexShrink: 0 }} title={`现有信鸽 ${char.pigeons || 0} 只`}>
                  🕊{char.pigeons || 0}
                </span>
              );
              return (
                <div style={{ marginBottom: 10 }}>
                  {dbgPeople}
                  {header("此地之人 · 在场", present.length, "present", zoneTheme.accentDim, pigeonBadge)}
                  {peoplePanel.present && (present.length === 0
                    ? <div style={{ color: zoneTheme.textDim, fontSize: "11px", marginBottom: 8, paddingLeft: 16 }}>空无一人</div>
                    : <div style={{ marginBottom: 8 }}>{present.map((n, i) => {
                        const known = isNpcKnown(varTree, n.name);
                        const attrs = varTree.角色?.[n.name] || {};
                        const hasAffection = known && typeof attrs.好感度 === "number";
                        return (
                          <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: i < present.length - 1 ? `1px solid ${zoneTheme.border}` : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {/* 名字纯展示，不可点——互动统一走"角色面板"按钮，不再从名字弹菜单 */}
                              <span style={{ color: uiGreen, flex: 1 }}>
                                {n.name}<span style={{ color: zoneTheme.textDim, fontSize: "11px", marginLeft: 6 }}>{n.brief}</span>
                              </span>
                              {hasAffection ? (
                                <span style={{ fontSize: "10.5px", flexShrink: 0, textAlign: "right", whiteSpace: "nowrap" }} title={`好感度 ${attrs.好感度}/100`}>
                                  <span style={{ color: uiPink }}>{npcAffectionLabel(attrs.好感度)}</span>
                                  <span style={{ color: zoneTheme.textDim, marginLeft: 4 }}>{attrs.好感度}</span>
                                </span>
                              ) : (
                                <span style={{ fontSize: "10px", color: zoneTheme.textDim, flexShrink: 0, whiteSpace: "nowrap" }}>{known ? "" : "尚未认识"}</span>
                              )}
                            </div>
                            {/* 角色面板：唯一的互动入口，弹出六宫格菜单（细看/切磋/偷窃/对话/送礼/拜师，商人多一个交易）。
                                原本这里还有"面板"（详情面板）"立绘"两个按钮，跟角色面板功能重复，已删掉。 */}
                            <span onClick={() => setActiveNpcMenu(n)} title="打开互动菜单：细看/切磋/偷窃/对话/送礼/拜师"
                              style={{ fontSize: "10px", color: zoneTheme.accent, cursor: "pointer", display: "block", marginTop: 2 }}>◈ 角色面板</span>
                          </div>
                        );
                      })}</div>)}
                  {absent.length > 0 && (
                    <div style={{ paddingTop: 6, borderTop: `1px solid ${zoneTheme.border}` }}>
                      {header("曾遇 · 不在场", absent.length, "absent", "#c8bfa0")}
                      {peoplePanel.absent && absent.map(name => {
                        const known = isNpcKnown(varTree, name);
                        const attrs = varTree.角色?.[name] || {};
                        const hasAff = known && typeof attrs.好感度 === "number";
                        return (
                          <div key={name} style={{ marginBottom: 5 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span onClick={() => { setCharacterPageTarget(name); setShowCharacterPage(true); }} title="打开此人详情面板"
                                style={{ cursor: "pointer", color: "#c8bfa0", flex: 1, fontSize: "11px" }}>{name}</span>
                              <span onClick={() => {
                                  if ((char.pigeons || 0) <= 0) { addLog([{ t: "sys", text: `  没有信鸽——去驿站买鸽子，或到驿站直接寄信/送礼给${name}。` }]); return; }
                                  setPigeonTarget(name); setInteractMode("pigeon"); setTimeout(() => inputRef.current?.focus(), 0);
                                }}
                                title={(char.pigeons || 0) > 0 ? `飞鸽传书（现有信鸽 ${char.pigeons} 只，寄一封耗一只·只送信）` : "需先去驿站买信鸽"}
                                style={{ fontSize: "10px", color: (char.pigeons || 0) <= 0 ? zoneTheme.textDim : (pigeonTarget === name ? zoneTheme.accent : "#c4a040"), cursor: "pointer", flexShrink: 0 }}>🕊飞鸽</span>
                              {hasAff ? (
                                <span style={{ fontSize: "10px", flexShrink: 0, whiteSpace: "nowrap" }} title={`好感度 ${attrs.好感度}/100`}>
                                  <span style={{ color: uiPink }}>{npcAffectionLabel(attrs.好感度)}</span>
                                  <span style={{ color: zoneTheme.textDim, marginLeft: 4 }}>{attrs.好感度}</span>
                                </span>
                              ) : (
                                <span style={{ fontSize: "10px", color: zoneTheme.textDim, flexShrink: 0, whiteSpace: "nowrap" }}>{known ? "" : "尚未认识"}</span>
                              )}
                            </div>
                            {known && attrs.态度 && <div style={{ fontSize: "9.5px", color: "#5a5a4a" }}>{attrs.态度}</div>}
                            {known && attrs.生气状态?.active && (
                              <div style={{ fontSize: "9.5px", color: "#e0526a" }}>⚡ 气头上（{attrs.生气状态.reason}），还剩 {attrs.生气状态.turnsLeft} 回合</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 14, marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ color: zoneTheme.accentDim, fontSize: "10.5px", letterSpacing: "1px" }}>立绘</span>
                <span onClick={() => setShowPortraitManager(true)} style={{ color: zoneTheme.textDim, fontSize: "10px", cursor: "pointer" }}>⚙ 管理</span>
              </div>
              {(() => {
                const candidates = ["旁白", "你", ...room.npcs.map(n => n.name)];
                const target = portraitTarget && candidates.includes(portraitTarget) ? portraitTarget : inferActivePortraitTarget(interactMode, room, activeTarget || talkTarget);
                // 雪豹是三形态官方立绘（public/portraits/snowleopard/），不走 localStorage 上传通道
                const isSnowLeopard = target === "雪豹";
                const img = isSnowLeopard
                  ? (slImgErr ? null : snowLeopardPortraitUrl(slForm))
                  : portraits[target];
                return (
                  <>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                      {candidates.map(name => (
                        <span
                          key={name}
                          onClick={() => setPortraitTarget(name)}
                          style={{
                            fontSize: "10px", padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                            color: target === name ? zoneTheme.bg : zoneTheme.accent,
                            background: target === name ? zoneTheme.accent : zoneTheme.bgPanel,
                            border: `1px solid ${zoneTheme.border}`,
                          }}
                        >{name}</span>
                      ))}
                    </div>
                    <div style={{
                      width: "100%", aspectRatio: "9/16", background: zoneTheme.bgPanel, borderRadius: 4,
                      border: `1px solid ${zoneTheme.border}`, display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      {img ? (
                        <img src={img} alt={target} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={isSnowLeopard ? () => setSlImgErr(true) : undefined} />
                      ) : (
                        <span style={{ color: zoneTheme.textDim, fontSize: "11px", textAlign: "center", padding: "0 8px" }}>
                          {isSnowLeopard && slImgErr ? "雪豹立绘待投放（portraits/snowleopard/）" : `${target} 暂无立绘`}
                        </span>
                      )}
                    </div>
                    {/* 雪豹三形态切换：人形·立雪 / 人形·倚剑 / 雪豹真身 */}
                    {isSnowLeopard && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "center" }}>
                        {SNOW_LEOPARD_FORMS.map(f => (
                          <span key={f.key}
                            onClick={() => { setSnowLeopardForm(f.key); setSlFormState(f.key); setSlImgErr(false); }}
                            style={{
                              fontSize: "9.5px", padding: "2px 7px", borderRadius: 3, cursor: "pointer", userSelect: "none",
                              color: slForm === f.key ? zoneTheme.bg : zoneTheme.accent,
                              background: slForm === f.key ? zoneTheme.accent : zoneTheme.bgPanel,
                              border: `1px solid ${zoneTheme.border}`,
                            }}>{f.label}</span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${zoneTheme.border}`, padding: "6px 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ color: zoneTheme.accentDim, fontSize: "10px", cursor: "pointer" }} onClick={() => setMapBig(true)} title="点击放大">
                {mapView === "inner" ? "村图·内" : "舆图·外"} <span style={{ color: zoneTheme.textDim }}>⤢放大{mapView === "outer" ? " · 点已探明据点自动前往" : ""}</span>
              </span>
              {hasInnerMap(room.name) && (
                <span style={{ display: "flex", fontSize: "9.5px", flexShrink: 0 }}>
                  {[["outer", "外"], ["inner", "内"]].map(([v, lb]) => (
                    <span key={v} onClick={() => setMapView(v)}
                      style={{ cursor: "pointer", padding: "1px 7px",
                        color: mapView === v ? zoneTheme.bg : zoneTheme.accent,
                        background: mapView === v ? zoneTheme.accent : zoneTheme.bgPanel,
                        border: `1px solid ${zoneTheme.border}` }}>{lb}</span>
                  ))}
                </span>
              )}
            </div>
            {mapView === "outer" && (() => {
              const completedQuests = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
              const exitByDir = QUCUO_MAP[room.name]?.exits || {};
              // 八格：以当前据点为中心，每个方向查 exits 目的地。
              // 已探索(在mapData)→显地名可点；未探索/无路→问号(战争迷雾，点了才知道)。
              const DIRS8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
              const cells = {};
              for (const dir of DIRS8) {
                const dest = exitByDir[dir];
                const explored = !!(dest && mapData[dest]);
                cells[dir] = explored ? { explored: true, name: dest, dir } : { explored: false, dir };
              }
              const go = (dir) => {
                if (loading) return;
                const dest = exitByDir[dir];
                const completed = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
                if (dest && mapData[dest] && isNodeUnlocked(dest, { completedQuests: completed, flags })) { autoTravelTo(dest); return; } // 已探索且解锁→自动寻路
                setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" }); // 未探索/未解锁→走act(AI演到达或拦截)
              };
              return <NineGridMap centerLabel={room.name} cells={cells} onGo={go} accent={zoneTheme.accent} loading={loading} big={mapBig} />;
            })()}
            {mapView === "inner" && (() => {
              if (!hasInnerMap(room.name)) return <div style={{ color: zoneTheme.textDim, fontSize: "10px" }}>此地无内景可绘。</div>;
              // 中心=当前内层房间；八格=该房间各方向 exits 通向的相邻房间。
              // 内层箱庭房间视为已知（不做迷雾），有出口的方向显房间名可点，无出口显问号（点了提示无路）。
              const curRoom = innerRoomName || getDistrictAnchor(room.name);
              const curExits = (curRoom && getInnerRoom(room.name, curRoom)?.exits) || {};
              const DIRS8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
              const cells = {};
              for (const dir of DIRS8) {
                const dest = curExits[dir];
                cells[dir] = dest ? { explored: true, name: dest, dir } : { explored: false, dir };
              }
              const go = (dir) => { if (!loading && curExits[dir]) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); } };
              return <NineGridMap centerLabel={curRoom} cells={cells} onGo={go} accent="#8ac48a" loading={loading} big={mapBig} />;
            })()}
            {/* 出据点：内层地图里若当前房间有通向外层的方向，给一个精简入口（ClickableMap 只画内层房间） */}
            {/* 出村走外层：内层视图不再单列"出据点"按钮，玩家切到"外"视图往对应方向走即可出村。 */}
          </div>
        </div>

        <div style={isMobile ? { flex: 1, ...S.panel, borderRight: "none", position: "relative" } : { flex: 55, ...S.panel }}>
          {/* 手机：叙事区左右边缘贴边小把手，点击滑出左栏(天地)/右栏(行动) */}
          {isMobile && !mobileDrawer && (
            <>
              <div onClick={() => setMobileDrawer("left")} title="天地"
                style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 30,
                  padding: "14px 4px", background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderLeft: "none",
                  borderRadius: "0 6px 6px 0", color: zoneTheme.accent, cursor: "pointer", fontSize: "12px", writingMode: "vertical-rl",
                  boxShadow: "2px 0 8px rgba(0,0,0,.4)", userSelect: "none" }}>◀ 天地</div>
              <div onClick={() => setMobileDrawer("right")} title="行动"
                style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 30,
                  padding: "14px 4px", background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderRight: "none",
                  borderRadius: "6px 0 0 6px", color: zoneTheme.accent, cursor: "pointer", fontSize: "12px", writingMode: "vertical-rl",
                  boxShadow: "-2px 0 8px rgba(0,0,0,.4)", userSelect: "none" }}>行动 ▶</div>
            </>
          )}
          <div style={{ ...S.label, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>江湖</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {loading && <span onClick={() => { setLoading(false); addLog([{ t: "sys", text: "  ⏹ 已停止等待本次生成（若结果稍后返回将被忽略）。" }]); }}
                style={{ cursor: "pointer", fontSize: "10px", color: "#e0806a", padding: "1px 6px", border: "1px solid #4a2a1a", borderRadius: 3, userSelect: "none" }}>⏹ 停止</span>}
              <span onClick={() => {
                  if (!undoSnapshotRef.current) { addLog([{ t: "sys", text: "  没有可回滚的上一步。" }]); return; }
                  if (!window.confirm("回滚到上一步行动之前？当前这步的结果会被撤销。")) return;
                  applySnapshot(undoSnapshotRef.current);
                  undoSnapshotRef.current = null;
                  setLoading(false);
                  addLog([{ t: "sys", text: "  ↩ 已回滚到上一步之前。" }]);
                }}
                title="撤销上一步行动，还原到落子之前"
                style={{ cursor: "pointer", fontSize: "10px", color: "#c8a860", padding: "1px 6px", border: "1px solid #4a3a1a", borderRadius: 3, userSelect: "none" }}>↩ 回滚</span>
              <span onClick={() => setShowDebug(s => !s)} style={{ cursor: "pointer", fontSize: "10px", color: showDebug ? "#6ec6c6" : "#2a2d3a", padding: "1px 6px", border: `1px solid ${showDebug ? "#2a4a4a" : "#1a1d2e"}`, borderRadius: 3, userSelect: "none" }}>🛠调试</span>
              <span onClick={() => { setGm(g => { const nv = !g; addLog([{ t: "sys", text: nv ? "  [/gamemode 1] 创造模式：无敌，战斗必胜，啥都能干" : "  [/gamemode 0] 生存模式：回归凡人之躯" }]); return nv; }); }} style={{ cursor: "pointer", fontSize: "10px", color: gm ? "#d4a853" : "#2a2d3a", padding: "1px 6px", border: `1px solid ${gm ? "#4a3a1a" : "#1a1d2e"}`, borderRadius: 3, userSelect: "none" }}>/gamemode {gm ? "0" : "1"}</span>
            </span>
          </div>

          {showDebug && (
            <div style={isMobile
              ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 260, padding: "10px 14px",
                  borderTop: `1px solid ${zoneTheme.border}`, background: "rgba(12,14,20,.98)", fontSize: 11, color: "#9a9482",
                  display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflowY: "auto", overflowX: "auto",
                  WebkitOverflowScrolling: "touch", boxShadow: "0 -8px 30px rgba(0,0,0,.7)" }
              : { flexShrink: 0, padding: "10px 14px", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(110,198,198,0.05)", fontSize: 11, color: "#9a9482", display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
              {/* 粘性关闭条：滚到哪都能关掉调试面板（修手机上被内容顶开、找不到关闭入口） */}
              <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between",
                margin: "-10px -14px 4px", padding: "6px 14px", background: "rgba(16,18,26,.96)", borderBottom: "1px solid #2a2d3a" }}>
                <span style={{ color: "#6ec6c6", fontSize: 12, fontWeight: "bold" }}>🛠 调试面板</span>
                <span onClick={() => setShowDebug(false)} style={{ cursor: "pointer", color: "#e0806a", fontSize: 13, padding: "2px 12px", border: "1px solid #5a3a2a", borderRadius: 4 }}>✕ 关闭</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>金钱</span>
                <input type="number" value={char.money ?? 0}
                  onChange={e => setChar(c => ({ ...c, money: parseInt(e.target.value) || 0 }))}
                  style={{ width: 90, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0, marginLeft: 8 }}>气血</span>
                <input type="number" value={char.hp?.[0] ?? 0}
                  onChange={e => setChar(c => ({ ...c, hp: [parseInt(e.target.value) || 0, c.hp?.[1] ?? 100] }))}
                  style={{ width: 60, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
                <span style={{ fontSize: 10 }}>/</span>
                <input type="number" value={char.hp?.[1] ?? 100}
                  onChange={e => setChar(c => ({ ...c, hp: [c.hp?.[0] ?? 0, parseInt(e.target.value) || 100] }))}
                  style={{ width: 60, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>外功</span>
                <input type="number" value={char.waigong ?? 0}
                  onChange={e => setChar(c => ({ ...c, waigong: parseInt(e.target.value) || 0 }))}
                  style={{ width: 90, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0, marginLeft: 8 }}>内功</span>
                <input type="number" value={char.neigong ?? 0}
                  onChange={e => setChar(c => ({ ...c, neigong: parseInt(e.target.value) || 0 }))}
                  style={{ width: 90, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>七维</span>
                {["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"].map(dim => (
                  <span key={dim} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 10 }}>{dim}</span>
                    <input type="number" value={char.special?.[dim] ?? 5}
                      onChange={e => setChar(c => ({ ...c, special: { ...(c.special || {}), [dim]: parseInt(e.target.value) || 0 } }))}
                      style={{ width: 42, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 4px", fontSize: 11 }} />
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10 }}>潜能</span>
                <input type="number" value={pot ?? 0}
                  onChange={e => setPot(parseInt(e.target.value) || 0)}
                  style={{ width: 55, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 4px", fontSize: 11 }} />
                <span style={{ fontSize: 10, marginLeft: 6 }}>阅历</span>
                <input type="number" value={exp ?? 0}
                  onChange={e => setExp(parseInt(e.target.value) || 0)}
                  style={{ width: 55, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 4px", fontSize: 11 }} />
                <span style={{ fontSize: 10, marginLeft: 6 }}>因果</span>
                <input type="number" value={dao.karma ?? 0}
                  onChange={e => setDao(d => ({ ...d, karma: parseInt(e.target.value) || 0 }))}
                  style={{ width: 55, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 4px", fontSize: 11 }} />
                <span style={{ fontSize: 10, marginLeft: 6 }}>劫数</span>
                <input type="number" value={dao.jie ?? 0}
                  onChange={e => setDao(d => ({ ...d, jie: parseInt(e.target.value) || 0 }))}
                  style={{ width: 55, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 4px", fontSize: 11 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>威望</span>
                <input type="number" value={varTree.世界?.威望 ?? 0}
                  onChange={e => { const v = parseInt(e.target.value) || 0; setVarTree(prev => ({ ...prev, 世界: { ...(prev.世界 || {}), 威望: v } })); }}
                  style={{ width: 70, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
                <span style={{ fontSize: 10, color: "#7a7a6a" }}>{reputationLabel(varTree.世界?.威望 ?? 0)}（全局总值，不分势力）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 70, color: "#6ec6c6", flexShrink: 0 }}>旁白好感</span>
                <input type="number" value={narrator.affection ?? 0}
                  onChange={e => setNarrator(n => ({ ...n, affection: parseInt(e.target.value) || 0 }))}
                  style={{ width: 70, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>好感</span>
                <select value={dbgFav} onChange={e => setDbgFav(e.target.value)}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11, maxWidth: 130 }}>
                  <option value="">选认识的人…</option>
                  {(varTree.世界?.已认识人物 || []).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {dbgFav && (
                  <input type="number" value={varTree.角色?.[dbgFav]?.好感度 ?? 0}
                    onChange={e => { const v = parseInt(e.target.value) || 0; setVarTree(prev => ({ ...prev, 角色: { ...(prev.角色 || {}), [dbgFav]: { ...((prev.角色 || {})[dbgFav] || {}), 好感度: v } } })); }}
                    style={{ width: 70, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
                )}
                {!(varTree.世界?.已认识人物 || []).length && <span style={{ fontSize: 10, color: "#5a5a4a" }}>（还没认识任何人）</span>}
                <span
                  onClick={() => {
                    // 调试：把当前内层房间可见的在场者全部标记为已认识——方便测试好感度等
                    // 需要"先认识"的功能，不必逐个去细看/对话。用与左栏同一份可见性判据。
                    const visible = room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
                    if (!visible.length) { addLog([{ t: "sys", text: "  [调试] 当前房间没有可见的在场者" }]); return; }
                    setVarTree(prev => visible.reduce((tree, n) => markNpcAsKnown(tree, n.name), prev));
                    addLog([{ t: "sys", text: `  [调试] 已认识在场者：${visible.map(n => n.name).join("、")}` }]);
                  }}
                  style={{ cursor: "pointer", fontSize: 10, color: "#8ac48a", border: "1px solid #2a4a2a", borderRadius: 3, padding: "2px 8px", userSelect: "none" }}
                >认识在场者</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>传送</span>
                <select value={dbgDist} onChange={e => { setDbgDist(e.target.value); setDbgInner(""); }}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                  <option value="">大地点…</option>
                  {Object.keys(QUCUO_MAP).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {dbgDist && getInnerRoomNames(dbgDist).length > 0 && (
                  <select value={dbgInner} onChange={e => setDbgInner(e.target.value)}
                    style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                    <option value="">小地点（可选）…</option>
                    {getInnerRoomNames(dbgDist).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                <span onClick={() => {
                  if (!dbgDist) return;
                  const node = getMapNode(dbgDist); if (!node) return;
                  const same = dbgDist === room.name;
                  if (!same) {
                    setRoom({ name: dbgDist, desc: node.desc, exits: Object.keys(node.exits), npcs: [], items: [] });
                    if (!mapData[dbgDist]) setMapData(m => ({ ...m, [dbgDist]: { x: node.x, y: node.y } }));
                  }
                  // 小地点：同据点内直接设；跨据点传送要等 room.name 变化触发的 useEffect 先把
                  // innerRoomName 重置为 anchor 之后，再用宏任务覆盖成目标小地点，避免被重置盖掉。
                  if (dbgInner) {
                    if (same) setInnerRoomName(dbgInner);
                    else setTimeout(() => setInnerRoomName(dbgInner), 0);
                  }
                  addLog([{ t: "sys", text: `  [调试] 传送 → ${dbgDist}${dbgInner ? "·" + dbgInner : ""}` }]);
                  // 传送落地后走一遍正常加载（见下方 teleportLookRef 的 effect）。
                  // 若目标与当前完全相同（据点+内层都没变），effect 依赖不会变、不触发，
                  // 此时直接就地环顾即可，不设残留标记。
                  const inner2 = dbgInner || null;
                  if (same && (inner2 === innerRoomName || (!inner2))) {
                    setInteractMode("action"); act("环顾四周");
                  } else {
                    teleportLookRef.current = { dist: dbgDist, inner: inner2 };
                  }
                }}
                  style={{ cursor: "pointer", fontSize: 10, color: dbgDist ? "#6ec6c6" : "#3a3830", padding: "2px 8px", border: `1px solid ${dbgDist ? "#2a4a4a" : "#1a1d2e"}`, borderRadius: 3, userSelect: "none" }}>传送</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>增加武学</span>
                <select value={dbgSkillType} onChange={e => { setDbgSkillType(e.target.value); setDbgPickedSkill(""); }}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                  <option value="全部">全部类型</option>
                  <option value="招式">招式</option>
                  <option value="内功">内功</option>
                  <option value="轻功">轻功</option>
                </select>
                <select value={dbgSkillQuality} onChange={e => { setDbgSkillQuality(e.target.value); setDbgPickedSkill(""); }}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                  <option value="全部">全部品阶</option>
                  {["白","绿","蓝","紫","橙","红"].map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <select value={dbgPickedSkill} onChange={e => setDbgPickedSkill(e.target.value)}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11, minWidth: 120 }}>
                  <option value="">选武学…</option>
                  {(() => {
                    const all = Object.values(SKILL_CATALOG).flat();
                    const filtered = all.filter(s =>
                      (dbgSkillType === "全部" || s.type === dbgSkillType) &&
                      (dbgSkillQuality === "全部" || s.quality === dbgSkillQuality)
                    );
                    return filtered.map(s => <option key={s.id} value={s.id}>{s.name}（{s.quality}·{s.type}）</option>);
                  })()}
                </select>
                <span onClick={() => {
                  if (!dbgPickedSkill) return;
                  const all = Object.values(SKILL_CATALOG).flat();
                  const found = all.find(s => s.id === dbgPickedSkill);
                  if (!found) return;
                  const entry = makeSkillEntry(found);
                  entry.active = true; // 直接装备（运功中）
                  setSkills(sk => [...sk, entry]);
                  addLog([{ t: "sys", text: `  [调试] 习得并运功「${found.name}」（${found.quality}·${found.type}）` }]);
                }}
                  style={{ cursor: "pointer", fontSize: 10, color: dbgPickedSkill ? "#8ac48a" : "#3a3830", padding: "2px 8px", border: `1px solid ${dbgPickedSkill ? "#2a4a2a" : "#1a1d2e"}`, borderRadius: 3, userSelect: "none" }}
                >增加并装备</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>目录物</span>
                <select value={dbgItemCatF} onChange={e => { setDbgItemCatF(e.target.value); setDbgPickedItem(""); }}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                  <option value="全部">全部类别</option>
                  {["weapon","armor","accessory","misc"].map(c => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
                </select>
                <select value={dbgItemQualF} onChange={e => { setDbgItemQualF(e.target.value); setDbgPickedItem(""); }}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                  <option value="全部">全部品阶</option>
                  {["白","绿","蓝","紫","橙","红"].map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <select value={dbgPickedItem} onChange={e => setDbgPickedItem(e.target.value)}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11, minWidth: 120 }}>
                  <option value="">选物品…</option>
                  {CATALOG.filter(it =>
                    (dbgItemCatF === "全部" || it.category === dbgItemCatF) &&
                    (dbgItemQualF === "全部" || it.quality === dbgItemQualF)
                  ).map(it => <option key={it.name} value={it.name}>{it.name}（{it.quality}·{CATEGORY_LABEL[it.category] || it.category}）</option>)}
                </select>
                <span onClick={() => {
                  if (!dbgPickedItem) return;
                  const entry = CATALOG_INDEX[dbgPickedItem];
                  if (!entry) return;
                  const item = makeCatalogItem(entry); // 用具名物的真实数值/特效/描述
                  setInv(v => [...v, item]);
                  addLog([{ t: "sys", text: `  [调试] 获得「${item.name}」（${item.quality}·${CATEGORY_LABEL[item.category] || item.category}）` }]);
                  setDbgPickedItem("");
                }}
                  style={{ cursor: "pointer", fontSize: 10, color: dbgPickedItem ? "#8ac48a" : "#3a3830", padding: "2px 8px", border: `1px solid ${dbgPickedItem ? "#2a4a2a" : "#1a1d2e"}`, borderRadius: 3, userSelect: "none" }}
                >增加</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ width: 40, color: "#6ec6c6", flexShrink: 0 }}>自定义</span>
                <input type="text" value={dbgItemName} onChange={e => setDbgItemName(e.target.value)} placeholder="物品名"
                  style={{ width: 100, background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }} />
                <select value={dbgItemCat} onChange={e => setDbgItemCat(e.target.value)}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                  {["weapon","armor","accessory","misc"].map(c => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
                </select>
                <select value={dbgItemQuality} onChange={e => setDbgItemQuality(e.target.value)}
                  style={{ background: "#10121a", border: "1px solid #2a2d3a", color: "#c8bfa0", borderRadius: 3, padding: "2px 5px", fontSize: 11 }}>
                  {["白","绿","蓝","紫","橙","红"].map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <span onClick={() => {
                  if (!dbgItemName.trim()) return;
                  const item = makeItem({ name: dbgItemName.trim(), category: dbgItemCat, quality: dbgItemQuality });
                  setInv(v => [...v, item]);
                  addLog([{ t: "sys", text: `  [调试] 获得「${item.name}」（${item.quality}·${CATEGORY_LABEL[dbgItemCat] || dbgItemCat}）` }]);
                  setDbgItemName("");
                }}
                  style={{ cursor: "pointer", fontSize: 10, color: dbgItemName.trim() ? "#8ac48a" : "#3a3830", padding: "2px 8px", border: `1px solid ${dbgItemName.trim() ? "#2a4a2a" : "#1a1d2e"}`, borderRadius: 3, userSelect: "none" }}
                >增加</span>
              </div>
            </div>
          )}

          {/* ── 切磋确认：邀战叙事跑完后，点确认才真正开打，留一步反悔余地 ── */}
          {duelPending && (
            <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(196,80,68,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#c8bfa0", fontSize: "12px", flex: 1 }}>是否与「{duelPending.name}」正式切磋？一旦开打，就要见真章了。</span>
              <span onClick={confirmDuel} style={{ cursor: "pointer", fontSize: "11.5px", padding: "4px 12px", borderRadius: 4, color: "#0a0c14", background: "#c45044", border: "1px solid #c45044" }}>确认切磋</span>
              <span onClick={cancelDuel} style={{ cursor: "pointer", fontSize: "11.5px", padding: "4px 12px", borderRadius: 4, color: "#8a8a7a", border: "1px solid #2a2d3a" }}>算了</span>
            </div>
          )}

          {/* ── 建筑面板最小化条：收起时只留一行提示，点击可重新展开 ── */}
          {(activeBuilding || tradingShop) && buildingPanelMinimized && (
            <div
              onClick={() => setBuildingPanelMinimized(false)}
              style={{ flexShrink: 0, padding: "6px 16px", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(255,255,255,0.03)", cursor: "pointer", fontSize: 11.5, color: "#8ac8b8", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>▸ {activeBuilding?.name || tradingShop?.shopName}（已最小化，点击展开）</span>
            </div>
          )}

          {/* ── 建筑/交易内联功能区（"上"：功能按钮，高度封顶约1/3列高，点开才占地方）── */}
          {(activeBuilding || tradingShop) && !buildingPanelMinimized && (
            <div style={{ flexShrink: 0, maxHeight: "36vh", overflowY: "auto", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(255,255,255,0.02)" }}>
              {/* 最小化入口：跟每个面板自己的"× 关闭"平级，点击收起渲染区但保留 activeBuilding 状态 */}
              <div
                onClick={() => setBuildingPanelMinimized(true)}
                style={{ padding: "4px 16px", fontSize: 10.5, color: "#5a5a4a", cursor: "pointer", textAlign: "right" }}
              >
                ▾ 最小化
              </div>
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.INN && (
                <InnScreen building={activeBuilding} char={char} time={time} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onRest={handleBuildingInn} onHeal={handleBuildingHeal} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.HOSPITAL && (
                <InnScreen building={activeBuilding} char={char} time={time} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onRest={handleBuildingInn} onHeal={handleBuildingHeal} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.WUGUAN && (
                <WuguanScreen building={activeBuilding} char={char} skills={skills} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onBuySkill={handleBuySkill} onBreakthrough={handleSkillBreakthrough} />
              )}
              {activeBuilding && (activeBuilding.type === BUILDING_TYPE.SHOP || activeBuilding.type === BUILDING_TYPE.SMITHY || activeBuilding.type === BUILDING_TYPE.ANTIQUE || activeBuilding.type === BUILDING_TYPE.MEDICINE || activeBuilding.type === BUILDING_TYPE.CLOTH || activeBuilding.type === BUILDING_TYPE.JEWELRY || activeBuilding.type === BUILDING_TYPE.GROCERY || activeBuilding.type === BUILDING_TYPE.BLACKMARKET || activeBuilding.type === BUILDING_TYPE.SECTSHOP) && (() => {
                const shopData = rollShopStock(activeBuilding.shopKey, time) || buildShopInventory(activeBuilding.shopKey);
                if (!shopData) return null;
                const isKarma = shopData.currency === "karma";
                return (
                  <TradingScreen inline shopName={shopData.shopName} shopItems={shopData.items}
                    playerInv={inv} playerMoney={isKarma ? (dao.karma || 0) : (char.money || 0)}
                    playerWit={effectiveSpecialNow?.智谋 ?? 5}
                    zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onInspect={inspectItem}
                    onBuy={(item) => { if (isKarma) { if ((dao.karma||0)<item.buyPrice) return; setDao(d=>({...d,karma:d.karma-item.buyPrice})); } else { if ((char.money||0)<item.buyPrice) return; setChar(c=>({...c,money:c.money-item.buyPrice})); if (shopData.karmaLoss) setDao(d=>({...d,karma:(d.karma||0)-shopData.karmaLoss})); } setInv(prev=>[...prev,{...item,id:`${item.name}_${Date.now()}`,equipped:false}]); addLog([{t:"item",text:`  购得「${item.name}」（${item.quality}），花费${item.buyPrice}${isKarma?"功德":"两"}。`}]); jotNote({ text:`购得「${item.name}」，花${item.buyPrice}${isKarma?"功德":"两"}。`, source: NOTE_SOURCE.DUMB }); }}
                    onSell={(item) => { if (item.equipped||isKarma) return; setInv(prev=>prev.filter(i=>(typeof i==="object"?i.id:i)!==item.id)); setChar(c=>({...c,money:(c.money||0)+item.sellPrice})); addLog([{t:"item",text:`  卖出「${item.name}」，得${item.sellPrice}两。`}]); jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB }); }}
                  />
                );
              })()}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.ESCORT && !activeBuilding.shopKey && (
                <EscortScreen building={activeBuilding} char={char} flags={flags} questProgress={questProgress}
                  currentRoom={room.name} zoneTheme={zoneTheme} inline onClose={() => setActiveBuilding(null)}
                  onAcceptEscort={handleAcceptEscort} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.ESCORT && activeBuilding.shopKey && (() => {
                const shopData = rollShopStock(activeBuilding.shopKey, time) || buildShopInventory(activeBuilding.shopKey);
                return shopData ? (
                  <TradingScreen inline shopName={shopData.shopName} shopItems={shopData.items}
                    playerInv={inv} playerMoney={char.money||0} playerWit={effectiveSpecialNow?.智谋 ?? 5} zoneTheme={zoneTheme} onInspect={inspectItem}
                    onClose={() => setActiveBuilding(null)}
                    onBuy={(item)=>{if((char.money||0)<item.buyPrice)return;setChar(c=>({...c,money:c.money-item.buyPrice}));setInv(prev=>[...prev,{...item,id:`${item.name}_${Date.now()}`,equipped:false}]);addLog([{t:"item",text:`  购得「${item.name}」，花费${item.buyPrice}两。`}]); jotNote({ text:`购得「${item.name}」，花${item.buyPrice}两。`, source: NOTE_SOURCE.DUMB });}}
                    onSell={(item)=>{if(item.equipped)return;setInv(prev=>prev.filter(i=>(typeof i==="object"?i.id:i)!==item.id));setChar(c=>({...c,money:(c.money||0)+item.sellPrice}));addLog([{t:"item",text:`  卖出「${item.name}」，得${item.sellPrice}两。`}]); jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB });}}
                  />
                ) : null;
              })()}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.GAMBLING && (
                <GamblingScreen building={activeBuilding} char={char} flags={flags} time={time} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onGamble={handleGamble} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.PIGEON_COOP && (
                <PigeonCoopScreen building={activeBuilding} char={char} flags={flags} time={time} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onCollect={handleCollectPigeons} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.TRANSPORT && (
                <TransportScreen building={activeBuilding} char={char} mapData={mapData} currentRoom={room.name} inline
                  inv={inv} metNpcs={varTree.世界?.曾经出现人物 || []} onBuyPigeon={buyPigeon} onSendLetter={handlePostSend}
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onTravel={handleTravel} />
              )}
              {activeBuilding && (activeBuilding.type === BUILDING_TYPE.RESTAURANT || activeBuilding.type === BUILDING_TYPE.THEATER) && !showBasement && (
                <ServiceScreen building={activeBuilding} char={char} time={time} flags={flags} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onOrder={handleServiceOrder}
                  onEnterBasement={() => setShowBasement(true)} />
              )}
              {showBasement && (
                <BasementScreen char={char} time={time} zoneTheme={zoneTheme} inline
                  onClose={() => setShowBasement(false)} onOrder={handleServiceOrder} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.TEMPLE && (
                <TempleScreen building={activeBuilding} char={char} dao={dao} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onPray={handlePray} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.LIBRARY && (
                <LibraryScreen building={activeBuilding} char={char} skills={skills} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onReadBook={handleReadBook} onBuyBook={handleBuyBook} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.BANK && (
                <BankScreen building={activeBuilding} char={char} time={time} deposit={deposit} depositedAt={depositedAt} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onDeposit={handleDeposit} onWithdraw={handleWithdraw} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.PAWN && (
                <PawnScreen building={activeBuilding} char={char} inv={inv} pledgedItems={pledgedItems} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onPledge={handlePledge} onRedeem={handleRedeem} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.BOUNTY && (
                <BountyScreen building={activeBuilding} flags={flags} questProgress={questProgress} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onAcceptBounty={handleAcceptBounty} onClaimBounty={handleClaimBounty} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.FORGE && (
                <ForgeScreen building={activeBuilding} char={char} time={time} flags={flags} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onCommission={handleForgeCommission} onPickup={handleForgePickup} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.GAMBLESTONE && (
                <GambleStoneScreen building={activeBuilding} char={char} time={time}
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)}
                  roomNpcs={(room.npcs || []).filter(n => (n.gambleBidder || n.name === "兰姐" || n.name === "温掌柜") && isNpcVisibleInInnerRoom(room.name, innerRoomName, n))}
                  negotiation={gambleNegotiation}
                  onTalk={handleGambleTalk} onSettle={handleGambleSettle} onInspect={handleGambleInspect} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.TEAHOUSE && (
                <TeahouseScreen building={activeBuilding} char={char} flags={flags} time={time} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onListenRumor={handleListenRumor} />
              )}
              {tradingShop && (
                <TradingScreen inline shopName={tradingShop.shopName} shopItems={tradingShop.items}
                  playerInv={inv} playerMoney={char.money || 0} playerWit={effectiveSpecialNow?.智谋 ?? 5} zoneTheme={zoneTheme} onInspect={inspectItem}
                  onClose={() => setTradingShop(null)}
                  onBuy={(item) => { if ((char.money || 0) < item.buyPrice) return; setChar(c => ({ ...c, money: c.money - item.buyPrice })); setInv(prev => [...prev, { ...item, id: `${item.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, equipped: false }]); addLog([{ t: "item", text: `  你花费${item.buyPrice}两，购得「${item.name}」。` }]); jotNote({ text:`购得「${item.name}」，花${item.buyPrice}两。`, source: NOTE_SOURCE.DUMB }); }}
                  onSell={(item) => { if (item.equipped) return; setInv(prev => prev.filter(i => (typeof i === "object" ? i.id : i) !== item.id)); setChar(c => ({ ...c, money: (c.money || 0) + item.sellPrice })); addLog([{ t: "item", text: `  你卖出「${item.name}」，得银两${item.sellPrice}两。` }]); jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB }); }}
                />
              )}
            </div>
          )}

          <div style={{ flex: 1, padding: "20px 32px", overflowY: "auto", overflowX: "hidden", fontSize: "15px", lineHeight: 2.0, letterSpacing: "0.3px" }}>
            {(() => {
              // 按"一问一答"分组：玩家的一条 cmd 开启一个新轮次，后面紧跟的所有内容
              // （desc/stat/affection/sys/err 等）都归进这一组，直到下一条 cmd 出现为止。
              // 命令要跟自己的反馈严格对应，不能把不相关的内容混进别的框——
              // room（场景切换标题）和显式标记 standalone 的条目（比如"⏳已入队"，
              // 它说的是"系统现在正忙"，既不属于正在处理的上一条命令，也不属于
              // 还没执行的这一条，谁的框都不该进）真正独立成行，不并入任何框。
              const groups = [];
              let current = null;
              for (const entry of log) {
                const isStandaloneSys = entry.t === "room" || entry.standalone;
                if (isStandaloneSys) {
                  if (current) { groups.push(current); current = null; }
                  groups.push({ standalone: entry });
                } else if (entry.t === "cmd") {
                  if (current) groups.push(current);
                  current = { cmd: entry, replies: [] };
                } else {
                  if (!current) current = { cmd: null, replies: [] };
                  current.replies.push(entry);
                }
              }
              if (current) groups.push(current);

              return groups.map((g, gi) => {
                if (g.standalone) {
                  return <LogEntry key={gi} entry={g.standalone} color={clr[g.standalone.t] || clr.desc} onAction={act} isDayMode={isDayMode} />;
                }
                // 折叠逻辑：用 cmd 在 log 数组里的位置作为稳定 key
                const cmdIdx = g.cmd ? log.indexOf(g.cmd) : -1;
                const canCollapse = g.cmd && g.replies.length > 0;
                const collapsed = canCollapse && collapsedGroups.has(cmdIdx);
                const toggleCollapse = canCollapse ? () => setCollapsedGroups(prev => {
                  const next = new Set(prev);
                  if (next.has(cmdIdx)) next.delete(cmdIdx); else next.add(cmdIdx);
                  return next;
                }) : undefined;

                return (
                  <div
                    key={gi}
                    style={{
                      border: `1px solid ${zoneTheme.border}`,
                      borderRadius: 6,
                      marginBottom: 10,
                      background: "rgba(255,255,255,0.015)",
                      overflow: "hidden",
                    }}
                  >
                    {g.cmd && (
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "8px 12px",
                          cursor: canCollapse ? "pointer" : "default",
                          userSelect: "none",
                        }}
                        onClick={toggleCollapse}
                      >
                        <span style={{ color: zoneTheme.accentDim, fontSize: "10px", flexShrink: 0, width: 10 }}>
                          {canCollapse ? (collapsed ? "▶" : "▼") : ""}
                        </span>
                        <div style={{ flex: 1 }}>
                          <LogEntry entry={g.cmd} color={clr[g.cmd.t] || clr.desc} onAction={act} isDayMode={isDayMode} />
                        </div>
                        {collapsed && (
                          <span style={{ color: zoneTheme.accentDim, fontSize: "10px", flexShrink: 0 }}>
                            +{g.replies.length}条
                          </span>
                        )}
                      </div>
                    )}
                    {!collapsed && g.replies.length > 0 && (
                      <div style={{ padding: g.cmd ? "0 12px 8px 26px" : "8px 12px" }}>
                        {g.replies.map((entry, ri) => (
                          <LogEntry key={ri} entry={entry} color={clr[entry.t] || clr.desc} onAction={act} isDayMode={isDayMode} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {loading && (
              <div style={{
                color: zoneTheme.accentDim, padding: "6px 0", display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>▌</span>
                <span>引擎运转中</span>
                <span style={{ display: "inline-flex", gap: 2 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{
                      width: 4, height: 4, borderRadius: "50%", background: zoneTheme.accent,
                      animation: `pulse 0.8s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </span>
                {queueCount > 0 && (
                  <span style={{ color: "#c4a040", fontSize: "10.5px" }}>队列 {queueCount}</span>
                )}
              </div>
            )}
            {pendingTalks > 0 && <div style={{ color: "#e0a0d0", animation: "pulse 1.2s ease-in-out infinite" }}>  {pendingTalks} 条对话处理中...</div>}
            {inspecting && (
              <div style={{ color: zoneTheme.accentDim, padding: "6px 0", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>▌</span>
                <span>端详「{inspecting}」中</span>
                <span style={{ display: "inline-flex", gap: 2 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: zoneTheme.accent, animation: `pulse 0.8s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </span>
              </div>
            )}
            <div ref={logEnd} />
          </div>

          {(loading || pendingTalks > 0) && waitSecs > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 14px",
              borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0,
              background: waitSecs >= 30 ? "#3a1a1a" : waitSecs >= 12 ? "#3a2a12" : "#12100a",
              fontSize: "11.5px",
              color: waitSecs >= 30 ? "#e08a6a" : waitSecs >= 12 ? "#e0b060" : zoneTheme.textDim,
            }}>
              <span>{waitSecs >= 30 ? "🐢" : "⏳"}</span>
              <span>
                {waitSecs < 12 ? `思索中… 已等待 ${waitSecs}s`
                  : waitSecs < 30 ? `有点慢，已等待 ${waitSecs}s（网络或模型繁忙，请再稍候）`
                  : `已等待 ${waitSecs}s，可能卡住了——超过 60s 会自动超时报错，届时可重试或去设置换更快的模型`}
              </span>
            </div>
          )}
          {/* 任务提示条（本轮新增）：把当前所有可推进 stage 手写的 playerHint 显示在
              叙事框最下面，告诉玩家"这一步该往哪走/怎么做"。与给AI看的 description 分离。
              没写 playerHint 的 stage 不显示（增量补写期间不会报错）。 */}
          {availableQuestsHere.some(e => e.stage.playerHint) && (
            <div style={{
              padding: "6px 14px", borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0,
              background: "#0c0f14",
            }}>
              {availableQuestsHere.filter(e => e.stage.playerHint).map(entry => (
                <div key={entry.quest.id} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: "10.5px", lineHeight: 1.6 }}>
                  <span style={{ color: "#6a90c0", flexShrink: 0 }}>💡 {entry.quest.title}</span>
                  <span style={{ color: "#8a94a8" }}>{entry.stage.playerHint}</span>
                </div>
              ))}
            </div>
          )}

          {/* ❢ 触发框：纯推进节点（无分支选项）。金色调，点一下即推进。 */}
          {availableQuestsHere.some(e => !e.stage.choices?.length) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
              borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, flexWrap: "wrap", rowGap: 6,
              background: "#141008",
            }}>
              <span style={{ color: "#f0c060", fontSize: "11px", flexShrink: 0 }}>❢ 此处可推进</span>
              {availableQuestsHere.filter(e => !e.stage.choices?.length).map(entry => (
                <span
                  key={entry.quest.id}
                  onClick={() => triggerQuestFromPanel(entry)}
                  title={entry.stage.description}
                  style={{
                    cursor: "pointer", color: "#f0c060", padding: "2px 10px",
                    border: "1px solid #4a3a1a", borderRadius: 3, fontSize: "10.5px",
                    background: "#1a1408", whiteSpace: "nowrap",
                  }}
                >
                  ❢ {entry.quest.title}{entry.quest.giver ? `（${entry.quest.giver}）` : ""}
                </span>
              ))}
            </div>
          )}

          {/* ◈ 抉择框：分支任务的行动选项。绿色调、独立成行，与上面的触发框拉开区分度。 */}
          {availableQuestsHere.some(e => e.stage.choices?.length) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
              borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, flexWrap: "wrap", rowGap: 6,
              background: "#0e1410",
            }}>
              <span style={{ color: "#8ac48a", fontSize: "11px", flexShrink: 0 }}>◈ 行动抉择</span>
              {availableQuestsHere.filter(e => e.stage.choices?.length).map(entry => (
                <span key={entry.quest.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: "#c8bfa0", fontSize: "10.5px" }}>{entry.quest.title}：</span>
                  {entry.stage.choices
                    .filter(choice => {
                      // 部分选项有前置条件（如"亮出XX信物"需先完成对应任务）才该出现，
                      // 不满足就不渲染这个按钮，而不是渲染出来点了却不该生效。
                      // requiresQuestCompleted 是"全部都要"（AND），requiresAnyOf 是"任一即可"（OR）。
                      const isDone = (qid) => questProgress[qid]?.status === "completed";
                      if (choice.requiresQuestCompleted) {
                        const need = Array.isArray(choice.requiresQuestCompleted) ? choice.requiresQuestCompleted : [choice.requiresQuestCompleted];
                        if (!need.every(isDone)) return false;
                      }
                      if (choice.requiresAnyOf?.length && !choice.requiresAnyOf.some(isDone)) return false;
                      return true;
                    })
                    .map(choice => {
                      // 按选项性质给个小图标提示玩家这一步会"真的"发生什么：
                      // ⚔进切磋、💬进辩论、○直接了事
                      const icon = choice.resolve === "combat" ? "⚔ " : choice.resolve === "talk" ? "💬 " : "";
                      return (
                        <span
                          key={choice.flag}
                          onClick={() => triggerQuestChoice(entry, choice)}
                          title={choice.resolve === "combat" ? "会进入切磋，打赢才算数" : choice.resolve === "talk" ? "会进入对话，说赢才算数" : ""}
                          style={{
                            cursor: "pointer", color: "#a8d8a8", padding: "2px 10px",
                            border: "1px solid #2a4a2a", borderRadius: 3, fontSize: "10.5px",
                            background: "#0e1a0e", whiteSpace: "nowrap",
                          }}
                        >
                          {icon}{choice.label}
                        </span>
                      );
                    })}
                </span>
              ))}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${zoneTheme.border}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {[["action", "◈ 行动", zoneTheme.accent], ["talk", "◎ 对话", uiGreen], ["whisper", "◆ 私聊旁白", uiPink]].map(([id, label, color]) => (
              <span
                key={id}
                onClick={() => { setInteractMode(id); setTalkTarget(null); setActiveTarget(null); setPigeonTarget(null); }}
                style={{
                  cursor: "pointer", fontSize: "10.5px", padding: "3px 8px", borderRadius: 3, userSelect: "none",
                  color: interactMode === id ? zoneTheme.bg : color,
                  background: interactMode === id ? color : zoneTheme.bgPanel,
                  border: `1px solid ${interactMode === id ? color : zoneTheme.border}`,
                }}
              >{label}</span>
            ))}
            <span
              onClick={() => setNsfwOn(x => !x)}
              title={nsfwOn ? "已开启：NSFW 写作规则已注入" : "已关闭：点击开启 NSFW 写作规则"}
              style={{
                cursor: "pointer", fontSize: "10.5px", padding: "3px 8px", borderRadius: 3, userSelect: "none", fontWeight: "bold", letterSpacing: "0.5px",
                color: nsfwOn ? zoneTheme.bg : zoneTheme.textDim,
                background: nsfwOn ? uiCrimson : "transparent",
                border: `1px solid ${nsfwOn ? uiCrimson : zoneTheme.border}`,
                marginRight: 8,
              }}
            >NSFW</span>
            <span style={{ flex: 1 }} />
            {/* 注：运气·内功+1 / 拆招·外功+1 两个升级按钮已移至右栏「内功外功」区，
                挂在对应数值行后面，就近操作。这里只留打坐（恢复气血，非升级）。 */}
            <span
              onClick={meditate}
              title="打坐运功：消耗1回合，恢复部分气血"
              style={{
                cursor: "pointer", fontSize: "10.5px", padding: "3px 8px", borderRadius: 3,
                color: justMeditated ? "#e8d4ff" : "#b48adf",
                background: justMeditated ? "#3a2a5a" : zoneTheme.bgPanel,
                border: `1px solid ${justMeditated ? "#6a4a9a" : "#2a1d3a"}`,
                transform: justMeditated ? "scale(0.95)" : "scale(1)",
                transition: "all 0.15s ease",
              }}
            >⊙ 打坐{justMeditated ? "…" : ""}</span>
          </div>

          {/* ── NPC 人选选择器：点选某人 → 对话/行动聚焦此人；不选=全人物发给AI ── */}
          {interactMode !== "whisper" && interactMode !== "pigeon" && room.npcs.length > 0 && (
            <div style={{
              padding: "4px 14px", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              borderTop: `1px solid ${zoneTheme.border}`, flexWrap: "wrap",
            }}>
              <span style={{ color: zoneTheme.textDim, fontSize: "10px", flexShrink: 0 }}>人选：</span>
              <span
                onClick={() => { setActiveTarget(null); setTalkTarget(null); }}
                style={{
                  cursor: "pointer", fontSize: "10.5px", padding: "2px 7px", borderRadius: 3, userSelect: "none",
                  color: activeTarget ? zoneTheme.textDim : zoneTheme.accent,
                  background: activeTarget ? "transparent" : zoneTheme.accent + "20",
                  border: `1px solid ${activeTarget ? zoneTheme.border : zoneTheme.accent}`,
                }}
              >全部</span>
              {room.npcs.map(n => {
                const isSel = activeTarget === n.name;
                return (
                  <span
                    key={n.name}
                    onClick={() => { setActiveTarget(n.name); if (interactMode !== "action") setTalkTarget(n.name); }}
                    title={isSel ? "点击「全部」取消选定" : `聚焦 ${n.name}`}
                    style={{
                      cursor: "pointer", fontSize: "10.5px", padding: "2px 7px", borderRadius: 3, userSelect: "none",
                      color: isSel ? zoneTheme.accent : zoneTheme.textDim,
                      background: isSel ? zoneTheme.accent + "20" : "transparent",
                      border: `1px solid ${isSel ? zoneTheme.accent : zoneTheme.border}`,
                    }}
                  >{n.name}</span>
                );
              })}
            </div>
          )}

          {interactMode === "pigeon" && pigeonTarget && (() => {
            const { delay, loc } = pigeonDelayShichen(pigeonTarget);
            return (
              <div style={{ padding: "6px 16px 0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, fontSize: "11px" }}>
                <span style={{ color: "#c4a040" }}>🕊 飞鸽传书 · 致「{pigeonTarget}」</span>
                <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>信往{loc}，约 {delay} 时辰后有回音</span>
                <span style={{ flex: 1 }} />
                <span onClick={() => { setPigeonTarget(null); setInteractMode("action"); }} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "10px" }}>× 取消</span>
              </div>
            );
          })()}
          <div style={{
            borderTop: interactMode === "whisper" ? "1px solid #4a2a4a" : interactMode === "talk" ? "1px solid #1a3a1a" : interactMode === "pigeon" ? "1px solid #4a3a1a" : `1px solid ${zoneTheme.border}`,
            background: interactMode === "whisper" ? "rgba(224,160,208,0.06)" : interactMode === "talk" ? "rgba(138,196,138,0.06)" : interactMode === "pigeon" ? "rgba(196,160,64,0.06)" : "transparent",
            padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <span style={{
              color: interactMode === "whisper" ? "#e0a0d0" : interactMode === "talk" ? "#8ac48a" : interactMode === "pigeon" ? "#c4a040" : zoneTheme.accent,
              flexShrink: 0, fontSize: "13px",
            }}>{interactMode === "pigeon" ? "🕊" : "▸"}</span>
            <input
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              placeholder={
                interactMode === "action" && loading ? "..." :
                interactMode === "pigeon" ? `提笔给「${pigeonTarget || "…"}」写信，写罢按回车放飞信鸽…` :
                interactMode === "whisper" ? (pendingTalks > 0 ? "旁白回话中…可先打字，待她说完再发" : "对旁白说些什么…（不消耗回合）") :
                interactMode === "talk" ? (pendingTalks > 0 ? `跟房间里的人说句话…（${pendingTalks}条处理中，可继续发）` : "跟房间里的人说句话…（不消耗回合）") :
                "输入行动指令…（消耗1回合）"
              }
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: zoneTheme.text, fontFamily: "inherit", fontSize: "13px" }}
            />
          </div>
        </div>

        <div style={isMobile
          ? { position: "fixed", top: 0, bottom: 0, right: 0, width: "82vw", maxWidth: 340, zIndex: 41,
              transform: mobileDrawer === "right" ? "translateX(0)" : "translateX(100%)",
              transition: "transform .28s ease", boxShadow: mobileDrawer === "right" ? "-4px 0 24px rgba(0,0,0,.6)" : "none",
              background: zoneTheme.bg, display: "flex", flexDirection: "column", overflow: "hidden" }
          : { flex: 30, ...S.panel, borderRight: "none" }}>
          {isMobile && (
            <div onClick={() => setMobileDrawer(null)} style={{ padding: "8px 12px", color: zoneTheme.textDim, cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>✕ 关闭</div>
          )}
          <div style={S.label}>侠客</div>
          <div style={S.scroll}>
            {/* 头像区：2:3 竖版头像（本轮换成唐卡高饱和厚涂风格8连图，藏地高原背景+金色
                描边）+ 姓名/性别 + 换头像入口。头像图放 public/portraits/player/，
                文件名用性别兜底（male.png/female.png/other.png，other=朔风独行刀客默认款），
                玩家自设的存 localStorage。 */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
              <div
                onClick={() => setShowAvatarPicker(true)}
                title="点击更换头像"
                style={{
                  width: 90, aspectRatio: "2/3", flexShrink: 0, borderRadius: 6, overflow: "hidden",
                  border: `1px solid ${zoneTheme.border}`, background: "#0c0e14", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                }}
              >
                {playerAvatar ? (
                  <img src={playerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: zoneTheme.textDim, fontSize: "10px", textAlign: "center", lineHeight: 1.6 }}>点击<br/>设置头像</span>
                )}
                <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: "9px", textAlign: "center", color: "#e8dcc0", background: "rgba(0,0,0,0.55)", padding: "1px 0" }}>换像</span>
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <div style={{ fontSize: "16px", color: zoneTheme.accent, fontWeight: "bold", letterSpacing: "1px", marginBottom: 3 }}>{char.name || "无名少侠"}</div>
                  {/* 体貌入口：挨着姓名，点开是可编辑的身体档案（详见 bodyProfile.js） */}
                  <span
                    onClick={() => setShowBody(true)}
                    title="体貌 · 身量体型与身体细节，动作描写和私聊都会照着写"
                    style={{
                      marginLeft: "auto", cursor: "pointer", fontSize: "10px", padding: "1px 6px",
                      borderRadius: 3, border: `1px solid ${zoneTheme.border}`,
                      color: bodyProfileFilled(char.bodyProfile).total ? zoneTheme.accent : zoneTheme.textDim,
                    }}
                  >
                    ◈ 体貌{bodyProfileFilled(char.bodyProfile).total ? ` ${bodyProfileFilled(char.bodyProfile).total}` : ""}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: zoneTheme.textDim, marginBottom: 8 }}>{char.gender || "男"}　少侠</div>
                <div style={{ fontSize: "11.5px", marginBottom: 3 }}>气血 <span style={{ color: char.hp[0] <= 30 ? "#c45044" : "#c8bfa0" }}>{bar(char.hp[0], char.hp[1], 8)}</span></div>
                <div style={{ fontSize: "11.5px", marginBottom: 5 }}><span style={{ color: char.hp[0] <= 30 ? "#c45044" : "#888" }}>{char.hp[0]}/{char.hp[1]}</span></div>
                <div style={{ fontSize: "11.5px", marginBottom: 3 }}>经验 <span style={{ color: "#d4a853" }}>{exp}</span>　潜能 <span style={{ color: "#b48adf" }}>{pot}</span></div>
                <div style={{ fontSize: "11.5px" }}>银两 <span style={{ color: "#e8c468" }}>{char.money || 0}</span> 两</div>
                <div style={{ fontSize: "11.5px", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>信鸽 <span style={{ color: "#c4a040" }}>{char.pigeons || 0}</span> 只</span>
                  <span
                    onClick={() => inspectItem("pigeon", "信鸽", `现有${char.pigeons || 0}只`, null, { worldLook: true })}
                    title="查看：信鸽是什么、能做什么"
                    style={{
                      cursor: inspecting === "信鸽" ? "wait" : "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 3,
                      color: zoneTheme.textDim, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`,
                      opacity: inspecting === "信鸽" ? 0.6 : 1,
                    }}
                  >查看{inspecting === "信鸽" ? "…" : ""}</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              {(() => {
                const es = computeEquippedStats(inv);
                return <div style={{ fontSize: "11px", color: "#8a8a7a" }}>装备总加成：攻{es.totalAtk} 防{es.totalDef} 饰品+{es.accessoryBonus.toFixed(1)}</div>;
              })()}
            </div>

            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10, display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>内功外功</div>
                <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>内功 <span style={{ color: "#b48adf" }}>{bar(char.neigong ?? 0, 100, 6)}</span> <span style={{ color: "#888" }}>{char.neigong ?? 0}</span></span>
                  <span
                    onClick={trainNeigong}
                    title={`运气打坐：消耗${trainCost(char.neigong ?? 0)}点潜能，内功+1（现有潜能${pot}）`}
                    style={{
                      cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 3,
                      color: "#8ab4d4", background: zoneTheme.bgPanel, border: "1px solid #1d2d3a", whiteSpace: "nowrap",
                    }}
                  >+1（{trainCost(char.neigong ?? 0)}潜能）</span>
                </div>
                <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span>外功 <span style={{ color: "#d85a30" }}>{bar(char.waigong ?? 0, 100, 6)}</span> <span style={{ color: "#888" }}>{char.waigong ?? 0}</span></span>
                  <span
                    onClick={trainWaigong}
                    title={`拆招练武：消耗${trainCost(char.waigong ?? 0)}点潜能，外功+1（现有潜能${pot}）`}
                    style={{
                      cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 3,
                      color: "#d88a5a", background: zoneTheme.bgPanel, border: "1px solid #3a2a1d", whiteSpace: "nowrap",
                    }}
                  >+1（{trainCost(char.waigong ?? 0)}潜能）</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>七维</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: "11px" }}>
                  {Object.entries(char.special || {}).map(([k, v]) => (
                    <div key={k}>{k}<span style={{ color: "#c8bfa0" }}>{v}</span></div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
              <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>武学 <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>点名字看介绍 · 点圈运功上阵（每类只运一门，▶已上阵）</span></div>
              {skills.map((s, i) => {
                const q = s.quality || "白"; // 老存档没存品阶的按白档兜底
                const qc = QUALITY_COLOR[q] || "#c8bfa0";
                return (
                  <div key={i} style={{ marginBottom: 4, padding: "3px 0", borderLeft: s.active ? `2px solid ${qc}` : "2px solid transparent", paddingLeft: 6, opacity: s.active ? 1 : 0.62 }}>
                    <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        onClick={() => setSkills(sk => {
                          const tgt = sk[i];
                          const tType = tgt.moveType;
                          const turningOn = !tgt.active;
                          // 运功=装备上阵：点亮一门时，同类型(攻/防/状)的其它武学自动熄灭；
                          // 再点一下可取消上阵，该类型退回白色基础招。
                          return sk.map((ss, j) => {
                            if (j === i) return { ...ss, active: turningOn };
                            if (turningOn && tType && ss.moveType === tType) return { ...ss, active: false };
                            return ss;
                          });
                        })}
                        style={{ cursor: "pointer", color: s.active ? qc : "#6a6a5a" }}
                        title={s.active ? "已上阵，点击卸下" : "运功上阵"}
                      >{s.active ? "▶" : "○"}</span>
                      <span
                        onClick={() => inspectItem("skill", s.name, s.fixed ? `${q}品·授业绝学（完整）` : `${q}品·${s.stage} Lv.${s.level}`, null, { worldLook: true })}
                        style={{ cursor: inspecting === s.name ? "wait" : "pointer", color: qc, fontWeight: s.active ? "bold" : "normal", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim, opacity: inspecting === s.name ? 0.6 : 1 }}
                      >{s.name}{s.fixed ? "" : `·${s.stage}`}{inspecting === s.name ? "…" : ""}</span>
                      <span style={{ fontSize: "9.5px", color: qc, opacity: 0.9 }}>（{q}品）</span>
                      {s.fixed && (() => {
                        // 按来源(source)显示不同小标签：授业绝学(拜高手)/通用招(拜平民)/偷师所得。
                        // 老存档没存 source 字段的，兜底按"拜师"处理（此前唯一的固定招来源）。
                        const src = s.source || "拜师";
                        const label = src === "偷师" ? "偷" : src === "拜师·通用" ? "通" : "授";
                        const title = src === "偷师" ? "偷师所得" : src === "拜师·通用" ? "拜师·通用招" : "拜师·授业绝学";
                        return <span title={title} style={{ fontSize: "9px", color: zoneTheme.textDim, border: `1px solid ${zoneTheme.border}`, borderRadius: 2, padding: "0 3px" }}>{label}</span>;
                      })()}
                    </div>
                    {s.fixed
                      ? <div style={{ fontSize: "10.5px", color: "#5a5a4a", paddingLeft: 18 }}>
                          {s.source === "偷师" ? "偷师所得 · 学即完整，无需修炼" : s.source === "拜师·通用" ? "拜师·通用招 · 学即完整，无需修炼" : "授业绝学 · 学即完整，无需修炼"}
                        </div>
                      : (() => {
                          const curIdx = STAGES.indexOf(s.stage);
                          const maxed = curIdx >= STAGES.length - 1;
                          const nextStage = maxed ? null : STAGES[curIdx + 1];
                          const cost = nextStage ? (STAGE_UP_COST[nextStage] ?? 12) : 0;
                          const afford = pot >= cost;
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 18, marginTop: 1 }}>
                              <span style={{ fontSize: "10px", color: "#7a7a6a" }}>
                                阶段 {curIdx + 1}/5 · {s.stage}
                              </span>
                              {maxed
                                ? <span style={{ fontSize: "10px", color: qc }}>✦ 登峰造极</span>
                                : <span
                                    onClick={() => afford && breakthroughSkill(s.id)}
                                    title={afford ? `潜心修炼：花${cost}潜能，${s.stage}→${nextStage}（现有潜能${pot}）` : `潜能不足，突破${nextStage}需${cost}点（现有${pot}）`}
                                    style={{
                                      cursor: afford ? "pointer" : "not-allowed", fontSize: "10px", padding: "1px 7px", borderRadius: 3,
                                      color: afford ? "#b48adf" : "#5a5a4a",
                                      background: afford ? zoneTheme.bgPanel : "transparent",
                                      border: `1px solid ${afford ? "#4a3a5a" : zoneTheme.border}`, userSelect: "none",
                                    }}
                                  >↑修炼·{nextStage}（{cost}潜能）</span>}
                            </div>
                          );
                        })()}
                  </div>
                );
              })}
            </div>

            {(() => {
              // 临阵招式：切磋时随身自带、但不在"武学"里作为可修炼门派的招式——
              // 包括系统按类型补齐的白档基础招（硬架/回气这类，缺哪类补哪类）和拜师授的招式。
              // 武学派生出的招（sourceSkill 有值，如三脚猫拳法）已在上面"武学"栏展示，这里不重复。
              const extras = (char.moveset || []).filter(m => !m.sourceSkill);
              if (!extras.length) return null;
              const TYPE_SHORT = { 攻击: "攻", 防御: "防", 状态: "状" };
              return (
                <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>临阵招式 <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>切磋自带补位 · 运功对应类型的武学即替换（回气永在，能量枯竭保命）</span></div>
                  {extras.map((m, i) => {
                    const q = m.quality || "白";
                    const qc = QUALITY_COLOR[q] || "#c8bfa0";
                    const origin = m.learnedFromMaster ? "授" : "基础";
                    return (
                      <div key={i} style={{ marginBottom: 3, fontSize: "11px", display: "flex", alignItems: "center", gap: 5, opacity: 0.92, paddingLeft: 6 }}>
                        <span style={{ fontSize: "9px", color: "#1a1206", background: qc, borderRadius: 2, padding: "0 3px", fontWeight: 700 }}>{TYPE_SHORT[m.type] || "?"}</span>
                        <span
                          onClick={() => inspectItem("skill", m.name, `${q}品·临阵招式（${origin}）`, null, { worldLook: true })}
                          style={{ cursor: inspecting === m.name ? "wait" : "pointer", color: qc, textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim, opacity: inspecting === m.name ? 0.6 : 1 }}
                        >{m.name}{inspecting === m.name ? "…" : ""}</span>
                        <span style={{ fontSize: "9.5px", color: qc, opacity: 0.9 }}>（{q}品）</span>
                        <span style={{ fontSize: "9px", color: zoneTheme.textDim }}>{origin}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
              <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>装备 <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>点物品切换装备/卸下</span></div>
              {[ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY].map(cat => {
                const itemsInCat = inv.filter(i => typeof i === "object" && i.category === cat);
                const equippedCount = itemsInCat.filter(i => i.equipped).length;
                return (
                  <div key={cat} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "10.5px", color: "#7a7a6a", marginBottom: 3 }}>
                      {CATEGORY_LABEL[cat]} <span style={{ color: zoneTheme.textDim }}>（{itemsInCat.length}件，{equippedCount}件已装备）</span>
                    </div>
                    {itemsInCat.length === 0 && <div style={{ fontSize: "10.5px", color: zoneTheme.textDim, paddingLeft: 8 }}>无</div>}
                    {itemsInCat.map(item => {
                      const statLabel = item.atk != null ? `攻${item.atk}` : item.def != null ? `防${item.def}` : item.bonus != null ? `+${item.bonus}` : "";
                      return (
                        <div
                          key={item.id}
                          onClick={() => setInv(v => toggleEquip(v, item.id))}
                          style={{
                            fontSize: "11px", cursor: "pointer", paddingLeft: 8, marginBottom: 2,
                            color: item.equipped ? QUALITY_COLOR[item.quality] : "#5a5a4a",
                            fontWeight: item.equipped ? "bold" : "normal",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.equipped ? "▶" : "○"} {item.name} <span style={{ fontSize: "9.5px" }}>({item.quality}{statLabel ? `·${statLabel}` : ""})</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
              <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>包袱 <span style={{ color: zoneTheme.textDim }}>{inv.length}件 · 点击看介绍</span></div>
              {inv.map((it, i) => {
                const isObj = typeof it === "object";
                const name = isObj ? it.name : it;
                // 品质兜底：像村口界石这类"本是场景地标、被当道具捡进背包"的半成品
                // 对象只有 name/id、没有 quality，直接读会显示成"(undefined)"。
                // 缺品质时按"白"处理，颜色和括号都不再露 undefined。
                const quality = isObj ? (it.quality || "白") : null;
                const color = isObj ? (QUALITY_COLOR[quality] || "#c4a040") : "#c4a040";
                const canConsume = !!((isObj && it.consumable) || CATALOG_INDEX[name]?.consumable);
                return (
                  <div
                    key={isObj ? (it.id || i) : i}
                    onClick={() => setActiveItemMenu({ item: it, mode: "inventory", canConsume })}
                    style={{ fontSize: "11.5px", color, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: color, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <span style={{ flex: 1 }}>· {name}{isObj ? ` (${quality})` : ""}{isObj && it.equipped ? " [已装备]" : ""}</span>
                    {canConsume && <span style={{ fontSize: "10px", color: zoneTheme.accentDim, flexShrink: 0 }}>⊙用</span>}
                    {/* 可装备之物给个显式提示：点开就能穿戴，不必再去上面的装备区找 */}
                    {isObj && !canConsume && ["weapon", "armor", "accessory"].includes(it.category) &&
                      <span style={{ fontSize: "10px", color: zoneTheme.accentDim, flexShrink: 0 }}>{it.equipped ? "⊙卸" : "⊙穿"}</span>}
                  </div>
                );
              })}
              {inv.length === 0 && <div style={{ color: zoneTheme.textDim, fontSize: "11.5px" }}>空空如也</div>}
            </div>

            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8 }}>
              <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>旁白</div>
              {narrator.stage === NNPC_STAGE.CRASHED ? (
                <div style={{ fontSize: "11.5px", color: "#c45044" }}>信号已断开</div>
              ) : narrator.confessed ? (
                <div style={{ fontSize: "11.5px", color: "#f0c060" }}>已告白 · 记忆碎片 {narrator.memoryFragments}/8</div>
              ) : (
                <>
                  <div style={{ fontSize: "11.5px", color: "#e0a0d0" }}>{affectionLabel(narrator.affection)}</div>
                  <div style={{ fontSize: "11.5px" }}>{bar(narrator.affection, 100, 8)} {narrator.affection}/100</div>
                  {narrator.affection >= 100 && (
                    <div
                      onClick={confessToNarrator}
                      title="向旁白告白"
                      style={{ marginTop: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 20, height: 20, borderRadius: "50%",
                        background: "#f0a0c0", color: "#3a1020", fontWeight: 700, fontSize: "14px",
                        boxShadow: "0 0 6px #f0a0c0", animation: "pulse 1.6s ease-in-out infinite",
                      }}>!</span>
                      <span style={{ color: "#f0a0c0", fontSize: "11px" }}>心意已满，可向旁白告白</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

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
            const curExits = (curRoom && getInnerRoom(room.name, curRoom)?.exits) || {};
            const adjacent = new Set(Object.values(curExits));
            // 本据点全部内景房间（内层是已知箱庭，不设战争迷雾——进了村自然看得见村里有哪些去处）
            const nodes = getInnerRoomNames(room.name).map((rn) => {
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

      {showPipeline && <PipelineViewer onClose={() => setShowPipeline(false)} loading={loading || pendingTalks > 0} waitSecs={waitSecs} />}
      {showTrace && <TraceViewer onClose={() => setShowTrace(false)} onReport={() => setShowBugReport(true)} />}
      {showCodex && <CodexScreen zoneTheme={zoneTheme} isDayMode={isDayMode} inv={inv} skills={skills} onClose={() => setShowCodex(false)} />}
      {showBugReport && (
        <BugReportModal
          isDayMode={isDayMode}
          turns={buildBugReportTurns()}
          pipelineData={getPipelineLog()}
          getGameState={() => ({
            room: room.name, inner: innerRoomName, time,
            hp: char.hp, money: char.money,
            flags, questProgress,
            invNames: inv.map(i => typeof i === "string" ? i : i.name),
            skillNames: skills.map(s => s.name),
          })}
          onClose={() => setShowBugReport(false)}
        />
      )}
      {activeNpcMenu && (
        <NpcActionMenu
          npc={activeNpcMenu}
          zoneTheme={zoneTheme}
          inv={inv}
          onClose={() => setActiveNpcMenu(null)}
          onLook={handleNpcLook}
          onTalk={handleNpcTalk}
          onGift={handleNpcGift}
          onDuel={handleNpcDuel}
          onSteal={handleNpcSteal}
          onLearnSkill={handleNpcLearnSkill}
          onTrade={handleNpcTrade}
          onInviteCompanion={handleInviteCompanion}
          companionUnlocked={activeNpcMenu.name === "雪豹" && companionState?.snowLeopard?.unlocked}
        />
      )}
      {activeItemMenu && (
        <ItemActionMenu
          item={activeItemMenu.item}
          mode={activeItemMenu.mode}
          canConsume={activeItemMenu.canConsume}
          roomNpcs={room.npcs || []}
          zoneTheme={zoneTheme}
          onClose={() => setActiveItemMenu(null)}
          onInspect={(it) => inspectItem("item", typeof it === "object" ? it.name : it, null, typeof it === "object" ? it : null, { worldLook: true })}
          onConsume={handleConsumeItem}
          onGive={(npc, it) => handleNpcGift(npc, it)}
          onSell={(npc) => handleNpcTrade(npc)}
          onCollect={handleCollectGround}
          onEquip={(it) => setInv(v => toggleEquip(v, it.id))}
        />
      )}
      {activePersuasion && (() => {
        const pkey = `${activePersuasion.questId}|${activePersuasion.flag}`;
        return (
        <PersuasionScreen
          persuade={activePersuasion.persuade}
          apiCfg={apiCfg}
          ownedFlags={flags}
          playerMoney={char.money || 0}
          playerIdentities={[]}
          playerSpecial={effectiveSpecialNow}
          zoneTheme={zoneTheme}
          savedProgress={persuasionProgress[pkey] || null}
          onProgress={(prog) => setPersuasionProgress(m => ({ ...m, [pkey]: prog }))}
          onFinish={(result) => {
            const ap = activePersuasion;
            setActivePersuasion(null);
            // 一场说服结束（不管成没成），清掉该场的续接进度——下次是全新一场。
            setPersuasionProgress(m => { const n = { ...m }; delete n[pkey]; return n; });
            if (result.outcome === "success") {
              if (result.via === "bribe" && result.cost) {
                setChar(c => ({ ...c, money: (c.money || 0) - result.cost }));
              }
              const q = QUCUO_QUESTS.find(x => x.id === ap.questId);
              if (q) {
                forceAdvanceQuest(q, ap.flag);
                const viaText = result.via === "bribe" ? "使了银子" : result.via === "identity" ? "亮了身份" : "把话说到了点子上";
                addLog([{ t: "affection", text: `  ✓ 你${viaText}，「${q.title}」推进。` }]);
              }
            } else {
              addLog([{ t: "sys", text: `  没谈成——这条路暂时没走通，可换个法子再试。` }]);
            }
          }}
        />
        );
      })()}
      {duelingNpc && (() => {
        // 切磋结算共享 handler：1v1(DuelScreen) 与 2v2(TeamDuelScreen) 两个界面
        // 的收尾逻辑完全一致——交情/战利品/任务分支/事实账本/整场战报都跟战斗
        // 形态无关，提取成同一个函数供两处复用（battleLog 条目形状略有差异：
        // 1v1 是 {playerMove,npcMove,...}，2v2 是 TeamDuelScreen 拼好的 {teamText}）。
        const duelFinishHandler = (outcome, loot, battleLog, grownMoveset, usedItems) => {
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
            // 切磋历练：不论胜负都给潜能（以武会友、长见识），赢多输少。保底不靠 AI 心情。
            {
              const potGain = outcome === "win" ? 5 : 3;
              setPot(p => p + potGain);
              addLog([{ t: "item", text: `  ✦ 切磋${outcome === "win" ? "获胜" : outcome === "lose" ? "落败" : "罢手"}，长了见识，潜能 +${potGain}` }]);
            }
            // 切磋后好感度：跟人认认真真过了招（点到为止），关系会拉近。但只对"具名 NPC 的
            // 切磋"生效——路遇的野兽/山贼这类泛用清剿目标（带 tag）是打杀、不是以武会友，
            // 不加好感度。赢了不失礼、输了也虚心，都算长交情，不论胜负都 +，赢略多。
            if (duelingNpc?.name && !duelingNpc.tag) {
              const affGain = outcome === "win" ? 4 : 3;
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
            // 切磋概率获得战利品（本轮）：赢了之后，按气运（福缘）概率从对手随身物品
            // （carriedItems，即出场时"所见即所得"固化的那些）里随机掉一件给玩家。
            // 概率非线性：p = 0.5 * (气运/10)^1.7 —— 气运10 约 50%，气运5 约 15%，
            // 气运0 为 0，低福缘时明显偏低、高福缘才明显上来（凸曲线，不是线性）。
            // 只在"具名NPC切磋获胜"时触发；清剿目标(带tag)的掉落仍走 DuelScreen 的 loot。
            if (outcome === "win" && duelingNpc?.name && !duelingNpc.tag) {
              const pool = (duelingNpc.carriedItems || []).filter(it => !it.stolen && !it.dropped);
              if (pool.length) {
                const luck = Math.max(0, Math.min(10, char.special?.气运 ?? 5));
                const dropChance = 0.5 * Math.pow(luck / 10, 1.7);
                if (Math.random() < dropChance) {
                  const got = pool[Math.floor(Math.random() * pool.length)];
                  setInv(prev => [...prev, { name: got.name, category: got.category || "misc", quality: got.quality || "白", equipped: false }]);
                  // 标记这件已从对手身上失去，避免重复掉（carriedItems 是固化清单）
                  setRoom(r => ({
                    ...r,
                    npcs: r.npcs.map(n => n.name === duelingNpc.name
                      ? { ...n, carriedItems: (n.carriedItems || []).map(it => it === got || it.name === got.name ? { ...it, dropped: true } : it) }
                      : n),
                  }));
                  addLog([{ t: "item", text: `  ✦ 一番切磋，${duelingNpc.name}的「${got.name}」竟落入你手（福缘所致）` }]);
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
              setRoom(r => ({ ...r, npcs: [...r.npcs.filter(n => n.name !== duelingNpc.name), fresh] }));
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
                addLog([{ t: "item", text: `  ⚔ 战利品：获得「${loot.droppedItem.name}」（${loot.droppedItem.quality}）` }]);
                // 所见即所得的另一半：东西到了玩家手里，就得从NPC身上消失
                // （标记 stolen 复用偷窃系统的语义），再打一场不会凭空再爆一件。
                setRoom(r => ({
                  ...r,
                  npcs: r.npcs.map(n => n.name === duelingNpc?.name
                    ? { ...n, carriedItems: (n.carriedItems || []).map(ci => ci.id === loot.droppedItem.id ? { ...ci, stolen: true } : ci) }
                    : n),
                }));
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
                act(`切磋结束。经过：${recap || "双方试探几招，未及深入"}。结果：${outcomeText}。请把上面每回合的说书片段串成一篇连贯的整场战报，点出关键招式和胜负经过，说书人口吻、一气呵成。并且务必在本轮 JSON 里输出 memory 字段（不超过50字客观事实），把这场切磋记成一条往事：与谁在何处切磋、用了哪几招、谁胜谁负、有无夺得战利品——供日后回想与旁人提起。`, [], { silentCmd: true });
              }, 0);
              // 兜底小纸条：不管 AI 那轮是否吐了 memory，系统先按 battleLog 直接补记一条
              // 客观战斗事实进往事（DUMB 源），确保"战斗过程"一定有一张小纸条可供日后召回。
              const recapNote = `在${room.name}与${finishedNpc.name}切磋，${recap ? recap.replace(/；/g, "、") + "，" : ""}${outcome === "win" ? "终获胜" : outcome === "lose" ? "落败" : "未分胜负"}。`;
              jotNote({ text: recapNote.slice(0, 60), owner: [{ name: finishedNpc.name, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.DUMB });
            }
        };
        return (
        <ErrorBoundary label="切磋界面" onReset={() => { setDuelingNpc(null); setPendingQuestBranch(null); }}>
        {isSnowLeopardAvailable(companionState) ? (
          // 雪豹已解锁且出战：2v2团战（玩家+雪豹 vs 当前对手；引擎/UI都支持第二敌人，待后续内容接入）
          <TeamDuelScreen
            enemies={[duelingNpc]}
            leopardData={companionState.snowLeopard.data}
            playerChar={{ ...char, special: effectiveSpecialNow }}
            pendingCombatBuff={char.pendingCombatBuff}
            playerInv={inv}
            playerMoveset={char.moveset}
            zoneTheme={zoneTheme}
            onFinish={duelFinishHandler}
          />
        ) : (
          <DuelScreen
            npc={duelingNpc}
            playerChar={{ ...char, special: effectiveSpecialNow }}
            pendingCombatBuff={char.pendingCombatBuff}
            playerInv={inv}
            playerMoveset={char.moveset}
            zoneTheme={zoneTheme}
            onFinish={duelFinishHandler}
          />
        )}
        </ErrorBoundary>
        );
      })()}

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
