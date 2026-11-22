// 入册审改 NPC 各区块共享的常量与小工具（从 ReviewNpc.jsx 拆出）。
// 物品描述的输出上限。跟 PLAN_MAX_TOKENS 同一个理由：原来写死 400，在带思考的
// 模型上会被思考 token 吃穿。这一处的症状比落脚规划更隐蔽——它要的是纯文本，
// 截断不会报错，只是玩家看到的描述莫名缺半截，还以为是模型没写好。
export const ITEM_DESC_MAX_TOKENS = 2000;

export const PLACEMENT_LABEL = { mention: "不落地", resident: "驻场", wander: "游走" };
export const PLACEMENT_HINT = {
  mention: "他的人设只在被提到时注入，不会主动出现在任何据点。适合远方的人、传闻里的人。",
  resident: "进了这个据点必定遇见他，不受时辰与运气影响。跟村长、掌柜这类人同一个待遇。",
  wander: "按权重每天随机出现在选中的据点，且只在设定的时辰里露面。跟行商、镖师同一个待遇。",
};

// 招式效果标志位 → 人话。这些键来自 combat/moveArchetypes.js 的 tiers，
// 直接把英文键甩给玩家看等于没显示，所以逐个给个说法。
export const EFFECT_LABEL = {
  energyCost: "内力消耗",
  baseDamageMultiplier: "威力倍率",
  onCounterSuccessDamageRatio: "反打比例",
  onCounterSuccessEnergyGain: "反制回气",
  onCounterSuccessPreemptive: "反制抢先结算",
  onCounterFailEnergyPenalty: "失手扣气",
  onCounterFailDefenseNullified: "失手防御失效",
  counterStacksGrowth: "连挡叠势",
  dispelSelf: "运功自解",
  doubleVsStatus: "克中状态翻倍",
  ignoreDefense: "无视防御",
  afterStatusBonus: "趁中招追击",
  detonateMark: "引爆内伤",
  forceFirst: "强制先手",
  nullifyStatusOnHit: "命中清状态",
  energyRestore: "回气量",
  nextAttackBonus: "下击加成",
  confuseChance: "迷惑概率",
  energyDiffDamage: "气差伤害",
  freezeEnergyRecovery: "冻结对手回气",
  doubleReflectDamage: "双倍反伤",
  hpRestore: "回血比例",
  sealEnergyRecovery: "封住回气",
  type: "招式类型",
};

export function fmtEffectValue(v) {
  if (v === true) return "有";
  if (v === false) return "无";
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    return Object.entries(v).map(([k, x]) => `${EFFECT_LABEL[k] || k} ${x}`).join("、");
  }
  return String(v);
}

