// A3 影子判官阶段计数与导出前收口（纯观测·dev 限定）
// 口径定义（与 docs/AI调用链架构说明.md 同步）：
//   shadowStarted   影子任务进入 runShadowJudge 计数（含随即因开关/双调用短路返回的——
//                   这两种在进计数前已排除，见 instrumented 入口顺序）
//   intakeStarted   进入 intake 阶段（含本地合成路径——合成即完成，不调 AI）
//   intakeDone      intake 阶段完成（AI 调用成功或本地合成成功）
//   intakeFailed    intake AI 调用失败但回合继续（throwOnError:false 空手 normalized）
//   judgeDone       judgeTurn 产出 verdict
//   compareDone     compareCategories 完成——终态「完成数」
//   droppedStale    因 isStale 丢弃——终态「丢弃数」子项
//   droppedEpoch    因 epochGuard/换档丢弃——终态「丢弃数」子项
//   errorTurns      catch 到异常整单终止——终态「出错数」
//   pendingAtExport 导出时仍在途（drain 超时）——终态「导出时在途数」
// 恒等式：shadowStarted = compareDone + droppedStale + droppedEpoch + errorTurns + pendingNow
//   （pendingNow 为当前在途；导出时 drain 后仍未结束的计入 pendingAtExport）
// errorByStage：阶段级观测（stage → { 错误类型: 次数 }），含非终态失败（如 intake
//   失败但回合继续），不参与恒等式。只记错误类型名（constructor.name），不记正文/密钥。
// 硬约束：dev 限定（resolveShadowJudgeEnabled 同闸）；不碰持久层；零玩家可见行为变化。

const stageAgg = new Map(); // epoch -> counters
let inflight = 0; // 全局在途计数（epoch 维度无跨会话意义，drain 只需知道还有没有活）
const waiters = new Set();

function bucket(epoch) {
  if (!stageAgg.has(epoch)) {
    stageAgg.set(epoch, {
      shadowStarted: 0, intakeStarted: 0, intakeDone: 0, intakeFailed: 0,
      judgeDone: 0, compareDone: 0, droppedStale: 0, droppedEpoch: 0, errorTurns: 0,
      errorByStage: {},
    });
  }
  return stageAgg.get(epoch);
}

export function shadowStageCounts(epoch = "default") {
  return { ...bucket(epoch), errorByStage: JSON.parse(JSON.stringify(bucket(epoch).errorByStage)) };
}

export function recordShadowStage(epoch, stage) {
  const b = bucket(epoch);
  if (typeof b[stage] === "number") b[stage] += 1;
}

export function recordShadowError(epoch, stage, error) {
  const b = bucket(epoch);
  const type = (error && error.constructor?.name) || "UnknownError";
  if (!b.errorByStage[stage]) b.errorByStage[stage] = {};
  b.errorByStage[stage][type] = (b.errorByStage[stage][type] || 0) + 1;
}

// 在途登记：runShadowJudge 入口+1，finally-1（无论终态）。
export function shadowTaskEnter() {
  inflight += 1;
}

export function shadowTaskExit() {
  inflight = Math.max(0, inflight - 1);
  if (inflight === 0) {
    for (const resolve of waiters) resolve();
    waiters.clear();
  }
}

export function shadowInflightCount() {
  return inflight;
}

// 导出前收口：等在途影子全部结束，上限 timeoutMs（默认 60s）。
// 返回 { waited, pending }——pending 为超时后仍在途数（调用方计入 pendingAtExport）。
export async function drainShadowTasks(timeoutMs = 60000) {
  if (inflight === 0) return { waited: false, pending: 0 };
  const finished = new Promise((resolve) => waiters.add(resolve));
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([finished, timeout]);
  return { waited: true, pending: inflight };
}

export function _resetShadowStages() {
  stageAgg.clear();
  inflight = 0;
  waiters.clear();
}

// 阶段计数报告行——数量恒等口径写进表头，供覆盖率报告与导出共用。
export function formatStageReportLines(counts, pendingAtExport = 0) {
  if (!counts || !counts.shadowStarted) return [];
  const done = counts.compareDone || 0;
  const dropped = (counts.droppedStale || 0) + (counts.droppedEpoch || 0);
  const errored = counts.errorTurns || 0;
  const pendingNow = shadowInflightCount();
  // 恒等校验：开始 = 完成+丢弃+出错+在途（导出口径下在途取 pendingAtExport）
  const sum = done + dropped + errored + pendingAtExport;
  const balanced = sum === counts.shadowStarted;
  const lines = [
    `影子阶段计数：开始 ${counts.shadowStarted} · 完成 ${done} · 丢弃 ${dropped}（stale ${counts.droppedStale || 0}/epoch ${counts.droppedEpoch || 0}）· 出错 ${errored} · 导出时在途 ${pendingAtExport}`,
    `数量恒等：完成${done}+丢弃${dropped}+出错${errored}+在途${pendingAtExport}=${sum} vs 开始${counts.shadowStarted} —— ${balanced ? "对账平" : "不平，计量有洞"}`,
    `intake：进入 ${counts.intakeStarted || 0} · 完成 ${counts.intakeDone || 0} · 失败但回合继续 ${counts.intakeFailed || 0} · 判官产出 ${counts.judgeDone || 0} · 当前在途 ${pendingNow}`,
  ];
  const errs = counts.errorByStage || {};
  const stages = Object.keys(errs);
  if (stages.length) {
    lines.push("错误分类（阶段: 类型×次数）：" + stages.map((s) =>
      `${s}: ${Object.entries(errs[s]).map(([t, n]) => `${t}×${n}`).join(" ")}`).join("；"));
  }
  return lines;
}
