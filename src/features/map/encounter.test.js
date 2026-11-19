import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { judgeCollect, rollMovementEvents } from "./encounter.js";

describe("movement encounter logic", () => {
  it("skips pickup and encounter outside an eligible move", () => {
    expect(rollMovementEvents({
      isTalk: false,
      movingDir: null,
      lockedDestName: "大草甸",
      targetedRumor: false,
      random: () => 0,
    })).toEqual({ pickupJudgment: null, encounterToDescribe: null });
    expect(rollMovementEvents({
      isTalk: true,
      movingDir: "n",
      lockedDestName: "大草甸",
      targetedRumor: false,
      random: () => 0,
    })).toEqual({ pickupJudgment: null, encounterToDescribe: null });
  });

  it("draws pickup before encounter and suppresses encounter for targeted rumors", () => {
    const draws = [];
    const result = rollMovementEvents({
      isTalk: false,
      movingDir: "n",
      lockedDestName: null,
      targetedRumor: true,
      random: () => { draws.push(draws.length); return 0; },
    });
    expect(result.pickupJudgment).toMatchObject({ category: "weapon" });
    expect(draws).toEqual([0, 1]);
    expect(result.encounterToDescribe).toBeNull();
  });

  it("declines collect arbitration for talk and unmatched commands", () => {
    const args = { cmd: "采集", room: { name: "鱼定村", items: [] }, questProgress: {}, inv: [] };
    expect(judgeCollect({ ...args, isTalk: true })).toBeNull();
    expect(judgeCollect({ ...args, isTalk: false })).toBeNull();
  });

  it("arbitrates a named item that is present for an active collect stage", () => {
    const quest = QUCUO_QUESTS.find((entry) => entry.stages?.some((stage) => stage.collect));
    const stageIndex = quest.stages.findIndex((stage) => stage.collect);
    const collect = Array.isArray(quest.stages[stageIndex].collect)
      ? quest.stages[stageIndex].collect[0]
      : quest.stages[stageIndex].collect;
    const result = judgeCollect({
      isTalk: false,
      cmd: `挖取${collect.item}`,
      room: { name: collect.at, items: [collect.item] },
      questProgress: { [quest.id]: { status: "active", currentStageIndex: stageIndex } },
      inv: [],
    });
    expect(result.item).toBe(collect.item);
    expect(result.gained.name).toBe(collect.item);
    expect(result.note).toContain("系统已将其收入背包");
  });
});
