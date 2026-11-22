import { AFFECTION_RULES, FIELD, FIELDS, readPath, statePath } from "./fields.js";

export const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const protectedPrefixes = Object.entries(FIELDS).filter(([, field]) => field.ai === false)
  .map(([path]) => path.split(".").slice(0, -1));
const patterns = Object.entries(FIELDS).filter(([path]) => path.includes("*"))
  .map(([path, field]) => [path.split("."), field]);
const factionRepParent = statePath(FIELD.factionRep).slice(0, -1);
const clamp = (value, min = -Infinity, max = Infinity) => Math.max(min, Math.min(max, value));

export const set = (path, value) => ({ op: "set", path, value });
export const add = (path, value) => ({ op: "add", path, value });

function pathMatches(pattern, parts) {
  return pattern.every((key, index) => key === "**" || (key === "*" ? index < parts.length : key === parts[index]))
    && (pattern.at(-1) === "**" || parts.length === pattern.length);
}
const isPrefix = (prefix, parts) => prefix.every((key, index) => parts[index] === key);

export function isProtectedMvuPath(path) {
  const parts = statePath(String(path || ""));
  return protectedPrefixes.some((prefix) => isPrefix(prefix, parts) || isPrefix(parts, prefix));
}

export function writePath(node, [key, ...rest], value) {
  const child = rest.length ? writePath(node?.[key], rest, value) : value;
  if (!Array.isArray(node)) return { ...(node && typeof node === "object" ? node : {}), [key]: child };
  const copy = node.slice();
  if (key === "length") copy.length = child;
  else Object.defineProperty(copy, key, { value: child, configurable: true, writable: true, enumerable: true });
  return copy;
}

function mvuAffectionDelta(state, delta, npc, { charm = 5, time = 0, giftRange }) {
  if (delta > 0) delta *= 1 + (clamp(charm, 0, 10) - 5) * 0.06;
  const { maxDelta, daily } = AFFECTION_RULES.mvu;
  delta = clamp(Math.round(delta), -maxDelta, maxDelta);
  if (giftRange) delta = clamp(delta, ...giftRange);
  if (delta <= 0) return { state, delta };
  const dayStamp = Math.floor((Number(time) || 0) / 24);
  const last = state.varTree.世界?.好感日增;
  const gained = last?.dayStamp === dayStamp ? { ...last.gained } : {};
  const already = Object.hasOwn(gained, npc) ? Number(gained[npc]) || 0 : 0;
  const remaining = Math.max(0, daily - already);
  if (!remaining) return { reason: `${npc}今日好感已涨满 ${daily} 点，明日再来` };
  delta = Math.min(delta, remaining);
  const 世界 = state.varTree.世界 || { 威望: FIELDS[FIELD.reputation].default };
  const 好感日增 = { dayStamp, gained: { ...gained, [npc]: already + delta } };
  return { state: { ...state, varTree: { ...state.varTree, 世界: { ...世界, 好感日增 } } }, delta };
}

export function applyWrite(state, { op, path, value }, options = {}) {
  const { source, defaultValue } = options;
  const mvu = source === "mvu";
  const parts = typeof path === "string" || Array.isArray(path) ? statePath(path) : [];
  const id = parts.join(".");
  const reject = (reason) => ({ state, reason, logs: [] });
  if (!parts.length || parts.some((key) => typeof key !== "string" || !key || DANGEROUS_KEYS.has(key))) return reject(`无效路径：${id}`);
  if (mvu && (typeof path !== "string" || !/^(角色|世界|主角)\./.test(path))) {
    return reject(`路径根 "${String(path).split(".")[0]}" 不在白名单`);
  }
  if (mvu && isProtectedMvuPath(path)) return reject(`"${path}" 属系统裁决域（个人线进度/门禁），AI 无权改写`);

  const field = (parts.length === id.split(".").length && Object.hasOwn(FIELDS, id) ? FIELDS[id] : null)
    ?? patterns.find(([pattern]) => pathMatches(pattern, parts))?.[1];
  if (mvu && field !== FIELDS[FIELD.factionRep]
    && (isPrefix(parts, factionRepParent) || isPrefix(factionRepParent, parts))) {
    return reject(`"${path}" 会整块覆盖势力声誉，只能逐个写 世界.势力声誉.<势力>`);
  }
  if (!field || field.readOnly || (mvu && field.ai !== true)) {
    return reject(`字段未声明或不可写：${id}`);
  }
  if (op !== "set" && op !== "add") return reject(`不支持的写入动词：${op}`);
  if (op === "add" && !Number.isFinite(value)) return reject("add 操作的值必须是数字");

  const affection = field === FIELDS[FIELD.affection] || (mvu && parts.length >= 3 && parts.at(-1) === "好感度");
  const bounds = affection ? FIELDS[FIELD.affection] : field;
  if (op === "set" && typeof bounds.default === "number" && !Number.isFinite(value)) {
    return reject(`${field.label}必须是有限数字`);
  }
  if (op === "set" && Array.isArray(field.default) && !Array.isArray(value)) {
    return reject(`${field.label}必须是数组`);
  }
  if (id === FIELD.hp && (op !== "set" || value.length !== 2 || !value.every(Number.isFinite))) {
    return reject("气血必须是两个有限数字");
  }
  const before = readPath(state, parts);
  let actualDelta;
  if (op === "add") {
    actualDelta = value;
    if (mvu && affection) {
      const result = mvuAffectionDelta(state, value, parts[2] || "", options);
      if (result.reason) return reject(result.reason);
      ({ state, delta: actualDelta } = result);
    } else if (field.maxDelta != null) {
      actualDelta = clamp(mvu ? Math.round(value) : value, -field.maxDelta, field.maxDelta);
    }
    const base = typeof before === "number" ? before : defaultValue ?? field.default ?? 0;
    if (typeof base !== "number") return reject(`${field.label} 不能做数值加减`);
    value = base + actualDelta;
    if (!Number.isFinite(value)) return reject(`${field.label}必须是有限数字`);
  }
  if (mvu && field === FIELDS[FIELD.factionRep]) {
    // 一回合内多条指令合计也不超过 ±maxDelta，以回合开始时的值为基准。
    const start = readPath(options.turnBase ?? state, parts);
    const base = typeof start === "number" ? start : field.default;
    value = clamp(value, base - field.maxDelta, base + field.maxDelta);
    if (op === "add") actualDelta = value - (typeof before === "number" ? before : field.default);
  }
  let finalValue = typeof value === "number" ? clamp(value, bounds.min, bounds.max) : value;
  if (id === FIELD.hp && Array.isArray(finalValue)) {
    finalValue = finalValue.map((amount) => typeof amount === "number" ? clamp(amount, bounds.min, bounds.max) : amount);
  }
  const withSign = actualDelta > 0 ? `+${actualDelta}` : actualDelta;
  const log = `${id}${actualDelta == null ? "" : withSign}→${finalValue}`;
  const logs = [];
  if (mvu && affection && (op === "set" || actualDelta)) {
    logs.push({ t: "affection", text: actualDelta == null
      ? `  💗 ${parts[2]} 好感度 → ${finalValue}`
      : `  💗 ${parts[2]} 好感度 ${withSign}（→ ${finalValue}）` });
  }
  return { state: writePath(state, parts, finalValue), finalValue, actualDelta, log, logs };
}

export function updateField(slice, write, options) {
  return (value) => {
    const state = { [slice]: value };
    const commands = typeof write === "function" ? write(value) : write;
    return (Array.isArray(commands) ? commands : [commands])
      .reduce((current, command) => applyWrite(current, command, options).state, state)[slice];
  };
}
