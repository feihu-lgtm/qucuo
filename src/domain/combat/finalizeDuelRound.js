import { hpBandFor } from "./duelPhrases/index.js";

export function finalizeDuelRound(result, endTick, {
  hpAfterA, hpAfterB, nameA = "你", nameB = "对手",
}) {
  const statusDamageA = endTick.statusDamageA || 0;
  const statusDamageB = endTick.statusDamageB || 0;
  const damageA = (result.damageToA || 0) + statusDamageA;
  const damageB = (result.damageToB || 0) + statusDamageB;
  return {
    ...result,
    statusDamageA, statusDamageB,
    nameA, nameB,
    hpAfterA, hpAfterB,
    statusSlotsAfterA: endTick.statusSlotsA,
    statusSlotsAfterB: endTick.statusSlotsB,
    statusLogA: endTick.logA || [],
    statusLogB: endTick.logB || [],
    hpBandA: hpBandFor(hpAfterA),
    hpBandB: hpBandFor(hpAfterB),
    worseName: damageA === damageB ? "平手" : damageA > damageB ? nameA : nameB,
  };
}
