// WO-17 封存往事问答评测器：对比「小纸条检索」与「原文段落+邻段检索」召回准确率
// ------------------------------------------------------------------
// 不依赖真实 AI API：语料为内置封存 fixture（模拟老档的小纸条与正文段落），
// 检索两边都用同一套确定性中文词法打分（domain/rules/memory/lexical.js），
// 差异只在检索对象与邻段连带——这样才能把「载体检索力」单独拆出来评测。
//
// 用法：node scripts/memoryEval.mjs [--json]
// 退出码：0 正常；评测本身只是报告，不做硬门禁。

import { extractTerms } from "../src/domain/rules/memory/lexical.js";

// 词法重叠打分：query 的抽取词在文本里命中比例（专名优先，与 lexical.js 停用词口径一致）
function lexicalScore(query, text) {
  const terms = [...extractTerms(query)];
  if (!terms.length) return 0;
  const hits = terms.filter((t) => String(text).includes(t));
  return hits.length / terms.length;
}

// ── 封存语料：10 回合微型剧本，每回合有正文段落与对应小纸条 ─────────────
// 小纸条是 ≤50 字摘要（现有体制）；段落库是正文原文（WO-17 新体制）。
// 问答集针对「只有原文细节才答得上」与「摘要也够」两类问题混合。
const CORPUS = {
  notes: [
    { id: "n1", turn: 3, text: "少侠在雪山派演武场见呼延雪拍剑，限三日练出剑气否则翻脸" },
    { id: "n2", turn: 5, text: "卓玛请少侠三日后去跑马会，给他留了最好的位置" },
    { id: "n3", turn: 7, text: "少侠在草丛拾得一枚青铜铃" },
    { id: "n4", turn: 9, text: "桑杰朵杰说地契藏在经堂经架后" },
  ],
  chunks: [
    { id: "P3_1", turn: 3, text: "呼延雪将断念剑拍在石桌上，「三日后若还练不出剑气，莫怪我翻脸。」石桌应声裂了一道缝。", anchorFactIds: [] },
    { id: "P3_2", turn: 3, text: "少侠退后半步，瞥见她袖口露出一截红绳，绳上系着半枚铜钥匙。", anchorFactIds: [] },
    { id: "P5_1", turn: 5, text: "卓玛笑着说跑马会那天会有酥油茶和糌粑，「你一定要来，我给你留了最好的位置。」", anchorFactIds: [] },
    { id: "P7_1", turn: 7, text: "草丛里一点铜光，少侠俯身拾起一枚青铜铃，铃身刻着缠枝莲纹，摇一摇却哑然无声。", anchorFactIds: ["F7_1"] },
    { id: "P9_1", turn: 9, text: "桑杰朵杰压低声音：「地契不在我手上，在经堂第三排经架后面，用黄布包着。」", anchorFactIds: [] },
  ],
  qa: [
    { q: "呼延雪用什么威胁少侠？", gold: ["剑气", "翻脸"], note: "摘要可答" },
    { q: "呼延雪袖口藏着什么？", gold: ["红绳", "铜钥匙"], note: "仅原文细节" },
    { q: "青铜铃摇起来什么声音？", gold: ["哑然无声"], note: "仅原文细节" },
    { q: "地契藏在经堂哪里？", gold: ["第三排经架", "黄布"], note: "仅原文细节" },
    { q: "卓玛给少侠留了什么？", gold: ["位置"], note: "摘要可答" },
  ],
};

// ── 检索路 A：小纸条（现有体制的极简本地复刻：词法打分取 topK）─────────
function searchNotes(query, k = 2) {
  return CORPUS.notes
    .map((n) => ({ ...n, score: lexicalScore(query, n.text) }))
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// ── 检索路 B：原文段落 + 邻段连带召回（同 turn 相邻段号一并带回）─────────
function searchChunks(query, k = 2) {
  const hits = CORPUS.chunks
    .map((c) => ({ ...c, score: lexicalScore(query, c.text) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  // 邻段连带：命中段的同回合前后段一并入池（去重）
  const pool = new Map(hits.map((h) => [h.id, h]));
  for (const hit of hits) {
    const seq = Number(hit.id.match(/P\d+_(\d+)/)?.[1]);
    for (const neighborSeq of [seq - 1, seq + 1]) {
      const neighbor = CORPUS.chunks.find((c) => c.turn === hit.turn && c.id.endsWith(`_${neighborSeq}`));
      if (neighbor && !pool.has(neighbor.id)) pool.set(neighbor.id, { ...neighbor, score: 0 });
    }
  }
  return [...pool.values()];
}

function recallAtGold(retrieved, gold) {
  const haystack = retrieved.map((r) => r.text).join("\n");
  const hits = gold.filter((g) => haystack.includes(g));
  return hits.length / gold.length;
}

export function runEval() {
  const rows = CORPUS.qa.map(({ q, gold, note }) => {
    const notesRecall = recallAtGold(searchNotes(q), gold);
    const chunksRecall = recallAtGold(searchChunks(q), gold);
    return { q, note, notesRecall, chunksRecall };
  });
  const avg = (key) => rows.reduce((acc, r) => acc + r[key], 0) / rows.length;
  return { rows, notesAvg: avg("notesRecall"), chunksAvg: avg("chunksRecall") };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { rows, notesAvg, chunksAvg } = runEval();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ rows, notesAvg, chunksAvg }, null, 2));
  } else {
    console.log("封存往事问答评测：小纸条 vs 原文段落+邻段");
    for (const r of rows) {
      console.log(`  [${r.note}] ${r.q}  小纸条=${(r.notesRecall * 100).toFixed(0)}%  段落=${(r.chunksRecall * 100).toFixed(0)}%`);
    }
    console.log(`平均召回：小纸条=${(notesAvg * 100).toFixed(1)}%  原文段落+邻段=${(chunksAvg * 100).toFixed(1)}%`);
  }
}
