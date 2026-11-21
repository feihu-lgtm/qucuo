import { hasInnerMap, isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { getTimeStr } from "../../utils/mudHelpers.js";
import { allFactSummaries } from "./knowledge.js";

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
  return npcs.map((npc) => {
    if (!detailedNpcs) return npc.name;
    const tier = typeof npc.levelCap === "number"
      ? `〔品阶:${scope.quality?.[Math.max(0, Math.min(5, npc.levelCap))]}档〕` : "";
    return npc.name + tier + formatCarried(npc);
  }).join(npcSeparator) || "无";
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

function npcAttrs(scope) {
  const characters = scope.varTree?.角色;
  return characters && Object.hasOwn(characters, scope.npcName) ? characters[scope.npcName] : undefined;
}

export const PROMPT_FIELDS = Object.freeze({
  "主角.名": ({ char, promptRefOptions }) => char?.name || promptRefOptions?.playerFallback || "无名少侠",
  "主角.性别": ({ char }) => char?.gender || "男",
  时间: (scope) => scope.time === undefined ? undefined
    : scope.getTimeStr ? scope.getTimeStr(scope.time) || scope.time : getTimeStr(scope.time),
  "房间.名": formatRoomName,
  "房间.出口": ({ room }) => (room?.exits || []).join(","),
  "房间.出口示例": ({ room }) => (room?.exits || []).map((exit) => `"${exit}"`).join(","),
  "房间.全员": ({ room }) => (room?.npcs || []).map((npc) => npc.name).join("、") || "无",
  "房间.全员随身": ({ room }) => (room?.npcs || []).map((npc) =>
    `· ${npc.name}${formatCarried(npc)}`).join("\n") || "· （无人在场）",
  在场NPC: formatNpcs,
  地上物品: ({ room, promptRefOptions }) => (room?.items || [])
    .map((item) => item.name).join(promptRefOptions?.itemSeparator ?? ",") || "无",
  气血: ({ char }) => (char?.hp || []).join("/"),
  内功: ({ char }) => char?.neigong ?? 0,
  外功: ({ char }) => char?.waigong ?? 0,
  特殊属性: ({ char }) => Object.entries(char?.special || {}).map(([key, value]) => key + value).join(","),
  背包: formatInventory,
  装备: (scope) => scope.describeEquipment?.(scope.inv) || "",
  武学: ({ skills }) => (skills || []).map((skill) => skill.name + "Lv" + skill.level).join(","),
  道德: ({ dao }) => dao?.karma,
  劫数: ({ dao }) => dao?.jie,
  标记: ({ flags }) => flags?.length ? flags.join(",") : "无",
  今日起居: (scope) => scope.describeTodayForAI?.(
    scope.varTree?.世界?.起居注, scope.timeForToday ?? scope.time) || "",
  角色关系: ({ varTree }) => varTree?.角色 || {},
  "旁白.好感度": ({ narrator }) => String(narrator?.affection),
  事实摘要: ({ varTree, promptRefOptions }) => formatFactSummariesForPrompt(
    allFactSummaries(varTree || {}, promptRefOptions?.factLimit)),
  "通信.好感度": (scope) => {
    const value = npcAttrs(scope)?.好感度;
    return typeof value === "number" ? value : 0;
  },
  "通信.态度": (scope) => {
    const attitude = npcAttrs(scope)?.态度;
    return attitude ? `，${attitude}` : "";
  },
  "通信.往来": (scope) => (npcAttrs(scope)?.飞鸽 || []).map((m) =>
    `${m.dir === "send" ? "主角来信" : "你的回信"}：${m.content}${m.gift ? `（附礼：${m.gift}）` : ""}`
  ).join("\n") || "（这是你们第一次通信）",
});

export function resolveRef(scope, path) {
  if (Object.hasOwn(PROMPT_FIELDS, path)) return PROMPT_FIELDS[path](scope);
  let value = scope;
  for (const part of path.split(".")) {
    if (value == null || !Object.hasOwn(value, part)) return undefined;
    value = value[part];
  }
  return value;
}

function displayPromptValue(value) {
  if (value == null) return "";
  if (Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)) return value.join("/");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// ASCII segments stop before Han text (e.g. @round.round回合). Braces disambiguate any boundary.
const REF_PATTERN = /@(?:\{([^\s{}]+)\}|((?:[A-Za-z0-9_]+|\p{Script=Han}[\p{L}\p{N}_]*)(?:\.(?:[A-Za-z0-9_]+|\p{Script=Han}[\p{L}\p{N}_]*))*))/gu;

export function renderPromptTemplate(template, scope, { trace } = {}) {
  const missing = new Set();
  const text = template.replace(REF_PATTERN, (_, braced, bare) => {
    const path = braced ?? bare;
    const value = resolveRef(scope, path);
    if (value === undefined) missing.add(path);
    return displayPromptValue(value);
  });
  const missingPaths = [...missing];
  if (missingPaths.length) trace?.(missingPaths);
  return { text, missingPaths };
}

const PLAYER = "主角:@主角.名〔@主角.性别〕";
const LOCATION = "时间:@时间 " + PLAYER + " 房间:@房间.名 出口:@房间.出口 NPCs:@在场NPC";
const VITALS = "HP:@气血 内功:@内功 外功:@外功";
const MAIN_STATE_TEMPLATE = LOCATION + " 物品:@地上物品 " + VITALS +
  " 七维:@特殊属性 背包:@背包 装备:@装备 武功:@武学 因果:@道德 劫数:@劫数\n[已触发事件] @标记@今日起居";
const PREVIEW_STATE_TEMPLATE = LOCATION + " " + VITALS + " 背包:@背包";
const WHISPER_STATE_TEMPLATE = PLAYER + " 时间:@时间 房间:@房间.名（@room.desc） 房间里的人:@在场NPC 玩家背包:@背包";

export function buildMainStatePrompt(scope, { gmNote = "", preview = false, trace } = {}) {
  const promptRefOptions = preview
    ? { inventoryNames: true, inventorySeparator: "，", emptyInventory: "空", outerRoomOnly: true }
    : { detailedNpcs: true };
  const text = renderPromptTemplate(preview ? PREVIEW_STATE_TEMPLATE : MAIN_STATE_TEMPLATE,
    { ...scope, promptRefOptions }, { trace }).text;
  return preview ? text : `[状态] ${gmNote}${text}`;
}

export function buildWhisperStatePrompt(scope, { preview = false, trace } = {}) {
  const prefix = preview ? "" : "[当前世界状态，仅供你了解背景，不必主动复述] ";
  const promptRefOptions = { inventorySeparator: "，", emptyInventory: "空", outerRoomOnly: preview };
  return prefix + renderPromptTemplate(WHISPER_STATE_TEMPLATE, { ...scope, promptRefOptions }, { trace }).text;
}
