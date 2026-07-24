// 切磋战斗系统 · 核心类型定义
// 三角克制：攻击克状态，状态克防御，防御克攻击
// 同类型对撞才比速度，异类型直接按下表判定，不看速度
//
// 架构原则（总纲v3第十二章）：品阶定下限，博弈定上限。
// - 品阶层：MOVE_POOL（npcGeneration.js）按品质档位提供固定招式，决定
//   角色的战力下限，跟角色的 levelCap 绑死
// - 博弈层：BURDEN_MOVE_POOL（npcGeneration.js）是完全独立的招式池，
//   不分品阶，任何角色都能装备，靠 permanentGrowthOnUse/allInDamage/
//   lowHpBonus/selfSacrifice 这类效果标志位实现"以小搏大"，在
//   resolveTurn.js 里统一结算，不受这里 MOVE_TYPE/BEATS 三角克制的
//   类型判定影响——博弈层招式依然要声明 type 参与克制判定，只是伤害/
//   能耗计算不再是简单的 baseDamageMultiplier 缩放。

export const MOVE_TYPE = {
  ATTACK: "攻击",
  DEFENSE: "防御",
  STATUS: "状态",
};

// BEATS[A] === B 表示 A 克 B
export const BEATS = {
  [MOVE_TYPE.ATTACK]: MOVE_TYPE.STATUS,
  [MOVE_TYPE.STATUS]: MOVE_TYPE.DEFENSE,
  [MOVE_TYPE.DEFENSE]: MOVE_TYPE.ATTACK,
};

// 判定两个技能类型对撞的结果
// 返回 'A' 表示A方这回合"赢"（触发应对效果），'B' 表示B方赢，'tie' 表示同类型需要比速度
export function judgeTypeMatchup(typeA, typeB) {
  if (typeA === typeB) return "tie";
  if (BEATS[typeA] === typeB) return "A";
  if (BEATS[typeB] === typeA) return "B";
  return "tie"; // 理论上不会走到这里，兜底避免未定义行为
}
