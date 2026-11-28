// WO-25C：活世界 5 张开放数据表的注册底座（纯函数、零副作用、不接运行时）。
// 表：worldStates 世界状态断言 / districtOverrides 据点覆写(Kenshi) /
//     situations 短期局势卡 / roamingSquads 游走编队(A-Life) / aiPackages 人物行为包。
// 扩展包（pack）是声明式纯数据：{ id, worldStates?, districtOverrides?, situations?, roamingSquads?, aiPackages? }。
// 未来加新势力/商队/据点结局只加数据包，不改引擎。

import { QUCUO_MAP } from "../../data/map/qucuoMap.js";
import { FACTION_NAMES } from "../../data/map/factions.js";

export const LIVING_TABLES = ["worldStates", "districtOverrides", "situations", "roamingSquads", "aiPackages"];

export function createLivingWorldRegistry() {
  const registry = { packs: [] };
  for (const table of LIVING_TABLES) registry[table] = [];
  return registry;
}

// 注册一个扩展包：幂等（同 pack.id 重复注册是 no-op）；
// 表内条目 id 重名且内容不同即报错（同名同内容容忍——同一对象被两个包引用不算冲突）。
export function registerWorldPack(registry, pack) {
  if (!registry || !pack || typeof pack.id !== "string" || !pack.id) {
    throw new Error("registerWorldPack: pack 缺 id 或 registry 非法");
  }
  if (registry.packs.includes(pack.id)) return registry; // 幂等
  // 第一阶段全量校验：任一冲突即整包拒收，绝不留下半截注册。
  const toInsert = [];
  for (const table of LIVING_TABLES) {
    for (const entry of pack[table] || []) {
      if (!entry || typeof entry.id !== "string" || !entry.id) {
        throw new Error(`registerWorldPack: ${pack.id}.${table} 有条目缺 id`);
      }
      const dup = registry[table].find((existing) => existing.id === entry.id);
      if (dup) {
        if (canonicalJson(dup) === canonicalJson(entry)) continue; // 同名同内容容忍
        throw new Error(`registerWorldPack: ${table} 重名 id「${entry.id}」（${pack.id} 与已注册包冲突）`);
      }
      toInsert.push([table, entry]);
    }
  }
  // 第二阶段写入（此时已无失败路径）
  for (const [table, entry] of toInsert) registry[table].push({ ...entry });
  registry.packs.push(pack.id);
  return registry;
}

// 键序无关的规范化序列化：两个包各自声明同一条目时，属性书写顺序不同不算冲突。
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// ── 静态校验 ─────────────────────────────────────────────────────────────

const VALID_PREDICATES = new Set([
  "npcStatus", "factionTensionGte", "factionPowerLte", "factionRepGte",
  "districtOwner", "flag", "questDone", "season", "situationActive", "worldState",
]);

// 收集 when 树（支持 all/any/not 嵌套与数组简写）里全部谓词节点。
function walkPredicates(node, visit) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) walkPredicates(child, visit);
    return;
  }
  if (typeof node === "string") {
    visit({ type: "worldState", id: node }); // 简写："ws_x" 等价于 { type: "worldState", id: "ws_x" }
    return;
  }
  if (typeof node !== "object") return;
  if (typeof node.type === "string") {
    visit(node);
    return;
  }
  for (const key of ["all", "any", "not"]) {
    if (node[key]) walkPredicates(node[key], visit);
  }
}

function collectFactions(entry, out) {
  for (const key of ["faction", "ownerFaction"]) {
    if (typeof entry?.[key] === "string") out.add(entry[key]);
  }
  walkPredicates(entry?.when, (pred) => {
    if (typeof pred.faction === "string") out.add(pred.faction);
  });
  if (entry?.patch && typeof entry.patch.ownerFaction === "string") out.add(entry.patch.ownerFaction);
}

// 校验已注册全部扩展包的一致性。返回错误字符串数组（空数组 = 全通过）。
export function validateWorldPacks(registry) {
  const errors = [];
  if (!registry) return ["validateWorldPacks: registry 为空"];
  const districtNames = new Set(Object.keys(QUCUO_MAP));
  const factionNames = new Set(FACTION_NAMES);
  const wsIds = new Set(registry.worldStates.map((w) => w.id));
  const sitIds = new Set(registry.situations.map((s) => s.id));

  // worldStates：谓词合法、worldState/situationActive 引用已声明
  const wsRefs = new Map(); // id -> [referenced worldState ids]（环检测用）
  for (const ws of registry.worldStates) {
    if (!ws.label) errors.push(`worldStates「${ws.id}」缺 label`);
    const refs = [];
    walkPredicates(ws.when, (pred) => {
      if (!VALID_PREDICATES.has(pred.type)) errors.push(`worldStates「${ws.id}」含未知谓词「${pred.type}」`);
      if (pred.type === "worldState") {
        if (!wsIds.has(pred.id)) errors.push(`worldStates「${ws.id}」引用未声明的 worldState「${pred.id}」`);
        else refs.push(pred.id);
      }
      if (pred.type === "situationActive" && pred.id && !sitIds.has(pred.id)) {
        errors.push(`worldStates「${ws.id}」引用未声明的 situation「${pred.id}」`);
      }
      if (pred.type === "factionTensionGte" || pred.type === "factionPowerLte" || pred.type === "factionRepGte") {
        if (typeof pred.value !== "number") errors.push(`worldStates「${ws.id}」谓词 ${pred.type} 缺数值 value`);
      }
    });
    wsRefs.set(ws.id, refs);
    const factions = new Set();
    collectFactions(ws, factions);
    for (const f of factions) if (!factionNames.has(f)) errors.push(`worldStates「${ws.id}」引用未知势力「${f}」`);
  }

  // 循环依赖检测（worldState 谓词互引）
  {
    const state = new Map(); // id -> 0 unvisited / 1 in-stack / 2 done
    const visit = (id, path) => {
      if (state.get(id) === 2) return;
      if (state.get(id) === 1) {
        errors.push(`worldStates 存在循环依赖：${[...path, id].join(" → ")}`);
        return;
      }
      state.set(id, 1);
      for (const next of wsRefs.get(id) || []) visit(next, [...path, id]);
      state.set(id, 2);
    };
    for (const id of wsRefs.keys()) visit(id, []);
  }

  // districtOverrides：据点存在、when 引用已声明、势力合法
  for (const ovr of registry.districtOverrides) {
    if (!districtNames.has(ovr.district)) errors.push(`districtOverrides「${ovr.id}」据点「${ovr.district}」不在 QUCUO_MAP`);
    for (const wsId of [].concat(ovr.when || [])) {
      if (!wsIds.has(wsId)) errors.push(`districtOverrides「${ovr.id}」引用未声明的 worldState「${wsId}」`);
    }
    const factions = new Set();
    collectFactions(ovr, factions);
    for (const f of factions) if (!factionNames.has(f)) errors.push(`districtOverrides「${ovr.id}」引用未知势力「${f}」`);
  }

  // situations：durationDays > 0
  for (const sit of registry.situations) {
    if (!(typeof sit.durationDays === "number" && sit.durationDays > 0)) {
      errors.push(`situations「${sit.id}」durationDays 必须为正数`);
    }
    if (!sit.label) errors.push(`situations「${sit.id}」缺 label`);
  }

  // roamingSquads：route 边在 QUCUO_MAP 连通、节点存在、势力合法、引用已声明
  for (const sq of registry.roamingSquads) {
    const route = sq.route || [];
    if (route.length < 2) errors.push(`roamingSquads「${sq.id}」route 至少需要两个节点`);
    for (const node of route) {
      if (!districtNames.has(node)) errors.push(`roamingSquads「${sq.id}」route 节点「${node}」不在 QUCUO_MAP`);
    }
    for (let i = 0; i < route.length - 1; i += 1) {
      const exits = QUCUO_MAP[route[i]]?.exits || {};
      if (!Object.values(exits).includes(route[i + 1])) {
        errors.push(`roamingSquads「${sq.id}」route 边「${route[i]} → ${route[i + 1]}」不连通`);
      }
    }
    const factions = new Set();
    collectFactions(sq, factions);
    for (const f of factions) if (!factionNames.has(f)) errors.push(`roamingSquads「${sq.id}」引用未知势力「${f}」`);
    walkPredicates(sq.when, (pred) => {
      if (pred.type === "worldState" && pred.id && !wsIds.has(pred.id)) {
        errors.push(`roamingSquads「${sq.id}」引用未声明的 worldState「${pred.id}」`);
      }
    });
    for (const key of ["clearSituation", "addTargetSituation"]) {
      const ref = sq.onArrive?.[key] || sq.onDefeated?.[key];
      if (ref && !sitIds.has(ref)) errors.push(`roamingSquads「${sq.id}」${key} 引用未声明的 situation「${ref}」`);
    }
  }

  // aiPackages：只查必填形状
  for (const pkg of registry.aiPackages) {
    if (!pkg.prototype) errors.push(`aiPackages「${pkg.id}」缺 prototype`);
  }

  return errors;
}
