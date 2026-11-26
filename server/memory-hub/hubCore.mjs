import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { buildFtsQuery, segmentToSpaceString } from "./ftsTokenizer.mjs";

const SCHEMA_SQL = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const RRF_K = 60;
// body 键名大小写不敏感 canonicalize——"apiKey"/"ApiKey"/"APIKEY" 同罪；
// 键集合全小写存储，比较时统一 toLowerCase。
const API_KEY_KEYS = new Set(["apikey", "api_key", "customkey", "openaikey", "geminikey", "anthropickey", "authorization"]);

export function assertNoApiKeyPayload(obj, seen = new Set()) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return;
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (const item of obj) assertNoApiKeyPayload(item, seen);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof k === "string" && API_KEY_KEYS.has(k.toLowerCase()) && v) {
      const err = new Error("server/memory-hub 不接收也不中转任何模型 API Key");
      err.status = 400;
      throw err;
    }
    if (v && typeof v === "object") assertNoApiKeyPayload(v, seen);
  }
}

export function openHubDb(dbPath = ":memory:") {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA_SQL);
  // 存量库列补齐：CREATE TABLE IF NOT EXISTS 不会给老库加新列——
  // embedding_model/embedding_dim 是 WO-20 复审后加的，ALTER 幂等补齐。
  const cols = new Set(db.prepare("PRAGMA table_info(prose_chunks)").all().map((r) => r.name));
  if (!cols.has("embedding_model")) db.exec("ALTER TABLE prose_chunks ADD COLUMN embedding_model TEXT");
  if (!cols.has("embedding_dim")) db.exec("ALTER TABLE prose_chunks ADD COLUMN embedding_dim INTEGER");
  if (!cols.has("seq")) db.exec("ALTER TABLE prose_chunks ADD COLUMN seq INTEGER");
  if (!cols.has("branch_id")) db.exec("ALTER TABLE prose_chunks ADD COLUMN branch_id TEXT");
  return db;
}

function encodeEmbedding(vec) {
  if (!vec) return null;
  const arr = vec instanceof Float32Array ? vec : Float32Array.from(vec);
  if (!arr.length) return null;
  return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}

function decodeEmbedding(blob) {
  if (!blob || blob.byteLength === 0 || blob.byteLength % 4 !== 0) return null;
  const view = new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength);
  const copy = view.slice();
  return new Float32Array(copy.buffer);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function parseJsonArray(raw, fallback = []) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function canViewerSeeChunk(witnesses, viewer) {
  if (!Array.isArray(witnesses) || !witnesses.length) return false;
  if (witnesses.includes("*")) return true;
  return Boolean(viewer) && witnesses.includes(viewer);
}

// 时间线可见性——与 src/domain/rules/memory/lineage.js 的 branchVisible 同口径复制
// （server 保持纯 node 内置依赖独立部署，不 import 客户端 src；改口径必须双侧同步）。
//   chunk.branchId 必须命中谱系某分支；非头 turn<upTo 可见、turn=upTo 且有
//   upToSeq/chunk.seq 时按 seq 边界；头分支 turn<=currentTurn；无 branchId 一律不可见。
export function branchVisibleServer(chunk, lineage, currentTurn) {
  const bid = chunk?.branchId;
  if (!bid || !Array.isArray(lineage)) return false;
  const branch = lineage.find((e) => e && e.b === bid);
  if (!branch) return false;
  const turn = chunk?.turn;
  if (!Number.isFinite(turn)) return false;
  if (branch.upTo === null) {
    return Number.isFinite(currentTurn) ? turn <= currentTurn : true;
  }
  if (turn < branch.upTo) return true;
  if (turn > branch.upTo) return false;
  if (Number.isFinite(branch.upToSeq) && Number.isFinite(chunk?.seq)) {
    return chunk.seq <= branch.upToSeq;
  }
  return true;
}

// ── WO-20B1 谱系/地点条件下推 FTS SQL ─────────────────────────────────────
// 与 branchVisibleServer 严格同口径（改口径必须双侧同步）：
//   head upTo=null → turn<=currentTurn（currentTurn 不有限则整支可见）；
//   非头 turn<upTo 恒可见；turn=upTo 时 upToSeq 有限则要求 seq IS NULL（老数据兼容）
//   或 seq<=upToSeq，upToSeq 不有限则可见；无 branchId/谱系外分支恒不可见——
//   SQL 里不存在任何分支条件即 1=0，天然排除 NULL branch_id。
// 同分支重复条目按 JS find 语义只认第一条。
export function buildLineageSql(lineage, currentTurn, col = "c") {
  const parts = [];
  const params = [];
  const seen = new Set();
  for (const e of Array.isArray(lineage) ? lineage : []) {
    if (!e || typeof e.b !== "string" || !e.b || seen.has(e.b)) continue;
    seen.add(e.b);
    if (e.upTo === null) {
      if (Number.isFinite(currentTurn)) {
        parts.push(`(${col}.branch_id = ? AND ${col}.turn <= ?)`);
        params.push(e.b, currentTurn);
      } else {
        parts.push(`(${col}.branch_id = ?)`);
        params.push(e.b);
      }
    } else {
      // 数字字符串容错（复审）：JS branchVisibleServer 的 turn<branch.upTo 比较会
      // 隐式 coercion 把 "6" 当 6 用——SQL 若按 Number.isFinite 严格判定会把整支
      // 丢弃，向量召回仍进、关键词召回消失，两路口径裂开。此处对齐 coercion 语义。
      const upToNum = Number.isFinite(e.upTo) ? e.upTo
        : (typeof e.upTo === "string" && e.upTo.trim() !== "" && Number.isFinite(Number(e.upTo)) ? Number(e.upTo) : null);
      const upToSeqNum = Number.isFinite(e.upToSeq) ? e.upToSeq
        : (typeof e.upToSeq === "string" && e.upToSeq.trim() !== "" && Number.isFinite(Number(e.upToSeq)) ? Number(e.upToSeq) : null);
      if (upToNum === null) continue; // 既非数字也非数字字符串也非 null——畸形条目不认
      if (upToSeqNum !== null) {
        parts.push(`(${col}.branch_id = ? AND (${col}.turn < ? OR (${col}.turn = ? AND (${col}.seq IS NULL OR ${col}.seq <= ?))))`);
        params.push(e.b, upToNum, upToNum, upToSeqNum);
      } else {
        parts.push(`(${col}.branch_id = ? AND ${col}.turn <= ?)`);
        params.push(e.b, upToNum);
      }
    }
  }
  if (!parts.length) return { clause: "1 = 0", params: [] };
  return { clause: `(${parts.join(" OR ")})`, params };
}

function parseSeqFromChunkId(chunkId) {
  const parts = String(chunkId || "").split("_");
  const last = Number(parts[parts.length - 1]);
  return Number.isInteger(last) ? last : null;
}

export function createHubStore(dbOrPath = ":memory:") {
  const db = typeof dbOrPath === "string" ? openHubDb(dbOrPath) : dbOrPath;

  const stmtGetSave = db.prepare(
    "SELECT space_id, slot_id, rev, payload_enc, updated_at FROM saves WHERE space_id = ? AND slot_id = ?",
  );
  const stmtListSaves = db.prepare(
    "SELECT slot_id, rev, updated_at FROM saves WHERE space_id = ? ORDER BY updated_at DESC, slot_id ASC",
  );
  const stmtInsertSave = db.prepare(
    "INSERT INTO saves(space_id, slot_id, rev, payload_enc, updated_at) VALUES (?, ?, ?, ?, ?)",
  );
  const stmtUpdateSave = db.prepare(
    "UPDATE saves SET rev = ?, payload_enc = ?, updated_at = ? WHERE space_id = ? AND slot_id = ? AND rev = ?",
  );

  const stmtInsertChunk = db.prepare(`
    INSERT OR IGNORE INTO prose_chunks (
      space_id, batch_id, chunk_id, turn, location,
      witnesses_json, entities_json, raw_text, public_text, terms_segmented, embedding_blob,
      embedding_model, embedding_dim, seq, branch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stmtSpaceChunks = db.prepare(`
    SELECT id, space_id, batch_id, chunk_id, turn, location,
           witnesses_json, entities_json, raw_text, public_text, terms_segmented, embedding_blob,
           embedding_model, embedding_dim, seq, branch_id
    FROM prose_chunks
    WHERE space_id = ?
      AND (? IS NULL OR turn <= ?)
    ORDER BY turn ASC, id ASC
  `);

  const stmtFtsSearch = db.prepare(`
    SELECT c.id, bm25(prose_fts) AS bm25_score
    FROM prose_fts
    JOIN prose_chunks c ON c.id = prose_fts.rowid
    WHERE prose_fts MATCH ?
      AND c.space_id = ?
      AND (? IS NULL OR c.turn <= ?)
    ORDER BY bm25_score ASC, c.turn DESC, c.id DESC
    LIMIT ?
  `);

  const stmtDeleteChunks = db.prepare("DELETE FROM prose_chunks WHERE space_id = ?");
  const stmtDeleteSaves = db.prepare("DELETE FROM saves WHERE space_id = ?");

  function putSave(spaceId, slotId, { expectedRev = 0, payloadEnc, updatedAt = Date.now(), force = false } = {}) {
    force = force === true; // 严格布尔——force:"false" 字符串不生效
    if (!spaceId || !slotId) throw new Error("spaceId and slotId are required");
    if (typeof payloadEnc !== "string") throw new Error("payloadEnc must be an opaque ciphertext string");
    if (!Number.isInteger(expectedRev) || expectedRev < 0) throw new Error("expectedRev must be a non-negative integer");

    db.exec("BEGIN IMMEDIATE");
    try {
      const existing = stmtGetSave.get(spaceId, slotId);
      // force 只能由客户端玩家显式裁决触发（WO-19 「本地覆盖云端」唯一合法路径）——
      // 跳过 expectedRev 冲突检查直接覆盖；自动同步流程绝不许带 force。
      if (!existing) {
        if (expectedRev !== 0 && !force) {
          db.exec("ROLLBACK");
          return { ok: false, status: 409, conflict: true, currentRev: 0, serverRev: 0, reason: "save_not_found_rev_mismatch" };
        }
        // tombstone 高水位：删过的槽重建从 highwater+1 起——旧设备拿删除前
        // expectedRev=1 的过期写永远落不进新一代。
        const tomb = db.prepare("SELECT high_rev FROM save_tombstones WHERE space_id = ? AND slot_id = ?").get(spaceId, slotId);
        const firstRev = (tomb?.high_rev || 0) + 1;
        stmtInsertSave.run(spaceId, slotId, firstRev, payloadEnc, updatedAt);
        db.exec("COMMIT");
        return { ok: true, status: 200, spaceId, slotId, rev: firstRev, updatedAt };
      }
      if (existing.rev !== expectedRev && !force) {
        db.exec("ROLLBACK");
        // serverRev 是 canonical 契约字段；currentRev 保留兼容老调用方。
        return { ok: false, status: 409, conflict: true, currentRev: existing.rev, serverRev: existing.rev, reason: "rev_mismatch" };
      }
      const nextRev = existing.rev + 1;
      if (force) {
        db.prepare("UPDATE saves SET rev = ?, payload_enc = ?, updated_at = ? WHERE space_id = ? AND slot_id = ?")
          .run(nextRev, payloadEnc, updatedAt, spaceId, slotId);
      } else {
        stmtUpdateSave.run(nextRev, payloadEnc, updatedAt, spaceId, slotId, existing.rev);
      }
      db.exec("COMMIT");
      return { ok: true, status: 200, spaceId, slotId, rev: nextRev, updatedAt };
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw err;
    }
  }

  function getSave(spaceId, slotId) {
    const row = stmtGetSave.get(spaceId, slotId);
    if (!row) return null;
    return {
      spaceId: row.space_id,
      slotId: row.slot_id,
      rev: row.rev,
      payloadEnc: row.payload_enc,
      updatedAt: row.updated_at,
    };
  }

  function listSaves(spaceId) {
    return stmtListSaves.all(spaceId).map((r) => ({
      slotId: r.slot_id,
      rev: r.rev,
      updatedAt: r.updated_at,
    }));
  }

  function appendProseChunks(spaceId, batchId, chunks = []) {
    if (!spaceId || !batchId) throw new Error("spaceId and batchId are required");
    if (!Array.isArray(chunks)) throw new Error("chunks must be an array");

    db.exec("BEGIN IMMEDIATE");
    let inserted = 0;
    try {
      for (const c of chunks) {
        assertNoApiKeyPayload(c);
        const chunkId = String(c?.chunkId ?? c?.id ?? "");
        const turn = Number(c?.turn);
        if (!chunkId || !Number.isFinite(turn)) continue;
        const witnesses = Array.isArray(c.witnesses) && c.witnesses.length ? c.witnesses : ["*"];
        const entities = Array.isArray(c.entities) ? c.entities : [];
        const rawText = String(c.rawText || "");
        const publicText = String(c.publicText ?? rawText);
        const segmented = typeof c.termsSegmented === "string" && c.termsSegmented.trim()
          ? c.termsSegmented.trim()
          : segmentToSpaceString(rawText || publicText, entities);
        const blob = encodeEmbedding(c.embedding);
        // 向量元数据是 roadmap 硬要求：每条向量必须记下模型名与维度。
        // 模型名只认显式申报（绝不猜）；维度未申报时取向量长度兜底。
        const vecLen = c.embedding ? (c.embedding.length ?? c.embedding?.length ?? 0) : 0;
        const embeddingModel = typeof c.embeddingModel === "string" && c.embeddingModel.trim() ? c.embeddingModel.trim() : null;
        // 维度以实际向量长度为准：显式 embeddingDim 与长度不一致直接 400——
        // 落库成永远召不回的行比拒写更难排查。
        if (blob && Number.isInteger(c.embeddingDim) && c.embeddingDim !== vecLen) {
          const err = new Error(`embeddingDim (${c.embeddingDim}) 与向量实际长度 (${vecLen}) 不一致`);
          err.status = 400;
          throw err;
        }
        const embeddingDim = Number.isInteger(c.embeddingDim) && c.embeddingDim > 0
          ? c.embeddingDim
          : (blob && Number.isFinite(vecLen) && vecLen > 0 ? vecLen : null);
        const info = stmtInsertChunk.run(
          spaceId,
          batchId,
          chunkId,
          turn,
          String(c.location || ""),
          JSON.stringify(witnesses),
          JSON.stringify(entities),
          rawText,
          publicText,
          segmented,
          blob,
          blob ? embeddingModel : null,
          blob ? embeddingDim : null,
          Number.isInteger(c.seq) ? c.seq : null,
          typeof c.branchId === "string" && c.branchId ? c.branchId : null,
        );
        inserted += info.changes;
      }
      db.exec("COMMIT");
      return { ok: true, spaceId, batchId, inserted, total: chunks.length };
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw err;
    }
  }

  function hydrateRow(row) {
    return {
      rowid: row.id,
      spaceId: row.space_id,
      batchId: row.batch_id,
      chunkId: row.chunk_id,
      turn: row.turn,
      location: row.location,
      witnesses: parseJsonArray(row.witnesses_json),
      entities: parseJsonArray(row.entities_json),
      rawText: row.raw_text,
      publicText: row.public_text,
      seq: Number.isInteger(row.seq) ? row.seq : null,
      branchId: row.branch_id || null,
    };
  }

  function queryProseChunks(spaceId, {
    query = "",
    viewer = "",
    location = "",
    maxTurn = null,
    queryEmbedding = null,
    queryEmbeddingModel = "",
    queryEmbeddingDim = null,
    topK = 5,
    neighborRadius = 1,
    lineage = null,
    currentTurn = null,
  } = {}) {
    if (!spaceId) throw new Error("spaceId is required");
    // 谱系传入时走时间线硬过滤（branchVisible 同口径）；未传才退回 maxTurn 宽松路径。
    // chunkId 里 branchId 自带下划线不可拆——服务端不存/不过滤的话，
    // 未来接线后 topK 先被旧未来/别分支污染，客户端再补救来不及。
    const useLineage = Array.isArray(lineage) && lineage.length > 0;
    const maxTurnVal = useLineage ? null : (Number.isFinite(maxTurn) ? maxTurn : null);
    const allRows = stmtSpaceChunks.all(spaceId, maxTurnVal, maxTurnVal);
    const visibleRows = allRows.filter((row) => {
      if (location && row.location !== location) return false;
      if (useLineage && !branchVisibleServer(
        { branchId: row.branch_id, turn: row.turn, seq: Number.isInteger(row.seq) ? row.seq : undefined },
        lineage,
        Number.isFinite(currentTurn) ? currentTurn : null,
      )) return false;
      return canViewerSeeChunk(parseJsonArray(row.witnesses_json), viewer);
    });
    if (!visibleRows.length) return { hits: [], results: [] };

    const visibleById = new Map(visibleRows.map((r) => [r.id, r]));
    const ftsQuery = buildFtsQuery(query);
    // WO-20B1：谱系/地点条件下推进 SQL——候选 cap 不再先于谱系截取，
    // 别分支/旧未来高评分副本挤占 topK 候选的问题在服务端消除。
    // viewer 的 witnesses JSON 仍 JS 过滤（数组嵌套不宜下推），故 cap 后
    // visibleById 过滤保留——它现在只挡 witnesses，不再挡谱系。
    let ftsRows = [];
    if (ftsQuery) {
      const where = ["prose_fts MATCH ?", "c.space_id = ?"];
      const params = [ftsQuery, spaceId];
      if (useLineage) {
        const lin = buildLineageSql(lineage, Number.isFinite(currentTurn) ? currentTurn : null);
        where.push(lin.clause);
        params.push(...lin.params);
      } else {
        where.push("(? IS NULL OR c.turn <= ?)");
        params.push(maxTurnVal, maxTurnVal);
      }
      if (location) {
        where.push("c.location = ?");
        params.push(location);
      }
      const sql = `
        SELECT c.id, bm25(prose_fts) AS bm25_score
        FROM prose_fts
        JOIN prose_chunks c ON c.id = prose_fts.rowid
        WHERE ${where.join("\n          AND ")}
        ORDER BY bm25_score ASC, c.turn DESC, c.id DESC
        LIMIT ?
      `;
      ftsRows = db.prepare(sql).all(...params, Math.max(topK * 4, 20))
        .filter((r) => visibleById.has(r.id));
    }

    const qVec = queryEmbedding
      ? (queryEmbedding instanceof Float32Array ? queryEmbedding : Float32Array.from(queryEmbedding))
      : null;
    // 换模型/换维度后旧向量绝不参与比较（roadmap 硬要求）：
    // 行必须显式带 embedding_model 且与查询申报模型逐字相同，维度与查询向量等长
    // （或等于显式 queryEmbeddingDim）。无元数据的旧行只做关键词召回。
    if (qVec && Number.isInteger(queryEmbeddingDim) && queryEmbeddingDim !== qVec.length) {
      const err = new Error(`queryEmbeddingDim (${queryEmbeddingDim}) 与查询向量实际长度 (${qVec.length}) 不一致`);
      err.status = 400;
      throw err;
    }
    const qDim = Number.isInteger(queryEmbeddingDim) && queryEmbeddingDim > 0 ? queryEmbeddingDim : (qVec ? qVec.length : null);
    const qModel = typeof queryEmbeddingModel === "string" ? queryEmbeddingModel.trim() : "";
    const vecRanked = qVec && qModel
      ? visibleRows
          .filter((row) => row.embedding_model === qModel && row.embedding_dim === qDim)
          .map((row) => ({ id: row.id, sim: cosineSimilarity(qVec, decodeEmbedding(row.embedding_blob)) }))
          .filter((x) => x.sim > 0)
          .sort((a, b) => b.sim - a.sim)
      : [];

    const rrfMap = new Map();
    ftsRows.forEach((r, idx) => {
      const cur = rrfMap.get(r.id) || { row: visibleById.get(r.id), score: 0, bm25: r.bm25_score, sim: null };
      cur.score += 1 / (RRF_K + idx + 1);
      cur.bm25 = r.bm25_score;
      rrfMap.set(r.id, cur);
    });
    vecRanked.forEach((r, idx) => {
      const cur = rrfMap.get(r.id) || { row: visibleById.get(r.id), score: 0, bm25: null, sim: r.sim };
      cur.score += 1 / (RRF_K + idx + 1);
      cur.sim = r.sim;
      rrfMap.set(r.id, cur);
    });

    const ranked = [...rrfMap.values()]
      .sort((a, b) => (b.score - a.score) || (b.row.turn - a.row.turn))
      .slice(0, topK);

    // 同回合前后邻段：按 visibleRows 内同一 turn 的顺序或显式 seq 扩展 ±neighborRadius
    const byTurn = new Map();
    for (const row of visibleRows) {
      const list = byTurn.get(row.turn) || [];
      list.push(row);
      byTurn.set(row.turn, list);
    }

    const hits = ranked.map((entry) => {
      const anchor = hydrateRow(entry.row);
      const siblings = byTurn.get(entry.row.turn) || [];
      const idx = siblings.findIndex((s) => s.id === entry.row.id);
      const anchorSeq = parseSeqFromChunkId(entry.row.chunk_id);
      const neighbors = [];
      for (let i = 0; i < siblings.length; i++) {
        const s = siblings[i];
        if (s.id === entry.row.id) continue;
        // 邻段距离优先吃显式 seq 列——chunkId 派生 id 会带导入戳后缀、
        // branchId 本身也可能含下划线，拆 id 尾段在这两种情况下都会断邻段。
        const anchorSeqCol = Number.isInteger(entry.row.seq) ? entry.row.seq : null;
        const rowSeqCol = Number.isInteger(s.seq) ? s.seq : null;
        if (anchorSeqCol !== null && rowSeqCol !== null) {
          // 两侧都有显式 seq 时只按 seq 距离判——稀疏 seq（中段属于别分支/不可见）
          // 不能再被数组顺序 OR 放行连带。
          if (Math.abs(rowSeqCol - anchorSeqCol) <= neighborRadius) neighbors.push(hydrateRow(s));
          continue;
        }
        const seqA = anchorSeqCol ?? anchorSeq;
        const seqB = rowSeqCol ?? parseSeqFromChunkId(s.chunk_id);
        const bySeq = seqA !== null && seqB !== null && Math.abs(seqB - seqA) <= neighborRadius;
        const byOrder = idx >= 0 && Math.abs(i - idx) <= neighborRadius;
        if (bySeq || byOrder) neighbors.push(hydrateRow(s));
      }
      return {
        ...anchor,
        score: entry.score,
        bm25: entry.bm25,
        similarity: entry.sim,
        neighbors,
      };
    });

    // 扁平化不重复块集合（保留顺序）
    const seenIds = new Set();
    const results = [];
    for (const hit of hits) {
      // 组内排序：两侧都有显式 seq 按 seq——乱序插入（9,2,3,1）rowid 与 seq 脱节时
      // 返回顺序仍按真实先后；缺 seq 才 rowid 兜底。
      const group = [hit, ...hit.neighbors].sort((a, b) => {
        if (a.turn !== b.turn) return a.turn - b.turn;
        if (Number.isInteger(a.seq) && Number.isInteger(b.seq)) return a.seq - b.seq;
        return a.rowid - b.rowid;
      });
      for (const item of group) {
        if (!seenIds.has(item.chunkId)) {
          seenIds.add(item.chunkId);
          results.push(item);
        }
      }
    }

    return { hits, results };
  }

  // 单槽删除：expectedRev 不匹配且非 force → 409（带 serverRev）；
  // 槽位不存在 → 幂等成功（deleted:0）。force=1 跳过 rev 检查，同样只许玩家显式裁决触发。
  function deleteSave(spaceId, slotId, { expectedRev = null, force = false } = {}) {
    if (!spaceId || !slotId) throw new Error("spaceId and slotId are required");
    const existing = stmtGetSave.get(spaceId, slotId);
    if (!existing) return { ok: true, status: 200, spaceId, slotId, deleted: 0, idempotent: true };
    if (force !== true) {
      // 非 force 必须带合法 expectedRev 且匹配才删——缺失/非法直接 400，
      // 不许绕开 rev+409 冲突保护无条件删。
      if (!Number.isInteger(expectedRev)) {
        return { ok: false, status: 400, error: "expectedRev_required", reason: "expectedRev_required" };
      }
      if (existing.rev !== expectedRev) {
        return { ok: false, status: 409, conflict: true, currentRev: existing.rev, serverRev: existing.rev, reason: "rev_mismatch" };
      }
    }
    const info = db.prepare("DELETE FROM saves WHERE space_id = ? AND slot_id = ?").run(spaceId, slotId);
    if (info.changes > 0) {
      db.prepare(`INSERT INTO save_tombstones(space_id, slot_id, high_rev) VALUES (?, ?, ?)
        ON CONFLICT(space_id, slot_id) DO UPDATE SET high_rev = MAX(high_rev, excluded.high_rev)`)
        .run(spaceId, slotId, existing.rev);
    }
    return { ok: true, status: 200, spaceId, slotId, deleted: info.changes };
  }

  // E1 空间凭证（只存/只比 SHA-256 hex，明文绝不进库）
  function createSpace(spaceId, tokenHash, createdAt = Date.now()) {
    if (!spaceId || !tokenHash) throw new Error("spaceId/tokenHash required");
    db.prepare("INSERT INTO spaces(space_id, token_hash, created_at) VALUES (?, ?, ?)").run(spaceId, tokenHash, createdAt);
    return { spaceId, createdAt };
  }

  function spaceTokenHash(spaceId) {
    const row = db.prepare("SELECT token_hash FROM spaces WHERE space_id = ?").get(spaceId);
    return row?.token_hash || null;
  }

  function rotateSpaceToken(spaceId, newHash) {
    const r = db.prepare("UPDATE spaces SET token_hash = ? WHERE space_id = ?").run(newHash, spaceId);
    return r.changes > 0;
  }

  function spaceMeta(spaceId) {
    const saves = db.prepare("SELECT COUNT(*) AS n FROM saves WHERE space_id = ?").get(spaceId)?.n || 0;
    const chunks = db.prepare("SELECT COUNT(*) AS n FROM prose_chunks WHERE space_id = ?").get(spaceId)?.n || 0;
    const registered = db.prepare("SELECT created_at FROM spaces WHERE space_id = ?").get(spaceId);
    return { spaceId, saveCount: saves, chunkCount: chunks, registered: Boolean(registered), createdAt: registered?.created_at || null };
  }

  function deleteSpace(spaceId) {
    if (!spaceId) throw new Error("spaceId is required");
    db.exec("BEGIN IMMEDIATE");
    let deletedChunks = 0;
    let deletedSaves = 0;
    try {
      // 批量 tombstone（复审必修）：wipe 整空间不等于豁免复活保护——被删槽逐个
      // 记高水位（max 合并），否则主人重建从 rev 1 起后，wipe 期间离线设备带旧
      // 低 rev 醒来推送会 CAS 撞上新代低序号，把 wipe 前内容静默盖回新存档。
      const rows = db.prepare("SELECT slot_id, rev FROM saves WHERE space_id = ?").all(spaceId);
      const tombStmt = db.prepare(`INSERT INTO save_tombstones(space_id, slot_id, high_rev) VALUES (?, ?, ?)
        ON CONFLICT(space_id, slot_id) DO UPDATE SET high_rev = MAX(high_rev, excluded.high_rev)`);
      for (const row of rows) tombStmt.run(spaceId, row.slot_id, row.rev);
      deletedChunks = stmtDeleteChunks.run(spaceId).changes;
      deletedSaves = stmtDeleteSaves.run(spaceId).changes;
      // E1：空间凭证一并清除——空间删了凭证不得残留（否则同 id 重建会被旧凭证把持）
      db.prepare("DELETE FROM spaces WHERE space_id = ?").run(spaceId);
      db.exec("COMMIT");
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw err;
    }
    db.exec("VACUUM");
    return { ok: true, spaceId, deletedSaves, deletedChunks, vacuumed: true };
  }

  // WO-20D 跨设备恢复探测：某分支是否存在 afterTurn/afterSeq 之后的段落。
  // 口径与客户端 proseReconcile 完全一致：turn>afterTurn 恒为未来；
  // turn===afterTurn 只认显式 seq>afterSeq（seq NULL 老数据不算，与客户端
  // Number.isFinite(c.seq) 判断一致）；无 branchId/空串直接 false。
  const stmtHasAfter = db.prepare(
    `SELECT 1 AS x FROM prose_chunks
     WHERE space_id = ? AND branch_id = ?
       AND (turn > ? OR (turn = ? AND seq IS NOT NULL AND seq > ?))
     LIMIT 1`,
  );
  function hasProseAfter(spaceId, { branchId = "", afterTurn = 0, afterSeq = 0 } = {}) {
    if (!branchId || typeof branchId !== "string") return { hasFuture: false };
    const turn = Number.isFinite(afterTurn) ? Math.floor(afterTurn) : 0;
    const seq = Number.isFinite(afterSeq) ? Math.floor(afterSeq) : 0;
    const row = stmtHasAfter.get(spaceId, branchId, turn, turn, seq);
    return { hasFuture: !!row };
  }

  function close() {
    db.close();
  }

  return {
    db,
    putSave,
    getSave,
    listSaves,
    appendProseChunks,
    queryProseChunks,
    hasProseAfter,
    deleteSave,
    createSpace,
    spaceTokenHash,
    rotateSpaceToken,
    spaceMeta,
    deleteSpace,
    close,
  };
}
