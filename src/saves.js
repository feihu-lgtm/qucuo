// 存档系统：自动存档 + 手动多槽位存档
// ------------------------------------------------------------------
// 架构：Write-Through Cache（直写缓存）+ IndexedDB 后端 + localStorage 降级。
// 学自参考项目 storage-service.js。要点：
//   · 内存 _cache 是唯一的「读」来源 → 对外读 API 保持同步（loadAutoSave/loadSlot/listSlots）。
//   · 启动时 await init() 一次，把 IDB 全量灌进 _cache；此后读全部走内存、无需异步。
//   · 写：同步写 _cache + 异步 fire-and-forget 写 IDB + 尽力同步写 localStorage 降级兜底。
//   · IDB 不可用则自动降级到纯 localStorage。
//   · 写入一律 structuredClone 断开与调用方对象的共享引用，防串台（参考项目多次踩坑）。
// 迁移：init 时 IDB 若空，从旧 localStorage 键迁入；旧 localStorage 存档保留不删作安全兜底。
// 关页兜底：IDB 异步写关页来不及落盘，故 autoSave 顺带尽力同步写一份 LS；init 取 IDB 与 LS 较新者。

import { statsForQuality } from "./equipment.js";

const AUTOSAVE_KEY = "wuxia_mud_autosave";       // 旧 localStorage 键（迁移/降级用）
const SLOTS_INDEX_KEY = "wuxia_mud_save_slots";
const SLOT_PREFIX = "wuxia_mud_slot_";

// ── IndexedDB（库 qucuo_saves，仓库 saves，主键 key）───────────────────────────
const DB_NAME = "qucuo_saves";
const DB_VERSION = 1;
const STORE = "saves";
const K_AUTOSAVE = "autosave";
const K_SLOTS_INDEX = "slots_index";
const slotKey = (id) => `slot:${id}`;

let _dbPromise = null;
function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("无 IndexedDB")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" }); };
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

// ── 内部状态 ──────────────────────────────────────────────────────────────────
let _cache = {};            // key → value（内存直写缓存，读的唯一来源）
let _idbAvailable = false;
let _initialized = false;

const _clone = (v) => { try { return structuredClone(v); } catch { return v; } };
function _lsGet(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function _lsSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function _idbPutBg(key, value) { if (_idbAvailable) idbPut(key, value).catch(e => console.warn("[saves][IDB] 写入失败 " + key, e?.message || e)); }
function _idbDelBg(key) { if (_idbAvailable) idbDel(key).catch(() => {}); }

// ── 初始化（启动时 await 一次）───────────────────────────────────────────────
export async function init() {
  if (_initialized) return;
  try {
    const all = await idbGetAll();
    _idbAvailable = true;
    for (const rec of all) _cache[rec.key] = rec.value;

    // 迁移：IDB 里没有自动存档，但旧 localStorage 有 → 迁入。
    if (!_cache[K_AUTOSAVE]) {
      const legacy = _lsGet(AUTOSAVE_KEY);
      if (legacy) { _cache[K_AUTOSAVE] = legacy; _idbPutBg(K_AUTOSAVE, legacy); }
    } else {
      // 关页兜底：beforeunload 同步写的 LS 可能比上次异步 IDB 存档更新 → 取较新者。
      const legacy = _lsGet(AUTOSAVE_KEY);
      if (legacy && (legacy.savedAt || 0) > (_cache[K_AUTOSAVE].savedAt || 0)) { _cache[K_AUTOSAVE] = legacy; _idbPutBg(K_AUTOSAVE, legacy); }
    }
    // 迁移槽位索引 + 各槽位存档
    if (!_cache[K_SLOTS_INDEX]) {
      const idx = _lsGet(SLOTS_INDEX_KEY);
      if (Array.isArray(idx) && idx.length) {
        _cache[K_SLOTS_INDEX] = idx; _idbPutBg(K_SLOTS_INDEX, idx);
        for (const s of idx) { const snap = _lsGet(SLOT_PREFIX + s.id); if (snap) { _cache[slotKey(s.id)] = snap; _idbPutBg(slotKey(s.id), snap); } }
      }
    }
  } catch (e) {
    // IDB 整个不可用 → 纯 localStorage 降级：把旧键读进 _cache
    _idbAvailable = false;
    console.warn("[saves] IndexedDB 不可用，降级 localStorage:", e?.message || e);
    const legacy = _lsGet(AUTOSAVE_KEY);
    if (legacy) _cache[K_AUTOSAVE] = legacy;
    const idx = _lsGet(SLOTS_INDEX_KEY);
    if (Array.isArray(idx)) { _cache[K_SLOTS_INDEX] = idx; for (const s of idx) { const snap = _lsGet(SLOT_PREFIX + s.id); if (snap) _cache[slotKey(s.id)] = snap; } }
  }
  _initialized = true;
}

// state 快照结构
export function buildSnapshot({ preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, deposit, depositedAt, pledgedItems, persuasionProgress, innerRoomName, companionState, squares }) {
  return {
    version: 1,
    savedAt: Date.now(),
    preset: { id: preset.id, name: preset.name },
    room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree,
    // 内层箱庭位置（本轮补）：此前快照只存 room.name（外层据点），没存玩家站在据点内的
    // 哪个房间。于是读档/组件重挂载后，内层位置一律被重置回据点锚点——表现为"人明明在
    // 玉石料场，一动就从镇口起步"。老存档没有这个字段，读档时按锚点兜底，不影响兼容。
    innerRoomName: innerRoomName ?? null,
    claimedMilestones: claimedMilestones ? Array.from(claimedMilestones) : [],
    questProgress: questProgress || {},
    deposit: deposit || 0, depositedAt: depositedAt || null, pledgedItems: pledgedItems || [],
    persuasionProgress: persuasionProgress || {},
    // 伙伴系统（本轮新增）：雪豹的解锁/出战状态。老存档没有这个字段，读档时由
    // MudRPG.jsx 用 companion.js 的 initCompanionState() 兜底，不影响兼容。
    companionState: companionState || null,
    // 地图格子（扫雷式预埋）：各据点当日预跑的到达文本/埋物/路遇。老存档无此字段，
    // 读档时按空表兜底，开局预跑会重新掷骰写文，不影响兼容。
    squares: squares || null,
  };
}

// ── 自动存档（同步返回 {ok}：写内存必成，IDB 异步兜底）─────────────────────────
export function autoSave(snapshot) {
  const snap = _clone(snapshot);
  _cache[K_AUTOSAVE] = snap;
  _idbPutBg(K_AUTOSAVE, snap);
  // 尽力同步写一份 LS 作关页兜底；超额（5MB）就跳过，不视为失败——IDB 才是主存储。
  _lsSet(AUTOSAVE_KEY, snap);
  return { ok: true };
}

export function loadAutoSave() { return _cache[K_AUTOSAVE] || null; }

export function clearAutoSave() {
  delete _cache[K_AUTOSAVE];
  _idbDelBg(K_AUTOSAVE);
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* */ }
}

// 关页同步兜底（IDB 异步写来不及落盘时，靠这份 LS 兜住最新一轮）
export function flushLocalBackup(snapshot) { _lsSet(AUTOSAVE_KEY, snapshot); }

// ── 手动多槽位 ────────────────────────────────────────────────────────────────
function getSlotsIndex() { return _cache[K_SLOTS_INDEX] || []; }
function setSlotsIndex(index) { _cache[K_SLOTS_INDEX] = index; _idbPutBg(K_SLOTS_INDEX, index); _lsSet(SLOTS_INDEX_KEY, index); }

export function listSlots() { return getSlotsIndex().slice().sort((a, b) => b.savedAt - a.savedAt); }

export function saveToSlot(snapshot, label) {
  const id = `slot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const snap = _clone(snapshot);
  const entry = { id, label: label || `存档 ${new Date(snap.savedAt).toLocaleString()}`, savedAt: snap.savedAt, presetName: snap.preset.name };
  _cache[slotKey(id)] = snap;
  _idbPutBg(slotKey(id), snap);
  _lsSet(SLOT_PREFIX + id, snap); // 尽力 LS 兜底（超额跳过）
  const index = getSlotsIndex().slice();
  index.push(entry);
  setSlotsIndex(index);
  return id;
}

export function loadSlot(id) { return _cache[slotKey(id)] || null; }

export function deleteSlot(id) {
  delete _cache[slotKey(id)];
  _idbDelBg(slotKey(id));
  try { localStorage.removeItem(SLOT_PREFIX + id); } catch { /* */ }
  setSlotsIndex(getSlotsIndex().filter(s => s.id !== id));
}

export function renameSlot(id, label) {
  const index = getSlotsIndex().slice();
  const entry = index.find(s => s.id === id);
  if (entry) { entry.label = label; setSlotsIndex(index); }
}

// ── 存档落盘导出 / 导入 ──
// 导出：把一个 snapshot 包成带标记的 JSON 文本，供 UI 下载成 .json 文件。
export function exportSave(snapshot, label) {
  return JSON.stringify({
    kind: "qucuo-save-export",
    version: 1,
    exportedAt: Date.now(),
    label: label || `存档 ${new Date(snapshot?.savedAt || Date.now()).toLocaleString()}`,
    snapshot,
  }, null, 2);
}

// 导入：从导出的 JSON 文本读回 snapshot，写进一个新槽位，返回新槽位 id。
// 兼容两种输入：① 我们导出的 {kind, snapshot} 包裹格式；② 直接是裸 snapshot。
export function importSave(jsonText) {
  const data = JSON.parse(jsonText);
  const snap = data && data.kind === "qucuo-save-export" ? data.snapshot : data;
  if (!snap || !snap.preset || !snap.char) throw new Error("这个文件不是有效的曲措乡存档。");
  const label = (data && data.label) ? `${data.label}（导入）` : "导入的存档";
  return saveToSlot(snap, label);
}

// 尝试从自动存档恢复；找不到时返回 null，调用方 fallback 到 preset 默认值。
// 关键防御：如果存档是旧版本结构（比如缺少 neigong/waigong/special 字段），
// 直接判定为不兼容，丢弃存档而不是硬塞进新代码导致渲染崩溃。
// 这两个判定必须 export：MudRPG.applySnapshot（手动读槽位 + ↩回滚）也要用同一套
// 兼容标准，不能各写一份。此前它们是模块私有、MudRPG 却直接裸调用，
// 结果读档/回滚一点就 ReferenceError（见 version.js 0727 修复记录）。
export function isCompatibleCharShape(char) {
  return !!char
    && Array.isArray(char.hp)
    && typeof char.neigong === "number"
    && typeof char.waigong === "number"
    && char.special && typeof char.special === "object";
}

export function isCompatibleRoomShape(room) {
  return !!room
    && typeof room.name === "string"
    && typeof room.desc === "string"
    && Array.isArray(room.exits)
    && Array.isArray(room.npcs)
    && Array.isArray(room.items);
}

// loadSlotId 含义：
//   "auto"/null/undefined → 自动存档；其他字符串 → 手动槽位 id。
// 存档已在启动时由 saves.init() 全量灌入内存缓存，故 loadAutoSave/loadSlot 是同步读缓存，
// 这里保持同步、MudRPG 一整套 useState(restored?…) 初始化不受影响。
export function tryRestoreSave(presets, loadSlotId) {
  let snap = null;
  if (loadSlotId === "auto" || loadSlotId === undefined || loadSlotId === null) {
    snap = loadAutoSave();
  } else {
    snap = loadSlot(loadSlotId);
  }
  if (!snap) return null;
  const matchedPreset = presets.find(p => p.id === snap.preset?.id);
  if (!matchedPreset) return null;
  if (!isCompatibleCharShape(snap.char) || !isCompatibleRoomShape(snap.room)) {
    console.warn("检测到旧版本存档结构，已自动丢弃并使用默认角色/房间数据");
    return null;
  }
  // 老存档装备迁移：早期有物品（如"无主的青锋剑"）误用了 atkMul/defMul 倍率字段，
  // 但战斗/装备系统只读 atk/def 实际值——倍率字段从来没人读，导致装备了却加不到攻防。
  // 读档时统一补算：凡是有倍率但缺实际值的武器/护甲，用「品质基准 × 倍率」折出 atk/def。
  // 通用处理（不针对单个 id），这类死字段坑一次堵死，将来别的漏网物品也自动修好。
  if (Array.isArray(snap.inv)) {
    snap.inv = snap.inv.map(it => {
      if (!it || typeof it !== "object") return it;
      const fixed = { ...it };
      if (fixed.atkMul != null && fixed.atk == null && fixed.category === "weapon") {
        const base = statsForQuality("weapon", fixed.quality);
        if (base.atk != null) fixed.atk = Math.round(base.atk * fixed.atkMul);
      }
      if (fixed.defMul != null && fixed.def == null && fixed.category === "armor") {
        const base = statsForQuality("armor", fixed.quality);
        if (base.def != null) fixed.def = Math.round(base.def * fixed.defMul);
      }
      return fixed;
    });
  }
  return { snap, preset: matchedPreset };
}
