import { checkBattleOver, decideUnitMove, runTeamTurn } from "../../domain/rules/combat/teamBattleEngine.js";
import { buildEnemyUnit, buildPlayerUnit } from "../../domain/rules/combat/teamUnits.js";
import { MOVE_TYPE } from "../../domain/rules/combat/moveTypes.js";
import { ensureNpcCombatData } from "../../domain/rules/npc/npcGeneration.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { applyBuffsToSpecial, resolveCombatBuff } from "../../utils/buffSystem.js";
import { settleNpcDuel } from "../npc/settleDuel.js";
import { isQuestChoiceOpen } from "../../domain/rules/quests/questEngine.js";
import { SPAR_POISON } from "../../domain/rules/economy/sectSpar.js";

export function buildQuestFoe(choice, now = Date.now()) {
  const { levelCap = 1 } = choice.combatNpc;
  return ensureNpcCombatData({
    ...choice.combatNpc,
    id: `questfoe_${choice.flag}_${now}`,
    levelCap, hostile: choice.combatNpc.hostile !== false, questBranchFlag: choice.flag,
  }, { levelCap });
}

export function autoFightQuestChoice(state, quest, label, now = Date.now()) {
  const choice = getLocalQuestStage(quest, state)?.choices?.find((entry) => entry.label === label);
  if (choice?.resolve !== "combat" || !choice.combatNpc) return null;
  if (!isQuestChoiceOpen(choice, state)) return { logs: [{ t: "sys", text: `「${choice.label}」的条件还不满足。` }] };
  const { char, inv, skills } = state;
  if (!(char?.hp?.[0] > 0) || !char.moveset?.length) {
    return { logs: [{ t: "sys", text: "须有可用招式和气血才能截货。" }] };
  }
  const npc = buildQuestFoe(choice, now);
  const combatBuff = resolveCombatBuff(char.pendingCombatBuff);
  const playerChar = { ...char, special: applyBuffsToSpecial(char.special, state.flags, state.time) };
  let allies = [buildPlayerUnit({ playerChar, playerInv: inv, playerMoveset: char.moveset, combatBuff, playerSkills: skills })];
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
    // 战报不带 result；毒伤回查对手状态槽（任务战同样要判「堂堂正正」，否则淬毒赢试炼也发旗）
    const foeDrain = enemies[0].statusSlots?.drain?.name;
    battleLog.push({
      round,
      teamText: `你使「${intents.player.move?.name ?? "未出招"}」，${npc.name}使「${intents[npc.id].move?.name ?? "未出招"}」。气血 ${allies[0].hp[0]} 对 ${enemies[0].hp[0]}。`,
      ...(foeDrain && SPAR_POISON.has(foeDrain) ? { result: { statusAppliedToB: foeDrain } } : {}),
    });
    outcome = checkBattleOver(allies, enemies);
  }
  return settleNpcDuel(state, npc, {
    outcome: outcome ?? "draw", battleLog, now, remainingHp: allies[0].hp,
    pendingQuestBranch: { questId: quest.id, flag: choice.flag, mode: "combat", title: quest.title, aftermath: choice.aftermath },
  });
}
