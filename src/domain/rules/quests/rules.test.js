import { describe, expect, it } from "vitest";
import { ESCORT_QUESTS } from "../../data/quests/escortQuests.js";
import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";
import { SAFE_HOUSES } from "../map/safeHouse.js";
import { questPlaceDistrict } from "./questPlace.js";
import {
  alreadySatisfiedCollectRule,
  collectGroundItemsRule,
  estateAnnouncementRule,
  estateProgressRule,
  estateStartRule,
  escortArrivalRule,
  questFlagRule,
} from "./rules.js";

function getFishVillageCollectStage() {
  for (const quest of QUCUO_QUESTS) {
    for (const [index, stage] of (quest.stages || []).entries()) {
      const collect = Array.isArray(stage.collect) ? stage.collect : [stage.collect];
      const entry = collect.find((item) => item?.at?.startsWith("鱼定村·"));
      if (entry) return { quest, index, entry };
    }
  }
  throw new Error("Expected a fish-village collect stage");
}

describe("quest ground-item world rule", () => {
  it("injects active quest items into the room without duplicating them", () => {
    const { quest, index, entry } = getFishVillageCollectStage();
    const state = {
      inv: [],
      questProgress: { [quest.id]: { status: "active", currentStageIndex: index } },
      room: { name: "鱼定村", items: [] },
    };
    const result = collectGroundItemsRule.run(state);

    expect(result.changes.room(state.room).items).toEqual(expect.arrayContaining([expect.objectContaining({
      name: entry.item,
      id: `collect_${entry.item}`,
    })]));
    expect(collectGroundItemsRule.run({
      ...state,
      room: { ...state.room, items: [{ name: entry.item }] },
    })).toBeNull();
  });

  it("does not respawn an item already in the inventory", () => {
    const { quest, index, entry } = getFishVillageCollectStage();
    expect(collectGroundItemsRule.run({
      inv: [{ name: entry.item }],
      questProgress: { [quest.id]: { status: "active", currentStageIndex: index } },
      room: { name: "鱼定村", items: [] },
    })).toBeNull();
  });
});

describe("quest trigger world rules", () => {
  it("advances an already-satisfied collect stage and ignores inactive collect quests", () => {
    const quest = QUCUO_QUESTS.find((entry) => entry.stages?.some((stage) => stage.collect));
    const stageIndex = quest.stages.findIndex((stage) => stage.collect);
    const collect = quest.stages[stageIndex].collect;
    const items = (Array.isArray(collect) ? collect : [collect]).map(({ item }) => ({ name: item }));
    const state = {
      flags: [],
      inv: items,
      questProgress: { [quest.id]: { status: "active", currentStageIndex: stageIndex, progress: 0 } },
    };
    const result = alreadySatisfiedCollectRule.run(state, { getNow: () => 100 });

    expect(result).toBeTruthy();
    expect(result.logs).toHaveLength(1);
    expect(alreadySatisfiedCollectRule.run({ ...state, questProgress: {} })).toBeNull();
  });

  it("announces an escort destination only for an active escort", () => {
    const quest = ESCORT_QUESTS[0];
    const state = {
      room: { name: questPlaceDistrict(quest.targetLocation) },
      questProgress: { [quest.id]: { active: true } },
      flags: [],
    };
    expect(escortArrivalRule.run(state)?.logs[0].text).toContain(quest.targetNpc);
    expect(escortArrivalRule.run({ ...state, questProgress: {} })).toBeNull();
  });

  it("starts stage quests only when a completion flag is present", () => {
    expect(questFlagRule.run({ flags: [], questProgress: {} })).toBeNull();
    const firstFlags = QUCUO_QUESTS
      .filter((quest) => quest.stages?.length)
      .map((quest) => quest.stages[0].completionFlag)
      .flat()
      .filter(Boolean);
    expect(questFlagRule.run({ flags: firstFlags, questProgress: {}, char: {} })).toBeTruthy();
  });

  it("starts the estate tutorial on entry and announces it once", () => {
    expect(estateStartRule.run({ innerRoomName: "村口" })).toBeNull();
    expect(estateStartRule.run({ innerRoomName: "溪边小屋" }).changes.flags([]))
      .toEqual(["tutorial_estate_started"]);

    const state = { flags: ["tutorial_estate_started"], inv: [], questProgress: {} };
    expect(estateAnnouncementRule.run(state, { getNow: () => 10 })?.settle).toContain("有趣的任务");
    expect(estateAnnouncementRule.run({
      ...state,
      flags: [...state.flags, "tutorial_estate_announced"],
    })).toBeNull();
  });

  it("completes the estate tutorial with four keys and ignores completed quests", () => {
    const inv = SAFE_HOUSES.map(({ keyName }) => ({ name: keyName }));
    const state = {
      inv,
      flags: [],
      questProgress: { tutorial_four_estates: { status: "active", currentStageIndex: 3, progress: 3 } },
    };
    const result = estateProgressRule.run(state, { getNow: () => 20 });

    expect(result.settle).toContain("集齐了曲措乡四栋房子的钥匙");
    expect(result.changes.questProgress(state.questProgress).tutorial_four_estates.status).toBe("completed");
    expect(estateProgressRule.run({
      ...state,
      questProgress: { tutorial_four_estates: { status: "completed" } },
    })).toBeNull();
  });
});
