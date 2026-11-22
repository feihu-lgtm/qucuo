// 小纸条写入/重嵌口：记录构造与筛选留在 domain（memory/note.js、memoryStore.js），
// embedding 调用与入库副作用上移到 engine/ports。
import { getEmbedding, embeddingReady, embeddingFingerprint } from "./embeddingService.js";
import { addMemory, getAllMemories } from "../../infra/memoryStore.js";
import { buildNoteRecord, findStaleNotes, NOTE_SOURCE } from "../../domain/rules/memory/note.js";

let _seq = 0;

// 异步副作用：embedding + 入库。这是「写小纸条」的统一入口。
// fire-and-forget 语义（调用方不必 await）：没开 embedding / 取不到向量 / 库写失败
// 一律静默返回 null，绝不阻断主流程，也不纳入回合回滚（只在成功路径调）。
export async function writeNote({
  cfg,
  text,
  turn = 0,
  owner = [],
  place = null,
  source = NOTE_SOURCE.NARRATIVE,
  knownNames = [],
}) {
  if (!embeddingReady(cfg)) return null;
  const base = buildNoteRecord({ text, turn, owner, place, source, knownNames, seq: _seq++ });
  if (!base) return null;
  try {
    const vec = await getEmbedding(cfg, base.text);
    if (!vec) return null; // 取不到向量就不入库（宁可不存，也不存没向量的死记录）
    const record = {
      ...base,
      embedding: Array.from(vec), // Float32Array → 普通数组，才能进 IndexedDB
      fingerprint: embeddingFingerprint(cfg),
    };
    await addMemory(record);
    return record;
  } catch (err) {
    console.warn("[note] 小纸条入库失败（静默跳过）：", err.message || err);
    return null;
  }
}

// 有界重嵌：每次最多重算 maxPerRun 条指纹过期的纸条（后台自愈，不阻断游戏）。
// fire-and-forget 调用；没开 embedding、无过期条、失败一律静默返回已处理数。
export async function reembedStaleNotes({ cfg, maxPerRun = 3 }) {
  if (!embeddingReady(cfg)) return 0;
  try {
    const fp = embeddingFingerprint(cfg);
    const all = await getAllMemories();
    const stale = findStaleNotes(all, fp).slice(0, maxPerRun);
    let n = 0;
    for (const rec of stale) {
      const vec = await getEmbedding(cfg, rec.text);
      if (!vec) continue;
      await addMemory({ ...rec, embedding: Array.from(vec), fingerprint: fp }); // 同 id 覆盖
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
