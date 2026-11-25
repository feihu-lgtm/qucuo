import { describe, it, expect } from "vitest";
import { compileEmergentItem } from "./compileEmergentItem.js";
import { compileEmergentSkill } from "./compileEmergentSkill.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";

const warrant = {
  warrantId: "W42_1", factId: "F42_3", op: "GRANT_ITEM",
  category: "accessory", quality: "蓝", pointBudget: 2,
  allowedAffixes: ["forceFirst", "hpRestore", "sixDim:身法+2"],
  origin: { turn: 42, day: 2, place: "鱼定村·茶馆", fromNpc: "才旦" },
};

describe("compileEmergentItem 天工铸物", () => {
  it("图鉴命中且品阶不超授信：出真品，数值以 catalog 为准", () => {
    const anyName = Object.keys(CATALOG_INDEX).find((n) => {
      const e = CATALOG_INDEX[n];
      return e.quality === "白" || e.quality === "绿" || e.quality === "蓝";
    });
    const item = compileEmergentItem(warrant, { name: anyName, chosenAffix: "forceFirst", desc: "x" });
    expect(item).toBeTruthy();
    expect(item.name).toBe(anyName);
    // 图鉴真品不挂 sealFill 的词条（数值以 catalog 为准）
    expect(item.id).toMatch(/^it_cat_/);
    expect(item.provenance).toMatchObject({ turn: 42, factId: "F42_3", fromNpc: "才旦" });
    expect(item.history).toEqual([]);
  });

  it("图鉴命中但品阶超授信：不出真品，按授信品阶走公式", () => {
    const highName = Object.keys(CATALOG_INDEX).find((n) => CATALOG_INDEX[n].quality === "红");
    if (!highName) return; // 无红档具名物则跳过
    const item = compileEmergentItem(warrant, { name: highName, chosenAffix: "forceFirst" });
    expect(item.quality).toBe("蓝");
    expect(item.effect).toEqual({ forceFirst: true });
    // 兜底物不是真品：不得与图鉴真品撞 it_cat id
    expect(item.id).not.toMatch(/^it_cat_/);
    expect(item.id).toMatch(/^it_[0-9a-f]{6}$/);
  });

  it("奇遇新物：白名单内词条挂载真实 effect，id 确定性 it_<hex>", () => {
    const fill = { name: "裂风豹骨哨", chosenAffix: "sixDim:身法+2", desc: "哨口沁着血纹" };
    const a = compileEmergentItem(warrant, fill);
    const b = compileEmergentItem(warrant, fill);
    expect(a.sixDim).toEqual({ 身法: 2 });
    expect(a.id).toBe(b.id); // 确定性
    expect(a.id).toMatch(/^it_[0-9a-f]{6}$/);
    expect(a.quality).toBe("蓝");
    expect(a.desc).toBe("哨口沁着血纹");
    expect(a.provenance.place).toBe("鱼定村·茶馆");
  });

  it("越界词条物理驳回：不挂载、打 rejectedAffix 标记", () => {
    const item = compileEmergentItem(warrant, { name: "越界哨", chosenAffix: "ignoreDefense" });
    expect(item.effect).toBeUndefined();
    expect(item.sixDim).toBeUndefined();
    expect(item.rejectedAffix).toBe(true);
  });

  it("残缺入参返回 null", () => {
    expect(compileEmergentItem(null, {})).toBeNull();
    expect(compileEmergentItem(warrant, {})).toBeNull();
  });
});

describe("compileEmergentSkill 原型创招", () => {
  const sw = { warrantId: "W42_2", factId: "F42_4", op: "BESTOW_SKILL", quality: "紫", growthMode: "growth", origin: { turn: 42, place: "雪山" } };

  it("SKILL_CATALOG 命中：出真品目录武学", () => {
    const skill = compileEmergentSkill(sw, { name: "听雪" });
    expect(skill).toBeTruthy();
    expect(skill.id).toBe("kf_ting_tingxue");
    expect(skill.stage).toBe("入门");
    expect(skill.upgradable).toBe(true);
    expect(skill.provenance.factId).toBe("F42_4");
  });

  it("自创招式按原型派生：紫档硬攻带 doubleVsStatus，完整 move 可上阵", () => {
    const skill = compileEmergentSkill(sw, { name: "断崖一剑", archetype: "硬攻", desc: "才旦的猎户狠劲" });
    expect(skill.type).toBe("招式");
    expect(skill.moveType).toBe("攻击");
    expect(skill.move.baseDamageMultiplier).toBeCloseTo(1.5); // 硬攻紫档
    expect(skill.move.doubleVsStatus).toBe(true);
    expect(skill.stage).toBe("入门");
    expect(skill.upgradable).toBe(true);
    expect(skill.archetype).toBe("硬攻");
  });

  it("未知 archetype 默认回退硬攻", () => {
    const skill = compileEmergentSkill(sw, { name: "无名拳", archetype: "降龙十八掌" });
    expect(skill.archetype).toBe("硬攻");
    expect(skill.moveType).toBe("攻击");
  });

  it("growthMode 独门：出完整版 learned 招，不可升阶", () => {
    const skill = compileEmergentSkill({ ...sw, growthMode: "独门" }, { name: "雪夜一刀", archetype: "硬攻" });
    expect(skill.fixed).toBe(true);
    expect(skill.upgradable).toBe(false);
    expect(skill.source).toBe("奇遇");
    expect(skill.move.baseDamageMultiplier).toBeCloseTo(1.5);
  });

  it("内功按品阶表赋 maxHp；轻功赋 speedBonus", () => {
    const nei = compileEmergentSkill(sw, { name: "寒潭服气法", skillType: "内功" });
    expect(nei.passiveBonus).toEqual({ maxHp: 28 }); // 紫档
    expect(nei.move).toBeUndefined();
    const qing = compileEmergentSkill(sw, { name: "踏雪无痕步", skillType: "轻功" });
    expect(qing.passiveBonus).toEqual({ speedBonus: 2 });
  });

  it("确定性：同参两次逐字节相同", () => {
    const fill = { name: "断崖一剑", archetype: "硬攻" };
    expect(JSON.stringify(compileEmergentSkill(sw, fill))).toBe(JSON.stringify(compileEmergentSkill(sw, fill)));
  });

  it("残缺入参返回 null", () => {
    expect(compileEmergentSkill(null, {})).toBeNull();
    expect(compileEmergentSkill(sw, {})).toBeNull();
  });
});
