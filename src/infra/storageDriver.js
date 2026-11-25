import {
  configureCloudFetch as configureAdapterFetch, hubBinding, hubPutSave, hubDeleteSave, hubWipeSpace,
  encryptSaveValue, expectedRevFor, recordServerRev, clearServerRev, clearAllServerRevs,
} from "./cloudProtocol.js";
import { loadStorageConfig, saveStorageConfig } from "./storageConfig.js";
export { loadStorageConfig, saveStorageConfig };

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

const QUEUE_KEY = "wuxia_mud_cloud_queue";
const CONFLICTS_KEY = "wuxia_mud_cloud_conflicts";

// ── 配置 ─────────────────────────────────────────────────────────────────────

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
// WO-19/20 PR-A：所有云端调用经 cloudProtocol adapter 翻译成 canonical 契约
// （URL/形状/rev/鉴权/加密）；fetch 注入点穿透到 adapter，测试无感。
export function configureCloudFetch(fetchImpl) { configureAdapterFetch(fetchImpl); }

function _lsRead(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function _lsWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

export function getCloudQueue() { return _lsRead(QUEUE_KEY, []); }
export function getCloudConflicts() { return _lsRead(CONFLICTS_KEY, []); }

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
// 在飞 flush 的中止柄：wipeCloudAll 确认后 abort——即便服务端竞态已不可完全根除
// （在飞 PUT 可能先于 DELETE 到达，属服务端 WO-20 竞态限制），客户端至少不再发出
// 后续请求、也不再消费在飞结果。
let _activeAbort = null;
// 抹除代次：wipeCloudAll 递增，在飞 flush 逐条核对——服务端已确认删除后再推
// 新存档等于撤销玩家的抹除确认（复审必修）。
let _wipeEpoch = 0;
export async function flushCloudQueue() {
  // 在飞互斥（二审必修 2）：防抖到期与「立即推送」并发双 flush 会交错递增 rev 乱序。
  // 重入直接返回——在飞那次 flush 结束时会处理队列里所有条目（含新入队的）。
  // busy 不丢批次（Review）：挂在飞 flush 的尾续——它结束时若队列仍非空会再补一轮，
  // 防抖在飞期间入队的新存档不会 stalled 到下次写入。
  if (_flushing) { _flushAgain = true; return { ok: false, reason: "busy" }; }
  _flushing = true;
  try { return await _flushCloudQueueInner(); } finally {
    _flushing = false;
    if (_flushAgain) {
      _flushAgain = false;
      if (getCloudQueue().length) void flushCloudQueue();
    }
  }
}
let _flushAgain = false;
async function _flushCloudQueueInner() {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  const cfg = loadStorageConfig();
  // 优雅降级（PR-A 硬要求）：cloudUrl/spaceId/hubToken 三件套缺一即 unbound——
  // 队列原样保留不推不丢，绝不能半通状态发出残缺请求。
  const binding = hubBinding(cfg);
  if (!binding.bound) return { ok: false, reason: "unbound" };
  let queue = getCloudQueue();
  if (!queue.length) return { ok: true, pushed: 0 };
  const startEpoch = _wipeEpoch;
  const remaining = [];
  let pushed = 0;
  let failed = false;
  for (const entry of queue) {
    if (_wipeEpoch !== startEpoch) { failed = false; break; } // 抹除发生：立即停止，剩余条目已被清空不再推
    try {
      // rev 语义修正（PR-A 硬要求）：本地计数器不作 CAS 依据——expectedRev 只能取
      // serverRev 台账（首写 0），本地 rev 仅是排队参考不再上送。
      const expectedRev = expectedRevFor(entry.key, binding.spaceId);
      let result;
      if (entry.op === "put") {
        const payloadEnc = await encryptSaveValue(entry.value);
        // Review 修：加密 await 期间翻代——连请求都不发（否则服务端接受 rev-0 上行，
        // 已抹空间被重建——本地不写台账也拦不住云端复活）。
        if (_wipeEpoch !== startEpoch) { failed = false; break; }
        result = await hubPutSave(binding, entry.key, payloadEnc, { expectedRev });
      } else {
        result = await hubDeleteSave(binding, entry.key, { expectedRev });
      }
      // wipe 竞态（初审返修）：fetch await 期间发生抹除——响应返回后必须先核对翻代，
      // 已翻代直接停止：不写台账不登记冲突（否则 clearAllServerRevs 之后又把已抹 rev 写回）。
      if (_wipeEpoch !== startEpoch) { failed = false; break; }
      if (result.conflict) {
        // 冲突绝不静默（裁决收紧）：一律进冲突登记等玩家显式裁决——包括首次错位。
        // 迁移/换绑场景的代价只是玩家在 UI 点一次「本地覆盖云端」；新设备误覆盖
        // 另一设备存档的代价不可逆，两者不对称，宁误登记不误对齐。
        const conflicts = getCloudConflicts().filter((c) => c.key !== entry.key);
        conflicts.push({ key: entry.key, spaceId: binding.spaceId, rev: expectedRev, serverRev: result.serverRev ?? null, queuedAt: entry.queuedAt, detectedAt: Date.now(), op: entry.op, value: entry.value });
        _lsWrite(CONFLICTS_KEY, conflicts);
        pushed += 1; // 出队——它不是失败，是待裁决
        continue;
      }
      if (!result.ok) throw new Error(`HTTP ${result.status}`);
      if (entry.op === "put" && Number.isInteger(result.rev)) recordServerRev(entry.key, result.rev, binding.spaceId);
      if (entry.op === "del") clearServerRev(entry.key, binding.spaceId);
      pushed += 1;
    } catch (_) {
      if (_wipeEpoch !== startEpoch) { failed = false; break; } // 抹除中止：不重试不残留
      remaining.push(entry);
      failed = true;
    }
  }
  // 合并写回（复审必修）：flush 期间玩家可能又存档——整队覆盖会把新条目抹掉。
  // 只按 key+queuedAt 身份移除本批已推送/已登记的条目，其余（新入队/失败）全保留。
  const doneIds = new Set(queue.filter((e) => !remaining.includes(e)).map((e) => `${e.key}@${e.queuedAt}`));
  const merged = getCloudQueue().filter((e) => !doneIds.has(`${e.key}@${e.queuedAt}`));
  // 失败重入队（Review）：flush 期间同键被更新的存档顶替过时，obsolete 失败件
  // 若排在新版后面重试会以更高 rev 覆盖掉新存档——同键已有更新入队就直接丢弃。
  for (const e of remaining) {
    if (merged.some((m) => m.key === e.key)) continue; // 同键只留最新（入队合并语义）
    merged.push(e);
  }
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
  // 跨空间/无戳遗留冲突作废（Review 修+裁决）：冲突是在旧空间登记的（或 legacy 无戳），
  // 对它执行「本地覆盖云端」会把 force 打进新空间的同名槽——无 rev 校验覆盖别人备份。
  const currentSpace = hubBinding(loadStorageConfig()).spaceId || "";
    // 严格不等即废（裁决）：缺失/空串 spaceId 的 legacy/异常遗留同样作废——
  // 正常绑定 spaceId 必填，无法证明同源就绝不 force。
  if (hit.spaceId !== currentSpace) return false;
  if (choice === "keep_local") {
    if (hit.op === "put") {
      enqueueCloudForcePush(key, hit.value);
    } else if (hit.op === "del") {
      // del 冲突的 keep_local：force DELETE（二审必修 5）——不再是静默无效选项
      const binding = hubBinding(loadStorageConfig());
      if (binding.bound) {
        void Promise.resolve(hubDeleteSave(binding, key, { expectedRev: expectedRevFor(key, binding.spaceId), force: true }))
          .then((r) => { if (r.ok) clearServerRev(key, binding.spaceId); })
          .catch(() => enqueueCloudPush(key, undefined, "del"));
      }
    }
  } else if (choice === "keep_cloud") {
    // rev 对齐（二审必修 4）：把 serverRev 台账对齐到服务端 rev，下次推送以此为
    // expectedRev 不再必然 409。服务端未上报 serverRev 时无法对齐——UI 文案需说明
    // 这只是暂停同步、下次推送仍可能冲突（见 SavesTab）。
    if (Number.isFinite(hit.serverRev)) {
      recordServerRev(key, hit.serverRev, hubBinding(loadStorageConfig()).spaceId);
    }
  }
  return true;
}

function enqueueCloudForcePush(key, value) {
  // 显式玩家裁决后的强制推送：带 force:true，服务端跳过 rev 校验。这是唯一合法
  // 的覆盖路径——必须经玩家在 UI 点选，绝不可能由自动流程触发。
  const binding = hubBinding(loadStorageConfig());
  if (!binding.bound) return;
  void (async () => {
    const payloadEnc = await encryptSaveValue(value);
    return hubPutSave(binding, key, payloadEnc, { expectedRev: expectedRevFor(key, binding.spaceId), force: true });
  })().then((r) => {
    if (r.ok && Number.isInteger(r.rev)) recordServerRev(key, r.rev, binding.spaceId);
  }).catch(() => {
    // 强制推送也失败就回普通队列等退避重试——但不再带 force，避免无意识的自动覆盖
    enqueueCloudPush(key, value);
  });
}

// 一键彻底抹除云端全部存档与记忆（客户端接口；UI 必须二次确认后才许调用）。
export async function wipeCloudAll() {
  const cfg = loadStorageConfig();
  const binding = hubBinding(cfg);
  if (!binding.bound) return { ok: false, reason: "unbound" };
  try {
    // adapter 内重写为 canonical `DELETE /api/space/<spaceId>`（单数、无 /saves 后缀）
    const res = await hubWipeSpace(binding);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _wipeEpoch += 1; // 服务端确认删除后才翻代——在飞 flush 即刻停推
    try { _activeAbort?.abort(); } catch { /* */ }
    _activeAbort = null;
    _lsWrite(QUEUE_KEY, []);
    clearAllServerRevs(binding.spaceId);
    _lsWrite(CONFLICTS_KEY, []);
    // prose 上行队列同清（Review SEC 修）：服务端 wipe 连 prose_chunks 一起抹，
    // 队列里未推的段若留存会在 wipe 后重新上行——「彻底抹除」语义被击穿。
    try {
      const { _resetProseUplinkQueueForWipe } = await import("./proseUplink.js");
      _resetProseUplinkQueueForWipe?.();
    } catch { /* 动态导入失败不阻断 wipe 主路径 */ }
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
  _flushing = false; _flushAgain = false; _activeAbort = null; // 测试隔离：跨用例泄漏的 flush 互斥态不带入下一场
}
