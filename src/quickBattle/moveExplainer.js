// 招式字段理解器（move field explainer）
// 把 MOVE_POOL / moveArchetypes 里那些机器字段（baseDamageMultiplier、
// onCounterSuccessDamageRatio 之类）翻译成人话，供技能卡翻面时展示。
// 这是"所见即所得"的一环：玩家看到的招式说明，跟 resolveTurn 真正结算用的
// 字段是同一份数据翻译出来的，不是另写一段可能对不上的文案。
//
// 设计原则：只翻译"这一招会做什么"，不编造数值以外的效果。每条翻译尽量含
// 具体数字（倍率、消耗、比例），让玩家能据此判断强弱，而不是空泛形容词。

import { MOVE_TYPE } from "../combat/moveTypes.js";

// 类型一句话定性（配合三角克制表理解）
const TYPE_GIST = {
  [MOVE_TYPE.ATTACK]: "攻击招 · 硬碰硬，能打断对方正在起手的状态招",
  [MOVE_TYPE.DEFENSE]: "防御招 · 扎稳架住，能大幅卸掉对方的攻击招",
  [MOVE_TYPE.STATUS]: "状态招 · 迂回下手，能绕过对方的防御招得手",
};

// 把一个百分比倍率讲成人话："1.3 → 130%基础伤害"、"0.4 → 减伤至40%"
const pct = (v) => `${Math.round(v * 100)}%`;

// 逐字段翻译规则。每条 { when(move)->bool, text(move)->string }。
// 命中就吐一条说明。顺序即展示顺序：先讲主效果，再讲附带/条件效果，最后讲代价。
const RULES = [
  // ── 主效果：伤害 / 减伤 / 回气 / 回血 ──
  {
    when: (m) => m.type === MOVE_TYPE.ATTACK && m.baseDamageMultiplier != null && !m.allInDamage,
    text: (m) => `造成 ${pct(m.baseDamageMultiplier)} 基础伤害（基础伤害＝攻击力×招式倍率×体魄系数）`,
  },
  {
    when: (m) => m.type === MOVE_TYPE.DEFENSE && m.baseDamageMultiplier != null,
    text: (m) => `防御生效时，来招伤害压到 ${pct(m.baseDamageMultiplier)}（越低防得越狠），再叠内功/护甲的固定减伤`,
  },
  {
    when: (m) => m.energyRestore > 0,
    text: (m) => `回复 ${m.energyRestore} 点气力（这一手不出攻防，等于让出一整回合调息）`,
  },
  {
    when: (m) => m.hpRestore > 0,
    text: (m) => `运功自疗，回复自身 ${pct(m.hpRestore)} 最大气血（回血同回合仍可能挨打，看净值）`,
  },

  // ── 攻击类的克制/穿透/连携加成 ──
  { when: (m) => m.doubleVsStatus, text: () => "若这一招正克到对方的状态招，伤害翻倍" },
  { when: (m) => m.ignoreDefense, text: () => "无视对方防御招的减伤，势大力沉直接砸穿" },
  { when: (m) => m.forceFirst, text: () => "必定抢先出手（无视双方身法速度比较）" },
  { when: (m) => m.nullifyStatusOnHit, text: () => "打断对方状态招时，令其效果完全落空" },
  { when: (m) => m.afterCounterBonus, text: (m) => `上一回合应对成功过，这一击额外 +${pct(m.afterCounterBonus)} 威力（乘胜追击）` },
  { when: (m) => m.afterStatusBonus, text: (m) => `上一回合成功施加过状态/印记，这一击额外 +${pct(m.afterStatusBonus)} 威力` },
  { when: (m) => m.nextAttackBonus, text: (m) => `蓄势：下一回合的攻击招 +${pct(m.nextAttackBonus)} 威力` },
  { when: (m) => m.lowEnemyEnergyBonus, text: (m) => `趁对方气力≤${m.lowEnemyEnergyBonus.threshold ?? 2}时下重手，伤害×${m.lowEnemyEnergyBonus.multiplier ?? 2}` },
  { when: (m) => m.highHpBonus, text: (m) => `自身满血/高血（≥80%）时，额外 +${pct(m.highHpBonus)} 威力` },

  // ── 防御类的反击/回气 ──
  { when: (m) => m.onCounterSuccessDamageRatio, text: (m) => `架住攻击招时反手一记，反打对方来招伤害的 ${pct(m.onCounterSuccessDamageRatio)}` },
  { when: (m) => m.onCounterSuccessPreemptive, text: () => "这记反击抢在对方伤害结算前打出，可能直接反杀" },
  { when: (m) => m.onCounterSuccessEnergyGain, text: (m) => `应对成功额外回 ${m.onCounterSuccessEnergyGain} 点气力` },

  // ── 状态类的施加/印记/引爆/驱散 ──
  { when: (m) => m.applyStatus, text: (m) => `命中施加「${m.applyStatus}」状态` },
  { when: (m) => m.confuseChance, text: (m) => `${pct(m.confuseChance)} 几率令对方本回合招式类型判定错乱` },
  { when: (m) => m.applyMark, text: (m) => `叠一道「${m.applyMark.name ?? "内伤"}」印记（可叠至${m.applyMark.max ?? 5}层，平时不掉血，被攻击招引爆时按层数迸发暗伤）${m.applyMarkChance != null && m.applyMarkChance < 1 ? `，${pct(m.applyMarkChance)}几率叠上` : ""}` },
  { when: (m) => m.detonateMark, text: (m) => `引爆对方体内积压的印记，每层追加约 ${pct(m.detonateMark.perStackRatio ?? 0.4)} 攻击力的暗伤` },
  { when: (m) => m.energyDiffDamage, text: () => "按双方当前气力差值造成额外伤害（对方越虚越疼）" },
  { when: (m) => m.doubleReflectDamage, text: () => "把对方原本想用来防的那部分力道，二倍弹回去" },
  { when: (m) => m.freezeEnergyRecovery, text: () => "冻住对方下一回合的回气（无法调息）" },
  { when: (m) => m.enemyCostPenalty, text: (m) => `扰乱对方气机，其后 ${m.enemyCostPenalty.turns ?? 1} 回合出招多耗 ${m.enemyCostPenalty.value ?? 1} 气力` },
  { when: (m) => m.dispelSelf, text: () => "运功自解，驱散自身的控制/掉血状态（印记除外）" },

  // ── 博弈层：高风险高回报 ──
  { when: (m) => m.allInDamage, text: () => "孤注一掷：清空当前全部气力，气力耗得越多这一击越狠" },
  { when: (m) => m.lowHpBonus, text: (m) => `残血反扑：自身生命每损失10%，威力 +${pct(m.lowHpBonus)}` },
  { when: (m) => m.selfSacrifice, text: (m) => `拼命：燃烧自身 ${pct(m.selfSacrifice.hpCost)} 当前气血，换伤害×${m.selfSacrifice.damageMultiplier}` },
  { when: (m) => m.permanentGrowthOnUse, text: (m) => `越打越顺：每用一次，本场内基础倍率永久 +${pct(m.permanentGrowthOnUse)}` },

  // ── 代价（应对失败惩罚等，放最后，红字提示风险）──
  { when: (m) => m.onCounterFailEnergyPenalty, text: (m) => `赌输代价：这一守没架住攻击招时，倒扣 ${m.onCounterFailEnergyPenalty} 点气力`, warn: true },
  { when: (m) => m.onCounterFailDefenseNullified, text: () => "赌输代价：守势被看穿时，下一回合防御完全失效", warn: true },
];

// 主入口：给一个 move 对象，返回结构化的说明数组 [{text, warn}]。
// UI 负责渲染（warn 的条目标红）。绝不抛错——字段缺失/未知时跳过该规则。
export function explainMove(move) {
  if (!move) return [];
  const out = [];
  for (const rule of RULES) {
    try {
      if (rule.when(move)) out.push({ text: rule.text(move), warn: !!rule.warn });
    } catch {
      // 某条规则读字段出错就跳过，不影响其它条目
    }
  }
  return out;
}

// 类型定性一句话（技能卡正面/背面顶部用）
export function moveTypeGist(move) {
  return TYPE_GIST[move?.type] || "";
}

// 一句话浓缩（列表里空间小时用，取主效果那条）
export function moveOneLiner(move) {
  const lines = explainMove(move);
  return lines.length ? lines[0].text : (moveTypeGist(move) || "");
}
