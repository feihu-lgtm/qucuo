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

function mvuAffectionDelta(state, delta, npc, { charm = 5, time = 0, giftRange, talkRange, affectionSkip }) {
  // 无好感轨道（intimacy.forbidden/兽类等）整轮跳过——好感不予变化，留裁决痕迹。
  if (affectionSkip?.has?.(npc)) return { reason: `${npc} 无好感轨道，好感度不变化` };
  if (delta > 0) delta *= 1 + (clamp(charm, 0, 10) - 5) * 0.06;
  const { maxDelta, perTurn, daily } = AFFECTION_RULES.mvu;
  // 送礼/软结算自带区间（giftRange）、搭话回合自带区间（talkRange，-5~+8）各自收窄，才放到 maxDelta；
  // 其余叙事回合 AI 单次只能动 ±perTurn，亲密/日常回合 AI 常顺手报大数，不卡住好感会一回合涨穿。
  const cap = giftRange || talkRange ? maxDelta : perTurn;
  delta = clamp(Math.round(delta), -cap, cap);
  if (giftRange) delta = clamp(delta, ...giftRange);
  // 聊天语义好感（docs 工单）：搭话回合单次 clamp 小区间 -5~+8，且 0 变化不落账。
  if (talkRange) {
    delta = clamp(delta, ...talkRange);
    if (delta === 0) return { reason: "好感无实质变化" };
  }
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
  const { source, defaultValue, talkRange, affectionSkip } = options;
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
  // forbidden/兽类：add 与 set 都拦（set 也能绕过 talkRange，见 mvu 指令语法允许 _.set 好感度）
  if (mvu && affection && affectionSkip?.has?.(parts[2] || "")) {
    return reject(`${parts[2] || ""} 无好感轨道，好感度不变化`);
  }
  // AI 不知道当前好感，_.set 好感度会绕过单次限幅直接跳值（实测 45→47 的 set 是想表达 +2）。
  // 对已有好感度的角色，把 set 换算成"目标值−当前值"的增量，再走和 _.add 一样的限幅/日涨上限；
  // 新角色首次声明（还没有数值）和系统声明的 allowAffectionSet（邀同行钉初始好感）照旧直接写。
  let converted = false;
  if (mvu && affection && op === "set" && !talkRange && !options.allowAffectionSet && typeof before === "number") {
    op = "add";
    value -= before;
    converted = true;
  }
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
  } else if (op === "set" && mvu && affection && talkRange) {
    // set 绕开 add 的 talkRange——按相对当前值的增量 clamp（工单：单次增减 -5~+8）
    const base = typeof before === "number" ? before : 0;
    // 不取整：留守衰减会留下 .5 分值，round(-0.5)=-0 会把半分扣减误丢
    const d = clamp(value - base, talkRange[0], talkRange[1]);
    if (d === 0) return reject("好感无实质变化");
    actualDelta = d;
    value = base + d;
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
  if (mvu && affection && typeof finalValue === "number") {
    // 玩家字幕按"实际落地的变化"写：before 取写入前的值（新角色走默认），
    // 差值用落地值减 before，而不是 AI 提议的 actualDelta——满值封顶/回合内多条叠加时，
    // 提议 +8 实际只涨 2，字幕却写 +8 会误导玩家。没变化就不打（"+0"没信息量）。
    const base = typeof before === "number" ? before : defaultValue ?? field.default ?? 0;
    const shown = finalValue - base;
    if (shown !== 0) {
      logs.push({ t: "affection", text: `  💗 ${parts[2]} 好感度 ${shown > 0 ? "+" : "-"}${Math.abs(shown)}（${base} → ${finalValue}）` });
    }
  }
  return {
    state: writePath(state, parts, finalValue), finalValue, actualDelta, log, logs,
    ...(converted ? { note: "_.set 好感度已换算为增量并限幅" } : {}),
  };
}

export function updateField(slice, write, options) {
  return (value) => {
    const state = { [slice]: value };
    const commands = typeof write === "function" ? write(value) : write;
    return (Array.isArray(commands) ? commands : [commands])
      .reduce((current, command) => applyWrite(current, command, options).state, state)[slice];
  };
}
