#!/usr/bin/env node
// WO-16D-1 影子对账覆盖率报告（只读观测脚本）
// 用法：
//   node scripts/shadowCoverageReport.mjs <聚合JSON文件>
//   node scripts/shadowCoverageReport.mjs --demo     打印示例报告（形状演示）
// 聚合 JSON 来源：dev 单调用模式游玩后，在「全流程日志 → 影子对账聚合」面板
// 点「复制聚合JSON」粘贴存盘。脚本绝不触网、不写文件、不改游戏状态。
import { readFileSync } from "node:fs";
import { summarizeShadowCoverage, evaluateShadowThresholds, formatCoverageReport } from "../src/engine/act/shadow/shadowCoverage.js";

const arg = process.argv[2];
let agg;
if (arg === "--demo" || !arg) {
  agg = {
    turns: 240, match: 200, gaps: 18, judgeExtra: 22,
    byCategory: {
      inv: { single_only: 6, judge_only: 4 },
      flags: { single_only: 2 },
      affection: { single_only: 3, judge_only: 9, both_diff: 1 },
      npcs: { judge_only: 2 },
      vitals: { single_only: 1 },
      quest: { single_only: 5, judge_only: 3 },
    },
    excluded: { npcs: 60 },
    samples: [{ key: "x", cats: ["inv"], cmd: "偷取掌柜的钱袋" }],
  };
  if (!arg) console.error("提示：未传文件，展示 --demo 示例。用法：node scripts/shadowCoverageReport.mjs <聚合JSON文件>\n");
} else {
  try {
    agg = JSON.parse(readFileSync(arg, "utf8"));
  } catch (e) {
    console.error(`读取失败：${e.message}`);
    process.exit(1);
  }
}
const summary = summarizeShadowCoverage(agg);
const evaluation = evaluateShadowThresholds(summary);
// A3：聚合 JSON 内嵌 stageCounts/pendingAtExport 透传给报告；老导出没有时报告内显式标注。
console.log(formatCoverageReport(summary, evaluation, { stageCounts: agg?.stageCounts || null, pendingAtExport: agg?.pendingAtExport || 0 }).join("\n"));
process.exit(evaluation.pass ? 0 : 2);
