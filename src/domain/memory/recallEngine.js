// 召回引擎（纯计算，不碰网络/存储）
// ------------------------------------------------------------------
// 输入：查询向量 + 一批带向量的记忆记录；输出：按相关性排序、带 similarity 的候选。
// 三个机制，全部来自参考项目 memory-recall.js 的设计：
//   1. 双路 RRF 融合：Q_intent（当前输入）+ Q_context（上轮回复+位置NPC上下文）
//      各自排一遍序，再用 Reciprocal Rank Fusion 融合，避免单路偏移。
//   2. 实体聚焦过滤：相似度处在"中间地带"（MIN_SIM~ENTITY_BYPASS）的记忆，
//      必须提到当前焦点人物/地点才保留，滤掉"沾点边但其实无关"的噪音。
//   3. 强/弱分层：sim ≥ ENTITY_BYPASS 记为 strong（进 prompt 时给全文），
//      MIN_SIM ≤ sim < ENTITY_BYPASS 记为 weak（进 prompt 时只给截断摘要）。

export const MIN_SIM = 0.60;          // 低于此相似度直接丢弃
export const ENTITY_BYPASS_SIM = 0.72; // 高于此相似度视为强相关，跳过实体过滤、给全文
const RRF_K = 60;                     // RRF 融合常数，越大越平滑

// 余弦相似度。两个向量维度必须一致，否则返回 -1（视为不相关）。
import { buildIndex, lexicalRank, lengthFactor, bypassQuota, LEXICAL_BASE } from "./lexical.js";

// intent/context 两路的基准权重（同姬侠传：主路看当前意图、辅路看上轮回复）
const INTENT_BASE = 0.6;
const CONTEXT_BASE = 0.4;

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// 单路召回：对每条记忆算相似度，降序返回 [{ record, sim }]。
function rankOnce(queryVec, memories) {
  if (!queryVec) return [];
  return memories
    .map(m => ({ record: m, sim: cosine(queryVec, m._vec) }))
    .filter(x => x.sim > -1)
    .sort((a, b) => b.sim - a.sim);
}

// 双路 RRF 融合。两路各自排序后，一条记忆的融合分 = Σ 1/(RRF_K + 该路排名)。
// 同时保留它在两路里出现过的最高原始相似度，用于后续分层/展示。
// 多路加权 RRF。一条记忆的融合分 = Σ w_path / (RRF_K + 该路排名)。
// 【为什么改成加权多路】原来是两路等权硬编码。加词法路之后必须能配权重：
// 三路的可信度本来就不一样（主路意图 > 辅路上文 ≈ 词法），
// 而且 intent/context 两路还要乘长度因子，等权就没法表达了。
function rrfFuse(paths) {
  const acc = new Map(); // id -> { record, rrf, bestSim }
  for (const { ranking, weight } of paths) {
    if (!ranking || !ranking.length || !weight) continue;
    ranking.forEach((item, idx) => {
      const id = item.record.id;
      const cur = acc.get(id) || { record: item.record, rrf: 0, bestSim: -1 };
      cur.rrf += weight / (RRF_K + idx + 1);
      cur.bestSim = Math.max(cur.bestSim, item.sim);
      acc.set(id, cur);
    });
  }
  return Array.from(acc.values()).sort((a, b) => b.rrf - a.rrf);
}

// 主入口。
// 参数：
//   memories       —— 已附带 _vec（Float32Array）的记忆记录数组（调用方负责挂 _vec）
//   qIntentVec     —— 当前输入的向量（可为 null）
//   qContextVec    —— 上下文向量（可为 null；为 null 时退化为单路）
//   focusEntities  —— 当前焦点人物/地点名数组，用于中间地带过滤
//   topK           —— 最终保留条数
// 返回：[{ record, similarity, tier }]，tier ∈ 'strong'|'weak'
export function recall({
  memories, qIntentVec, qContextVec, focusEntities = [], topK = 5,
  // 词法路要用的原文（没传就退化成纯向量双路，行为与改动前一致）
  intentText = "", contextText = "",
}) {
  if (!memories || !memories.length) return [];

  const rankA = rankOnce(qIntentVec, memories);
  const rankB = qContextVec ? rankOnce(qContextVec, memories) : [];

  // ── 词法路（第三路）──
  // 向量最弱的地方是专有名词：查"赫连铸"时，一条明写着赫连铸的纸条可能排在
  // 三条"跟某个恶人打了一架"后面，因为那三条整句更像查询。词法路保证
  // 明写了这个词的一定找得到。纯本地计算，零 API 开销。
  const lexIndex = intentText ? buildIndex(memories) : null;
  const lexRanked = lexIndex ? lexicalRank(intentText, lexIndex) : [];

  // 长度因子：短输入（"看看""继续"）embed 出来是泛化向量，跟谁都有点像，
  // 会把无关记忆顶进候选。压低它那一路的权重。词法路不受影响——
  // 输入短但写了专名时，那恰恰是最该信词法的时候。
  const wIntent = INTENT_BASE * lengthFactor(intentText.length || 0);
  const wContext = CONTEXT_BASE * lengthFactor(contextText.length || 0);

  let fused;
  if (rankA.length || rankB.length) {
    fused = rrfFuse([
      { ranking: rankA, weight: wIntent },
      { ranking: rankB, weight: wContext },
      { ranking: lexRanked.map(x => ({ record: memories.find(m => m.id === x.id), sim: -1 })).filter(x => x.record), weight: LEXICAL_BASE },
    ]).map(x => ({ record: x.record, similarity: x.bestSim, lexOnly: x.bestSim < 0 }));
  } else {
    fused = lexRanked.map(x => ({ record: memories.find(m => m.id === x.id), similarity: -1, lexOnly: true })).filter(x => x.record);
  }

  // 词法强行旁路：精确词命中的前几条，即便语义分不够也放进来。
  // 【为什么要旁路】中间地带那道实体过滤会把"语义分不高"的条目滤掉，
  // 但词法命中恰恰常常语义分不高（查询短、纸条短）。不给旁路的话，
  // 明写着"赫连铸"的纸条会因为 cosine 0.5 被当噪声丢掉，词法路等于白算。
  const quota = bypassQuota(memories.length);
  const bypassIds = new Set(lexRanked.slice(0, quota).map(x => x.id));

  const focus = focusEntities.filter(Boolean);
  const kept = [];
  for (const x of fused) {
    const lexBypass = bypassIds.has(x.record.id);
    if (!lexBypass && x.similarity < MIN_SIM) continue; // 太弱，丢（词法命中的豁免）
    const strong = x.similarity >= ENTITY_BYPASS_SIM;
    if (!strong && !lexBypass) {
      // 中间地带：必须提到当前焦点实体才保留，否则视为无关噪音滤掉
      const ents = x.record.entities || [];
      const hitByEntityField = focus.some(f => ents.includes(f));
      const hitByText = focus.some(f => f && x.record.text?.includes(f));
      if (!hitByEntityField && !hitByText) continue;
    }
    kept.push({
      record: x.record,
      similarity: x.similarity,
      // lexical：靠词法命中进来的（语义分不足但明写了查询词）。
      // 分出这一档是为了让 trace 看得出"这条是怎么进来的"。
      tier: strong ? "strong" : (lexBypass && x.similarity < MIN_SIM ? "lexical" : "weak"),
    });
    if (kept.length >= topK) break;
  }
  return kept;
}
