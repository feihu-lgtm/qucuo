// WO-09 因果授信器：纯函数节拍器，按紧张度/涉险/代价/交情/气运/支线高潮
// 核定本拍因果额度。确定性输出，禁 Date.now/Math.random。
// tier 语义：T0 寻常烟火 / T1 街坊小运 / T2 江湖奇遇 / T3 渡劫天命 / GM 神权。
// 硬规则：日常无代价动作恒 T0（禁发蓝档以上装备与武学）；
// 每日搜刮掉落有封顶（DAILY_LOOT_CAP），额度耗尽则当拍掉落字段归零；
// gm 开启直出 GM 满额。

export const DAILY_LOOT_CAP = 3;

const TIER_TABLE = {
  T0: { maxQuality: "绿", maxPointBudget: 0, allowSkillBestow: false, allowSpecialStatShift: false },
  T1: { maxQuality: "蓝", maxPointBudget: 1, allowSkillBestow: false, allowSpecialStatShift: false },
  T2: { maxQuality: "紫", maxPointBudget: 2, allowSkillBestow: true, allowSpecialStatShift: false },
  T3: { maxQuality: "橙", maxPointBudget: 3, allowSkillBestow: true, allowSpecialStatShift: true },
  GM: { maxQuality: "红", maxPointBudget: 99, allowSkillBestow: true, allowSpecialStatShift: true },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));

// 数值化 costPaid：布尔 true 记 10（流血赔钱皆有代价），数字直取（钳 0-20）
function costScore(costPaid) {
  if (costPaid === true) return 10;
  if (typeof costPaid === "number") return clamp(costPaid, 0, 20);
  return 0;
}

export function computeCausalBudget({
  tension = 0, riskLevel = 0, costPaid = 0, targetAffection = 0,
  luck = 0, questClimax = false, gm = false, dailyLootUsed = 0,
} = {}) {
  const quotaLeft = Math.max(0, DAILY_LOOT_CAP - (Number.isFinite(dailyLootUsed) ? dailyLootUsed : 0));

  if (gm) {
    return { tier: "GM", ...TIER_TABLE.GM, remainingDailyQuota: Infinity };
  }

  const t = clamp(tension, 0, 100);
  const risk = clamp(riskLevel, 0, 3);
  const cost = costScore(costPaid);
  const aff = clamp(targetAffection, 0, 100);
  const lk = clamp(luck, 0, 10);

  let score = t * 0.5 + risk * 10 + cost;
  score += aff >= 80 ? 10 : aff >= 60 ? 5 : 0;
  score += lk * 1.5;
  if (questClimax) score += 25;

  let tier = "T0";
  if (score >= 70) tier = "T3";
  else if (score >= 45) tier = "T2";
  else if (score >= 20) tier = "T1";

  // 日常无代价动作恒 T0：不涉险、未付代价、非支线高潮，再高交情气运也发不了横财
  if (risk <= 0 && cost <= 0 && !questClimax) tier = "T0";

  const table = TIER_TABLE[tier];
  const out = { tier, ...table, remainingDailyQuota: quotaLeft };

  // 每日搜刮封顶：额度耗尽，当拍不再掉新货（数值归零，叙事 tier 不动）
  if (quotaLeft <= 0) {
    out.maxQuality = "白";
    out.maxPointBudget = 0;
    out.allowSkillBestow = false;
    out.allowSpecialStatShift = false;
  }
  return out;
}
