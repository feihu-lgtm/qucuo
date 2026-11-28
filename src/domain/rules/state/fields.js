import { getInnerRoom, hasInnerMap, isNpcVisibleInInnerRoom, visibleInnerExits } from "../map/innerMap.js";
import { DIRS } from "../map/mapNarration.js";
import { getTimeStr } from "../../../utils/mudHelpers.js";
import { allFactSummaries } from "../prompt/knowledgeRoot.js";
import { renderDiegeticState } from "../clapboard/diegeticState.js";
import { renderNpcSoulFrames } from "../clapboard/npcSoulFrame.js";
import { renderJudgeVerdict, renderCausalBudget } from "../judge/judgeTurn.js";

export function formatFactSummariesForPrompt(facts) {
  return facts.map((fact) => `· （${getTimeStr(fact.诞生回合 || 0)}）${fact.摘要}${fact.标签 ? `〔${fact.标签}〕` : ""}`).join("\n");
}

export function getPresentNpcs({ room, innerRoomName }) {
  return (room?.npcs || []).filter((npc) => npc?.name &&
    isNpcVisibleInInnerRoom(room.name, innerRoomName, npc));
}

function formatCarried(npc) {
  const items = (npc.carriedItems || []).filter((item) => !item.stolen).map((item) => item.name).join("、");
  return items ? `〔身携:${items}〕` : "〔身无长物〕";
}

function formatNpcs(scope) {
  const npcs = scope.visibleNpcsForAI ?? scope.visibleNpcs ?? getPresentNpcs(scope);
  const { npcSeparator = ",", detailedNpcs } = scope.promptRefOptions || {};
  const present = npcs.map((npc) => {
    if (!detailedNpcs) return npc.name;
    const tier = typeof npc.levelCap === "number"
      ? `〔品阶:${scope.quality?.[Math.max(0, Math.min(5, npc.levelCap))]}档〕` : "";
    return npc.name + tier + formatCarried(npc);
  }).join(npcSeparator) || "无";
  // D6：同据点但不在当前内层房间的本地人单独成组渲染——模型既不该当他们
  // 不存在（人会从别房走过来、可被提及/寻找），也不该和本房在场者混写。
  // 上游没显式传 nearbyNpcs 时本地兜底算一份（私聊等旁路 prompt 也保持一致）。
  const nearbyRaw = scope.nearbyNpcs
    ?? ((scope.room?.npcs || []).filter((n) => n?.name && !isNpcVisibleInInnerRoom(scope.room.name, scope.innerRoomName, n)));
  const nearbyNames = new Set(npcs.map((n) => n?.name));
  const nearby = nearbyRaw.map((n) => (typeof n === "string" ? n : n?.name))
    .filter((name) => name && !nearbyNames.has(name));
  if (!nearby.length) return present;
  return `${present}；在附近（本据点别处）：${nearby.join("、")}`;
}

function formatInventory(scope) {
  const { inventoryNames, inventorySeparator = ",", emptyInventory = "" } = scope.promptRefOptions || {};
  return (scope.inv || []).map((item) => {
    if (typeof item === "string") return item;
    if (inventoryNames) return item.name;
    return `${item.name}(${item.quality}${item.equipped ? "·已装备" : ""})`;
  }).join(inventorySeparator) || emptyInventory;
}

function formatRoomName(scope) {
  const name = scope.room?.name;
  if (name === undefined) return undefined;
  const hasMap = scope.hasInnerMap ?? hasInnerMap;
  return !scope.promptRefOptions?.outerRoomOnly && hasMap(name) && scope.innerRoomName
    ? `${name}·${scope.innerRoomName}` : name;
}

// 此处的描写：人在内层房间时给这间房自己的描写和四周出口（内层出口经
// visibleInnerExits 过滤未解锁的暗房）；不在内层或据点没有内层地图时给 room.desc。
// 此前主叙事只拿到「喇嘛庙·藏经阁」这个名字，房间描写一句没有，AI 只能现编。
function formatRoomDesc(scope, desc, fallback) {
  const name = scope.room?.name;
  const hasMap = scope.hasInnerMap ?? hasInnerMap;
  const inner = !scope.promptRefOptions?.outerRoomOnly && scope.innerRoomName && hasMap(name)
    ? getInnerRoom(name, scope.innerRoomName) : null;
  if (!inner) return desc || fallback || "";
  const exits = Object.entries(visibleInnerExits(name, scope.innerRoomName, scope))
    .map(([dir, room]) => `${DIRS[dir] || dir}·${room}`).join("　");
  return `${inner.desc || ""}${exits ? `（四周：${exits}）` : ""}`;
}

function npcAttrs(scope) {
  const characters = scope.varTree?.角色;
  return characters && Object.hasOwn(characters, scope.npcName) ? characters[scope.npcName] : undefined;
}

import { priceForQuality, QUALITY } from "../economy/equipment.js";
import { SERVICE_MENUS } from "../../data/buildings/menuData.js";
import { getGroundItems } from "../map/groundScope.js";

const signed = (value) => value > 0 ? "+" + value : String(value);
export const formatRange = ([min, max]) => `${signed(min)}~${signed(max)}`;

export const FIELD = Object.freeze({
  affection: "varTree.角色.*.好感度",
  reputation: "varTree.世界.威望",
  factionRep: "varTree.世界.势力声誉.*",
  hp: "char.hp",
  money: "char.money",
  inv: "inv",
  flags: "flags",
});

const ordinaryGift = [3, 5];
const affectionRules = {
  mvu: { maxDelta: 15, perTurn: 5, daily: 12 },
  firstMeeting: [0, 20],
  gift: { 白: ordinaryGift, 绿: [5, 7], 蓝: [7, 10], 紫: [10, 13], 橙: [12, 15], 红: [14, 15] },
  learn: { ordinary: [2, 4, 3], master: [4, 8, 6] },
  companion: { min: 40, max: 55, floor: 30, example: 45 },
  appease: [0, 5],
  pigeon: { min: -3, max: 8, scale: "寻常问候+1~+2；贴心或有趣+3~+6；合心意的礼物才可到+8；敷衍冒犯给负数。" },
};
const whisperRules = {
  min: -3, max: 6, fallback: 1, daily: 12,
  scale: "寻常闲聊 +1~+2；说到心坎、体贴、机敏或有趣 +3~+6；敷衍、冒犯、无礼给负数。",
};
const foodPrice = () => SERVICE_MENUS.饭馆.find((dish) => dish.name === "青稞糌粑").price;
const weaponPrice = () => priceForQuality("weapon", "白").buyPrice;
export const DEAL_MULTIPLIER = { min: 0.8, max: 1.5, default: 1 };
export const CARRY_COUNT = { min: 0, max: 3 };
export const AFFECTION_RULES = affectionRules;
export const WHISPER_AFFECTION_RULES = whisperRules;
export const giftRange = (quality) => affectionRules.gift[quality] ?? ordinaryGift;
export const learnRange = (isMaster) => isMaster ? affectionRules.learn.master : affectionRules.learn.ordinary;

export const FIELDS = Object.freeze({
  "char.name": { label: "姓名", default: "无名少侠", refs: {
    "主角.名": (s, value, fallback) => value || s.promptRefOptions?.playerFallback || fallback,
  } },
  "char.gender": { label: "性别", default: "男", refs: { "主角.性别": (_s, value, fallback) => value || fallback } },
  [FIELD.hp]: { label: "气血", default: [], min: 0,
    scale: "按「当前值/上限」填写，满血等于上限；跌至0为倒下。不改上限，除非叙事已有经系统裁决的成长。",
    refs: { 气血: (_s, hp, fallback) => (hp || fallback).join("/") } },
  "char.neigong": { label: "内功", default: 0, min: 0, max: 100,
    scale: "这是持久修为而非战斗临时内力；靠潜能修炼，正常修炼上限100，勿按单次出招增减。",
    refs: { 内功: (_s, value, fallback) => value ?? fallback } },
  "char.waigong": { label: "外功", default: 0, min: 0, max: 100,
    scale: "这是持久修为；正常修炼上限100，不随普通出招增长。",
    refs: { 外功: (_s, value, fallback) => value ?? fallback } },
  "char.special": { label: "七维", default: {}, scale: "人物天赋以5为寻常中位；不把单场表现或临时增益写成基础属性。",
    refs: { 特殊属性: (_s, value, fallback) => Object.entries(value || fallback).map(([key, val]) => key + val).join(",") } },
  "char.bodyProfile": { label: "体貌", default: {} },
  "char.moveset": { label: "招式", default: [] },
  "char.pendingCombatBuff": { label: "战前餐增益" },
  [FIELD.money]: { label: "银两", default: 0, min: 0,
    scale: "小额谢礼可给1~2两；@{物价.主食}两够买一份青稞糌粑，普通白档兵器原价@{物价.兵器}两。只记实际发生、未经系统结算的收支。",
    refs: { 银两: (_s, value, fallback) => value ?? fallback } },
  "char.pigeons": { label: "信鸽数量", default: 0, min: 0 },
  [FIELD.inv]: { label: "背包", default: [],
    scale: "每个数组元素是一件物品；不要凭空发放，也不要把已经结算的物品再写一次。品阶从低到高为@{尺度.品阶}；寻常人多用白、绿，已有系统裁决时照填。",
    refs: { 背包: formatInventory, 装备: (s) => s.describeEquipment?.(s.inv) || "", "尺度.品阶": () => QUALITY.join("、") } },
  skills: { label: "武学", default: [], scale: "仅记录实际习得或练成的武学，普通叙事不奖励额外等级。",
    refs: { 武学: (_s, value, fallback) => (value || fallback).map((skill) => skill.name + "Lv" + skill.level).join(",") } },
  "dao.karma": { label: "因果", default: 0, scale: "义举增、恶行减，寻常往来不变；只记录已发生的行为。",
    refs: { 道德: (_s, value) => value } },
  "dao.jie": { label: "劫数", default: 0, refs: { 劫数: (_s, value) => value } },
  "dao.sign": { label: "天象" },
  "dao.rumor": { label: "传闻", default: [] },
  [FIELD.flags]: { label: "标记", default: [],
    scale: "只用本轮协议允许的标记；带数字的任务阶段或日期照抄系统给定值，不自拟进度或计时。",
    refs: { 标记: (_s, value) => value?.length ? value.join(",") : "无" } },
  time: { label: "时间", default: 0, min: 0,
    scale: "24时间单位为一天，按系统议定的行动耗时推进，不从叙事另加时间。",
    refs: { 时间: (s, time) => time === undefined ? undefined : s.getTimeStr ? s.getTimeStr(time) || time : getTimeStr(time) } },
  "room.name": { label: "房间名", refs: { "房间.名": formatRoomName } },
  "room.desc": { label: "房间描述", default: "", refs: { "房间.描写": formatRoomDesc } },
  "room.exits": { label: "出口", default: [], refs: {
    "房间.出口": (_s, exits, fallback) => (exits || fallback).join(","),
    "房间.出口示例": (_s, exits, fallback) => (exits || fallback).map((exit) => `"${exit}"`).join(","),
  } },
  "room.npcs": { label: "房间人物", default: [], refs: {
    "房间.全员": (_s, npcs, fallback) => (npcs || fallback).map((npc) => npc.name).join("、") || "无",
    "房间.全员随身": (_s, npcs, fallback) => (npcs || fallback).map((npc) =>
      `· ${npc.name}${formatCarried(npc)}`).join("\n") || "· （无人在场）",
    在场NPC: formatNpcs,
  } },
  "room.items": { label: "地上物品", default: [], refs: {
    地上物品: (s, items, fallback) => (s.room ? getGroundItems({ room: s.room, innerRoomName: s.innerRoomName }) : (items || fallback))
      .map((item) => (typeof item === "string" ? item : item.name))
      .join(s.promptRefOptions?.itemSeparator ?? ",") || "无",
  } },
  innerRoomName: { label: "内层位置", default: "" },
  questProgress: { label: "任务进度", default: {} },
  "gambleNegotiation.*.*.mult": { label: "谈价倍率", ...DEAL_MULTIPLIER,
    scale: "对原报价的倍率：高于1为加价，低于1为让利；等于1为不变。最终报价不超过对方现银。",
    refs: { "尺度.谈价": () => `${DEAL_MULTIPLIER.min}~${DEAL_MULTIPLIER.max}` } },
  exp: { label: "经验", default: 0, min: 0, scale: "只记叙事中明确且未经系统结算的经验；未给定奖励时省略，不自行估算。" },
  pot: { label: "潜能", default: 0, min: 0, scale: "潜能用于修炼；只抄已裁决的未结算奖励，不为普通行动自拟增量。" },
  "narrator.affection": { label: "旁白好感度", default: 0, min: 0, max: 100,
    rules: whisperRules,
    refs: { "旁白.好感度": (_s, value) => String(value),
      "尺度.私语": () => `范围 ${formatRange([whisperRules.min, whisperRules.max])}。${whisperRules.scale}`,
    } },
  "narrator.stage": { label: "旁白阶段", default: 0, min: 0 },
  [FIELD.affection]: { label: "好感度", default: 0, min: 0, max: 100, ai: true, rules: affectionRules,
    scale: "寻常友好聊天加1；白档礼物通常@尺度.白礼；真正重的情分（如传授绝学）可到@尺度.授绝学；没有态度变化就不改。",
    refs: {
      "通信.好感度": (s, _value, fallback) => {
        const value = npcAttrs(s)?.好感度;
        return typeof value === "number" ? value : fallback;
      },
      "尺度.白礼": () => formatRange(ordinaryGift),
      "尺度.授绝学": () => signed(affectionRules.learn.master[1]),
      "尺度.飞鸽": () => `范围 ${formatRange([affectionRules.pigeon.min, affectionRules.pigeon.max])}。${affectionRules.pigeon.scale}`,
    } },
  "varTree.角色.*.态度": { label: "态度", default: "", ai: true, refs: {
    "通信.态度": (s) => npcAttrs(s)?.态度 ? `，${npcAttrs(s).态度}` : "",
  } },
  "varTree.角色.*.飞鸽": { label: "通信往来", default: [], ai: true, refs: {
    "通信.往来": (s) => (npcAttrs(s)?.飞鸽 || []).map((m) =>
      `${m.dir === "send" ? "主角来信" : "你的回信"}：${m.content}${m.gift ? `（附礼：${m.gift}）` : ""}`
    ).join("\n") || "（这是你们第一次通信）",
  } },
  "varTree.角色.*.生气状态": { label: "生气状态", ai: true },
  "varTree.角色.*.生气解除": { label: "生气解除", ai: true },
  [FIELD.reputation]: { label: "威望", default: 0, min: -100, max: 100, ai: true, maxDelta: 15,
    scale: "全江湖只记一值；公开义举如路见不平、兑现承诺可加5~15，广为人知的恶行同量扣减；私下态度不是威望。" },
  [FIELD.factionRep]: { label: "势力声誉", default: 0, min: -100, max: 100, ai: true, maxDelta: 10,
    scale: "玩家与一方势力的关系；替该势力办成事、护其人可加3~10，坏其大事、伤其门人同量扣减。" },
  "varTree.世界.驻足锁.**": { label: "NPC交互驻足锁", ai: false },
  "varTree.世界.游走册.**": { label: "OC冒险者游走位置册", ai: false },
  "varTree.世界.旁白.**": { label: "旁白个人线", ai: false },
  "varTree.世界.好感日增.**": { label: "好感日增账本", ai: false },
  "varTree.世界.起居注.**": { label: "起居注", ai: false, refs: {
    今日起居: (s) => s.describeTodayForAI?.(s.varTree?.世界?.起居注, s.timeForToday ?? s.time) || "",
  } },
  "varTree.世界.知识领域.**": { label: "事实摘要", ai: true, refs: {
    事实摘要: (s) => formatFactSummariesForPrompt(allFactSummaries(s.varTree || {}, s.promptRefOptions?.factLimit)),
  } },
  "varTree.角色.**": { label: "角色关系", ai: true, refs: { 角色关系: (s) => s.varTree?.角色 || {} } },
  "varTree.世界.**": { label: "世界剧情变量", ai: true },
  "varTree.主角.**": { label: "主角剧情变量", ai: true },
  "物价": { label: "物价参考", readOnly: true, refs: {
    "物价.主食": foodPrice,
    "物价.兵器": weaponPrice,
  } },
  "clapboard.diegeticState": { label: "体感态势", readOnly: true, refs: {
    "体感态势": (s) => renderDiegeticState({ char: s.char, inv: s.inv, time: s.time }),
  } },
  "clapboard.npcSoulFrames": { label: "在场活人切片", readOnly: true, refs: {
    // WO-25B 预算闸：单人心账切片 160 字、全屋总预算 1600 封顶，人多房间不 token 膨胀。
    // 在场名单优先取 visibleNpcsForAI——buildPresence 已把随行同伴并入并做过内层房过滤，
    // 同伴随行在场却不上活人切片的缺口由此闭合；缺该键时（测试/直调）回退本地过滤口径。
    "在场活人切片": (s) => renderNpcSoulFrames({
      visibleNpcs: (Array.isArray(s.visibleNpcsForAI) ? s.visibleNpcsForAI : (s.room?.npcs || []))
        // 移动轮 buildPresence 跳过内层房过滤（目的地内层未定），visibleNpcsForAI 会混入
        // 出发据点别屋的人——状态渲染时玩家明明还在出发地内层房，别屋人不算在场。
        // 故无论名单来源都再过一道内层房闸；随行同伴形影不离，凭 companion 旗标豁免。
        .filter((npc) => npc?.companion
          || typeof s.innerRoomName !== "string"
          || isNpcVisibleInInnerRoom(s.room?.name, s.innerRoomName, npc)),
      varTree: s.varTree,
      time: s.time,
      clapboardEntries: s.clapboardEntries,
      entriesBudget: 160,
      totalBudget: 1600,
      // WO-25J 此刻生活切片：在场者与玩家同据点，据点建筑清单喂给 npcGoals 分配活计
      district: s.room?.name || null,
    }),
  } },
  "judge.verdict": {
    label: "判官定案单", readOnly: true,
    refs: { "判官定案单": (s) => renderJudgeVerdict(s.judgeVerdict) },
  },
  "judge.causalBudget": {
    label: "因果授信", readOnly: true,
    refs: { "因果授信": (s) => renderCausalBudget(s.causalBudget) },
  },
  "giftInfo.weight": { label: "赠礼分量", readOnly: true, refs: {
    "赠礼.分量": (_s, weight) => weight?.label,
    "赠礼.反应": (_s, weight) => weight?.reaction,
    "赠礼.好感范围": (_s, weight) => weight && formatRange(weight.range),
  } },
});

// readPath/statePath 已拆入叶子模块 paths.js（拆循环依赖），此处转出保旧引用不破。
export { readPath, statePath } from "./paths.js";
import { readPath, statePath } from "./paths.js";

const refs = new Map(Object.entries(FIELDS).flatMap(([path, field]) =>
  Object.entries(field.refs || {}).map(([ref, format]) => [ref, { path, field, format }])));

export function readField(scope, ref) {
  const entry = refs.get(ref);
  if (!entry) return readPath(scope, statePath(ref));
  const { path, field, format } = entry;
  return format(scope, readPath(scope, path.split(".")), field.default);
}
