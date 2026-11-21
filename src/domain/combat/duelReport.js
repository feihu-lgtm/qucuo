import { DUEL_MOVE_TYPES, DUEL_PHRASE_BANK, hpBandFor } from "./duelPhrases/index.js";

const BAND_LABELS = { healthy: "健旺", hurt: "受创", nearDown: "将倒" };
const BAND_SEVERITY = { healthy: 0, hurt: 1, nearDown: 2 };

function readHp(entry, side) {
  const value = entry[`hpAfter${side}`];
  if (Array.isArray(value)) return value;
  const current = entry[`hpAfter${side}Current`];
  const maximum = entry[`hpAfter${side}Max`];
  return Number.isFinite(current) && Number.isFinite(maximum) ? [current, maximum] : null;
}

function effectsFromSlots(slots) {
  if (!slots || typeof slots !== "object") return [];
  return Object.entries(slots)
    .filter(([, value]) => value)
    .map(([key, value]) => typeof value === "string" ? value : value.name || key);
}

function statusList(entry, side) {
  const applied = entry[`statusAppliedTo${side}`];
  const marked = entry[`markAppliedTo${side}`];
  const active = effectsFromSlots(entry[`statusSlotsAfter${side}`]);
  const logs = entry[`statusLog${side}`] || [];
  return [...new Set([
    ...(applied ? [typeof applied === "string" ? applied : applied.name] : []),
    ...(marked ? [marked.name || "印记"] : []),
    ...active,
    ...logs.map((line) => typeof line === "string" ? line : line?.text).filter(Boolean),
  ])];
}

function normalizeMoveType(type) {
  return DUEL_MOVE_TYPES.includes(type) ? type : "状态";
}

function makeOutcome(entry, playerName, npcName) {
  const playerDamage = Math.max(0, (entry.dmgToPlayer ?? entry.damageToA ?? 0) + (entry.statusDamageToPlayer ?? entry.statusDamageA ?? 0));
  const npcDamage = Math.max(0, (entry.dmgToNpc ?? entry.damageToB ?? 0) + (entry.statusDamageToNpc ?? entry.statusDamageB ?? 0));
  const playerMove = entry.playerMove || entry.moveNameA || "未明招式";
  const npcMove = entry.npcMove || entry.moveNameB || "未明招式";
  const playerType = normalizeMoveType(entry.playerMoveType || entry.moveTypeA);
  const npcType = normalizeMoveType(entry.npcMoveType || entry.moveTypeB);
  const playerHp = readHp(entry, "Player") || readHp(entry, "A");
  const npcHp = readHp(entry, "Npc") || readHp(entry, "B");
  const worse = playerDamage === npcDamage ? "平手" : playerDamage > npcDamage ? playerName : npcName;

  let actorName = playerName;
  let targetName = npcName;
  let actorMove = playerMove;
  let targetMove = npcMove;
  let moveType = playerType;
  let outcome = "hit";

  if (entry.dodgeSuccessPlayer || entry.dodgeSuccessA || entry.dodgeSuccessNpc || entry.dodgeSuccessB) {
    const playerDodged = entry.dodgeSuccessPlayer || entry.dodgeSuccessA;
    actorName = playerDodged ? playerName : npcName;
    targetName = playerDodged ? npcName : playerName;
    actorMove = playerDodged ? playerMove : npcMove;
    targetMove = playerDodged ? npcMove : playerMove;
    moveType = playerDodged ? playerType : npcType;
    outcome = "dodged";
  } else if (playerDamage > 0 && npcDamage > 0) {
    const playerBand = hpBandFor(playerHp);
    const npcBand = hpBandFor(npcHp);
    if (npcDamage > playerDamage || (npcDamage === playerDamage && BAND_SEVERITY[npcBand] > BAND_SEVERITY[playerBand])) {
      actorName = playerName; targetName = npcName;
      actorMove = playerMove; targetMove = npcMove; moveType = playerType;
    } else {
      actorName = npcName; targetName = playerName;
      actorMove = npcMove; targetMove = playerMove; moveType = npcType;
    }
    outcome = "bothHit";
  } else if (npcDamage > 0) {
    actorName = playerName; targetName = npcName;
    actorMove = playerMove; targetMove = npcMove; moveType = playerType;
    outcome = npcType === "防御" ? "blocked" : "hit";
  } else if (playerDamage > 0) {
    actorName = npcName; targetName = playerName;
    actorMove = npcMove; targetMove = playerMove; moveType = npcType;
    outcome = playerType === "防御" ? "blocked" : "hit";
  } else {
    outcome = "heal";
    if (entry.hpRestoreNpc || entry.hpRestoreB || entry.statusAppliedToNpc || entry.statusAppliedToB) {
      actorName = npcName; targetName = npcName; actorMove = npcMove; targetMove = playerMove; moveType = npcType;
    } else {
      targetName = playerName;
    }
  }

  const damagedBands = [];
  if (playerDamage > 0) damagedBands.push(hpBandFor(playerHp));
  if (npcDamage > 0) damagedBands.push(hpBandFor(npcHp));
  const band = damagedBands.sort((a, b) => BAND_SEVERITY[b] - BAND_SEVERITY[a])[0] || "healthy";
  return {
    playerDamage, npcDamage, playerMove, npcMove, playerType, npcType, playerHp, npcHp,
    playerName, npcName, worse, actorName, targetName, actorMove, targetMove, moveType, outcome, band,
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

function damagePart(name, damage, hp) {
  if (damage <= 0) return null;
  const remaining = hp && hpBandFor(hp) === "nearDown" ? `，剩 ${hp[0]}` : "";
  return `${name} −${damage}${remaining}`;
}

function soloRound(entry, round, playerName, npcName) {
  const data = makeOutcome(entry, playerName, npcName);
  const text = fillTemplate(selectDuelPhrase(data.moveType, data.outcome, data.band, round), {
    actor: data.actorName,
    target: data.targetName,
    move: data.actorMove,
    targetMove: data.targetMove,
  });
  const damages = [
    damagePart(playerName, data.playerDamage, data.playerHp),
    damagePart(npcName, data.npcDamage, data.npcHp),
  ].filter(Boolean);
  const displayText = `${text}${damages.length ? `（${damages.join("，")}）` : ""}`;
  const hpText = (name, hp) => `${name} ${hp ? `${hp[0]}/${hp[1]}` : "未记录"}`;
  const bandText = [
    data.playerDamage > 0 ? `${playerName}：${BAND_LABELS[hpBandFor(data.playerHp)]}` : null,
    data.npcDamage > 0 ? `${npcName}：${BAND_LABELS[hpBandFor(data.npcHp)]}` : null,
  ].filter(Boolean).join("，") || "本轮无人受创";
  const statusText = [
    ...statusList(entry, "Player"),
    ...statusList(entry, "Npc"),
    ...statusList(entry, "A"),
    ...statusList(entry, "B"),
    ...(entry.notes || []),
  ];
  const aiData = `第${round}回合：${playerName}用【${data.playerMove}/${data.playerType}】，${npcName}用【${data.npcMove}/${data.npcType}】；回合后气血：${hpText(playerName, data.playerHp)}，${hpText(npcName, data.npcHp)}；${bandText}；受到伤害：${playerName} ${data.playerDamage}，${npcName} ${data.npcDamage}；状态：${[...new Set(statusText)].join("、") || "无"}；本轮吃亏：${data.worse}。`;
  return { round, text: displayText, aiData, disadvantage: data.worse };
}

export function formatDuelDisplayLine(entry, { round = 1, playerName = "你", npcName = "对手" } = {}) {
  return soloRound(entry, round, playerName, npcName).text;
}

export function createDuelRoundMetadata(result, endTick, hpAfterPlayer, hpAfterNpc) {
  return {
    playerMoveType: result.moveTypeA, npcMoveType: result.moveTypeB,
    dmgToNpc: result.damageToB, dmgToPlayer: result.damageToA,
    statusDamageToPlayer: endTick.statusDamageA, statusDamageToNpc: endTick.statusDamageB,
    hpAfterPlayer, hpAfterNpc,
    statusAppliedToPlayer: result.statusAppliedToA, statusAppliedToNpc: result.statusAppliedToB,
    markAppliedToPlayer: result.markAppliedToA, markAppliedToNpc: result.markAppliedToB,
    statusSlotsAfterPlayer: endTick.statusSlotsA, statusSlotsAfterNpc: endTick.statusSlotsB,
    statusLogPlayer: endTick.logA || [], statusLogNpc: endTick.logB || [],
  };
}

function teamRound(entries, round) {
  const teamText = entries.map((entry) => entry.teamText).filter(Boolean).join("；");
  const worse = [...new Set(entries.map((entry) => entry.worseName).filter(Boolean))];
  const text = `${teamText}${worse.length ? `（${worse.join("、")}吃亏）` : ""}`;
  const details = entries.map((entry) => {
    const actorHp = entry.hpAfterActor;
    const targetHp = entry.hpAfterTarget;
    const actorDamage = (entry.dmgToActor || 0) + (entry.statusDamageToActor || 0);
    const targetDamage = (entry.dmgToTarget || 0) + (entry.statusDamageToTarget || 0);
    const statusText = [
      ...effectsFromSlots(entry.statusSlotsAfterActor),
      ...effectsFromSlots(entry.statusSlotsAfterTarget),
      ...(entry.statusLog || []).map((line) => typeof line === "string" ? line : line?.text).filter(Boolean),
    ];
    return `${entry.actorName || "一方"}用【${entry.actorMove || "未明招式"}/${entry.actorMoveType || "未知"}】，${entry.targetName || "另一方"}用【${entry.targetMove || "未明招式"}/${entry.targetMoveType || "未知"}】；回合后气血：${entry.actorName || "一方"} ${actorHp ? `${actorHp[0]}/${actorHp[1]}` : "未记录"}，${entry.targetName || "另一方"} ${targetHp ? `${targetHp[0]}/${targetHp[1]}` : "未记录"}；伤害：${entry.actorName || "一方"} ${actorDamage}，${entry.targetName || "另一方"} ${targetDamage}；状态：${[...new Set(statusText)].join("、") || "无"}`;
  }).join("；");
  return {
    round,
    text,
    aiData: `第${round}回合团战：${teamText || "无交锋记录"}；${details}；本轮吃亏：${worse.join("、") || "平手"}。`,
    disadvantage: worse.join("、") || "平手",
  };
}

export function buildDuelReportRounds(battleLog, { playerName = "你", npcName = "对手" } = {}) {
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
      : soloRound(entries[0], round, playerName, npcName));
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
