// A4 打包前口令/密钥扫描 + 原始留底打包。
// 规则：最终有效批次的 ai_calls_*.jsonl 原始记录必须进 artifact 包，派生文件不能替代；
// 打包前全量扫描，命中口令/密钥形状即拒绝打包（宁可误报不可漏放）。
//
// 用法：node scripts/sampling/scanPack.mjs [artifactsDir] [outTar]
//   环境变量 SAMPLING_KNOWN_KEY：若提供，额外扫描该确切字符串（口令本体的精确匹配）。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ART = process.argv[2] || `${process.env.HOME}/.sampling/artifacts`;
const OUT = process.argv[3] || `${ART}.tar.gz`;

const PATTERNS = [
  { name: "openai-sk", re: /sk-[A-Za-z0-9_\-]{16,}/ },
  { name: "bearer-token", re: /Bearer\s+[A-Za-z0-9_\-.]{12,}/i },
  { name: "auth-header-literal", re: /"authorization"\s*[:=]/i },
  { name: "api-key-field", re: /"api[_-]?key"\s*:\s*"[^"]{8,}"/i },
  { name: "generic-secret", re: /(secret|password|passwd|token)\s*[:=]\s*["'][A-Za-z0-9_\-.]{12,}["']/i },
];
if (process.env.SAMPLING_KNOWN_KEY) {
  const k = process.env.SAMPLING_KNOWN_KEY;
  PATTERNS.push({ name: "exact-key", re: new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
}

function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function scanDir(dir = ART) {
  const hits = [];
  for (const p of walk(dir)) {
    if (/\.(png|jpg|webp|mp4|gz)$/i.test(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const { name, re } of PATTERNS) {
      const m = text.match(re);
      // 命中不外泄任何字符——只记文件/形状/匹配长度，短 key 也不会被全文打出
      if (m) hits.push({ file: p, pattern: name, matchLen: m[0].length });
    }
  }
  return hits;
}

if (process.argv[1] && process.argv[1].endsWith("scanPack.mjs")) {
  const hits = scanDir();
  if (hits.length) {
    console.error(`密钥扫描未过，拒绝打包（${hits.length} 处命中）：`);
    for (const h of hits) console.error(`  ${h.file} :: ${h.pattern} :: len=${h.matchLen}`);
    process.exit(1);
  }
  // 必备原件检查：至少一份 ai_calls*.jsonl 在场
  const raw = walk(ART).filter((p) => /ai_calls.*\.jsonl$/.test(p));
  if (!raw.length) {
    console.error("缺少原始调用记录 ai_calls*.jsonl——派生文件不能替代原件，拒绝打包");
    process.exit(1);
  }
  execSync(`tar -czf ${JSON.stringify(OUT)} -C ${JSON.stringify(ART)} .`, { stdio: "inherit" });
  console.log(`扫描通过（含 ${raw.length} 份原始调用记录），已打包 → ${OUT}`);
}
