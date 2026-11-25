// ── WO-23C5 宿敌旧伤战斗生效（纯函数，无 AI）──────────────────────────────
// roadmap「敌败未死按玩家末招属性挂持久伤痕与对应弱点」的生效半环：
//   同属性弱点——攻击招式被 scarAttrOfMove 辨成某类，且防守方宿敌谱 active entry
//   的 scars 含同 kind，则该次伤害 ×1.1（固定常量，docs 写明）；不同属性无效果；
//   不实现抗性（避免拍脑袋双系统）。多只同类疤不叠加（命中即一倍率，与疤数无关）。
//   fakeDead/settled/recruited（非 active）不生效；无谱/非五势力（不在谱）/
//   不可辨认招式零效果。宿敌谱全程只读。

import { scarAttrOfMove } from "./nemesisEngine.js";

export const SCAR_VULN_MULTIPLIER = 1.1;
const VALID_KINDS = new Set(["利刃", "钝击", "火毒", "寒冰", "点穴"]);

// 查谱取 active entry 的旧伤属性清单（去重）。严格按 faction+name 双键——
// 不按名字跨势力乱猜；坏形状/无谱/非 active 一律空数组。
export function scarKindsOfNemesis(roster, faction, npcName) {
  if (!faction || !npcName || !roster || typeof roster !== "object") return [];
  const entries = roster?.[faction]?.entries;
  if (!entries || typeof entries !== "object") return [];
  const entry = Object.values(entries).find(
    (e) => e && typeof e === "object" && e.name === npcName && e.status === "active",
  );
  if (!entry || !Array.isArray(entry.scars)) return [];
  const kinds = new Set();
  for (const s of entry.scars) {
    if (s && typeof s === "object" && VALID_KINDS.has(s.kind)) kinds.add(s.kind);
  }
  return [...kinds];
}

// 招式是否命中某类旧伤：招式可被辨认且该 kind 在 scarKinds 里。
export function moveScarKindHit(move, scarKinds) {
  if (!Array.isArray(scarKinds) || !scarKinds.length) return false;
  const attr = scarAttrOfMove(move);
  return !!attr && scarKinds.includes(attr);
}

// 一站式：roster+faction+npcName+move → 伤害倍率（1 或 SCAR_VULN_MULTIPLIER）。
export function scarVulnerabilityMultiplier({ roster, faction, npcName, move } = {}) {
  return moveScarKindHit(move, scarKindsOfNemesis(roster, faction, npcName)) ? SCAR_VULN_MULTIPLIER : 1;
}
