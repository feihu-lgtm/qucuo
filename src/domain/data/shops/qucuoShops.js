import { makeItem } from "../../rules/economy/equipment.js";
import { QUCUO_SHOPS } from "./shopCatalog.js";

export { QUCUO_SHOPS };

export function buildShopInventory(shopKey) {
  const shop = QUCUO_SHOPS[shopKey];
  if (!shop) return null;
  return {
    shopName: shop.shopName,
    currency: shop.currency || "silver",
    karmaLoss: shop.karmaLoss || 0,
    items: shop.items.map(cfg => ({
      ...makeItem({ name: cfg.name, category: cfg.category, quality: cfg.quality }),
      ...(CATALOG_INDEX[cfg.name]?.consumable ? { consumable: CATALOG_INDEX[cfg.name].consumable } : {}),
      ...(cfg.minRep == null ? {} : { minRep: cfg.minRep }),
      ...(cfg.member ? { member: true } : {}),
      ...(cfg.limitOnce ? { limitOnce: cfg.limitOnce } : {}),
      ...(cfg.limit ? { limit: cfg.limit } : {}),
    })),
  };
}


// ============================================================================
// 四池铺货 —— rollShopStock：按 region ∩ shopType 从 catalog 抽本地对味的货，
// 每天刷新一次（游戏 time÷24 做随机种子），修掉旧 floating 概率写死 0.5 的 bug。
// 依赖：items/distribution.js（每件货的归属）+ items/regionMap.js（店铺档案/品阶权重）
//       + items/catalog.js（makeNamedItem 取具名货吃专属数值）。
// ============================================================================
import { ITEM_DISTRIBUTION } from "../items/distribution.js";
import { ADVENTURER_POOL } from "../dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../dungeon/adventurersIP.js";
import { SHOP_PROFILE, TIER_PROFILE } from "../items/regionMap.js";
import { CATALOG_INDEX, makeNamedItem } from "../items/catalog.js";

// 稳定的字符串→整数哈希，给"店铺+第几天"造一个确定性种子（同一天同一店货单固定）
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// mulberry32：种子→[0,1) 伪随机，可复现
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 品阶→在某档店的"出摊基础概率"。tierProfile 是该档店对各品阶的偏好权重，
// 直接拿来当每件货的出现概率：低阶店里蓝档 0.10 → 蓝货一成机会出摊。
function chanceForQuality(quality, tierName) {
  const prof = TIER_PROFILE[tierName] || TIER_PROFILE["中"];
  return prof[quality] != null ? prof[quality] : 0.05;
}

// 该店的候选货名单：region 命中 且 shopTypes 任一命中 的 catalog 可上架商品
function candidatesFor(region, shopTypes) {
  const wanted = Array.isArray(shopTypes) ? shopTypes : [shopTypes];
  const names = [];
  for (const [name, tag] of Object.entries(ITEM_DISTRIBUTION)) {
    if (!tag.regions.includes(region)) continue;
    if (!tag.shopTypes.some(s => wanted.includes(s))) continue;
    if (!CATALOG_INDEX[name]) continue; // 防脏名
    names.push(name);
  }
  return names;
}

/**
 * 按四池规则滚动某店当天的货单。
 * @param {string} shopKey   qucuoBuildings 里的店铺 key
 * @param {number} gameTime  当前游戏时辰计数（time state）。同一天内多次进店货单不变。
 * @returns {{shopName, currency, karmaLoss, items}|null}
 */
export function rollShopStock(shopKey, gameTime = 0) {
  const profile = SHOP_PROFILE[shopKey];
  const legacy = QUCUO_SHOPS[shopKey];
  // 没进四池档案的店（特殊功能店等）回退旧固定逻辑，保证不崩
  if (!profile) return legacy ? buildShopInventory(shopKey) : null;

  const day = Math.floor((gameTime || 0) / 24);           // 每 24 时辰 = 1 天
  const rng = mulberry32(hashSeed(shopKey + "@" + day));   // 当天该店的确定性随机流
  const { region, shopTypes, tier } = profile;

  const pool = candidatesFor(region, shopTypes);
  const picked = [];
  // floating：逐件按"各自品阶概率"掷骰（修掉旧写死 0.5 的 bug）
  for (const name of pool) {
    const entry = CATALOG_INDEX[name];
    const p = chanceForQuality(entry.quality, tier);
    if (rng() < p) picked.push(name);
  }
  // 招牌货 fixed：该店本地货里，取品阶最低的 1~2 件永远在架，给玩家稳定预期
  if (picked.length === 0 && pool.length) {
    const QORD = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };
    const sorted = [...pool].sort((a, b) => QORD[CATALOG_INDEX[a].quality] - QORD[CATALOG_INDEX[b].quality]);
    picked.push(sorted[0]);
    if (sorted[1]) picked.push(sorted[1]);
  }
  // 上限：店越高阶货越多，避免一屏塞太多
  const cap = tier === "高" ? 14 : tier === "中" ? 10 : 7;
  const finalNames = picked.slice(0, cap);

  return {
    shopName: (legacy && legacy.shopName) || shopKey,
    currency: (legacy && legacy.currency) || "silver",
    karmaLoss: (legacy && legacy.karmaLoss) || 0,
    items: finalNames.map(n => makeNamedItem(n)).filter(Boolean),
  };
}

// ── OC 冒险者店铺：shop{name,goods} 落进交易通路 ──────────────────
// goods 里命中 CATALOG_INDEX 的按具名真货出货（价/属性吃专属数值）；
// 没入册的稀奇货按杂物白档出，desc 有原文照抄、没有的补一句接地气文案。
const OC_SHOP_BY_NAME = Object.fromEntries(
  [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP]
    .filter((adv) => adv.shop?.goods?.length)
    .map((adv) => [adv.name, adv]),
);

export function buildOcShopInventory(npcName) {
  const oc = OC_SHOP_BY_NAME[npcName];
  if (!oc) return null;
  const items = [];
  for (const g of oc.shop.goods) {
    const gName = typeof g === "string" ? g : g?.name;
    const gDesc = typeof g === "object" ? g?.desc : null;
    if (!gName) continue;
    const real = makeNamedItem(gName);
    if (real) { items.push(real); continue; }
    items.push(makeItem({
      name: gName,
      category: "misc",
      quality: "白",
      desc: gDesc || `${oc.name}摊上摆着的稀罕货，来路只有她自己说得清。`,
    }));
  }
  return items.length ? { shopName: oc.shop.name, currency: "silver", karmaLoss: 0, items, ocOwner: oc.name } : null;
}
