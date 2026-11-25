// WO-24A 后台备料 deterministic 底账（纯函数）
// ============================================================================
// 备料是缓存不是事实：prepSeeds 只是「当前世界状态下可预生成的素材」，
// 严禁写进 varTree 事实账；世界状态一变即作废，绝不反手改世界。
// 本模块四个纯函数：stateVersion 稳定短 hash / 有效性判定 / 幂等入库 / 只读查询。
// 禁 Date.now / Math.random——同状态同 hash，测试可复现。

import { createClapboardEntry } from "../clapboard/clapboard.js";

// 备料类型枚举（契约冻结，扩类需过评审）：npc_plan NPC 幕后计划 / tavern_rumor 茶馆传闻坯 / prep_item 道具铺垫。
export const PREP_SEED_KINDS = ["npc_plan", "tavern_rumor", "prep_item"];

// FNV-1a 32bit（与 utils/seededRandom 同族但独立实现——domain 层不依赖 utils 内部未导出函数）
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h >>> 0;
}

const asArr = (v) => (Array.isArray(v) ? v : []);
const dayOf = (time) => Math.floor((Number.isFinite(time) ? time : 0) / 24);

// 在场 NPC 身份串：id/名排序后连接——成员换人就变版本，非可数键值噪声不动。
function npcKeyMaterial(room) {
  return asArr(room?.npcs)
    .map((n) => String(n?.id || n?.name || ""))
    .filter(Boolean)
    .sort()
    .join(",");
}

// 宿敌谱 active 计数：五势力 active entries 总数（构成变化掀版本，grudge 微调不掀——
// 备料不因账面数字抖动全废）。
function nemesisActiveCount(varTree) {
  const 谱 = varTree?.世界?.宿敌谱;
  if (!谱 || typeof 谱 !== "object") return 0;
  let n = 0;
  for (const fac of Object.keys(谱)) {
    for (const e of Object.values(谱[fac]?.entries || {})) {
      if (e?.status === "active") n += 1;
    }
  }
  return n;
}

// stateVersion：当前地点+日+在场 NPC/容器/宿敌关键事实计数 → 稳定短 hash（hex8）。
// 输入 state 切片形状 {room, innerRoomName, time, varTree}——缺字段坏形状不炸，
// 退化字段照算，保证旧档/测试夹具可用。
export function prepStateVersion(state) {
  state = state && typeof state === "object" ? state : {};
  const room = state.room || {};
  const place = String(room.name || "");
  const inner = String(state.innerRoomName || "");
  const day = dayOf(state.time);
  const npcs = npcKeyMaterial(room);
  // 容器：当前地点容器视图键计数（容器开合/出现掀版本）
  const 容器数 = varTree容器计数(state.varTree);
  const nemesis = nemesisActiveCount(state.varTree);
  const material = [place, inner, day, npcs, 容器数, nemesis].join("|");
  return fnv1a(material).toString(16).padStart(8, "0");
}

// 真实契约（WO-22A materializeFacts）：varTree.世界.容器[containerPlace][containerName]
//   = { collapsed:true, turn }——两层嵌套，顶层键是地点不是容器。
// Review/WO-24A-fix 修：两层计数——全域容器条目总数*1000+collapsed 数。
// 同一 containerPlace 内任一容器 collapsed false→true 必掀版本；新容器出现也掀。
function varTree容器计数(varTree) {
  const c = varTree?.世界?.容器;
  if (!c || typeof c !== "object") return 0;
  let total = 0, collapsed = 0;
  for (const placeKey of Object.keys(c)) {
    const byName = c[placeKey];
    if (!byName || typeof byName !== "object") continue;
    for (const name of Object.keys(byName)) {
      total += 1;
      if (byName[name]?.collapsed === true) collapsed += 1;
    }
  }
  return total * 1000 + collapsed;
}

// 有效性：形状合规 + kind 在枚举 + 版本一致 + 地点一致（内层房并进 location 串）。
export function isPrepSeedValid(seed, state) {
  state = state && typeof state === "object" ? state : {};
  if (!seed || typeof seed !== "object") return false;
  if (!PREP_SEED_KINDS.includes(seed.kind)) return false;
  const place = String(state.room?.name || "");
  if (!place || seed.location !== place) return false;
  if (!seed.stateVersion || seed.stateVersion !== prepStateVersion(state)) return false;
  return true;
}

// 造一条备料种子：复用场记板 id 口径 prep_<stateVersion>_<seq>（契约 A），
// kind 按 WO-24A 形状为备料类型枚举；场记板其余字段（witnesses/entities/publicText）
// 原样保留供后续 prompt 注入复用——不造第二套条目。
export function createPrepSeed(spec = {}) {
  const kind = PREP_SEED_KINDS.includes(spec.kind) ? spec.kind : null;
  if (!kind) return null;
  const turn = Number.isInteger(spec.turn) ? spec.turn : 0;
  const base = createClapboardEntry({
    kind: "prep_seed", turn, seq: spec.seq ?? 0, location: spec.location || "",
    stateVersion: spec.stateVersion || "",
    witnesses: spec.witnesses, entities: spec.entities,
    publicText: spec.publicText, rawText: spec.rawText, importance: spec.importance,
  });
  return {
    ...base,
    kind, // WO-24A 形状：kind 为备料类型（npc_plan/tavern_rumor/prep_item）
    day: Number.isInteger(spec.day) ? spec.day : dayOf(turn),
    stateVersion: String(spec.stateVersion || ""),
    payload: spec.payload && typeof spec.payload === "object" ? { ...spec.payload } : {},
    subject: String(spec.subject || ""),
    createdAtTurn: turn,
  };
}

// 幂等入库：同 stateVersion+kind+subject 替换旧条；版本与当前 state 不符的新种子拒收；
// 库内版本不符当前 state 的旧种子即作废剔除。返回新数组，输入不原地改。
export function upsertPrepSeeds(seeds, seed, state = {}) {
  const list = asArr(seeds).filter((s) => s && typeof s === "object");
  // 先剔除已作废（版本/地点不符）——缓存不淤积
  const alive = list.filter((s) => {
    if (!PREP_SEED_KINDS.includes(s.kind)) return false;
    // 地点不符/版本不符即作废；无法评估的坏形状也弃
    return isPrepSeedValid(s, state) || sameSeedIdentity(s, seed);
  });
  if (!seed || !PREP_SEED_KINDS.includes(seed.kind)) return alive;
  // 新种子本身必须与当前状态匹配——给别处的状态备料不入库
  if (!isPrepSeedValid(seed, state)) return alive;
  const idx = alive.findIndex((s) => sameSeedIdentity(s, seed));
  if (idx >= 0) {
    const next = [...alive];
    next[idx] = seed;
    return next;
  }
  return [...alive, seed];
}

function sameSeedIdentity(a, b) {
  return Boolean(a && b)
    && a.stateVersion === b.stateVersion
    && a.kind === b.kind
    && String(a.subject || "") === String(b.subject || "");
}

// 只读查询：当前状态下有效的备料；kind 可选过滤。绝不写状态。
export function validPrepSeeds(seeds, state = {}, kind = null) {
  return asArr(seeds).filter((s) => isPrepSeedValid(s, state) && (!kind || s.kind === kind));
}
