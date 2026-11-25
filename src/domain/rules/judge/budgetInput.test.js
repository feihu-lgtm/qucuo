import { describe, expect, it } from "vitest";
import { buildCausalBudgetInput, readDailyLootUsed } from "./budgetInput.js";
import { resolveWarrantQuality, inferCategoryFromClaim } from "./warrantRules.js";
import { computeCausalBudget } from "./causalBudget.js";

const baseState = {
  char: { special: { 气运: 5 } },
  varTree: { 角色: { 张三: { 好感度: 70 } } },
  turn: 48, // day 3
};

describe("buildCausalBudgetInput 八参装配", () => {
  it("luck 读气运钳 0-10，gm 透传", () => {
    const out = buildCausalBudgetInput(baseState, {}, { gm: true });
    expect(out.luck).toBe(5);
    expect(out.gm).toBe(true);
  });
  it("tension：无遇敌为 0，有遇敌按势力张力加档", () => {
    expect(buildCausalBudgetInput(baseState, {}, {}).tension).toBe(0);
    const withEnc = buildCausalBudgetInput({ ...baseState, encounter: { factionKey: "雪山派" } }, {}, {});
    expect(withEnc.tension).toBeGreaterThan(0);
  });
  it("riskLevel 动作兜底：偷/决斗 2、翻容器 1、talk 0", () => {
    expect(buildCausalBudgetInput(baseState, { actions: [{ kind: "steal" }] }, {}).riskLevel).toBe(2);
    expect(buildCausalBudgetInput(baseState, { actions: [{ kind: "inspect_container" }] }, {}).riskLevel).toBe(1);
    expect(buildCausalBudgetInput(baseState, { actions: [{ kind: "talk" }] }, {}).riskLevel).toBe(0);
  });
  it("riskLevel 前哨 risk 覆盖接口：取较大者（WO-16G 预留）", () => {
    const out = buildCausalBudgetInput(baseState, { actions: [{ kind: "talk" }], risk: "高" }, {});
    expect(out.riskLevel).toBe(3);
    const low = buildCausalBudgetInput(baseState, { actions: [{ kind: "steal" }], risk: "低" }, {});
    expect(low.riskLevel).toBe(2); // 规则值更大取规则
  });
  it("costPaid：give/trade 每件 5、use_item 3", () => {
    const out = buildCausalBudgetInput(baseState, { actions: [{ kind: "give", itemId: "it_1" }] }, {});
    expect(out.costPaid).toBe(5);
  });
  it("targetAffection 社交目标好感最大值", () => {
    const out = buildCausalBudgetInput(baseState, { actions: [{ kind: "talk", target: "张三" }] }, {});
    expect(out.targetAffection).toBe(70);
  });
  it("questClimax 须玩家实际推进末阶段（proposals quest_advance 命中）", () => {
    const st = { ...baseState, questCandidates: [{ isFinalStage: true, questId: "q1", flag: "f1" }] };
    // 只在场不推进 → false（普通搭话不抬额度）
    expect(buildCausalBudgetInput(st, { actions: [{ kind: "talk" }] }, {}).questClimax).toBe(false);
    // proposals 命中末阶段 → true
    expect(buildCausalBudgetInput(st, { proposals: [{ kind: "quest_advance", questId: "q1", flag: "f1" }] }, {}).questClimax).toBe(true);
    // 命中非末阶段 → false
    const st2 = { ...baseState, questCandidates: [{ isFinalStage: false, questId: "q1", flag: "f1" }] };
    expect(buildCausalBudgetInput(st2, { proposals: [{ kind: "quest_advance", questId: "q1", flag: "f1" }] }, {}).questClimax).toBe(false);
  });
});

describe("readDailyLootUsed 跨日归零", () => {
  it("账本不存在按 0（旧档兼容）", () => {
    expect(readDailyLootUsed({}, 3)).toBe(0);
    expect(readDailyLootUsed({ 世界: {} }, 3)).toBe(0);
  });
  it("当日读 count，跨日归零", () => {
    const vt = { 世界: { 每日搜刮: { day: 3, count: 2 } } };
    expect(readDailyLootUsed(vt, 3)).toBe(2);
    expect(readDailyLootUsed(vt, 4)).toBe(0);
  });
});

describe("resolveWarrantQuality", () => {
  it("GM 固定红、配额尽固定白", () => {
    expect(resolveWarrantQuality({ tier: "GM", maxQuality: "红", remainingDailyQuota: Infinity }, {}, 0, 0.99)).toBe("红");
    expect(resolveWarrantQuality({ tier: "T2", maxQuality: "紫", remainingDailyQuota: 0 }, {}, 10, 0.01)).toBe("白");
  });
  it("掷中取 maxQuality，不中降一档", () => {
    // natural+luck5：fullChance=0.40+0.25+0.15=0.80
    expect(resolveWarrantQuality({ tier: "T2", maxQuality: "紫", remainingDailyQuota: 2 }, { fit: "natural" }, 5, 0.5)).toBe("紫");
    expect(resolveWarrantQuality({ tier: "T2", maxQuality: "紫", remainingDailyQuota: 2 }, { fit: "natural" }, 5, 0.9)).toBe("蓝");
  });
  it("absurd 降概率、白到底不降", () => {
    // absurd+luck0：0.40-0.15=0.25
    expect(resolveWarrantQuality({ tier: "T1", maxQuality: "蓝", remainingDailyQuota: 2 }, { fit: "absurd" }, 0, 0.3)).toBe("绿");
    expect(resolveWarrantQuality({ tier: "T0", maxQuality: "白", remainingDailyQuota: 2 }, { fit: "absurd" }, 0, 0.9)).toBe("白");
  });
});

describe("inferCategoryFromClaim", () => {
  it("图鉴精确命中优先", () => {
    expect(inferCategoryFromClaim("霜牙")).toBe("weapon"); // CATALOG 武器
  });
  it("剥句壳后命中图鉴/正则：箱底有把匕首→weapon", () => {
    expect(inferCategoryFromClaim("箱底有把匕首")).toBe("weapon");
  });
  it("耗材/文书词最前级截停→misc（金疮药不误判饰物）", () => {
    expect(inferCategoryFromClaim("金疮药")).toBe("misc");
    expect(inferCategoryFromClaim("一封密信")).toBe("misc");
  });
  it("饰物/兵器/护具/材质兜底", () => {
    expect(inferCategoryFromClaim("玉佩")).toBe("accessory");
    expect(inferCategoryFromClaim("长剑")).toBe("weapon");
    expect(inferCategoryFromClaim("铁甲")).toBe("armor");
    expect(inferCategoryFromClaim("银镯子")).toBe("accessory");
  });
  it("无特征落 misc", () => {
    expect(inferCategoryFromClaim("奇怪的石子")).toBe("misc");
    expect(inferCategoryFromClaim("")).toBe("misc");
  });
});

describe("与 computeCausalBudget 端到端", () => {
  it("日常无代价动作恒 T0，涉险动作可上 T1+", () => {
    const talkInput = buildCausalBudgetInput(baseState, { actions: [{ kind: "talk", target: "张三" }] }, {});
    expect(computeCausalBudget(talkInput).tier).toBe("T0");
    const stealInput = buildCausalBudgetInput(baseState, { actions: [{ kind: "steal" }] }, {});
    const tier = computeCausalBudget(stealInput).tier;
    expect(["T1", "T2", "T3"]).toContain(tier); // risk2×10=20 +luck7.5+aff0 → ≥20 → T1
  });
});
