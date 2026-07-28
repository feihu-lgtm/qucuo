// 已入册角色注册表
// ============================================================================
// 【为什么独立于存档】导入的角色卡是玩家的资产，不是某一局游戏的状态——跟
// presetSystem.js 里那个"独立于任何单个预设的全局片段库"同一个道理。存进存档
// 会有两个麻烦：读旧档时导入的人凭空消失，以及每个槽位各存一份同样的人设。
// 所以这里跟 saves.js 平行，走自己的 IndexedDB 库（与 scanStore 同库不同前缀）。
//
// 读取方向：
//   worldbook.js 的 npcLore        ← getImportedNpcLore()
//   characterMilestones.js         ← getImportedMilestones()
//   room.npcs 注入（品阶/六维/carry）← getImportedStats(name)
// 这三处都是"静态预设 + 导入追加"的合并关系，导入的排在后面，同名时以导入为准
// （玩家自己刚导的，意图比预设更明确）。

const DB_NAME = "qucuo_cards";
const DB_VERSION = 1;
const STORE = "scans";          // 与 scanStore 同一个仓库，靠 key 前缀区分
const KEY = "imported:registry";

let _dbPromise = null;
let _registry = { chars: [], savedAt: 0 };
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

function idbGet(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
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

function persist() {
  const v = { ...(_registry), savedAt: Date.now() };
  _registry = v;
  if (_idbAvailable) idbPut(KEY, v).catch(e => console.warn("[imported] 写入失败", e?.message || e));
  // 生成即落盘，不等关页——这套东西是玩家亲手改过一遍的，丢了要重来一整轮
}

/** 启动时 await 一次 */
export async function init() {
  if (_initialized) return;
  try {
    const v = await idbGet(KEY);
    _idbAvailable = true;
    if (v && Array.isArray(v.chars)) _registry = v;
  } catch (e) {
    _idbAvailable = false;
    console.warn("[imported] IndexedDB 不可用，入册角色本次不持久化:", e?.message || e);
  }
  _initialized = true;
}

/**
 * 落册。同名的覆盖旧的。
 * @param {Array} npcs cardScan 产出、玩家审改过的人物数组
 * @param {object} meta { cardName, fileName }
 */
export function registerImported(npcs, meta = {}) {
  if (!Array.isArray(npcs) || !npcs.length) return 0;
  const byName = new Map(_registry.chars.map(c => [c.name, c]));
  for (const n of npcs) {
    if (!n?.name) continue;
    byName.set(n.name, {
      name: n.name,
      aliases: Array.isArray(n.aliases) ? n.aliases : [],
      entry: n.entry || "",
      brief: n.brief || n.name,
      appearance: n.appearance || "",
      attitude: n.attitude || "",
      levelCap: Number.isFinite(n.levelCap) ? n.levelCap : 1,
      special: n.special || {},
      affection: Number.isFinite(n.affection) ? n.affection : 0,
      milestones: Array.isArray(n.milestones) ? n.milestones : [],
      placement: normalizePlacement(n.placement),
      from: { cardName: meta.cardName || "", fileName: meta.fileName || "", at: Date.now() },
    });
  }
  _registry.chars = Array.from(byName.values());
  persist();
  return npcs.length;
}

// ── 落脚方式 ────────────────────────────────────────────────────────────────
// 三种，对应本作已有的三套机制：
//   mention  只在人设层存在。被提到时注入设定，但不会主动出现在任何据点。
//            适合"远方的人""传闻里的人"。这是默认值——导入一张卡不该擅自
//            改变世界上有谁在哪。
//   resident 驻场。进了指定据点必定在场，不受权重与时段影响，等同
//            residentNpcs.js 的语义。可再锁一个内层房间（走 lockInnerRoom）。
//   wander   游走。按 routineWeights 权重 + timeSlot 时段随机出现，等同
//            npcPool.js 的语义。内层落点由 MudRPG 现有的 seededRand 逻辑分配。
export const PLACEMENT_MODES = ["mention", "resident", "wander"];

export function normalizePlacement(p) {
  const mode = PLACEMENT_MODES.includes(p?.mode) ? p.mode : "mention";
  const out = { mode, district: null, innerRoom: null, weights: {}, timeSlot: [0, 23] };
  if (mode === "resident") {
    out.district = p?.district || null;
    out.innerRoom = p?.innerRoom || null;
    if (!out.district) out.mode = "mention";   // 没选据点的驻场是无效配置，退回不落地
  } else if (mode === "wander") {
    const w = {};
    for (const [k, v] of Object.entries(p?.weights || {})) {
      const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
      if (n > 0) w[k] = n;
    }
    out.weights = w;
    const lo = Math.max(0, Math.min(23, Math.round(Number(p?.timeSlot?.[0]) || 0)));
    const hi = Math.max(0, Math.min(23, Math.round(Number(p?.timeSlot?.[1] ?? 23))));
    out.timeSlot = lo <= hi ? [lo, hi] : [hi, lo];
    if (!Object.keys(w).length) out.mode = "mention";   // 没给任何据点权重同理
  }
  return out;
}

/**
 * 某据点此刻该出现哪些入册角色。返回的是 pool-like 形状，调用方再过
 * toRoomNpcWithCombat 转成 room.npcs 条目。
 * @param {string} district 据点名
 * @param {number} time 全局回合数（MudRPG 的 time），内部换算成 0-23 小时
 * @param {number} dayIdx 天序，用于游走判定的稳定随机
 */
export function getImportedForDistrict(district, time = 0, rand = null) {
  if (!district) return [];
  const hour = ((time % 24) + 24) % 24;
  const out = [];
  for (const c of _registry.chars) {
    const pl = c.placement || { mode: "mention" };
    if (pl.mode === "resident") {
      if (pl.district !== district) continue;
      out.push(toPoolLike(c, pl.innerRoom));
    } else if (pl.mode === "wander") {
      const w = pl.weights?.[district] || 0;
      if (w <= 0) continue;
      const [lo, hi] = pl.timeSlot || [0, 23];
      if (hour < lo || hour > hi) continue;
      // 权重当出现概率用（0-100）。传了 rand 就用调用方的稳定随机源（同一天
      // 落点不跳），没传退化到 Math.random——只在预览类场景发生。
      const r = typeof rand === "function" ? rand(c.name) : Math.random();
      if (r * 100 > w) continue;
      out.push(toPoolLike(c, null));
    }
  }
  return out;
}

// 转成 npcPool 条目的形状。字段名必须与 toRoomNpcWithCombat 的白名单对得上，
// 否则 levelCap / personality / lockInnerRoom 会在转换中被剥掉。
function toPoolLike(c, lockInnerRoom) {
  const o = {
    id: `imported_${c.name}`,
    name: c.name,
    brief: c.brief || c.name,
    personality: [c.attitude, c.appearance].filter(Boolean).join("；") || "",
    levelCap: c.levelCap ?? 1,
    // 空对象会顶掉 applyNpcDefaults 的随机七维（`npc.special || generate…`
    // 对 {} 判真），所以没配过就干脆不带这个字段
    special: (c.special && Object.keys(c.special).length) ? c.special : undefined,
    affectionable: true,
    imported: true,
  };
  if (lockInnerRoom) o.lockInnerRoom = lockInnerRoom;
  return o;
}

/**
 * 入册的驻场角色名单。供 commitRound 的"幽灵过滤"使用——驻场者有固定归属，
 * 不该被 AI 在别的据点凭空刷出来，跟 getAllResidentNpcNames() 同一个用途。
 */
export function getImportedResidentNames() {
  return _registry.chars
    .filter(c => c.placement?.mode === "resident")
    .map(c => c.name);
}

export function listImported() {
  return _registry.chars.slice();
}

export function removeImported(name) {
  _registry.chars = _registry.chars.filter(c => c.name !== name);
  persist();
}

export function clearImported() {
  _registry.chars = [];
  persist();
}

/**
 * 供 worldbook.js 合并。返回的形状与 presets/qucuo.js 的 npcLore 完全一致：
 * { name, aliases, entry }。外貌锚点与初见态度拼进 entry 尾部，跟预设里
 * 那些手写条目的写法保持一致（预设里就是把外貌锚点写在人设正文里的）。
 */
export function getImportedNpcLore() {
  return _registry.chars.map(c => {
    const tail = [
      c.appearance ? `\n  外貌锚点：${c.appearance}` : "",
      c.attitude ? `\n  初见态度：${c.attitude}` : "",
    ].join("");
    return {
      name: c.name,
      aliases: c.aliases,
      entry: `- ${c.name}（${c.brief}）：${c.entry}${tail}`,
    };
  });
}

/**
 * 供 characterMilestones.js 合并。返回 { 角色名: { 阈值: {title, brief} } }，
 * 与 CHARACTER_MILESTONES 的结构一致。
 */
export function getImportedMilestones() {
  const out = {};
  for (const c of _registry.chars) {
    if (!c.milestones?.length) continue;
    const m = {};
    for (const x of c.milestones) {
      if (!x?.threshold || !x.title) continue;
      // text 必须是数组：CharacterPage 里直接 .text.map()，undefined 会抛错
      m[x.threshold] = { title: x.title, brief: x.brief || "", text: Array.isArray(x.text) ? x.text : [] };
    }
    if (Object.keys(m).length) out[c.name] = m;
  }
  return out;
}

/** 供 room.npcs 强制注入时取数值（品阶/七维/一句话身份） */
export function getImportedStats(name) {
  const c = _registry.chars.find(x => x.name === name
    || (x.aliases || []).includes(name));
  if (!c) return null;
  return { name: c.name, levelCap: c.levelCap, special: c.special, brief: c.brief };
}

/** 好感度初值：写 varTree 时用。没配过的返回 0 */
export function getImportedAffection(name) {
  const c = _registry.chars.find(x => x.name === name);
  return c ? (c.affection || 0) : 0;
}
