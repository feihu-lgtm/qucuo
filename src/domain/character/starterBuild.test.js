import { describe, expect, it } from "vitest";
import { createRng } from "../../core/rng.js";
import {
  adjustSpecial,
  baseSpecial,
  drawStarterSkills,
  isCompleteSpecial,
  randomizeSpecial,
  remainingSpecialPoints,
} from "./starterBuild.js";

describe("starter character build", () => {
  it("allocates the confirmed twenty points within the stat caps", () => {
    let special = baseSpecial();
    special = adjustSpecial(special, "根骨", 20);
    expect(special.根骨).toBe(10);
    expect(remainingSpecialPoints(special)).toBe(12);
    special = adjustSpecial(special, "悟性", 20);
    expect(special.悟性).toBe(10);
    expect(adjustSpecial(special, "体魄", 20)).toBe(special);
    special = adjustSpecial(special, "根骨", -1);
    expect(special.根骨).toBe(9);
    expect(remainingSpecialPoints(special)).toBe(5);
  });

  it("randomly spends exactly twenty points with deterministic seeded results", () => {
    const first = randomizeSpecial(createRng(901).random);
    expect(first).toEqual(randomizeSpecial(createRng(901).random));
    expect(isCompleteSpecial(first)).toBe(true);
    expect(remainingSpecialPoints(first)).toBe(0);
    expect(Object.values(first).every((value) => value >= 2 && value <= 10)).toBe(true);
  });

  it("draws three distinct seeded skills and rerolls away from the previous draw", () => {
    const first = drawStarterSkills(createRng(38).random);
    const reroll = drawStarterSkills(createRng(39).random, first.map((skill) => skill.id));
    expect(first).toHaveLength(3);
    expect(new Set(first.map((skill) => skill.id)).size).toBe(3);
    expect(reroll).toHaveLength(3);
    expect(reroll.some((skill) => first.some((drawn) => drawn.id === skill.id))).toBe(false);
  });
});
