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
function rrfFuse(rankA, rankB) {
  const acc = new Map(); // id -> { record, rrf, bestSim }
  const absorb = (ranking) => {
    ranking.forEach((item, idx) => {
      const id = item.record.id;
      const cur = acc.get(id) || { record: item.record, rrf: 0, bestSim: -1 };
      cur.rrf += 1 / (RRF_K + idx + 1);
      cur.bestSim = Math.max(cur.bestSim, item.sim);
      acc.set(id, cur);
    });
  };
  absorb(rankA);
  absorb(rankB);
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
export function recall({ memories, qIntentVec, qContextVec, focusEntities = [], topK = 5 }) {
  if (!memories || !memories.length) return [];

  const rankA = rankOnce(qIntentVec, memories);
  const rankB = qContextVec ? rankOnce(qContextVec, memories) : [];

  // 双路都有 → RRF 融合；只有一路 → 直接用那一路（把 sim 当作排序依据）
  let fused;
  if (rankA.length && rankB.length) {
    fused = rrfFuse(rankA, rankB).map(x => ({ record: x.record, similarity: x.bestSim }));
  } else {
    const single = rankA.length ? rankA : rankB;
    fused = single.map(x => ({ record: x.record, similarity: x.sim }));
  }

  const focus = focusEntities.filter(Boolean);
  const kept = [];
  for (const x of fused) {
    if (x.similarity < MIN_SIM) continue; // 太弱，丢
    const strong = x.similarity >= ENTITY_BYPASS_SIM;
    if (!strong) {
      // 中间地带：必须提到当前焦点实体才保留，否则视为无关噪音滤掉
      const ents = x.record.entities || [];
      const hitByEntityField = focus.some(f => ents.includes(f));
      const hitByText = focus.some(f => f && x.record.text?.includes(f));
      if (!hitByEntityField && !hitByText) continue;
    }
    kept.push({
      record: x.record,
      similarity: x.similarity,
      tier: strong ? "strong" : "weak",
    });
    if (kept.length >= topK) break;
  }
  return kept;
}
