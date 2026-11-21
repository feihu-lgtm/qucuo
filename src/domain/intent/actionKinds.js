// 行动识别的封闭行动集合与槽位规格。名称对齐 src/core/commands.js 里现有的本地命令：
// 赠送=npcGift、购买=npcTrade、切磋=duel、拜师/学艺=npcLearnSkill、移动=mapMovement、
// 交谈=npcTalk、使用物品=itemUseCollect；其他=原有自由行动 typedAction。
// 槽位选项一律从实时世界状态生成；数量（银两）由系统从玩家原文解析，不交给模型。
import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";

export const ACTION_KINDS = Object.freeze({
  GIFT: "赠送",
  BUY: "购买",
  DUEL: "切磋",
  LEARN: "拜师/学艺",
  MOVE: "移动",
  TALK: "交谈",
  USE_ITEM: "使用物品",
  OTHER: "其他",
});

export const KIND_LIST = Object.freeze(Object.values(ACTION_KINDS));

export const KIND_COMMAND = Object.freeze({
  [ACTION_KINDS.GIFT]: "npcGift",
  [ACTION_KINDS.BUY]: "npcTrade",
  [ACTION_KINDS.DUEL]: "duel",
  [ACTION_KINDS.LEARN]: "npcLearnSkill",
  [ACTION_KINDS.MOVE]: "mapMovement",
  [ACTION_KINDS.TALK]: "npcTalk",
  [ACTION_KINDS.USE_ITEM]: "itemUseCollect",
  [ACTION_KINDS.OTHER]: "typedAction",
});

// 每个行动需要问哪些槽；一槽一问，按顺序提问。
export const SLOT_SPECS = Object.freeze({
  [ACTION_KINDS.GIFT]: ["target", "item"],
  [ACTION_KINDS.BUY]: ["target"],
  [ACTION_KINDS.DUEL]: ["target"],
  [ACTION_KINDS.LEARN]: ["target"],
  [ACTION_KINDS.MOVE]: ["direction"],
  [ACTION_KINDS.TALK]: ["target"],
  [ACTION_KINDS.USE_ITEM]: ["item"],
  [ACTION_KINDS.OTHER]: [],
});

export const SILVER = "银两";
export const NONE = "无";
export const DIRECTIONS = Object.freeze(["北", "南", "东", "西"]);

export function visibleNpcs(state) {
  const room = state?.room;
  return (room?.npcs || []).filter((npc) => npc?.name && isNpcVisibleInInnerRoom(room.name, state.innerRoomName, npc));
}

export function itemNameOf(entry) {
  return typeof entry === "string" ? entry : entry?.name || "";
}

export function inventoryCounts(state) {
  const counts = new Map();
  for (const entry of state?.inv || []) {
    const name = itemNameOf(entry);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

export function slotOptions(state, kind, slot) {
  if (slot === "target") return [...new Set(visibleNpcs(state).map((npc) => npc.name)), NONE];
  if (slot === "direction") return [...DIRECTIONS, NONE];
  if (slot === "item") {
    const items = [...inventoryCounts(state).keys()];
    return kind === ACTION_KINDS.GIFT ? [SILVER, ...items, NONE] : [...items, NONE];
  }
  return [];
}

const DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNITS = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

export function parseChineseNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  let total = 0;
  let section = 0;
  let digit = 0;
  for (const ch of text) {
    if (ch in DIGITS) digit = DIGITS[ch];
    else if (ch === "万") { total += (section + digit) * 10000; section = 0; digit = 0; }
    else if (ch in UNITS) { section += (digit || 1) * UNITS[ch]; digit = 0; }
    else return null;
  }
  return total + section + digit;
}

// 「一百两」「100两银子」「五十两」→ 数量；只认带「两」的银两数额，避免把「两个馒头」当钱。
export function parseSilverAmount(text) {
  const match = String(text || "").match(/(?<![\d.])(\d+(?:\.\d+)?|[零一二两三四五六七八九十百千万]+?)\s*两(?:银子|银|纹银)?/);
  if (!match || match[1].includes(".")) return null;
  const value = parseChineseNumber(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
