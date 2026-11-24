import { useCallback, useRef, useState } from "react";
import { rollDodgeSteal } from "../../domain/rules/combat/dodgeSteal.js";

export { excludeDodgeStolenItems } from "../../domain/rules/combat/dodgeSteal.js";

export function addDodgeStealNote(result, move, carriedItems, trySteal) {
  if (!result.dodgeSuccessA) return;
  const stolen = trySteal(move, carriedItems);
  if (stolen) result.notes.push(`顺手摸走了${stolen.name}`);
}

// 团战里只偷「主敌」：结算（settleNpcDuel）把赃物记在主敌名下，随从（铁伯）的交手偷不到东西，
// 否则闪过铁伯却从朵朵身上摸走物件。owner = { id: 主敌单位 id, carriedItems }。
export function addTeamDodgeStealNotes(turnLog, playerId, move, owner, trySteal) {
  if (!owner?.id) return;
  for (const entry of turnLog) {
    if ((entry.actor?.id === playerId && entry.target?.id === owner.id && entry.result?.dodgeSuccessA)
      || (entry.target?.id === playerId && entry.actor?.id === owner.id && entry.result?.dodgeSuccessB)) {
      addDodgeStealNote({ dodgeSuccessA: true, notes: entry.result.notes }, move, owner.carriedItems, trySteal);
    }
  }
}

export function useDuelDodgeSteal() {
  const [dodgeStolenItems, setDodgeStolenItems] = useState([]);
  const used = useRef(false);
  const tryStealOnDodge = useCallback((move, carriedItems) => {
    const stolen = rollDodgeSteal(move, carriedItems, used.current);
    if (stolen) {
      used.current = true;
      setDodgeStolenItems((items) => [...items, stolen]);
    }
    return stolen;
  }, []);
  return { dodgeStolenItems, tryStealOnDodge };
}
