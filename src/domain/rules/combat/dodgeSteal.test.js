import { describe, expect, it } from "vitest";
import { rollDodgeSteal } from "./dodgeSteal.js";

describe("dodge theft", () => {
  it("steals at most once and ignores unavailable items", () => {
    const items = [{ id: "a", name: "短刀" }, { id: "b", name: "旧钱袋", stolen: true }];
    const roll = () => 0;

    expect(rollDodgeSteal({ stealOnDodge: 0.5 }, items, false, roll)).toEqual(items[0]);
    expect(rollDodgeSteal({ stealOnDodge: 0.5 }, items, true, roll)).toBeNull();
    expect(rollDodgeSteal({ stealOnDodge: 0.5 }, [], false, roll)).toBeNull();
  });
});
