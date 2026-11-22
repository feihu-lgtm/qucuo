import { buildShopInventory } from "../../domain/data/shops/qucuoShops.js";
import { discountedBuyPrice } from "../../domain/rules/economy/equipment.js";
import { factionRepCoef, factionRepOf } from "../../domain/rules/economy/factionRep.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { selectEffectiveStats } from "../stats/logic.js";

export const TANGMEN_SHOP = "唐门暗器";
export const TANGMEN_FACTION = "唐门";
const OUTLETS = { tangmen_shop: "outer", sectshop_tangmen: "vault" };

export const tangmenOutletOf = (buildingId) => OUTLETS[buildingId] || null;

export function tangmenOutlet(state) {
  return tangmenOutletOf(getBuildingIdForInnerRoom(state.room?.name, state.innerRoomName));
}

// 锦官城外堂和唐堡内库共用「唐门暗器」货池，按唐门声誉定货色和价钱：
// ≤-60 两处都拒售；-59~-20 内库闭门，外堂只卖绿品且加价两成；其余按势力声誉折扣，minRep 未到的货不摆出来。
export function tangmenShopOffer(varTree, outlet) {
  if (!outlet) return { closed: "须到锦官城唐门暗器铺或蜀南唐堡内库才能买暗器。", items: [], coef: 1 };
  const rep = factionRepOf(varTree, TANGMEN_FACTION);
  if (rep <= -60) return { closed: "唐门已把你记上黑账，哪处铺面都不卖你东西。", items: [], coef: 1 };
  if (rep <= -20 && outlet === "vault") return { closed: "内库铁门紧闭，守库子弟说你如今不便进来。", items: [], coef: 1 };
  const hostile = rep <= -20;
  const items = buildShopInventory(TANGMEN_SHOP).items
    .filter((item) => rep >= (item.minRep ?? -Infinity) && (!hostile || item.quality === "绿"));
  return { items, coef: hostile ? 1.2 : factionRepCoef(rep) };
}

export const tangmenPayPrice = (buyPrice, wit, coef) => Math.max(1, Math.ceil(discountedBuyPrice(buyPrice, wit) * coef));

export function buyTangmenItem(state, itemName, now = Date.now()) {
  const message = (text) => ({ logs: [{ t: "sys", text }] });
  const offer = tangmenShopOffer(state.varTree, tangmenOutlet(state));
  if (offer.closed) return message(offer.closed);
  const item = offer.items.find((entry) => entry.name === itemName);
  if (!item) {
    const hidden = buildShopInventory(TANGMEN_SHOP).items.find((entry) => entry.name === itemName);
    if (hidden) return message(`「${hidden.name}」不对你摆出来：唐门声誉还不够。`);
    return message(`在售：${offer.items.map((entry) => entry.name).join("、")}。`);
  }
  const price = tangmenPayPrice(item.buyPrice, selectEffectiveStats(state).effectiveSpecialNow.智谋 ?? 5, offer.coef);
  if ((state.char?.money ?? 0) < price) return message("银两不足。");
  return {
    changes: {
      char: (char) => ({
        ...char,
        money: char.money - price,
        shopSpend: { ...char.shopSpend, [TANGMEN_SHOP]: (char.shopSpend?.[TANGMEN_SHOP] ?? 0) + price },
      }),
      inv: (inv = []) => {
        let index = inv.length;
        while (inv.some((entry) => entry?.id === `tangmen_purchase_${now}_${index}`)) index++;
        return [...inv, { ...item, buyPrice: price, id: `tangmen_purchase_${now}_${index}`, equipped: false }];
      },
    },
    logs: [{ t: "item", text: `购得「${item.name}」，花费${price}两。` }],
    note: { text: `购得「${item.name}」，花${price}两。`, source: NOTE_SOURCE.DUMB },
  };
}
