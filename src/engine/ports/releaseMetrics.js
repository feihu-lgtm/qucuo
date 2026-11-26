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
// 复审裁决：gameEpoch 每次页面加载归零（gameStore.js gameEpoch 计数器），
// 跨会话/persistence 语义里 epoch 键毫无区分度——同号不同存档会混账、
// 插入序 eviction 会把新样本当旧的丢。故持久层只按 provider::model 累计
// （放行阈值本来就是按 provider 统计），epoch 维度只保留在内存供本存档
// TraceViewer 展示，绝不进持久层。
export const RELEASE_METRICS_STORAGE_KEY = "qc_release_metrics_v1";
const BYTE_CAP = 180 * 1024; // 硬顶 ~180KB（实际累计桶极少，远用不到）

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

function getBucketMap(epoch, section) {
  const key = String(epoch ?? "default");
  if (!epochStore.has(key)) {
    epochStore.set(key, { intake: new Map(), seal: new Map() });
  }
  return epochStore.get(key)[section];
}

let loadedFromStorage = false;
// 本页会话自己录的增量（跨标签合并写的基底——每个标签只把自己的增量加回去，
// 绝不整树覆盖，别的标签样本不丢）。
const ownDeltas = { intake: new Map(), seal: new Map() };

function bumpOwn(section, key, row) {
  if (!ownDeltas[section].has(key)) ownDeltas[section].set(key, { ...row, ...Object.fromEntries(Object.keys(row).filter((k) => typeof row[k] === "number").map((k) => [k, 0])) });
  const acc = ownDeltas[section].get(key);
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "number") acc[k] = (acc[k] || 0) + v;
  }
}

// 行合并：数值字段求和，provider/model 取入参（同 key 必同值）。
function mergeRowInto(target, delta) {
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v === "number") target[k] = (target[k] || 0) + v;
    else if (target[k] === undefined) target[k] = v;
  }
}

function blankIntakeRow(provider, model) {
  return { provider, model, calls: 0, schemaOk: 0, parseFailed: 0, validateFailed: 0, otherFailed: 0 };
}
function blankSealRow(provider, model, chain = "judge") {
  return { provider, model, chain, total: 0, withSeal: 0, missingSeal: 0, jsonOk: 0, jsonFailed: 0, passed: 0, failed: 0 };
}

function readCumulative(storage) {
  try {
    const raw = storage?.getItem(RELEASE_METRICS_STORAGE_KEY);
    if (!raw) return { intake: {}, seal: {} };
    const parsed = JSON.parse(raw);
    // v1（epoch 分桶）旧数据直接放弃——epoch 无跨会话语义，混进来反而失真
    if (parsed?.version !== 2) return { intake: {}, seal: {} };
    const seal = {};
    for (const [k, row] of Object.entries(parsed.cumulative?.seal || {})) {
      // B0：chain 维度——旧行无 chain 按 judge 归并（键也随之带 chain 后缀，防与新键冲突）
      const chain = row.chain || "judge";
      const key = k.includes("::", k.indexOf("::") + 2) ? k : `${k}::${chain}`;
      seal[key] = { ...row, chain };
    }
    return { intake: parsed.cumulative?.intake || {}, seal };
  } catch {
    return { intake: {}, seal: {} };
  }
}

// 水合：启动后首次访问把持久层累计桶并入内存「跨会话累计」视图
// （进 epochStore 的 "__cumulative__" 虚拟 epoch——仅供 export/报告，不进 UI 本存档口径）。
export const CUMULATIVE_EPOCH = "__cumulative__";

function hydrate() {
  if (loadedFromStorage) return;
  loadedFromStorage = true;
  const storage = resolveStorage();
  if (!storage) return;
  const cumulative = readCumulative(storage);
  if (!Object.keys(cumulative.intake).length && !Object.keys(cumulative.seal).length) return;
  if (!epochStore.has(CUMULATIVE_EPOCH)) epochStore.set(CUMULATIVE_EPOCH, { intake: new Map(), seal: new Map() });
  const target = epochStore.get(CUMULATIVE_EPOCH);
  for (const [key, row] of Object.entries(cumulative.intake)) if (!target.intake.has(key)) target.intake.set(key, row);
  for (const [key, row] of Object.entries(cumulative.seal)) if (!target.seal.has(key)) target.seal.set(key, row);
}

// 写穿：读-合-写——每个标签只把自己的增量加进最新存储值，多标签互不覆盖。
function persist() {
  const storage = resolveStorage();
  if (!storage) return;
  try {
    const cumulative = readCumulative(storage);
    for (const [key, delta] of ownDeltas.intake) {
      if (!cumulative.intake[key]) cumulative.intake[key] = blankIntakeRow(delta.provider, delta.model);
      mergeRowInto(cumulative.intake[key], delta);
    }
    for (const [key, delta] of ownDeltas.seal) {
      if (!cumulative.seal[key]) cumulative.seal[key] = blankSealRow(delta.provider, delta.model, delta.chain || "judge");
      mergeRowInto(cumulative.seal[key], delta);
    }
    const payload = JSON.stringify({ version: 2, cumulative });
    // 字节硬顶兜底：超限则放弃本次写入（累计桶正常远小于此，真超了说明异常）。
    // 复审裁决：只有写入真的成功才清零增量——配额满/超限/隐私模式抛错时
    // 增量留在 ownDeltas，下次 persist/export 仍会带上，样本不丢。
    if (payload.length > BYTE_CAP) return;
    storage.setItem(RELEASE_METRICS_STORAGE_KEY, payload);
    ownDeltas.intake.clear();
    ownDeltas.seal.clear();
  } catch { /* 配额满/隐私模式静默——增量未清零，观测样本不丢 */ }
}

// 导出跨会话累计聚合，shape 供 scripts/releaseReport.mjs 离线消费。
// 无 epoch 维——epoch 无跨会话语义；report 脚本兼容旧 v1 epochs shape。
export function releaseMetricsExport() {
  hydrate();
  const storage = resolveStorage();
  const stored = readCumulative(storage);
  // 内存里尚未写穿的增量也并入导出（导出即最新口径）
  const intake = {};
  const seal = {};
  for (const [key, row] of Object.entries(stored.intake)) intake[key] = { ...row };
  for (const [key, row] of Object.entries(stored.seal)) seal[key] = { ...row };
  for (const [key, delta] of ownDeltas.intake) {
    if (!intake[key]) intake[key] = blankIntakeRow(delta.provider, delta.model);
    mergeRowInto(intake[key], delta);
  }
  for (const [key, delta] of ownDeltas.seal) {
    if (!seal[key]) seal[key] = blankSealRow(delta.provider, delta.model, delta.chain || "judge");
    mergeRowInto(seal[key], delta);
  }
  return {
    version: 2,
    cumulative: {
      intake: Object.values(intake).map((r) => ({ ...r })),
      seal: Object.values(seal).map((r) => ({ ...r })),
    },
  };
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
  bumpOwn("intake", key, { provider, model, calls: 1, schemaOk: outcome === "schemaOk" ? 1 : 0, parseFailed: outcome === "parseFailed" ? 1 : 0, validateFailed: outcome === "validateFailed" ? 1 : 0, otherFailed: ["schemaOk", "parseFailed", "validateFailed"].includes(outcome) ? 0 : 1 });
  persist();
}

export function recordSealMetric({
  epoch = "default",
  cfg,
  chain = "judge",
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
  const { provider, model, key: pmKey } = resolveProviderModel(cfg);
  // B0：chain 维度——判官尾章 judge/群聊尾章 group 分桶分列，互不稀释合格率。
  const key = `${pmKey}::${chain}`;
  const map = getBucketMap(epoch, "seal");
  if (!map.has(key)) {
    map.set(key, { provider, model, chain, total: 0, withSeal: 0, missingSeal: 0, jsonOk: 0, jsonFailed: 0, passed: 0, failed: 0 });
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
  bumpOwn("seal", key, { provider, model, chain, total: 1, withSeal: hasSeal ? 1 : 0, missingSeal: hasSeal ? 0 : 1, jsonOk: hasSeal && sealData ? 1 : 0, jsonFailed: hasSeal && !sealData ? 1 : 0, passed: passed ? 1 : 0, failed: passed ? 0 : 1 });
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
    lines.push(`SEAL[${r.provider}/${r.model}/${r.chain || "judge"}] 回合 ${r.total} · 有尾章 ${r.withSeal}/缺尾章 ${r.missingSeal} · JSON可解析 ${r.jsonOk} · 通过 ${r.passed}（${pct(r.passed, r.total)}）· 失败 ${r.failed}`);
  }
  return lines;
}

export function formatReleaseGateMarkdown({ epoch = "default", shadowAgg = null, metricsAgg = null, stageCounts = null, pendingAtExport = 0 } = {}) {
  const parts = [`## 放行指标观测报告（epoch ${String(epoch)}）`];

  // A3 阶段计数表头：开始/完成/丢弃/出错/导出时在途——恒等口径：
  // 开始数 = 完成数 + 丢弃数 + 出错数 + 导出时在途数。
  // （intakeFailed 为阶段级非终态失败，回合继续，不进恒等式；errorByStage 同。）
  if (stageCounts && stageCounts.shadowStarted) {
    const done = stageCounts.compareDone || 0;
    const dropped = (stageCounts.droppedStale || 0) + (stageCounts.droppedEpoch || 0);
    const errored = stageCounts.errorTurns || 0;
    const sum = done + dropped + errored + pendingAtExport;
    parts.push("", "### 0. A3 影子阶段计数",
      "| 开始数 | 完成数 | 丢弃数 | 出错数 | 导出时在途数 |", "|---:|---:|---:|---:|---:|",
      `| ${stageCounts.shadowStarted} | ${done} | ${dropped} | ${errored} | ${pendingAtExport} |`,
      `数量恒等：${done}+${dropped}+${errored}+${pendingAtExport}=${sum} vs 开始 ${stageCounts.shadowStarted} —— ${sum === stageCounts.shadowStarted ? "对账平" : "不平，计量有洞"}`,
      `intake 进入 ${stageCounts.intakeStarted || 0} · 完成 ${stageCounts.intakeDone || 0} · 失败但回合继续 ${stageCounts.intakeFailed || 0} · 判官产出 ${stageCounts.judgeDone || 0}`,
      `丢弃明细：stale ${stageCounts.droppedStale || 0} / epoch ${stageCounts.droppedEpoch || 0}`);
    const errs = stageCounts.errorByStage || {};
    const stages = Object.keys(errs);
    if (stages.length) {
      parts.push("错误分类：" + stages.map((s) =>
        `${s}: ${Object.entries(errs[s]).map(([t, n]) => `${t}×${n}`).join(" ")}`).join("；"));
    }
  }

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
  // B0：判官尾章/群聊尾章分列——阈值按各自 chain 独立评估，互不稀释。
  for (const chain of ["judge", "group"]) {
    const rows = seal.filter((r) => (r.chain || "judge") === chain);
    const title = chain === "judge" ? "### 3. ---SEAL--- 判官尾章合格率" : "### 4. ---SEAL--- 群聊尾章合格率";
    parts.push("", title);
    if (!rows.length) {
      parts.push(chain === "judge" ? "暂无判官尾章采样。" : "暂无群聊尾章采样。");
      continue;
    }
    parts.push("| Provider | Model | 总回合 | 有尾章 | 缺尾章 | JSON 可解析 | 校验通过 | 校验失败 | 合格率 |",
      "|---|---|---:|---:|---:|---:|---:|---:|---:|");
    for (const r of rows) {
      parts.push(`| ${r.provider} | ${r.model} | ${r.total} | ${r.withSeal} | ${r.missingSeal} | ${r.jsonOk} | ${r.passed} | ${r.failed} | ${pct(r.passed, r.total)} |`);
    }
  }

  return parts.join("\n");
}
