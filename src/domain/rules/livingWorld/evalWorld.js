// WO-25D：声明式世界状态求值 + Kenshi 式据点覆写裁决（纯函数，零 Date.now/Math.random）。
// 运行时实时求值——绝不修改存档内固定拓扑 QUCUO_MAP，绝不把覆写结果烤死进存档。
//
// 状态读取口径（全部走 varTree，缺省安全回落）：
//   npcStatus        人物动态[npcId].status（无记录视为 "alive"）；in 含 "dead" 时 hpRatio<=0 也算 dead
//   factionTensionGte 势力张力代理（动态覆盖+BASE_TENSION 取 max，复用 tension.js 口径）
//   factionPowerLte  世界.势力战力[faction]（无记录视为满血 100）
//   factionRepGte    世界.势力声誉[faction]（无记录视为 0）
//   districtOwner    世界.据点归属[district]（纯账面读取，覆写裁决不走这里防循环）
//   flag             世界.旗号[flag] 真值
//   questDone        世界.任务册[quest].done 真值
//   season           由 state.time 游戏日推算：每 30 天一季，春夏秋冬循环（day 0 起为春）
//   situationActive  世界.据点局势 任意据点含该局势 id（可配 district 收窄）
//   worldState       引用另一条世界状态断言（静态校验保证无环，这里做防环兜底）

import { factionTensionProxy, getTension } from "../conflict/tension.js";

function worldOf(state) {
  return state?.varTree?.世界 || state?.世界 || {};
}

export function currentSeason(state) {
  const day = Math.floor((state?.time ?? 0) / 24);
  return ["春", "夏", "秋", "冬"][Math.floor(day / 30) % 4];
}

// 单谓词求值。ctx.activeStates 供 worldState 谓词查已决议结果（可选）。
export function evalPredicate(pred, state, ctx = {}) {
  if (!pred || typeof pred !== "object") return false;
  const world = worldOf(state);
  switch (pred.type) {
    case "npcStatus": {
      const dyn = world.人物动态?.[pred.npcId] || {};
      // 生效状态只取一档：显式 status 优先；无显式时 hpRatio<=0 推定 dead，否则 alive——alive/dead 互斥。
      const status = dyn.status || (typeof dyn.hpRatio === "number" && dyn.hpRatio <= 0 ? "dead" : "alive");
      return [].concat(pred.in || []).includes(status);
    }
    case "factionTensionGte": {
      const tension = world.tension || {};
      const value = pred.b ? getTension(tension, pred.faction, pred.b) : factionTensionProxy(tension, pred.faction);
      return value >= (pred.value ?? 0);
    }
    case "factionPowerLte": {
      const power = world.势力战力?.[pred.faction];
      return (power ?? 100) <= (pred.value ?? 0);
    }
    case "factionRepGte": {
      const rep = world.势力声誉?.[pred.faction];
      return (rep ?? 0) >= (pred.value ?? 0);
    }
    case "districtOwner": {
      return world.据点归属?.[pred.district] === pred.faction;
    }
    case "flag": {
      return Boolean(world.旗号?.[pred.flag]);
    }
    case "questDone": {
      // 真实记账在顶层 state.questProgress[qid].status==="completed"（questEngine），兼留旧账面路径。
      if (state?.questProgress?.[pred.quest]?.status === "completed") return true;
      return Boolean(world.任务册?.[pred.quest]?.done);
    }
    case "season": {
      const now = currentSeason(state);
      if (pred.in) return [].concat(pred.in).includes(now);
      return now === pred.eq;
    }
    case "situationActive": {
      const boards = world.据点局势 || {};
      for (const [district, cards] of Object.entries(boards)) {
        if (pred.district && district !== pred.district) continue;
        if ((cards || []).some((c) => c.id === pred.id)) return true;
      }
      return false;
    }
    case "worldState": {
      return Boolean(ctx.activeStates?.has(pred.id));
    }
    default:
      return false;
  }
}

// when 树求值：支持 all/any/not 任意嵌套、数组=all 简写、字符串=worldState 引用简写。
export function evalWhen(node, state, ctx = {}) {
  if (node === null || node === undefined) return true; // 无条件 = 恒成立
  if (typeof node === "string") return Boolean(ctx.activeStates?.has(node));
  if (Array.isArray(node)) return node.every((child) => evalWhen(child, state, ctx));
  if (typeof node !== "object") return false;
  if (typeof node.type === "string") return evalPredicate(node, state, ctx);
  const results = [];
  if (node.all !== undefined) results.push([].concat(node.all).every((c) => evalWhen(c, state, ctx)));
  if (node.any !== undefined) results.push([].concat(node.any).some((c) => evalWhen(c, state, ctx)));
  if (node.not !== undefined) results.push(![].concat(node.not).some((c) => evalWhen(c, state, ctx)));
  return results.length > 0 && results.every(Boolean);
}

// 求全部 worldStates 的激活集合。惰性记忆化递归求值：每条断言按需解析其 worldState
// 引用——否定依赖（not: worldState）不受注册顺序影响。无环由 validateWorldPacks 静态保证，
// 这里 visiting 集合兜底防环（环上节点一律按不激活处理）。
export function evalWorldStates(registry, state, ctx = {}) {
  const states = registry?.worldStates || [];
  const byId = new Map(states.map((ws) => [ws.id, ws]));
  const memo = new Map(); // id -> boolean
  const visiting = new Set();
  const resolve = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return false; // 环兜底
    const ws = byId.get(id);
    if (!ws) return false;
    visiting.add(id);
    const probe = { has: (ref) => resolve(ref) }; // 惰性探测，逐引用递归
    const result = evalWhen(ws.when, state, { ...ctx, activeStates: probe });
    visiting.delete(id);
    memo.set(id, result);
    return Boolean(result);
  };
  const active = new Set();
  for (const ws of states) {
    if (resolve(ws.id)) active.add(ws.id);
  }
  return active;
}

// Kenshi 式据点覆写裁决：筛出该据点全部 when 命中的覆写，
// 按「匹配条件数量降序 → priority 降序 → 注册顺序」选出唯一胜出者。
// 返回冻结的胜出补丁（含 overrideId/district/priority），无命中返回 null——调用方安全回落原据点。
export function resolveDistrictOverride(district, activeStates, registry) {
  const candidates = [];
  (registry?.districtOverrides || []).forEach((ovr, index) => {
    if (ovr.district !== district) return;
    const conds = [].concat(ovr.when || []);
    if (conds.every((wsId) => activeStates?.has(wsId))) {
      candidates.push({ ovr, index, condCount: conds.length });
    }
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) =>
    (b.condCount - a.condCount)
    || ((b.ovr.priority ?? 0) - (a.ovr.priority ?? 0))
    || (a.index - b.index));
  const winner = candidates[0].ovr;
  return Object.freeze({
    overrideId: winner.id,
    district,
    ...(winner.patch || {}),
  });
}
