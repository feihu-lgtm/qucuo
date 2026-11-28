// ============================================================================
// applyPatches —— 状态袋的唯一批量写入口（终局蓝图第 3 点：写入器收口）
// ----------------------------------------------------------------------------
// 所有"把改动写进状态"的路都在这里收口：调用方/生成器只产出 Patch[]，
// 本模块按序消费——每条经 applyWrite（set/add：字段声明、边界、限幅、
// mvu 门禁）或 merge（系统内部可信深写，不进字段声明表的路径也能写），
// 拒绝的进 rejected 带 reason，通过的进 applied 带 finalValue。
//
// Patch 形态：{ op, path, value, options? }
//   set/add  走 applyWrite 全套校验；path 兼容字符串或数组（数组保字面名含点）
//   merge    系统内部可信写：路径安全检查 + 自动建中间层；value 可为
//            (prevValue) => nextValue，提交时按当前状态求值（等价旧的
//            writeSettledPath/更新器形态），不写字段声明表外的新键也照走。
//   options  可选，覆盖批量 options（如单条的 defaultValue）。
// ============================================================================

import { readPath, statePath } from "./paths.js";
import { applyWrite, DANGEROUS_KEYS, writePath } from "./applyWrite.js";

export const merge = (path, value) => ({ op: "merge", path, value });

function applyMergePatch(state, { path, value }) {
  const parts = typeof path === "string" || Array.isArray(path) ? statePath(path) : [];
  if (!parts.length || parts.some((key) => typeof key !== "string" || !key || DANGEROUS_KEYS.has(key))) {
    return { state, reason: `无效路径：${parts.join(".")}`, logs: [] };
  }
  const finalValue = typeof value === "function" ? value(readPath(state, parts)) : value;
  return { state: writePath(state, parts, finalValue), finalValue, logs: [] };
}

/**
 * 把 Patch[] 顺序写进状态袋 { varTree, char, inv, flags, ... }。
 * 不改入参；拒绝的 patch 不写、进 rejected。
 * @returns {{ state: object, applied: object[], rejected: object[], logs: object[] }}
 */
export function applyPatches(state, patches, options = {}) {
  let current = state;
  const applied = [], rejected = [], logs = [];
  for (const patch of patches || []) {
    const result = patch?.op === "merge"
      ? applyMergePatch(current, patch)
      : applyWrite(current, patch, { ...options, ...(patch?.options || {}) });
    if (result.reason) {
      rejected.push({ ...patch, reason: result.reason });
      continue;
    }
    current = result.state;
    applied.push({
      ...patch,
      ...(result.finalValue === undefined ? {} : { finalValue: result.finalValue }),
      ...(result.actualDelta == null ? {} : { actualDelta: result.actualDelta }),
      ...(result.note ? { note: result.note } : {}),
    });
    if (result.logs?.length) logs.push(...result.logs);
  }
  return { state: current, applied, rejected, logs };
}

/**
 * 按 patch 路径首根（statePath 映射后）切片，逐片经调用方的 set<Slice> 函数式提交。
 * 等价旧的「多个 writer 各自调 setInv/setChar/setVarTree/setFlags」，但写入口只剩 applyPatches。
 * @param {Object<string, function>} setters 形如 { setVarTree, setChar, setInv, setFlags, ... }
 */
export function commitPatches(setters, patches, options = {}) {
  const groups = new Map();
  for (const patch of patches || []) {
    const root = (typeof patch?.path === "string" || Array.isArray(patch?.path) ? statePath(patch.path) : [])[0];
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(patch);
  }
  for (const [root, list] of groups) {
    const setter = setters?.[`set${root.charAt(0).toUpperCase()}${root.slice(1)}`];
    if (typeof setter !== "function") continue;
    setter((prev) => applyPatches({ [root]: prev }, list, options).state[root]);
  }
}
