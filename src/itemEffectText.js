// 装备/招式的效果说人话 · 唯一一份词典
// ============================================================================
// 【为什么抽出来】这份映射此前在 ForgeScreen 与 JadeShopScreen 各写了一遍，
// 而且两份都只覆盖了一部分标志位——**红档那批最强的特效恰恰不在词典里**
// （immuneControl / rebirthOnce / forceCrit / justiceStrike / selfSacrifice…），
// 于是玩家拿到红档神兵，界面上那一行是空的，看起来"只加了攻防"。
// 收成一份，谁要显示都从这儿取；漏了标志位就在这一处补。
//
// 【命名原则】用武侠白话说清"打起来会怎样"，不用系统术语。
// 玩家不需要知道 ignoreDefensePartialImmune 这个键叫什么，
// 他需要知道"对方无视防御的招对你只有一半效果"。

export const EFFECT_CN = {
  // ── 出手与命中 ──
  forceFirst: "必先手",
  forceCrit: "必重击",
  ignoreDefense: "无视防御",
  ignoreDefenseRatio: "破防",
  nullifyStatusOnHit: "打断状态招",
  doubleVsStatus: "克中招翻倍",
  // 这两个 moveArchetypes 里早就在结算了（蓄势档的「下一击加成」、趁虚档的
  // 「敌方能量低时暴增」），却一直不在词典里——连弩、西瓜刀、狼曲猎弩三件
  // 带着它们，界面上那一行却是空的，玩家根本不知道自己手里的弩有特效。
  nextAttackBonus: "蓄势·下击增伤",
  lowEnemyEnergyBonus: "趁敌力竭暴击",
  // ── 情境增伤 ──
  lowHpBonus: "残血增伤",
  highHpBonus: "满血增伤",
  afterStatusBonus: "趁中招追击",
  afterCounterBonus: "接反击追打",
  justiceStrike: "惩恶增伤",
  // beastFear（慑兽）已移除：战斗侧拿不到"对手是不是野兽"这个判据（野兽标记只在
  // NPC_SIGNATURE_MOVES.unlearnable 上，resolveTurn 看不见），全项目零实现。
  // 唯一带它的「虎啸」改挂 forceCrit——红档神兵该有的威慑，用跑得通的方式给。
  // ── 印记 ──
  applyMark: "附内伤印",
  detonateMark: "引爆内伤",
  // ── 控制与干扰 ──
  applyStatus: "附异状",
  enemyCostPenalty: "封穴耗气",
  freezeEnergyRecovery: "封气",
  // ── 防守与反击 ──
  onCounterSuccessDamageRatio: "应对反击",
  onCounterSuccessEnergyGain: "应对回气",
  doubleReflectDamage: "二倍反弹",
  // ── 抗性与保命 ──
  immuneControl: "免控",
  ignoreDefensePartialImmune: "抗破防",
  rebirthOnce: "濒死复起一次",
  // ── 自身 ──
  hpRestore: "回血",
  energyRestore: "起手回气",
  selfSacrifice: "舍身",
  allInDamage: "倾力一击",
  moveGrowth: "越战越强",
  moveCostReduction: "越用越省",
};

// 这些键是别的键的参数、不单独成词（否则会出现"附内伤印、附内伤印几率"）
const PARAM_KEYS = new Set(["applyMarkChance", "applyMarkOnHit", "statusChance", "confuseChance"]);

// 效果 + 七维 → 一行人话。没有就返回空串（调用方据此决定要不要渲染那一行）。
export function effectBrief(effect, sixDim) {
  const parts = [];
  for (const k of Object.keys(effect || {})) {
    if (PARAM_KEYS.has(k)) continue;
    if (EFFECT_CN[k]) parts.push(EFFECT_CN[k]);
  }
  for (const [k, v] of Object.entries(sixDim || {})) parts.push(`${k}+${v}`);
  return parts.join("、");
}

// 只要七维那部分（人物面板想单独标出"装备加了多少"时用）
export function sixDimBrief(sixDim) {
  return Object.entries(sixDim || {}).map(([k, v]) => `${k}+${v}`).join("、");
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

// 招式的特效说明（招式的标志位跟装备是同一套，复用同一份词典）
export function moveEffectBrief(move) {
  if (!move) return "";
  const picked = [];
  for (const k of Object.keys(move)) {
    if (PARAM_KEYS.has(k)) continue;
    if (EFFECT_CN[k] && move[k]) picked.push(EFFECT_CN[k]);
  }
  return picked.join("、");
}
