import { deriveMovesetFromSkills } from "../../domain/rules/npc/npcGeneration.js";

export const derivedMovesetRule = {
  id: "skills.derived-moveset",
  deps: (state) => [state.skills],
  run(state) {
    const derived = deriveMovesetFromSkills(state.skills);
    const extraLearned = (state.char?.moveset || []).filter((move) => (
      !derived.some((entry) => entry.id === move.id) && move.learnedFromMaster
    ));
    return {
      changes: {
        char: (previous) => ({ ...previous, moveset: [...derived, ...extraLearned] }),
      },
    };
  },
};
