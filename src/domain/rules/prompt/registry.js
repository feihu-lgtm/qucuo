const TABLES = {
  block: new Map(),
  call: new Map(),
};

const OVERRIDE_STORAGE_KEY = "qucuo_prompt_overrides_v1";

function loadStoredOverrides() {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.overrides || typeof parsed.overrides !== "object" || Array.isArray(parsed.overrides)) {
      return {};
    }
    return parsed.overrides;
  } catch {
    return {};
  }
}

let runtimeOverrides = loadStoredOverrides();

function persistOverrides() {
  try {
    if (typeof localStorage === "undefined") return;
    if (!Object.keys(runtimeOverrides).length) localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    else localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify({ version: 1, overrides: runtimeOverrides }));
  } catch {}
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
  const out = {};
  for (const [id, patch] of Object.entries(runtimeOverrides)) {
    if (patch && typeof patch === "object") out[id] = { ...patch };
  }
  return out;
}

export function setPromptOverride(blockId, patch) {
  if (!blockId) return getPromptOverrides();
  const next = { ...(runtimeOverrides[blockId] || {}) };
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
  if (!Object.keys(next).length) delete runtimeOverrides[blockId];
  else runtimeOverrides[blockId] = next;
  persistOverrides();
  return getPromptOverrides();
}

export function resetPromptOverrides() {
  runtimeOverrides = {};
  persistOverrides();
  return {};
}

export function resetPromptRegistryForTest() {
  TABLES.block.clear();
  TABLES.call.clear();
  runtimeOverrides = {};
}
