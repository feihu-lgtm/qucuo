import { describe, expect, it } from "vitest";
import { setSeed } from "../../core/rng.js";
import { resolveTurn } from "./resolveTurn.js";

describe("讨饭手闪避", () => {
  it("a successful dodge prevents the opponent's damage and status", () => {
    const sideA = {
      move: { name: "讨饭手", type: "防御", dodgeChance: 1 },
      hp: [100, 100], energy: [10, 10], special: {},
    };
    const sideB = {
      move: { name: "猴子偷桃", type: "状态", applyStatus: "麻穴", statusChance: 1 },
      hp: [100, 100], energy: [10, 10], special: {},
    };

    const result = resolveTurn(sideA, sideB);

    expect(result.dodgeSuccessA).toBe(true);
    expect(result.damageToA).toBe(0);
    expect(result.statusAppliedToA).toBeNull();
    expect(result.notes).toContain("闪身避开");
  });

  it("rolls an attack status only after a landed hit", () => {
    const attack = {
      move: { name: "猴子偷桃", type: "攻击", applyStatus: "麻穴", statusChance: 0.35 },
      hp: [100, 100], energy: [10, 10], special: {},
    };
    const statusOpponent = {
      move: { name: "运气", type: "状态" },
      hp: [100, 100], energy: [10, 10], special: {},
    };
    setSeed(1234);
    const hit = resolveTurn(attack, statusOpponent);
    expect(hit.damageToB).toBeGreaterThan(0);
    expect(hit.statusAppliedToB).toBe("麻穴");

    const dodger = {
      move: { name: "讨饭手", type: "防御", dodgeChance: 1 },
      hp: [100, 100], energy: [10, 10], special: {},
    };
    const strike = { ...attack, move: { ...attack.move, statusChance: 1 } };
    const avoided = resolveTurn(dodger, strike);
    expect(avoided.dodgeSuccessA).toBe(true);
    expect(avoided.damageToA).toBe(0);
    expect(avoided.statusAppliedToA).toBeNull();
  });
});
