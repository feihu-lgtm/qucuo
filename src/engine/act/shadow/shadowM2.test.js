import { describe, expect, it, beforeEach } from "vitest";
// WO-16D-M2 测试：数值 sub 方向明细不坍缩 / quest reference-only / 采样按句去重
import { emptyCategories } from "./shadowTaxonomy.js";
import { compareCategories } from "./shadowCompare.js";
import { recordAggregate as recordAggregateProbe, shadowAggregates, _resetShadowAggregates } from "./shadowJudge.js";
import { formatVerdictLine, formatAggregate } from "./shadowFormat.js";
import { formatReleaseGateMarkdown } from "../../ports/releaseMetrics.js";

describe("WO-16D-M2 数值 sub 方向明细", () => {
  it("hp both_diff + money single_only 同回合不坍缩：sub 各自带方向", () => {
    const res = compareCategories(
      { categories: { ...emptyCategories(), vitals: { hp: -10, money: -30 } }, excluded: ["npcs"] },
      { ...emptyCategories(), vitals: { hp: -5, money: 0 } },
    );
    const v = res.verdicts.vitals;
    // 一级摘要仍是 single_only（优先级口径保留），但 sub 明细必须能看出 hp 是 both_diff
    expect(v.verdict).toBe("single_only");
    expect(v.sub.hp.verdict).toBe("both_diff");
    expect(v.sub.hp).toMatchObject({ single: -10, judge: -5 });
    expect(v.sub.money.verdict).toBe("single_only");
    expect(v.sub.money).toMatchObject({ single: -30, judge: 0 });
  });

  it("formatVerdictLine 渲染 sub 逐子项方向标签", () => {
    const line = formatVerdictLine("vitals", {
      verdict: "single_only",
      sub: {
        hp: { single: -10, judge: -5, verdict: "both_diff" },
        money: { single: -30, judge: 0, verdict: "single_only" },
      },
    });
    expect(line).toContain("hp·两边都偏");
    expect(line).toContain("money·判官漏判");
  });

  it("sub 内非零相等子项记 match，不掺进方向统计", () => {
    const res = compareCategories(
      { categories: { ...emptyCategories(), vitals: { hp: -10, money: 5 } }, excluded: ["npcs"] },
      { ...emptyCategories(), vitals: { hp: -10, money: 0 } },
    );
    expect(res.verdicts.vitals.verdict).toBe("single_only");
    expect(res.verdicts.vitals.sub.hp.verdict).toBe("match");
    expect(res.verdicts.vitals.sub.money.verdict).toBe("single_only");
  });
});

describe("WO-16D-M2 quest reference-only", () => {
  beforeEach(() => _resetShadowAggregates());

  it("quest single_only 不计入 hasGap（gaps 缺口汇总），verdicts 仍照常产出", () => {
    const res = compareCategories(
      { categories: { ...emptyCategories(), quest: { advance: ["q1"] } }, excluded: ["npcs"] },
      emptyCategories(),
    );
    expect(res.verdicts.quest.verdict).toBe("single_only"); // 展示保留
    expect(res.hasGap).toBe(false); // 但不计缺口
  });

  it("quest 与 vitals 混合回合：vitals 缺口照常计，quest 不加码", () => {
    const res = compareCategories(
      { categories: { ...emptyCategories(), quest: { advance: ["q1"] }, vitals: { hp: -10, money: 0 } }, excluded: ["npcs"] },
      emptyCategories(),
    );
    expect(res.hasGap).toBe(true); // vitals single_only 驱动
    expect(res.verdicts.quest.verdict).toBe("single_only");
  });

  it("聚合口径：quest-only 回合 gaps 不增，byCategory 仍记展示，formatAggregate 标注参考", () => {
    const result = compareCategories(
      { categories: { ...emptyCategories(), quest: { advance: ["q1"] } }, excluded: ["npcs"] },
      emptyCategories(),
    );
    recordAggregateProbe("ep_m2", result, "把糌粑交给才旦");
    const agg = shadowAggregates("ep_m2");
    expect(agg.gaps).toBe(0);
    expect(agg.byCategory.quest?.single_only).toBe(1); // 展示数据仍记
    const lines = formatAggregate(agg);
    const questLine = lines.find((l) => l.startsWith("quest"));
    expect(questLine).toContain("参考");
    expect(questLine).toContain("不计入缺口");
    // markdown 报告同口径
    const md = formatReleaseGateMarkdown({ epoch: "ep_m2", shadowAgg: agg });
    expect(md).toContain("quest（参考·不计入缺口）");
  });
});

describe("WO-16D-M2 采样按句去重", () => {
  beforeEach(() => _resetShadowAggregates());

  it("同一句 cmd 触发多类目 single_only 只占一个采样位，类目合并进 cats", () => {
    const mkResult = (cats) => {
      const verdicts = {};
      for (const cat of cats) verdicts[cat] = { verdict: "single_only" };
      return { verdicts, hasGap: true, judgeExtra: false };
    };
    recordAggregateProbe("ep_dedupe", mkResult(["inv", "flags"]), "摸摸对方怀里有什么");
    recordAggregateProbe("ep_dedupe", mkResult(["vitals"]), "摸摸对方怀里有什么"); // 同句再来一轮
    const agg = shadowAggregates("ep_dedupe");
    expect(agg.samples.length).toBe(1); // 同 cmd 只占一位
    expect(agg.samples[0].cmd).toBe("摸摸对方怀里有什么");
    expect(agg.samples[0].cats).toEqual(["inv", "flags", "vitals"]); // 类目合并不重复
  });

  it("不同 cmd 各占其位；上限 20 指去重后句数", () => {
    const result = { verdicts: { inv: { verdict: "single_only" } }, hasGap: true, judgeExtra: false };
    for (let i = 0; i < 25; i += 1) recordAggregateProbe("ep_cap", result, `第${i}句`);
    const agg = shadowAggregates("ep_cap");
    expect(agg.samples.length).toBe(20);
  });

  it("formatAggregate 采样行合并展示 cats", () => {
    const result = { verdicts: { inv: { verdict: "single_only" }, flags: { verdict: "single_only" } }, hasGap: true, judgeExtra: false };
    recordAggregateProbe("ep_fmt", result, "试试深浅");
    const lines = formatAggregate(shadowAggregates("ep_fmt"));
    expect(lines.find((l) => l.includes("试试深浅"))).toContain("[inv/flags]");
    expect(lines.find((l) => l.includes("上限20"))).toContain("按句去重");
  });
});
