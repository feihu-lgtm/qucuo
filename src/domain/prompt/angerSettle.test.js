import { describe, expect, it } from "vitest";
import { buildSysBase } from "./sysBase.js";
import { buildExtractionSpecExample, SETTLE_KIND_SPECS } from "./extractionEngine.js";

describe("appease settle prompts", () => {
  it("routes the appease kind to a restricted extraction spec", () => {
    expect(SETTLE_KIND_SPECS.appease).toBe("APPEASE");
    const prompt = buildExtractionSpecExample("UNKNOWN", "appease");

    expect(prompt).toContain("只输出规则允许的怒气解除与有限好感度变化");
    expect(prompt).toContain("角色.才旦.生气解除");
    expect(prompt).toContain("角色.才旦.好感度', N");
    expect(prompt).toContain("0~5 的整数");
    expect(prompt).toContain("严禁输出其他路径、字段、delta 或变更");
  });

  it("allows appeasement to fail and bounds any favorability increase", () => {
    const { phiRules } = buildSysBase(
      220,
      { stage: "NORMAL", affection: 20 },
      "测试剧本",
      null,
      false,
      "",
      false,
      "settle",
      { playerName: "少侠", settleNpc: "才旦", settleKind: "appease" },
    );

    expect(phiRules).toContain("只有当玩家本轮当前行为确实缓和了才旦");
    expect(phiRules).toContain("生气解除");
    expect(phiRules).toContain("0~5 的整数");
    expect(phiRules).not.toContain("这一轮必须给出");
  });
});
