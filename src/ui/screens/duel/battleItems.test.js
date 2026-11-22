import { describe, it, expect } from "vitest";
import { listBattleItems, consumablePseudoMove } from "./battleItems.js";

describe("battleItems", () => {
  it("只列即时救命类丹药，按名合并份数并扣掉已服用的", () => {
    const inv = [
      { name: "金创药", consumable: { hpRestore: 0.3 } },
      { name: "金创药", consumable: { hpRestore: 0.3 } },
      { name: "战前餐", consumable: { waigong: 2 } },
      "铜钱",
    ];
    expect(listBattleItems(inv, ["金创药"])).toEqual([{ item: inv[0], total: 1 }]);
    expect(listBattleItems(inv, ["金创药", "金创药"])).toEqual([]);
  });

  it("服药构造零耗气状态招，假死保命单独标开关", () => {
    const { pseudoMove, armRebirth } = consumablePseudoMove({ name: "还魂丹", consumable: { dispelAll: true, rebirthOnce: true } });
    expect(pseudoMove).toMatchObject({ id: "__consume_还魂丹", name: "服「还魂丹」", energyCost: 0, dispelSelf: true, dispelMarks: true });
    expect(consumablePseudoMove({ name: "蛇药", consumable: { dispel: true } }).pseudoMove.dispelMarks).toBeUndefined();
    expect(armRebirth).toBe(true);
  });
});
