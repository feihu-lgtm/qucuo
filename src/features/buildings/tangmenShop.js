import { buildShopInventory } from "../../domain/data/shops/qucuoShops.js";
import { discountedBuyPrice } from "../../domain/rules/economy/equipment.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { selectEffectiveStats } from "../stats/logic.js";

export const TANGMEN_SHOP = "唐门暗器";

export function buyTangmenItem(state, itemName, now = Date.now()) {
  const message = (text) => ({ logs: [{ t: "sys", text }] });
  if (state.room?.name !== "锦官城" || state.innerRoomName !== "唐门暗巷") {
    return message("须到锦官城唐门暗器铺才能买暗器。");
  }
  const { items } = buildShopInventory(TANGMEN_SHOP);
  const item = items.find((entry) => entry.name === itemName);
  if (!item) return message(`唐门暗器铺在售：${items.map((entry) => entry.name).join("、")}。`);
  const price = discountedBuyPrice(item.buyPrice, selectEffectiveStats(state).effectiveSpecialNow.智谋 ?? 5);
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
