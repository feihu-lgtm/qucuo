// 行动识别的封闭行动集合与槽位规格。名称对齐 src/infra/commands.js 里现有的本地命令：
// 赠送=npcGift、购买=npcTrade、切磋=duel、拜师/学艺=npcLearnSkill、邀同行=companionInvite、
// 偷窃=npcSteal、平息/道歉=npcAppease、移动=mapMovement、交谈=npcTalk、使用物品/拾取=itemUseCollect、
// 装备/卸下=menuEquip；其他=原有自由行动 typedAction。
// 槽位选项一律从实时世界状态生成；数量（银两）由系统从玩家原文解析，不交给模型。
import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { getGroundItems } from "../map/groundScope.js";

export const ACTION_KINDS = Object.freeze({
  GIFT: "赠送",
  BUY: "购买",
  DUEL: "切磋",
  LEARN: "拜师/学艺",
  INVITE: "邀同行",
  STEAL: "偷窃",
  APPEASE: "平息/道歉",
  MOVE: "移动",
  TALK: "交谈",
  USE_ITEM: "使用物品",
  PICKUP: "拾取",
  EQUIP: "装备/卸下",
  OTHER: "其他",
});

export const KIND_LIST = Object.freeze(Object.values(ACTION_KINDS));

export const KIND_COMMAND = Object.freeze({
  [ACTION_KINDS.GIFT]: "npcGift",
  [ACTION_KINDS.BUY]: "npcTrade",
  [ACTION_KINDS.DUEL]: "duel",
  [ACTION_KINDS.LEARN]: "npcLearnSkill",
  [ACTION_KINDS.INVITE]: "companionInvite",
  [ACTION_KINDS.STEAL]: "npcSteal",
  [ACTION_KINDS.APPEASE]: "npcAppease",
  [ACTION_KINDS.MOVE]: "mapMovement",
  [ACTION_KINDS.TALK]: "npcTalk",
  [ACTION_KINDS.USE_ITEM]: "itemUseCollect",
  [ACTION_KINDS.PICKUP]: "itemUseCollect",
  [ACTION_KINDS.EQUIP]: "menuEquip",
  [ACTION_KINDS.OTHER]: "typedAction",
});

// 每个行动需要问哪些槽；一槽一问，按顺序提问。
export const SLOT_SPECS = Object.freeze({
  [ACTION_KINDS.GIFT]: ["target", "item"],
  [ACTION_KINDS.BUY]: ["target"],
  [ACTION_KINDS.DUEL]: ["target"],
  [ACTION_KINDS.LEARN]: ["target"],
  [ACTION_KINDS.INVITE]: ["target"],
  [ACTION_KINDS.STEAL]: ["target"],
  [ACTION_KINDS.APPEASE]: ["target"],
  [ACTION_KINDS.MOVE]: ["direction"],
  [ACTION_KINDS.TALK]: ["target"],
  [ACTION_KINDS.USE_ITEM]: ["item"],
  [ACTION_KINDS.PICKUP]: ["item"],
  [ACTION_KINDS.EQUIP]: ["item"],
  [ACTION_KINDS.OTHER]: [],
});

export const SILVER = "银两";
export const NONE = "无";
// 「装备/卸下」从玩家原话判断方向：卸下类用词 → 脱，否则 → 穿。识别与闸门共用。
export const UNEQUIP_RE = /卸[下掉]?|脱[下掉]?|摘[下掉]?|解下|取[下掉]|拿[下掉]|收起/;
const DIRECTIONS = Object.freeze(["北", "南", "东", "西"]);

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
    // 拾取的对象是地上的东西；装备候选含地上物（复合指令先捡后穿）；其余物品槽都从背包出。
    if (kind === ACTION_KINDS.PICKUP) {
      return [...new Set(getGroundItems(state || {}).map(itemNameOf).filter(Boolean)), NONE];
    }
    const items = [...inventoryCounts(state).keys()];
    // 「先捡起来再装备」这类复合指令里，装备目标此刻还在地上；候选把地上物一并放出，由闸门按步校验到位。
    if (kind === ACTION_KINDS.EQUIP) {
      const ground = getGroundItems(state || {}).map(itemNameOf).filter(Boolean);
      return [...new Set([...items, ...ground]), NONE];
    }
    return kind === ACTION_KINDS.GIFT ? [SILVER, ...items, NONE] : [...items, NONE];
  }
  return [];
}

const DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNITS = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

function parseChineseNumber(text) {
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

// 「硬行动」关键词：原话里出现任何一个，就可能是封闭行动集合里的事，值得花一次分类调用。
// 与 ACTION_KINDS 逐类对齐（交谈/其他本来就是自由行动，不需要关键词）；条件从句（要是…就…）也算。
// 故意写宽：多放行只多花一次分类调用，漏掉则会把真正的赠送/移动等行动吞成纯叙事。
export const HARD_ACTION_RE = new RegExp([
  // 赠送
  "赠|送|递给|交给|塞给|献给|打赏|孝敬|施舍|给[他她它你]|把.{0,8}给|银子|银两|纹银|\\d+两",
  // 购买
  "买|购|采办|置办|赊|付钱|付银|交易|讨价",
  // 切磋
  "切磋|比试|比划|比武|过招|过两招|较量|交手|讨教|对练|决斗|挑战",
  // 拜师/学艺
  "拜师|拜.{0,4}为师|学艺|学武|学.{0,4}(?:功夫|武功|招|剑|刀|拳)|求教|教我|传授|收我为徒|拜入",
  // 邀同行
  "同行|结伴|同路|同去|一道走|一起走|一起去|跟我走|随我|入伙|带上我|带着我",
  // 偷窃
  "偷|窃|扒手|顺走|摸走|顺手牵羊",
  // 平息/道歉
  "道歉|赔罪|赔不是|认错|对不起|致歉|息怒|消气|平息|原谅|请罪|谢罪|抱歉",
  // 移动：往/去/走 + 方向或地名；向/朝只在带方向时算，免得「向她亲了一口」也放行
  "往|去|前往|赶往|走|出发|启程|上路|回[到去家村城]|[向朝]\\s*[东南西北上下]|到了?[^，。,.\\s]{1,6}(?:就|再|便)",
  // 使用物品
  "用|吃|喝|服下|服用|饮|敷|涂|嚼|吞",
  // 拾取
  "捡|拾|拿|取",
  // 装备/卸下
  "装备|穿上|穿戴|穿好|戴上|佩戴|披上|卸|脱下|脱掉|摘下|解下",
  // 条件从句
  "要是|如果|若是|万一|一旦|假如|倘若",
].join("|"));

// 一次性识别用的候选清单：全部来自实时世界状态，与逐槽提问时的 slotOptions 同源。
// items 按类别分开列，因为赠送含银两、拾取只看地上、装备含地上物。
export function recognitionOptions(state) {
  const withoutNone = (options) => options.filter((option) => option !== NONE);
  const itemKinds = [ACTION_KINDS.GIFT, ACTION_KINDS.USE_ITEM, ACTION_KINDS.PICKUP, ACTION_KINDS.EQUIP];
  return {
    kinds: KIND_LIST,
    targets: withoutNone(slotOptions(state, ACTION_KINDS.TALK, "target")),
    directions: withoutNone(slotOptions(state, ACTION_KINDS.MOVE, "direction")),
    items: Object.fromEntries(itemKinds.map((kind) => [kind, withoutNone(slotOptions(state, kind, "item"))])),
  };
}
