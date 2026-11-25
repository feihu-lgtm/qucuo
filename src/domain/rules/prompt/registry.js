const TABLES = {
  block: new Map(),
  call: new Map(),
};

const OVERRIDE_STORAGE_KEY = "qucuo_prompt_overrides_v1";
const overrideListeners = new Set();
let storageSubscribed = false;
let lastPersistError = null;

// 最近一次已知的落盘状态；存储不可用（无 localStorage 或读取抛错）时作为内存兜底。
let lastKnownPersisted = {};
// 尚未落盘的修改：写入失败后保留，随后每次读取/写入都重新叠加在最新落盘状态之上。
// reset=true 表示「恢复全部默认」尚未落盘，此时基底是空表而不是落盘表。
let pending = emptyPending();

function emptyPending() {
  return { reset: false, patches: {} };
}

function hasPending() {
  return pending.reset || Object.keys(pending.patches).length > 0;
}

function readPersistedOverrides() {
  try {
    if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") return null;
    const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.overrides || typeof parsed.overrides !== "object" || Array.isArray(parsed.overrides)) {
      return null;
    }
    return parsed.overrides;
  } catch {
    return null;
  }
}

function latestPersisted() {
  const persisted = readPersistedOverrides();
  if (persisted) lastKnownPersisted = persisted;
  return lastKnownPersisted;
}

function cloneOverridesMap(map) {
  const out = {};
  for (const [id, patch] of Object.entries(map || {})) {
    if (patch && typeof patch === "object") out[id] = { ...patch };
  }
  return out;
}

function applyPatch(map, blockId, patch) {
  const next = { ...(map[blockId] || {}) };
  if ("mode" in patch) {
    if (patch.mode === "blue" || patch.mode === "green" || patch.mode === "off") next.mode = patch.mode;
    else delete next.mode;
  }
  if ("text" in patch) {
    if (typeof patch.text === "string") next.text = patch.text;
    else delete next.text;
  }
  if (!Object.keys(next).length) delete map[blockId];
  else map[blockId] = next;
}

// 生效表 = 最新落盘表（或 reset 后的空表）+ 未落盘修改。
function effectiveOverrides() {
  const map = pending.reset ? {} : cloneOverridesMap(latestPersisted());
  for (const [blockId, patch] of Object.entries(pending.patches)) applyPatch(map, blockId, patch);
  return map;
}

function notifyOverrideListeners() {
  for (const listener of [...overrideListeners]) {
    try { listener(); } catch {}
  }
}

function handleStorageSync(event) {
  if (event && event.key !== null && event.key !== OVERRIDE_STORAGE_KEY) return;
  // 其他标签页的写入只更新落盘基底；本页未落盘修改与失败提示保持不动。
  latestPersisted();
  notifyOverrideListeners();
}

function ensureStorageSubscription() {
  if (storageSubscribed || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  window.addEventListener("storage", handleStorageSync);
  storageSubscribed = true;
}

function releaseStorageSubscriptionIfUnused() {
  if (!storageSubscribed || overrideListeners.size > 0) return;
  if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
    window.removeEventListener("storage", handleStorageSync);
  }
  storageSubscribed = false;
}

// 把「最新落盘表 + 未落盘修改」写回存储；成功才清空未落盘修改。
function persistEffective() {
  const next = effectiveOverrides();
  try {
    if (typeof localStorage !== "undefined") {
      if (!Object.keys(next).length) {
        if (typeof localStorage.removeItem === "function") localStorage.removeItem(OVERRIDE_STORAGE_KEY);
      } else if (typeof localStorage.setItem === "function") {
        localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify({ version: 1, overrides: next }));
      }
    }
    lastKnownPersisted = next;
    pending = emptyPending();
    lastPersistError = null;
    return true;
  } catch (err) {
    lastPersistError = err?.message || "浏览器存储空间已满，修改仅在当前会话生效";
    return false;
  }
}

// 注册或按同 id 覆盖提示词定义（仅支持 block / call）
export function definePrompt(kind, id, def) {
  const table = TABLES[kind];
  if (!table) throw new Error(`Unknown prompt registry kind: ${kind}`);
  const entry = Object.freeze({ id, ...def });
  table.set(id, entry);
  return entry;
}

export function getPromptDef(kind, id) {
  return TABLES[kind]?.get(id) || null;
}

export function listPromptDefs(kind) {
  return [...(TABLES[kind]?.values() || [])];
}

export function getPromptOverridePersistError() {
  return hasPending() ? lastPersistError : null;
}

export function getPromptOverrides() {
  return effectiveOverrides();
}

export function subscribePromptOverrides(listener) {
  if (typeof listener !== "function") return () => {};
  ensureStorageSubscription();
  overrideListeners.add(listener);
  return () => {
    overrideListeners.delete(listener);
    releaseStorageSubscriptionIfUnused();
  };
}

export function setPromptOverride(blockId, patch) {
  if (!blockId) return getPromptOverrides();
  if (patch && typeof patch === "object") {
    const entry = { ...(pending.patches[blockId] || {}) };
    if ("mode" in patch) entry.mode = patch.mode === "blue" || patch.mode === "green" || patch.mode === "off" ? patch.mode : null;
    if ("text" in patch) entry.text = typeof patch.text === "string" ? patch.text : null;
    if (Object.keys(entry).length) pending.patches[blockId] = entry;
  }
  persistEffective();
  notifyOverrideListeners();
  return effectiveOverrides();
}

export function resetPromptOverrides() {
  pending = { reset: true, patches: {} };
  persistEffective();
  notifyOverrideListeners();
  return effectiveOverrides();
}

export function resetPromptRegistryForTest() {
  TABLES.block.clear();
  TABLES.call.clear();
  lastKnownPersisted = {};
  pending = emptyPending();
  lastPersistError = null;
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.removeItem === "function") {
      localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    }
  } catch {}
}
