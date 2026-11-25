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
import { stripOtherInnerThoughts } from "./proseChunker.js";

// 强相关邻段连带的段落名额：只有前 N 名配得上拉邻段（再多的话场记板会被原文淹没）。
export const PROSE_NEIGHBOR_QUOTA = 3;
// 邻段半径：同回合前后各 1 段。
const NEIGHBOR_RADIUS = 1;

// witnesses 硬过滤：段落可见 ⇔ witnesses 含 "*"（公共）或含视角人物本人。
// viewer 为空时只看公共段——宁可少召回，不可串味。
export function filterVisibleChunks(chunks, viewer, { epoch, currentTurn } = {}) {
  return (chunks || []).filter((c) => {
    // 回合上限：不晚于当前回合才可见（防未来剧透）。
    // 注：saveEpoch 时间线隔离方案暂停——gameEpoch 是内存计数器不可持久化，
    // 等调度裁决持久身份方案后再补（epoch 参数保留在接口里不接逻辑）。
    if (Number.isFinite(currentTurn) && Number.isFinite(c?.turn) && c.turn > currentTurn) return false;
    const w = Array.isArray(c?.witnesses) ? c.witnesses : [];
    if (w.includes("*")) return true;
    return viewer ? w.includes(viewer) : false;
  });
}

// 段号解析：契约 id 为 P<turn>_<seq>；迁移老数据是 P<turn>_legacy…/P<turn>_note…
// 无数字段号的返回 null（不参与邻段连带，但本身仍可被召回）。
export function chunkSeq(chunk) {
  // 新格式 P<saveEpoch>_<turn>_<seq> 三段数字；legacy P<turn>_<seq> 两段；
  // 迁移老数据 P<turn>_legacy…/P<turn>_note… 无数字段号 → null（不参与邻段连带）。
  const parts = String(chunk?.id || "").split("_");
  // 除 P 头外全部位都是数字才算契约段号（legacy/note 中段含字母 → null）
  const ok = parts.length >= 2 && parts.length <= 3 && /^P\d+$/.test(parts[0]) && parts.slice(1).every((x) => /^\d+$/.test(x));
  return ok ? Number(parts[parts.length - 1]) : null;
}

// 召回侧动态可见文本：写库即定稿的 publicText 是按写入时视角剥的——
// 未来 NPC 视角召回必须能恢复自己的心理，所以检索/展示一律按当前 viewer
// 用 rawText 现算；老数据没有 rawText 才降级 publicText。
export function visibleTextFor(chunk, viewer) {
  const raw = chunk?.rawText || "";
  if (raw) return stripOtherInnerThoughts(raw, viewer || "");
  return chunk?.publicText || "";
}

// 词法打分主路。返回按分数降序的 [{ chunk, score }]；query 无词时为空。
export function rankProseChunks(chunks, queryText, viewer, scope = {}) {
  const visible = filterVisibleChunks(chunks, viewer, scope);
  if (!visible.length || !queryText) return [];
  const docs = visible.map((c) => ({ id: c.id, text: visibleTextFor(c, viewer), entities: c.entities || [] }));
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
export function expandWithNeighbors(allChunks, hits, { quota = PROSE_NEIGHBOR_QUOTA, viewer = "", epoch, currentTurn } = {}) {
  if (!hits?.length) return [];
  // fix：邻段只能在 viewer 可见段里拉——全库 id 会把未见证段带进来。
  const visible = filterVisibleChunks(allChunks, viewer, { epoch, currentTurn });
  const visibleIds = new Set(visible.map((c) => c.id));
  const byTurnSeq = new Map();
  for (const c of visible) {
    const seq = chunkSeq(c);
    if (seq != null) byTurnSeq.set(`${c.turn}:${seq}`, c);
  }

  // 收集候选池：前 quota 锚 + 各自 ±RADIUS 可见邻段 + 全部命中。
  // 池化后按 (turn, seq) 连续段合并——相邻多段同时命中自然并成一块，
  // 每段全池只出现一次，不按锚拆组。
  const pool = new Map(); // id -> { chunk, bestScore }
  const anchors = hits.slice(0, quota);
  const put = (chunk, score) => {
    const cur = pool.get(chunk.id);
    if (!cur) pool.set(chunk.id, { chunk, bestScore: score });
    else cur.bestScore = Math.max(cur.bestScore, score);
  };
  for (const hit of hits) put(hit.chunk, hit.score);
  for (const anchor of anchors) {
    const seq = chunkSeq(anchor.chunk);
    if (seq == null) continue;
    for (let d = -NEIGHBOR_RADIUS; d <= NEIGHBOR_RADIUS; d++) {
      if (d === 0) continue;
      const nb = byTurnSeq.get(`${anchor.chunk.turn}:${seq + d}`);
      if (!nb || !visibleIds.has(nb.id)) continue;
      if (!pool.has(nb.id)) pool.set(nb.id, { chunk: nb, bestScore: anchor.score * 0.5 });
    }
  }

  // 按 (turn, seq) 排序后连续段合并成块；块分 = 组内最高分
  const sorted = [...pool.values()]
    .map((e) => ({ ...e, seq: chunkSeq(e.chunk) }))
    .sort((a, b) => (a.chunk.turn - b.chunk.turn) || ((a.seq ?? 1e9) - (b.seq ?? 1e9)));
  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    out.push({
      ids: run.map((e) => e.chunk.id),
      turn: run[0].chunk.turn,
      text: run.map((e) => visibleTextFor(e.chunk, viewer)).filter(Boolean).join("\n"),
      anchorScore: Math.max(...run.map((e) => e.bestScore)),
      // 场记板渲染要用的元数据：见证名单取块内首段（同块同回合同场，归属一致）；
      // importance 取块内最高——有一段刻骨整段经历都该加戳。
      witnesses: run[0].chunk.witnesses || [],
      importance: Math.max(...run.map((e) => e.chunk.importance || 1)),
    });
    run = [];
  };
  for (const e of sorted) {
    const prev = run[run.length - 1];
    const contiguous = prev && e.chunk.turn === prev.chunk.turn && e.seq != null && prev.seq != null && e.seq === prev.seq + 1;
    if (!contiguous) flush();
    run.push(e);
  }
  flush();
  return out.sort((a, b) => (b.anchorScore - a.anchorScore) || (b.turn - a.turn));
}
