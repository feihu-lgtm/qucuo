import { getTurnContext, turnMonitor } from "../core/turnMonitor.js";

export const getTraceLog = turnMonitor.getTrees;
export const clearTraceLog = turnMonitor.clear;
export function getPipelineEntries() {
  return getTraceLog().flatMap((turn) => turn.nodes.flatMap((node) => node.pipeline?.success != null ? [node.pipeline] : []))
    .sort((a, b) => b.seq - a.seq).slice(0, 20);
}

export function startTrace(cmd, raw, options) {
  return getTurnContext() || turnMonitor.start(cmd, { raw, ...options });
}

export function step(turn, label, status, detail, layer = "domain") {
  if (turn) turnMonitor.add(turn, layer, label, { status, detail });
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

export function pipelineTabs(p) {
  return {
    System: Array.isArray(p.systemPrompt)
      ? p.systemPrompt.map((m) => `[${m.tavernLabel || m.tavernBlock || "system"}]\n${m.content || ""}`).join("\n\n")
      : p.systemPrompt,
    输入: (p.userMessages || []).map((m) => `[${m.role}] ${m.content}`).join("\n\n"),
    输出: p.response ?? p.error,
    召回: p.recall && JSON.stringify(p.recall, null, 2),
  };
}

export function formatTrace(turn, { full = true } = {}) {
  return [
    `=== ${turn.id} ${turn.raw} | ${turn.phases.join(" → ")} | ${fmtMs(turn.totalMs)} ===`,
    ...turn.nodes.flatMap((node) => [
      `  [${node.layer}] ${node.label}${node.model ? ` · ${node.model}` : ""}${node.detail ? `：${node.detail}` : ""}${node.durationMs != null ? ` (${fmtMs(node.durationMs)})` : ""}`,
      ...(full && node.pipeline ? Object.entries(pipelineTabs(node.pipeline)).map(([tab, content]) => `[${tab}]\n${content ?? ""}`) : []),
    ]),
  ].join("\n");
}
