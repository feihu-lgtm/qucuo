// 统一向量召回格式化与对话窗口去重：供主回合与旁白私聊共用，避免两处各自拼装并重复注入近期已出现的记忆。
import { embeddingReady } from "./embeddingService.js";
import { recallWithVisibility } from "./recallWithVisibility.js";

const DEFAULT_HEADER = "\n\n[往事·与此刻情形相关的旧记忆，可能不在最近对话里，供你行文时自然照应，不要生硬复述]\n";

export function formatRecallEntries(recallInfo, { recentTexts = [], header = DEFAULT_HEADER } = {}) {
  if (!recallInfo || !Array.isArray(recallInfo.visible) || !recallInfo.visible.length) {
    return { recallInfo: recallInfo || null, recallBlock: "" };
  }
  const recentPool = (recentTexts || []).filter((t) => typeof t === "string" && t.length > 0);
  const dedupedVisible = recallInfo.visible.filter((m) => {
    const text = String(m?.text || "").trim();
    if (!text) return false;
    return !recentPool.some((recent) => recent.includes(text));
  });
  const filteredRecall = dedupedVisible.length === recallInfo.visible.length
    ? recallInfo
    : { ...recallInfo, visible: dedupedVisible, deduped: recallInfo.visible.length - dedupedVisible.length };

  if (!dedupedVisible.length) {
    return { recallInfo: filteredRecall, recallBlock: "" };
  }
  const body = dedupedVisible.map((m) => {
    const line = m.tier === "weak" && m.text.length > 40 ? m.text.slice(0, 40) + "…" : m.text;
    return `· （第${m.meta.turn}回合）${line}`;
  }).join("\n");
  return { recallInfo: filteredRecall, recallBlock: `${header}${body}` };
}

export async function runFormattedRecall({
  apiCfg,
  queryText,
  contextText,
  focusEntities = [],
  unlockedFlags = [],
  presentNames = [],
  topK = 5,
  recentTexts = [],
  header = DEFAULT_HEADER,
}) {
  if (!embeddingReady(apiCfg)) return { recallInfo: null, recallBlock: "" };
  const rawRecall = await recallWithVisibility({
    cfg: apiCfg,
    queryText,
    contextText,
    focusEntities,
    unlockedFlags,
    presentNames,
    topK,
  });
  return formatRecallEntries(rawRecall, { recentTexts, header });
}
