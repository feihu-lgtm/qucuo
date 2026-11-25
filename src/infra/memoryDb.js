// qucuo_memory 共享开库与版本升级（WO-17）
// ------------------------------------------------------------------
// 背景：memoryStore（小纸条向量库）建库时是 DB_VERSION 1/单表 memories；
// WO-17 段落库在同一库新增 prose_chunks 表。两个模块若各自 indexedDB.open，
// 谁先打开谁升级，后开低版本会直接报错——统一走本模块：版本号、升级事务、
// 单例 promise 只有一份，memories 原表与旧记录原样保留。
//
// 版本史：v1 = memories（小纸条）；v2 = + prose_chunks（WO-17 原文段落库）。

const DB_NAME = "qucuo_memory";
const DB_VERSION = 2;

let _dbPromise = null;

export function openMemoryDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境不支持 IndexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // v1：小纸条向量表（老库已有则跳过，记录不动）
      if (!db.objectStoreNames.contains("memories")) {
        db.createObjectStore("memories", { keyPath: "id" });
      }
      // v2：原文段落库——主键 id，索引 turn/location（契约 A ProseChunk）
      if (!db.objectStoreNames.contains("prose_chunks")) {
        const store = db.createObjectStore("prose_chunks", { keyPath: "id" });
        store.createIndex("turn", "turn", { unique: false });
        store.createIndex("location", "location", { unique: false });
      }
      void event;
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

export function memoryStoreOf(mode, storeName) {
  return openMemoryDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

// 测试用：重置单例（fake-indexeddb 每用例新建库）
export function _resetMemoryDbForTest() {
  _dbPromise = null;
}
