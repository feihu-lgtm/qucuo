// WO-10 词条点数表：resolveTurn.js 真实消费的战斗特效与 sixDim 加成按点标价，
// 导出 allowedAffixesForBudget(category, pointBudget) 供判官签发空白天机券时
// 圈定词条白名单。点数口径（手册示例锁死前三条）：
//   sixDim 每 +1 计 1 点；hpRestore:0.08 计 1 点；forceFirst 计 2 点；ignoreDefense 计 3 点。
// 词条键格式：布尔/数值特效用特效名（"forceFirst"），分档特效带冒号档（"hpRestore:0.16"），
// 六维用 "sixDim:<七维键>+<n>"（每点加成 1 点），服用品用 "consumable:<品类>"。

// 七维键（char.special 的真实字段名）
export const SIX_DIM_KEYS = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];

// 具名特效 → { cost, effect }。effect 值即 mergeItemEffects/resolveTurn 消费的原始形状。
const NAMED_AFFIXES = {
  // ── 1 点档 ──
  "hpRestore": { cost: 1, effect: { hpRestore: 0.08 } },
  "dispelSelf": { cost: 1, effect: { dispelSelf: true } },
  "nextAttackBonus": { cost: 1, effect: { nextAttackBonus: 0.3 } },
  "energyRestore": { cost: 1, effect: { energyRestore: 2 } },
  "enemyCostPenalty": { cost: 1, effect: { enemyCostPenalty: { value: 1, turns: 2 } } },
  "onCounterSuccessEnergyGain": { cost: 1, effect: { onCounterSuccessEnergyGain: 2 } },
  "onCounterSuccessDamageRatio": { cost: 1, effect: { onCounterSuccessDamageRatio: 0.2 } },
  "applyStatus:淬毒": { cost: 1, effect: { applyStatus: { name: "淬毒", chance: 0.5 } } },
  "confuseChance": { cost: 1, effect: { confuseChance: 0.2 } },
  // ── 2 点档 ──
  "forceFirst": { cost: 2, effect: { forceFirst: true } },
  "hpRestore:0.16": { cost: 2, effect: { hpRestore: 0.16 } },
  "doubleVsStatus": { cost: 2, effect: { doubleVsStatus: true } },
  "immuneControl": { cost: 2, effect: { immuneControl: true } },
  "freezeEnergyRecovery": { cost: 2, effect: { freezeEnergyRecovery: true } },
  "afterStatusBonus": { cost: 2, effect: { afterStatusBonus: 0.4 } },
  "lowEnemyEnergyBonus": { cost: 2, effect: { lowEnemyEnergyBonus: { threshold: 2, multiplier: 2 } } },
  "applyStatus:裂伤": { cost: 2, effect: { applyStatus: { name: "裂伤", chance: 0.6 } } },
  "confuseChance:0.45": { cost: 2, effect: { confuseChance: 0.45 } },
  // ── 3 点档 ──
  "ignoreDefense": { cost: 3, effect: { ignoreDefense: true } },
  "hpRestore:0.24": { cost: 3, effect: { hpRestore: 0.24 } },
  "applyMark:内伤": { cost: 3, effect: { applyMark: { name: "内伤", stacks: 1, max: 5 } } },
  "detonateMark": { cost: 3, effect: { detonateMark: { perStackRatio: 0.4 } } },
  "applyStatus:剧毒": { cost: 3, effect: { applyStatus: { name: "剧毒", chance: 0.6 } } },
  "afterStatusBonus:0.8": { cost: 3, effect: { afterStatusBonus: 0.8 } },
};

// 服用品词条（丹药酒食）：挂 consumable 而非 effect
const CONSUMABLE_AFFIXES = {
  "consumable:heal": { cost: 1, consumable: { hpRestore: 0.2, kind: "heal" } },
  "consumable:antidote": { cost: 1, consumable: { cureStatus: true, kind: "antidote" } },
  "consumable:energy": { cost: 1, consumable: { energyRestore: 4, kind: "energy" } },
  "consumable:combatBuff": { cost: 2, consumable: { combatBuff: true, kind: "combatBuff" } },
};

// 攻击面特效：武器与饰品可挂，护甲不挂（护甲重心在防御/续航，与 catalog 注释一致）
const ATTACK_SIDE = new Set([
  "forceFirst", "ignoreDefense", "doubleVsStatus", "afterStatusBonus", "afterStatusBonus:0.8",
  "lowEnemyEnergyBonus", "detonateMark", "applyMark:内伤", "applyStatus:淬毒", "applyStatus:裂伤",
  "applyStatus:剧毒", "confuseChance", "confuseChance:0.45", "nextAttackBonus", "enemyCostPenalty",
  "freezeEnergyRecovery",
]);
// 防御/续航面特效：护甲与饰品可挂，武器不挂
const DEFENSE_SIDE = new Set([
  "hpRestore", "hpRestore:0.16", "hpRestore:0.24", "dispelSelf", "immuneControl",
  "onCounterSuccessEnergyGain", "onCounterSuccessDamageRatio", "energyRestore",
]);

const SIXDIM_RE = /^sixDim:([^+]+)\+(\d)$/;

// 解析一条词条键的花费；不认识的词条返回 null（判官不该签发、编译器不该挂载）
export function affixCost(key) {
  if (NAMED_AFFIXES[key]) return NAMED_AFFIXES[key].cost;
  if (CONSUMABLE_AFFIXES[key]) return CONSUMABLE_AFFIXES[key].cost;
  const m = typeof key === "string" ? key.match(SIXDIM_RE) : null;
  if (m && SIX_DIM_KEYS.includes(m[1])) return Number(m[2]); // sixDim 每 +1 计 1 点
  return null;
}

// 编译一条词条键为 { effect?, sixDim?, consumable? }；非法键返回 null
export function compileAffix(key) {
  if (NAMED_AFFIXES[key]) {
    return { effect: { ...NAMED_AFFIXES[key].effect } };
  }
  if (CONSUMABLE_AFFIXES[key]) {
    return { consumable: { ...CONSUMABLE_AFFIXES[key].consumable } };
  }
  const m = typeof key === "string" ? key.match(SIXDIM_RE) : null;
  if (m && SIX_DIM_KEYS.includes(m[1])) {
    return { sixDim: { [m[1]]: Number(m[2]) } };
  }
  return null;
}

// 按分类与点数预算圈定词条白名单：
// - weapon：攻击面 + 六维；armor：防御面 + 六维；accessory：两面皆可 + 六维；
// - misc：consumable + 六维（丹药酒食/杂物不挂战斗特效）
// 六维按预算展开：pointBudget≥n 时七维每维各出一条 +n（n 取 1/2/3 档）
export function allowedAffixesForBudget(category, pointBudget) {
  const budget = Math.max(0, Math.floor(Number(pointBudget) || 0));
  if (budget <= 0) return [];
  const out = [];
  const cat = category || "misc";
  const isConsumableCat = cat === "misc";

  for (const [key, def] of Object.entries(NAMED_AFFIXES)) {
    if (def.cost > budget) continue;
    if (isConsumableCat) continue;
    if (cat === "weapon" && !ATTACK_SIDE.has(key)) continue;
    if (cat === "armor" && !DEFENSE_SIDE.has(key)) continue;
    out.push(key);
  }
  if (isConsumableCat) {
    for (const [key, def] of Object.entries(CONSUMABLE_AFFIXES)) {
      if (def.cost <= budget) out.push(key);
    }
  }
  for (let n = 1; n <= Math.min(3, budget); n++) {
    for (const dim of SIX_DIM_KEYS) out.push(`sixDim:${dim}+${n}`);
  }
  return out;
}
