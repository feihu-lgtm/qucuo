// 路遇随机事件 · 系统侧（纯函数，rng 由调用方注入，可重放）
// ------------------------------------------------------------------
// 定位：活世界蓝图（#686）插头 1 的消费方。读活世界的投影（局势卡、离线编队、事件录），
// 写回活世界能消费的东西（张力、局势卡、化解触发词、WorldEvent），不自建平行账本：
//   只遇一次记在 flags（road_once_<id>），冷却从 事件录 里的路遇条目推算。
// 人物一律从现有池子取（游走冒险者、过路人姓名库、传闻册），不新造具名人物；池子里没有合适的人，这件事就不触发。
// 分工与判官链一致：系统定事实，说书人写戏。
//   rollRoadEvent       进入节点时抽一件事，定下来人与三个可行之事。
//   buildRoadEventNote  第一段提示词：写到抉择之前。
//   resolveRoadEvent    第二段：掷检定，奖励码解析成事实。
//   buildResolutionNote 第二段提示词：已定事实 + 天机券填空。
//   roadEventWrites     结算后要落账的东西：flags、WorldEvent、游走册同步。
// 现阶段放在 scripts/ 下供审阅与校验，接线时整体移入 src/domain（见 docs/路遇随机事件设计.md）。
import {
  ROAD_EVENTS, ROAD_EVENT_BY_ID, ROAD_EVENT_CATEGORIES, PLACE_TAGS, ROAD_EVENT_RULES, livingAffinity,
} from "./index.js";
import { calcDungeonCheckRate } from "../../src/domain/rules/dungeon/internal.js";
import { QUALITY } from "../../src/domain/rules/economy/equipment.js";
import { factionRepOf } from "../../src/domain/rules/economy/factionRep.js";
import { factionTensionProxy, getTension } from "../../src/domain/rules/conflict/tension.js";
import { WANDERING_OCS, wanderRangeOf } from "../../src/domain/rules/npc/ocWander.js";
import { ocNearFaction, makeRoadPasser } from "../../src/domain/data/npc/randomPassers.js";

export const SIX_STATS = Object.freeze(["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"]);
export const ITEM_CATEGORY_CODE = Object.freeze({ 武器: "weapon", 护甲: "armor", 饰品: "accessory", 杂物: "misc" });
export const ROAD_EVENT_SHARE = 0.6; // 遭遇命中后换成路遇事件的比例，其余仍是原势力过路人
const TIER_WEIGHT = { 1: 10, 2: 4, 3: 1 };
const EVENT_COOLDOWN_DAYS = 10;
const CATEGORY_COOLDOWN_DAYS = 1;
const POSITIVE_CONDITIONS = new Set(["百毒不侵"]);
const ONCE_FLAG = (id) => `road_once_${id}`;
const HERE_BONUS = 5; // 游走册显示此刻就在本节点的冒险者，抽中权重乘数

const dayOf = (time) => Math.floor((Number(time) || 0) / 24);
const hourOf = (time) => (((Number(time) || 0) % 24) + 24) % 24;
export const isNight = (time) => { const h = hourOf(time); return h >= 19 || h < 5; };
const statOf = (state, key) => { const v = state?.char?.special?.[key]; return Number.isFinite(v) ? v : 5; };
const world = (state) => state?.varTree?.世界 || {};
const rumorNames = (state) => Object.keys(world(state).传闻人物 || {});
const tensionOf = (state) => state?.worldTension || world(state).tension || {};

// ── 美人槽的成年判定 ──
// 冒险者档案没有年龄字段。按游戏自己的标记：只取带 intimacy 设定且未 forbidden 的人，
// 并排除生平文本里出现未满十八岁字样的人（宁可少抽，不可错抽）。
const MINOR_AGE_RE = /(?:^|[^二三四五六七八九十])十[一二三四五六七]岁|(?<!\d)1[0-7]岁/;
export function isRomanceEligible(oc) {
  if (!oc?.intimacy || oc.intimacy.forbidden) return false;
  const text = [oc.title, oc.brief, oc.personality, oc.lifeHistory, oc.fullBio].join(" ");
  return !MINOR_AGE_RE.test(text);
}

// 「oc:女:亲密:百花门」→ 人物槽；「势力:身份:性别:年纪」→ 身份来人；「传闻」；auto → 无来人。
export function parseCast(cast) {
  if (!cast || cast === "auto") return null;
  if (cast === "传闻") return { kind: "rumor" };
  const parts = cast.split(":");
  if (parts[0] === "oc") {
    return { kind: "oc", gender: parts[1] === "任" ? null : parts[1], romance: parts.includes("亲密"), nearFaction: parts.slice(2).find((p) => p !== "亲密") || null };
  }
  const [faction, role, gender, age] = parts;
  return { kind: "role", faction, role, gender, age };
}

// 人物槽的候选：未入队、合性别与就近势力、游走范围包含本节点；美人槽另需成年与亲密设定。
export function ocCandidates(slot, state, destNode) {
  const companions = state?.companionState || {};
  const taken = new Set(Object.values(companions).filter((c) => c?.unlocked).map((c) => c.label));
  const roster = world(state).游走册 || {};
  return WANDERING_OCS
    .filter((oc) => !taken.has(oc.name))
    .filter((oc) => !slot.gender || oc.gender === slot.gender)
    .filter((oc) => !slot.romance || isRomanceEligible(oc))
    .filter((oc) => !slot.nearFaction || ocNearFaction(oc) === slot.nearFaction)
    .filter((oc) => roster[oc.name]?.at === destNode || wanderRangeOf(oc).includes(destNode))
    .map((oc) => ({ oc, weight: roster[oc.name]?.at === destNode ? HERE_BONUS : 1 }));
}

// 活世界投影的最小读法。WO-25F 的 getDistrictSnapshot 落地后，由调用方直接传 snapshot 进来。
export function roadSnapshot(state, destNode) {
  const w = world(state);
  const today = dayOf(state?.time);
  const situations = (w.据点局势?.[destNode] || []).filter((s) => s.expireDay == null || s.expireDay >= today).map((s) => s.id);
  const squads = Object.entries(w.离线编队 || {}).filter(([, s]) => s?.at === destNode).map(([id, s]) => ({ id, ...s }));
  const events = (w.事件录 || []).filter((e) => (e.knownDistricts || []).includes(destNode));
  return { situations, squads, events };
}

// 蓝图谓词求值（与 WO-25C/WO-25D 的 evalPredicate 同口径，同时保留旧字段兼容；路遇自带三扩展谓词）。
export function evalWhen(pred, state, ctx = {}) {
  if (!pred) return true;
  if (pred.all) return pred.all.every((p) => evalWhen(p, state, ctx));
  if (pred.any) return pred.any.some((p) => evalWhen(p, state, ctx));
  if (pred.not) return !pred.not.some((p) => evalWhen(p, state, ctx));
  switch (pred.type) {
    case "factionRepGte": return factionRepOf(state?.varTree || {}, pred.faction) >= pred.value;
    case "factionTensionGte": {
      const fac = pred.faction || pred.a;
      const value = pred.b ? getTension(tensionOf(state), fac, pred.b) : factionTensionProxy(tensionOf(state), fac);
      return value >= (pred.value ?? 0);
    }
    case "situationActive": {
      const sid = pred.id || pred.situation;
      const today = dayOf(state?.time);
      if (pred.district) {
        return (world(state).据点局势?.[pred.district] || []).some(
          (s) => s.id === sid && (s.expireDay == null || s.expireDay >= today),
        );
      }
      if (ctx.snapshot?.situations) return ctx.snapshot.situations.includes(sid);
      return Object.values(world(state).据点局势 || {}).some((cards) =>
        (cards || []).some((s) => s.id === sid && (s.expireDay == null || s.expireDay >= today)));
    }
    case "flag": return (state?.flags || []).includes(pred.flag) || Boolean(world(state).旗号?.[pred.flag]);
    case "questDone": {
      const qid = pred.quest || pred.questId;
      return state?.questProgress?.[qid]?.status === "completed" || Boolean(world(state).任务册?.[qid]?.done);
    }
    case "statGte": return statOf(state, pred.stat) >= pred.value;
    case "rumorKnown": return rumorNames(state).length > 0;
    case "knownEventsHere": return (ctx.snapshot?.events || []).length >= (pred.min || 1);
    default: throw new Error(`未知谓词：${pred.type}`);
  }
}

function placeMatches(event, destNode) {
  const tags = PLACE_TAGS[destNode] || [];
  return event.where.some((w) => w === destNode || tags.includes(w));
}

function lastRoadDay(state, pick) {
  let last = null;
  for (const e of world(state).事件录 || []) if ((e?.kind === "road" || e?.type === "road") && pick(e) && (last == null || e.day > last)) last = e.day;
  return last;
}

export function isEligible(event, state, destNode, snapshot = roadSnapshot(state, destNode)) {
  if (!placeMatches(event, destNode)) return false;
  const time = state?.time ?? 0;
  if (event.time === "夜" && !isNight(time)) return false;
  if (event.time === "昼" && isNight(time)) return false;
  if (!evalWhen(event.when, state, { snapshot })) return false;
  if (event.once && (state?.flags || []).includes(ONCE_FLAG(event.id))) return false;
  const today = dayOf(time);
  const last = lastRoadDay(state, (e) => e.eventId === event.id);
  if (last != null && today - last < EVENT_COOLDOWN_DAYS) return false;
  const catLast = lastRoadDay(state, (e) => e.category === event.cat);
  if (catLast != null && today - catLast < CATEGORY_COOLDOWN_DAYS) return false;
  const cast = parseCast(event.cast);
  if (cast?.kind === "oc" && ocCandidates(cast, state, destNode).length === 0) return false; // 池子里没人就不触发
  return true;
}

export function eligibleEvents(state, destNode, snapshot = roadSnapshot(state, destNode)) {
  return ROAD_EVENTS.filter((e) => isEligible(e, state, destNode, snapshot));
}

function weightOf(event, luck, snapshot) {
  let w = TIER_WEIGHT[event.tier] || 1;
  if (event.tier === 3) w *= 1 + Math.max(0, luck - 5) * 0.1;
  const living = livingAffinity(event.cat);
  for (const s of snapshot.situations) w *= living.situations?.[s] ?? 1;
  if ((living.squadRoles || []).some((r) => snapshot.squads.some((q) => q.role === r))) w *= 2;
  return w;
}

function pickWeighted(items, weightFn, rng) {
  const total = items.reduce((s, x) => s + weightFn(x), 0);
  let r = rng() * total;
  for (const x of items) { r -= weightFn(x); if (r < 0) return x; }
  return items[items.length - 1];
}

function ocLifeHintOf(state, name) {
  const dyn = world(state).人物动态?.[name];
  if (!dyn || typeof dyn !== "object") return "";
  const parts = [];
  if (typeof dyn.hpRatio === "number" && dyn.hpRatio < 0.8) parts.push("带伤在身");
  if (dyn.purse) parts.push(`银囊${dyn.purse}`);
  if (dyn.mood) parts.push(`心境${dyn.mood}`);
  return parts.join("、");
}

function castFor(event, state, destNode, snapshot, rng) {
  const slot = parseCast(event.cast);
  if (!slot) return null;
  if (slot.kind === "rumor") { const names = rumorNames(state); return { kind: "rumor", name: names[Math.floor(rng() * names.length)] }; }
  if (slot.kind === "oc") {
    const { oc } = pickWeighted(ocCandidates(slot, state, destNode), (c) => c.weight, rng);
    const lifeHint = ocLifeHintOf(state, oc.name);
    return { kind: "oc", name: oc.name, gender: oc.gender, faction: ocNearFaction(oc), title: oc.title, brief: oc.brief, romance: slot.romance, ...(lifeHint ? { lifeHint } : {}) };
  }
  // 身份来人：编队停在本节点且角色对得上时，来人取编队成员；否则身份由事件定、姓名由过路人姓名库出
  const squad = snapshot.squads.find((q) => (livingAffinity(event.cat).squadRoles || []).includes(q.role));
  const faction = squad?.faction || slot.faction;
  let passer = null;
  for (let i = 0; i < 6 && !(passer && passer.gender === slot.gender); i++) passer = makeRoadPasser(faction, rng);
  return { kind: "role", faction, role: slot.role, gender: slot.gender, age: slot.age, name: passer?.gender === slot.gender ? passer.name : null, squadId: squad?.id || null };
}

export function rollRoadEvent(state, destNode, { rng = Math.random, luck = statOf(state, "气运"), snapshot = roadSnapshot(state, destNode) } = {}) {
  const pool = eligibleEvents(state, destNode, snapshot);
  if (!pool.length) return null;
  const event = pickWeighted(pool, (e) => weightOf(e, luck, snapshot), rng);
  const category = ROAD_EVENT_CATEGORIES[event.cat];
  return {
    eventId: event.id, destNode, day: dayOf(state?.time), turn: state?.time ?? 0,
    cast: castFor(event, state, destNode, snapshot, rng),
    situations: snapshot.situations,
    options: [
      { key: "main", label: category.options.main, check: event.check, dc: event.dc,
        rate: event.check ? calcDungeonCheckRate(statOf(state, event.check), event.dc) : 100 },
      { key: "alt", label: category.options.alt, check: null, rate: 100 },
      { key: "leave", label: category.options.leave, check: null, rate: 100 },
    ],
  };
}

function rollQualityWith(luck, rng) {
  const g = Math.max(0, Math.min(10, luck)) / 10;
  const dist = [50, 30, 10, 8, 1.5, 0.5].map((b, i) => b + ([0, 20, 20, 20, 20, 20][i] - b) * g);
  let r = rng() * 100;
  for (let i = 0; i < dist.length; i++) { r -= dist[i]; if (r < 0) return QUALITY[i]; }
  return QUALITY[QUALITY.length - 1];
}
function resolveQuality(spec, luck, rng) {
  if (QUALITY.includes(spec)) return spec;
  const rolled = rollQualityWith(luck, rng);
  return spec === "roll+1" ? QUALITY[Math.min(QUALITY.length - 1, QUALITY.indexOf(rolled) + 1)] : rolled;
}
const num = (s) => Number(String(s).replace("+", ""));
const splitDelta = (s) => { const m = /^(.+?)([+-]\d+)$/.exec(s || ""); return m ? [m[1], num(m[2])] : [null, NaN]; };

export function parseRewardCode(code, { cast, destNode, luck = 5, rng = Math.random } = {}) {
  const [head, ...rest] = code.split(":");
  const who = cast?.name || cast?.role || "来人";
  switch (head) {
    case "silver": return { op: "CHANGE_VITALS_SILVER", moneyDelta: num(rest[0]) };
    case "hp": return { op: "CHANGE_VITALS_SILVER", hpDelta: num(rest[0]) };
    case "item": return { op: "GRANT_ITEM", warrant: true, category: ITEM_CATEGORY_CODE[rest[0]], quality: resolveQuality(rest[1], luck, rng) };
    case "skill": return { op: "BESTOW_SKILL", warrant: true, school: rest[0], quality: resolveQuality(rest[1], luck, rng), growthMode: rest[2] };
    case "stat": { const [attr, delta] = splitDelta(rest[0]); return { op: "SHIFT_SPECIAL_STAT", attr, delta }; }
    case "exp": return { op: "PROGRESS_CULTIVATION", expDelta: num(rest[0]) };
    case "pot": return { op: "PROGRESS_CULTIVATION", potDelta: num(rest[0]) };
    case "rep": { const [faction, delta] = splitDelta(rest.join(":")); return { op: "FACTION_REP", faction, delta }; }
    case "tension": { const [pair, delta] = splitDelta(rest.join(":")); const [a, b] = pair.split("/"); return { op: "FACTION_TENSION", a, b, delta }; }
    case "situation": return { op: rest[0].startsWith("+") ? "ADD_SITUATION" : "CLEAR_SITUATION", situation: rest[0].slice(1), district: destNode };
    case "trigger": return { op: "SITUATION_TRIGGER", trigger: rest.join(":"), district: destNode };
    case "aff": return { op: "MUTATE_SOCIAL", npc: who, affectionDelta: num(rest[0]) };
    case "ally": return { op: "COMPANION_CANDIDATE", npc: who, cast, affectionPin: 40 };
    case "mate": return { op: "COMPANION_CANDIDATE", npc: who, cast, affectionPin: 60, romance: true };
    case "beast": return { op: "COMPANION_CANDIDATE", npc: rest[0], beast: true, role: rest[1], affectionPin: 40 };
    case "cond": return { op: "APPLY_CONDITION", flag: rest[0], durationTurns: num(rest[1]), negative: !POSITIVE_CONDITIONS.has(rest[0]) };
    case "clue": return { op: "RUMOR_HOOK", npc: who };
    case "pact": return { op: "BIND_OR_SETTLE_PACT", npc: who };
    case "scene": return { op: "ALTER_WORLD_SCENE", place: destNode };
    default: throw new Error(`未知奖励码：${code}`);
  }
}

export function parseRewardCodes(str, ctx) {
  return String(str || "").split("|").map((s) => s.trim()).filter(Boolean).map((c) => parseRewardCode(c, ctx));
}

// 势力摩擦一类：调停成功两家张力回落，失败上升；暗中相助一方则张力上升。两家取自次行动的声誉码。
function feudTension(event, optionKey, success) {
  if (event.cat !== "N") return [];
  const sides = (event.alt.match(/rep:([^+\-|]+)[+-]/g) || []).map((s) => s.slice(4, -1));
  if (sides.length < 2) return [];
  const delta = optionKey === "alt" ? 8 : success ? -10 : 8;
  return [{ op: "FACTION_TENSION", a: sides[0], b: sides[1], delta }];
}

export function resolveRoadEvent(roll, optionKey, state, { rng = Math.random, luck = statOf(state, "气运") } = {}) {
  const event = ROAD_EVENT_BY_ID[roll.eventId];
  const ctx = { cast: roll.cast, destNode: roll.destNode, luck, rng };
  if (optionKey === "leave") return { optionKey, success: null, facts: [] };
  if (optionKey === "alt") return { optionKey, success: true, facts: [...parseRewardCodes(event.alt, ctx), ...feudTension(event, "alt", true)] };
  const rate = event.check ? calcDungeonCheckRate(statOf(state, event.check), event.dc) : 100;
  const success = rng() * 100 < rate;
  return { optionKey, success, rate, facts: [...parseRewardCodes(success ? event.win : event.lose, ctx), ...feudTension(event, "main", success)] };
}

// 结算后要落账的东西（由调用方经 applyResult 写入）：
//   flagsAdd      只遇一次的标记
//   worldEvent    进 varTree.世界.事件录 的一条路遇（蓝图 WorldEvent，由 worldPulse 向外扩散）
//   rosterSync    冒险者被这件事「请」到本节点时，同步游走册位置，免得同一人两处现身
export function roadEventWrites(roll, outcome) {
  const event = ROAD_EVENT_BY_ID[roll.eventId];
  const major = outcome.facts.some((f) => f.op === "COMPANION_CANDIDATE" || (f.op === "BESTOW_SKILL" && QUALITY.indexOf(f.quality) >= 3));
  const actorNames = roll.cast?.name ? [roll.cast.name] : [];
  return {
    flagsAdd: event.once && outcome.optionKey !== "leave" ? [ONCE_FLAG(event.id)] : [],
    worldEvent: {
      id: `road_${event.id}_${roll.turn}`,
      kind: "road",
      type: "road",
      eventId: event.id,
      category: event.cat,
      day: roll.day,
      turn: roll.turn,
      district: roll.destNode,
      actors: actorNames,
      entities: actorNames,
      witnesses: ["主角", ...actorNames],
      summary: `${ROAD_EVENT_CATEGORIES[event.cat].name}·${event.name}`,
      outcome: outcome.success == null ? "leave" : outcome.success ? "success" : "fail",
      importance: major ? 2 : 1,
      knownDistricts: [roll.destNode],
    },
    rosterSync: roll.cast?.kind === "oc" ? { name: roll.cast.name, at: roll.destNode } : null,
  };
}

function describeCast(cast) {
  if (!cast) return "此事不必有固定来人；若情境需要旁人，可写一两个无名路人，不得给他们起名或赋予后续戏份。";
  if (cast.kind === "rumor") return `来人系统已定：传闻人物「${cast.name}」。照传闻写他，此为传闻落地，不得改名。`;
  if (cast.kind === "oc") {
    const stateNote = cast.lifeHint ? `（此刻状态：${cast.lifeHint}）` : "";
    return `来人系统已定：游走冒险者${cast.name}（${cast.title}，${cast.brief}）${stateNote}。样貌、口吻、性子与随身之物一律照此人档案写，把情节核里的处境安到此人身上；照抄名字，加入 room.npcs，不要改名。`;
  }
  const who = `${cast.faction === "散人" ? "无门无派" : `隶属【${cast.faction}】`}的${cast.role}，${cast.gender}，${cast.age}岁上下${cast.squadId ? "，是此刻途经此地的编队中人" : ""}`;
  return cast.name ? `来人系统已定：${cast.name}，${who}。照抄名字，加入 room.npcs，不要改名。` : `来人系统已定：${who}。名字由你起，须合其身份与地域，避开已认识的人。`;
}

const describeFact = (f) => {
  switch (f.op) {
    case "CHANGE_VITALS_SILVER": return f.moneyDelta != null ? `银两 ${f.moneyDelta > 0 ? "+" : ""}${f.moneyDelta}` : `气血 ${f.hpDelta}`;
    case "GRANT_ITEM": return `得一件${f.quality}品${{ weapon: "兵刃", armor: "护甲", accessory: "饰物", misc: "杂物" }[f.category]}（待命名）`;
    case "BESTOW_SKILL": return `得一门${f.quality}品${f.school === "any" ? "" : `${f.school}一路的`}武学（${f.growthMode === "独门" ? "完整传授" : "入门可成长"}，待命名）`;
    case "SHIFT_SPECIAL_STAT": return `${f.attr} ${f.delta > 0 ? "+" : ""}${f.delta}`;
    case "PROGRESS_CULTIVATION": return f.expDelta != null ? `江湖经验 +${f.expDelta}` : `潜能 +${f.potDelta}`;
    case "FACTION_REP": return `【${f.faction}】声誉 ${f.delta > 0 ? "+" : ""}${f.delta}`;
    case "FACTION_TENSION": return `【${f.a}】与【${f.b}】之间的张力${f.delta > 0 ? "升高" : "回落"}`;
    case "ADD_SITUATION": return `${f.district}挂上局势「${f.situation}」`;
    case "CLEAR_SITUATION": return `${f.district}的局势「${f.situation}」得以化解`;
    case "SITUATION_TRIGGER": return `${f.district}的相关局势可能因此缓解（${f.trigger}）`;
    case "MUTATE_SOCIAL": return `${f.npc}好感 ${f.affectionDelta > 0 ? "+" : ""}${f.affectionDelta}`;
    case "COMPANION_CANDIDATE": return f.beast ? `${f.npc}（${f.role}）愿意跟随，玩家可邀其同行` : `${f.npc}${f.romance ? "与主角投缘" : ""}愿意同行，玩家可邀其入队`;
    case "APPLY_CONDITION": return `挂状态「${f.flag}」${f.durationTurns} 回合`;
    case "RUMOR_HOOK": return "来人捎一句传闻，须点到一个新的具名人物并写进 mentionedNewNpcs";
    case "BIND_OR_SETTLE_PACT": return `与${f.npc}立下一个约定，写清何时何地`;
    case "ALTER_WORLD_SCENE": return `${f.place}此处留下一处改动，写清改了什么`;
    default: return f.op;
  }
};

export function buildRoadEventNote(roll) {
  const event = ROAD_EVENT_BY_ID[roll.eventId];
  const category = ROAD_EVENT_CATEGORIES[event.cat];
  const opts = roll.options.map((o, i) => `${i + 1}. ${o.label}`).join("　");
  return [
    `\n[系统裁决：本次移动途中触发路遇「${category.name}·${event.name}」]`,
    ROAD_EVENT_RULES,
    category.prompt,
    `【本事件情节核】${event.seed}`,
    `【来人】${describeCast(roll.cast)}`,
    `【这一段只写到抉择之前】写出照面与处境，停在主角要做决定的那一刻，不替主角选，不写结果。结尾列出可行之事：${opts}。`,
  ].join("\n");
}

export function buildResolutionNote(roll, outcome) {
  const event = ROAD_EVENT_BY_ID[roll.eventId];
  const category = ROAD_EVENT_CATEGORIES[event.cat];
  const option = roll.options.find((o) => o.key === outcome.optionKey);
  const verdict = outcome.success == null ? "主角选择离开，此事就此别过" : outcome.success ? "检定成功" : "检定失败";
  const facts = outcome.facts.length ? outcome.facts.map((f) => `· ${describeFact(f)}`).join("\n") : "· 无得失";
  return [
    `\n[系统裁决：路遇「${category.name}·${event.name}」结算]`,
    ROAD_EVENT_RULES,
    category.prompt,
    `【本事件情节核】${event.seed}`,
    `【来人】${describeCast(roll.cast)}`,
    `【主角的选择】${option?.label || "离开"}（${verdict}）`,
    `【已定事实】\n${facts}`,
    outcome.facts.some((f) => f.warrant) ? "【天机券填空】在尾章 SEAL 里为每件待命名之物给出名字与一句描述，贴合来人与地域，不得超出所给品阶。" : "",
  ].filter(Boolean).join("\n");
}
