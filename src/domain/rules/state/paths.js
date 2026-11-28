// statePath/readPath 叶子工具（从 fields.js 拆出）——applyPatches/applyWrite 等底层
// 状态读写只需要这两个纯函数，不该整棵拉进 FIELDS 注册表（ fields → clapboard →
// npcLedger → applyPatches → fields 循环依赖由此拆开）。纯函数，零依赖。

export function readPath(value, parts) {
  for (const part of parts) {
    if (value == null || !Object.hasOwn(value, part)) return undefined;
    value = value[part];
  }
  return value;
}

const VAR_ROOTS = new Set(["角色", "世界", "主角"]);
export function statePath(path) {
  const parts = Array.isArray(path) ? path : path.split(".");
  return VAR_ROOTS.has(parts[0]) ? ["varTree", ...parts] : parts;
}
