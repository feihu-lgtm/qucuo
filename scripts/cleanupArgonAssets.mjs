#!/usr/bin/env node
// A2：合并部署后的资产清理——只删「7 天前」且「不被最近三版 manifest 引用」的资源。
// 用法：node scripts/cleanupArgonAssets.mjs <targetDir> [--now=<ms>]（--now 供测试注入）。
import { readdirSync, statSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { join, relative } from "node:path";

export function collectReferencedAssets(targetDir) {
  // 最近三版 manifest（.deploy-manifests/<ts>.json，文件名即时间戳序）引用资产并集。
  const dir = join(targetDir, ".deploy-manifests");
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().slice(-3); } catch { files = []; }
  const refs = new Set();
  for (const f of files) {
    try {
      const m = JSON.parse(readFileSync(join(dir, f), "utf8"));
      for (const a of m.assets || []) refs.add(a);
    } catch { /* 坏 manifest 不贡献引用集 */ }
  }
  return refs;
}

export function sweepAssets(targetDir, { now = Date.now(), maxAgeMs = 7 * 24 * 3600 * 1000 } = {}) {
  const refs = collectReferencedAssets(targetDir);
  const assetsDir = join(targetDir, "assets");
  const removed = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const fp = join(dir, e);
      const st = statSync(fp);
      if (st.isDirectory()) { walk(fp); continue; }
      const rel = relative(targetDir, fp).split("\\").join("/");
      if (refs.has(rel)) continue; // 最近三版仍在引用——保
      if (now - st.mtimeMs < maxAgeMs) continue; // 未满 7 天——保
      unlinkSync(fp);
      removed.push(rel);
    }
    // 空目录顺手收（忽略非空报错）。
    try { rmdirSync(dir); } catch { /* 非空 */ }
  };
  walk(assetsDir);
  return removed;
}

if (process.argv[1] && process.argv[1].endsWith("cleanupArgonAssets.mjs")) {
  const target = process.argv[2];
  if (!target) { console.error("usage: cleanupArgonAssets.mjs <targetDir>"); process.exit(1); }
  const nowArg = process.argv.find((a) => a.startsWith("--now="));
  const now = nowArg ? Number(nowArg.slice(6)) : Date.now();
  const removed = sweepAssets(target, { now });
  if (removed.length) console.log(`[qucuo-cleanup] removed ${removed.length} stale asset(s)`);
}
