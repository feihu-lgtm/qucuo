// 放行指标观测（dev / 全流程日志只读聚合）：
// 统计 turn.intake schema 合格率与 ---SEAL--- 尾章合格率，按 provider/model 与
// save epoch 隔离聚合；production 默认禁用且零噪音，绝不记录 API key 或正文，
// 不写 gameStore、不进 varTree/存档事实账、不进 prompt、不影响玩家行为。
//
// WO-16D-4 持久层选型：localStorage 独立键 qc_release_metrics_v1。
// 理由——放行要求 intake/SEAL 按 provider 统计达阈值，样本必须跨 dev 会话累计；
// 聚合行只有 provider/model/epoch/计数（几十字节×桶数），localStorage 同步、
// 跨刷新不丢、容量可控；IndexedDB 异步事务对这份小数据是杀鸡用牛刀，
// 且 dev 工具链里它承载的是正文段落（绝不能与指标混库）。写穿式持久化：
// 每次 record 后整棵聚合树重序列化（数据量极小，dev 低频，成本可忽略）。

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

// ── WO-16D-4 持久层（localStorage 独立键，容量受控）─────────────────────
export const RELEASE_METRICS_STORAGE_KEY = "qc_release_metrics_v1";
const KEEP_EPOCHS = 10; // 最多保留最近写入的 epoch 数——超限逐最旧
const BYTE_CAP = 180 * 1024; // 硬顶 ~180KB，远小于 localStorage 常规 5MB 配额

let storageOverrideForTest = null;
export function _setReleaseMetricsStorageForTest(storage) {
  storageOverrideForTest = storage;
  loadedFromStorage = false; // 换存储后重新水合
}

function resolveStorage() {
  if (storageOverrideForTest !== null) return storageOverrideForTest;
  try {
    return typeof globalThis !== "undefined" ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

let loadedFromStorage = false;

// 水合：启动后首次访问把持久层并入内存（内存优先——同 epoch 同桶计数取大者无意义，
// 因为写穿保证持久层恒为内存超集或同等；这里只做「持久层 → 内存」单向灌入）。
function hydrate() {
  if (loadedFromStorage) return;
  loadedFromStorage = true;
  const storage = resolveStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(RELEASE_METRICS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    for (const [epoch, entry] of Object.entries(parsed?.epochs || {})) {
      if (!epochStore.has(epoch)) epochStore.set(epoch, { intake: new Map(), seal: new Map() });
      const target = epochStore.get(epoch);
      for (const [key, row] of Object.entries(entry?.intake || {})) if (!target.intake.has(key)) target.intake.set(key, row);
      for (const [key, row] of Object.entries(entry?.seal || {})) if (!target.seal.has(key)) target.seal.set(key, row);
    }
  } catch { /* 持久层损坏静默放弃——dev 观测绝不阻塞游戏 */ }
}

// 容量截断统一在这里：epoch 数上限（插入序最旧先丢）+字节硬顶兜底——
// persist 与 export 共用同一棵树，导出即持久层口径。
function cappedEpochsList() {
  const epochs = {};
  for (const [epoch, entry] of epochStore.entries()) {
    epochs[epoch] = {
      intake: Object.fromEntries(entry.intake),
      seal: Object.fromEntries(entry.seal),
    };
  }
  const keys = Object.keys(epochs);
  if (keys.length > KEEP_EPOCHS) {
    for (const old of keys.slice(0, keys.length - KEEP_EPOCHS)) delete epochs[old];
  }
  let payload = JSON.stringify({ version: 1, epochs });
  while (payload.length > BYTE_CAP && Object.keys(epochs).length > 1) {
    delete epochs[Object.keys(epochs)[0]];
    payload = JSON.stringify({ version: 1, epochs });
  }
  return epochs;
}

function persist() {
  const storage = resolveStorage();
  if (!storage) return;
  try {
    storage.setItem(RELEASE_METRICS_STORAGE_KEY, JSON.stringify({ version: 1, epochs: cappedEpochsList() }));
  } catch { /* 配额满/隐私模式静默——观测绝不阻塞 */ }
}

// 导出全量聚合（跨 epoch），shape 供 scripts/releaseReport.mjs 离线消费。
export function releaseMetricsExport() {
  hydrate();
  const capped = cappedEpochsList();
  const epochs = {};
  for (const [epoch, entry] of Object.entries(capped)) {
    epochs[epoch] = {
      intake: Object.values(entry.intake || {}).map((r) => ({ ...r })),
      seal: Object.values(entry.seal || {}).map((r) => ({ ...r })),
    };
  }
  return { version: 1, epochs };
}

function getBucketMap(epoch, section) {
  const key = String(epoch ?? "default");
  if (!epochStore.has(key)) {
    epochStore.set(key, { intake: new Map(), seal: new Map() });
  }
  return epochStore.get(key)[section];
}

export function _resetReleaseMetrics() {
  epochStore.clear();
  const storage = resolveStorage();
  try { storage?.removeItem(RELEASE_METRICS_STORAGE_KEY); } catch { /* ignore */ }
}

export function recordIntakeMetric({ epoch = "default", cfg, outcome } = {}) {
  if (!resolveReleaseMetricsEnabled()) return;
  hydrate();
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
  persist();
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
  hydrate();
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
  persist();
}

export function releaseMetricAggregates(epoch = "default") {
  hydrate();
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
