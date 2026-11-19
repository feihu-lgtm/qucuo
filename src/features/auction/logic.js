import { AUCTION_LOT } from "../../domain/economy/auction.js";
import { invHasItemNamed } from "../../domain/map/safeHouse.js";
import { makeItem } from "../../domain/economy/equipment.js";
import { makeItemSmart } from "../../domain/items/catalog.js";
import { NOTE_SOURCE } from "../../domain/memory/note.js";

export function auctionWin(state, finalPrice) {
  if ((state.char.money || 0) < finalPrice) return { logs: [{ t: "sys", text: "  你付不出这笔钱，掌槌的脸色很难看。" }] };
  if (invHasItemNamed(state.inv, AUCTION_LOT.name)) return { logs: [] };
  const lot = makeItemSmart({ name: AUCTION_LOT.name, category: AUCTION_LOT.category, quality: AUCTION_LOT.quality, desc: AUCTION_LOT.desc }, makeItem);
  return {
    changes: {
      char: c => ({ ...c, money: (c.money || 0) - finalPrice }),
      inv: prev => [...prev, lot],
    },
    logs: [
      { t: "sys", text: `  （以${finalPrice}两拍得「${AUCTION_LOT.name}」）` },
      { t: "loot", text: `✦ 得「${AUCTION_LOT.name}」`, item: lot, source: "auction" },
    ],
    note: { text: `在锦官城宝丰拍卖行以${finalPrice}两拍得「${AUCTION_LOT.name}」。`, source: NOTE_SOURCE.NARRATIVE },
    settle: `在锦官城宝丰拍卖行，以${finalPrice}两拍得一件前朝蜀王旧邸的「${AUCTION_LOT.name}」，掌槌落下，伙计把东西用红布包好递到手上`,
  };
}
