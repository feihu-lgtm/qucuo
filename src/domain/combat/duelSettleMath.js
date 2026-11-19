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
  // 切磋获胜后从对手随身物掉一件的概率。原 0.5*(luck/10)^1.7 凸指数太狠，
  // 默认气运5 仅约15%，体感"打赢也不掉东西"。改为 0.75*(luck/10)^1.2：
  // 默认气运5≈33%、气运7≈49%、气运10=75%，福缘越高越稳但仍看脸。
  return 0.75 * Math.pow(clamp(luck ?? 5, 0, 10) / 10, 1.2);
}
