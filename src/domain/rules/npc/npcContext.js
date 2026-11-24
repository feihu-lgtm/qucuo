// 统一 NPC 上下文装配器：把人设、装束、外露度、随身行囊、买卖往来、所在地、好感度
// 与过往/对话/书信记忆收成单一口径，供端详、飞鸽传书、同伴插话等调用方按需取用。

import { ITEM_CATEGORY } from "../economy/equipment.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";
import { attireExposure, OC_BY_NAME } from "./npcCarry.js";
import { itemKey, npcTradeOf } from "./npcTrade.js";

const GEAR = new Set([ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY]);

export function npcGear(npc) {
  // carriedItems 是唯一 live 随身源（货架/偷池/送礼都写它）；类目未标的条目
  // 走 normalize 口径——OC 的 stealables 装备多数不写 category，名录也查得到。
  return [...new Set((npc?.carriedItems || [])
    .filter((item) => item?.name && !item.stolen && !item.dropped && !item.sold)
    .map((item) => {
      // 袋装货不是穿戴——玩家卖给他的装备躺在 bag 槽里，不算装束。
      if (item.slot === "bag" || item.slot === "mount") return null;
      const cat = item.category || CATALOG_INDEX[item.name]?.category;
      return cat && cat !== ITEM_CATEGORY.MISC && GEAR.has(cat) ? item.name : null;
    })
    .filter(Boolean))];
}

// 换装同步链的外观段：装备随买卖/偷窃/赠送变化时重算——sold/stolen 标记写进条目
// 那一刻，本函数读到就是新外观，look 卡/prompt 自然即时刷新，不需要单独存外观字段。
export function deriveAppearance(npc, { trade = null } = {}) {
  return { gear: npcGear(npc), exposure: attireExposure(npc, trade) };
}

function resolveNpcObject(npc, state, includeOcPool) {
  const rawObj = npc && typeof npc === "object" ? npc : {};
  const name = rawObj.name || (typeof npc === "string" ? npc : "") || "";
  const roomNpc = (!rawObj.name && name)
    ? state?.room?.npcs?.find((n) => n.name === name) || {}
    : {};
  const oc = includeOcPool && name ? OC_BY_NAME[name] : null;
  const merged = { ...(oc || {}), ...roomNpc, ...rawObj };
  if (name && !merged.name) merged.name = name;
  return merged;
}

function collectCarryNames(npcObj, trade) {
  const boughtItems = Array.isArray(trade?.bought) ? trade.bought : Object.keys(trade?.bought || {});
  const soldKeys = trade?.sold || {};
  const stillOwned = (item) => item
    && !item.sold
    && !item.stolen
    && !item.dropped
    && !soldKeys[itemKey(item)]
    && !soldKeys[item?.name];
  const names = [
    ...(npcObj.carriedItems || npcObj.carry || []),
    ...(npcObj.stealables?.sundries || []),
    ...(npcObj.stealables?.equipment || []),
    ...boughtItems,
  ]
    .filter(stillOwned)
    .map((item) => (typeof item === "object" && item ? item.name : item))
    .filter(Boolean);
  return {
    carryNames: [...new Set(names)],
    tradeCounts: { bought: boughtItems.length, sold: Object.keys(soldKeys).length },
  };
}

export function buildNpcContext(npc, state = {}, {
  trade = null,
  history = [],
  convoLines = [],
  letters = [],
  includeOcPool = false,
} = {}) {
  const npcObj = resolveNpcObject(npc, state, includeOcPool);
  const name = npcObj.name || "";
  const resolvedTrade = trade || (name ? npcTradeOf(state?.npcState, npcObj) : {}) || {};
  const attrs = (name && state?.varTree?.角色?.[name]) || {};
  const { gear, exposure } = deriveAppearance(npcObj, { trade: resolvedTrade });
  const { carryNames, tradeCounts } = collectCarryNames(npcObj, resolvedTrade);
  const bio = (npcObj.brief ? `，${npcObj.brief}` : "")
    + (npcObj.fullBio ? `${npcObj.fullBio} ` : "")
    + (npcObj.personality ? `性情：${npcObj.personality}。` : "");
  const oc = name ? OC_BY_NAME[name] : null;
  const chatterPersona = oc
    ? `${oc.archetypeLabel || ""}，${oc.personality || oc.brief || ""}`
    : (npcObj.personality || npcObj.brief || "江湖散人");

  return {
    npc: npcObj,
    name,
    brief: npcObj.brief || "",
    persona: npcObj.appearance || npcObj.fullBio || npcObj.personality || "",
    chatterPersona,
    bio,
    favorability: typeof attrs.好感度 === "number" ? attrs.好感度 : null,
    location: attrs.所在地 || "",
    gear,
    exposure,
    carryNames,
    tradeCounts,
    hp: npcObj.combatStats?.hp || null,
    history,
    convoLines,
    letters,
  };
}
