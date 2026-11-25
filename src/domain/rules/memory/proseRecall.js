// 原文段落召回（纯计算，不碰网络/存储）——WO-18
// ------------------------------------------------------------------
// 与纸条召回（recallEngine.js，向量+词法三路 RRF）分工不同：
// 段落库没有 embedding（写时零成本原则），主路就是中文滑窗倒排词法检索；
// 「可选嵌入」若后续接入，在 ports 层融合，本模块保持纯函数。
//
// 三个机制：
//   1. witnesses 硬过滤：视角人物不在场见证的段落根本进不了候选——
//      这是「私密往事防串味」的硬约束，词法/向量相似度都给不了。
//   2. 词法打分：复用 lexical.js 的 idf 加权倒排（专名命中最值钱）。
//   3. 邻段连带：强相关前几名的段落，把同回合前后 ±1 段一起带出，
//      按序合并去重——单段切走上下文经常残缺，原文段落本就连续。

import { buildIndex, lexicalRank } from "./lexical.js";

// 强相关邻段连带的段落名额：只有前 N 名配得上拉邻段（再多的话场记板会被原文淹没）。
export const PROSE_NEIGHBOR_QUOTA = 3;
// 邻段半径：同回合前后各 1 段。
const NEIGHBOR_RADIUS = 1;

// witnesses 硬过滤：段落可见 ⇔ witnesses 含 "*"（公共）或含视角人物本人。
// viewer 为空时只看公共段——宁可少召回，不可串味。
export function filterVisibleChunks(chunks, viewer) {
  return (chunks || []).filter((c) => {
    const w = Array.isArray(c?.witnesses) ? c.witnesses : [];
    if (w.includes("*")) return true;
    return viewer ? w.includes(viewer) : false;
  });
}

// 段号解析：契约 id 为 P<turn>_<seq>；迁移老数据是 P<turn>_legacy…/P<turn>_note…
// 无数字段号的返回 null（不参与邻段连带，但本身仍可被召回）。
export function chunkSeq(chunk) {
  const m = /^P\d+_(\d+)$/.exec(chunk?.id || "");
  return m ? Number(m[1]) : null;
}

// 词法打分主路。返回按分数降序的 [{ chunk, score }]；query 无词时为空。
export function rankProseChunks(chunks, queryText, viewer) {
  const visible = filterVisibleChunks(chunks, viewer);
  if (!visible.length || !queryText) return [];
  // lexical.js 的倒排吃 {id,text,entities} 形状——publicText 是剥过他人心理的
  // 可示人文本，检索与展示都用它；rawText 永不出库。
  const docs = visible.map((c) => ({ id: c.id, text: c.publicText || "", entities: c.entities || [] }));
  const ranked = lexicalRank(queryText, buildIndex(docs));
  const byId = new Map(visible.map((c) => [c.id, c]));
  return ranked
    .map((r) => ({ chunk: byId.get(r.id), score: r.score }))
    .filter((x) => x.chunk);
}

// 邻段连带合并：取前 quota 名作为锚段，各自拉同 turn ±RADIUS 段，
// 按 (turn, seq) 排序后把相邻段号连续的分组拼成一段原文（\n 连接），
// 跨回合/不连续的各自独立成条。返回 [{ ids, turn, text, anchorScore, anchorId }]。
// 原字不改——合并只是拼接，绝不改写/摘要。
export function expandWithNeighbors(allChunks, hits, { quota = PROSE_NEIGHBOR_QUOTA } = {}) {
  if (!hits?.length) return [];
  const visibleIds = new Set((allChunks || []).map((c) => c.id));
  const byTurnSeq = new Map(); // `${turn}:${seq}` -> chunk
  for (const c of allChunks || []) {
    const seq = chunkSeq(c);
    if (seq != null) byTurnSeq.set(`${c.turn}:${seq}`, c);
  }

  // 锚段 + 邻段收集
  const wanted = new Map(); // id -> { chunk, anchorId, anchorScore }
  const anchors = hits.slice(0, quota);
  for (const hit of hits) {
    // 非锚命中也保留（不带邻段），免得高分段被挤出后完全消失
    if (!wanted.has(hit.chunk.id)) {
      wanted.set(hit.chunk.id, { chunk: hit.chunk, anchorId: hit.chunk.id, anchorScore: hit.score, isAnchor: anchors.includes(hit) });
    }
  }
  for (const anchor of anchors) {
    const seq = chunkSeq(anchor.chunk);
    if (seq == null) continue;
    for (let d = -NEIGHBOR_RADIUS; d <= NEIGHBOR_RADIUS; d++) {
      if (d === 0) continue;
      const nb = byTurnSeq.get(`${anchor.chunk.turn}:${seq + d}`);
      if (!nb || !visibleIds.has(nb.id)) continue;
      if (!wanted.has(nb.id)) {
        wanted.set(nb.id, { chunk: nb, anchorId: anchor.chunk.id, anchorScore: anchor.score, isAnchor: false });
      }
    }
  }

  // 按锚分组 → 组内按 (turn, seq) 排序 → 连续段合并
  const groups = new Map(); // anchorId -> entries[]
  for (const entry of wanted.values()) {
    if (!groups.has(entry.anchorId)) groups.set(entry.anchorId, []);
    groups.get(entry.anchorId).push(entry);
  }
  const out = [];
  for (const [anchorId, entries] of groups) {
    const anchorScore = entries.find((e) => e.isAnchor)?.anchorScore ?? entries[0].anchorScore;
    const sorted = entries
      .map((e) => e.chunk)
      .sort((a, b) => (a.turn - b.turn) || ((chunkSeq(a) ?? 1e9) - (chunkSeq(b) ?? 1e9)));
    let run = [];
    const flush = () => {
      if (!run.length) return;
      out.push({
        ids: run.map((c) => c.id),
        turn: run[0].turn,
        text: run.map((c) => c.publicText || "").filter(Boolean).join("\n"),
        anchorScore,
        anchorId,
      });
      run = [];
    };
    for (const c of sorted) {
      const prev = run[run.length - 1];
      const seq = chunkSeq(c);
      const contiguous = prev && c.turn === prev.turn && seq != null && chunkSeq(prev) != null && seq === chunkSeq(prev) + 1;
      if (!contiguous) flush();
      run.push(c);
    }
    flush();
  }
  // 锚分高的排前；同分按回合新到旧
  return out.sort((a, b) => (b.anchorScore - a.anchorScore) || (b.turn - a.turn));
}
