import { describe, expect, it } from "vitest";
import { getBuildingInstanceKey } from "./buildingInstanceKey.js";

describe("getBuildingInstanceKey", () => {
  it("keeps a building instance stable across renders", () => {
    const chest = { type: "chest", house: "溪边小屋", id: "chest_xibian" };
    expect(getBuildingInstanceKey(chest, null)).toBe("chest:溪边小屋:chest_xibian");
  });

  it("distinguishes chest instances by building type, house, and id", () => {
    const first = { type: "chest", house: "溪边小屋", id: "chest_xibian" };
    const second = { type: "chest", house: "山间别墅", id: "chest_shanbie" };
    expect(getBuildingInstanceKey(first, null)).not.toBe(getBuildingInstanceKey(second, null));
  });

  it("distinguishes building types and trading shops", () => {
    expect(getBuildingInstanceKey({ type: "chest", id: "same" }, null))
      .not.toBe(getBuildingInstanceKey({ type: "kitchen", id: "same" }, null));
    expect(getBuildingInstanceKey(null, { shopName: "鱼定商号" }))
      .not.toBe(getBuildingInstanceKey(null, { shopName: "玉器轩" }));
  });
});
