import { describe, expect, it } from "vitest";
import { formatVerdictLine, formatShadowVerdicts, formatAggregate } from "./shadowFormat.js";

describe("formatVerdictLine", () => {
  it("match/excluded 简行，excluded 明示盲区", () => {
    expect(formatVerdictLine("inv", { verdict: "match" })).toBe("inv：一致");
    expect(formatVerdictLine("npcs", { verdict: "excluded" })).toBe("npcs：盲区(排除)");
  });
  it("single_only 带双方明细", () => {
    const line = formatVerdictLine("inv", {
      verdict: "single_only",
      single: { add: ["羊肉"], rm: [] }, judge: { add: [], rm: [] },
    });
    expect(line).toContain("判官漏判");
    expect(line).toContain("羊肉");
  });
  it("affection 用增量格式", () => {
    const line = formatVerdictLine("affection", { verdict: "both_diff", single: { 甲: 5 }, judge: { 甲: 3 } });
    expect(line).toContain("甲+5");
    expect(line).toContain("甲+3");
  });
  it("flags 数组形状", () => {
    const line = formatVerdictLine("flags", { verdict: "judge_only", single: [], judge: ["q1"] });
    expect(line).toContain("判官会判");
    expect(line).toContain("q1");
  });
});

describe("formatShadowVerdicts", () => {
  it("逐类目出行", () => {
    const lines = formatShadowVerdicts({ inv: { verdict: "match" }, npcs: { verdict: "excluded" } });
    expect(lines).toHaveLength(2);
  });
});

describe("formatAggregate", () => {
  it("零回合返回 null（不制造噪音）", () => {
    expect(formatAggregate(null)).toBeNull();
    expect(formatAggregate({ turns: 0 })).toBeNull();
  });
  it("有数据出统计行+类目行+盲区行", () => {
    const lines = formatAggregate({
      turns: 5, match: 3, gaps: 1, judgeExtra: 1,
      byCategory: { inv: { single_only: 1, judge_only: 2, both_diff: 0 } },
      excluded: { npcs: 5 },
    });
    expect(lines[0]).toContain("共 5 回合");
    expect(lines.some((l) => l.includes("inv"))).toBe(true);
    expect(lines.some((l) => l.includes("盲区") && l.includes("npcs×5"))).toBe(true);
  });
});
