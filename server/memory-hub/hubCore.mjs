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
      embedding_model, embedding_dim
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stmtSpaceChunks = db.prepare(`
    SELECT id, space_id, batch_id, chunk_id, turn, location,
           witnesses_json, entities_json, raw_text, public_text, terms_segmented, embedding_blob,
           embedding_model, embedding_dim
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

  function putSave(spaceId, slotId, { expectedRev = 0, payloadEnc, updatedAt = Date.now() } = {}) {
    if (!spaceId || !slotId) throw new Error("spaceId and slotId are required");
    if (typeof payloadEnc !== "string") throw new Error("payloadEnc must be an opaque ciphertext string");
    if (!Number.isInteger(expectedRev) || expectedRev < 0) throw new Error("expectedRev must be a non-negative integer");

    db.exec("BEGIN IMMEDIATE");
    try {
      const existing = stmtGetSave.get(spaceId, slotId);
      if (!existing) {
        if (expectedRev !== 0) {
          db.exec("ROLLBACK");
          return { ok: false, status: 409, conflict: true, currentRev: 0, reason: "save_not_found_rev_mismatch" };
        }
        stmtInsertSave.run(spaceId, slotId, 1, payloadEnc, updatedAt);
        db.exec("COMMIT");
        return { ok: true, status: 200, spaceId, slotId, rev: 1, updatedAt };
      }
      if (existing.rev !== expectedRev) {
        db.exec("ROLLBACK");
        return { ok: false, status: 409, conflict: true, currentRev: existing.rev, reason: "rev_mismatch" };
      }
      const nextRev = existing.rev + 1;
      stmtUpdateSave.run(nextRev, payloadEnc, updatedAt, spaceId, slotId, existing.rev);
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
  } = {}) {
    if (!spaceId) throw new Error("spaceId is required");
    const maxTurnVal = Number.isFinite(maxTurn) ? maxTurn : null;
    const allRows = stmtSpaceChunks.all(spaceId, maxTurnVal, maxTurnVal);
    const visibleRows = allRows.filter((row) => {
      if (location && row.location !== location) return false;
      return canViewerSeeChunk(parseJsonArray(row.witnesses_json), viewer);
    });
    if (!visibleRows.length) return { hits: [], results: [] };

    const visibleById = new Map(visibleRows.map((r) => [r.id, r]));
    const ftsQuery = buildFtsQuery(query);
    const ftsRows = ftsQuery
      ? stmtFtsSearch.all(ftsQuery, spaceId, maxTurnVal, maxTurnVal, Math.max(topK * 4, 20))
          .filter((r) => visibleById.has(r.id))
      : [];

    const qVec = queryEmbedding
      ? (queryEmbedding instanceof Float32Array ? queryEmbedding : Float32Array.from(queryEmbedding))
      : null;
    // 换模型/换维度后旧向量绝不参与比较（roadmap 硬要求）：
    // 行必须显式带 embedding_model 且与查询申报模型逐字相同，维度与查询向量等长
    // （或等于显式 queryEmbeddingDim）。无元数据的旧行只做关键词召回。
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
        const seq = parseSeqFromChunkId(s.chunk_id);
        const bySeq = anchorSeq !== null && seq !== null && Math.abs(seq - anchorSeq) <= neighborRadius;
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
      const group = [hit, ...hit.neighbors].sort((a, b) => (a.turn - b.turn) || (a.rowid - b.rowid));
      for (const item of group) {
        if (!seenIds.has(item.chunkId)) {
          seenIds.add(item.chunkId);
          results.push(item);
        }
      }
    }

    return { hits, results };
  }

  function deleteSpace(spaceId) {
    if (!spaceId) throw new Error("spaceId is required");
    db.exec("BEGIN IMMEDIATE");
    let deletedChunks = 0;
    let deletedSaves = 0;
    try {
      deletedChunks = stmtDeleteChunks.run(spaceId).changes;
      deletedSaves = stmtDeleteSaves.run(spaceId).changes;
      db.exec("COMMIT");
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw err;
    }
    db.exec("VACUUM");
    return { ok: true, spaceId, deletedSaves, deletedChunks, vacuumed: true };
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
    deleteSpace,
    close,
  };
}
