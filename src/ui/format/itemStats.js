// 物品与招式数值的展示标签。只给界面用，从 domain/rules/economy/itemEffectText.js 搬来（路线图 U4-2）。

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
