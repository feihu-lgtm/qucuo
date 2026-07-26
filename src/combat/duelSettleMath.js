export const POT_BY_TIER = [10, 20, 40, 70, 110, 160];

export const TIER_LABELS = ["白", "绿", "蓝", "紫", "橙", "红"];

export const TEAMWORK_GAIN = 3;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function duelPotGain(levelCap, outcome) {
  const cap = clamp(levelCap ?? 0, 0, 5);
  const base = POT_BY_TIER[cap];
  const potGain = outcome === "win" ? base : Math.ceil(base / 2);
  return { cap, base, potGain, tierLabel: TIER_LABELS[cap] + "袍" };
}

export function duelAffGain(outcome) {
  return outcome === "win" ? 4 : 3;
}

export function duelDropChance(luck) {
  return 0.5 * Math.pow(clamp(luck ?? 5, 0, 10) / 10, 1.7);
}
