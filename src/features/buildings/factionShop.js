import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { buildShopInventory } from "../../domain/data/shops/qucuoShops.js";
import { discountedBuyPrice } from "../../domain/rules/economy/equipment.js";
import { factionRepCoef, factionRepOf } from "../../domain/rules/economy/factionRep.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { SECT_MEMBER_FLAGS } from "../../domain/rules/character/factionEntry.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { selectEffectiveStats } from "../stats/logic.js";

// 势力商店：货池按该势力声誉定货色和价钱。
// ≤-60 拒售；-59~-20 只卖 hostileQualities 品阶、加价两成（hostileClosed 的铺面直接闭门）；
// 其余按势力声誉折扣，minRep 未到的货不摆出来；member 货只卖本门弟子，limitOnce 货买过一次即撤柜（记在 flags）。
// limitOnce 为 true 按货名记，为字符串则同组货共享一条标记——买走一件同组全撤柜（二选一秘货）。
// deepCoef 可再压一层深交折扣：rep 到档直接用它的价（如天龙军需坊 rep100 → 0.7）。
// 额外两个可选门槛：closedBelowRep 声誉未到的铺面直接闭门（如秘珍坊）；coldItems 冷淡（-19~-1）只摆这几味清水货；
// hostileItems 则把交恶档按名字限货（不写就走 hostileQualities 品阶过滤）。
const FACTION_SHOPS = {
  唐门暗器: {
    faction: "唐门", idPrefix: "tangmen_purchase",
    outlets: { tangmen_shop: "outer", sectshop_tangmen: "vault" },
    nowhere: "须到锦官城唐门暗器铺或蜀南唐堡内库才能买暗器。",
    banned: "唐门已把你记上黑账，哪处铺面都不卖你东西。",
    hostileClosed: { vault: "内库铁门紧闭，守库子弟说你如今不便进来。" },
    hostileQualities: ["绿"],
  },
  青城商坊: {
    faction: "青城派", idPrefix: "qingcheng_purchase",
    outlets: { sectshop_yajiang: "vault" },
    nowhere: "须到青城山三清玄阁才能买青城商坊的货。",
    banned: "持堂道人横剑拦在阁前：「青城山门不做你的生意。」",
    hostileClosed: {},
    hostileQualities: ["白", "绿"],
  },
  峨眉坊: {
    faction: "峨眉派", idPrefix: "emei_purchase",
    outlets: { sectshop_emei: "vault" },
    nowhere: "须到锦官城峨眉剑庐后院的锻簪坊才能买峨眉坊的货。",
    banned: "簪娘冷言：「峨眉的铁，不沾脏手。」",
    hostileClosed: {},
    hostileQualities: ["绿"],
  },
  // 五仙教两家铺面共用五仙教声誉：百蛊房平常有门有脸，秘珍坊要声誉 ≥40 才开门（合稿 6.2）；
  // 交恶未至死敌（-59~-20）照 hostileQualities 摆白绿并加价，冷淡（-19~-1）只摆 coldItems 两味清水药。
  五仙百蛊房: {
    faction: "五仙教", idPrefix: "wuxian_purchase",
    outlets: { medicine_wuxian: "outer" },
    nowhere: "须到雾隐寨百蛊药房才能买五仙教的蛊药。",
    banned: "阿萝把陶罐往柜台上一磕：「五仙教的药，不卖仇人。」",
    hostileClosed: {},
    hostileQualities: ["白", "绿"],
    coldItems: ["清瘴丸", "蛇药粉"],
  },
  五仙秘珍坊: {
    faction: "五仙教", idPrefix: "wuxian_purchase",
    outlets: { sectshop_wuxian: "vault" },
    nowhere: "须到雾隐寨百蛊湿廊尽头的秘珍坊才能买五仙教的秘货。",
    banned: "守廊弟子收刀入鞘：「秘珍坊不做死敌的生意。」",
    closedBelowRep: { rep: 40, text: "秘珍坊的暗门纹丝不动——你在五仙教的名声还不够进这间门。" },
    hostileClosed: { vault: "秘珍坊的暗门紧闭，廊下灯笼全灭。" },
    hostileQualities: [],
  },
  三星分舵商坊: {
    faction: "丐帮三星分舵", idPrefix: "gaibang_purchase",
    outlets: { sectshop_gaibang: "vault" },
    nowhere: "须到广汉破庙粥棚后耳房的分舵义坊才能买丐帮的货。",
    banned: "白婶拎起大汤勺：「分舵不做你的生意，走吧。」",
    hostileClosed: {},
    hostileQualities: ["白", "绿", "蓝"],
  },
  // 雪山派·门派商坊：隐世门派，货池平常（白绿蓝紫橙按 minRep 阶梯）。
  // 交恶（-59~-20）溢价两成且只留基础干粮姜茶（hostileItems）；冷淡（-19~-1）原价只摆白品杂货。
  门派商坊: {
    faction: "雪山派", idPrefix: "xueshan_purchase",
    outlets: { sectshop_xueshan: "outer" },
    nowhere: "须到雪山派门派商坊才能买雪山的山货。",
    banned: "沈既白把柜台一合：「商坊不做你的生意，请下山。」",
    hostileClosed: {},
    hostileItems: ["雪山姜枣干粮", "寒岭冻伤膏"],
    coldItems: ["雪山姜枣干粮", "寒岭冻伤膏", "雪松木剑"],
  },
  // 天龙军需坊（西风隘·天龙营）。玄甲军需官记账先看脸：交恶至敌对（-59~-20）只摆绿品且加价，
  // 深交到顶（rep100）七折并摆出二选一秘货——止戈玉令与陨铁血刃共用 tianlong_secret 组标记。
  天龙军需坊: {
    faction: "天龙教", idPrefix: "tianlong_purchase",
    outlets: { sectshop_tianlong: "vault" },
    nowhere: "须到西风隘天龙营的军需坊才能买天龙教的军货。",
    banned: "玄甲兵把长刀往柜台上一横：「军需坊不做死敌的生意。」",
    hostileClosed: {},
    hostileQualities: ["绿"],
    deepCoef: { rep: 100, coef: 0.7 },
  },
};

export const isFactionShop = (shopKey) => !!FACTION_SHOPS[shopKey];
export const factionShopOutlet = (shopKey, buildingId) => FACTION_SHOPS[shopKey]?.outlets[buildingId] || null;

const boughtFlag = (shopKey, name) => `shop_bought:${shopKey}:${name}`;
// limitOnce: true 按货名记已购；字符串则整组货共用一条标记（二选一秘货组）。
const limitKey = (item) => (item.limitOnce === true ? item.name : item.limitOnce);

export function factionShopOffer(shopKey, varTree, outlet, flags = []) {
  const shop = FACTION_SHOPS[shopKey];
  const closed = (text) => ({ closed: text, items: [], coef: 1 });
  if (!outlet) return closed(shop.nowhere);
  const rep = factionRepOf(varTree, shop.faction);
  if (rep <= -60) return closed(shop.banned);
  const hostile = rep <= -20;
  if (hostile && shop.hostileClosed[outlet]) return closed(shop.hostileClosed[outlet]);
  if (!hostile && shop.closedBelowRep && rep < shop.closedBelowRep.rep) return closed(shop.closedBelowRep.text);
  const cold = !hostile && rep < 0 && shop.coldItems;
  const items = buildShopInventory(shopKey).items
    .filter((item) => (!item.member || flags.includes(SECT_MEMBER_FLAGS[shop.faction]))
      && (!item.limitOnce || !flags.includes(boughtFlag(shopKey, limitKey(item)))))
    .map((item) => ({
      ...(makeNamedItem(item.name) ?? item),
      ...(item.minRep == null ? {} : { minRep: item.minRep }),
      ...(item.limitOnce ? { limitOnce: item.limitOnce } : {}),
    }))
    .filter((item) => rep >= (item.minRep ?? -Infinity)
      && (!hostile || (shop.hostileItems ? shop.hostileItems.includes(item.name) : shop.hostileQualities.includes(item.quality)))
      && (!cold || cold.includes(item.name)));
  const coef = hostile ? 1.2
    : (shop.deepCoef && rep >= shop.deepCoef.rep ? shop.deepCoef.coef : factionRepCoef(rep));
  return { items, coef };
}

const payPrice = (buyPrice, wit, coef) => Math.max(1, Math.ceil(discountedBuyPrice(buyPrice, wit) * coef));

export function buyFactionShopItem(state, shopKey, itemName, now = Date.now()) {
  const shop = FACTION_SHOPS[shopKey];
  const message = (text) => ({ logs: [{ t: "sys", text }] });
  if (!shop) return message("此处不是势力商店。");
  const outlet = factionShopOutlet(shopKey, getBuildingIdForInnerRoom(state.room?.name, state.innerRoomName));
  const offer = factionShopOffer(shopKey, state.varTree, outlet, state.flags || []);
  if (offer.closed) return message(offer.closed);
  const item = offer.items.find((entry) => entry.name === itemName);
  if (!item) {
    const hidden = buildShopInventory(shopKey).items.find((entry) => entry.name === itemName);
    if (hidden?.limitOnce && (state.flags || []).includes(boughtFlag(shopKey, limitKey(hidden)))) {
      return message(hidden.limitOnce === true ? `「${hidden.name}」只此一件，已经卖给你了。` : `「${hidden.name}」这条线上的秘货只出一件，你已经挑过了。`);
    }
    if (hidden?.member && !(state.flags || []).includes(SECT_MEMBER_FLAGS[shop.faction])) return message(`「${hidden.name}」只授${shop.faction}本门弟子。`);
    if (hidden) return message(`「${hidden.name}」不对你摆出来：${shop.faction}声誉还不够。`);
    return message(`在售：${offer.items.map((entry) => entry.name).join("、")}。`);
  }
  const price = payPrice(item.buyPrice, selectEffectiveStats(state).effectiveSpecialNow.智谋 ?? 5, offer.coef);
  if ((state.char?.money ?? 0) < price) return message("银两不足。");
  return {
    changes: {
      char: (char) => ({
        ...char,
        money: char.money - price,
        shopSpend: { ...char.shopSpend, [shopKey]: (char.shopSpend?.[shopKey] ?? 0) + price },
      }),
      inv: (inv = []) => {
        let index = inv.length;
        while (inv.some((entry) => entry?.id === `${shop.idPrefix}_${now}_${index}`)) index++;
        return [...inv, { ...item, buyPrice: price, id: `${shop.idPrefix}_${now}_${index}`, equipped: false }];
      },
      ...(item.limitOnce ? { flags: (flags = []) => [...flags, boughtFlag(shopKey, limitKey(item))] } : {}),
    },
    logs: [{ t: "item", text: `购得「${item.name}」，花费${price}两。` }],
    note: { text: `购得「${item.name}」，花${price}两。`, source: NOTE_SOURCE.DUMB },
  };
}
