// WO-25K · 在场非同伴 NPC 稀疏关系边与同屋低频微互动（纯函数，零 AI 调用）。
// ============================================================================
// 图纸契约（蓝图第五节 WO-25K）：
//   1. 筛同内层房间内满足条件的一对非同伴 NPC——已有关系边、同好 quirks 圈子、
//      同门高张力、或一方掌握对方不知情的知识领域事实；受全局冷却（≥6 回合）
//      与 seededRand 低概率门槛控制。
//   2. 纯函数先确定性结算微结果（同步一条传闻事实 / 小幅调整双方关系边 / 台词由头），
//      落公屏占位行；异步白描由 app 层 lifeVignetteBackfill 原位替换，本模块零感知。
// 稀疏关系边账本：varTree.世界.关系册——只在微互动发生时落边，不为全图 NPC 建全量账。
// 与 ocWander 的分工同 WO-25J：位置账一分不碰，本模块只读在场名单、写关系与传闻。

import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { isCompanionUnlockedByName, unlockedCompanions } from "../companion/companion.js";
import { inferQuirks } from "./npcGoals.js";
import { seededRand } from "../../../utils/seededRandom.js";

// 全局冷却：两次微互动至少间隔 6 回合（图纸口径）。
export const VIGNETTE_COOLDOWN_TURNS = 6;
// 低概率门槛：冷却外每个时间刻最多 35% 起一幕——市井偶发，不是每刻都有戏。
export const VIGNETTE_CHANCE = 0.35;

// 同门识别关键词：江湖门派/势力名（数据驱动，新增势力只需扩此表）。
const SECT_KEYS = ["青城", "峨眉", "唐门", "五仙", "天龙", "丐帮", "喇嘛", "萨迦", "噶举", "象雄", "苯门", "镖局", "土司"];

export function pairKey(nameA, nameB) {
  return [nameA, nameB].sort().join("|");
}

function sectsOf(npc) {
  const text = `${npc?.title || ""}${npc?.brief || ""}${npc?.personality || ""}${npc?.archetypeLabel || ""}`;
  return SECT_KEYS.filter((k) => text.includes(k));
}

// 同门判定：双方在册 faction 俱全时以在册为准（档案提及某派不等于出身该派——
// Review 实证：两人档案都提到同一派便被误认为同门）；缺在册数据才退回关键词。
// 「散人」是无门无派标记而不是门派——两个散人之间不存在同门香火情（Review 实证）。
const NON_AFFILIATION = new Set(["散人"]);
function sameSect(a, b) {
  if (a?.faction && b?.faction) {
    return a.faction === b.faction && !NON_AFFILIATION.has(a.faction) ? [a.faction] : [];
  }
  return sectsOf(a).filter((k) => sectsOf(b).includes(k));
}

// 玩家视野房（内层房优先，外层取据点锚点视野）内的非同伴 NPC：同伴/敌对/随行不入选。
export function collectPairCandidates(state) {
  const district = state.room?.name;
  if (!district) return [];
  const inner = state.innerRoomName ?? null;
  const party = new Set(unlockedCompanions(state.companionState).map((c) => c.label));
  return (state.room?.npcs || [])
    .filter((n) => n?.name
      && !n.companion && !n.hostile
      && !party.has(n.name)
      && !isCompanionUnlockedByName(state.companionState, n.name)
      && isNpcVisibleInInnerRoom(district, inner, n))
    .slice(0, 8);
}

// 一对 NPC 的亲和评分与可用素材（纯读）。score<=0 表示这对没戏。
export function scorePair(a, b, world) {
  let score = 0;
  const reasons = [];
  const edge = (world?.关系册 || {})[pairKey(a.name, b.name)];
  if (edge) { score += 3; reasons.push("旧识"); }
  const sharedQuirks = inferQuirks(a).filter((q) => inferQuirks(b).includes(q));
  if (sharedQuirks.length) { score += 2 * sharedQuirks.length; reasons.push("同好"); }
  const sharedSects = sameSect(a, b);
  if (sharedSects.length) { score += 2; reasons.push("同门"); }
  // 知识不对称：一方知晓、另一方不知情的事实——传闻同步的素材
  let rumor = null;
  for (const fact of Object.values(world?.知识领域?.事实 || {})) {
    if (!fact?.摘要) continue;
    const knowers = fact.知晓者 || {};
    const aKnows = !!knowers[a.name];
    const bKnows = !!knowers[b.name];
    if (aKnows !== bKnows) {
      score += 2;
      reasons.push("风声");
      rumor = { fact, from: aKnows ? a.name : b.name, to: aKnows ? b.name : a.name };
      break;
    }
  }
  return { score, reasons, rumor, sharedQuirks, sharedSects };
}

// 微结果确定性结算：返回 { outcome, writeWorld } —— outcome 是喂白描的既定走向文本，
// writeWorld 是 (prevWorld) => patch 的世界账写入（关系册/知识领域/微戏冷却）。
function settleOutcome(best, time) {
  const { a, b, rumor, sharedQuirks, sharedSects } = best;
  const key = pairKey(a.name, b.name);
  if (rumor) {
    return {
      kind: "rumor",
      outcome: `${rumor.from}把一桩风声（「${String(rumor.fact.摘要).slice(0, 30)}」）低声说给了${rumor.to}——此事后者原本不知情，此刻起知晓`,
      relationTag: "交换风声的交情",
      writeWorld: (w) => {
        const facts = { ...(w.知识领域?.事实 || {}) };
        const cur = facts[rumor.fact.id];
        if (!cur) return {};
        facts[rumor.fact.id] = {
          ...cur,
          知晓者: { ...(cur.知晓者 || {}), [rumor.to]: { 途径: "传闻", 得知回合: time } },
        };
        return { 知识领域: { ...(w.知识领域 || {}), 事实: facts } };
      },
    };
  }
  const tag = sharedSects.length ? "同门" : sharedQuirks.length ? "同好" : "旧识";
  const closeness = (best.edge?.closeness || 0) + 1;
  const scene = sharedSects.length
    ? `${a.name}与${b.name}认出门派香火情，凑到一处寒暄`
    : sharedQuirks.length
      ? `${a.name}与${b.name}因「${sharedQuirks[0]}」的同道癖好搭上话，越聊越投机`
      : `${a.name}与${b.name}老相识碰面，拼桌叙旧`;
  return {
    kind: "bond",
    outcome: `${scene}——两人关系又近了半分（既成事实，不得推翻成冲突）`,
    relationTag: `${tag}相交`,
    writeWorld: (w) => ({
      关系册: {
        ...(w.关系册 || {}),
        [key]: { closeness, lastTurn: time, tag },
      },
    }),
  };
}

// 主入口（纯函数）：此刻是否起一幕微互动？返回 null 或冻结的
// { a, b, kind, outcome, relationTag, line, writeWorld, cooldownWrite }
// line 是公屏占位行文本（极简白描骨架，离线/无 Key 时的保底）。
export function pickPairVignette(state) {
  const world = state.varTree?.世界 || {};
  const time = state.time || 0;
  const lastTurn = world.微戏?.lastTurn;
  if (Number.isFinite(lastTurn) && time - lastTurn < VIGNETTE_COOLDOWN_TURNS) return null;
  const npcs = collectPairCandidates(state);
  if (npcs.length < 2) return null;
  const rng = seededRand(0, `vignette|${state.room?.name}|${state.innerRoomName || ""}|${time}`);
  if (rng() >= VIGNETTE_CHANCE) return null;

  let best = null;
  for (let i = 0; i < npcs.length; i += 1) {
    for (let j = i + 1; j < npcs.length; j += 1) {
      const scored = scorePair(npcs[i], npcs[j], world);
      if (scored.score <= 0) continue;
      if (!best || scored.score > best.score) {
        best = { ...scored, a: npcs[i], b: npcs[j], edge: (world.关系册 || {})[pairKey(npcs[i].name, npcs[j].name)] };
      }
    }
  }
  if (!best) return null;

  const settled = settleOutcome(best, time);
  return Object.freeze({
    a: best.a,
    b: best.b,
    kind: settled.kind,
    outcome: settled.outcome,
    relationTag: settled.relationTag,
    line: `  ${best.a.name}与${best.b.name}在一旁低声搭上了话……`,
    writeWorld: settled.writeWorld,
    cooldownWrite: { lastTurn: time },
  });
}

// 世界规则形态：deps/run 契约与 npc.roam 等同款。占位行文本由 logs 承载，
// fillKey 由 useWorldRulesRunner 统一打标（与 roamMovements 同路子）。
export const npcPairVignetteRule = {
  id: "npc.pairVignette",
  deps: (state) => [state.time, state.room?.name, state.innerRoomName],
  run(state, { firstRun, previousDeps } = {}) {
    if (firstRun || !state.room?.name) return null;
    // 只在时间往前走且没换房的那一刻判定——换房先让玩家看清场子
    if (Object.is(state.time, previousDeps?.[0])) return null;
    if (state.room.name !== previousDeps?.[1] || (state.innerRoomName ?? null) !== (previousDeps?.[2] ?? null)) return null;
    const picked = pickPairVignette(state);
    if (!picked) return null;
    return {
      logs: [{ t: "sys", text: picked.line }],
      changes: {
        varTree: (prev) => {
          const pw = prev?.世界 || {};
          const w = { ...pw, ...picked.writeWorld(pw), 微戏: { ...(pw.微戏 || {}), ...picked.cooldownWrite } };
          return { ...(prev || {}), 世界: w };
        },
      },
      pairVignette: {
        line: picked.line,
        aName: picked.a.name,
        bName: picked.b.name,
        kind: picked.kind,
        outcome: picked.outcome,
        relationTag: picked.relationTag,
      },
    };
  },
};
