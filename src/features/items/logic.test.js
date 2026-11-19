import { describe, expect, it } from "vitest";
import { useItem, pickGroundItem } from "./logic.js";

const state = (overrides = {}) => ({
  char: { hp: [40, 100], special: { 体魄: 5 } },
  skills: [],
  inv: ["小还丹"],
  flags: [],
  room: { items: ["石子"] },
  time: 6,
  varTree: {},
  ...overrides,
});

describe("item logic", () => {
  it("uses a consumable, removes it, logs the result, and advances time", () => {
    const current = state();
    const result = useItem(current, { name: "测试丹", consumable: { hpRestore: 0.5 } });

    expect(result.logs[0].t).toBe("item");
    expect(result.changes.char(current.char).hp[0]).toBe(90);
    expect(result.changes.inv([current.inv[0], { name: "测试丹" }])).toEqual([current.inv[0]]);
    expect(result.changes.time(6)).toBe(7);
  });

  it.each([
    [state(), "石子", "并非可服用之物"],
    [state(), { name: "战斗药", consumable: { energyRestore: 10 } }, "切磋"],
  ])("refuses unsupported consumable %s", (current, item, expectedText) => {
    expect(useItem(current, item).logs[0].text).toContain(expectedText);
  });

  it("picks up a ground item and records the tally before advancing time", () => {
    const current = state();
    const result = pickGroundItem(current, "石子");
    expect(result.changes.inv(current.inv)).toEqual(["小还丹", "石子"]);
    expect(result.changes.room(current.room).items).toEqual([]);
    expect(result.changes.time(current.time)).toBe(7);
    expect(result.changes.varTree(current.varTree).世界.起居注.today.pickGround).toBe(1);
    expect(result.logs).toEqual([{ t: "item", text: "  ✓ 你拾起「石子」，收入囊中。" }]);
  });
});
