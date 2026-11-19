import { describe, expect, it } from "vitest";
import { selectEffectiveStats } from "./logic.js";

describe("effective stats selector", () => {
  it("combines temporary buffs, equipment, skill passives, and HP cap", () => {
    const state = {
      char: { special: { 根骨: 5, 身法: 4 }, hp: [70, 100] },
      flags: ["buff_根骨+2_untilturn_12"],
      time: 8,
      inv: [{ category: "accessory", equipped: true, sixDim: { 身法: 1 } }],
      skills: [{ passiveBonus: { maxHp: 20, speedBonus: 2 } }],
    };
    const before = structuredClone(state);

    expect(selectEffectiveStats(state)).toEqual({
      effectiveSpecialNow: { 根骨: 7, 身法: 7 },
      maxHpNow: 120,
      activeBuffs: [{ attr: "根骨", val: 2, remaining: 4 }],
    });
    expect(state).toEqual(before);
  });

  it("returns base values with no buffs or passive skills", () => {
    expect(selectEffectiveStats({
      char: { special: { 根骨: 5 }, hp: [10, 80] },
      flags: [],
      time: 1,
      inv: [],
      skills: [],
    })).toEqual({
      effectiveSpecialNow: { 根骨: 5 },
      maxHpNow: 80,
      activeBuffs: [],
    });
  });
});
