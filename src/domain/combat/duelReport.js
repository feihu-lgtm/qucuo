import { DUEL_MOVE_TYPES, DUEL_PHRASE_BANK } from "./duelPhrases/index.js";

function normalizeMoveType(type) {
  return DUEL_MOVE_TYPES.includes(type) ? type : "状态";
}

function makeOutcome(entry) {
  const result = entry.result || {};
  const playerName = result.nameA || "";
  const npcName = result.nameB || "";
  const playerMoveDamage = Math.max(0, result.damageToA || 0);
  const npcMoveDamage = Math.max(0, result.damageToB || 0);
  const playerDotDamage = Math.max(0, result.statusDamageA || 0);
  const npcDotDamage = Math.max(0, result.statusDamageB || 0);
  const playerMove = entry.playerMove?.name || "未明招式";
  const npcMove = entry.npcMove?.name || "未明招式";
  const playerType = normalizeMoveType(entry.playerMove?.type);
  const npcType = normalizeMoveType(entry.npcMove?.type);
  const playerHp = result.hpAfterA;
  const npcHp = result.hpAfterB;
  const playerBand = result.hpBandA;
  const npcBand = result.hpBandB;
  const playerAppliedControl = Boolean(result.statusAppliedToB || result.markAppliedToB);
  const npcAppliedControl = Boolean(result.statusAppliedToA || result.markAppliedToA);

  let actorName = playerName;
  let targetName = npcName;
  let actorMove = playerMove;
  let targetMove = npcMove;
  let moveType = playerType;
  let outcome = "hit";

  if (result.dodgeSuccessA || result.dodgeSuccessB) {
    const playerDodged = result.dodgeSuccessA;
    actorName = playerDodged ? playerName : npcName;
    targetName = playerDodged ? npcName : playerName;
    actorMove = playerDodged ? playerMove : npcMove;
    targetMove = playerDodged ? npcMove : playerMove;
    moveType = playerDodged ? playerType : npcType;
    outcome = "dodged";
  } else if (playerMoveDamage > 0 && npcMoveDamage > 0) {
    if (npcMoveDamage > playerMoveDamage) {
      actorName = playerName; targetName = npcName;
      actorMove = playerMove; targetMove = npcMove; moveType = playerType;
    } else {
      actorName = npcName; targetName = playerName;
      actorMove = npcMove; targetMove = playerMove; moveType = npcType;
    }
    outcome = "bothHit";
  } else if (npcMoveDamage > 0) {
    actorName = playerName; targetName = npcName;
    actorMove = playerMove; targetMove = npcMove; moveType = playerType;
    outcome = npcType === "防御" ? "blocked" : "hit";
  } else if (playerMoveDamage > 0) {
    actorName = npcName; targetName = playerName;
    actorMove = npcMove; targetMove = playerMove; moveType = npcType;
    outcome = playerType === "防御" ? "blocked" : "hit";
  } else if (playerAppliedControl || npcAppliedControl) {
    const playerApplied = playerAppliedControl;
    actorName = playerApplied ? playerName : npcName;
    targetName = playerApplied ? npcName : playerName;
    actorMove = playerApplied ? playerMove : npcMove;
    targetMove = playerApplied ? npcMove : playerMove;
    moveType = playerApplied ? playerType : npcType;
    outcome = "control";
  } else if ((playerDotDamage || npcDotDamage) && !(result.hpRestoreA || result.hpRestoreB)) {
    targetName = playerDotDamage > npcDotDamage ? playerName : npcName;
    actorName = "";
    actorMove = "";
    targetMove = "";
    moveType = "状态";
    outcome = "dot";
  } else {
    outcome = "heal";
    if (result.hpRestoreB > 0) {
      actorName = npcName; targetName = npcName; actorMove = npcMove; targetMove = playerMove; moveType = npcType;
    } else {
      actorName = playerName; targetName = playerName; actorMove = playerMove; targetMove = npcMove; moveType = playerType;
    }
  }

  const toneSubject = ["dodged", "heal"].includes(outcome) ? actorName : targetName;
  const band = toneSubject === playerName ? playerBand : npcBand;
  return {
    playerMoveDamage, npcMoveDamage, playerDotDamage, npcDotDamage,
    playerMove, npcMove, playerType, npcType, playerHp, npcHp,
    playerName, npcName, playerBand, npcBand, actorName, targetName, actorMove, targetMove, moveType, outcome, band,
  };
}

function fillTemplate(template, values) {
  return template.replace(/\{(actor|target|move|targetMove)\}/g, (_, key) => values[key] || "");
}

export function selectDuelPhrase(moveType, outcome, band, round = 1) {
  const templates = DUEL_PHRASE_BANK[normalizeMoveType(moveType)]?.[outcome]?.[band]
    || DUEL_PHRASE_BANK["状态"].hit.healthy;
  return templates[(Math.max(1, Number(round) || 1) - 1) % templates.length];
}

function damagePart(name, moveDamage, dotDamage, hp, band) {
  const damage = moveDamage + dotDamage;
  if (damage <= 0) return null;
  const remaining = Array.isArray(hp) && band === "nearDown" ? `，剩 ${hp[0]}` : "";
  const dot = dotDamage > 0 ? `，含持续伤害 ${dotDamage}` : "";
  return `${name} −${damage}${dot}${remaining}`;
}

function soloRound(entry, round) {
  const data = makeOutcome(entry);
  const playerName = data.playerName || "你";
  const npcName = data.npcName || "对手";
  const text = fillTemplate(selectDuelPhrase(data.moveType, data.outcome, data.band, round), {
    actor: data.actorName,
    target: data.targetName,
    move: data.actorMove,
    targetMove: data.targetMove,
  });
  const damages = [
    damagePart(playerName, data.playerMoveDamage, data.playerDotDamage, data.playerHp, data.playerBand),
    damagePart(npcName, data.npcMoveDamage, data.npcDotDamage, data.npcHp, data.npcBand),
  ].filter(Boolean);
  return { round, text: `${text}${damages.length ? `（${damages.join("，")}）` : ""}` };
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
      : { ...entries[0], ...soloRound(entries[0], round) });
}

const SOLO_ROUND_TEMPLATE = "【第@round.round回合】玩家@round.result.nameA为A，@round.result.nameB为B；招式：@round.playerMove.name（@round.playerMove.type）对@round.npcMove.name（@round.npcMove.type）；招式伤害：A @round.result.damageToA、B @round.result.damageToB；持续伤害：A @round.result.statusDamageA、B @round.result.statusDamageB；疗伤：A @round.result.hpRestoreA、B @round.result.hpRestoreB；闪避：A @round.result.dodgeSuccessA、B @round.result.dodgeSuccessB；回合后气血：A @round.result.hpAfterA、B @round.result.hpAfterB；HP带：A @round.result.hpBandA、B @round.result.hpBandB；施加状态：A @round.result.statusAppliedToA、B @round.result.statusAppliedToB；印记：A @round.result.markAppliedToA、B @round.result.markAppliedToB；当前状态：A @round.result.statusSlotsAfterA、B @round.result.statusSlotsAfterB；状态日志：A @round.result.statusLogA、B @round.result.statusLogB；本轮吃亏：@round.result.worseName。";
const TEAM_ROUND_TEMPLATE = "【第@round.round回合】团战逐次交锋的引擎结果与战后状态：@round.teamLines";

function displayReportValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.length === 2 && value.every(Number.isFinite) ? `${value[0]}/${value[1]}` : JSON.stringify(value);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function resolveDuelReportTemplate(template, data) {
  const missingPaths = [];
  const text = template.replace(/@([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/g, (_, path) => {
    let value = data;
    for (const part of path.split(".")) {
      if (value == null || !Object.prototype.hasOwnProperty.call(value, part)) {
        missingPaths.push(path);
        return "";
      }
      value = value[part];
    }
    return displayReportValue(value);
  });
  return { text, missingPaths: [...new Set(missingPaths)] };
}

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
