import { describe, expect, it } from "vitest";
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
});
