// WO-25L：议价——智谋/魅力微调局势溢价幅度（纯函数）。
// 玩家会算计（智谋）兼有人缘（魅力），掌柜在局势溢价上让一步：
// 削减比例 = clamp(0.05 + (智谋-5)*1% + (魅力-5)*1%, 5%, 15%)。
// 只削溢价（mod>1 的部分向 1 收敛），已打折的不再加深——砍价砍的是冤价不是便宜。
// 七维硬数值反馈，契诃夫之枪：属性点出去就要看得见响。

export const SHAVE_MIN = 0.05;
export const SHAVE_MAX = 0.15;

// 智谋/魅力的削幅比例（不含兜底钳制外的任何随机），边界钳制 [5%, 15%]。
export function statShaveRatio({ wit = 5, charm = 5 } = {}) {
  const raw = SHAVE_MIN + (wit - 5) * 0.01 + (charm - 5) * 0.01;
  return Math.min(SHAVE_MAX, Math.max(SHAVE_MIN, raw));
}

// 把据点局势 priceMod 按玩家属性削一遍溢价幅度，返回新对象（不改原表）。
// priceMod 为 null/空时原样返回，调用方零分支。
export function statAdjustPriceMod(priceMod, stats) {
  if (!priceMod || typeof priceMod !== "object") return priceMod;
  const r = statShaveRatio(stats);
  const out = {};
  for (const [cat, mod] of Object.entries(priceMod)) {
    if (typeof mod === "number" && mod > 1) {
      out[cat] = Math.round((1 + (mod - 1) * (1 - r)) * 100) / 100;
    } else {
      out[cat] = mod;
    }
  }
  return out;
}
