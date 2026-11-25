// 后台补写的日志部分：系统事实行先落日志，AI 描写回来后按 key 原位插到对应行下面。
//
// 事实行带 fillKey（这一批的 key）和 fillSlot（这一行等哪句描写）；描写按 slot 给出。
// 落日志后玩家回滚了，这批事实行就不在日志里了，插回时找不到 key 便原样返回——回滚即作废。

import { LOG_T } from "./logTypes.js";

export function tagBackfill(entries, key) {
  return (Array.isArray(entries) ? entries : []).map((entry, index) => ({
    ...entry,
    fillKey: key,
    fillSlot: entry?.fillSlot ?? index,
  }));
}

// lines：{ [slot]: "描写" }，或按 slot 下标排的数组
export function insertBackfill(log, key, lines) {
  if (!Array.isArray(log) || !lines || !log.some((entry) => entry?.fillKey === key && !entry.fillProse)) return log;
  if (log.some((entry) => entry?.fillKey === key && entry.fillProse)) return log;
  const next = [];
  for (const entry of log) {
    next.push(entry);
    if (entry?.fillKey !== key) continue;
    const line = typeof lines[entry.fillSlot] === "string" ? lines[entry.fillSlot].trim() : "";
    if (line) {
      const stamped = { t: LOG_T.DESC, text: `  ${line}`, fillKey: key, fillProse: true };
      if (typeof entry.turn === "number") stamped.turn = entry.turn;
      if (typeof entry.day === "number") stamped.day = entry.day;
      if (entry.realTs != null) stamped.realTs = entry.realTs;
      next.push(stamped);
    }
  }
  return next;
}
