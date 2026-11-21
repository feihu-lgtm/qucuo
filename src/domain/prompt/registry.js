const TABLES = {
  block: new Map(),
  call: new Map(),
};

// 注册或按同 id 覆盖提示词定义（仅支持 block / call）
export function define(kind, id, def) {
  const table = TABLES[kind];
  if (!table) throw new Error(`Unknown prompt registry kind: ${kind}`);
  const entry = Object.freeze({ id, ...def });
  table.set(id, entry);
  return entry;
}

export function getDef(kind, id) {
  return TABLES[kind]?.get(id) || null;
}

export function listDefs(kind) {
  return [...(TABLES[kind]?.values() || [])];
}

export function resetRegistryForTest() {
  TABLES.block.clear();
  TABLES.call.clear();
}
