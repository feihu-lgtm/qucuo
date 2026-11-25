// 放行指标观测（dev / 全流程日志只读内存聚合）：
// 统计 turn.intake schema 合格率与 ---SEAL--- 尾章合格率，按 provider/model 与
// save epoch 隔离聚合；production 默认禁用且零噪音，绝不记录 API key 或正文，
// 不写 gameStore、不落盘、不进 prompt、不影响玩家行为。

import { getApiModel } from "../../content/apiModel.js";

let recordingOverrideForTest = null;

export function _setReleaseMetricsEnabledForTest(value) {
  recordingOverrideForTest = value === null ? null : Boolean(value);
}

export function resolveReleaseMetricsEnabled() {
  if (recordingOverrideForTest !== null) return recordingOverrideForTest;
  try {
    return !!import.meta.env?.DEV && import.meta.env?.MODE !== "test";
  } catch {
    return false;
  }
}

function resolveProviderModel(cfg) {
  const provider = String(cfg?.provider || cfg?.apiType || "unknown").trim() || "unknown";
  // 必须走 getApiModel——vertex 通道真实模型在 cfg.vertexModel，直读 cfg.model
  // 会把两个不同 vertexModel 的样本并进同一桶，放行报表失真。
  const model = String(getApiModel(cfg) || "unknown").trim() || "unknown";
  return { provider, model, key: `${provider}::${model}` };
}

const epochStore = new Map(); // epoch -> { intake: Map, seal: Map }

function getBucketMap(epoch, section) {
  const key = String(epoch ?? "default");
  if (!epochStore.has(key)) {
    epochStore.set(key, { intake: new Map(), seal: new Map() });
  }
  return epochStore.get(key)[section];
}

export function _resetReleaseMetrics() {
  epochStore.clear();
}

export function recordIntakeMetric({ epoch = "default", cfg, outcome } = {}) {
  if (!resolveReleaseMetricsEnabled()) return;
  const { provider, model, key } = resolveProviderModel(cfg);
  const map = getBucketMap(epoch, "intake");
  if (!map.has(key)) {
    map.set(key, { provider, model, calls: 0, schemaOk: 0, parseFailed: 0, validateFailed: 0, otherFailed: 0 });
  }
  const row = map.get(key);
  row.calls += 1;
  if (outcome === "schemaOk") row.schemaOk += 1;
  else if (outcome === "parseFailed") row.parseFailed += 1;
  else if (outcome === "validateFailed") row.validateFailed += 1;
  else row.otherFailed += 1;
}

export function recordSealMetric({
  epoch = "default",
  cfg,
  sealText = "",
  sealData = null,
  warnings = [],
  missingAnchors = [],
  rejectedAffixes = [],
  unfilledWarrants = [],
  emergenceRejections = [],
} = {}) {
  if (!resolveReleaseMetricsEnabled()) return;
  const { provider, model, key } = resolveProviderModel(cfg);
  const map = getBucketMap(epoch, "seal");
  if (!map.has(key)) {
    map.set(key, { provider, model, total: 0, withSeal: 0, missingSeal: 0, jsonOk: 0, jsonFailed: 0, passed: 0, failed: 0 });
  }
  const row = map.get(key);
  const hasSeal = Boolean(String(sealText || "").trim());
  row.total += 1;
  if (hasSeal) {
    row.withSeal += 1;
    if (sealData) row.jsonOk += 1;
    else row.jsonFailed += 1;
  } else {
    row.missingSeal += 1;
  }
  const passed = hasSeal
    && Boolean(sealData)
    && (!warnings || warnings.length === 0)
    && (!missingAnchors || missingAnchors.length === 0)
    && (!rejectedAffixes || rejectedAffixes.length === 0)
    && (!unfilledWarrants || unfilledWarrants.length === 0)
    && (!emergenceRejections || emergenceRejections.length === 0);
  if (passed) row.passed += 1;
  else row.failed += 1;
}

export function releaseMetricAggregates(epoch = "default") {
  const entry = epochStore.get(String(epoch ?? "default"));
  if (!entry) return { intake: [], seal: [] };
  return {
    intake: [...entry.intake.values()].map((r) => ({ ...r })),
    seal: [...entry.seal.values()].map((r) => ({ ...r })),
  };
}

function pct(num, den) {
  if (!den) return "0.0%";
  return `${((num / den) * 100).toFixed(1)}%`;
}

export function formatReleaseMetricLines(agg) {
  if (!agg) return null;
  const intake = agg.intake || [];
  const seal = agg.seal || [];
  if (!intake.length && !seal.length) return null;
  const lines = [];
  for (const r of intake) {
    lines.push(`intake[${r.provider}/${r.model}] 调用 ${r.calls} · 通过 ${r.schemaOk}（${pct(r.schemaOk, r.calls)}）· 解析失败 ${r.parseFailed} · 校验失败 ${r.validateFailed} · 网络/其他失败 ${r.otherFailed}`);
  }
  for (const r of seal) {
    lines.push(`SEAL[${r.provider}/${r.model}] 回合 ${r.total} · 有尾章 ${r.withSeal}/缺尾章 ${r.missingSeal} · JSON可解析 ${r.jsonOk} · 通过 ${r.passed}（${pct(r.passed, r.total)}）· 失败 ${r.failed}`);
  }
  return lines;
}

export function formatReleaseGateMarkdown({ epoch = "default", shadowAgg = null, metricsAgg = null } = {}) {
  const parts = [`## 放行指标观测报告（epoch ${String(epoch)}）`];

  parts.push("", "### 1. WO-16D 影子覆盖率");
  if (!shadowAgg || !shadowAgg.turns) {
    parts.push("暂无影子对账样本（单调用模式下 dev 自动采集）。");
  } else {
    parts.push("| 样本回合 | 全一致 | 判官漏判回合 | 判官多判回合 |", "|---:|---:|---:|---:|",
      `| ${shadowAgg.turns} | ${shadowAgg.match} | ${shadowAgg.gaps} | ${shadowAgg.judgeExtra} |`);
    const cats = Object.entries(shadowAgg.byCategory || {});
    if (cats.length) {
      parts.push("", "| 类目 | single_only(漏判) | judge_only(会判) | both_diff |", "|---|---:|---:|---:|");
      for (const [cat, c] of cats) {
        // WO-16D-M2：quest 类目 reference-only——状态驱动推进归因不可靠，
        // 不计入 gaps 缺口汇总，表中标注人工甄别；数值类目混合方向见 Trace 逐 sub 明细。
        const label = cat === "quest" ? `${cat}（参考·不计入缺口）` : cat;
        parts.push(`| ${label} | ${c.single_only || 0} | ${c.judge_only || 0} | ${c.both_diff || 0} |`);
      }
    }
  }

  const intake = metricsAgg?.intake || [];
  parts.push("", "### 2. turn.intake Schema 合格率");
  if (!intake.length) {
    parts.push("暂无 `turn.intake` 采样。");
  } else {
    parts.push("| Provider | Model | 调用次数 | Schema 通过 | 解析失败 | 校验失败 | 网络/其他失败 | 合格率 |",
      "|---|---|---:|---:|---:|---:|---:|---:|");
    for (const r of intake) {
      parts.push(`| ${r.provider} | ${r.model} | ${r.calls} | ${r.schemaOk} | ${r.parseFailed} | ${r.validateFailed} | ${r.otherFailed} | ${pct(r.schemaOk, r.calls)} |`);
    }
  }

  const seal = metricsAgg?.seal || [];
  parts.push("", "### 3. ---SEAL--- 尾章合格率");
  if (!seal.length) {
    parts.push("暂无 `---SEAL---` 采样。");
  } else {
    parts.push("| Provider | Model | 总回合 | 有尾章 | 缺尾章 | JSON 可解析 | 校验通过 | 校验失败 | 合格率 |",
      "|---|---|---:|---:|---:|---:|---:|---:|---:|");
    for (const r of seal) {
      parts.push(`| ${r.provider} | ${r.model} | ${r.total} | ${r.withSeal} | ${r.missingSeal} | ${r.jsonOk} | ${r.passed} | ${r.failed} | ${pct(r.passed, r.total)} |`);
    }
  }

  return parts.join("\n");
}
