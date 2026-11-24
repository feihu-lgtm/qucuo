// 后台补写：系统事实行已落日志、玩家可以接着行动；这里在后台请 AI 写描写，
// 写完按 key 插回。不占回合、不进排队；AI 没配、失败、解析不出、或期间回滚，都只留事实行。

import { insertBackfill } from "../../domain/rules/log/backfill.js";

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
