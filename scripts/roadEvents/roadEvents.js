// 路遇随机事件 · 系统侧（纯函数，rng 由调用方注入，可重放）
// ------------------------------------------------------------------
// 分工与判官链一致：系统定事实，说书人写戏。
//   rollRoadEvent       进入节点时，从 400 件里按地头、时辰、前提、冷却与稀有度抽一件，定下来人。
//   buildRoadEventNote  第一段：把处境与三个可行之事交给说书人写出来，此时不结算。
//   resolveRoadEvent    第二段：玩家选了哪一项，系统掷检定、把奖励码解析成事实。
//   buildResolutionNote 第二段提示词：已定事实 + 天机券填空要求。
// 本模块不写状态；事实交给 materializeFacts 与 applyFactionRep 落账。
// 现阶段是设计稿：放在 scripts/ 下供审阅与校验，接线时整体移入 src/domain（见 docs/路遇随机事件设计.md）。
import {
  ROAD_EVENTS, ROAD_EVENT_BY_ID, ROAD_EVENT_CATEGORIES, PLACE_TAGS, ROAD_EVENT_RULES,
} from "./index.js";
import { calcDungeonCheckRate } from "../../src/domain/rules/dungeon/internal.js";
import { QUALITY } from "../../src/domain/rules/economy/equipment.js";
import { factionRepOf } from "../../src/domain/rules/economy/factionRep.js";

export const SIX_STATS = Object.freeze(["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"]);
export const ITEM_CATEGORY_CODE = Object.freeze({ 武器: "weapon", 护甲: "armor", 饰品: "accessory", 杂物: "misc" });

// 遭遇触发后，多少比例换成本表事件（其余仍是原来的势力过路人）。
export const ROAD_EVENT_SHARE = 0.6;
const TIER_WEIGHT = { 1: 10, 2: 4, 3: 1 };
const EVENT_COOLDOWN_DAYS = 10; // 同一件事十日内不重复
const CATEGORY_COOLDOWN_DAYS = 1; // 同一类事一日内不重复
const POSITIVE_CONDITIONS = new Set(["百毒不侵"]);
const LEDGER_KEY = "路遇";

const dayOf = (time) => Math.floor((Number(time) || 0) / 24);
const hourOf = (time) => (((Number(time) || 0) % 24) + 24) % 24;
export const isNight = (time) => { const h = hourOf(time); return h >= 19 || h < 5; };

function statOf(state, key) {
  const v = state?.char?.special?.[key] ?? state?.special?.[key];
  return Number.isFinite(v) ? v : 5;
}

function ledgerOf(state) {
  return state?.varTree?.世界?.[LEDGER_KEY] || {};
}

function rumorNames(state) {
  return Object.keys(state?.varTree?.世界?.传闻人物 || {});
}

// 「势力:身份:性别:年纪[:姓名]」→ 来人；「传闻」→ 从传闻人物里指定；auto → 无固定来人。
export function parseCast(cast) {
  if (!cast || cast === "auto") return null;
  if (cast === "传闻") return { rumor: true };
  const [faction, role, gender, age, name] = cast.split(":");
  return { faction, role, gender, age, ...(name ? { name } : {}) };
}

function placeMatches(event, destNode) {
  const tags = PLACE_TAGS[destNode] || [];
  return event.where.some((w) => w === destNode || tags.includes(w));
}

function reqMet(req, state) {
  if (!req) return true;
  const tree = state?.varTree || {};
  for (const [f, min] of Object.entries(req.rep || {})) if (factionRepOf(tree, f) < min) return false;
  for (const [f, max] of Object.entries(req.repBelow || {})) if (factionRepOf(tree, f) >= max) return false;
  for (const [k, min] of Object.entries(req.stat || {})) if (statOf(state, k) < min) return false;
  if (req.flag && !(state?.flags || []).includes(req.flag)) return false;
  if (req.notFlag && (state?.flags || []).includes(req.notFlag)) return false;
  if (req.rumor && rumorNames(state).length === 0) return false;
  return true;
}

// 这件事此刻能不能在 destNode 发生。
export function isEligible(event, state, destNode) {
  if (!placeMatches(event, destNode)) return false;
  const time = state?.time ?? 0;
  if (event.when === "夜" && !isNight(time)) return false;
  if (event.when === "昼" && isNight(time)) return false;
  if (!reqMet(event.req, state)) return false;
  const ledger = ledgerOf(state);
  const today = dayOf(time);
  if (event.once && ledger.done?.[event.id] != null) return false;
  const last = ledger.lastSeen?.[event.id];
  if (last != null && today - last < EVENT_COOLDOWN_DAYS) return false;
  const catLast = ledger.catSeen?.[event.cat];
  if (catLast != null && today - catLast < CATEGORY_COOLDOWN_DAYS) return false;
  // 招人入队的事件：已经在队里的同名人物不再重遇
  const cast = parseCast(event.cast);
  if (cast?.name && state?.companionState && Object.values(state.companionState).some((c) => c?.label === cast.name)) return false;
  return true;
}

export function eligibleEvents(state, destNode) {
  return ROAD_EVENTS.filter((e) => isEligible(e, state, destNode));
}

function weightOf(event, luck) {
  const base = TIER_WEIGHT[event.tier] || 1;
  return event.tier === 3 ? base * (1 + Math.max(0, luck - 5) * 0.1) : base;
}

// 抽一件事。返回 null 表示此地此刻没有合适的事（调用方回落为原来的势力过路人）。
export function rollRoadEvent(state, destNode, { rng = Math.random, luck = statOf(state, "气运") } = {}) {
  const pool = eligibleEvents(state, destNode);
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + weightOf(e, luck), 0);
  let r = rng() * total;
  let event = pool[pool.length - 1];
  for (const e of pool) { r -= weightOf(e, luck); if (r < 0) { event = e; break; } }
  let cast = parseCast(event.cast);
  if (cast?.rumor) {
    const names = rumorNames(state);
    cast = { rumor: true, name: names[Math.floor(rng() * names.length)] };
  }
  const category = ROAD_EVENT_CATEGORIES[event.cat];
  const options = [
    { key: "main", label: category.options.main, check: event.check, dc: event.dc,
      rate: event.check ? calcDungeonCheckRate(statOf(state, event.check), event.dc) : 100 },
    { key: "alt", label: category.options.alt, check: null, rate: 100 },
    { key: "leave", label: category.options.leave, check: null, rate: 100 },
  ];
  return { eventId: event.id, destNode, day: dayOf(state?.time), cast, options };
}

function rollQualityWith(luck, rng) {
  const g = Math.max(0, Math.min(10, luck)) / 10;
  const base = [50, 30, 10, 8, 1.5, 0.5];
  const peak = [0, 20, 20, 20, 20, 20];
  const dist = base.map((b, i) => b + (peak[i] - b) * g);
  let r = rng() * 100;
  for (let i = 0; i < dist.length; i++) { r -= dist[i]; if (r < 0) return QUALITY[i]; }
  return QUALITY[QUALITY.length - 1];
}

function resolveQuality(spec, luck, rng) {
  if (QUALITY.includes(spec)) return spec;
  const rolled = rollQualityWith(luck, rng);
  if (spec === "roll+1") return QUALITY[Math.min(QUALITY.length - 1, QUALITY.indexOf(rolled) + 1)];
  return rolled;
}

const num = (s) => Number(String(s).replace("+", ""));

// 一个奖励码 → 一条事实。未知码抛错，由测试兜住数据。
export function parseRewardCode(code, { cast, destNode, luck = 5, rng = Math.random } = {}) {
  const [head, ...rest] = code.split(":");
  const castName = cast?.name || cast?.role || "来人";
  switch (head) {
    case "silver": return { op: "CHANGE_VITALS_SILVER", moneyDelta: num(rest[0]) };
    case "hp": return { op: "CHANGE_VITALS_SILVER", hpDelta: num(rest[0]) };
    case "item": return { op: "GRANT_ITEM", warrant: true, category: ITEM_CATEGORY_CODE[rest[0]], quality: resolveQuality(rest[1], luck, rng) };
    case "skill": return { op: "BESTOW_SKILL", warrant: true, school: rest[0], quality: resolveQuality(rest[1], luck, rng), growthMode: rest[2] };
    case "stat": { const [, attr, d] = /^(.+?)([+-]\d+)$/.exec(rest[0] || "") || []; return { op: "SHIFT_SPECIAL_STAT", attr, delta: num(d) }; }
    case "exp": return { op: "PROGRESS_CULTIVATION", expDelta: num(rest[0]) };
    case "pot": return { op: "PROGRESS_CULTIVATION", potDelta: num(rest[0]) };
    case "rep": { const [, faction, d] = /^(.+?)([+-]\d+)$/.exec(rest.join(":")) || []; return { op: "FACTION_REP", faction, delta: num(d) }; }
    case "aff": return { op: "MUTATE_SOCIAL", npc: castName, affectionDelta: num(rest[0]) };
    case "ally": return { op: "SPAWN_COMPANION_CANDIDATE", npc: castName, cast, affectionPin: 40 };
    case "mate": return { op: "SPAWN_COMPANION_CANDIDATE", npc: castName, cast, affectionPin: 60, romance: true };
    case "beast": return { op: "SPAWN_COMPANION_CANDIDATE", npc: rest[0], beast: true, role: rest[1], affectionPin: 40 };
    case "cond": return { op: "APPLY_CONDITION", flag: rest[0], durationTurns: num(rest[1]), negative: !POSITIVE_CONDITIONS.has(rest[0]) };
    case "clue": return { op: "RUMOR_HOOK", npc: castName };
    case "pact": return { op: "BIND_OR_SETTLE_PACT", npc: castName };
    case "scene": return { op: "ALTER_WORLD_SCENE", place: destNode };
    default: throw new Error(`未知奖励码：${code}`);
  }
}

export function parseRewardCodes(str, ctx) {
  return String(str || "").split("|").map((s) => s.trim()).filter(Boolean).map((c) => parseRewardCode(c, ctx));
}

// 第二段：玩家选定一项后结算。主行动掷检定；次行动必成但收益较小；离开无事。
export function resolveRoadEvent(roll, optionKey, state, { rng = Math.random, luck = statOf(state, "气运") } = {}) {
  const event = ROAD_EVENT_BY_ID[roll.eventId];
  const ctx = { cast: roll.cast, destNode: roll.destNode, luck, rng };
  if (optionKey === "leave") return { optionKey, success: null, facts: [] };
  if (optionKey === "alt") return { optionKey, success: true, facts: parseRewardCodes(event.alt, ctx) };
  const rate = event.check ? calcDungeonCheckRate(statOf(state, event.check), event.dc) : 100;
  const success = rng() * 100 < rate;
  return { optionKey, success, rate, facts: parseRewardCodes(success ? event.win : event.lose, ctx) };
}

// 路遇账本的下一版（由调用方写回 varTree.世界.路遇）。
export function nextRoadLedger(state, roll) {
  const ledger = ledgerOf(state);
  const event = ROAD_EVENT_BY_ID[roll.eventId];
  return {
    ...ledger,
    lastSeen: { ...(ledger.lastSeen || {}), [event.id]: roll.day },
    catSeen: { ...(ledger.catSeen || {}), [event.cat]: roll.day },
    ...(event.once ? { done: { ...(ledger.done || {}), [event.id]: roll.day } } : {}),
  };
}

function describeCast(cast) {
  if (!cast) return "此事不必有固定来人；若情境需要旁人，可写一两个无名路人，但不得给他们起名或赋予后续戏份。";
  if (cast.rumor) return `来人系统已定：传闻人物「${cast.name}」。照传闻写他，此为传闻落地，不得改名。`;
  const who = `${cast.faction === "散人" ? "无门无派" : `隶属【${cast.faction}】`}的${cast.role}，${cast.gender}，${cast.age}岁上下`;
  return cast.name
    ? `来人系统已定：${cast.name}，${who}。照抄名字，加入 room.npcs，不要改名。`
    : `来人系统已定：${who}。名字由你起，须合其身份与地域，避开已认识的人。`;
}

const describeFact = (f) => {
  switch (f.op) {
    case "CHANGE_VITALS_SILVER": return f.moneyDelta != null ? `银两 ${f.moneyDelta > 0 ? "+" : ""}${f.moneyDelta}` : `气血 ${f.hpDelta}`;
    case "GRANT_ITEM": return `得一件${f.quality}品${{ weapon: "兵刃", armor: "护甲", accessory: "饰物", misc: "杂物" }[f.category]}（待命名）`;
    case "BESTOW_SKILL": return `得一门${f.quality}品${f.school === "any" ? "" : `${f.school}一路的`}武学（${f.growthMode === "独门" ? "完整传授" : "入门可成长"}，待命名）`;
    case "SHIFT_SPECIAL_STAT": return `${f.attr} ${f.delta > 0 ? "+" : ""}${f.delta}`;
    case "PROGRESS_CULTIVATION": return f.expDelta != null ? `江湖经验 +${f.expDelta}` : `潜能 +${f.potDelta}`;
    case "FACTION_REP": return `【${f.faction}】声誉 ${f.delta > 0 ? "+" : ""}${f.delta}`;
    case "MUTATE_SOCIAL": return `${f.npc}好感 ${f.affectionDelta > 0 ? "+" : ""}${f.affectionDelta}`;
    case "SPAWN_COMPANION_CANDIDATE": return f.beast ? `${f.npc}（${f.role}）愿意跟随，玩家可邀其同行` : `${f.npc}${f.romance ? "与主角投缘" : ""}愿意同行，玩家可邀其入队`;
    case "APPLY_CONDITION": return `挂状态「${f.flag}」${f.durationTurns} 回合`;
    case "RUMOR_HOOK": return "来人捎一句传闻，须点到一个新的具名人物并写进 mentionedNewNpcs";
    case "BIND_OR_SETTLE_PACT": return `与${f.npc}立下一个约定，写清何时何地`;
    case "ALTER_WORLD_SCENE": return `${f.place}此处留下一处改动，写清改了什么`;
    default: return f.op;
  }
};

// 第一段提示词：写出处境与三个可行之事，不结算。
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

// 第二段提示词：照已定事实写结果，并给天机券起名。
export function buildResolutionNote(roll, outcome) {
  const event = ROAD_EVENT_BY_ID[roll.eventId];
  const category = ROAD_EVENT_CATEGORIES[event.cat];
  const option = roll.options.find((o) => o.key === outcome.optionKey);
  const verdict = outcome.success == null ? "主角选择离开，此事就此别过" : outcome.success ? "检定成功" : "检定失败";
  const facts = outcome.facts.length ? outcome.facts.map((f) => `· ${describeFact(f)}`).join("\n") : "· 无得失";
  const needsName = outcome.facts.some((f) => f.warrant);
  return [
    `\n[系统裁决：路遇「${category.name}·${event.name}」结算]`,
    ROAD_EVENT_RULES,
    category.prompt,
    `【本事件情节核】${event.seed}`,
    `【来人】${describeCast(roll.cast)}`,
    `【主角的选择】${option?.label || "离开"}（${verdict}）`,
    `【已定事实】\n${facts}`,
    needsName ? "【天机券填空】在尾章 SEAL 里为每件待命名之物给出名字与一句描述，贴合来人与地域，不得超出所给品阶。" : "",
  ].filter(Boolean).join("\n");
}
