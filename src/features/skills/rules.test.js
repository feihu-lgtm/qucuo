import { describe, expect, it, vi } from "vitest";
import { createWorldRules } from "../../engine/worldRules.js";
import { deriveMovesetFromSkills } from "../../domain/npc/npcGeneration.js";
import { derivedMovesetRule } from "./rules.js";

describe("derived moveset world rule", () => {
  it("rebuilds moves from skills while retaining master-learned extras", () => {
    const state = {
      skills: [],
      char: { moveset: [{ id: "master", learnedFromMaster: true }, { id: "stale" }] },
    };
    const result = derivedMovesetRule.run(state);
    const char = result.changes.char(state.char);

    expect(char.moveset).toEqual([
      ...deriveMovesetFromSkills(state.skills),
      { id: "master", learnedFromMaster: true },
    ]);
  });

  it("does not rerun when a non-dependency changes", () => {
    const state = { skills: [], char: { moveset: [] }, unrelated: 0 };
    const run = vi.fn(derivedMovesetRule.run);
    const applyResult = vi.fn((result) => {
      state.char = { ...state.char, ...result.changes.char(state.char) };
    });
    const runner = createWorldRules([{ ...derivedMovesetRule, run }], {
      getState: () => state,
      applyResult,
    });

    runner.check();
    state.unrelated++;
    runner.check();

    expect(run).toHaveBeenCalledTimes(1);
    expect(applyResult).toHaveBeenCalledTimes(1);
  });
});
