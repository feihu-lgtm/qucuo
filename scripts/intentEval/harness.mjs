// 行动识别评测：逐条跑 recognizeIntent，统计各类准确率、复合拆分准确率、阈值覆盖率/准确率与延迟分位数。
import { recognizeIntent } from "../../src/domain/intent/recognizer.js";
import { planConfidence, gateRecognition } from "../../src/domain/intent/gate.js";
import { PROMPT_VERSION } from "../../src/domain/intent/prompts.js";

export const DEFAULT_THRESHOLDS = [0.7, 0.8, 0.9];

const SLOTS = ["target", "item", "amount", "direction"];

export function actionMatches(predicted, expected) {
  if (!predicted || predicted.kind !== expected.kind) return false;
  return SLOTS.every((slot) => !(slot in expected) || predicted[slot] === expected[slot]);
}

export function lineCorrect(recognition, expected) {
  const actions = recognition.actions || [];
  return actions.length === expected.actions.length && expected.actions.every((action, i) => actionMatches(actions[i], action));
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const ratio = (num, den) => (den ? Number((num / den).toFixed(4)) : null);

export async function runEval({ fixtures, classifier, thresholds = DEFAULT_THRESHOLDS, limit, now = () => performance.now() }) {
  const lines = limit ? fixtures.lines.slice(0, limit) : fixtures.lines;
  const results = [];
  for (const line of lines) {
    const startedAt = now();
    let recognition;
    let error = null;
    try {
      recognition = await recognizeIntent(fixtures.state, line.text, { classifier });
    } catch (err) {
      recognition = { compound: 0, actions: [] };
      error = String(err?.message || err);
    }
    const latencyMs = Math.round(now() - startedAt);
    results.push({
      id: line.id, text: line.text, category: line.category, expected: line.expected, error, latencyMs,
      predicted: recognition.actions.map(({ kind, target, item, amount, direction, confidence }) => ({ kind, target, item, amount, direction, confidence: Number((confidence ?? 0).toFixed(4)) })),
      compound: Number((recognition.compound ?? 0).toFixed(4)),
      confidence: Number(planConfidence(recognition).toFixed(4)),
      route: gateRecognition(recognition).route,
      correct: lineCorrect(recognition, line.expected),
      actions: recognition.actions,
    });
  }
  return summarize(results, thresholds);
}

export function summarize(results, thresholds = DEFAULT_THRESHOLDS) {
  const perKind = {};
  for (const result of results) {
    result.expected.actions.forEach((expected, i) => {
      const bucket = perKind[expected.kind] ||= { total: 0, kindCorrect: 0, slotCorrect: 0 };
      bucket.total++;
      if (result.actions[i]?.kind === expected.kind) bucket.kindCorrect++;
      if (actionMatches(result.actions[i], expected)) bucket.slotCorrect++;
    });
  }
  for (const bucket of Object.values(perKind)) {
    bucket.kindAccuracy = ratio(bucket.kindCorrect, bucket.total);
    bucket.fullAccuracy = ratio(bucket.slotCorrect, bucket.total);
  }
  const compoundLines = results.filter((r) => r.expected.compound);
  const splitOk = compoundLines.filter((r) => r.actions.length === r.expected.actions.length
    && r.expected.actions.every((a, i) => r.actions[i]?.kind === a.kind));
  const detectionOk = results.filter((r) => (r.compound >= 0.5) === r.expected.compound);
  const perCategory = {};
  for (const r of results) {
    const bucket = perCategory[r.category] ||= { total: 0, correct: 0 };
    bucket.total++;
    if (r.correct) bucket.correct++;
  }
  for (const bucket of Object.values(perCategory)) bucket.accuracy = ratio(bucket.correct, bucket.total);
  const atThresholds = thresholds.map((t) => {
    const covered = results.filter((r) => r.confidence >= t);
    return { threshold: t, covered: covered.length, coverage: ratio(covered.length, results.length), accuracy: ratio(covered.filter((r) => r.correct).length, covered.length) };
  });
  const latencies = results.map((r) => r.latencyMs);
  return {
    promptVersion: PROMPT_VERSION,
    total: results.length,
    overallAccuracy: ratio(results.filter((r) => r.correct).length, results.length),
    errors: results.filter((r) => r.error).length,
    perKind,
    perCategory,
    compound: { lines: compoundLines.length, splitAccuracy: ratio(splitOk.length, compoundLines.length), detectionAccuracy: ratio(detectionOk.length, results.length) },
    thresholds: atThresholds,
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    results: results.map(({ actions: _actions, ...rest }) => rest),
  };
}

const pct = (value) => (value == null ? "—" : `${(value * 100).toFixed(1)}%`);

export function toMarkdown(report, meta = {}) {
  const rows = (header, data) => [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...data.map((row) => `| ${row.join(" | ")} |`)].join("\n");
  const misses = report.results.filter((r) => !r.correct).slice(0, 30)
    .map((r) => `- ${r.id}「${r.text}」 期望 ${r.expected.actions.map((a) => a.kind).join("→")}，得到 ${r.predicted.map((a) => `${a.kind}${a.target && a.target !== "无" ? `@${a.target}` : ""}`).join("→") || "（空）"}${r.error ? `（错误：${r.error}）` : ""}`);
  return [
    `# 行动识别评测报告`,
    ``,
    `- Provider：${meta.provider || "mock"}${meta.model ? ` · 模型：${meta.model}` : ""} · 提示词版本：${report.promptVersion}`,
    `- 样本：${report.total} 条 · 整体准确率：${pct(report.overallAccuracy)} · 出错：${report.errors}`,
    `- 复合拆分准确率：${pct(report.compound.splitAccuracy)}（${report.compound.lines} 条复合）· 复合判定准确率：${pct(report.compound.detectionAccuracy)}`,
    `- 延迟：p50 ${report.latencyMs.p50} ms · p95 ${report.latencyMs.p95} ms`,
    ``,
    `## 各类准确率`,
    rows(["类别", "样本", "类别准确率", "类别+槽位准确率"], Object.entries(report.perKind).map(([kind, b]) => [kind, b.total, pct(b.kindAccuracy), pct(b.fullAccuracy)])),
    ``,
    `## 阈值覆盖率 / 准确率`,
    rows(["阈值", "覆盖条数", "覆盖率", "覆盖内准确率"], report.thresholds.map((t) => [t.threshold, t.covered, pct(t.coverage), pct(t.accuracy)])),
    ``,
    `## 按语料类型`,
    rows(["类型", "样本", "准确率"], Object.entries(report.perCategory).map(([c, b]) => [c, b.total, pct(b.accuracy)])),
    ``,
    `## 未命中（最多 30 条）`,
    misses.join("\n") || "（无）",
    ``,
  ].join("\n");
}
