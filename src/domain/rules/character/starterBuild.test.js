import { describe, expect, it } from "vitest";
import { createRng } from "../../../infra/rng.js";
import { resolveTurn } from "../combat/resolveTurn.js";
import { hpFromNeigong } from "../npc/npcGeneration.js";
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
    expect(Object.values(special)).toEqual(Array(7).fill(0));
    expect(remainingSpecialPoints(special)).toBe(20);
    expect(isCompleteSpecial(special)).toBe(false);
    expect(adjustSpecial(special, "悟性", -1)).toEqual(special);
    special = adjustSpecial(special, "根骨", 20);
    expect(special.根骨).toBe(10);
    expect(remainingSpecialPoints(special)).toBe(10);
    special = adjustSpecial(special, "悟性", 20);
    expect(special.悟性).toBe(10);
    expect(adjustSpecial(special, "体魄", 20)).toBe(special);
    special = adjustSpecial(special, "根骨", -1);
    expect(special.根骨).toBe(9);
    expect(remainingSpecialPoints(special)).toBe(1);
  });

  it("randomly spends exactly twenty points with deterministic seeded results", () => {
    const first = randomizeSpecial(createRng(901).random);
    expect(first).toEqual(randomizeSpecial(createRng(901).random));
    expect(isCompleteSpecial(first)).toBe(true);
    expect(remainingSpecialPoints(first)).toBe(0);
    expect(Object.values(first).reduce((sum, value) => sum + value, 0)).toBe(20);
    expect(Object.values(first).every((value) => value >= 0 && value <= 10)).toBe(true);
  });

  it("creates a legal maximum-root build with zero body and speed and resolves a combat turn", () => {
    let special = baseSpecial();
    special = adjustSpecial(special, "根骨", 10);
    special = adjustSpecial(special, "魅力", 10);

    expect(isCompleteSpecial(special)).toBe(true);
    expect(special).toEqual({ 根骨: 10, 悟性: 0, 体魄: 0, 魅力: 10, 智谋: 0, 身法: 0, 气运: 0 });

    const maxHp = hpFromNeigong(5, special.体魄);
    expect(Number.isFinite(maxHp)).toBe(true);
    expect(maxHp).toBeGreaterThan(0);

    const result = resolveTurn(
      {
        move: { name: "试招", type: "攻击", baseDamageMultiplier: 1 },
        hp: [maxHp, maxHp], energy: [10, 10], special,
      },
      {
        move: { name: "还招", type: "攻击", baseDamageMultiplier: 1 },
        hp: [100, 100], energy: [10, 10], special: { 根骨: 0, 身法: 1, 体魄: 0 },
      },
    );
    expect(result.matchup).toBe("tie");
    expect(result.speedWinner).toBe("B");
    expect(Number.isFinite(result.damageToA)).toBe(true);
    expect(Number.isFinite(result.damageToB)).toBe(true);
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
