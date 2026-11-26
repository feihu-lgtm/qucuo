import { describe, expect, it } from "vitest";
import { moveStatLabel, statLabel } from "./itemStats.js";

// 从 domain/rules/economy/itemEffectText.test.js 随函数迁来（路线图 U4-2），断言原样保留。
describe("数值标签", () => {
  it("武器给攻、护甲给防；饰品不再显示那个不接任何机制的裸小数", () => {
    expect(statLabel({ atk: 35 })).toBe("攻35");
    expect(statLabel({ def: 20 })).toBe("防20");
    expect(statLabel({ bonus: 1.5 })).toBe(""); // bonus 字段已从全项目删除，残留数据也不显示
    expect(statLabel(null)).toBe("");
    expect(statLabel("字符串杂物")).toBe("");
  });
  it("招式显示倍率与耗气（倍率而非绝对伤害——绝对值要乘外功/装备/对手根骨）", () => {
    expect(moveStatLabel({ baseDamageMultiplier: 1.3, energyCost: 4 })).toBe("×1.3 耗4");
    expect(moveStatLabel({ baseDamageMultiplier: 1, energyCost: 0 })).toBe("×1 不耗气");
    expect(moveStatLabel({ hpRestore: 0.25, energyCost: 5 })).toContain("回血25%");
    expect(moveStatLabel(null)).toBe("");
  });
});
