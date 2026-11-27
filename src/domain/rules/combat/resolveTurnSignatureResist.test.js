import { beforeEach, describe, expect, it } from "vitest";
import { setSeed } from "../../../utils/rng.js";
import { resolveTurn } from "./resolveTurn.js";

function side(move, over = {}) {
  return {
    move, special: 10, waigong: 10, neigong: 10, baseAtk: 20,
    hp: [100, 100], energy: [10, 10], statusSlots: { control: null, drain: null, mark: null },
    ...over,
  };
}
const atkMove = { id: "a", name: "裂石斩", type: "攻击", energyCost: 3, baseDamageMultiplier: 1.5, doubleVsStatus: true };
const sigStatus = { id: "s", name: "魇梦深渊", type: "状态", energyCost: 5, signature: true, applyStatus: { kind: "control", name: "梦魇" } };
const plainStatus = { id: "p", name: "普通迷烟", type: "状态", energyCost: 3, applyStatus: { kind: "control", name: "眩晕" } };

describe("专属状态招抗击打（温和修正：40% 心法不散）", () => {
  beforeEach(() => setSeed(42));

  it("普通状态招被攻击克中仍必打断（既有行为不变）", () => {
    for (const seed of [1, 7, 42, 99]) {
      setSeed(seed);
      const r = resolveTurn(side(atkMove), side(plainStatus));
      if (r.damageToB > 0) expect(r.interruptedB).toBe(true);
    }
  });

  it("signature 状态招存在不被打断的可能——多种子里至少一次生效且至少一次被打断", () => {
    let resisted = 0, broken = 0;
    for (let seed = 1; seed <= 40; seed++) {
      setSeed(seed);
      const r = resolveTurn(side(atkMove), side(sigStatus));
      if (r.damageToB > 0) {
        if (r.interruptedB) broken++; else resisted++;
      }
    }
    expect(resisted).toBeGreaterThan(0);
    expect(broken).toBeGreaterThan(0); // 不是霸体——只是概率护身
  });
});
