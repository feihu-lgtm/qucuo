import { describeEquipment } from "../economy/equipment.js";
import { hasInnerMap, isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { getTimeStr } from "../../utils/mudHelpers.js";

function visibleNpcs(scope) {
  if (Array.isArray(scope.visibleNpcsForAI)) return scope.visibleNpcsForAI;
  if (Array.isArray(scope.visibleNpcs)) return scope.visibleNpcs;
  const room = scope.room || {};
  return (room.npcs || []).filter((npc) =>
    isNpcVisibleInInnerRoom(room.name, scope.innerRoomName, npc));
}

function formatNpcs(scope) {
  const options = scope.promptRefOptions || {};
  const npcs = visibleNpcs(scope);
  const separator = options.npcSeparator ?? ",";
  if (options.npcFormat !== "detailed") {
    return npcs.map((npc) => npc.name).join(separator) || "无";
  }
  return npcs.map((npc) => {
    const carried = (npc.carriedItems || [])
      .filter((item) => !item.stolen)
      .map((item) => item.name)
      .join("、");
    const tier = typeof npc.levelCap === "number"
      ? `〔品阶:${scope.quality?.[Math.max(0, Math.min(5, npc.levelCap))]}档〕`
      : "";
    return npc.name + tier + (carried ? `〔身携:${carried}〕` : "〔身无长物〕");
  }).join(separator) || "无";
}

function formatInventory(scope) {
  const options = scope.promptRefOptions || {};
  const items = Array.isArray(scope.inv) ? scope.inv : [];
  const separator = options.inventorySeparator ?? ",";
  const empty = options.emptyInventory ?? "";
  const text = items.map((item) => {
    if (typeof item === "string") return item;
    if (options.inventoryStyle === "name") return item?.name || "";
    return `${item.name}(${item.quality}${item.equipped ? "·已装备" : ""})`;
  }).join(separator);
  return text || empty;
}

function roomName(scope) {
  const room = scope.room || {};
  const options = scope.promptRefOptions || {};
  const hasMap = scope.hasInnerMap?.(room.name) ?? hasInnerMap(room.name);
  return room.name + (options.roomNameIncludesInner !== false && hasMap && scope.innerRoomName
    ? `·${scope.innerRoomName}`
    : "");
}

function getAffection(scope, name) {
  const value = scope.varTree?.角色?.[name]?.好感度;
  if (typeof value === "number") return value;
  return name === "旁白" && Number.isFinite(scope.narrator?.affection)
    ? scope.narrator.affection
    : 0;
}

export const PROMPT_FIELDS = Object.freeze({
  "主角.名": (scope) => scope.char?.name || "无名少侠",
  "主角.性别": (scope) => scope.char?.gender || "男",
  时间: (scope) => scope.getTimeStr?.(scope.time) || getTimeStr(scope.time) || scope.time,
  "房间.名": roomName,
  "房间.出口": (scope) => (scope.room?.exits || []).join(","),
  "房间.出口JSON": (scope) => (scope.room?.exits || []).map((exit) => `"${exit}"`).join(","),
  "房间.NPC名": (scope) => (scope.room?.npcs || [])
    .map((npc) => npc.name)
    .join(scope.promptRefOptions?.npcSeparator ?? ",") || "无",
  "在场NPC": formatNpcs,
  房间NPC随身: (scope) => (scope.room?.npcs || []).map((npc) => {
    const carried = (npc.carriedItems || [])
      .filter((item) => !item.stolen)
      .map((item) => item.name)
      .join("、");
    return `· ${npc.name}${carried ? `〔身携:${carried}〕` : "〔身无长物〕"}`;
  }).join("\n") || "· （无人在场）",
  地上物品: (scope) => (scope.room?.items || [])
    .map((item) => item.name)
    .join(scope.promptRefOptions?.itemSeparator ?? ",") || "无",
  气血: (scope) => (scope.char?.hp || []).join("/"),
  内功: (scope) => scope.char?.neigong ?? 0,
  外功: (scope) => scope.char?.waigong ?? 0,
  特殊属性: (scope) => Object.entries(scope.char?.special || {})
    .map(([key, value]) => key + value)
    .join(","),
  背包: formatInventory,
  装备: (scope) => typeof scope.describeEquipment === "function"
    ? scope.describeEquipment(scope.inv) || ""
    : describeEquipment(scope.inv || []),
  武学: (scope) => (scope.skills || []).map((skill) => skill.name + "Lv" + skill.level).join(","),
  道德: (scope) => scope.dao?.karma,
  劫数: (scope) => scope.dao?.jie,
  标记: (scope) => (scope.flags || []).length ? scope.flags.join(",") : "无",
  今日起居: (scope) => scope.describeTodayForAI?.(
    scope.varTree?.世界?.起居注,
    scope.timeForToday,
  ),
  "在场NPC随身": (scope) => visibleNpcs(scope).map((npc) => {
    const carried = (npc.carriedItems || [])
      .filter((item) => !item.stolen)
      .map((item) => item.name)
      .join("、");
    return `· ${npc.name}${carried ? `〔身携:${carried}〕` : "〔身无长物〕"}`;
  }).join("\n") || "· （无人在场）",
  "好感.*": getAffection,
  "态度.*": (scope, name) => {
    const attitude = scope.varTree?.角色?.[name]?.态度;
    return attitude ? `，${attitude}` : "";
  },
});

export function resolveRef(scope, path) {
  if (Object.prototype.hasOwnProperty.call(PROMPT_FIELDS, path)) {
    return PROMPT_FIELDS[path](scope);
  }
  for (const prefix of ["好感.", "态度."]) {
    if (path.startsWith(prefix)) return PROMPT_FIELDS[`${prefix.slice(0, -1)}.*`](scope, path.slice(prefix.length));
  }

  let value = scope;
  for (const part of path.split(".")) {
    if (value == null || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
    value = value[part];
  }
  return value;
}

function displayPromptValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.length === 2 && value.every(Number.isFinite)
      ? `${value[0]}/${value[1]}`
      : JSON.stringify(value);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

const REF_PATTERN = /@([\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*)/gu;

export function renderPromptTemplate(template, scope, { trace } = {}) {
  const missingPaths = [];
  const text = template.replace(REF_PATTERN, (_, path) => {
    const value = resolveRef(scope, path);
    if (value === undefined) {
      missingPaths.push(path);
      return "";
    }
    return displayPromptValue(value);
  });
  const uniqueMissingPaths = [...new Set(missingPaths)];
  if (uniqueMissingPaths.length) trace?.(uniqueMissingPaths);
  return { text, missingPaths: uniqueMissingPaths };
}

export const MAIN_STATE_TEMPLATE = "时间:@时间 主角:@主角.名〔@主角.性别〕 房间:@房间.名 出口:@房间.出口 NPCs:@在场NPC 物品:@地上物品 HP:@气血 内功:@内功 外功:@外功 七维:@特殊属性 背包:@背包 装备:@装备 武功:@武学 因果:@道德 劫数:@劫数\n[已触发事件] @标记@今日起居";
export const WHISPER_STATE_TEMPLATE = "主角:@主角.名〔@主角.性别〕 时间:@时间 房间:@房间.名（@room.desc） 房间里的人:@在场NPC 玩家背包:@背包";
export const PREVIEW_STATE_TEMPLATE = "时间:@时间 主角:@主角.名〔@主角.性别〕 房间:@房间.名 出口:@房间.出口 NPCs:@在场NPC HP:@气血 内功:@内功 外功:@外功 背包:@背包";

function renderStateTemplate(template, scope, options, trace) {
  return renderPromptTemplate(template, {
    ...scope,
    promptRefOptions: { ...scope.promptRefOptions, ...options },
  }, { trace }).text;
}

export function buildMainStatePrompt(scope, { gmNote = "", trace } = {}) {
  const state = renderStateTemplate(MAIN_STATE_TEMPLATE, scope, {
    inventoryStyle: "detailed",
    inventorySeparator: ",",
    emptyInventory: "",
    npcFormat: "detailed",
    roomNameIncludesInner: true,
  }, trace);
  return `[状态] ${gmNote}${state}`;
}

export function buildWhisperStatePrompt(scope, {
  includeLabel = false,
  includeInnerRoomName = true,
  trace,
} = {}) {
  const label = includeLabel ? "[当前世界状态，仅供你了解背景，不必主动复述] " : "";
  const state = renderStateTemplate(WHISPER_STATE_TEMPLATE, scope, {
    inventoryStyle: "detailed",
    inventorySeparator: "，",
    emptyInventory: "空",
    npcFormat: "names",
    roomNameIncludesInner: includeInnerRoomName,
  }, trace);
  return `${label}${state}`;
}

export function buildPreviewStatePrompt(scope, { trace } = {}) {
  return renderStateTemplate(PREVIEW_STATE_TEMPLATE, scope, {
    inventoryStyle: "name",
    inventorySeparator: "，",
    emptyInventory: "空",
    npcFormat: "names",
    roomNameIncludesInner: false,
  }, trace);
}
