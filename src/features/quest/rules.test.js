import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../quests/qucuoQuests.js";
import { collectGroundItemsRule } from "./rules.js";

function getFishVillageCollectStage() {
  for (const quest of QUCUO_QUESTS) {
    for (const [index, stage] of (quest.stages || []).entries()) {
      const collect = Array.isArray(stage.collect) ? stage.collect : [stage.collect];
      const entry = collect.find((item) => item?.at === "鱼定村");
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
