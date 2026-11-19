// 词法召回 · 倒排索引（纯本地，零 API 开销）
// ============================================================================
// 【为什么向量之外还要一路词法】
// 向量最弱的地方恰恰是专有名词。"赫连铸""衔尾蛇门环""呼延雪"这类词，
// bge-m3 会把它们 embed 成一个大概位置，语义邻居一多，精确命中就被淹了：
// 玩家问"赫连铸后来怎么了"，一条明写着赫连铸的小纸条可能排在
// 三条"跟某个恶人打了一架"后面——因为那三条整句话更像查询。
//
// 而武侠叙事里全是专有名词，短纸条（≤50字）更是几乎由专名构成。
// 词法路做的就是：**明写了这个词的，必须能被找到**。
//
// 参考姬侠传 char_card_1 的 module/memory-recall.js：它是三路 RRF
// （intent 0.6 / context 0.4 / 词法 0.5），词法路还带两个关键设计：
//   · 子串展开：长词切成子串索引，"衔尾蛇门环" 也能被 "门环" 命中
//   · 强行旁路（LEXICAL_BYPASS_CAP）：精确词命中可以越过语义分挤进候选，
//     上限 min(5, 全量×20%)——不封顶的话一个常见字就能刷满结果
//
// 【为什么不做 alias】它那边有 aliasMap（别名→正名）。我们的 NPC 名字在
// residentNpcs 里是唯一的，暂时没有别名需求；真要加，扩 buildIndex 的 terms 即可。

// 停用词：这些字在武侠白话里到处都是，索引它们等于索引全部
const STOP = new Set([
  "的", "了", "是", "在", "有", "和", "与", "也", "都", "就", "而", "又", "着", "过",
  "他", "她", "它", "你", "我", "们", "这", "那", "个", "之", "其", "一", "不", "没",
  "上", "下", "里", "外", "中", "去", "来", "说", "道", "看", "被", "把", "给", "对",
  "少侠", "旁白",  // 几乎每条纸条都有，索引它们没有区分度
]);

const MIN_TERM = 2;          // 少于两字的不单独成词（单字噪声太大）
export const LEXICAL_BASE = 0.5;      // 词法路的 RRF 基准权重（不乘长度因子）
export const LEXICAL_BYPASS_CAP = 5;  // 强行旁路的绝对上限

// 从一段文本里抽词。中文没有空格，用两条互补的办法：
//   ① 连续的中文串按 2/3/4 字滑窗切（覆盖大部分人名地名物名）
//   ② 连续的西文/数字整段成词（Wunderbar、A.T.フィールド 这类）
export function extractTerms(text) {
  const s = String(text || "");
  const terms = new Set();

  // 西文/数字/假名整串
  for (const m of s.matchAll(/[A-Za-z0-9\u30a0-\u30ff\u3040-\u309f]{2,}/g)) {
    terms.add(m[0].toLowerCase());
  }
  // 中文串滑窗
  for (const m of s.matchAll(/[\u4e00-\u9fa5]{2,}/g)) {
    const seg = m[0];
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= seg.length; i++) {
        const t = seg.slice(i, i + n);
        if (t.length >= MIN_TERM && !STOP.has(t)) terms.add(t);
      }
    }
    // 整段也进（长专名如"衔尾蛇门环"本身）
    if (seg.length > 4 && !STOP.has(seg)) terms.add(seg);
  }
  return terms;
}

// 建倒排索引。memories: [{ id, text, entities? }]
// entities 里的名字额外加权——那是系统标注的实体，比滑窗切出来的碎片可信。
export function buildIndex(memories) {
  const inverted = new Map();   // term -> Map<id, weight>
  const docCount = (memories || []).length;
  for (const m of memories || []) {
    if (!m || !m.id) continue;
    const terms = extractTerms(m.text);
    for (const e of m.entities || []) {
      if (e && String(e).length >= MIN_TERM) terms.add(String(e));
    }
    for (const t of terms) {
      if (!inverted.has(t)) inverted.set(t, new Map());
      // 实体字段命中权重 1.0，滑窗碎片 0.5（同姬侠传的 termMatchFactor 思路）
      const isEntity = (m.entities || []).includes(t);
      inverted.get(t).set(m.id, Math.max(inverted.get(t).get(m.id) || 0, isEntity ? 1 : 0.5));
    }
  }
  return { inverted, docCount };
}

// 词法检索：返回按分数降序的 [{ id, score }]。
// 分数用 idf 加权——"雪山派"出现在半数纸条里就不该和"衔尾蛇门环"一样值钱。
export function lexicalRank(query, index) {
  if (!index || !index.inverted) return [];
  const qTerms = extractTerms(query);
  if (!qTerms.size) return [];
  const acc = new Map();
  for (const t of qTerms) {
    const posting = index.inverted.get(t);
    if (!posting) continue;
    // idf：命中文档越少越值钱
    const idf = Math.log(1 + index.docCount / (1 + posting.size));
    // 长词比短词值钱（"衔尾蛇门环" > "门环"）
    const lenBoost = Math.min(2, t.length / 2);
    for (const [id, w] of posting) {
      acc.set(id, (acc.get(id) || 0) + idf * w * lenBoost);
    }
  }
  return Array.from(acc.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

// 长度因子：玩家输入很短时压低 intent 路权重。
// 【为什么】"看看""继续"这类短输入 embed 出来是个泛化向量，跟谁都有点像，
// 会把一堆无关记忆顶进候选。姬侠传的做法是 n>=100→1.0、n<=0→0.35 线性插值，
// 这里沿用（我们单轮输入通常比它短，所以上界取 60 更贴我们的实际分布）。
export function lengthFactor(n, full = 60) {
  const len = Number(n) || 0;
  if (len >= full) return 1.0;
  if (len <= 0) return 0.35;
  return 0.35 + 0.65 * (len / full);
}

// 词法强行旁路的名额：min(绝对上限, ceil(全量×20%))。
// 不封顶的话，一个常见词就能把结果刷满，语义路等于白算。
export function bypassQuota(docCount) {
  return Math.max(0, Math.min(LEXICAL_BYPASS_CAP, Math.ceil((docCount || 0) * 0.2)));
}
