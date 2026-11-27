// 回合失败在主栏只留一句话，且同因连续失败合成一条。
// 例如上游额度用尽时连发四次行动：四个「你 ……」行动行照常保留（玩家要看得见自己说过什么），
// 报错只在最后留一条「天机不畅（接口额度已尽），本轮未计入」，右侧标 ×4。
// 详情（脱敏后的原文、分类、建议）不进存档里的主栏日志，只进卷宗与全流程日志。

// 这些类型一出现，说明中间有回合成功了，不再与之前的失败合并。
const PROGRESS_TYPES = new Set(["desc", "narrator", "room", "loot", "item", "stat", "affection", "skill", "quest", "confess", "choice"]);

export function turnErrorEntry({ kind, line, retryable }) {
  return { t: "err", kind: kind || "unknown", retryable: retryable !== false, count: 1, text: `  ${line}，本轮未计入。` };
}

export function appendTurnError(log, entry) {
  const list = Array.isArray(log) ? log : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    if (!item || typeof item !== "object") continue;
    if (PROGRESS_TYPES.has(item.t)) break;
    if (item.t === "err" && item.kind && item.kind === entry.kind) {
      const merged = { ...entry, count: (Number(item.count) || 1) + 1 };
      return [...list.slice(0, i), ...list.slice(i + 1), merged];
    }
  }
  return [...list, entry];
}
