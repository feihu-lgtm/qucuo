// 复用并等价移植自 src/domain/rules/memory/lexical.js 的 2-4 字中文滑窗分词逻辑，
// 用于生成 FTS5 unicode61 空格分隔索引串与安全查询表达式。

export const STOP = new Set([
  "的", "了", "是", "在", "有", "和", "与", "也", "都", "就", "而", "又", "着", "过",
  "他", "她", "它", "你", "我", "们", "这", "那", "个", "之", "其", "一", "不", "没",
  "上", "下", "里", "外", "中", "去", "来", "说", "道", "看", "被", "把", "给", "对",
  "少侠", "旁白",
]);

const MIN_TERM = 2;

export function extractTerms(text) {
  const s = String(text || "");
  const terms = new Set();

  for (const m of s.matchAll(/[A-Za-z0-9\u30a0-\u30ff\u3040-\u309f]{2,}/g)) {
    terms.add(m[0].toLowerCase());
  }
  for (const m of s.matchAll(/[\u4e00-\u9fa5]{2,}/g)) {
    const seg = m[0];
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= seg.length; i++) {
        const t = seg.slice(i, i + n);
        if (t.length >= MIN_TERM && !STOP.has(t)) terms.add(t);
      }
    }
    if (seg.length > 4 && !STOP.has(seg)) terms.add(seg);
  }
  return terms;
}

export function segmentToSpaceString(text, entities = []) {
  const terms = extractTerms(text);
  for (const entity of entities || []) {
    const clean = String(entity || "").trim();
    if (clean.length >= MIN_TERM) terms.add(clean);
  }
  return [...terms].join(" ");
}

export function buildFtsQuery(queryText) {
  const terms = [...extractTerms(queryText)];
  if (!terms.length) return "";
  return terms.map((t) => `"${t.replace(/"/g, "\"\"")}"`).join(" OR ");
}
