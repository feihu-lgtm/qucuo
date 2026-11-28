// buildLivingClapboardEntries（WO-25A）——把散落的三本既有账
// （知识领域事实 / 契约 / 宿敌谱）规范化成统一冻结的 ClapboardEntry[]。
// ============================================================================
// 断点审计结论：传闻、事实、宿敌各记一本账，主链从未构造 clapboardEntries——
// 活人切片想吃场记板却无米下锅。本纯函数是唯一的规范化出口：
// WO-25B 的 actCall 11 号位与 npcSoulFrame 的「其所知所见」都从这里取料。
//
// 口径：
//   · 知识领域事实 → fact_index：witnesses=知晓者名单——不知情者在过滤层天然不可见，
//     与知识系统「谁知道什么事」的确定性推演同源，泄密结构性不可能。
//   · 契约 → pact：当事双方（NPC 与主角）可见；摘要带履约/违约/在约状态，全deterministic。
//   · 宿敌谱 active 条目 → nemesis：只有宿敌本人在见证名单（他自己当然记仇），
//     不向公众广播他人恩怨。
//   · visibleNpcNames 是预算闸门：与在场者无关的私密条目不出列（公共常识不受影响）；
//     不传/传空表示不过滤全量出列。
// 纯函数：不掷骰、不读时钟、同输入恒同输出。

import { createClapboardEntry } from "./clapboard.js";

const MAX_TEXT = 60;
const cut = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);

// 与在场者无关的私密条目不出列；公共条目（witnesses 空）不受影响
function relevantTo(entry, visibleSet) {
  if (!visibleSet) return true;
  if (!entry.witnesses.length) return true;
  return entry.witnesses.some((w) => visibleSet.has(w)) || entry.entities.some((e) => visibleSet.has(e));
}

function factEntries(facts, time) {
  const out = [];
  for (const fact of Object.values(facts || {})) {
    if (!fact?.id || !fact.摘要) continue; // 还没填词的事实无实物可上板
    const witnesses = Object.keys(fact.知晓者 || {});
    // 无目击者的事实不上板：witnesses 空在过滤层语义是「公共常识」——
    // 独自修炼这类无人亲见的事若出列，会被当成众所周知泄给不相干的 NPC。
    // 在场活人切片只服务 NPC 视角，无人知晓的事实本就无人可讲，跳过即正确。
    if (!witnesses.length) continue;
    out.push(createClapboardEntry({
      id: `fact_${fact.id}`,
      kind: "fact_index",
      turn: Number.isFinite(fact.诞生回合) ? fact.诞生回合 : 0,
      witnesses,
      entities: [],
      publicText: cut(fact.摘要),
      rawText: cut(fact.摘要),
      importance: fact.标签 ? 2 : 1,
    }));
  }
  return out;
}

function pactEntries(pacts) {
  const out = [];
  for (const [npcName, byKey] of Object.entries(pacts || {})) {
    if (!byKey || typeof byKey !== "object") continue;
    for (const [pactKey, pact] of Object.entries(byKey)) {
      if (!pact?.promise) continue;
      const state = pact.settled ? "已了结" : pact.breachTurn != null ? "已违约" : "在约";
      const text = `${npcName}与主角所立之约（${state}）：${cut(pact.promise)}`;
      out.push(createClapboardEntry({
        id: `pact_live_${npcName}_${pactKey}`,
        kind: "pact",
        turn: Number.isFinite(pact.bindTurn) ? pact.bindTurn : 0,
        witnesses: [npcName],
        entities: [npcName],
        publicText: text,
        rawText: text,
        importance: pact.settled ? 1 : 2,
      }));
    }
  }
  return out;
}

function nemesisEntries(roster) {
  const out = [];
  for (const [faction, group] of Object.entries(roster || {})) {
    for (const entry of Object.values(group?.entries || {})) {
      if (!entry?.name || entry.status !== "active" || !(entry.grudge > 0)) continue;
      const text = `${entry.name}（${faction}${Number.isFinite(entry.tier) ? `，${entry.tier}阶` : ""}）与主角结怨未了`;
      out.push(createClapboardEntry({
        id: `nemesis_live_${entry.id || entry.name}`,
        kind: "nemesis",
        turn: Number.isFinite(entry.firstTurn) ? entry.firstTurn : 0,
        witnesses: [entry.name],
        entities: [entry.name],
        publicText: text,
        rawText: text,
        importance: 2,
      }));
    }
  }
  return out;
}

// 规范化出口：三本账 → 冻结 ClapboardEntry[]（按 turn 降序归并，后写的不压先写的——
// renderClapboardSection 消费时自会按 importance/turn 重排预算）。
export function buildLivingClapboardEntries({ varTree = {}, visibleNpcNames = null, time = 0 } = {}) {
  const world = varTree?.世界 || {};
  const visibleSet = Array.isArray(visibleNpcNames) && visibleNpcNames.length ? new Set(visibleNpcNames) : null;
  const merged = [
    ...factEntries(world.知识领域?.事实, time),
    ...pactEntries(world.契约),
    ...nemesisEntries(world.宿敌谱),
  ].filter((entry) => relevantTo(entry, visibleSet));
  return Object.freeze(merged);
}
