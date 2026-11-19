// 扫描结果的持久化：断点续传 + 结果缓存
// ============================================================================
// 【为什么必须落盘】扫描一张大卡要 4~6 次调用、一分多钟，中间任何一次超时或
// 429 都可能中断。如果结果只在内存里，中断就等于把已经烧掉的额度全扔了——在
// 5 次/分钟的额度下这是不可接受的。所以每批结果一拿到手就立刻写盘，续跑时从
// 断点开始，已完成的批次绝不重复调用。
//
// 架构照 saves.js：内存直写缓存是唯一的读来源（读 API 保持同步），写时同步改
// 内存 + 异步 fire-and-forget 写 IDB。区别是这里不做 localStorage 降级——扫描
// 结果丢了只是要重扫一次，不像存档丢了不可挽回，没必要为它再写一套兜底。
//
// key 格式：
//   card:{md5}            → 卡的解析结果与元信息（判断缓存是否命中）
//   scan:{md5}:{stage}    → 某阶段的完整产物（阶段 1、3、4）
//   scan:{md5}:2:{batch}  → 阶段 2 按批存，这是断点续传的粒度

const DB_NAME = "qucuo_cards";
const DB_VERSION = 1;
const STORE = "scans";

let _dbPromise = null;
let _cache = {};
let _idbAvailable = false;
let _initialized = false;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("无 IndexedDB")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function idbGetAll() {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

function idbPut(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }));
}

function idbDel(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }));
}

const _clone = (v) => { try { return structuredClone(v); } catch { return v; } };
function _putBg(key, value) {
  if (_idbAvailable) idbPut(key, value).catch(e => console.warn("[scanStore] 写入失败 " + key, e?.message || e));
}

/** 启动时 await 一次，把已有扫描结果全量灌进内存 */
export async function init() {
  if (_initialized) return;
  try {
    const all = await idbGetAll();
    _idbAvailable = true;
    for (const rec of all) _cache[rec.key] = rec.value;
  } catch (e) {
    _idbAvailable = false;
    console.warn("[scanStore] IndexedDB 不可用，扫描结果本次不持久化:", e?.message || e);
  }
  _initialized = true;
}

// ── 卡级元信息 ────────────────────────────────────────────────────────────────

const cardKey = (md5) => `card:${md5}`;

export function saveCardMeta(md5, meta) {
  const v = _clone({ ...meta, savedAt: Date.now() });
  _cache[cardKey(md5)] = v;
  _putBg(cardKey(md5), v);
}

export function loadCardMeta(md5) {
  return _cache[cardKey(md5)] || null;
}

// ── 阶段产物 ──────────────────────────────────────────────────────────────────

const stageKey = (md5, stage, batch) =>
  batch == null ? `scan:${md5}:${stage}` : `scan:${md5}:${stage}:${batch}`;

/**
 * 存一个阶段（或阶段 2 的一个批次）的产物。
 * 一拿到结果立刻调，不要攒着——攒着就是在赌不会中断。
 */
export function saveStage(md5, stage, payload, batch = null) {
  const v = _clone({ payload, savedAt: Date.now(), stage, batch });
  const k = stageKey(md5, stage, batch);
  _cache[k] = v;
  _putBg(k, v);
}

export function loadStage(md5, stage, batch = null) {
  const rec = _cache[stageKey(md5, stage, batch)];
  return rec ? rec.payload : null;
}

export function hasStage(md5, stage, batch = null) {
  return Object.prototype.hasOwnProperty.call(_cache, stageKey(md5, stage, batch));
}

/**
 * 阶段 2 已经完成了哪些批次。续跑时用它算出该从第几批开始，
 * 已完成的批次一次调用都不再花。
 */
export function completedBatches(md5) {
  const prefix = `scan:${md5}:2:`;
  const out = [];
  for (const k of Object.keys(_cache)) {
    if (k.startsWith(prefix)) {
      const n = Number(k.slice(prefix.length));
      if (Number.isInteger(n)) out.push(n);
    }
  }
  return out.sort((a, b) => a - b);
}

/** 汇总这张卡当前的扫描进度，供 UI 显示「已完成 X/Y」和决定要不要提示续跑 */
export function scanProgress(md5, plannedBatches) {
  const done = completedBatches(md5);
  return {
    stage1: hasStage(md5, 1),
    stage2Done: done,
    stage2Total: plannedBatches ?? null,
    stage3: hasStage(md5, 3),
    stage4: hasStage(md5, 4),
  };
}

/** 清掉一张卡的全部扫描结果（UI 上的「忽略缓存重扫」） */
export function clearCard(md5) {
  const prefixes = [`card:${md5}`, `scan:${md5}:`];
  for (const k of Object.keys(_cache)) {
    if (prefixes.some(p => k === p || k.startsWith(p))) {
      delete _cache[k];
      if (_idbAvailable) idbDel(k).catch(() => {});
    }
  }
}

/** 列出所有扫过的卡，供「最近导入」列表 */
export function listScannedCards() {
  return Object.keys(_cache)
    .filter(k => k.startsWith("card:"))
    .map(k => ({ md5: k.slice(5), ..._cache[k] }))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

// ── 卡指纹 ────────────────────────────────────────────────────────────────────

/**
 * 算一张卡的指纹，作为缓存键。
 * 用不着密码学强度的 md5，这里只要「同一张卡稳定命中、不同卡不撞」，
 * 所以用 FNV-1a 跑卡的关键字段，纯同步、零依赖。
 * 【注意】必须把 entries 的内容也纳入，否则改过世界书的同名卡会误命中缓存。
 */
export function fingerprintCard(card) {
  const parts = [
    card?.name || "",
    card?.bookName || "",
    String(card?.entries?.length || 0),
    ...(card?.entries || []).map(e => `${e.label}|${e.length}|${(e.keys || []).join(",")}`),
    String(card?.fields?.description?.length || 0),
    String(card?.openings?.length || 0),
  ];
  const s = parts.join("\u0000");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // 再跑一遍反向，降低短字符串的碰撞概率（这不是安全哈希，够用即可）
  let h2 = 0x811c9dc5;
  for (let i = s.length - 1; i >= 0; i--) {
    h2 ^= s.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return (h.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
}
