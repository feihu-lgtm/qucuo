import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withAI } from "./withAI.js";
import { createMockAi } from "./ai.js";
import {
  _resetReleaseMetrics,
  _setReleaseMetricsEnabledForTest,
  recordIntakeMetric,
  recordSealMetric,
  releaseMetricAggregates,
  formatReleaseGateMarkdown,
} from "./releaseMetrics.js";
import "../../engine/turn/intakeTurn.js";

describe("releaseMetrics 放行指标观测", () => {
  beforeEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(true);
  });

  afterEach(() => {
    _resetReleaseMetrics();
    _setReleaseMetricsEnabledForTest(null);
  });

  it("按 provider/model 与 save epoch 隔离统计 intake 与 SEAL，且不记录 API key/正文", () => {
    const cfgA = { provider: "openai", model: "gpt-4o-mini", apiKey: "secret-key-123" };
    const cfgB = { provider: "gemini", model: "gemini-2.5-flash", apiKey: "secret-key-456" };

    recordIntakeMetric({ epoch: "1", cfg: cfgA, outcome: "schemaOk" });
    recordIntakeMetric({ epoch: "1", cfg: cfgA, outcome: "parseFailed" });
    recordIntakeMetric({ epoch: "1", cfg: cfgA, outcome: "validateFailed" });
    recordIntakeMetric({ epoch: "1", cfg: cfgB, outcome: "otherFailed" });

    recordSealMetric({ epoch: "1", cfg: cfgB, sealText: "{\"fills\":{}}", sealData: { fills: {} } });
    recordSealMetric({ epoch: "1", cfg: cfgB, sealText: "", sealData: null });
    recordSealMetric({ epoch: "2", cfg: cfgB, sealText: "{bad", sealData: null, warnings: ["尾章 JSON 解析失败"] });

    const e1 = releaseMetricAggregates("1");
    expect(e1.intake).toEqual([
      { provider: "openai", model: "gpt-4o-mini", calls: 3, schemaOk: 1, parseFailed: 1, validateFailed: 1, otherFailed: 0 },
      { provider: "gemini", model: "gemini-2.5-flash", calls: 1, schemaOk: 0, parseFailed: 0, validateFailed: 0, otherFailed: 1 },
    ]);
    expect(e1.seal).toEqual([
      { provider: "gemini", model: "gemini-2.5-flash", total: 2, withSeal: 1, missingSeal: 1, jsonOk: 1, jsonFailed: 0, passed: 1, failed: 1 },
    ]);

    const e2 = releaseMetricAggregates("2");
    expect(e2.intake).toEqual([]);
    expect(e2.seal).toEqual([
      { provider: "gemini", model: "gemini-2.5-flash", total: 1, withSeal: 1, missingSeal: 0, jsonOk: 0, jsonFailed: 1, passed: 0, failed: 1 },
    ]);

    const md = formatReleaseGateMarkdown({ epoch: "1", shadowAgg: { turns: 4, match: 3, gaps: 1, judgeExtra: 0, byCategory: { inv: { single_only: 1 } } }, metricsAgg: e1 });
    expect(md).toContain("| openai | gpt-4o-mini | 3 | 1 | 1 | 1 | 0 | 33.3% |");
    expect(md).toContain("| gemini | gemini-2.5-flash | 2 | 1 | 1 | 1 | 1 | 1 | 50.0% |");
    expect(md).not.toContain("secret-key");
  });

  it("withAI(turn.intake) 真实记录成功、解析失败、校验失败与异常", async () => {
    const cfg = { provider: "anthropic", model: "claude-haiku" };
    const ctx = { userContent: "玩家输入：查看桌上", cfg };

    await withAI("turn.intake", ctx, {
      ai: createMockAi([JSON.stringify({ read: "查看桌上", refIds: [], actions: [], proposals: [] })]),
      apiCfg: cfg,
      epoch: "9",
      throwOnError: false,
    });
    await withAI("turn.intake", ctx, {
      ai: createMockAi(["not-json"]),
      apiCfg: cfg,
      epoch: "9",
      throwOnError: false,
    });
    await withAI("turn.intake", ctx, {
      ai: createMockAi([JSON.stringify({ read: "缺字段" })]),
      apiCfg: cfg,
      epoch: "9",
      throwOnError: false,
    });
    await withAI("turn.intake", ctx, {
      ai: { chat: async () => { throw new Error("network down"); } },
      apiCfg: cfg,
      epoch: "9",
      throwOnError: false,
    });

    const agg = releaseMetricAggregates("9");
    expect(agg.intake).toEqual([
      { provider: "anthropic", model: "claude-haiku", calls: 4, schemaOk: 1, parseFailed: 1, validateFailed: 1, otherFailed: 1 },
    ]);
  });

  it("vertex 通道按 vertexModel 分桶——cfg.model 相同不并桶", () => {
    const base = { apiType: "vertex", model: "shared-irrelevant" };
    recordIntakeMetric({ epoch: "1", cfg: { ...base, vertexModel: "google/gemini-3.8-flash" }, outcome: "schemaOk" });
    recordIntakeMetric({ epoch: "1", cfg: { ...base, vertexModel: "google/gemini-3.8-pro" }, outcome: "schemaOk" });
    const agg = releaseMetricAggregates("1");
    expect(agg.intake).toHaveLength(2);
    expect(agg.intake.map((r) => r.model).sort()).toEqual(["google/gemini-3.8-flash", "google/gemini-3.8-pro"]);
  });

  it("vertexModel 缺省回落默认模型，仍非 cfg.model", () => {
    recordIntakeMetric({ epoch: "1", cfg: { apiType: "vertex", model: "decoy" }, outcome: "schemaOk" });
    const agg = releaseMetricAggregates("1");
    expect(agg.intake[0].model).not.toBe("decoy");
    expect(agg.intake[0].model).toContain("gemini");
  });

  it("SEAL 锚到未填空与 emergence 拒绝均计 failed", () => {
    const cfg = { provider: "openai", model: "gpt-4o-mini" };
    // 基线全净 → passed
    recordSealMetric({ epoch: "1", cfg, sealText: "{}", sealData: { fills: {} } });
    // 条件券正文埋锚但尾章未填空 → failed
    recordSealMetric({ epoch: "1", cfg, sealText: "{}", sealData: { fills: {} }, unfilledWarrants: ["w1"] });
    // 声明新 NPC 被 emergence 拒绝 → failed
    recordSealMetric({ epoch: "1", cfg, sealText: "{}", sealData: { fills: {} }, emergenceRejections: ["登场申报「甲」未在正文登场，丢弃"] });
    const agg = releaseMetricAggregates("1");
    expect(agg.seal).toEqual([
      { provider: "openai", model: "gpt-4o-mini", total: 3, withSeal: 3, missingSeal: 0, jsonOk: 3, jsonFailed: 0, passed: 1, failed: 2 },
    ]);
  });

  it("production / test 默认关闭采集（零噪音）", () => {
    _setReleaseMetricsEnabledForTest(null);
    recordIntakeMetric({ epoch: "prod", cfg: { provider: "openai", model: "m" }, outcome: "schemaOk" });
    recordSealMetric({ epoch: "prod", cfg: { provider: "openai", model: "m" }, sealText: "{}", sealData: {} });
    expect(releaseMetricAggregates("prod")).toEqual({ intake: [], seal: [] });
  });
});
