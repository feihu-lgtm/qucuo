export const DUEL_MOVE_TYPES = ["攻击", "防御", "状态"];
export const DUEL_HP_BANDS = ["healthy", "hurt", "nearDown"];
export const DUEL_EFFECT_FAMILIES = [
  "hit", "blocked", "interrupted", "controlInterrupted", "reflected", "controlLanded",
  "reflectCounter", "controlPreempt", "statusApplied", "heal", "dot", "dodged", "nothing",
];

export { OPENING_POOLS } from "./openings/index.js";
export { CONNECTORS, CONNECTOR_FAMILIES, EFFECT_POOLS, MUTUAL_CONTACTS, STANDOFF_FRAGMENTS } from "./contacts/index.js";
export { REACTION_POOLS } from "./reactions/index.js";

export function hpBandFor(hp) {
  const [current, maximum] = Array.isArray(hp) ? hp : [];
  if (!(maximum > 0) || !Number.isFinite(current)) return "healthy";
  const ratio = current / maximum;
  return ratio < 0.25 ? "nearDown" : ratio < 0.6 ? "hurt" : "healthy";
}
