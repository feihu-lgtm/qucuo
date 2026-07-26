// 行动分层日志（Action Trace）
// ---------------------------------------------------------------------------
// 目的：把玩家每一次行动（一次 act 调用）在系统各"层"里的走向记录下来——
// 每一层是通过了、被拦截了、还是没经过，带一句说明。这样出问题时（比如
// "向南走不动""这里没人却有人""说服老是不中"）能一眼看出卡在哪一层，
// 而不用猜。与 Pipeline 日志互补：Pipeline 记的是"每次 AI 调用的 prompt/回复"，
// 这里记的是"每次玩家行动经过了哪些系统判定、各自结果如何"——很多行动（内层
// 移动、此路不通）根本不调 AI，只有这套 trace 记得到。
//
// 用法：
//   const t = startTrace(cmd);           // 行动开始
//   step(t, "意图分类", "pass", "判为移动·南");
//   step(t, "内层移动", "block", "塔基往南无内层出口，转外层");
//   step(t, "外层移动", "pass", "白塔→喇嘛庙");
//   step(t, "AI调用", "fail", "超时60s");
//   endTrace(t, "未移动（AI失败）");     // 行动收尾，给个总结
//
// status 取值：pass(通过) / block(被拦，属正常规则) / fail(异常失败) / skip(未经过) / info(纯记录)

const MAX_TRACES = 40;
const traceLog = [];

export function getTraceLog() { return traceLog; }
export function clearTraceLog() { traceLog.length = 0; }

export function startTrace(cmd, raw) {
  const now = Date.now();
  const rawStr = raw != null ? String(raw) : String(cmd || "");
  const t = { ts: now, _last: now, raw: rawStr, cmd: String(cmd || "").slice(0, 60), steps: [], summary: null, _running: true };
  // 一开始就放进日志列表——这样"进行中"的行动也实时可见，每加一步都能立刻看到当前进行到哪一步，
  // 而不是等 endTrace 收尾才整条出现（那样看不到"卡在哪一步/当前在做什么"）。
  traceLog.unshift(t);
  if (traceLog.length > MAX_TRACES) traceLog.length = MAX_TRACES;
  return t;
}

export function step(trace, layer, status, detail) {
  if (!trace) return;
  const now = Date.now();
  const dt = now - (trace._last || now); // 距上一步的耗时(ms)
  trace._last = now;
  trace.steps.push({ layer, status: status || "info", detail: detail == null ? "" : String(detail), at: now, dt });
}

// 把这一轮 AI 调用的完整 prompt/回复（来自 pipelineLog 的一条）挂到 trace 上，
// 让"一轮全过程"在一个面板里既能看系统各层、又能看喂给 AI 的总 prompt 和回复。
export function attachPipeline(trace, entry) {
  if (!trace || !entry) return;
  trace.pipeline = entry;
}

export function attachExtractionPipeline(trace, entry) {
  if (!trace || !entry) return;
  trace.extractionPipeline = entry;
}

export function endTrace(trace, summary) {
  if (!trace || trace._archived) return; // 幂等：已归档不重复
  trace._archived = true;
  trace._running = false;
  trace.summary = summary == null ? "" : String(summary);
  trace.totalMs = Date.now() - trace.ts; // 整个行动总耗时
  // 注意：trace 已在 startTrace 时 unshift 进 traceLog，这里只标记完成，不再重复入列。
}

// 耗时格式化：ms→易读
export function fmtMs(ms) {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// 把一条 trace 整理成可复制的纯文本（供"复制"按钮 / 贴给作者排查）。
export function formatTrace(trace, n) {
  const head = `=== 行动 #${n} | ${new Date(trace.ts).toLocaleString()} | 共${fmtMs(trace.totalMs)} ===`;
  const rawLine = `  $ ${trace.raw != null ? trace.raw : trace.cmd}`; // raw 原始输入（terminal 风格，不删减）
  const ICON = { pass: "✓", block: "⛔", fail: "✗", skip: "·", info: "•" };
  const lines = trace.steps.map(s => `  ${ICON[s.status] || "•"} [${s.layer}] ${s.detail}${s.dt != null ? `  (${fmtMs(s.dt)})` : ""}`);
  const tail = trace.summary ? `\n  → 结果：${trace.summary}` : "";
  // 附上这一轮 AI 请求全文（System Prompt / 输入 / 回复），让"复制全部"能把结构化文本一起带出来，方便贴给作者排查。
  let pl = "";
  if (trace.pipeline) {
    const p = trace.pipeline;
    const sys = p.systemPrompt || "";
    const usr = (p.userMessages || []).map(m => `[${m.role}] ${m.content}`).join("\n\n");
    const resp = p.response || p.text || (p.error ? `（无回复）报错：${p.error}` : "（无回复）");
    pl = `\n\n  --- AI 请求全文 ---\n  [System Prompt]\n${sys}\n\n  [输入]\n${usr}\n\n  [AI 回复]\n${resp}`;
  }
  if (trace.extractionPipeline) {
    const p = trace.extractionPipeline;
    const sys = p.systemPrompt || "";
    const usr = (p.userMessages || []).map(m => `[${m.role}] ${m.content}`).join("\n\n");
    const resp = p.response || p.text || (p.error ? `（无回复）报错：${p.error}` : "（无回复）");
    pl += `\n\n  --- 提取层调用全文（双调用·第二次AI调用） ---\n  [System Prompt]\n${sys}\n\n  [输入]\n${usr}\n\n  [提取层回复]\n${resp}`;
  }
  return `${head}\n${rawLine}\n${lines.join("\n")}${tail}${pl}`;
}
