// 存档三档存储驱动抽象（WO-19）——local / cloud / file
// ------------------------------------------------------------------
// 口径钉死：
// · saves.js 内存 _cache 仍是唯一同步读源，本模块只接管「异步落盘镜像」：
//   所有写/删经 saves 的 _idbPutBg/_idbDelBg 同步转发到 mirrorSaveWrite/mirrorSaveRemove。
// · local（默认）：行为与改造前完全一致——IndexedDB + localStorage 兜底，零注册离线可玩，
//   驱动切换不影响旧档。
// · cloud：本地照写（双写不丢），同时把每次写/删排队推向云服务接口。服务地址/绑定态
//   存 wuxia_mud_storage_config，独立于我模型 apiCfg。每键递增 rev；服务端 409 绝不
//   静默覆盖——进冲突登记，等玩家在设置面板显式选「本地覆盖云端」或「放弃本次推送」。
// · file：不做实时镜像，只提供整包导入导出（在 saves.js 的 export/import 上扩原文段落）。
// · 网络失败指数退避 + 3 秒防抖合批；离线/失败队列持久化在 LS，刷新不丢。
// · 服务端 WO-20 另做——本模块只是客户端接口与可测试 adapter seam，fetch 可注入。

const CONFIG_KEY = "wuxia_mud_storage_config";
const QUEUE_KEY = "wuxia_mud_cloud_queue";
const REVS_KEY = "wuxia_mud_cloud_revs";
const CONFLICTS_KEY = "wuxia_mud_cloud_conflicts";

// ── 配置 ─────────────────────────────────────────────────────────────────────
export function loadStorageConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return {
      driver: ["local", "cloud", "file"].includes(cfg.driver) ? cfg.driver : "local",
      cloudUrl: typeof cfg.cloudUrl === "string" ? cfg.cloudUrl : "",
      deviceId: typeof cfg.deviceId === "string" && cfg.deviceId
        ? cfg.deviceId
        : (() => {
          // 设备 id 一旦生成立即持久化——每次现造随机 id 等于每次都换设备，
          // 服务端按设备判冲突会全乱（二审必修 1）。
          const id = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, deviceId: id })); } catch { /* */ }
          return id;
        })(),
      boundAt: cfg.boundAt || null,
    };
  } catch {
    return { driver: "local", cloudUrl: "", deviceId: "dev_fallback", boundAt: null };
  }
}

export function saveStorageConfig(cfg) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); return true; } catch { return false; }
}

// 模块内驱动缓存：LS 是真相源，内存只是热读
let _driver = null;
export function getStorageDriver() {
  if (!_driver) _driver = loadStorageConfig().driver;
  return _driver;
}
export function setStorageDriver(driver) {
  if (!["local", "cloud", "file"].includes(driver)) return false;
  const cfg = loadStorageConfig();
  saveStorageConfig({ ...cfg, driver });
  _driver = driver;
  return true;
}

// ── cloud 客户端 seam ─────────────────────────────────────────────────────────
// fetch 注入点：测试/未来真实实现都走这里。默认用全局 fetch。
let _fetchImpl = null;
export function configureCloudFetch(fetchImpl) { _fetchImpl = fetchImpl; }
const doFetch = (...args) => (_fetchImpl || globalThis.fetch).apply(null, args);

function _lsRead(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function _lsWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

export function getCloudQueue() { return _lsRead(QUEUE_KEY, []); }
export function getCloudRevs() { return _lsRead(REVS_KEY, {}); }
export function getCloudConflicts() { return _lsRead(CONFLICTS_KEY, []); }

function nextRev(key) {
  const revs = getCloudRevs();
  const rev = (revs[key] || 0) + 1;
  revs[key] = rev;
  _lsWrite(REVS_KEY, revs);
  return rev;
}

// 入队：每键只留最新一份（同键后写覆盖前写——合并语义安全，存档本来就是全量快照）。
// 3 秒防抖合批后统一推送。
let _debounceTimer = null;
let _retryTimer = null;
let _retryDelay = 1000;
// 队列配额（二审必修 3）：快照整份入库体积大，LS 配额有限。封顶 100 条——
// 超出丢最老并显式 console.warn（不静默），丢条目画面可从队列长度变化观察；
// _lsWrite 失败同样 warn 不静默。极端体量（全槽位全量快照排长队）的根治
// 是 flush 时从本地存档现取，留待 WO-20 服务端语义落定后改造。
const QUEUE_CAP = 100;
export function enqueueCloudPush(key, value, op = "put") {
  const queue = getCloudQueue().filter((e) => e.key !== key);
  queue.push({ key, op, value: op === "put" ? value : undefined, queuedAt: Date.now() });
  while (queue.length > QUEUE_CAP) {
    const dropped = queue.shift();
    console.warn(`[cloud] 推送队列超 ${QUEUE_CAP} 条上限，丢弃最老条目 ${dropped?.key}（该键云端将落后于本地，可手动重新同步）`);
  }
  if (!_lsWrite(QUEUE_KEY, queue)) {
    console.warn("[cloud] 推送队列写 localStorage 失败（配额满？）——本次入队可能丢失，云端将落后于本地");
  }
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => { void flushCloudQueue(); }, 3000);
  return queue.length;
}

// 推送：逐条 POST /saves/<key>，body 带 rev。409 → 进冲突登记、不重试不覆盖；
// 网络/5xx 失败 → 保留队列、指数退避重试（1s 起翻倍，封顶 60s）。
let _flushing = false;
// 抹除代次：wipeCloudAll 递增，在飞 flush 逐条核对——服务端已确认删除后再推
// 新存档等于撤销玩家的抹除确认（复审必修）。
let _wipeEpoch = 0;
export async function flushCloudQueue() {
  // 在飞互斥（二审必修 2）：防抖到期与「立即推送」并发双 flush 会交错递增 rev 乱序。
  // 重入直接返回——在飞那次 flush 结束时会处理队列里所有条目（含新入队的）。
  if (_flushing) return { ok: false, reason: "busy" };
  _flushing = true;
  try { return await _flushCloudQueueInner(); } finally { _flushing = false; }
}
async function _flushCloudQueueInner() {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  const cfg = loadStorageConfig();
  if (!cfg.cloudUrl) return { ok: false, reason: "unbound" };
  let queue = getCloudQueue();
  if (!queue.length) return { ok: true, pushed: 0 };
  const startEpoch = _wipeEpoch;
  const remaining = [];
  let pushed = 0;
  let failed = false;
  for (const entry of queue) {
    if (_wipeEpoch !== startEpoch) { failed = false; break; } // 抹除发生：立即停止，剩余条目已被清空不再推
    try {
      const rev = entry.op === "put" ? nextRev(entry.key) : (getCloudRevs()[entry.key] || 0) + 1;
      const res = await doFetch(`${cfg.cloudUrl.replace(/\/$/, "")}/saves/${encodeURIComponent(entry.key)}`, {
        method: entry.op === "put" ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json", "X-Device-Id": cfg.deviceId },
        body: entry.op === "put" ? JSON.stringify({ rev, value: entry.value, deviceId: cfg.deviceId }) : undefined,
      });
      if (res.status === 409) {
        // 冲突：绝不静默覆盖——登记后等玩家显式裁决。
        // 尽力读取服务端 rev（WO-20 契约：409 body 可带 serverRev），供 keep_cloud 对齐用。
        let serverRev = null;
        try { const j = typeof res.json === "function" ? await res.json() : null; serverRev = j?.serverRev ?? null; } catch { /* 无 body 就算了 */ }
        const conflicts = getCloudConflicts().filter((c) => c.key !== entry.key);
        conflicts.push({ key: entry.key, rev, serverRev, queuedAt: entry.queuedAt, detectedAt: Date.now(), op: entry.op, value: entry.value });
        _lsWrite(CONFLICTS_KEY, conflicts);
        pushed += 1; // 出队——它不是失败，是待裁决
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (entry.op === "del") { const revs = getCloudRevs(); revs[entry.key] = rev; _lsWrite(REVS_KEY, revs); }
      pushed += 1;
    } catch (_) {
      remaining.push(entry);
      failed = true;
    }
  }
  // 合并写回（复审必修）：flush 期间玩家可能又存档——整队覆盖会把新条目抹掉。
  // 只按 key+queuedAt 身份移除本批已推送/已登记的条目，其余（新入队/失败）全保留。
  const doneIds = new Set(queue.filter((e) => !remaining.includes(e)).map((e) => `${e.key}@${e.queuedAt}`));
  const merged = getCloudQueue().filter((e) => !doneIds.has(`${e.key}@${e.queuedAt}`));
  for (const e of remaining) if (!merged.some((m) => m.key === e.key && m.queuedAt === e.queuedAt)) merged.push(e);
  _lsWrite(QUEUE_KEY, merged);
  if (failed && merged.length) {
    _retryTimer = setTimeout(() => { void flushCloudQueue(); }, _retryDelay);
    _retryDelay = Math.min(_retryDelay * 2, 60000);
  } else {
    _retryDelay = 1000;
  }
  return { ok: !failed, pushed, remaining: remaining.length };
}

// 冲突裁决：keep_local = 强制推送（force 旗标，服务端 WO-20 据此跳过 rev 校验）；
// keep_cloud = 放弃本地这次推送（本地存档本体仍在 _cache/IDB，只是不同步这条）。
export function resolveCloudConflict(key, choice) {
  const conflicts = getCloudConflicts();
  const hit = conflicts.find((c) => c.key === key);
  _lsWrite(CONFLICTS_KEY, conflicts.filter((c) => c.key !== key));
  if (!hit) return false;
  if (choice === "keep_local") {
    if (hit.op === "put") {
      enqueueCloudForcePush(key, hit.value);
    } else if (hit.op === "del") {
      // del 冲突的 keep_local：force DELETE（二审必修 5）——不再是静默无效选项
      const cfg = loadStorageConfig();
      if (cfg.cloudUrl) {
        const rev = nextRev(key);
        void Promise.resolve(doFetch(`${cfg.cloudUrl.replace(/\/$/, "")}/saves/${encodeURIComponent(key)}?force=1&rev=${rev}`, {
          method: "DELETE", headers: { "X-Device-Id": cfg.deviceId },
        })).catch(() => enqueueCloudPush(key, undefined, "del"));
      }
    }
  } else if (choice === "keep_cloud") {
    // rev 对齐（二审必修 4）：把本地 rev 对齐到服务端 rev，下次推送用 serverRev+1
    // 不再必然 409。服务端未上报 serverRev 时无法对齐——UI 文案需说明这只是暂停
    // 同步、下次推送仍可能冲突（见 SavesTab）。
    if (Number.isFinite(hit.serverRev)) {
      const revs = getCloudRevs();
      revs[key] = hit.serverRev;
      _lsWrite(REVS_KEY, revs);
    }
  }
  return true;
}

function enqueueCloudForcePush(key, value) {
  // 显式玩家裁决后的强制推送：带 force:true，服务端跳过 rev 校验。这是唯一合法
  // 的覆盖路径——必须经玩家在 UI 点选，绝不可能由自动流程触发。
  const cfg = loadStorageConfig();
  if (!cfg.cloudUrl) return;
  const rev = nextRev(key);
  void Promise.resolve(doFetch(`${cfg.cloudUrl.replace(/\/$/, "")}/saves/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Device-Id": cfg.deviceId },
    body: JSON.stringify({ rev, value, deviceId: cfg.deviceId, force: true }),
  })).catch(() => {
    // 强制推送也失败就回普通队列等退避重试——但不再带 force，避免无意识的自动覆盖
    enqueueCloudPush(key, value);
  });
}

// 一键彻底抹除云端全部存档与记忆（客户端接口；UI 必须二次确认后才许调用）。
export async function wipeCloudAll() {
  const cfg = loadStorageConfig();
  if (!cfg.cloudUrl) return { ok: false, reason: "unbound" };
  try {
    const res = await doFetch(`${cfg.cloudUrl.replace(/\/$/, "")}/saves`, {
      method: "DELETE",
      headers: { "X-Device-Id": cfg.deviceId },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _wipeEpoch += 1; // 服务端确认删除后才翻代——在飞 flush 即刻停推
    _lsWrite(QUEUE_KEY, []);
    _lsWrite(REVS_KEY, {});
    _lsWrite(CONFLICTS_KEY, []);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "network" };
  }
}

// ── saves.js 镜像入口（驱动路由）─────────────────────────────────────────────
// local：什么都不做（IDB+LS 已是全部）；cloud：入队推送；file：不做实时镜像。
export function mirrorSaveWrite(key, value) {
  if (getStorageDriver() === "cloud") enqueueCloudPush(key, value, "put");
}
export function mirrorSaveRemove(key) {
  if (getStorageDriver() === "cloud") enqueueCloudPush(key, undefined, "del");
}

// 刷新恢复（复审必修）：重载页面后没有新写就不会有 flush——滞留队列永远卡住。
// 模块加载时若 cloud 档且队列非空，延迟一拍自动补推（等 LS/环境就绪，避免与启动竞态）。
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  setTimeout(() => {
    try {
      if (getStorageDriver() === "cloud" && getCloudQueue().length) void flushCloudQueue();
    } catch { /* 增量层静默 */ }
  }, 3500);
}

// 测试复位
export function _resetCloudStateForTest() {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  if (_retryTimer) clearTimeout(_retryTimer);
  _debounceTimer = null; _retryTimer = null; _retryDelay = 1000; _driver = null;
}
