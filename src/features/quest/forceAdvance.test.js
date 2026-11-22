import { describe, expect, it } from "vitest";
import { forceAdvanceQuest, playLocalQuestStage } from "./logic.js";

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

    expect(result.changes.flags([])).toEqual(["stage_done", "reward_flag"]);
    expect(result.changes.questProgress({}).test_quest.status).toBe("completed");
    expect(result.changes.char({ money: 5 }).money).toBe(15);
  });

  it("does not advance when the supplied flag does not match", () => {
    const result = forceAdvanceQuest({
      flags: [],
      questProgress: {},
      char: {},
      inv: [],
      varTree: {},
    }, quest, "wrong_flag");

    expect(result.changes.flags([])).toEqual(["wrong_flag"]);
    expect(result.changes.questProgress({}).test_quest.currentStageIndex).toBe(0);
    expect(result.changes.questProgress({}).test_quest.status).toBe("active");
  });
});

describe("playLocalQuestStage · minMoney 门槛", () => {
  const payQuest = {
    id: "pay_quest",
    localOnly: true,
    stages: [{
      completionFlag: ["paid", "fought"],
      choices: [
        { flag: "paid", label: "垫银了税", resolve: "none", minMoney: 30 },
        { flag: "fought", label: "动手赶差", resolve: "combat", combatNpc: { name: "差役", levelCap: 6 } },
      ],
      onReach: { money: 5 },
    }],
  };
  const base = { flags: [], questProgress: {}, char: { money: 0 }, inv: [], varTree: {}, room: { name: "x" } };

  it("银两不足时付费分支不推进", () => {
    const result = playLocalQuestStage({ ...base, char: { money: 10 } }, payQuest, "垫银了税");
    expect(result.changes).toBeUndefined();
    expect(result.logs[0].text).toContain("银两不足");
  });

  it("银两足够时付费分支正常推进", () => {
    const result = playLocalQuestStage({ ...base, char: { money: 35 } }, payQuest, "垫银了税");
    expect(result.changes.flags([])).toContain("paid");
  });
});
