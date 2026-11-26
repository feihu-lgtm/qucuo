// 日志条目类型清单 LOG_T 在 domain/data/log/logTypes.js（各层都能读）；这里只留由它派生的
// 集合与盖时间戳的规则。
import { LOG_T } from "../../data/log/logTypes.js";

export const LOG_TYPES = new Set(Object.values(LOG_T));

// 不走颜色表、由组件整条接管渲染的类型
export const CARD_RENDERED_LOG_TYPES = new Set([LOG_T.LOOT]);

export function stampLogEntries(entries, gameTime, realTs = Date.now()) {
  if (!Array.isArray(entries) || entries.length === 0) return entries;
  const validTime = typeof gameTime === "number" && Number.isFinite(gameTime);
  if (!validTime && realTs == null) return entries;
  const day = validTime ? Math.floor(gameTime / 24) + 1 : undefined;
  return entries.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const next = { ...entry };
    if (validTime) {
      if (typeof next.turn !== "number") next.turn = gameTime;
      if (typeof next.day !== "number") next.day = day;
    }
    if (realTs != null && next.realTs == null) next.realTs = realTs;
    return next;
  });
}
