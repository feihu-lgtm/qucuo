import { useCallback, useRef, useState } from "react";
import { rollDodgeSteal } from "../../domain/combat/dodgeSteal.js";

export { excludeDodgeStolenItems } from "../../domain/combat/dodgeSteal.js";

export function addDodgeStealNote(result, move, carriedItems, trySteal) {
  if (!result.dodgeSuccessA) return;
  const stolen = trySteal(move, carriedItems);
  if (stolen) result.notes.push(`顺手摸走了${stolen.name}`);
}

export function addTeamDodgeStealNotes(turnLog, playerId, move, carriedItems, trySteal) {
  for (const entry of turnLog) {
    if ((entry.actor?.id === playerId && entry.result?.dodgeSuccessA)
      || (entry.target?.id === playerId && entry.result?.dodgeSuccessB)) {
      addDodgeStealNote({ dodgeSuccessA: true, notes: entry.result.notes }, move, carriedItems, trySteal);
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
