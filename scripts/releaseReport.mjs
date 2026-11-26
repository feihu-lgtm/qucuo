#!/usr/bin/env node
// WO-16D-4 放行指标离线报告：读取 TraceViewer「复制放行指标JSON」导出的聚合 JSON，
// 分 provider/model 输出 turn.intake schema 合格率与 ---SEAL--- 尾章合格率，
// 样本不足给出提示。阈值未最终定——本脚本只报告，退出码恒 0。
//
// 用法：npm run release:report -- <file.json>

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("用法：npm run release:report -- <file.json>（TraceViewer 复制放行指标JSON 落盘）");
  process.exit(0);
}

let data;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (err) {
  console.error(`读取失败：${err.message}`);
  process.exit(0);
}

const MIN_SAMPLE = 30; // 起步提示线（非放行阈值，只标「样本不足」）
const pct = (num, den) => (den ? `${((num / den) * 100).toFixed(1)}%` : "0.0%");

// v2：cumulative 跨会话累计桶直读；v1（旧）：跨 epoch 合并同 provider::model 桶
const intake = new Map();
const seal = new Map();
const sources = data?.version === 2
  ? [{ intake: data.cumulative?.intake || [], seal: data.cumulative?.seal || [] }]
  : Object.values(data?.epochs || {});
for (const entry of sources) {
  for (const row of entry?.intake || []) {
    const key = `${row.provider}::${row.model}`;
    if (!intake.has(key)) intake.set(key, { provider: row.provider, model: row.model, calls: 0, schemaOk: 0, parseFailed: 0, validateFailed: 0, otherFailed: 0 });
    const acc = intake.get(key);
    for (const f of ["calls", "schemaOk", "parseFailed", "validateFailed", "otherFailed"]) acc[f] += row[f] || 0;
  }
  for (const row of entry?.seal || []) {
    // B0：chain 维度分桶——判官/群聊分列评估；旧行无 chain 归并 judge（不丢旧样本）。
    const chain = row.chain || "judge";
    const key = `${row.provider}::${row.model}::${chain}`;
    if (!seal.has(key)) seal.set(key, { provider: row.provider, model: row.model, chain, total: 0, withSeal: 0, missingSeal: 0, jsonOk: 0, jsonFailed: 0, passed: 0, failed: 0 });
    const acc = seal.get(key);
    for (const f of ["total", "withSeal", "missingSeal", "jsonOk", "jsonFailed", "passed", "failed"]) acc[f] += row[f] || 0;
  }
}

console.log("# 放行指标离线报告（跨 epoch 累计）\n");
console.log("## turn.intake Schema 合格率");
if (!intake.size) console.log("（无样本）");
for (const r of intake.values()) {
  const thin = r.calls < MIN_SAMPLE ? ` ⚠ 样本不足（${r.calls}<${MIN_SAMPLE}）` : "";
  console.log(`- ${r.provider}/${r.model}: 调用 ${r.calls} · 通过 ${r.schemaOk}（${pct(r.schemaOk, r.calls)}）· 解析失败 ${r.parseFailed} · 校验失败 ${r.validateFailed} · 其他 ${r.otherFailed}${thin}`);
}
for (const chain of ["judge", "group"]) {
  const rows = [...seal.values()].filter((r) => r.chain === chain);
  console.log(`\n## ---SEAL--- ${chain === "judge" ? "判官" : "群聊"}尾章合格率`);
  if (!rows.length) { console.log("（无样本）"); continue; }
  for (const r of rows) {
    const thin = r.total < MIN_SAMPLE ? ` ⚠ 样本不足（${r.total}<${MIN_SAMPLE}）` : "";
    console.log(`- ${r.provider}/${r.model}: 回合 ${r.total} · 有尾章 ${r.withSeal}/缺 ${r.missingSeal} · JSON可解析 ${r.jsonOk} · 通过 ${r.passed}（${pct(r.passed, r.total)}）· 失败 ${r.failed}${thin}`);
  }
}

// ── B0 阈值评估（协调者在 B2 前登记的初始线，不许为放行下调）──────────────
// intake schema 合格率 ≥ 98%（schemaOk/calls）
// intake 调用成功率 ≥ 99%（(calls-otherFailed)/calls；parse/validate 失败算调用成功但 schema 不过）
// 判官尾章合格率 ≥ 98%（passed/total）；群聊尾章合格率 ≥ 98%（群聊自己的 passed/total）
export const RELEASE_THRESHOLDS_B0 = {
  intakeSchemaPassRate: 0.98,
  intakeCallSuccessRate: 0.99,
  judgeSealPassRate: 0.98,
  groupSealPassRate: 0.98,
};

const failures = [];
for (const r of intake.values()) {
  if (!r.calls) continue;
  const schemaRate = r.schemaOk / r.calls;
  const callRate = (r.calls - r.otherFailed) / r.calls;
  if (schemaRate < RELEASE_THRESHOLDS_B0.intakeSchemaPassRate) {
    failures.push(`intake schema 合格率 ${r.provider}/${r.model}: ${pct(r.schemaOk, r.calls)} < 98%`);
  }
  if (callRate < RELEASE_THRESHOLDS_B0.intakeCallSuccessRate) {
    failures.push(`intake 调用成功率 ${r.provider}/${r.model}: ${pct(r.calls - r.otherFailed, r.calls)} < 99%`);
  }
}
for (const chain of ["judge", "group"]) {
  const threshold = chain === "judge" ? RELEASE_THRESHOLDS_B0.judgeSealPassRate : RELEASE_THRESHOLDS_B0.groupSealPassRate;
  for (const r of [...seal.values()].filter((x) => x.chain === chain)) {
    if (!r.total) continue;
    const rate = r.passed / r.total;
    if (rate < threshold) {
      failures.push(`${chain === "judge" ? "判官" : "群聊"}尾章合格率 ${r.provider}/${r.model}: ${pct(r.passed, r.total)} < 98%（样本 ${r.total} 回合如实计入）`);
    }
  }
}

console.log("\n## 阈值评估（B0 登记线，禁止为放行下调）");
console.log(`- intake schema 合格率 ≥ 98% · 调用成功率 ≥ 99% · 判官尾章 ≥ 98% · 群聊尾章 ≥ 98%`);
if (!failures.length) {
  console.log("- 全部通过 ✅");
  process.exit(0);
} else {
  for (const f of failures) console.log(`- 未过：${f}`);
  process.exit(2);
}
