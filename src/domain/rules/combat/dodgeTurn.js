import { random } from "../../../utils/rng.js";

export function applyDodgeResult(result, defender, defenderTag, attacker, attackerTag, markSources = {}) {
  const chance = defender.move.dodgeChance ?? 0;
  if (chance <= 0 || random() >= chance) return;
  result[`dodgeSuccess${defenderTag}`] = true;
  result[`damageTo${defenderTag}`] = 0;
  result[`statusAppliedTo${defenderTag}`] = null;
  result[`markAppliedTo${defenderTag}`] = null;
  result[`markDetonatedOn${defenderTag}`] = 0;
  const attackerMarkKey = `markAppliedTo${attackerTag}`;
  const contactMark = markSources.contact?.[attackerTag];
  if (contactMark && result[attackerMarkKey] === contactMark) result[attackerMarkKey] = markSources.move?.[attackerTag] ?? null;
  result[`freezeEnergyTo${defenderTag}`] = false;
  result[`costPenaltyTo${defenderTag}`] = null;
  result[`defenseBroken${defenderTag}`] = false;
  result[`statusSuccess${attackerTag}`] = false;
  if (result[`counterSuccess${attackerTag}`]) {
    result[`counterSuccess${attackerTag}`] = false;
    result.counterTriggered = false;
    result[`energyDelta${attackerTag}`] -= attacker.move.onCounterSuccessEnergyGain ?? 0;
  }
  result.notes.push("闪身避开");
}
