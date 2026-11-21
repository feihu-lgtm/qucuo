import {
  CONNECTOR_FAMILIES,
  DUEL_HP_BANDS,
  DUEL_MOVE_TYPES,
  EFFECT_POOLS,
  MUTUAL_CONTACTS,
  OPENING_POOLS,
  REACTION_POOLS,
  STANDOFF_FRAGMENTS,
} from "./duelPhrases/index.js";
import { resolveMatchupRule } from "./moveTypes.js";
import { STATUS_EFFECTS, STATUS_GROUP } from "./statusEffects.js";
import { renderPromptTemplate as resolveDuelReportTemplate } from "../prompt/promptRefs.js";

export { resolveDuelReportTemplate };

function normalizeMoveType(type) {
  return DUEL_MOVE_TYPES.includes(type) ? type : "状态";
}

const hash = (value) => [...String(value)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
const USED_FRAGMENTS = Symbol("usedFragments");
const cleanClause = (value) => value.replace(/^[，,。！？；：、]+|[，,。！？；：、]+$/g, "");

export function selectUnused(pool, key, seed, used) {
  const indices = used.get(key) || new Set();
  const fragments = used.get(USED_FRAGMENTS) || new Set();
  const start = hash(`${seed}:${key}`) % pool.length;
  for (let offset = 0; offset < pool.length; offset += 1) {
    const index = (start + offset) % pool.length;
    if (!indices.has(index) && !fragments.has(pool[index])) {
      indices.add(index);
      fragments.add(pool[index]);
      used.set(key, indices);
      used.set(USED_FRAGMENTS, fragments);
      return pool[index];
    }
  }
  indices.clear();
  for (const fragment of pool) fragments.delete(fragment);
  indices.add(start);
  fragments.add(pool[start]);
  used.set(key, indices);
  used.set(USED_FRAGMENTS, fragments);
  return pool[start];
}

const tags = ["A", "B"];
function getSide(entry, tag) {
  const player = tag === "A";
  const result = entry.result || {};
  return {
    tag,
    name: result[`name${tag}`] || (player ? "你" : "对手"),
    move: player ? entry.playerMove : entry.npcMove,
    targetTag: player ? "B" : "A",
  };
}

function effectFamily(entry, actor, target) {
  const result = entry.result || {};
  const move = actor.move || {};
  const rule = resolveMatchupRule(
    entry.playerMove || { type: result.moveTypeA },
    entry.npcMove || { type: result.moveTypeB },
  );
  if (result[`reflected${actor.tag}`]) return "reflected";
  if (result[`interrupted${actor.tag}`] || result[`cancelled${actor.tag}`]) {
    return result.counterStatus === "control" ? "controlInterrupted" : "interrupted";
  }
  if (result.counterStatus === "reflect" && move.type === "状态" && result[`reflected${target.tag}`]) return "reflectCounter";
  if (result.counterStatus === "control" && result.speedWinner === actor.tag && move.type === "状态") return "controlPreempt";
  if (result[`dodgeSuccess${actor.tag}`]) return "dodged";
  if (result[`statusAppliedTo${target.tag}`] || result[`markAppliedTo${target.tag}`]) {
    const applied = result[`statusAppliedTo${target.tag}`];
    const appliedName = typeof applied === "string" ? applied : applied?.name;
    return result.counterStatus === "control" || STATUS_EFFECTS[appliedName]?.group === STATUS_GROUP.CONTROL
      ? "controlLanded"
      : "statusApplied";
  }
  if (Number(result[`hpRestore${actor.tag}`]) > 0) return "heal";
  if (Number(result[`statusDamage${actor.tag}`]) > 0) return "dot";
  if (rule.resolve === "standoff") return "nothing";
  if (move.type === "攻击" && target.move?.type === "防御") return "blocked";
  if (Number(result[`damageTo${target.tag}`]) > 0) return "hit";
  return "nothing";
}

function orderedSides(entry) {
  const result = entry.result || {};
  let first = result.speedWinner;
  const rule = resolveMatchupRule(
    entry.playerMove || { type: result.moveTypeA },
    entry.npcMove || { type: result.moveTypeB },
  );
  if (!first && result.interruptedA) first = "B";
  if (!first && result.interruptedB) first = "A";
  if (!first && rule.winner !== "tie") first = rule.winner;
  return first === "B" ? [getSide(entry, "B"), getSide(entry, "A")] : [getSide(entry, "A"), getSide(entry, "B")];
}

function fillFighterHalf(entry, actor, target, used, round) {
  const result = entry.result || {};
  const family = effectFamily(entry, actor, target);
  const move = actor.move || {};
  const openingType = normalizeMoveType(move.type);
  const opening = selectUnused(OPENING_POOLS[openingType], `opening:${openingType}`, round, used);
  let effect = selectUnused(EFFECT_POOLS[family], `effect:${family}`, round, used);
  effect = effect
    .replaceAll(
      "@round.result.statusAppliedToB",
      `@round.result.${result[`statusAppliedTo${target.tag}`] ? "statusAppliedTo" : "markAppliedTo"}${target.tag}`,
    )
    .replaceAll("@round.result.hpRestoreA", `@round.result.hpRestore${actor.tag}`)
    .replaceAll("@round.result.statusDamageA", `@round.result.statusDamage${actor.tag}`);
  const selfReaction = ["dodged", "heal", "dot", "interrupted", "controlInterrupted", "reflected", "reflectCounter"].includes(family);
  const reactedSide = selfReaction ? actor : target;
  const targetStatusApplied = result[`statusAppliedTo${target.tag}`] || result[`markAppliedTo${target.tag}`];
  const reactionFamily = family === "dodged" ? "dodged"
    : family === "heal" ? "recovered"
      : family === "controlLanded" || (family === "controlPreempt" && targetStatusApplied) ? "controlled"
        : selfReaction
          ? Number(result[`damageTo${actor.tag}`]) > 0 || Number(result[`statusDamage${actor.tag}`]) > 0 ? "damaged" : null
          : Number(result[`damageTo${target.tag}`]) > 0 || Number(result[`statusDamage${target.tag}`]) > 0 ? "damaged"
            : null;
  let reaction = "";
  if (reactionFamily) {
    const reportedBand = result[`hpBand${reactedSide.tag}`];
    const hpBand = DUEL_HP_BANDS.includes(reportedBand) ? reportedBand : "healthy";
    const pool = REACTION_POOLS[reactionFamily][hpBand];
    reaction = cleanClause(selectUnused(pool, `reaction:${reactionFamily}:${hpBand}`, round, used).replaceAll("{target}", reactedSide.name));
  }
  const roundScope = { round: entry };
  const values = {
    actor: actor.name,
    target: target.name,
    move: move.name || result[`moveName${actor.tag}`] || "未明招式",
    targetMove: target.move?.name || result[`moveName${target.tag}`] || "未明招式",
  };
  const template = [opening, effect, reaction].map(cleanClause).filter(Boolean).join("，");
  const filled = template.replace(/\{(actor|target|move|targetMove)\}/g, (_, key) => values[key] || "");
  return resolveDuelReportTemplate(filled, roundScope).text;
}

export function connectorFamily(first, second) {
  if (["interrupted", "controlInterrupted", "controlPreempt"].some((family) => [first, second].includes(family))) return "preempt";
  if (["reflected", "reflectCounter", "blocked"].some((family) => [first, second].includes(family))) return "contrast";
  if (first === "hit" && second === "hit") return "simultaneous";
  if (first === "dodged" || second === "dodged") return "exchange";
  return "sequential";
}

function soloRound(entry, round, used = new Map()) {
  const [first, second] = orderedSides(entry);
  const familyA = effectFamily(entry, first, second);
  const familyB = effectFamily(entry, second, first);
  const firstText = fillFighterHalf(entry, first, second, used, round);
  const secondText = fillFighterHalf(entry, second, first, used, round);
  const connectorKey = connectorFamily(familyA, familyB);
  const connector = selectUnused(CONNECTOR_FAMILIES[connectorKey], `connector:${connectorKey}`, round, used);
  const bothDefense = first.move?.type === "防御" && second.move?.type === "防御";
  const contact = bothDefense
    ? selectUnused(STANDOFF_FRAGMENTS, "standoff", round, used)
    : familyA === "hit" && familyB === "hit"
      ? selectUnused(MUTUAL_CONTACTS, "mutual", round, used)
      : "";
  const result = entry.result || {};
  const damage = tags.map((tag) => {
    const moveDamage = Number(result[`damageTo${tag}`]) || 0;
    const dotDamage = Number(result[`statusDamage${tag}`]) || 0;
    if (moveDamage <= 0 && dotDamage <= 0) return "";
    const band = result[`hpBand${tag}`];
    const rest = band === "nearDown" ? `，剩 @round.result.hpAfter${tag}.0` : "";
    const name = result[`name${tag}`] || (tag === "A" ? "你" : "对手");
    const move = moveDamage > 0 ? `${name} −@round.result.damageTo${tag}` : "";
    const dot = dotDamage > 0 ? `${name} 持续伤害 @round.result.statusDamage${tag}` : "";
    return `${[move, dot].filter(Boolean).join("，")}${rest}`;
  }).filter(Boolean);
  const status = tags.map((tag) => result[`statusAppliedTo${tag}`]
    ? `${result[`name${tag}`] || (tag === "A" ? "你" : "对手")} 状态 @round.result.statusAppliedTo${tag}（@round.result.statusSlotsAfter${tag}）`
    : "").filter(Boolean);
  const heals = tags.map((tag) => Number(result[`hpRestore${tag}`]) > 0
    ? `${result[`name${tag}`] || (tag === "A" ? "你" : "对手")} +@round.result.hpRestore${tag}`
    : "").filter(Boolean);
  const contactText = contact
    ? contact
      .replaceAll("{actor}", result.nameA || "你")
      .replaceAll("{target}", result.nameB || "对手")
      .replaceAll("{move}", entry.playerMove?.name || result.moveNameA || "未明招式")
      .replaceAll("{targetMove}", entry.npcMove?.name || result.moveNameB || "未明招式")
    : "";
  const sentence = [firstText, connector, contactText, secondText].map(cleanClause).filter(Boolean).join("，")
    + ([...damage, ...status, ...heals].length ? `（${[...damage, ...status, ...heals].join("，")}）` : "");
  return { round, text: resolveDuelReportTemplate(sentence, { round: entry }).text };
}

export function selectDuelPhrase(moveType, outcome, band, round = 1) {
  const family = ({
    bothHit: "hit", control: "controlLanded", dot: "dot", heal: "heal",
  })[outcome] || outcome;
  const pool = EFFECT_POOLS[family] || EFFECT_POOLS.nothing;
  const type = normalizeMoveType(moveType);
  const hpBand = DUEL_HP_BANDS.includes(band) ? band : "healthy";
  const seed = Math.max(1, Number(round) || 1);
  return pool[hash(`${type}:${hpBand}:${seed}`) % pool.length];
}

export function formatDuelDisplayLine(entry, { round = 1 } = {}) {
  return soloRound(entry, round).text;
}

function teamRound(entries, round) {
  const teamText = entries.map((entry) => entry.teamText).filter(Boolean).join("；");
  const worse = [...new Set(entries.map((entry) => entry.result?.worseName).filter((name) => name && name !== "平手"))];
  const text = `${teamText}${worse.length ? `（${worse.join("、")}吃亏）` : ""}`;
  return {
    round,
    text,
    teamLines: entries,
  };
}

export function buildDuelReportRounds(battleLog) {
  if (!Array.isArray(battleLog) || !battleLog.length) return [];
  const used = new Map();
  const grouped = new Map();
  for (const entry of battleLog) {
    if (!entry?.round) continue;
    const group = grouped.get(entry.round) || [];
    group.push(entry);
    grouped.set(entry.round, group);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([round, entries]) => entries.some((entry) => entry.teamText)
      ? teamRound(entries, round)
      : { ...entries[0], ...soloRound(entries[0], round, used) });
}

const SOLO_ROUND_TEMPLATE = "【第@round.round回合】玩家@round.result.nameA为A，@round.result.nameB为B；招式：@round.playerMove.name（@round.playerMove.type）对@round.npcMove.name（@round.npcMove.type）；招式伤害：A @round.result.damageToA、B @round.result.damageToB；持续伤害：A @round.result.statusDamageA、B @round.result.statusDamageB；疗伤：A @round.result.hpRestoreA、B @round.result.hpRestoreB；闪避：A @round.result.dodgeSuccessA、B @round.result.dodgeSuccessB；回合后气血：A @round.result.hpAfterA、B @round.result.hpAfterB；HP带：A @round.result.hpBandA、B @round.result.hpBandB；施加状态：A @round.result.statusAppliedToA、B @round.result.statusAppliedToB；印记：A @round.result.markAppliedToA、B @round.result.markAppliedToB；当前状态：A @round.result.statusSlotsAfterA、B @round.result.statusSlotsAfterB；状态日志：A @round.result.statusLogA、B @round.result.statusLogB；本轮吃亏：@round.result.worseName。";
const TEAM_ROUND_TEMPLATE = "【第@round.round回合】团战逐次交锋的引擎结果与战后状态：@round.teamLines";

export function renderDuelReportRounds(rounds) {
  const missingPaths = [];
  const rendered = rounds.map((round) => {
    const hasNotes = Array.isArray(round.result?.notes) ? round.result.notes.length > 0 : Boolean(round.result?.notes);
    const template = Array.isArray(round.teamLines)
      ? TEAM_ROUND_TEMPLATE
      : `${SOLO_ROUND_TEMPLATE}${hasNotes ? " 引擎备注：@round.result.notes" : ""}`;
    const result = resolveDuelReportTemplate(template, { round });
    missingPaths.push(...result.missingPaths.map((path) => `第${round.round}回合 @${path}`));
    return result.text;
  });
  return { text: rendered.join("\n"), missingPaths };
}

function narrativeParts(narrativeSegments) {
  if (Array.isArray(narrativeSegments)) {
    return narrativeSegments.map((part) => String(part ?? "").trim()).filter(Boolean);
  }
  if (typeof narrativeSegments !== "string") return [];
  return narrativeSegments.trim().split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
}

function markedSegments(rounds, narrativeSegments) {
  const parts = narrativeParts(narrativeSegments);
  if (parts.length !== rounds.length + 1) return null;
  const parsed = [];
  for (let index = 0; index < rounds.length; index += 1) {
    const match = parts[index].match(/^【第(\d+)回合】\s*([\s\S]*)$/);
    if (!match || Number(match[1]) !== Number(rounds[index].round)) return null;
    parsed.push(match[2].trim());
  }
  const ending = parts.at(-1).match(/^【结局】\s*([\s\S]*)$/);
  if (!ending) return null;
  return [...parsed, ending[1].trim()];
}

function systemRoundLogs(rounds) {
  return rounds.map((round) => ({ t: "sys", text: `  第${round.round}回合 ${round.text}` }));
}

export function interleaveDuelReport(rounds, narrativeSegments) {
  const settledRounds = Array.isArray(rounds) ? rounds : [];
  const systemLines = systemRoundLogs(settledRounds);
  const parsed = markedSegments(settledRounds, narrativeSegments);
  if (!parsed) {
    const unchanged = typeof narrativeSegments === "string"
      ? narrativeSegments
      : (Array.isArray(narrativeSegments) ? narrativeSegments.map((part) => String(part ?? "")).join("\n") : "");
    return [
      ...systemLines,
      ...(unchanged ? [{ t: "desc", text: unchanged }] : []),
    ];
  }
  const logs = [];
  for (let index = 0; index < settledRounds.length; index += 1) {
    logs.push(systemLines[index], { t: "desc", text: parsed[index] });
  }
  logs.push({ t: "desc", text: parsed.at(-1) });
  return logs;
}
