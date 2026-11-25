// WO-16D-1 影子对账覆盖率摘要（纯函数·只读观测）
// 输入 shadowAggregates(epoch) 聚合形状，输出覆盖率/字段分布/噪声占比与放行阈值评估。
// 口径定义（与 docs/AI调用链架构说明.md 一致）：
//   comparable(cat) = turns - excluded[cat]        该类目本轮可对比的回合数
//   coverageRate    = 1 - single_only/comparable   判官对单调用实际生效账目的覆盖率
//   gapRate         = single_only/comparable       漏判率（放行核心门槛）
//   noiseShare      = 低价值信号占全部非一致信号比——judge_only（判官会判但单调用
//                     没落账，多半非 bug 的人工甄别噪声）+ quest reference-only，
//                     噪声占比越高，自动化放行越不可信、越需人工复核。
// 不改游戏行为：本模块纯读聚合，绝不写状态、不进 prompt。

import { SHADOW_CATEGORIES } from "./shadowTaxonomy.js";

const pct = (n, d) => (d > 0 ? n / d : null);

export function summarizeShadowCoverage(agg) {
  if (!agg || !agg.turns) return null;
  const turns = agg.turns;
  const categories = {};
  let totalGaps = 0, totalNoise = 0, totalSignals = 0;
  for (const cat of SHADOW_CATEGORIES) {
    const c = agg.byCategory?.[cat] || {};
    const excluded = agg.excluded?.[cat] || 0;
    const comparable = Math.max(0, turns - excluded);
    const so = c.single_only || 0, jo = c.judge_only || 0, bd = c.both_diff || 0;
    // quest 为 reference-only：不计入漏判缺口、不计入覆盖率——记为人工甄别噪声。
    const countsAsGap = cat === "quest" ? 0 : so;
    // quest reference-only 整体不进噪声门也不进信号总数——它天生是人工甄别参考
    // （状态驱动归因不可靠），若计入会把噪声占比恒推向高位，阈值失去分辨力。
    // 噪声口径 = judge_only（判官会判但单调用未落，多半非 bug）占可对比信号比。
    const noise = cat === "quest" ? 0 : jo;
    const signals = cat === "quest" ? 0 : so + jo + bd;
    totalGaps += countsAsGap;
    totalNoise += noise;
    totalSignals += signals;
    if (cat === "quest") totalNoise += 0; // 显式不计——保留注释位防回退
    categories[cat] = {
      comparable, excluded,
      single_only: so, judge_only: jo, both_diff: bd,
      match: Math.max(0, comparable - so - jo - bd),
      coverageRate: cat === "quest" ? null : pct(comparable - countsAsGap, comparable),
      gapRate: cat === "quest" ? null : pct(countsAsGap, comparable),
      referenceOnly: cat === "quest",
    };
  }
  const sampleList = agg.samples || [];
  return {
    turns, match: agg.match || 0, gaps: agg.gaps || 0, judgeExtra: agg.judgeExtra || 0,
    matchRate: pct(agg.match || 0, turns),
    gapTurnRate: pct(agg.gaps || 0, turns),
    categories,
    noise: {
      totalSignals, totalGaps, totalNoise,
      questReference: (agg.byCategory?.quest?.single_only || 0) + (agg.byCategory?.quest?.judge_only || 0) + (agg.byCategory?.quest?.both_diff || 0),
      // 低价值噪声占比：噪声 / 全部非一致信号；无信号时为 null（数据不足不瞎报）。
      noiseShare: totalSignals > 0 ? totalNoise / totalSignals : null,
    },
    samples: {
      count: sampleList.length,
      // 测试噪声观测：采样被少数 cmd 刷屏时 dedup 后句数远小于类目命中总数，
      // 说明缺口集中在个别指令类型——修复收益集中，放行评估可参考。
      catHits: sampleList.reduce((n, s) => n + (s.cats?.length || 1), 0),
      cap: 20,
      saturated: sampleList.length >= 20,
    },
  };
}

// 放行阈值建议默认档（docs 同步，调整需过评审）：
//   样本量 >= 200 回合                       小样本不放行
//   每计入类目覆盖率 >= 95%                   判官漏判极少
//   回合级缺口率 <= 5%                        整体漏判回合占比
//   噪声占比 <= 60%                           噪声过高说明数据不可信，需人工
// 口径：coverageRate 为 null 的类目（样本不足）按不通过论——宁可不放行不错放行。
export const DEFAULT_RELEASE_THRESHOLDS = { minTurns: 200, minCoverage: 0.95, maxGapTurnRate: 0.05, maxNoiseShare: 0.6 };

export function evaluateShadowThresholds(summary, thresholds = DEFAULT_RELEASE_THRESHOLDS) {
  if (!summary) return { pass: false, failures: ["无聚合数据"] };
  const failures = [];
  if (summary.turns < thresholds.minTurns) {
    failures.push(`样本不足：${summary.turns}/${thresholds.minTurns} 回合`);
  }
  for (const [cat, c] of Object.entries(summary.categories)) {
    if (c.referenceOnly) continue;
    if (c.coverageRate === null || c.coverageRate < thresholds.minCoverage) {
      failures.push(`${cat} 覆盖率 ${c.coverageRate === null ? "无样本" : `${(c.coverageRate * 100).toFixed(1)}%`} < ${(thresholds.minCoverage * 100).toFixed(0)}%`);
    }
  }
  if (summary.gapTurnRate !== null && summary.gapTurnRate > thresholds.maxGapTurnRate) {
    failures.push(`回合缺口率 ${(summary.gapTurnRate * 100).toFixed(1)}% > ${(thresholds.maxGapTurnRate * 100).toFixed(0)}%`);
  }
  if (summary.noise.noiseShare !== null && summary.noise.noiseShare > thresholds.maxNoiseShare) {
    failures.push(`噪声占比 ${(summary.noise.noiseShare * 100).toFixed(0)}% > ${(thresholds.maxNoiseShare * 100).toFixed(0)}%——人工甄别比例过高`);
  }
  return { pass: failures.length === 0, failures };
}

// 文本报告行数组——npm script 与复制文本共用。
export function formatCoverageReport(summary, evaluation) {
  if (!summary) return ["无影子对账数据（dev 单调用模式游玩后重试）"];
  const lines = [
    `回合 ${summary.turns} · 全一致率 ${summary.matchRate === null ? "-" : `${(summary.matchRate * 100).toFixed(1)}%`} · 缺口回合率 ${summary.gapTurnRate === null ? "-" : `${(summary.gapTurnRate * 100).toFixed(1)}%`}`,
  ];
  for (const [cat, c] of Object.entries(summary.categories)) {
    if (!c.comparable && !c.excluded) continue;
    const cov = c.referenceOnly ? "参考" : c.coverageRate === null ? "无样本" : `${(c.coverageRate * 100).toFixed(1)}%`;
    lines.push(`${cat}：覆盖率 ${cov} · 漏判 ${c.single_only} · 会判 ${c.judge_only} · 都偏 ${c.both_diff} · 盲区 ${c.excluded}/${c.comparable + c.excluded}`);
  }
  lines.push(`噪声占比 ${summary.noise.noiseShare === null ? "无信号" : `${(summary.noise.noiseShare * 100).toFixed(0)}%`}（会判噪声 ${summary.noise.totalNoise}/${summary.noise.totalSignals} · quest参考 ${summary.noise.questReference} 不计入）`);
  lines.push(`采样 ${summary.samples.count} 句（类目命中 ${summary.samples.catHits}）${summary.samples.saturated ? " · 已达 20 句上限" : ""}`);
  if (evaluation) {
    lines.push(evaluation.pass ? "放行阈值评估：通过" : `放行阈值评估：不通过——${evaluation.failures.join("；")}`);
  }
  return lines;
}
