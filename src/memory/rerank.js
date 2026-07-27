// 召回精排 · cross-encoder 重排（可选，需要一次额外 API 调用）
// ============================================================================
// 【它跟前三路的分工】
// intent / context / 词法 三路都是**廉价的粗排**：向量点积和倒排查表都是本地算的，
// 拿到的是"大致相关的十几条"。粗排的通病是它只看查询和记忆各自的表示，
// 不看两者的交互——所以"少侠答应才旦找羊"和"少侠答应梅朵去赛马"在向量上很近，
// 粗排分不出你问的是哪一件。
//
// cross-encoder 把 (查询, 候选) 成对喂进模型，直接输出相关度。它贵，但准，
// 所以只用在粗排之后的十几条上，不碰全库。参考姬侠传 char_card_1 的
// module/reranker.js：模型 BAAI/bge-reranker-v2-m3，走 OpenAI 风格的 /rerank 端点
// （documents/query），超时或失败一律 fallback 回粗排顺序、绝不阻断主流程。
//
// 【为什么做成可选】它是每轮一次额外调用：多一份延迟、多一份花销、多一处要配的
// endpoint/key。收益是召回精度，而我们粗排刚补完词法路、基线已经不差。
// 所以默认关，跟 extractionEnabled 一个待遇——想要精度的人自己开。

const DEFAULT_MODEL = "BAAI/bge-reranker-v2-m3";
const DEFAULT_TIMEOUT = 12000;

// 端点补全：用户可能只填了 base（https://api.siliconflow.cn/v1）
// 也可能填了全路径。跟 apiConfig 里 URL 自动补全同一个思路。
export function resolveRerankUrl(endpoint) {
  const base = String(endpoint || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  if (/\/rerank$/i.test(base)) return base;
  return base + "/rerank";
}

// 精排。失败一律返回 null——调用方据此回退粗排顺序，绝不因为精排挂了就没有召回。
// candidates: [{ id, text }]
// 返回 [{ id, score }]（已按 score 降序、已按 minScore 过滤）或 null
export async function rerank(query, candidates, cfg = {}) {
  const url = resolveRerankUrl(cfg.endpoint);
  const key = String(cfg.apiKey || "").split(/[,;|\n]+/)[0]?.trim();
  const docs = (candidates || []).map(c => String(c?.text || "")).filter(Boolean);
  if (!url || !key || !query || docs.length < 2) return null;  // 少于2条没有排的意义

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeout || DEFAULT_TIMEOUT);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        query: String(query),
        documents: docs,
        top_n: Math.min(cfg.topN || docs.length, docs.length),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    // 兼容两种返回形态：{results:[{index,relevance_score}]} 与 {data:[...]}
    const rows = data?.results || data?.data;
    if (!Array.isArray(rows) || !rows.length) return null;
    const minScore = cfg.minScore ?? 0.1;
    const out = rows
      .map(r => {
        const idx = r.index ?? r.document?.index;
        const score = r.relevance_score ?? r.score;
        const cand = candidates[idx];
        return cand ? { id: cand.id, score: Number(score) || 0 } : null;
      })
      .filter(x => x && x.score >= minScore)
      .sort((a, b) => b.score - a.score);
    // 全被 minScore 滤掉时也回退——宁可用粗排顺序，也不要交一份空召回
    return out.length ? out : null;
  } catch {
    return null;   // 超时/网络/解析失败，一律回退
  } finally {
    clearTimeout(timer);
  }
}

// 把精排结果套回粗排列表：命中的按精排顺序提到前面，未命中的按原序接在后面。
// 【为什么不直接丢掉未命中的】精排的 minScore 是个经验阈值，把它当"删除线"太重了；
// 提到前面就够——后面的条目会被 topK 自然截掉。
export function applyRerank(fusedList, reranked) {
  if (!reranked || !reranked.length) return fusedList;
  const rank = new Map(reranked.map((r, i) => [r.id, i]));
  const hit = [], miss = [];
  for (const x of fusedList) {
    (rank.has(x.record?.id ?? x.id) ? hit : miss).push(x);
  }
  hit.sort((a, b) => rank.get(a.record?.id ?? a.id) - rank.get(b.record?.id ?? b.id));
  return [...hit, ...miss];
}
