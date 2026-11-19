import { describe, expect, it } from "vitest";
import { GROUND_ITEMS_INNER } from "../../groundItems.js";
import { innerGroundItemsRule } from "./rules.js";

const [innerKey, itemSpecs] = Object.entries(GROUND_ITEMS_INNER)
  .find(([, specs]) => specs.length > 1);
const delimiter = innerKey.indexOf("·");
const state = {
  inv: [],
  innerRoomName: innerKey.slice(delimiter + 1),
  room: { name: innerKey.slice(0, delimiter), items: [] },
};

describe("inner ground-item world rule", () => {
  it("adds room-specific items and leaves existing inventory or ground items alone", () => {
    const result = innerGroundItemsRule.run(state);
    const items = result.changes.room(state.room).items;

    expect(items.map((item) => item.name)).toEqual(itemSpecs.map((item) => item.name));
    expect(innerGroundItemsRule.run({
      ...state,
      inv: [{ name: itemSpecs[0].name }],
    }).changes.room(state.room).items.map((item) => item.name))
      .toEqual(itemSpecs.slice(1).map((item) => item.name));
    expect(innerGroundItemsRule.run({
      ...state,
      room: { ...state.room, items },
    })).toBeNull();
  });
});
