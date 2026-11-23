// 已入册角色注册表 · 存储层（从 importedRegistry.js 拆出）
// ============================================================================
// IndexedDB 读写 + 变更订阅 + 初始化。_registry/_rev 只在本文件里，别的文件
// 读写注册表一律走 _reg()/_setReg()/persist()。
//
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
let _registry = { chars: [], world: [], savedAt: 0 };
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

// ── 变更通知 ────────────────────────────────────────────────────────────────
// 【为什么需要】这个库是模块级可变状态（_registry 是个 let），而 React 的依赖数组
// 只认它自己管的 state 与 props——组装 room.npcs 的那个 effect 依赖
// [room.name, dayIdx, questProgress, flags]，落册改了 _registry 之后没有一项会变，
// effect 不重跑，玩家在原地落册人不出现，非得走出据点再回来才刷。
//
// 【为什么用订阅而不是让调用方自己数版本号】上一轮的做法是在 MudRPG 里加一个
// importedVer state、在 handleImportNpcs 里 +1。它当场就漏了一个写入点：
// handleImportWorld 走 registerImportedWorld，那里没有 +1。手动计数的毛病就在
// 这儿——每加一个写操作都得记得同步，漏了不报错。
// 挂在 persist 上则天然覆盖全部：registerImported / registerImportedWorld /
// removeImported / clearImported 四个写操作都以它为唯一出口。
let _rev = 0;
const _subs = new Set();

/** 供 useSyncExternalStore 订阅，返回取消订阅函数 */
export function subscribeImported(cb) {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** 供 useSyncExternalStore 取快照。必须是稳定值——同一状态下返回同一个数 */
export function getImportedRevision() {
  return _rev;
}

/** 内部：同包文件读写注册表用，别在外面 import */
export function _reg() { return _registry; }
export function _setReg(v) { _registry = v; }
export function persist() {
  const v = { ...(_registry), savedAt: Date.now() };
  _registry = v;
  if (_idbAvailable) idbPut(KEY, v).catch(e => console.warn("[imported] 写入失败", e?.message || e));
  // 生成即落盘，不等关页——这套东西是玩家亲手改过一遍的，丢了要重来一整轮
  _rev++;
  for (const cb of _subs) { try { cb(); } catch { /* 某个订阅者炸了不该拖累别人 */ } }
}

/** 启动时 await 一次 */
export async function init() {
  if (_initialized) return;
  try {
    const v = await idbGet(KEY);
    _idbAvailable = true;
    if (v && Array.isArray(v.chars)) _registry = { world: [], ...v };
  } catch (e) {
    _idbAvailable = false;
    console.warn("[imported] IndexedDB 不可用，入册角色本次不持久化:", e?.message || e);
  }
  _initialized = true;
}
