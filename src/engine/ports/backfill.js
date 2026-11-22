// 后台补写：系统事实行已落日志、玩家可以接着行动；这里在后台请 AI 写描写，
// 写完按 key 插回。不占回合、不进排队；AI 没配、失败、解析不出、或期间回滚，都只留事实行。

import { insertBackfill } from "../../domain/rules/log/backfill.js";

export function newBackfillKey(prefix = "fill") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 主叙事流式输出时按下标改写占位行（actCall），此时插行会把它挤错位，等流式结束再插。
const isStreaming = (log) => Array.isArray(log) && log.some((entry) => entry?.streaming);

// ask(): Promise<string|null>；parse(text) → { [slot]: 描写 } | 数组 | null
export async function backfillInBackground(key, { ask, parse, setLog, canAsk = () => true, retryMs = 500, maxTries = 240 }) {
  try {
    if (!canAsk()) return false;
    const text = await ask();
    const lines = text ? parse(text) : null;
    if (!lines) return false;
    for (let tries = 0; tries < maxTries; tries++) {
      let deferred = false;
      setLog((log) => {
        if (isStreaming(log)) { deferred = true; return log; }
        return insertBackfill(log, key, lines);
      });
      if (!deferred) return true;
      await wait(retryMs);
    }
    return false;
  } catch {
    return false;
  }
}
