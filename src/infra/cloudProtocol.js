// WO-19/20 PR-A 客户端 protocol adapter（canonical 服务端契约映射层）
// ------------------------------------------------------------------
// 服务端 server/memory-hub 是 canonical 契约不迎合客户端，本模块做全部翻译：
// · URL：`<host>/api/spaces/<spaceId>/saves/<slotId>`；wipe 重写为 `DELETE /api/space/<spaceId>`
// · 形状：{expectedRev, payloadEnc}——expectedRev 是服务端权威 rev（不是本地计数器），
//   payloadEnc 是 WebCrypto AES-GCM 密文串（密钥不离开客户端，明文绝不上送）
// · 鉴权：`x-memory-hub-token` 必带；缺 cloudUrl/spaceId/hubToken 任一即 unbound 优雅降级
// · deviceId 保留为 X-Device-Id header：服务端当前忽略但无拒收，留作未来按设备判冲突的线索

// 独立新键（初审返修）：绝不复用旧 `wuxia_mud_cloud_revs`——旧键里是本地递增计数器，
// 继承其值会把本地计数错当服务端权威 rev：hadLedger 误判 true，首次错位自动对齐永不发生。
// 旧键天然失效（不迁移不读取），留存无害。
const SERVER_REVS_KEY = "wuxia_mud_cloud_server_revs";
const HUB_KEY_LS = "wuxia_mud_cloud_hub_key";

let _fetchImpl = null;
export function configureCloudFetch(fetchImpl) { _fetchImpl = fetchImpl; }
const doFetch = (...args) => (_fetchImpl || globalThis.fetch).apply(null, args);

function _lsRead(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function _lsWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

// ── 绑定判定：三件套缺一即 unbound（不能半通）────────────────────────────
export function hubBinding(cfg) {
  const host = typeof cfg?.cloudUrl === "string" ? cfg.cloudUrl.replace(/\/+$/, "") : "";
  const spaceId = typeof cfg?.spaceId === "string" ? cfg.spaceId.trim() : "";
  const hubToken = typeof cfg?.hubToken === "string" ? cfg.hubToken.trim() : "";
  if (!host || !spaceId || !hubToken) return { bound: false };
  return { bound: true, host, spaceId, hubToken, deviceId: cfg.deviceId || "" };
}

function hubHeaders(binding, withBody = false) {
  return {
    ...(withBody ? { "Content-Type": "application/json" } : {}),
    "x-memory-hub-token": binding.hubToken,
    "X-Device-Id": binding.deviceId,
  };
}

// ── serverRev 台账（per-key 服务端权威 rev）────────────────────────────
// expectedRev 只能取自这里：首写 0，成功后记响应 rev，409 后按 serverRev 对齐。
// 本地递增计数器不是 CAS 依据——多设备/重建场景它与服务端必然错位。
// 台账键按 space 命名空间隔离（Review 修）：换 space 后旧空间的 rev 绝不当新空间
// CAS 依据——否则两端 rev 恰好相等时新空间备份被静默覆盖无冲突。
function ledgerKey(spaceId, slot) { return `${spaceId || ""}::${slot}`; }
// 读视图保留 slot 后缀形状（测试用）：`space::slot` 全键。
export function getServerRevs() { return _lsRead(SERVER_REVS_KEY, {}); }
export function recordServerRev(key, rev, spaceId = "") {
  if (!Number.isInteger(rev)) return;
  const revs = getServerRevs();
  revs[ledgerKey(spaceId, key)] = rev;
  _lsWrite(SERVER_REVS_KEY, revs);
}
export function clearServerRev(key, spaceId = "") {
  const revs = getServerRevs();
  delete revs[ledgerKey(spaceId, key)];
  _lsWrite(SERVER_REVS_KEY, revs);
}
export function clearAllServerRevs() { _lsWrite(SERVER_REVS_KEY, {}); }
export function expectedRevFor(key, spaceId = "") { return getServerRevs()[ledgerKey(spaceId, key)] ?? 0; }

// ── WebCrypto AES-GCM 加密封装 ─────────────────────────────────────────
// 最小可用方案：密钥首次生成后存 localStorage（JWK），不离开本机。
// 换设备恢复（密钥导出/导入）未做——PR 描述已声明；密钥或明文绝不上送服务端。
let _keyPromise = null;
export async function getOrCreateHubKey() {
  if (_keyPromise) return _keyPromise;
  _keyPromise = (async () => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error("WebCrypto 不可用——无法加密云端存档");
    const existing = _lsRead(HUB_KEY_LS, null);
    if (existing?.kty) {
      return subtle.importKey("jwk", existing, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    }
    const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const jwk = await subtle.exportKey("jwk", key);
    _lsWrite(HUB_KEY_LS, jwk);
    return subtle.importKey("jwk", jwk, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  })();
  return _keyPromise;
}

function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// value（存档快照对象）→ 不透明密文串 `v1.<ivB64>.<ctB64>`。
// 服务端只认 payloadEnc 是密文串；明文快照直发违反 canonical 契约。
export async function encryptSaveValue(value) {
  const key = await getOrCreateHubKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value ?? null));
  const ct = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `v1.${b64encode(iv)}.${b64encode(ct)}`;
}

// ── canonical 调用 ──────────────────────────────────────────────────────
// PUT /api/spaces/<space>/saves/<slot>：body {expectedRev, payloadEnc}（force 仅玩家裁决）
export async function hubPutSave(binding, slotId, payloadEnc, { expectedRev, force = false } = {}) {
  const res = await doFetch(`${binding.host}/api/spaces/${encodeURIComponent(binding.spaceId)}/saves/${encodeURIComponent(slotId)}`, {
    method: "PUT",
    headers: hubHeaders(binding, true),
    body: JSON.stringify({
      expectedRev,
      payloadEnc,
      ...(force ? { force: true } : {}),
    }),
  });
  return normalizeSaveResponse(res);
}

// DELETE：非 force 必带 expectedRev（服务端缺/非法直接 400）
export async function hubDeleteSave(binding, slotId, { expectedRev, force = false } = {}) {
  const url = `${binding.host}/api/spaces/${encodeURIComponent(binding.spaceId)}/saves/${encodeURIComponent(slotId)}${force ? "?force=1" : ""}`;
  const res = await doFetch(url, {
    method: "DELETE",
    headers: hubHeaders(binding, true),
    body: JSON.stringify({ expectedRev }),
  });
  return normalizeSaveResponse(res);
}

// 全量抹除：canonical 是 DELETE /api/space/<spaceId>（单数、无 /saves 后缀）——
// 客户端旧 seam 的 `DELETE <cloudUrl>/saves` 在适配层重写，canonical API 不变。
export async function hubWipeSpace(binding) {
  const res = await doFetch(`${binding.host}/api/space/${encodeURIComponent(binding.spaceId)}`, {
    method: "DELETE",
    headers: hubHeaders(binding),
  });
  return normalizeSaveResponse(res);
}

async function normalizeSaveResponse(res) {
  let body = null;
  try { body = typeof res.json === "function" ? await res.json() : null; } catch { /* 无 body */ }
  return {
    ok: !!res.ok,
    status: res.status,
    conflict: res.status === 409,
    rev: Number.isInteger(body?.rev) ? body.rev : null,
    serverRev: Number.isInteger(body?.serverRev) ? body.serverRev : (Number.isInteger(body?.currentRev) ? body.currentRev : null),
  };
}

// 测试复位
export function _resetCloudProtocolForTest() {
  _keyPromise = null;
  _fetchImpl = null;
}
