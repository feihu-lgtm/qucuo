// 记忆库（IndexedDB）
// ------------------------------------------------------------------
// 专门存"带向量的长期记忆"，跟主存档（localStorage 里的 saves）隔离——
// 向量数据量大、只在召回时读，不适合塞进每回合都要序列化的存档快照里。
//
// 库名 qucuo_memory，单一对象仓库 memories，主键 id。
// 一条记录的结构（与 recallWithVisibility 约定）：
//   {
//     id: string,              // "mem_<turn>_<随机>"，唯一
//     text: string,            // ≤50字纯事实摘要，既是索引也是载荷（v1 简化版）
//     turn: number,            // 记忆产生时的游戏回合
//     visibility: "public"|"private",   // 可见性层级
//     requiredFlag: string|null,        // private 记忆需要哪个 flag 解锁；public 恒为 null
//     entities: string[],      // 涉及的人物/地点名，供实体聚焦过滤
//     embedding: number[],     // 向量（Float32Array 存不进 IDB，转普通数组）
//     fingerprint: string,     // embedding 模型指纹，换模型后旧记录作废
//     createdAt: number,
//   }

const DB_NAME = "qucuo_memory";
const DB_VERSION = 1;
const STORE = "memories";

let _dbPromise = null;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境不支持 IndexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode) {
  return openDb().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

export async function addMemory(record) {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMemories() {
  try {
    const store = await tx("readonly");
    return await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // 降级：库打不开就当没有记忆，召回返回空，不阻断游戏
    console.warn("[memoryStore] 读取失败，按空记忆处理：", err.message || err);
    return [];
  }
}

export async function countMemories() {
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

export async function clearMemories() {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
