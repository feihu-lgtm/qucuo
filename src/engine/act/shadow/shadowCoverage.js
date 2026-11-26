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
  // Review 修（S5）：按聚合时的计量类目戳计 comparable——旧导出（无戳=pre-S5
  // 八类目，无 world）里未测类目按「不可测」处理，不得按全 match 伪造 100% 覆盖。
  const measured = Array.isArray(agg.measuredCats)
    ? agg.measuredCats
    : SHADOW_CATEGORIES.filter((cat) => cat !== "world"); // pre-S5 导出无 world 计量
  for (const cat of SHADOW_CATEGORIES) {
    const c = agg.byCategory?.[cat] || {};
    const excluded = agg.excluded?.[cat] || 0;
    const comparable = measured.includes(cat) ? Math.max(0, turns - excluded) : 0;
    const so = c.single_only || 0, jo = c.judge_only || 0, bd = c.both_diff || 0;
    // S5 口径差：方向一致但数额差超 50%——单独统计，不计缺口不计噪声
    // （判官定量 vs 模型随写本来就不同额，方向对就算覆盖）。
    const cd = c.caliber_diff || 0;
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
      single_only: so, judge_only: jo, both_diff: bd, caliber_diff: cd,
      match: Math.max(0, comparable - so - jo - bd - cd),
      coverageRate: cat === "quest" ? null : pct(comparable - countsAsGap, comparable),
      gapRate: cat === "quest" ? null : pct(countsAsGap, comparable),
      referenceOnly: cat === "quest",
    };
  }
  const sampleList = agg.samples || [];
  const totalCaliber = Object.values(agg.byCategory || {}).reduce((n, c) => n + (c?.caliber_diff || 0), 0);
  return {
    turns, match: agg.match || 0, gaps: agg.gaps || 0, judgeExtra: agg.judgeExtra || 0,
    caliberDiffTotal: totalCaliber,
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
    // Review 修：comparable=0 即全回合盲区（如 npcs 系统改写链恒 excluded，结构性
    // 不可测）——按「不可测盲区」跳过而不是按不通过论，否则门槛永远卡死任何真实
    // 游玩样本。这与「无样本不放行」不同：coverageRate 只在 comparable>0 时可计算，
    // 可计算且低于阈值才真失败。
    if (c.comparable === 0) continue;
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
// A3：stageCounts/pendingAtExport 来自聚合 JSON 内嵌字段（A3 后导出才有）；
// 老导出没有时显式打「无 A3 计数」一行，不得报错。
export function formatCoverageReport(summary, evaluation, { stageCounts = null, pendingAtExport = 0 } = {}) {
  if (!summary) return ["无影子对账数据（dev 单调用模式游玩后重试）"];
  const lines = [];
  // A3 阶段计数表头：开始/完成/丢弃/出错/导出时在途——恒等式：
  // 开始数 = 完成数 + 丢弃数 + 出错数 + 导出时在途数。
  // （intakeFailed 为阶段级非终态失败、errorByStage 为阶段级观测，均不进恒等式。）
  if (stageCounts && stageCounts.shadowStarted) {
    const done = stageCounts.compareDone || 0;
    const dropped = (stageCounts.droppedStale || 0) + (stageCounts.droppedEpoch || 0);
    const errored = stageCounts.errorTurns || 0;
    const sum = done + dropped + errored + pendingAtExport;
    lines.push(
      `A3 阶段计数：开始 ${stageCounts.shadowStarted} · 完成 ${done} · 丢弃 ${dropped}（stale ${stageCounts.droppedStale || 0}/epoch ${stageCounts.droppedEpoch || 0}）· 出错 ${errored} · 导出时在途 ${pendingAtExport}`,
      `数量恒等：${done}+${dropped}+${errored}+${pendingAtExport}=${sum} vs 开始 ${stageCounts.shadowStarted} —— ${sum === stageCounts.shadowStarted ? "对账平" : "不平，计量有洞"}`,
      `intake 进入 ${stageCounts.intakeStarted || 0} · 完成 ${stageCounts.intakeDone || 0} · 失败但回合继续 ${stageCounts.intakeFailed || 0} · 判官产出 ${stageCounts.judgeDone || 0}`,
    );
    const errs = stageCounts.errorByStage || {};
    const stages = Object.keys(errs);
    if (stages.length) {
      lines.push("错误分类：" + stages.map((s) =>
        `${s}: ${Object.entries(errs[s]).map(([t, n]) => `${t}×${n}`).join(" ")}`).join("；"));
    }
  } else {
    lines.push("A3 阶段计数：无（旧版导出未内嵌 stageCounts——dev 重跑后重新复制聚合JSON）");
  }
  lines.push(
    `回合 ${summary.turns} · 全一致率 ${summary.matchRate === null ? "-" : `${(summary.matchRate * 100).toFixed(1)}%`} · 缺口回合率 ${summary.gapTurnRate === null ? "-" : `${(summary.gapTurnRate * 100).toFixed(1)}%`}`,
  );
  for (const [cat, c] of Object.entries(summary.categories)) {
    if (!c.comparable && !c.excluded) continue;
    const cov = c.referenceOnly ? "参考" : c.comparable === 0 ? "不可测(全盲区)" : c.coverageRate === null ? "无样本" : `${(c.coverageRate * 100).toFixed(1)}%`;
    lines.push(`${cat}：覆盖率 ${cov} · 漏判 ${c.single_only} · 会判 ${c.judge_only} · 都偏 ${c.both_diff} · 口径差 ${c.caliber_diff || 0} · 盲区 ${c.excluded}/${c.comparable + c.excluded}`);
  }
  lines.push(`噪声占比 ${summary.noise.noiseShare === null ? "无信号" : `${(summary.noise.noiseShare * 100).toFixed(0)}%`}（会判噪声 ${summary.noise.totalNoise}/${summary.noise.totalSignals} · quest参考 ${summary.noise.questReference} 不计入）`);
  lines.push(`采样 ${summary.samples.count} 句（类目命中 ${summary.samples.catHits}）${summary.samples.saturated ? " · 已达 20 句上限" : ""}`);
  if (evaluation) {
    lines.push(evaluation.pass ? "放行阈值评估：通过" : `放行阈值评估：不通过——${evaluation.failures.join("；")}`);
  }
  return lines;
}
