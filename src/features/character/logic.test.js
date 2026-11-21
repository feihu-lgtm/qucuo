import { describe, expect, it } from "vitest";
import { applyCharacterCard } from "./logic.js";

describe("character-card conversion", () => {
  it("builds carried items and equips the highest quality item per category", () => {
    const result = applyCharacterCard({}, {
      carry: [
        { name: "测试短剑", category: "weapon", quality: "白" },
        { name: "测试长剑", category: "weapon", quality: "蓝" },
        { name: "测试外衣", category: "armor", quality: "绿" },
      ],
    }, "seed_");

    const items = result.changes.inv([]);
    expect(items.map(({ id, name, equipped, stolen }) => ({ id, name, equipped, stolen }))).toEqual([
      { id: "cardcarry_seed_0", name: "测试短剑", equipped: false, stolen: false },
      { id: "cardcarry_seed_1", name: "测试长剑", equipped: true, stolen: false },
      { id: "cardcarry_seed_2", name: "测试外衣", equipped: true, stolen: false },
    ]);
  });

  it("replaces supplied skills and unequips same-category old gear", () => {
    const state = {
      skills: [{ id: "old" }],
      inv: [{ id: "old-sword", category: "weapon", equipped: true }],
    };
    const result = applyCharacterCard(state, {
      skills: [{ id: "new" }],
      carry: [{ name: "测试刀", category: "weapon", quality: "蓝" }],
    }, "new_");

    expect(result.changes.skills).toEqual([{ id: "new" }]);
    expect(result.carriedCount).toBe(1);
    expect(result.changes.inv(state.inv).map((item) => item.equipped)).toEqual([false, true]);
    expect(applyCharacterCard(state, {}).changes).toEqual({});
  });
});
