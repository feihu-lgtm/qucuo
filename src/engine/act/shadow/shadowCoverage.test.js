import { describe, expect, it } from "vitest";
import { summarizeShadowCoverage, evaluateShadowThresholds, formatCoverageReport, DEFAULT_RELEASE_THRESHOLDS } from "./shadowCoverage.js";

function mkAgg(overrides = {}) {
  return {
    turns: 100, match: 80, gaps: 15, judgeExtra: 10,
    byCategory: {
      inv: { single_only: 5, judge_only: 3, both_diff: 1 },
      affection: { single_only: 2, judge_only: 8 },
      quest: { single_only: 4, judge_only: 2, both_diff: 1 },
    },
    excluded: { npcs: 30 },
    samples: [
      { key: "a", cats: ["inv", "affection"], cmd: "偷剑" },
      { key: "b", cats: ["inv"], cmd: "拔刀" },
    ],
    ...overrides,
  };
}

describe("summarizeShadowCoverage", () => {
  it("空/零回合返回 null", () => {
    expect(summarizeShadowCoverage(null)).toBeNull();
    expect(summarizeShadowCoverage({ turns: 0 })).toBeNull();
  });
  it("覆盖率按 comparable=turns-excluded 计算", () => {
    const s = summarizeShadowCoverage(mkAgg());
    // inv 无盲区：comparable=100，漏判 5 → 95%
    expect(s.categories.inv.comparable).toBe(100);
    expect(s.categories.inv.coverageRate).toBeCloseTo(0.95);
    // npcs 盲区 30：comparable=70，无信号 → 100%
    expect(s.categories.npcs.comparable).toBe(70);
    expect(s.categories.npcs.coverageRate).toBe(1);
  });
  it("quest reference-only 不计入覆盖率与缺口", () => {
    const s = summarizeShadowCoverage(mkAgg());
    expect(s.categories.quest.coverageRate).toBeNull();
    expect(s.categories.quest.referenceOnly).toBe(true);
    // totalGaps 只含 inv5+affection2=7，不含 quest 的 4
    expect(s.noise.totalGaps).toBe(7);
  });
  it("噪声占比=judge_only+quest 参考信号 / 全部非一致信号", () => {
    const s = summarizeShadowCoverage(mkAgg());
    // quest 不进信号/噪声口径；信号 inv9+aff10=19；噪声 jo3+jo8=11
    expect(s.noise.totalSignals).toBe(19);
    expect(s.noise.noiseShare).toBeCloseTo(11 / 19);
    expect(s.noise.questReference).toBe(7);
  });
  it("采样去重观测：cats 合并计数", () => {
    const s = summarizeShadowCoverage(mkAgg());
    expect(s.samples.count).toBe(2);
    expect(s.samples.catHits).toBe(3);
    expect(s.samples.saturated).toBe(false);
  });
  it("输入聚合不被原地改", () => {
    const agg = mkAgg();
    const snap = JSON.parse(JSON.stringify(agg));
    summarizeShadowCoverage(agg);
    expect(agg).toEqual(snap);
  });
});

describe("evaluateShadowThresholds", () => {
  it("样本不足直接不通过", () => {
    const s = summarizeShadowCoverage(mkAgg({ turns: 50 }));
    const e = evaluateShadowThresholds(s);
    expect(e.pass).toBe(false);
    expect(e.failures.some((f) => f.includes("样本不足"))).toBe(true);
  });
  it("低覆盖率类目被点名", () => {
    const s = summarizeShadowCoverage(mkAgg({ turns: 300, byCategory: { inv: { single_only: 30, judge_only: 3 } } }));
    const e = evaluateShadowThresholds(s);
    expect(e.pass).toBe(false);
    expect(e.failures.some((f) => f.startsWith("inv"))).toBe(true);
  });
  it("全绿样本通过", () => {
    const s = summarizeShadowCoverage(mkAgg({
      turns: 300, gaps: 5,
      byCategory: { inv: { single_only: 1 }, affection: { judge_only: 1 } },
    }));
    const e = evaluateShadowThresholds(s);
    expect(e.pass).toBe(true);
    expect(e.failures).toEqual([]);
  });
  it("quest reference-only 不参与阈值判定", () => {
    const s = summarizeShadowCoverage(mkAgg({
      turns: 300, gaps: 0,
      byCategory: { quest: { single_only: 99 } },
    }));
    expect(evaluateShadowThresholds(s).pass).toBe(true);
  });
  it("噪声占比超限不通过", () => {
    const s = summarizeShadowCoverage(mkAgg({
      turns: 300, gaps: 2,
      byCategory: { affection: { judge_only: 50, single_only: 1 } },
    }));
    const e = evaluateShadowThresholds(s);
    expect(e.pass).toBe(false);
    expect(e.failures.some((f) => f.includes("噪声"))).toBe(true);
  });
  it("全回合盲区类目（npcs 结构性恒 excluded）不阻塞放行", () => {
    // npcs excluded==turns → comparable=0 不可测，跳过评估而非判负（Review finding）
    const s = summarizeShadowCoverage(mkAgg({
      turns: 300, gaps: 0,
      byCategory: {},
      excluded: { npcs: 300 },
    }));
    expect(s.categories.npcs.comparable).toBe(0);
    expect(evaluateShadowThresholds(s).pass).toBe(true);
  });
  it("可对比但低覆盖率仍判负", () => {
    const s = summarizeShadowCoverage(mkAgg({
      turns: 300, gaps: 40,
      byCategory: { inv: { single_only: 30 } },
      excluded: { npcs: 300 },
    }));
    const e = evaluateShadowThresholds(s);
    expect(e.pass).toBe(false);
    expect(e.failures.some((f) => f.startsWith("inv"))).toBe(true);
  });
  it("null 输入不通过", () => {
    expect(evaluateShadowThresholds(null).pass).toBe(false);
  });
  it("默认阈值常量与 docs 口径一致", () => {
    expect(DEFAULT_RELEASE_THRESHOLDS.minTurns).toBe(200);
    expect(DEFAULT_RELEASE_THRESHOLDS.minCoverage).toBe(0.95);
  });
});

describe("formatCoverageReport", () => {
  it("空数据给指引行", () => {
    expect(formatCoverageReport(null)[0]).toContain("无影子对账数据");
  });
  it("报告含覆盖率/噪声/采样/阈值评估", () => {
    const s = summarizeShadowCoverage(mkAgg({ turns: 300 }));
    const lines = formatCoverageReport(s, evaluateShadowThresholds(s));
    const joined = lines.join("\n");
    expect(joined).toContain("覆盖率");
    expect(joined).toContain("噪声占比");
    expect(joined).toContain("采样 2 句");
    expect(joined).toContain("放行阈值评估");
  });
});
