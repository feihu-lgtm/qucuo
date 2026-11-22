import { checkBattleOver, decideUnitMove, runTeamTurn } from "../../domain/rules/combat/teamBattleEngine.js";
import { buildEnemyUnit, buildPlayerUnit } from "../../domain/rules/combat/teamUnits.js";
import { MOVE_TYPE } from "../../domain/rules/combat/moveTypes.js";
import { ensureNpcCombatData } from "../../domain/rules/npc/npcGeneration.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { resolveCombatBuff } from "../../utils/buffSystem.js";
import { settleNpcDuel } from "../npc/settleDuel.js";

export function buildQuestFoe(choice, now = Date.now()) {
  const { name, tag, levelCap = 1 } = choice.combatNpc;
  return ensureNpcCombatData({
    id: `questfoe_${choice.flag}_${now}`,
    name, tag, levelCap, hostile: true, questBranchFlag: choice.flag,
  }, { levelCap });
}

export function autoFightQuestChoice(state, quest, label, now = Date.now()) {
  const choice = getLocalQuestStage(quest, state)?.choices?.find((entry) => entry.label === label);
  if (choice?.resolve !== "combat" || !choice.combatNpc) return null;
  const { char, inv, skills } = state;
  if (!(char?.hp?.[0] > 0) || !char.moveset?.length) {
    return { logs: [{ t: "sys", text: "须有可用招式和气血才能截货。" }] };
  }
  const npc = buildQuestFoe(choice, now);
  const combatBuff = resolveCombatBuff(char.pendingCombatBuff);
  let allies = [buildPlayerUnit({ playerChar: char, playerInv: inv, playerMoveset: char.moveset, combatBuff, playerSkills: skills })];
  let enemies = [buildEnemyUnit(npc)];
  const battleLog = [];
  let outcome;
  for (let round = 1; round <= 20 && !outcome; round++) {
    const intents = Object.fromEntries([allies[0], enemies[0]].map((unit) => {
      let move = decideUnitMove(unit, { npcHistory: unit.history, npcEnergy: unit.energy[0], forbidDefense: unit.defenseBroken });
      if (unit.id === "player" && combatBuff.moveMul && move?.type === MOVE_TYPE.ATTACK) {
        move = { ...move, baseDamageMultiplier: (move.baseDamageMultiplier ?? 1) + combatBuff.moveMul };
      }
      return [unit.id, { move }];
    }));
    const { updatedAlly, updatedEnemy } = runTeamTurn(allies, enemies, intents);
    allies = updatedAlly;
    enemies = updatedEnemy;
    battleLog.push({ round, teamText: `你使「${intents.player.move?.name ?? "未出招"}」，${npc.name}使「${intents[npc.id].move?.name ?? "未出招"}」。气血 ${allies[0].hp[0]} 对 ${enemies[0].hp[0]}。` });
    outcome = checkBattleOver(allies, enemies);
  }
  return settleNpcDuel(state, npc, {
    outcome: outcome ?? "draw", battleLog, now, remainingHp: allies[0].hp,
    pendingQuestBranch: { questId: quest.id, flag: choice.flag, mode: "combat" },
  });
}
