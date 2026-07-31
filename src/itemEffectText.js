// 装备/招式的效果说人话 · 全项目唯一一份词典
// ============================================================================
// 【为什么只能有一份】这套东西在项目里前后长出过三份：
//   · ForgeScreen 与 JadeShopScreen 各写了一遍（红档那批最强特效恰恰都没覆盖到，
//     于是玩家拿到红档神兵，界面上那一行是空的，看起来"只加了攻防"）；
//   · 后来收成 itemEffectText 一份「标志位→短词」的字典（破防/免控/必先手…）；
//   · 同时 quickBattle/moveExplainer.js 又另起一份**带具体数字**的详细规则
//     （30+ 条，"造成 130% 基础伤害"这种），只服务快速切磋一个界面。
// 结果同一个 forceFirst，切磋里写着「必定抢先出手（无视双方身法速度比较）」，
// 右栏却只有俩字「必先手」，而这俩字还得在另一个文件里单独维护——加个新特效
// 要记得改两处，漏一处就是界面空白（已经这么栽过好几次）。
//
// 现在合成**一张表 MOVE_RULES**，按信息量最多的那份（moveExplainer）来写，
// 每条规则同时给两种粒度：
//   label —— 短词，列表/标签位用（「破防」）
//   text  —— 整句带数字，详情/切磋用（「无视对方防御招的减伤，势大力沉直接砸穿」）
// 三种武学来源（武馆 SKILL_CATALOG／制式 MOVE_POOL／特殊 NPC_SIGNATURE_MOVES+原型）
// 派生出来的招式最终都是同一种 move 对象，所以走同一张表，不再分家。
//
// 【命名原则】用武侠白话说清"打起来会怎样"，不用系统术语。玩家不需要知道
// ignoreDefensePartialImmune 这个键叫什么，他需要知道"对方无视防御的招对你只有一半效果"。

import { MOVE_TYPE } from "./combat/moveTypes.js";

const pct = (v) => `${Math.round(v * 100)}%`;

// 这些键是别的键的参数、不单独成词（否则会出现"附内伤印、附内伤印几率"）
export const PARAM_KEYS = new Set(["applyMarkChance", "applyMarkOnHit", "statusChance", "confuseChance"]);

// ── 唯一的规则表 ──────────────────────────────────────────────────────────
// key    对应的字段名（用于 EFFECT_CN 反查与"这个标志位有没有词条"的守卫）
// when   命中条件
// label  短词
// text   整句（缺省时退回 label）
// warn   代价类，UI 标红
export const MOVE_RULES = [
  // ── 主效果：伤害 / 减伤 / 回气 / 回血 ──
  { key: "baseDamageMultiplier", when: (m) => m.type === MOVE_TYPE.ATTACK && m.baseDamageMultiplier != null && !m.allInDamage,
    label: "伤害倍率", text: (m) => `造成 ${pct(m.baseDamageMultiplier)} 基础伤害（基础伤害＝攻击力×招式倍率×体魄系数）` },
  { key: "defenseMultiplier", when: (m) => m.type === MOVE_TYPE.DEFENSE && m.baseDamageMultiplier != null,
    label: "减伤", text: (m) => `防御生效时，来招伤害压到 ${pct(m.baseDamageMultiplier)}（越低防得越狠），再叠内功/护甲的固定减伤` },
  { key: "energyRestore", when: (m) => m.energyRestore > 0,
    label: "回气", text: (m) => `回复 ${m.energyRestore} 点气力（这一手不出攻防，等于让出一整回合调息）` },
  { key: "hpRestore", when: (m) => m.hpRestore > 0,
    label: "回血", text: (m) => `运功自疗，回复自身 ${pct(m.hpRestore)} 最大气血（回血同回合仍可能挨打，看净值）` },

  // ── 出手与命中 ──
  { key: "forceFirst", when: (m) => m.forceFirst, label: "必先手", text: () => "必定抢先出手（无视双方身法速度比较）" },
  { key: "forceCrit", when: (m) => m.forceCrit, label: "必重击",
    text: (m) => `必定重击${m.forceCrit?.multiplier ? `（伤害×${m.forceCrit.multiplier}）` : ""}` },
  { key: "ignoreDefense", when: (m) => m.ignoreDefense, label: "无视防御", text: () => "无视对方防御招的减伤，势大力沉直接砸穿" },
  { key: "ignoreDefenseRatio", when: (m) => m.ignoreDefenseRatio, label: "破防",
    text: (m) => `专挑劲力薄处扎，${pct(m.ignoreDefenseRatio)} 的伤害绕过对方防御结算` },
  { key: "nullifyStatusOnHit", when: (m) => m.nullifyStatusOnHit, label: "打断状态招", text: () => "打断对方状态招时，令其效果完全落空" },
  { key: "doubleVsStatus", when: (m) => m.doubleVsStatus, label: "克中招翻倍", text: () => "若这一招正克到对方的状态招，伤害翻倍" },

  // ── 情境增伤 ──
  { key: "lowHpBonus", when: (m) => m.lowHpBonus, label: "残血增伤", text: (m) => `残血反扑：自身生命每损失10%，威力 +${pct(m.lowHpBonus)}` },
  { key: "highHpBonus", when: (m) => m.highHpBonus, label: "满血增伤", text: (m) => `自身满血/高血（≥80%）时，额外 +${pct(m.highHpBonus)} 威力` },
  { key: "afterStatusBonus", when: (m) => m.afterStatusBonus, label: "趁中招追击", text: (m) => `上一回合成功施加过状态/印记，这一击额外 +${pct(m.afterStatusBonus)} 威力` },
  { key: "afterCounterBonus", when: (m) => m.afterCounterBonus, label: "接反击追打", text: (m) => `上一回合应对成功过，这一击额外 +${pct(m.afterCounterBonus)} 威力（乘胜追击）` },
  { key: "nextAttackBonus", when: (m) => m.nextAttackBonus, label: "蓄势·下击增伤", text: (m) => `蓄势：下一回合的攻击招 +${pct(m.nextAttackBonus)} 威力` },
  { key: "lowEnemyEnergyBonus", when: (m) => m.lowEnemyEnergyBonus, label: "趁敌力竭暴击",
    text: (m) => `趁对方气力≤${m.lowEnemyEnergyBonus.threshold ?? 2}时下重手，伤害×${m.lowEnemyEnergyBonus.multiplier ?? 2}` },
  { key: "justiceStrike", when: (m) => m.justiceStrike, label: "惩恶增伤", text: () => "对恶行在身者出手，威力更沉" },

  // ── 印记 ──
  { key: "applyMark", when: (m) => m.applyMark, label: "附内伤印",
    text: (m) => `叠一道「${m.applyMark.name ?? "内伤"}」印记（可叠至${m.applyMark.max ?? 5}层，平时不掉血，被攻击招引爆时按层数迸发暗伤）${m.applyMarkChance != null && m.applyMarkChance < 1 ? `，${pct(m.applyMarkChance)}几率叠上` : ""}` },
  { key: "detonateMark", when: (m) => m.detonateMark, label: "引爆内伤", text: (m) => `引爆对方体内积压的印记，每层追加约 ${pct(m.detonateMark.perStackRatio ?? 0.4)} 攻击力的暗伤` },

  // ── 控制与干扰 ──
  { key: "applyStatus", when: (m) => m.applyStatus, label: "附异状", text: (m) => `命中施加「${m.applyStatus}」状态` },
  { key: "confuseChance", when: (m) => m.confuseChance, label: "致乱", text: (m) => `${pct(m.confuseChance)} 几率令对方本回合招式类型判定错乱` },
  { key: "energyDiffDamage", when: (m) => m.energyDiffDamage, label: "打能量差", text: () => "按双方当前气力差值造成额外伤害（对方越虚越疼）" },
  { key: "enemyCostPenalty", when: (m) => m.enemyCostPenalty, label: "封穴耗气", text: (m) => `扰乱对方气机，其后 ${m.enemyCostPenalty.turns ?? 1} 回合出招多耗 ${m.enemyCostPenalty.value ?? 1} 气力` },
  { key: "freezeEnergyRecovery", when: (m) => m.freezeEnergyRecovery, label: "封气", text: () => "冻住对方下一回合的回气（无法调息）" },

  // ── 防守与反击（听桥家族）──
  { key: "onCounterSuccessDamageRatio", when: (m) => m.onCounterSuccessDamageRatio, label: "应对反击", text: (m) => `架住攻击招时反手一记，反打对方来招伤害的 ${pct(m.onCounterSuccessDamageRatio)}` },
  { key: "onCounterSuccessPreemptive", when: (m) => m.onCounterSuccessPreemptive, label: "抢先反杀", text: () => "这记反击抢在对方伤害结算前打出，可能直接反杀" },
  { key: "onCounterSuccessEnergyGain", when: (m) => m.onCounterSuccessEnergyGain, label: "应对回气", text: (m) => `应对成功额外回 ${m.onCounterSuccessEnergyGain} 点气力` },
  { key: "doubleReflectDamage", when: (m) => m.doubleReflectDamage, label: "二倍反弹", text: () => "把对方原本想用来防的那部分力道，二倍弹回去" },

  // ── 抗性与保命 ──
  { key: "immuneControl", when: (m) => m.immuneControl, label: "免控", text: () => "不受控制类状态影响" },
  { key: "ignoreDefensePartialImmune", when: (m) => m.ignoreDefensePartialImmune, label: "抗破防", text: (m) => `对方"无视防御"的招，对你只剩 ${pct(1 - m.ignoreDefensePartialImmune)} 效果` },
  { key: "rebirthOnce", when: (m) => m.rebirthOnce, label: "濒死复起一次", text: () => "本场濒死时复起一次" },
  { key: "dispelSelf", when: (m) => m.dispelSelf, label: "运功自解", text: () => "运功自解，驱散自身的控制/掉血状态（印记除外）" },

  // ── 自身 / 博弈层 ──
  { key: "allInDamage", when: (m) => m.allInDamage, label: "倾力一击", text: () => "孤注一掷：清空当前全部气力，气力耗得越多这一击越狠" },
  { key: "selfSacrifice", when: (m) => m.selfSacrifice, label: "舍身", text: (m) => `拼命：燃烧自身 ${pct(m.selfSacrifice.hpCost)} 当前气血，换伤害×${m.selfSacrifice.damageMultiplier}` },
  { key: "moveGrowth", when: (m) => m.moveGrowth || m.permanentGrowthOnUse, label: "越战越强",
    text: (m) => `越打越顺：每用一次，本场内基础倍率永久 +${pct(m.permanentGrowthOnUse ?? m.moveGrowth)}` },
  { key: "moveCostReduction", when: (m) => m.moveCostReduction, label: "越用越省", text: () => "同一招用得越多，耗气越少" },
  { key: "beastFear", when: (m) => m.beastFear, label: "慑兽", text: () => "对野兽有威慑" },

  // ── 代价（放最后，UI 标红）──
  { key: "onCounterFailEnergyPenalty", when: (m) => m.onCounterFailEnergyPenalty, label: "赌输倒扣气力",
    text: (m) => `赌输代价：这一守没架住攻击招时，倒扣 ${m.onCounterFailEnergyPenalty} 点气力`, warn: true },
  { key: "onCounterFailDefenseNullified", when: (m) => m.onCounterFailDefenseNullified, label: "赌输防御失效",
    text: () => "赌输代价：守势被看穿时，下一回合防御完全失效", warn: true },
];

// 反查表：字段名 → 短词。全项目"这个标志位有没有词条"的守卫都查它。
// 由 MOVE_RULES 派生，不再手写第二份——加规则即自动有词条。
export const EFFECT_CN = Object.fromEntries(MOVE_RULES.map(r => [r.key, r.label]));

// ── 三个出口，同一张表 ────────────────────────────────────────────────────

// ① 详情：结构化说明数组 [{text, warn}]，带具体数字。快速切磋/详情页用。
// 绝不抛错——字段缺失或规则读值出错时跳过该条。
export function explainMove(move) {
  if (!move) return [];
  const out = [];
  for (const r of MOVE_RULES) {
    try { if (r.when(move)) out.push({ text: r.text ? r.text(move) : r.label, warn: !!r.warn }); } catch { /* 跳过 */ }
  }
  return out;
}

// ② 短词串：招式版。列表/右栏那一行用。
export function moveEffectBrief(move) {
  if (!move) return "";
  const picked = [];
  for (const r of MOVE_RULES) {
    if (r.key === "baseDamageMultiplier" || r.key === "defenseMultiplier") continue; // 倍率由 moveStatLabel 单独显示
    try { if (r.when(move)) picked.push(r.label); } catch { /* 跳过 */ }
  }
  return picked.join("、");
}

// ③ 短词串：装备版（effect 标志位 + 六维加成拼在一起）。
export function effectBrief(effect, sixDim) {
  const parts = [];
  for (const r of MOVE_RULES) {
    if (PARAM_KEYS.has(r.key)) continue;
    if (r.key === "baseDamageMultiplier" || r.key === "defenseMultiplier") continue;
    try { if (effect && r.when(effect)) parts.push(r.label); } catch { /* 跳过 */ }
  }
  for (const [k, v] of Object.entries(sixDim || {})) parts.push(`${k}+${v}`);
  return parts.join("、");
}

// ④ 被动加成（内功/轻功的 passiveBonus）。图鉴原来自己拼了一遍，收编到这里，
// 免得以后 passiveBonus 加字段又是漏一处就少显示一样。
export function passiveBonusBrief(pb) {
  if (!pb) return "";
  const bits = [];
  if (pb.maxHp) bits.push(`气血上限+${pb.maxHp}`);
  if (pb.speedBonus) bits.push(`身法+${pb.speedBonus}`);
  return bits.join("、");
}

// 只要六维那部分（人物面板想单独标出"装备加了多少"时用）
export function sixDimBrief(sixDim) {
  return Object.entries(sixDim || {}).map(([k, v]) => `${k}+${v}`).join("、");
}

// 类型定性一句话（技能卡正面/背面顶部用）
const TYPE_GIST = {
  [MOVE_TYPE.ATTACK]: "攻击招：克状态招，被防御招克",
  [MOVE_TYPE.DEFENSE]: "防御招：克攻击招，被状态招克",
  [MOVE_TYPE.STATUS]: "状态招：克防御招，被攻击招克",
};
export function moveTypeGist(move) { return TYPE_GIST[move?.type] || ""; }

// 一句话浓缩（列表里空间小时用，取主效果那条）
export function moveOneLiner(move) {
  const lines = explainMove(move);
  return lines.length ? lines[0].text : (moveTypeGist(move) || "");
}

// 装备的数值标签：武器给攻、护甲给防。
//
// 【饰品那个裸小数不再显示】饰品的 bonus 字段（白0.3→红6，界面上显示成「+3.3」
// 这种没头没尾的小数）**在战斗里不接任何东西**：computeEquippedStats 把它汇总成
// accessoryBonus，而全项目只有右栏那行「装备总加成」把它打印出来，伤害公式、
// 防御公式、七维，没有一处读它。equipment.js 自己的注释也承认「具体挂靠哪个属性
// 由 desc/特殊状态文字体现」——也就是说它从设计上就只是风味，不是数值。
// 于是玩家看到一个 +3.3 却查不出它加了什么，问了也没人答得上来。
// 饰品真正生效的是 sixDim 与 effect，那两样 effectBrief 已经在显示了。
// 这里不再打印这个数，省得它假装自己是个战力数值。
export function statLabel(item) {
  if (!item || typeof item !== "object") return "";
  if (item.atk != null) return `攻${item.atk}`;
  if (item.def != null) return `防${item.def}`;
  return "";
}

// 招式的数值标签：伤害倍率 + 耗能。
// 【为什么显示倍率而不是绝对伤害】绝对伤害要乘外功/装备/对手根骨才算得出，
// 面板上给个"×1.3"比给一个会随时变的数字更诚实。
export function moveStatLabel(move) {
  if (!move) return "";
  const bits = [];
  const mul = move.baseDamageMultiplier;
  if (typeof mul === "number" && mul > 0) bits.push(`×${mul.toFixed(2).replace(/\.?0+$/, "")}`);
  if (move.hpRestore) bits.push(`回血${Math.round(move.hpRestore * 100)}%`);
  if (move.energyRestore) bits.push(`回气${move.energyRestore}`);
  const cost = move.energyCost ?? 0;
  bits.push(cost > 0 ? `耗${cost}` : "不耗气");
  return bits.join(" ");
}
