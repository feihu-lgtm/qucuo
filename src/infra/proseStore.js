// WO-17 原文段落库（IndexedDB qucuo_memory.prose_chunks）
// ------------------------------------------------------------------
// 与 memoryStore（小纸条）同库不同表，开库/升级统一走 memoryDb.js。
// 本模块只提供写入/读取 API 与老存档迁移器——尚未接入 runTurn 主链路
// （WO-18 接管检索与写挂），调不调用由上层决定。
//
// 一条 ProseChunk 的结构见契约 A（domain/rules/memory/proseChunker.js）：
//   { id:"P<turn>_<段号>", kind:"raw_memory", turn, location, witnesses,
//     entities, publicText, rawText, importance, anchorFactIds }

import { memoryStoreOf } from "./memoryDb.js";

const STORE = "prose_chunks";

function tx(mode) {
  return memoryStoreOf(mode, STORE);
}

export async function addProseChunks(chunks) {
  if (!Array.isArray(chunks) || !chunks.length) return [];
  const store = await tx("readwrite");
  const writes = chunks.map((chunk) => new Promise((resolve, reject) => {
    const req = store.put(chunk);
    req.onsuccess = () => resolve(chunk);
    req.onerror = () => reject(req.error);
  }));
  return Promise.all(writes);
}

export async function getProseChunksByTurn(turn) {
  try {
    const store = await tx("readonly");
    return await new Promise((resolve, reject) => {
      const req = store.index("turn").getAll(turn);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[proseStore] 按回合读取失败，按空处理：", err.message || err);
    return [];
  }
}

export async function getAllProseChunks() {
  try {
    const store = await tx("readonly");
    return await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[proseStore] 读取失败，按空处理：", err.message || err);
    return [];
  }
}

export async function countProseChunks() {
  try {
    const store = await tx("readonly");
    return await new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

// ── 老存档迁移器：convo + 小纸条 → 初始段落记录 ──────────────────────
// 无损原则：原文一字不改进 rawText（锚点/斜体都保留——斜体剥离是读取时
// publicText 的事，rawText 永远保全）；幂等：已迁过的档（proseMigrated 标记）
// 再来一遍返回空，不重复写。
//
// convo 迁移的 turn 估算：老存档 convo 消息不带回合戳，只能按「user+engine
// 为一回合」从快照当前 time 倒推——粗但够检索用；记录全部打 migrated:true
// 以便将来区分精度的差别。location 用快照当前房名（老 convo 无位置信息，
// 拿不准就留空字符串——不编造）。
export function migrateLegacyConvoAndNotes(saveSnapshot, { notes = [] } = {}) {
  if (!saveSnapshot || typeof saveSnapshot !== "object") return [];
  if (saveSnapshot.proseMigrated) return [];
  const chunks = [];
  const timeNow = Number(saveSnapshot.time) || 0;
  const convo = Array.isArray(saveSnapshot.convo) ? saveSnapshot.convo : [];

  // convo：engine 消息（AI 正文）按回合倒推 turn；user 消息不迁（玩家输入
  // 不是叙事正文）。每则 engine 正文整体作一段（老数据无法再按原段落复原
  // 切分边界——消息本就是整回合正文，按段切分仍可恢复段结构）。
  let engineCount = 0;
  const engineMsgs = convo.filter((m) => m && m.role !== "user" && typeof m.content === "string" && m.content.trim());
  for (const msg of engineMsgs) {
    engineCount += 1;
    // 倒推：最后一则 engine 约当 timeNow（或 timeNow-1），依次往前
    const estimatedTurn = Math.max(1, timeNow - (engineMsgs.length - engineCount));
    const paragraphs = msg.content.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach((para, idx) => {
      chunks.push({
        id: `P${estimatedTurn}_legacy${engineCount}_${idx + 1}`,
        kind: "raw_memory",
        turn: estimatedTurn,
        location: "",
        witnesses: ["*"], // 老 convo 无在场名单——公共可见兜底，不编造人名
        entities: [],
        publicText: para, // 老正文不含斜体心理标记体系外的内容，原样即是公开文本
        rawText: para,
        importance: 1,
        anchorFactIds: [],
        migrated: true,
      });
    });
  }

  // 小纸条：一条一 chunk，witnesses 从 owner 映射（owner 空=公共）。
  for (const note of notes) {
    if (!note || typeof note.text !== "string" || !note.text.trim()) continue;
    const turn = Number(note.turn) || timeNow || 1;
    const owners = Array.isArray(note.owner) ? note.owner.map((o) => o?.name).filter(Boolean) : [];
    chunks.push({
      id: `P${turn}_note_${String(note.id || chunks.length + 1).replace(/\W/g, "")}`,
      kind: "raw_memory",
      turn,
      location: note.place || "",
      witnesses: owners.length ? owners : ["*"],
      entities: owners.filter((n) => n !== "主角"),
      publicText: note.text,
      rawText: note.text,
      importance: 1,
      anchorFactIds: [],
      migrated: true,
    });
  }
  return chunks;
}
