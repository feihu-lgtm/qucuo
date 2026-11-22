import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { buildShopInventory } from "../../domain/data/shops/qucuoShops.js";
import { discountedBuyPrice } from "../../domain/rules/economy/equipment.js";
import { factionRepCoef, factionRepOf } from "../../domain/rules/economy/factionRep.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { SECT_MEMBER_FLAGS } from "../../domain/rules/character/qingchengEntry.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { selectEffectiveStats } from "../stats/logic.js";

// 势力商店：货池按该势力声誉定货色和价钱。
// ≤-60 拒售；-59~-20 只卖 hostileQualities 品阶、加价两成（hostileClosed 的铺面直接闭门）；
// 其余按势力声誉折扣，minRep 未到的货不摆出来；member 货只卖本门弟子，limitOnce 货买过一次即撤柜（记在 flags）。
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
};

export const isFactionShop = (shopKey) => !!FACTION_SHOPS[shopKey];
export const factionShopOutlet = (shopKey, buildingId) => FACTION_SHOPS[shopKey]?.outlets[buildingId] || null;

const boughtFlag = (shopKey, name) => `shop_bought:${shopKey}:${name}`;

export function factionShopOffer(shopKey, varTree, outlet, flags = []) {
  const shop = FACTION_SHOPS[shopKey];
  const closed = (text) => ({ closed: text, items: [], coef: 1 });
  if (!outlet) return closed(shop.nowhere);
  const rep = factionRepOf(varTree, shop.faction);
  if (rep <= -60) return closed(shop.banned);
  const hostile = rep <= -20;
  if (hostile && shop.hostileClosed[outlet]) return closed(shop.hostileClosed[outlet]);
  const items = buildShopInventory(shopKey).items
    .filter((item) => (!item.member || flags.includes(SECT_MEMBER_FLAGS[shop.faction]))
      && (!item.limitOnce || !flags.includes(boughtFlag(shopKey, item.name))))
    .map((item) => ({
      ...(makeNamedItem(item.name) ?? item),
      ...(item.minRep == null ? {} : { minRep: item.minRep }),
      ...(item.limitOnce ? { limitOnce: true } : {}),
    }))
    .filter((item) => rep >= (item.minRep ?? -Infinity) && (!hostile || shop.hostileQualities.includes(item.quality)));
  return { items, coef: hostile ? 1.2 : factionRepCoef(rep) };
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
    if (hidden?.limitOnce && (state.flags || []).includes(boughtFlag(shopKey, hidden.name))) return message(`「${hidden.name}」只此一件，已经卖给你了。`);
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
      ...(item.limitOnce ? { flags: (flags = []) => [...flags, boughtFlag(shopKey, item.name)] } : {}),
    },
    logs: [{ t: "item", text: `购得「${item.name}」，花费${price}两。` }],
    note: { text: `购得「${item.name}」，花${price}两。`, source: NOTE_SOURCE.DUMB },
  };
}
