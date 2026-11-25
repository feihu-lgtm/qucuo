// 云端原文召回合并（纯函数，无网络/存储）——WO-20C
// ------------------------------------------------------------------
// 口径钉死：
// · 本地是新鲜权威——上行有 debounce（FLUSH_DEBOUNCE_MS），最近几段的本地副本
//   可能尚未上行；云端补的是跨设备/已同步历史。所以合并序固定「本地在前、云端补缺」，
//   不按 score 混排（两端 score 一为本 chunk 地词法分、一为服务端 RRF 分，量纲不可比）。
// · 去重按 turn+规范化文本（剥空白），不按 id——云端 chunkId 可能带 `${branchId}::`
//   命名空间前缀，与本地 IndexedDB id 形状不同，同段双上必须靠内容去重。
// · viewer 可见性客户端再滤一次：服务端已过滤也不信任坏响应——witnesses 不含
//   viewer 或 "*" 的块一律丢弃。
// · 文本按当前 viewer 现剥心理（stripOtherInnerThoughts(rawText)），与本地
//   visibleTextFor 同口径；无 rawText 降级 publicText。

import { stripOtherInnerThoughts } from "./proseChunker.js";

export function normalizeProseText(text) {
  return String(text || "").replace(/\s+/g, "");
}

// 单条云端 hit（含 neighbors）→ recallProse 条目形状；坏形状/不可见返回 null。
// 云端 hit 形状（hubCore hydrateRow）：{chunkId, turn, witnesses, rawText, publicText,
//   seq, branchId, score, neighbors:[同形状无 neighbors]}。
export function cloudHitToEntry(hit, viewer = "") {
  if (!hit || typeof hit !== "object") return null;
  if (typeof hit.chunkId !== "string" || !hit.chunkId) return null;
  if (!Number.isFinite(hit.turn)) return null;
  const w = Array.isArray(hit.witnesses) ? hit.witnesses : [];
  if (!(w.includes("*") || (viewer && w.includes(viewer)))) return null;

  // 锚段+邻段按 (seq, 原序) 排列拼块——与本地 expandWithNeighbors 同构；
  // 邻段自身也要过 viewer 过滤（坏响应可能塞未见证邻段）。
  const group = [hit, ...(Array.isArray(hit.neighbors) ? hit.neighbors : [])]
    .filter((c) => c && typeof c === "object")
    .filter((c) => {
      const cw = Array.isArray(c.witnesses) ? c.witnesses : [];
      return cw.includes("*") || (viewer && cw.includes(viewer));
    })
    .sort((a, b) => {
      const sa = Number.isInteger(a.seq) ? a.seq : 1e9;
      const sb = Number.isInteger(b.seq) ? b.seq : 1e9;
      return sa - sb;
    });
  const texts = group.map((c) => {
    const raw = String(c.rawText || "");
    if (raw) return stripOtherInnerThoughts(raw, viewer || "");
    return String(c.publicText || "");
  }).filter(Boolean);
  if (!texts.length) return null;
  return {
    ids: group.map((c) => String(c.chunkId || "")).filter(Boolean),
    turn: hit.turn,
    text: texts.join("\n"),
    witnesses: w,
    importance: 1, // 云端无 importance 列（上行不落），缺省 1
    anchorScore: Number.isFinite(hit.score) ? hit.score : 0,
  };
}

// 合并本地与云端条目：本地在前权威不动；云端逐条剥掉与本地同 turn 同文本的段落，
// 剥光整条不上；云端内部同样互去重。总条数 topK 封顶。
export function mergeCloudProseEntries(localEntries, cloudHits, { viewer = "", topK = 5 } = {}) {
  const local = Array.isArray(localEntries) ? localEntries : [];
  // 本地段落键：turn::规范化文本，按 \n 拆段逐段登记
  const seen = new Set();
  const register = (turn, text) => {
    for (const para of String(text || "").split("\n")) {
      const norm = normalizeProseText(para);
      if (norm) seen.add(`${turn}::${norm}`);
    }
  };
  for (const e of local) register(e?.turn, e?.text);

  const kept = [];
  for (const hit of cloudHits || []) {
    const entry = cloudHitToEntry(hit, viewer);
    if (!entry) continue;
    // 逐段 check-and-register 同一遍完成（Review 修）：锚段与邻段文本相同时，
    // 组内重复段也要剥——先查再登的两段式会让块内重复段双活，白吃场记板预算。
    const paras = [];
    for (const p of entry.text.split("\n")) {
      const norm = normalizeProseText(p);
      if (!norm) continue;
      const key = `${entry.turn}::${norm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      paras.push(p);
    }
    if (!paras.length) continue;
    kept.push({ ...entry, text: paras.join("\n") });
  }
  return [...local, ...kept].slice(0, topK);
}
