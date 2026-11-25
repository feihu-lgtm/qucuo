import { describe, it, expect } from "vitest";
import { computeCausalBudget, DAILY_LOOT_CAP } from "./causalBudget.js";

describe("computeCausalBudget 因果授信", () => {
  it("缺省入参恒为 T0：绿档封顶、零预算、禁赐武学、禁洗髓", () => {
    const out = computeCausalBudget();
    expect(out.tier).toBe("T0");
    expect(out.maxQuality).toBe("绿");
    expect(out.maxPointBudget).toBe(0);
    expect(out.allowSkillBestow).toBe(false);
    expect(out.allowSpecialStatShift).toBe(false);
    expect(out.remainingDailyQuota).toBe(DAILY_LOOT_CAP);
  });

  it("日常无代价恒 T0：再高 tension/交情/气运也压得住", () => {
    const out = computeCausalBudget({ tension: 100, targetAffection: 100, luck: 10 });
    expect(out.tier).toBe("T0");
  });

  it("小涉险+小代价进 T1：蓝档、禁赐武学", () => {
    const out = computeCausalBudget({ riskLevel: 2, costPaid: 5, luck: 2 });
    expect(out.tier).toBe("T1");
    expect(out.maxQuality).toBe("蓝");
    expect(out.maxPointBudget).toBe(1);
    expect(out.allowSkillBestow).toBe(false);
  });

  it("生死涉险进 T2/T3：赐武学与洗髓按档放开", () => {
    const t2 = computeCausalBudget({ riskLevel: 3, costPaid: 10, tension: 30 });
    expect(t2.tier).toBe("T2");
    expect(t2.maxQuality).toBe("紫");
    expect(t2.allowSkillBestow).toBe(true);
    expect(t2.allowSpecialStatShift).toBe(false);
    const t3 = computeCausalBudget({ riskLevel: 3, costPaid: 20, tension: 80, questClimax: true });
    expect(t3.tier).toBe("T3");
    expect(t3.maxQuality).toBe("橙");
    expect(t3.allowSpecialStatShift).toBe(true);
  });

  it("支线高潮抬档：无险无价的日常被高潮拉出 T0", () => {
    const out = computeCausalBudget({ questClimax: true, luck: 5, targetAffection: 80 });
    expect(out.tier).not.toBe("T0");
  });

  it("gm 直出 GM 满额：红档、99 预算、额度无限", () => {
    const out = computeCausalBudget({ gm: true });
    expect(out.tier).toBe("GM");
    expect(out.maxQuality).toBe("红");
    expect(out.maxPointBudget).toBe(99);
    expect(out.allowSkillBestow).toBe(true);
    expect(out.allowSpecialStatShift).toBe(true);
    expect(out.remainingDailyQuota).toBe(Infinity);
  });

  it("每日搜刮封顶：用尽后 remainingDailyQuota 归零且掉落字段清零", () => {
    const out = computeCausalBudget({ riskLevel: 3, tension: 80, questClimax: true, costPaid: 20, dailyLootUsed: DAILY_LOOT_CAP });
    expect(out.remainingDailyQuota).toBe(0);
    expect(out.maxQuality).toBe("白");
    expect(out.maxPointBudget).toBe(0);
    expect(out.allowSkillBestow).toBe(false);
    // 叙事 tier 不受影响
    expect(out.tier).toBe("T3");
  });

  it("确定性：同参两次输出逐字节相同", () => {
    const args = { tension: 55, riskLevel: 2, costPaid: 8, targetAffection: 70, luck: 6, dailyLootUsed: 1 };
    expect(JSON.stringify(computeCausalBudget(args))).toBe(JSON.stringify(computeCausalBudget(args)));
  });

  it("非法入参不抛：undefined/NaN 按零处理", () => {
    const out = computeCausalBudget({ tension: NaN, riskLevel: undefined, luck: "x" });
    expect(out.tier).toBe("T0");
  });

  it("交情分档：80 以上比 60 档多推分", () => {
    const base = { riskLevel: 1, costPaid: 1 };
    const low = computeCausalBudget({ ...base, targetAffection: 59 });
    const mid = computeCausalBudget({ ...base, targetAffection: 60 });
    const high = computeCausalBudget({ ...base, targetAffection: 80 });
    // 无险有价时不被恒 T0 压住，交情分档应反映在 tier 或同 tier 内（用 score 间接验证：高档更容易升 tier）
    const scoreOf = (o) => ["T0", "T1", "T2", "T3"].indexOf(o.tier);
    expect(scoreOf(high)).toBeGreaterThanOrEqual(scoreOf(mid));
    expect(scoreOf(mid)).toBeGreaterThanOrEqual(scoreOf(low));
    expect(scoreOf(high)).toBeGreaterThan(scoreOf(low));
  });
});
