// 软结算的纯函数部分：deltas 应用/快照/回滚与结算提示格式化。
// AI 调用（runSoftSettle）已上移到 engine/ports/softSettle.js。

function writeSettledPath(tree, [key, ...rest], value) {
  const current = tree && typeof tree === "object" ? tree : {};
  return {
    ...current,
    [key]: rest.length ? writeSettledPath(current[key], rest, value) : value,
  };
}

export function applySettledDeltas(varTree, deltas = []) {
  return (deltas || []).reduce((tree, delta) => {
    if (typeof delta?.path !== "string" || !delta.path || !Object.hasOwn(delta, "finalValue")) return tree;
    return writeSettledPath(tree, delta.path.split("."), delta.finalValue);
  }, varTree || {});
}

function readSettledPath(tree, path) {
  let value = tree;
  for (const part of path.split(".")) {
    if (value == null || !Object.hasOwn(value, part)) return { exists: false, value: undefined };
    value = value[part];
  }
  return { exists: true, value };
}

export function captureSettledChanges(beforeTree, afterTree, paths = []) {
  return [...new Set(paths.filter((path) => typeof path === "string" && path))].map((path) => ({
    path,
    before: readSettledPath(beforeTree, path),
    after: readSettledPath(afterTree, path),
  }));
}

function deleteSettledPath(tree, [key, ...rest]) {
  const current = tree && typeof tree === "object" ? tree : {};
  if (!Object.hasOwn(current, key)) return current;
  if (!rest.length) {
    const next = { ...current };
    delete next[key];
    return next;
  }
  const child = deleteSettledPath(current[key], rest);
  return child === current[key] ? current : { ...current, [key]: child };
}

export function revertSettled(varTree, records = []) {
  return (records || []).reduce((tree, record) => {
    if (typeof record?.path !== "string" || !record.path) return tree;
    const current = readSettledPath(tree, record.path);
    if (current.exists !== record.after.exists || !Object.is(current.value, record.after.value)) return tree;
    return record.before.exists
      ? writeSettledPath(tree, record.path.split("."), record.before.value)
      : deleteSettledPath(tree, record.path.split("."));
  }, varTree || {});
}

// 给叙事层的一句话结算说明：主模型只照这个结果写散文，不许再编数值。
export function formatSettleNote(result) {
  if (!result || !result.note) return "";
  return `\n【系统结算】${result.note}。以上数值是系统裁决，请照此叙事，不得更改或补写其他状态变化。`;
}
