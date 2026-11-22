import { priceForQuality } from "../economy/equipment.js";
import { GIFT_WEIGHT } from "../state/fields.js";

export function computeGiftWeight(npc, gift) {
  const identity = [npc?.name, npc?.brief, npc?.title].filter(Boolean);
  const station = identity.some((text) => GIFT_WEIGHT.modest.test(text)) ? "modest"
    : identity.some((text) => GIFT_WEIGHT.wealthy.test(text)) ? "wealthy" : "ordinary";
  const value = gift.amount ?? priceForQuality(gift.category, gift.quality).buyPrice;
  const ratio = value / GIFT_WEIGHT.baseline[station]();
  return GIFT_WEIGHT.bands.findLast((band) => ratio >= band.ratio);
}
