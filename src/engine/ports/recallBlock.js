// 统一向量召回格式化与对话窗口去重：供主回合与旁白私聊共用，避免两处各自拼装并重复注入近期已出现的记忆。
// WO-18 起本模块同时收口「原文段落召回」：段落库（prose_chunks）走纯本地词法检索、
// 不要 embedding、不要 API——没开向量开关的玩家也照常有往事可回忆；
// 小纸条向量召回维持原样作补充，两者在此混排成一块场记板。
import { embeddingReady } from "./embeddingService.js";
import { recallWithVisibility } from "./recallWithVisibility.js";
import { getAllProseChunks, addProseChunks, getProseChunksByTurn, getProseChunksByBranch, migrateLegacyConvoAndNotes } from "../../infra/proseStore.js";
import { rankProseChunks, expandWithNeighbors } from "../../domain/rules/memory/proseRecall.js";

const DEFAULT_HEADER = "\n\n[往事正本·与此刻情形相关的原文记忆，可能不在最近对话里，供你行文时自然照应，不要生硬复述]\n";

// 场记板字符预算（粗略当 token 用，中文 1 字 ≈ 1 token 量级）：
// 原文段落+纸条合计超出预算时，弱相关项退回单行事实目录，再超硬截断。
export const RECALL_BUDGET_CHARS = 1200;
const WEAK_LINE_CHARS = 40;

// 段落库写入口的 ports 出口：engine 层不许直连 infra（棘轮只减不增），
// runTurn 的写挂经此转手拿 addProseChunks——与上方读取共用同一条 import，不新增跨层计数。
export { addProseChunks, getProseChunksByTurn, getProseChunksByBranch, migrateLegacyConvoAndNotes };

// 原文段落召回（ports 层编排：infra 读库 + domain 纯函数打分/连带）。
// viewer 是查询视角人物名——witnesses 硬过滤以它为准；不传只看公共段。
// 失败/空库一律降级为空数组，绝不阻断回合。
export async function recallProse({ queryText, viewer, topK = 5, epoch, currentTurn, lineage } = {}) {
  try {
    const all = await getAllProseChunks();
    if (!all.length) return [];
    const scope = { epoch, currentTurn, lineage };
    const hits = rankProseChunks(all, queryText || "", viewer, scope);
    if (!hits.length) return [];
    return expandWithNeighbors(all, hits, { viewer, epoch, currentTurn, lineage }).slice(0, topK);
  } catch (_) {
    return [];
  }
}

export function formatRecallEntries(recallInfo, { recentTexts = [], header = DEFAULT_HEADER, proseEntries = [], budgetChars = RECALL_BUDGET_CHARS } = {}) {
  const hasNotes = recallInfo && Array.isArray(recallInfo.visible) && recallInfo.visible.length;
  if (!hasNotes && !proseEntries.length) {
    return { recallInfo: recallInfo || null, recallBlock: "", proseEntries: [] };
  }
  const recentPool = (recentTexts || []).filter((t) => typeof t === "string" && t.length > 0);

  // 1) 原文段落优先：整段原字入场，去重逻辑与纸条一致（近期窗口已现的不再重复）。
  const proseKept = [];
  for (const entry of proseEntries || []) {
    // 逐段去重：邻段合并后的整块只要有一段已在近期窗口出现过就把那一段剥掉，
    // 全剥光整条不上；否则会出现"窗口里有的原文又整段复述一遍"。
    const paras = String(entry?.text || "").split("\n")
      .map((t) => t.trim())
      .filter((t) => t && !recentPool.some((recent) => recent.includes(t)));
    if (!paras.length) continue;
    proseKept.push({ ...entry, text: paras.join("\n") });
  }
  // 2) 纸条补充：与原文段落重复的纸条不再上（原文已含更全的信息）。
  let visible = hasNotes ? recallInfo.visible : [];
  const proseTextAll = proseKept.map((e) => e.text).join("\n");
  visible = visible.filter((m) => {
    const text = String(m?.text || "").trim();
    if (!text) return false;
    if (recentPool.some((recent) => recent.includes(text))) return false;
    if (proseTextAll && text.length >= 8 && proseTextAll.includes(text)) return false;
    return true;
  });
  const filteredRecall = hasNotes
    ? { ...recallInfo, visible, deduped: (recallInfo.visible.length - visible.length) + (recallInfo.deduped || 0) }
    : recallInfo;

  if (!proseKept.length && !visible.length) {
    return { recallInfo: filteredRecall, recallBlock: "", proseEntries: [] };
  }

  // 3) 预算：先全量排，字符合计超预算时——weak 纸条退单行目录（本就 40 字截断），
  // 再超则砍低分邻段只留锚段，最后硬截断。强相关原文段落永远优先保全文。
  // 场记板正本行：〔第X回合·见证标签〕，witnesses 为 ["*"]/空渲染「众人皆知」，
  // 有具体名单渲染「见证：A、B」；importance===3 加〔刻骨〕戳。
  const witnessLabel = (e) => {
    const w = Array.isArray(e.witnesses) ? e.witnesses.filter(Boolean) : [];
    if (!w.length || w.includes("*")) return "众人皆知";
    return `见证：${w.join("、")}`;
  };
  const proseLine = (e) => `${e.importance === 3 ? "〔刻骨〕" : ""}〔第${e.turn}回合·${witnessLabel(e)}〕${e.text}`;
  const noteLine = (m, forceShort = false) => {
    const line = (forceShort || m.tier === "weak") && m.text.length > WEAK_LINE_CHARS ? m.text.slice(0, WEAK_LINE_CHARS) + "…" : m.text;
    // 预算充足期普通行；退回单行目录时带「往事索引」前缀明示这是折叠目录而非正本
    return forceShort ? `· 往事索引（第${m.meta.turn}回合）${line}` : `· （第${m.meta.turn}回合）${line}`;
  };

  let proseParts = proseKept.map(proseLine);
  let noteParts = visible.map((m) => noteLine(m));
  const totalLen = () => [...proseParts, ...noteParts].join("\n").length;

  if (totalLen() > budgetChars) {
    // 第一轮：所有 weak 纸条退单行事实目录
    noteParts = visible.map((m) => noteLine(m, true));
  }
  if (totalLen() > budgetChars) {
    // 第二轮：多段合并的原文块只留首段（锚段），邻段让位
    proseParts = proseKept.map((e) => {
      const first = e.text.split("\n")[0];
      return `〔第${e.turn}回合〕${first}`;
    });
  }
  if (totalLen() > budgetChars) {
    // 第三轮：从尾部（低分）开始整块丢弃直到进预算
    while (noteParts.length && totalLen() > budgetChars) noteParts.pop();
    while (proseParts.length > 1 && totalLen() > budgetChars) proseParts.pop();
  }

  const body = [...proseParts, ...noteParts].join("\n");
  return { recallInfo: filteredRecall, recallBlock: `${header}${body}`, proseEntries: proseKept };
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
  viewer = "",
  budgetChars = RECALL_BUDGET_CHARS,
  epoch,
  currentTurn,
  lineage,
}) {
  // 原文段落召回与向量开关无关：纯本地词法检索，永远跑（失败静默降级空数组）。
  // 查询词 = 玩家输入 + 上下文，专名命中多半在输入里，上下文补场景词。
  const proseEntries = await recallProse({
    queryText: `${queryText || ""}\n${contextText || ""}`.trim(),
    viewer,
    topK,
    epoch,
    currentTurn,
    lineage,
  });
  if (!embeddingReady(apiCfg)) {
    return formatRecallEntries(null, { recentTexts, header, proseEntries, budgetChars });
  }
  const rawRecall = await recallWithVisibility({
    cfg: apiCfg,
    queryText,
    contextText,
    focusEntities,
    unlockedFlags,
    presentNames,
    topK,
  });
  return formatRecallEntries(rawRecall, { recentTexts, header, proseEntries, budgetChars });
}
