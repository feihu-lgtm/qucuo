export function resolveDefenseBlock(result, sideA, sideB, winnerIsA, {
  calcBaseDamage,
  calcDefenseValue,
  applyMarkOnHitCheck,
}) {
  const winnerSide = winnerIsA ? sideA : sideB;
  const loserSide = winnerIsA ? sideB : sideA;
  const winnerMove = winnerSide.move;
  const loserMove = loserSide.move;
  const rawDmg = calcBaseDamage(loserMove, loserSide, winnerSide);
  const partialImmune = winnerMove.ignoreDefensePartialImmune ?? winnerSide.ignoreDefensePartialImmune ?? 0;
  const idRatio = Math.max(0, Math.min(1, loserMove.ignoreDefenseRatio ?? loserSide.ignoreDefenseRatio ?? 0));
  if (!loserMove.ignoreDefense && idRatio > 0) {
    const pierced = Math.round(rawDmg * idRatio);
    const immuned = partialImmune > 0 ? Math.round(pierced * partialImmune) : 0;
    const blockedPart = rawDmg - pierced;
    const reducedBlocked = Math.round(blockedPart * (loserMove.defenseDiscount ?? 0.35));
    const dmg = Math.max(1, pierced - immuned + reducedBlocked);
    if (winnerIsA) result.damageToA = dmg; else result.damageToB = dmg;
    result.notes.push(`${loserMove.name}专挑劲力薄处扎，${winnerMove.name}挡住了大半，仍被透进去几分`);
    applyMarkOnHitCheck(winnerMove, winnerIsA ? "A" : "B", winnerIsA ? "B" : "A");
  } else if (loserMove.ignoreDefense) {
    const immuned = partialImmune > 0 ? Math.round(rawDmg * partialImmune) : 0;
    const dmg = Math.max(1, rawDmg - immuned);
    if (winnerIsA) result.damageToA = dmg; else result.damageToB = dmg;
    result.notes.push(immuned > 0
      ? `${loserMove.name}势大力沉，${winnerMove.name}的护体之力堪堪卸去几分，未被全然击穿`
      : `${loserMove.name}势大力沉，${winnerMove.name}竟未能卸去分毫`);
    applyMarkOnHitCheck(winnerMove, winnerIsA ? "A" : "B", winnerIsA ? "B" : "A");
  } else {
    const reduced = Math.round(rawDmg * (winnerMove.baseDamageMultiplier ?? 0.6));
    const defenseValue = calcDefenseValue(winnerSide, winnerMove);
    const finalReduced = Math.max(1, reduced - defenseValue);
    let counterDmg = 0;
    if (winnerMove.onCounterSuccessDamageRatio) {
      counterDmg = Math.round(rawDmg * winnerMove.onCounterSuccessDamageRatio);
      result.counterTriggered = true;
      if (winnerIsA) result.counterSuccessA = true; else result.counterSuccessB = true;
    }
    const attackerHp = loserSide.hp?.[0] ?? 1;
    const preemptiveKill = winnerMove.onCounterSuccessPreemptive && counterDmg >= attackerHp;
    if (winnerIsA) {
      result.damageToB += counterDmg;
      result.damageToA = preemptiveKill ? 0 : finalReduced;
    } else {
      result.damageToA += counterDmg;
      result.damageToB = preemptiveKill ? 0 : finalReduced;
    }
    result.notes.push(counterDmg > 0
      ? `${winnerMove.name}稳稳架住来招，反手一击${preemptiveKill ? "抢先制敌，对方再无还手" : "凌厉奉还"}`
      : `${winnerMove.name}架住来招，${loserMove.name}力道去了大半`);
    if (winnerMove.onCounterSuccessEnergyGain) {
      if (winnerIsA) result.energyDeltaA += winnerMove.onCounterSuccessEnergyGain;
      else result.energyDeltaB += winnerMove.onCounterSuccessEnergyGain;
    }
    applyMarkOnHitCheck(winnerMove, winnerIsA ? "A" : "B", winnerIsA ? "B" : "A");
  }
}
