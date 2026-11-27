// 卷宗：把存档里的主栏日志（玩家看得见的一切）和内存里的全流程追踪（turnMonitor，
// 最近 40 个前台回合）按回合拼成「一行一事」。纯函数，单测覆盖。
// 只有三个过滤：全部 / 账 / 异常；另有一个开关「机器」，打开才显示 AI 调用与系统步骤。
// 所有文字出卷宗前都过一遍脱敏。
import { LOG_T } from "../../../domain/data/log/logTypes.js";
import { redactSecrets } from "../../../utils/apiErrors.js";
import { createClockMarker, isLedgerEntry, isMapNoise, isRuleHint, isSystemFailure, ledgerText } from "./feedModel.js";

export const JOURNAL_FILTERS = [
  { id: "all", label: "全部" },
  { id: "ledger", label: "账" },
  { id: "error", label: "异常" },
];

const STORY_TYPES = new Set([LOG_T.DESC, LOG_T.NARRATOR, LOG_T.ROOM, LOG_T.CHOICE, LOG_T.CONFESS, LOG_T.LOOT, LOG_T.QUEST]);
const clean = (text) => redactSecrets(String(text ?? "")).replace(/^[\s\u3000]+/, "").replace(/\s+$/, "");
const cut = (text, n) => (text.length > n ? `${text.slice(0, n)}…` : text);
const secs = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : "");

function groupLog(log) {
  const groups = [];
  let current = null;
  for (const entry of log || []) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.t === LOG_T.CMD) {
      if (current) groups.push(current);
      current = { cmd: entry, replies: [] };
    } else {
      if (!current) current = { cmd: null, replies: [] };
      current.replies.push(entry);
    }
  }
  if (current) groups.push(current);
  return groups;
}

function findTree(group, trees, byId) {
  const tid = group.cmd?.tid || group.replies.find((entry) => entry.tid)?.tid;
  if (tid && byId.has(tid)) return byId.get(tid);
  if (!group.cmd) return null;
  const said = String(group.cmd.text || "").replace(/^>\s*/, "").trim();
  const at = group.cmd.realTs;
  return trees.find((tree) => !tree.background
    && (tree.cmd === said || tree.raw === said)
    && (at == null || Math.abs((tree.ts ?? 0) - at) < 10000)) || null;
}

function logRows(group) {
  const rows = [];
  const story = group.replies.filter((entry) => STORY_TYPES.has(entry.t) && String(entry.text || entry.item?.name || "").trim());
  if (story.length) {
    const full = story.map((entry) => clean(entry.text || entry.item?.name || "")).filter(Boolean).join("\n");
    rows.push({ src: "story", label: "正文", text: cut(full.replace(/\n/g, " "), 44), meta: `${story.length} 段`, detail: full });
  }
  for (const entry of group.replies) {
    if (isLedgerEntry(entry)) rows.push({ src: "ledger", label: "账", text: clean(ledgerText(entry)) });
    else if (isSystemFailure(entry)) {
      rows.push({ src: "error", label: "异常", text: clean(entry.text), meta: entry.count > 1 ? `×${entry.count}` : "", kind: entry.kind });
    } else if (isRuleHint(entry)) rows.push({ src: "hint", label: "提示", text: clean(entry.text) });
    else if (entry.t === LOG_T.SYS && !isMapNoise(entry) && String(entry.text || "").trim()) rows.push({ src: "system", label: "系统", text: clean(entry.text) });
  }
  return rows;
}

function machineRows(tree) {
  if (!tree) return [];
  const rows = [];
  for (const node of tree.nodes || []) {
    if (node.kind === "entry" || node.kind === "queued") continue;
    if (node.kind === "ai") {
      const p = node.pipeline || {};
      const failed = p.success === false;
      const usage = p.usage || {};
      const tokensIn = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount;
      const tokensOut = usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount;
      const usageText = tokensIn != null || tokensOut != null ? `输入 ${tokensIn ?? "?"}　输出 ${tokensOut ?? "?"}${p.cachedTokens ? `　缓存 ${p.cachedTokens}` : ""}` : "";
      rows.push({
        src: failed ? "error" : "ai", label: "AI",
        text: clean(p.callLabel || node.label),
        meta: [node.model || p.model, secs(node.durationMs ?? p.durationMs), failed ? "失败" : ""].filter(Boolean).join(" · "),
        detail: [failed ? clean(p.error) : "", usageText, p.finishReason ? `结束原因 ${p.finishReason}` : ""].filter(Boolean).join("\n"),
      });
      continue;
    }
    const failed = node.status === "fail" || node.kind === "ERROR";
    const detail = [node.detail, node.errorDetail, node.hint].filter(Boolean).map(clean).join("\n");
    rows.push({ src: failed ? "error" : "machine", label: "机", text: clean(node.label), meta: node.status && node.status !== "info" ? node.status : "", detail });
  }
  return rows;
}

function keep(row, filter) {
  if (filter === "ledger") return row.src === "ledger";
  if (filter === "error") return row.src === "error";
  return true;
}

export function buildJournal(log, trees = [], { filter = "all", machine = false, limit = 60 } = {}) {
  const byId = new Map((trees || []).map((tree) => [tree.id, tree]));
  const mark = createClockMarker();
  const blocks = [];
  for (const [index, group] of groupLog(log).entries()) {
    const head = group.cmd || group.replies.find((entry) => typeof entry.turn === "number");
    // 不过滤时时辰戳只标变化；过滤后前后回合不连续，一律写全。
    const clock = head ? (filter === "all" ? mark(head) : createClockMarker()(head)) : null;
    const tree = findTree(group, trees || [], byId);
    const rows = [...logRows(group), ...(machine ? machineRows(tree) : [])].filter((row) => keep(row, filter));
    if (filter !== "all" && rows.length === 0) continue;
    if (!group.cmd && rows.length === 0) continue;
    blocks.push({
      key: `b${index}`,
      clock: clock?.text || "",
      cmd: group.cmd ? clean(String(group.cmd.text || "").replace(/^>\s*/, "")) : "",
      expired: machine && group.cmd && !tree,
      rows: rows.map((row, i) => ({ ...row, id: `b${index}:${i}` })),
    });
  }
  return blocks.slice(-limit);
}
