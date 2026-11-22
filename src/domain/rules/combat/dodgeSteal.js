import { random } from "../../../infra/rng.js";

export function rollDodgeSteal(move, carriedItems, alreadyStolen, rng = random) {
  if (alreadyStolen || !(move?.stealOnDodge > 0)) return null;
  const items = (carriedItems || []).filter((item) => !item.stolen && !item.dropped);
  if (!items.length || rng() >= move.stealOnDodge) return null;
  return items[Math.floor(rng() * items.length)];
}

export function excludeDodgeStolenItems(npc, stolenItems) {
  const ids = new Set((stolenItems || []).map((item) => item.id).filter(Boolean));
  const names = new Set((stolenItems || []).map((item) => item.name));
  return {
    ...npc,
    carriedItems: (npc.carriedItems || []).map((item) => (
      ids.has(item.id) || (!item.id && names.has(item.name)) ? { ...item, stolen: true } : item
    )),
  };
}
