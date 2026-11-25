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
import { enqueueProseUplink } from "./proseUplink.js";
// WO-20C：云端原文召回查询经本模块中转 re-export——engine/ports 跨层直连 infra
// 的存量已封顶（ratchet 只减不增），recallBlock 本就由这里拿段落库接口，
// 云查询与本地段落库同属 prose 存储关切，随同一出口走，不新增跨层计数。
export { queryCloudProseHits, cloudProseQueryBinding, probeCloudProseHasAfter } from "./proseCloudQuery.js";

const STORE = "prose_chunks";

// ── reconcile-pending 最小闸门 ──────────────────────────────
// 读档/undo 后 reconcile 异步跑谱系分叉。窗口内：recall 保守返回空（防串
// 未来段），prose 写挂先 await 再分配/落库（防新正文写进将被截断的旧头）。
// 模块级 promise 非持久状态，刷新自然归零。
let reconcilePendingPromise = null;
export function setProseReconcilePending(promise) {
  reconcilePendingPromise = promise || null;
}
// token 清理：只有当前 pending 仍是同一个 promise 才清——两次读档 reconcile
// 重叠时，旧 reconcile 的 finally 不得误清新一次读档刚挂上的闸。
export function clearProseReconcilePending(promise) {
  if (reconcilePendingPromise === promise) reconcilePendingPromise = null;
}
export function isProseReconcilePending() {
  return !!reconcilePendingPromise;
}
export function waitProseReconcile() {
  return reconcilePendingPromise || Promise.resolve();
}

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
  const written = await Promise.all(writes);
  // WO-19/20 PR-B：本地落库成功后 enqueue 云端上行——fire-and-forget，
  // unbound/断网都只在队列里等，绝不阻断本地写。迁移批量导入同路受益。
  try { enqueueProseUplink(written); } catch { /* 上行层异常静默 */ }
  return written;
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

// 按分支取段（v3 branchId 索引）：读档 reconcile 判旧未来、检索按谱系过滤都用。
export async function getProseChunksByBranch(branchId) {
  if (!branchId) return [];
  try {
    const store = await memoryStoreOf("readonly", STORE);
    return await new Promise((resolve, reject) => {
      const req = store.index("branchId").getAll(branchId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (_) {
    return []; // 降级：索引缺失/库异常按空处理
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
// 幂等口径：不设 proseMigrated 状态旗——同一存档再迁一遍产出完全相同的
// 确定性 chunk id，put 自然覆盖，不重复增生；少一个状态源就不会半死。
// 稳定内容 hash（非加密）：同内容重迁幂等同 id，异内容/异存档不撞。
function contentHash(text) {
  let h = 5381;
  const str = String(text || "");
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function migrateLegacyConvoAndNotes(saveSnapshot, { notes = [], branchId = "", seqStart = 1 } = {}) {
  if (!saveSnapshot || typeof saveSnapshot !== "object") return [];
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
  // 谱系补挂：迁移进根分支的 chunk 必须带 branchId/seq（检索可见性硬口径）。
  // seq 从 seqStart 顺序递增——同一存档输入顺序确定，幂等键仍是确定性 id+put 覆盖。
  // 确定性 id 改用内容 hash：同内容重迁幂等（put 覆盖自身），
  // 异内容/异存档/异时间线同 turn 同位置不再撞 id 互覆。branchId 不进 id——
  // 根分支 id 是随机的，进 id 会让旧档重复迁移增生副本。
  for (const c of chunks) {
    c.id = `P${c.turn}_m${contentHash(c.rawText + "|" + c.turn + "|" + (c.location || "") + "|" + (Array.isArray(c.witnesses) ? c.witnesses.join(",") : "") + "|" + (c.kind || "") + "|" + (Array.isArray(c.anchorFactIds) ? c.anchorFactIds.join(",") : ""))}`;
  }
  if (branchId) {
    let seq = seqStart - 1;
    for (const c of chunks) {
      seq += 1;
      c.branchId = branchId;
      c.seq = seq;
    }
  }
  return chunks;
}
