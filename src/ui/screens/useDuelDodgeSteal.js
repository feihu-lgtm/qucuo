import { useCallback, useRef, useState } from "react";
import { rollDodgeSteal } from "../../domain/combat/dodgeSteal.js";

export { excludeDodgeStolenItems } from "../../domain/combat/dodgeSteal.js";

export function addDodgeStealNote(result, move, carriedItems, trySteal) {
  if (!result.dodgeSuccessA) return;
  const stolen = trySteal(move, carriedItems);
  if (stolen) result.notes.push(`顺手摸走了${stolen.name}`);
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
