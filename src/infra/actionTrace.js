import { getTurnContext, turnMonitor } from "./turnMonitor.js";

export const getTraceLog = turnMonitor.getTrees;
export function getPipelineEntries() {
  return getTraceLog().flatMap((turn) => turn.nodes.flatMap((node) => node.pipeline?.success != null ? [node.pipeline] : []))
    .sort((a, b) => b.seq - a.seq).slice(0, 20);
}

export function startTrace(cmd, raw, options) {
  return getTurnContext() || turnMonitor.start(cmd, { raw, ...options });
}

export function step(turn, label, status, detail, layer = "domain", fields = {}) {
  const safeFields = fields.structured ? { ...fields, structured: traceSnapshot(fields.structured) } : fields;
  if (turn) turnMonitor.add(turn, layer, label, { status, detail, ...safeFields });
}

// 结构化排障字段进 trace 前的安全快照：保留判官/听意/尾章全字段形状，
// 只截长文与长数组，避免复制日志/调试包被正文挤爆；不改原对象。
export function traceSnapshot(value, depth = 0) {
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 240)}…` : value;
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 5) return Array.isArray(value) ? `[Array(${value.length})]` : "[Object]";
  if (Array.isArray(value)) {
    const out = value.slice(0, 20).map((item) => traceSnapshot(item, depth + 1));
    if (value.length > 20) out.push(`… 其余 ${value.length - 20} 条`);
    return out;
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, traceSnapshot(item, depth + 1)]));
  }
  return String(value);
}

export function attachInjectionSnapshot(turn, snapshot) {
  if (turn && snapshot) {
    turn.injectionSnapshot = snapshot;
    turnMonitor.add(turn, "engine", "注入结构", { kind: "injection" });
  }
}

export function endTrace(turn, summary) {
  if (turn) turnMonitor.finish(turn, summary);
}

export function fmtMs(ms) {
  if (ms == null) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function fmtClock(ts) {
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return "";
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function fmtGameClock(turn) {
  if (typeof turn?.gameTurn !== "number" || !Number.isFinite(turn.gameTurn)) return "";
  const day = typeof turn.gameDay === "number" ? turn.gameDay : Math.floor(turn.gameTurn / 24) + 1;
  const endTurn = typeof turn.endGameTurn === "number" && turn.endGameTurn !== turn.gameTurn
    ? turn.endGameTurn
    : null;
  const endDay = typeof turn.endGameDay === "number" ? turn.endGameDay : (endTurn != null ? Math.floor(endTurn / 24) + 1 : day);
  if (endTurn != null) {
    return `第${day}日·第${turn.gameTurn}回合 → 第${endDay}日·第${endTurn}回合`;
  }
  return `第${day}日·第${turn.gameTurn}回合`;
}

// 各家 usage 字段名不同，统一取数：OpenAI prompt_tokens/completion_tokens、
// Anthropic input_tokens/output_tokens、Gemini promptTokenCount/candidatesTokenCount。
export function formatUsageTab(p) {
  const u = p?.usage;
  if (!u && p?.cachedTokens == null) return undefined;
  const input = u?.prompt_tokens ?? u?.input_tokens ?? u?.promptTokenCount;
  const output = u?.completion_tokens ?? u?.output_tokens ?? u?.candidatesTokenCount;
  const lines = [];
  if (input != null) lines.push(`输入 tokens: ${input}`);
  if (output != null) lines.push(`输出 tokens: ${output}`);
  if (p?.cachedTokens != null) {
    lines.push(`前缀缓存命中 tokens: ${p.cachedTokens}`);
    if (input) lines.push(`缓存命中率: ${Math.round((p.cachedTokens / input) * 100)}%`);
  }
  return lines.length ? lines.join("\n") : undefined;
}

export function pipelineTabs(p) {
  // 无内容的标签页直接不渲染（用量/召回缺数据时不占位置）
  return Object.fromEntries(Object.entries({
    System: Array.isArray(p.systemPrompt)
      ? p.systemPrompt.map((m) => `[${m.tavernLabel || m.tavernBlock || "system"}]\n${m.content || ""}`).join("\n\n")
      : p.systemPrompt,
    输入: (p.userMessages || []).map((m) => `[${m.role}] ${m.content}`).join("\n\n"),
    输出: p.response ?? p.error,
    用量: formatUsageTab(p),
    召回: p.recall && JSON.stringify(p.recall, null, 2),
  }).filter(([, content]) => content != null && content !== ""));
}

export function formatTrace(turn, { full = true } = {}) {
  const clock = fmtClock(turn.ts);
  const gameClock = fmtGameClock(turn);
  return [
    `=== ${clock ? `${clock} ` : ""}${turn.id} ${turn.raw} | ${turn.phases.join(" → ")} | ${fmtMs(turn.totalMs)}${turn.commandId ? ` | ${turn.commandId} · ${turn.category}` : ""}${gameClock ? ` | ${gameClock}` : ""} ===`,
    ...turn.nodes.flatMap((node) => [
      `  [${node.layer}] ${node.label}${node.model ? ` · ${node.model}` : ""}${node.detail ? `：${node.detail}` : ""}${node.durationMs != null ? ` (${fmtMs(node.durationMs)})` : ""}`,
      ...(full && node.structured ? [`[结构化]\n${JSON.stringify(node.structured, null, 2)}`] : []),
      ...(full && node.pipeline ? Object.entries(pipelineTabs(node.pipeline)).map(([tab, content]) => `[${tab}]\n${content ?? ""}`) : []),
    ]),
  ].join("\n");
}
