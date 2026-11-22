import { describe, expect, it } from "vitest";
import { GROUND_ITEMS_INNER } from "../map/groundItems.js";
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

describe("房间级地上物记下自己在哪间房", () => {
  it("新注入的物件带上当前内层房间", () => {
    const items = innerGroundItemsRule.run(state).changes.room(state.room).items;
    expect(items.every((item) => item.innerRoom === state.innerRoomName)).toBe(true);
  });

  it("旧存档里没记归属的房间级物件，回到据点时按登记表认回原房间", () => {
    const old = { name: "霜天月", category: "weapon", quality: "红" };
    const atPeak = { inv: [], innerRoomName: "峰道入口", room: { name: "顶峰", items: [old] } };
    const result = innerGroundItemsRule.run(atPeak);
    const items = result.changes.room(atPeak.room).items;
    expect(items.find((item) => item.name === "霜天月").innerRoom).toBe("雪山崖底");
  });
});
