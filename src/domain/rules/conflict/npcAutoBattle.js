import { getRngState, setRngState, setSeed } from "../../../utils/rng.js";
import { getBuiltinNpcId } from "../../data/factions/npcFactions.js";
import { buildEnemyUnit } from "../combat/teamUnits.js";
import { runTeamTurn, decideUnitMove, decideUnitTarget, checkBattleOver } from "../combat/teamBattleEngine.js";

const MINION_IDS = new Set(["resident_xuedao_chuqi", "resident_xuedao_shisan", "resident_xuedao_niansan"]);

const toUnit = (side) => (npc) => ({
  ...buildEnemyUnit(npc),
  side,
  canDie: MINION_IDS.has(getBuiltinNpcId(npc)),
});

function decideIntents(actors, opponents) {
  const intents = Object.create(null);
  const targets = opponents.filter((u) => u.alive);
  for (const unit of actors.filter((u) => u.alive)) {
    const move = decideUnitMove(unit, {
      npcHistory: unit.history, npcEnergy: unit.energy[0], forbidDefense: unit.defenseBroken,
    });
    if (move) intents[unit.id] = { move, targetId: decideUnitTarget(targets) };
  }
  return intents;
}

const withHistory = (units, movesUsed) => units.map((u) => (movesUsed.has(u.id)
  ? { ...u, history: [...u.history, movesUsed.get(u.id)] }
  : u));

const hpRatio = (units) => units.reduce((sum, u) => sum + Math.max(0, u.hp[0]) / (u.hp[1] || 1), 0);

function settle(units, lethal) {
  const injuries = [];
  const deaths = [];
  for (const u of units) {
    const npc = { id: u.id, name: u.name };
    if (!u.alive) {
      if (lethal === "minions" && u.canDie) deaths.push(npc);
      else injuries.push({ ...npc, severity: "重伤" });
    } else if (u.hp[0] < u.hp[1] / 2) {
      injuries.push({ ...npc, severity: "轻伤" });
    }
  }
  return { injuries, deaths };
}

function resolveBattle(sideA, sideB, lethal, maxRounds) {
  let unitsA = sideA.map(toUnit("ally"));
  let unitsB = sideB.map(toUnit("enemy"));
  const rounds = [];
  let outcome = null;
  while (!outcome && rounds.length < maxRounds) {
    const intents = { ...decideIntents(unitsA, unitsB), ...decideIntents(unitsB, unitsA) };
    const { updatedAlly, updatedEnemy, turnLog } = runTeamTurn(unitsA, unitsB, intents);
    const movesUsed = new Map();
    for (const entry of turnLog) {
      if (entry.skipped) continue;
      movesUsed.set(entry.actor.id, entry.actor.move.type);
      if (entry.target.move) movesUsed.set(entry.target.id, entry.target.move.type);
    }
    unitsA = withHistory(updatedAlly, movesUsed);
    unitsB = withHistory(updatedEnemy, movesUsed);
    rounds.push(turnLog);
    outcome = checkBattleOver(unitsA, unitsB);
  }
  let winner;
  if (outcome === "win") winner = "A";
  else if (outcome === "lose") winner = "B";
  else if (outcome === "draw") winner = null;
  else {
    const a = hpRatio(unitsA) / unitsA.length;
    const b = hpRatio(unitsB) / unitsB.length;
    winner = a === b ? null : a > b ? "A" : "B";
  }
  const a = settle(unitsA, lethal);
  const b = settle(unitsB, lethal);
  return {
    winner,
    rounds: rounds.length,
    injuries: [...a.injuries, ...b.injuries],
    deaths: [...a.deaths, ...b.deaths],
    log: rounds,
    finalHp: Object.fromEntries([...unitsA, ...unitsB].map((u) => [u.id, [Math.max(0, u.hp[0]), u.hp[1]]])),
  };
}

// 接收已固化的 NPC 战斗数据，只输出战果，不改存档。到回合上限按平均剩余血量比例判胜负。
export function resolveNpcConflict({ sideA, sideB, seed, lethal = "none", maxRounds = 20 }) {
  if (!Number.isInteger(seed) || seed !== (seed >>> 0)) throw new RangeError("冲突种子须为 32 位无符号整数");
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1 || maxRounds > 100) throw new RangeError("冲突回合上限须在 1 到 100 之间");
  if (lethal !== "none" && lethal !== "minions") throw new RangeError("未知的冲突伤亡规则");
  if (![sideA, sideB].every((side) => Array.isArray(side) && side.length >= 1 && side.length <= 2)) {
    throw new RangeError("冲突每方须有 1 到 2 名参战者");
  }
  const ids = new Set();
  for (const npc of [...sideA, ...sideB]) {
    const id = getBuiltinNpcId(npc) ?? npc?.id;
    if (typeof id !== "string" || !id || ids.has(id) || !Array.isArray(npc.moveset) || !npc.moveset.some(Boolean)) {
      throw new TypeError("参战 NPC 须有唯一 ID 和可用招式");
    }
    const [hp, maxHp] = npc.combatStats?.hp ?? [];
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || hp <= 0 || hp > maxHp) {
      throw new TypeError("参战 NPC 须有有效且大于零的气血");
    }
    ids.add(id);
  }

  // 回合引擎用共享 RNG；同步结算后恢复，避免改变玩家的后续随机结果。
  const previous = getRngState();
  setSeed(seed);
  try {
    return resolveBattle(sideA, sideB, lethal, maxRounds);
  } finally {
    setRngState(previous);
  }
}
