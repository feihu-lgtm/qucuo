import { describe, expect, it } from "vitest";
import { forceAdvanceQuest } from "./logic.js";

const quest = {
  id: "test_quest",
  stages: [{ completionFlag: "stage_done", onReach: { money: 10, flags: ["reward_flag"] } }],
};

describe("forceAdvanceQuest", () => {
  it("advances the matching stage and applies its rewards", () => {
    const result = forceAdvanceQuest({
      flags: [],
      questProgress: {},
      char: { money: 5 },
      inv: [],
      varTree: {},
    }, quest, "stage_done");

    expect(result.changes.flags).toEqual(["stage_done", "reward_flag"]);
    expect(result.changes.questProgress.test_quest.status).toBe("completed");
    expect(result.changes.char.money).toBe(15);
  });

  it("does not advance when the supplied flag does not match", () => {
    const result = forceAdvanceQuest({
      flags: [],
      questProgress: {},
      char: {},
      inv: [],
      varTree: {},
    }, quest, "wrong_flag");

    expect(result.changes.flags).toEqual(["wrong_flag"]);
    expect(result.changes.questProgress.test_quest.currentStageIndex).toBe(0);
    expect(result.changes.questProgress.test_quest.status).toBe("active");
  });
});
