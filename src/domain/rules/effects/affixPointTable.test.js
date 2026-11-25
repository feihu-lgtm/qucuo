import { describe, it, expect } from "vitest";
import { allowedAffixesForBudget, affixCost, compileAffix } from "./affixPointTable.js";

describe("affixPointTable 点数口径", () => {
  it("手册锁死口径：sixDim 每+1计1点、hpRestore:0.08 计1点、forceFirst 2点、ignoreDefense 3点", () => {
    expect(affixCost("sixDim:身法+1")).toBe(1);
    expect(affixCost("sixDim:气运+2")).toBe(2);
    expect(affixCost("hpRestore")).toBe(1);
    expect(compileAffix("hpRestore").effect.hpRestore).toBeCloseTo(0.08);
    expect(affixCost("forceFirst")).toBe(2);
    expect(affixCost("ignoreDefense")).toBe(3);
  });

  it("非法词条返回 null：错七维键/不存在的特效/格式坏", () => {
    expect(affixCost("sixDim:颜值+1")).toBeNull();
    expect(compileAffix("notARealAffix")).toBeNull();
    expect(compileAffix("sixDim:身法+10")).toBeNull(); // 个位数档
    expect(compileAffix(null)).toBeNull();
  });

  it("compileAffix 输出 resolveTurn 消费的真实形状", () => {
    expect(compileAffix("forceFirst").effect).toEqual({ forceFirst: true });
    expect(compileAffix("applyMark:内伤").effect.applyMark).toEqual({ name: "内伤", stacks: 1, max: 5 });
    expect(compileAffix("sixDim:根骨+2").sixDim).toEqual({ 根骨: 2 });
    expect(compileAffix("consumable:heal").consumable.hpRestore).toBeCloseTo(0.2);
  });
});

describe("allowedAffixesForBudget 白名单", () => {
  it("契约 C 示例形状：2 点预算含 forceFirst/hpRestore/sixDim+2，不含 3 点 ignoreDefense", () => {
    const list = allowedAffixesForBudget("accessory", 2);
    expect(list).toContain("forceFirst");
    expect(list).toContain("hpRestore");
    expect(list).toContain("sixDim:身法+2");
    expect(list).toContain("sixDim:气运+2");
    expect(list).not.toContain("ignoreDefense");
    expect(list).not.toContain("sixDim:根骨+3");
  });

  it("预算 0 出空表；预算 1 不出 2 点词条", () => {
    expect(allowedAffixesForBudget("weapon", 0)).toEqual([]);
    const one = allowedAffixesForBudget("weapon", 1);
    expect(one).not.toContain("forceFirst");
    expect(one).toContain("sixDim:体魄+1");
  });

  it("分类分面：武器不出防御面词条，护甲不出攻击面词条，misc 只出 consumable+六维", () => {
    const weapon = allowedAffixesForBudget("weapon", 3);
    expect(weapon).toContain("ignoreDefense");
    expect(weapon).not.toContain("hpRestore");
    expect(weapon).not.toContain("consumable:heal");
    const armor = allowedAffixesForBudget("armor", 3);
    expect(armor).toContain("hpRestore:0.24");
    expect(armor).not.toContain("ignoreDefense");
    const misc = allowedAffixesForBudget("misc", 3);
    expect(misc).toContain("consumable:heal");
    expect(misc).not.toContain("forceFirst");
    expect(misc).toContain("sixDim:气运+3");
  });
});
