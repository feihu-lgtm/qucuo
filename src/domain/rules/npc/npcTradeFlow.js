// ── NPC 随身交易·定价与结算（设计稿 §2/§3）──
// 货架=对方 carriedItems 归一化后按 slot 分区；系统裁决价格与归属，AI 只写话术。
// 本文件只做纯函数判定：报价、收购系数、买卖落账结果，不写任何 store——
// 由 features/面板层把结果落到 char/inv/room.npcs/npcState。
import { CATALOG_INDEX } from "../../data/items/catalog.js";
import { ITEM_CATEGORY } from "../economy/equipment.js";
import { normalizeCarryEntry } from "./npcCarry.js";
import { applyNpcTradeDelta, itemKey } from "./npcTrade.js";

/** 好感度读取口：varTree.角色[名].好感度（npcAwareness 种初值那套）。 */
export function affectionOf(varTree, npcName) {
  return varTree?.角色?.[npcName]?.好感度 ?? 0;
}

// 收购系数（§2.3）：元朵朵冤种溢价 2.5；奸商型 0.7；普通 1.0；
// 好感 ≥80 再 +0.3。奸商名单走 tradeStyle 关键词——OC 数据层的口径。
const SELL_COEF_SPECIAL = { 元朵朵: 2.5 };
// 前置否定或敌对语境（"从不漫天要价"、"对奸商拔刀相向"）是夸他公道，不算。
const GOUGER_KEYWORDS = ["雁过拔毛", "漫天要价", "奸商", "坑人", "忽悠"];
const GOUGER_NEG_RE = /[不无非莫未绝少毋敌恨杀砍打对憎]/;
function isPriceGouger(npc) {
  const text = `${npc?.tradeStyle || ""} ${npc?.brief || ""}`;
  return GOUGER_KEYWORDS.some(kw => {
    for (let i = text.indexOf(kw); i >= 0; i = text.indexOf(kw, i + 1)) {
      if (!GOUGER_NEG_RE.test(text.slice(Math.max(0, i - 2), i))) return true;
    }
    return false;
  });
}
export function sellCoefOf(npc, affection = 0) {
  const base = SELL_COEF_SPECIAL[npc?.name]
    ?? (isPriceGouger(npc) ? 0.7 : 1.0);
  return affection >= 80 ? base + 0.3 : base;
}

/** 条目的底价：carry 显式 price > 条目自带 buyPrice > catalog 词条价。 */
export function carryBasePrice(entry) {
  return entry?.price ?? entry?.buyPrice ?? CATALOG_INDEX[entry?.name]?.buyPrice ?? 0;
}

/**
 * 买入报价（§2.2 + 工单口径）：
 * - mount 挂载 → 只展示不可买；
 * - cherish ≥80（挚爱）→ 默认拒售；好感 ≥60 触发「割爱」按 2 倍价放行；
 * - sellable=false → 不卖占位；
 * - cherish 50-79（中钟爱）→ 3 倍价；
 * - 其余 → 底价。
 * @returns {{mode:"normal"|"cherish"|"geai"|"beloved"|"notForSale"|"mount", price:number|null}}
 */
export function quoteBuy(entry, affection = 0, priceMod = null) {
  const cherish = entry?.cherish ?? 0;
  const base = carryBasePrice(entry);
  // WO-25H 活世界物价倍率：具体品类优先，缺省落 all 兜底；钳制已在投影层做过。
  // 局势卡品类键是 medicine/food/incense/all，货目 category 是 weapon/armor/accessory/misc
  // ——消耗品按效果归口：回血药归 medicine、其余入口吃食归 food，皆不中落 all。
  let mod = 1;
  if (priceMod) {
    const cat = entry?.category;
    if (cat && priceMod[cat] != null) mod = priceMod[cat];
    else if (entry?.consumable?.hpRestore && priceMod.medicine != null) mod = priceMod.medicine;
    else if (entry?.consumable && priceMod.food != null) mod = priceMod.food;
    else mod = priceMod.all ?? 1;
  }
  const modded = (v) => Math.max(1, Math.round(v * mod));
  if (entry?.slot === "mount") return { mode: "mount", price: null };
  if (cherish >= 80) {
    if (affection >= 60) return { mode: "geai", price: modded(base * 2) };
    return { mode: "beloved", price: null };
  }
  if (entry?.sellable === false) return { mode: "notForSale", price: null };
  if (cherish >= 50) return { mode: "cherish", price: modded(base * 3) };
  return { mode: "normal", price: Math.max(0, Math.round(base * mod)) };
}

/** 卖出报价：玩家行囊件的 sellPrice × sellCoef，取整；0 价为不收。 */
export function quoteSell(npc, item, affection = 0) {
  const base = item?.sellPrice ?? 0;
  if (!(base > 0)) return 0;
  return Math.max(1, Math.round(base * sellCoefOf(npc, affection)));
}

/**
 * 货架换源（§2.1）：carriedItems → normalizeCarryEntry → 三档分区。
 * 已记归宿的（stolen/dropped）不上架；每件附报价与可买标记。
 */
export function buildCarryShelf(npc, affection = 0, priceMod = null) {
  const sections = { equipment: [], bag: [], mount: [] };
  for (const raw of npc?.carriedItems || []) {
    if (raw?.stolen || raw?.dropped) continue;
    const entry = normalizeCarryEntry(npc, raw);
    const quote = quoteBuy(entry, affection, priceMod);
    const buyable = quote.price != null;
    const shelfEntry = {
      ...entry,
      buyPrice: quote.price,
      // 成交价已是钟爱/割爱曲线算出的终价，UI 不再叠智谋折/声望折
      fixedPrice: true,
      notForSale: !buyable,
      quoteMode: quote.mode,
    };
    if (sections[entry.slot]) sections[entry.slot].push(shelfEntry);
  }
  return sections;
}

/** 货架平铺成 items 序列（TradingScreen 现有协议）：装备→行囊→挂载。 */
export function flattenShelf(sections) {
  return [...(sections?.equipment || []), ...(sections?.bag || []), ...(sections?.mount || [])];
}

/**
 * 买入结算（纯函数）：校验 → 返回 {ok, price, entry, nextCarriedItems, tradeDelta, logs}。
 * 同一 itemId 先发生者优先：条目已 stolen/dropped 则货架本就不会出它——
 * 这里再拦一次，防 UI 快照滞后重复点击。
 */
export function buyFromNpcCarry(npc, targetItem, { affection = 0, money = 0 } = {}) {
  // 货架条目自带 id，itemKey 精确命中优先；只有调用方没给 id（老档/手写货架）
  // 才退到按 name 匹配——否则同名两件货会买错件。
  const live = (npc?.carriedItems || []).find(i => itemKey(i) === itemKey(targetItem))
    ?? (targetItem?.id ? null
      : (npc?.carriedItems || []).find(i => i?.name === targetItem?.name));
  if (!live) return { ok: false, logs: [{ t: "sys", text: `  「${targetItem?.name || "那件货"}」已经不在 ${npc?.name || "对方"} 身上了。` }] };
  // 三态互斥：归宿已定的（stolen/dropped）无权再被买——同一 itemId 先发生者优先。
  if (live.stolen || live.dropped) return { ok: false, logs: [{ t: "sys", text: `  「${live.name}」已经不在 ${npc?.name || "对方"} 身上了。` }] };
  const entry = normalizeCarryEntry(npc, live);
  const quote = quoteBuy(entry, affection);
  if (quote.mode === "mount") return { ok: false, logs: [{ t: "sys", text: `  ${npc.name}把「${entry.name}」往身后一护——这不算货。` }] };
  if (quote.mode === "beloved") return { ok: false, logs: [{ t: "sys", text: `  ${npc.name}摇摇头，抱紧了「${entry.name}」——挚爱之物，给再多钱也不卖。` }] };
  if (quote.mode === "notForSale") return { ok: false, logs: [{ t: "sys", text: `  ${npc.name}笑着摆手：「这个不卖。」` }] };
  if (money < quote.price) return { ok: false, logs: [{ t: "sys", text: `  银两不够——「${entry.name}」要 ${quote.price} 两。` }] };
  const nextCarriedItems = (npc.carriedItems || []).filter(i => itemKey(i) !== itemKey(live));
  const delta = { sold: live };
  // 换装同步链：装备槽的货被买走=对方当场脱下——log 留一笔，外显/prompt
  // 靠 deriveAppearance 读 live carriedItems 自动跟着变。
  const wornOff = entry.slot === "equipment"
    && [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY].includes(entry.category)
    ? [{ t: "sys", text: `  ${npc.name}脱下了${entry.name}，换到你手上。` }] : [];
  const logs = [...(quote.mode === "geai"
    ? [{ t: "item", text: `  ${npc.name}攥着「${entry.name}」看了半晌，终是咬牙塞给你——念在情分，${quote.price} 两，算是割爱。` }]
    : quote.mode === "cherish"
      ? [{ t: "item", text: `  ${npc.name}肉疼地掂了掂「${entry.name}」，报了平时三倍的价：${quote.price} 两。` }]
      : [{ t: "item", text: `  你花费${quote.price}两，购得「${entry.name}」。` }]), ...wornOff];
  return { ok: true, price: quote.price, entry, nextCarriedItems, tradeDelta: delta, logs };
}

/**
 * 卖出结算（纯函数）：{ok, price, nextCarriedItems, tradeDelta, logs}。
 * 货入对方 bag 槽、清 stolen/dropped 记位（重入流通）；台账记 bought——
 * 下回可被 steal/drop，闭环成立。
 */
export function sellToNpcCarry(npc, item, { affection = 0 } = {}) {
  const price = quoteSell(npc, item, affection);
  if (!(price > 0)) return { ok: false, logs: [{ t: "sys", text: `  ${npc?.name || "对方"}不收「${item?.name || "这个"}」。` }] };
  const bagEntry = {
    ...item,
    id: item.id || `${npc.id}_buy_${item.name}`,
    slot: "bag", sellable: true, cherish: 0,
    // 对方转手只按实收价出——否则玩家能同一件货反复低买高卖刷银子
    price,
    stolen: false, dropped: false, equipped: false,
  };
  const nextCarriedItems = [...(npc.carriedItems || []), bagEntry];
  const delta = { bought: bagEntry };
  return { ok: true, price, entry: bagEntry, nextCarriedItems, tradeDelta: delta,
    logs: [{ t: "item", text: `  你卖出「${item.name}」，${npc.name}出 ${price} 两收下。` }] };
}


/**
 * WO-23D0a 购回入包 id 裁决（纯函数）：货架条目原本带 id 且玩家背包无同 id
 * 冲突时保留原 id——器物谱/觉醒账本按 id 追踪，赎回同一实例必须不断联；
 * 无 id 或撞 id 才铸新 id。不按名字猜，同名两件各按实例 id 走。
 */
export function resolveBuyInId(item, inv) {
  const invIds = new Set((inv || []).map((i) => (typeof i === "object" ? i?.id : i)).filter(Boolean));
  if (item?.id && !invIds.has(item.id)) return item.id;
  return `${item?.name || "item"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 给 store 层用：把 delta 落进 npcState[npc.id ?? npc.name]，并在记录里留
 * name——再出场/换据点时房间实例 id 会变（pool_ 前缀/重抽），npcTradeOf
 * 按 name 兜底扫描还能找回这笔台账。
 */
export function applyTradeToNpcState(npcState, npc, delta) {
  const key = npc?.id ?? npc?.name;
  if (!key) return npcState || {};
  const prev = npcState?.[key] || {};
  return {
    ...(npcState || {}),
    [key]: { ...prev, name: npc?.name ?? prev.name, trade: applyNpcTradeDelta(prev.trade, delta) },
  };
}
