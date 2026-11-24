const TABLES = {
  block: new Map(),
  call: new Map(),
};

const OVERRIDE_STORAGE_KEY = "qucuo_prompt_overrides_v1";
const overrideListeners = new Set();
let storageSubscribed = false;

function readPersistedOverrides() {
  try {
    if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") return null;
    const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.overrides || typeof parsed.overrides !== "object" || Array.isArray(parsed.overrides)) {
      return null;
    }
    return parsed.overrides;
  } catch {
    return null;
  }
}

let runtimeOverrides = readPersistedOverrides() || {};

function notifyOverrideListeners() {
  for (const listener of [...overrideListeners]) {
    try { listener(); } catch {}
  }
}

function handleStorageSync(event) {
  if (event && event.key !== null && event.key !== OVERRIDE_STORAGE_KEY) return;
  runtimeOverrides = readPersistedOverrides() || {};
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

function persistOverrides() {
  try {
    if (typeof localStorage === "undefined") return;
    if (!Object.keys(runtimeOverrides).length) {
      if (typeof localStorage.removeItem === "function") localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    } else if (typeof localStorage.setItem === "function") {
      localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify({ version: 1, overrides: runtimeOverrides }));
    }
  } catch {}
}

function cloneOverridesMap(map) {
  const out = {};
  for (const [id, patch] of Object.entries(map || {})) {
    if (patch && typeof patch === "object") out[id] = { ...patch };
  }
  return out;
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

export function getPromptOverrides() {
  const persisted = readPersistedOverrides();
  if (persisted) runtimeOverrides = persisted;
  return cloneOverridesMap(runtimeOverrides);
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
  const persisted = readPersistedOverrides();
  const base = persisted ? { ...persisted } : { ...runtimeOverrides };
  const next = { ...(base[blockId] || {}) };
  if (patch && typeof patch === "object") {
    if ("mode" in patch) {
      if (patch.mode === "blue" || patch.mode === "green" || patch.mode === "off") next.mode = patch.mode;
      else delete next.mode;
    }
    if ("text" in patch) {
      if (typeof patch.text === "string") next.text = patch.text;
      else delete next.text;
    }
  }
  if (!Object.keys(next).length) delete base[blockId];
  else base[blockId] = next;
  runtimeOverrides = base;
  persistOverrides();
  notifyOverrideListeners();
  return cloneOverridesMap(runtimeOverrides);
}

export function resetPromptOverrides() {
  runtimeOverrides = {};
  persistOverrides();
  notifyOverrideListeners();
  return {};
}

export function resetPromptRegistryForTest() {
  TABLES.block.clear();
  TABLES.call.clear();
  runtimeOverrides = {};
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.removeItem === "function") {
      localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    }
  } catch {}
}
