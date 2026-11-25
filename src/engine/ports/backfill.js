// 后台补写：系统事实行已落日志、玩家可以接着行动；这里在后台请 AI 写描写，
// 写完按 key 插回。不占回合、不进排队；AI 没配、失败、解析不出、或期间回滚，都只留事实行。

import { insertBackfill } from "../../domain/rules/log/backfill.js";
import { timeoutFallbackLine } from "../../domain/rules/clapboard/timeoutFallback.js";

// ── WO-08 短答档首字超时本地兜底 + 流式原位替换器 ──
// 三态：
//  1. 插入：首字在 firstTokenBudgetMs 内未到 → 日志末尾插入带 fillKey 的本地过渡行；
//  2. 替换：真实流式首字抵达 → 按 fillKey 找到过渡行，原位平滑替换为流式正文（后续 chunk 原地更新）；
//  3. 降级：整次请求超时/报错且从未见过首字 → 过渡行原样保留，静默降级，玩家无感知。
// 与 WO-02 的 idle timeout 不等价：那只管传输层两帧之间的间隔，本包装器只管首字等待体验，
// 不动 invoke 内部任何超时语义。
export const FIRST_TOKEN_BUDGET_MS = 3500;

function upsertByKey(log, key, entry) {
  const index = (Array.isArray(log) ? log : []).findIndex((e) => e?.fillKey === key);
  if (index < 0) return [...log, entry];
  const copy = [...log];
  copy[index] = entry;
  return copy;
}

export async function streamWithFirstTokenFallback({
  invoke, // async (onChunk) => ({ text, finishReason })，onChunk(delta, fullSoFar)
  setLog,
  isStale,
  key = newBackfillKey("ftf"),
  fallbackLine,
  fallback, // { kind, npc, place }——没给成品句时由 timeoutFallbackLine 现场生成
  firstTokenBudgetMs = FIRST_TOKEN_BUDGET_MS,
} = {}) {
  if (typeof invoke !== "function" || typeof setLog !== "function") {
    throw new Error("streamWithFirstTokenFallback 需要 invoke 与 setLog");
  }
  const line = fallbackLine || timeoutFallbackLine(fallback || {});
  const fallbackEntry = () => ({ t: "desc", text: `  ${line}`, fillKey: key, timeoutFallback: true });
  const streamEntry = (full, done) => ({
    t: "desc",
    text: `  ${full}${done ? "" : " ▌"}`,
    fillKey: key,
    streaming: !done,
    ...(done ? { streamed: true } : {}),
  });

  let firstChunkSeen = false;
  let settled = false;
  let fallbackInserted = false;

  const timer = setTimeout(() => {
    if (firstChunkSeen || settled) return;
    fallbackInserted = true;
    setLog((log) => {
      if (isStale?.() || firstChunkSeen || settled) return log;
      // 已存在同 key 行（重入/竞态）就不重复插
      if ((log || []).some((e) => e?.fillKey === key)) return log;
      return [...log, fallbackEntry()];
    });
  }, firstTokenBudgetMs);

  const onChunk = (delta, fullSoFar) => {
    const full = typeof fullSoFar === "string" ? fullSoFar : String(delta ?? "");
    firstChunkSeen = true;
    setLog((log) => {
      if (isStale?.() || settled) return log;
      // 原位替换：过渡行/流式行都在 fillKey 位置原地改写，不打乱日志顺序
      return upsertByKey(log, key, streamEntry(full, false));
    });
  };

  try {
    const res = await invoke(onChunk);
    settled = true;
    clearTimeout(timer);
    const finalText = typeof res?.text === "string" ? res.text : "";
    setLog((log) => {
      if (isStale?.()) return log;
      const hasKey = (log || []).some((e) => e?.fillKey === key);
      if (!hasKey) return log;
      if (finalText) {
        // 正常完赛：流式行转永久日志项
        return upsertByKey(log, key, streamEntry(finalText, true));
      }
      if (firstChunkSeen) {
        // 有 chunk 但总文本为空：保留现有流式内容、只摘光标
        return upsertByKey(log, key, streamEntry("", true));
      }
      // 空响应且从未见首字：保留过渡行静默降级
      return upsertByKey(log, key, { ...fallbackEntry() });
    });
    return {
      ok: true,
      text: finalText,
      finishReason: res?.finishReason,
      fallbackUsed: fallbackInserted,
      degraded: !finalText && !firstChunkSeen && fallbackInserted,
    };
  } catch (error) {
    settled = true;
    clearTimeout(timer);
    setLog((log) => {
      if (isStale?.()) return log;
      if (!(log || []).some((e) => e?.fillKey === key)) return log;
      if (fallbackInserted || !firstChunkSeen) {
        // 超时/报错且没见过首字：保留（或复位）过渡行，静默降级
        return upsertByKey(log, key, fallbackEntry());
      }
      // 已见首字的半截流式：内容保留，但请求已终结——摘掉 streaming 旗与光标，
      // 否则这行永远挂着「▌」假装还在写。
      const index = (log || []).findIndex((e) => e?.fillKey === key);
      if (index < 0) return log;
      const row = log[index];
      if (!row.streaming) return log;
      const copy = [...log];
      copy[index] = { ...row, text: row.text.replace(/\s*▌\s*$/, ""), streaming: false, streamed: true, interrupted: true };
      return copy;
    });
    return {
      ok: false,
      text: "",
      error,
      fallbackUsed: fallbackInserted,
      degraded: fallbackInserted || !firstChunkSeen,
    };
  }
}

export function newBackfillKey(prefix = "fill") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 事实行之后有流式占位行（actCall / 私聊按下标改写它）时插行会把它挤错位，先等它写完。
// 只看事实行之后：更早的 streaming 行是存档里残留的死行，不会再被改写。
// 等满 maxTries 仍在流式就放弃、只留事实行：照插会挤错还活着的流式下标。
function streamingAfterFacts(log, key) {
  if (!Array.isArray(log)) return false;
  const start = log.findIndex((entry) => entry?.fillKey === key);
  return start >= 0 && log.slice(start).some((entry) => entry?.streaming);
}

// 等流式行写完再按 key 插回；等满仍在流式或已过期就放弃，返回 false。
export async function insertWhenIdle(key, lines, { setLog, isStale, retryMs = 500, maxTries = 1200 }) {
  for (let tries = 0; tries < maxTries; tries++) {
    if (isStale?.()) return false;
    let deferred = false;
    setLog((log) => {
      if (isStale?.()) return log;
      if (streamingAfterFacts(log, key)) { deferred = true; return log; }
      return insertBackfill(log, key, lines);
    });
    if (isStale?.()) return false;
    if (!deferred) return true;
    await wait(retryMs);
  }
  return false;
}

// ask(): Promise<string|null>；parse(text) → { [slot]: 描写 } | 数组 | null
export async function backfillInBackground(key, { ask, parse, setLog, canAsk = () => true, isStale, retryMs, maxTries }) {
  try {
    if (isStale?.() || !canAsk()) return false;
    const text = await ask();
    if (isStale?.()) return false;
    const lines = text ? parse(text) : null;
    if (!lines) return false;
    return await insertWhenIdle(key, lines, { setLog, isStale, retryMs, maxTries });
  } catch {
    return false;
  }
}
