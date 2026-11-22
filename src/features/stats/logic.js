import { effectiveSpecial } from "../../domain/rules/economy/equipment.js";
import { effectiveMaxHp } from "../../domain/data/kungfu/qucuoKungfu.js";
import { activeBuffsWithRemaining, applyBuffsToSpecial } from "../../utils/buffSystem.js";

export function selectEffectiveStats(state) {
  const char = state.char || {};
  return {
    effectiveSpecialNow: effectiveSpecial(
      applyBuffsToSpecial(char.special, state.flags, state.time),
      state.inv,
      state.skills,
    ),
    maxHpNow: effectiveMaxHp(char.hp?.[1], state.skills),
    activeBuffs: activeBuffsWithRemaining(state.flags, state.time),
  };
}
