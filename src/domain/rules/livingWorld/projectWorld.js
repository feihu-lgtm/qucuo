// WO-25F：活世界统一只读投影出口（纯函数，零状态写入）。
// 界面与提示词一律走这里的投影，不再深翻散落 varTree 路径——
// 新增动态事件/危机时只动内核，投影口径不变。
// 旧存档缺 事件录/据点局势/编队册 字段时全部安全降级为空，绝不报错。

import { BASE_TENSION } from "../../data/factions/npcFactions.js";
import { evalWorldStates, resolveDistrictOverride } from "./evalWorld.js";

const PRICE_MOD_MIN = 0.80;
const PRICE_MOD_MAX = 1.40;

function worldOf(state) {
  return state?.varTree?.世界 || {};
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 据点快照：生效覆写/活跃局势卡/品类物价倍率（钳制 [0.80, 1.40]）/在场离线编队/已传到本据点的事件
export function getDistrictSnapshot(state, district, registry) {
  const world = worldOf(state);
  const activeStates = evalWorldStates(registry, state);
  const override = resolveDistrictOverride(district, activeStates, registry);
  const situations = (world.据点局势?.[district] || []).map((card) => {
    const decl = registry?.situations?.find((s) => s.id === card.id);
    return { ...card, label: decl?.label || card.id, priceMod: decl?.priceMod || null, promptHint: decl?.promptHint || null };
  });
  // 品类物价倍率：覆写 priceMod 与局势卡 priceMod 逐品类叠乘，钳制 [0.80, 1.40]
  // all 是全品类兜底乘区：既乘进 all 键本身，也叠进每个具体品类
  const priceMod = {};
  let allMult = 1;
  const applyMod = (mod) => {
    if (!mod) return;
    for (const [cat, mult] of Object.entries(mod)) {
      if (cat === "all") allMult *= mult;
      else priceMod[cat] = (priceMod[cat] ?? 1) * mult;
    }
  };
  applyMod(override?.priceMod);
  for (const card of situations) applyMod(card.priceMod);
  for (const cat of Object.keys(priceMod)) {
    priceMod[cat] = Math.round(clamp(priceMod[cat] * allMult, PRICE_MOD_MIN, PRICE_MOD_MAX) * 100) / 100;
    if (priceMod[cat] === 1) delete priceMod[cat];
  }
  if (allMult !== 1) priceMod.all = Math.round(clamp(allMult, PRICE_MOD_MIN, PRICE_MOD_MAX) * 100) / 100;
  const squads = Object.entries(world.编队册 || {})
    .filter(([, entry]) => entry?.active && entry.node === district)
    .map(([squadId, entry]) => {
      const decl = registry?.roamingSquads?.find((s) => s.id === squadId);
      return { id: squadId, name: decl?.name || squadId, faction: decl?.faction || null, role: decl?.role || null, node: entry.node };
    });
  const events = getKnownEventsForDistrict(state, district, 5);
  return { district, override, situations, priceMod, squads, events };
}

// 世界总览：激活 worldStates/全图活跃局势与编队坐标/偏离基线的势力张力对子
//（对应 Kenshi Reactive World Checker 的可观测性——玩家不用对着暗门猜条件）
export function getWorldOverview(state, registry) {
  const world = worldOf(state);
  const activeStates = evalWorldStates(registry, state);
  const states = (registry?.worldStates || [])
    .filter((ws) => activeStates.has(ws.id))
    .map((ws) => ({ id: ws.id, label: ws.label || ws.id }));
  const situations = [];
  for (const [district, cards] of Object.entries(world.据点局势 || {})) {
    for (const card of cards || []) {
      const decl = registry?.situations?.find((s) => s.id === card.id);
      situations.push({ district, id: card.id, label: decl?.label || card.id, expireDay: card.expireDay ?? null });
    }
  }
  const squads = Object.entries(world.编队册 || {})
    .filter(([, entry]) => entry?.active)
    .map(([squadId, entry]) => {
      const decl = registry?.roamingSquads?.find((s) => s.id === squadId);
      return { id: squadId, name: decl?.name || squadId, faction: decl?.faction || null, node: entry.node };
    });
  // 张力对子：动态账与基线合并，只报偏离基线的
  const tensionPairs = [];
  const dynamic = world.tension || {};
  const keys = new Set([...Object.keys(BASE_TENSION), ...Object.keys(dynamic)]);
  for (const key of [...keys].sort()) {
    const base = BASE_TENSION[key] ?? 0;
    const cur = dynamic[key] ?? base;
    if (cur !== base && cur > 0) tensionPairs.push({ pair: key, base, current: cur, delta: cur - base });
  }
  return { states, situations, squads, tensionPairs, eventCount: (world.事件录 || []).length };
}

// 只返回 knownDistricts 已包含该据点的事件（新→旧）
export function getKnownEventsForDistrict(state, district, limit = 10) {
  const events = worldOf(state).事件录 || [];
  return events
    .filter((ev) => (ev.knownDistricts || []).includes(district))
    .sort((a, b) => (b.turn || 0) - (a.turn || 0))
    .slice(0, limit);
}

// 按人名查最近卷入的事件（事件 npcs 字段缺失时降级为文本匹配，皆无则空）
export function getNpcRecentEvents(state, npcName, limit = 10) {
  if (!npcName) return [];
  const events = worldOf(state).事件录 || [];
  return events
    .filter((ev) => (ev.npcs || []).includes(npcName) || (typeof ev.text === "string" && ev.text.includes(npcName)))
    .sort((a, b) => (b.turn || 0) - (a.turn || 0))
    .slice(0, limit);
}
