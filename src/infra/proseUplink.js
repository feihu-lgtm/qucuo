// WO-19/20 PR-B prose 原文上行队列（复用 cloud 存档队列模式）
// ------------------------------------------------------------------
// 本地 IndexedDB 段落库写成功后，把 canonical 形状的段落 enqueue 上行 memory-hub。
// 口径钉死：
// · 幂等：队列内按 chunkId 去重（同 chunkId 重推不重复）；服务端另有
//   UNIQUE(space_id, chunk_id) + INSERT OR IGNORE 兜底——成功后丢响应重推也安全。
// · 断网/5xx/异常/环境类 4xx（401/403/404/409/429）→ 条目回队首，退避重发；
//   确定形状坏 400/422 → 移 dead-letter 队列（cap 200），不无声删除。
// · 三件套缺一（unbound）→ 队列保留静默等待，绝不半通乱发。
// · 明文上行：prose 段服务端要建 FTS 索引，密文无法检索——这是与存档密文
//   相反的有意口径，密钥/存档明文绝不混入本路径。
// · 全程 fire-and-forget：上行失败绝不阻断游戏与本地段落库。

import { hubBinding, hubAppendProse } from "./cloudProtocol.js";
import { loadStorageConfig } from "./storageDriver.js";

const QUEUE_KEY = "wuxia_mud_prose_uplink_queue";
const DEAD_KEY = "wuxia_mud_prose_uplink_dead";
const QUEUE_CAP = 500;
const DEAD_CAP = 200;
const BATCH_SIZE = 25;
const FLUSH_DEBOUNCE_MS = 1500;
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 60000;

function _lsRead(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function _lsWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

let _flushTimer = null;
let _retryMs = RETRY_BASE_MS;
let _flushing = false;
let _batchSize = BATCH_SIZE; // 413 时动态收缩，成功复位

export function getProseUplinkQueue() { return _lsRead(QUEUE_KEY, []); }
// dead-letter：确定形状坏（400/422）的批次移入此处——不是无声删除，
// 服务端契约修复/数据矫正后可人工打捞；cap 防膨胀淘汰最老。
export function getProseUplinkDeadLetters() { return _lsRead(DEAD_KEY, []); }

function pushDeadLetters(batch, status) {
  const dead = _lsRead(DEAD_KEY, []);
  for (const chunk of batch) dead.push({ ...chunk, deadStatus: status, deadAt: Date.now() });
  while (dead.length > DEAD_CAP) dead.shift();
  _lsWrite(DEAD_KEY, dead);
}

function persistQueue(queue) {
  while (queue.length > QUEUE_CAP) {
    const dropped = queue.shift();
    console.warn(`[prose-uplink] 队列超 ${QUEUE_CAP} 条上限，丢弃最老段落 ${dropped?.chunkId}（云端将缺此段）`);
  }
  _lsWrite(QUEUE_KEY, queue);
}

// 本地 ProseChunk → canonical 上行形状。importance/anchorFactIds 服务端无列不落；
// branchId/seq/turn 是谱系可见性硬过滤的命脉，缺 branchId 的段服务端永不可见
// （branchVisibleServer 无 branchId 一律 false）仍照传——未来口径变更由服务端定。
export function toCanonicalProseChunk(chunk) {
  if (!chunk || typeof chunk !== "object") return null;
  const chunkId = String(chunk.id || chunk.chunkId || "");
  const turn = Number(chunk.turn);
  if (!chunkId || !Number.isFinite(turn)) return null;
  return {
    chunkId,
    turn,
    location: String(chunk.location || ""),
    witnesses: Array.isArray(chunk.witnesses) && chunk.witnesses.length ? chunk.witnesses : ["*"],
    entities: Array.isArray(chunk.entities) ? chunk.entities : [],
    rawText: String(chunk.rawText || chunk.publicText || ""),
    publicText: String(chunk.publicText || chunk.rawText || ""),
    ...(Number.isInteger(chunk.seq) ? { seq: chunk.seq } : {}),
    ...(typeof chunk.branchId === "string" && chunk.branchId ? { branchId: chunk.branchId } : {}),
  };
}

// 入队（本地写库成功后调用）。返回入队条数；异常静默。
export function enqueueProseUplink(chunks) {
  try {
    if (!Array.isArray(chunks) || !chunks.length) return 0;
    const queue = getProseUplinkQueue();
    const seen = new Set(queue.map((q) => q.chunkId));
    let added = 0;
    // 目的地戳（Review SEC 修）：入队记下当时绑定的 spaceId——之后换绑新 hub，
    // 旧空间段绝不许跨绑发进新空间（新运营方不该收到发给旧 hub 的明文）。
    // 未绑定时戳空串：无既有目的地意图，配齐后随当前空间排空。
    const spaceStamp = hubBinding(loadStorageConfig()).spaceId || "";
    for (const raw of chunks) {
      const c = toCanonicalProseChunk(raw);
      if (!c || seen.has(c.chunkId)) continue;
      seen.add(c.chunkId);
      queue.push({ ...c, _space: spaceStamp });
      added += 1;
    }
    if (!added) return 0;
    persistQueue(queue);
    scheduleFlush();
    return added;
  } catch {
    return 0;
  }
}

function scheduleFlush(delay = FLUSH_DEBOUNCE_MS) {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void flushProseUplink();
  }, delay);
}

// 推送：批量 POST /prose（batchId 仅用时间戳区分批次，幂等不依赖它）。
// unbound → 队列原样保留；网络/5xx → 回队首退避；成功/4xx → 移除。
export async function flushProseUplink() {
  if (_flushing) return;
  const cfg = loadStorageConfig();
  const binding = hubBinding(cfg);
  if (!binding.bound) return; // 静默等待——三件套配齐后自然排空
  // SEC 修：非 cloud 驱动绝不发——玩家切回 local/file 后凭证虽留档，
  // 本地游玩产生的明文段落不许再流向 hub（玩家语义已是「本地模式」）。
  if (cfg.driver !== "cloud") return;
  const queue = getProseUplinkQueue();
  if (!queue.length) return;
  _flushing = true;
  try {
    // 跨绑守门：戳与当前空间不符的旧空间段丢弃（本地 IndexedDB 仍是权威副本，
    // 丢弃不丢数据）；空戳段无既有目的地，随当前空间发。剥 _space 再上送。
    const fresh = [];
    const crossBound = [];
    for (const q of queue) {
      if (q._space && q._space !== binding.spaceId) crossBound.push(q);
      else fresh.push(q);
    }
    if (crossBound.length) {
      console.warn(`[prose-uplink] ${crossBound.length} 段落属旧空间，跨绑不发送（本地副本仍在）`);
      persistQueue(fresh);
      if (!fresh.length) return;
    }
    const batch = fresh.slice(0, _batchSize).map(({ _space, ...c }) => c);
    const batchId = `b_${Date.now().toString(36)}`;
    let result = null;
    try {
      result = await hubAppendProse(binding, batchId, batch);
    } catch {
      result = null; // 网络异常视同失败重试
    }
    const cur = getProseUplinkQueue();
    if (result?.ok) {
      const done = new Set(batch.map((b) => b.chunkId));
      persistQueue(cur.filter((q) => !done.has(q.chunkId)));
      _retryMs = RETRY_BASE_MS;
      _batchSize = BATCH_SIZE;
      if (cur.length - batch.length > 0) scheduleFlush(0); // 继续排空
      return;
    }
    if (result && result.status === 413) {
      // 413 体积超限（Review 修）：batch 收缩重试——同批原样退避会让后面的小段
      // 永远堵在超限批次后面。收缩到 1 仍 413 说明单段本身超限，按形状坏进 dead-letter。
      if (batch.length <= 1) {
        pushDeadLetters(batch, 413);
        const done = new Set(batch.map((b) => b.chunkId));
        persistQueue(cur.filter((q) => !done.has(q.chunkId)));
        console.warn(`[prose-uplink] 单段 413 超限，${batch[0]?.chunkId} 移入 dead-letter`);
      } else {
        _batchSize = Math.max(1, Math.floor(batch.length / 2));
        console.warn(`[prose-uplink] 413 超限，批次收缩至 ${_batchSize} 重试`);
        scheduleFlush(0);
      }
      return;
    }
    if (result && (result.status === 400 || result.status === 422)) {
      // 确定形状坏（裁决）：移出活队列但进 dead-letter，非无声删除——
      // 契约修复后可打捞；401/403/404/409/429 等环境类 4xx 不在此列。
      const done = new Set(batch.map((b) => b.chunkId));
      pushDeadLetters(batch, result.status);
      persistQueue(cur.filter((q) => !done.has(q.chunkId)));
      console.warn(`[prose-uplink] 服务端 ${result.status} 拒收，批次 ${batchId} 移入 dead-letter`);
      return;
    }
    // 网络/5xx/其余 4xx（401/403/404/409/429 等可恢复环境类）：原样保留，退避重试
    _retryMs = Math.min(_retryMs * 2, RETRY_CAP_MS);
    scheduleFlush(_retryMs);
  } finally {
    _flushing = false;
  }
}

// wipe 专用清队（storageDriver.wipeCloudAll 动态调用）：活队列+退避计时全清。
export function _resetProseUplinkQueueForWipe() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  _retryMs = RETRY_BASE_MS;
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* */ }
}

// 测试复位
export function _resetProseUplinkForTest() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  _retryMs = RETRY_BASE_MS;
  _flushing = false;
  _batchSize = BATCH_SIZE;
  try { localStorage.removeItem(QUEUE_KEY); localStorage.removeItem(DEAD_KEY); } catch { /* */ }
}
