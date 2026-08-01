import { describe, it, expect } from "vitest";
import {
  TECHNIQUES, TECHNIQUE_IDS, COOKWARE, COOKWARE_BY_ID, DEFAULT_COOKWARE_ID,
  RECIPES, matchRecipe, canUseTechnique, computeDish, genericDishEffect,
  ownedCookware, availableMaterials, isCookingMaterial, INGREDIENT_LORE,
} from "./cooking.js";
import { STARTER_COOKING_STOCK, defaultChestStock } from "./homestead.js";

describe("cooking · 配方裁决 matchRecipe", () => {
  it("料槽组合不分先后：冷锅鱼三料任意排列都命中", () => {
    const a = matchRecipe(["青衣江团鱼", "熊山花椒", "雅江菜籽油"], "炒");
    const b = matchRecipe(["雅江菜籽油", "青衣江团鱼", "熊山花椒"], "炒");
    expect(a?.name).toBe("冷锅鱼");
    expect(b?.name).toBe("冷锅鱼");
  });

  it("技法不对不命中：同样的料，炖法做不出冷锅鱼", () => {
    expect(matchRecipe(["青衣江团鱼", "熊山花椒", "雅江菜籽油"], "炖")).toBeNull();
  });

  it("料不对不命中：少一味或多一味都摇头", () => {
    expect(matchRecipe(["青衣江团鱼", "熊山花椒"], "炒")).toBeNull();
    expect(matchRecipe(["青衣江团鱼", "熊山花椒", "雅江菜籽油", "贡措海盐"], "炒")).toBeNull();
  });

  it("空料槽不命中", () => {
    expect(matchRecipe([], "炖")).toBeNull();
    expect(matchRecipe([null, null], "炖")).toBeNull();
  });

  it("每道配方都能被自己的料×技法复现（全表自检）", () => {
    for (const r of RECIPES) {
      expect(matchRecipe(r.materials, r.technique)?.name).toBe(r.name);
    }
  });
});

describe("cooking · 技法可用性 canUseTechnique", () => {
  it("蒸必须有 canSteam 的炊具", () => {
    expect(canUseTechnique("蒸", COOKWARE_BY_ID[DEFAULT_COOKWARE_ID])).toBe(false); // 旧铁锅不能蒸
    expect(canUseTechnique("蒸", COOKWARE_BY_ID.zhenglong)).toBe(true);            // 蒸笼能蒸
    expect(canUseTechnique("蒸", COOKWARE_BY_ID.qingtongding)).toBe(true);         // 青铜鼎能蒸
  });

  it("其余技法不挑炊具", () => {
    for (const tid of TECHNIQUE_IDS.filter(t => t !== "蒸")) {
      expect(canUseTechnique(tid, COOKWARE_BY_ID[DEFAULT_COOKWARE_ID])).toBe(true);
      expect(canUseTechnique(tid, null)).toBe(true);
    }
  });
});

describe("cooking · 炊具加成 computeDish", () => {
  const maxHp = 100;
  it("旧铁锅无加成：牦牛骨汤回血 18 点", () => {
    const r = matchRecipe(["牦牛腱子肉", "贡措海盐"], "炖");
    const d = computeDish(r, "炖", COOKWARE_BY_ID[DEFAULT_COOKWARE_ID], maxHp);
    expect(d.hpDelta).toBe(18);
    expect(d.buffs).toEqual([]);
  });

  it("熊山陶炖罐炖 +5%：牦牛骨汤回血 23 点", () => {
    const r = matchRecipe(["牦牛腱子肉", "贡措海盐"], "炖");
    const d = computeDish(r, "炖", COOKWARE_BY_ID.taoguan, maxHp);
    expect(d.hpDelta).toBe(23); // 0.18 + 0.05
  });

  it("孟记炒锅炒 buff +5 回合：冷锅鱼身法 buff 25→30", () => {
    const r = matchRecipe(["青衣江团鱼", "熊山花椒", "雅江菜籽油"], "炒");
    const d = computeDish(r, "炒", COOKWARE_BY_ID.chaoguo, maxHp);
    expect(d.buffs[0]).toMatchObject({ attr: "身法", val: 2, turns: 30 });
  });

  it("青铜鼎全技法 +12% 回血 +10 buff：松茸蒸鸡 40%→52%", () => {
    const r = matchRecipe(["雪山雪鸡肉", "熊山松茸", "喇嘛庙藏红花"], "蒸");
    const d = computeDish(r, "蒸", COOKWARE_BY_ID.qingtongding, maxHp);
    expect(d.hpDelta).toBe(52); // 0.40 + 0.12
    expect(d.buffs[0].turns).toBe(50); // 40 + 10
  });

  it("炊具加成不跨技法泄漏：陶炖罐的炖加成用在炒上是 0", () => {
    const r = matchRecipe(["青衣江团鱼", "熊山花椒", "雅江菜籽油"], "炒");
    const d = computeDish(r, "炒", COOKWARE_BY_ID.taoguan, maxHp);
    expect(d.hpDelta).toBe(22); // 冷锅鱼基础 0.22，陶罐不给炒加成
  });
});

describe("cooking · 炊具持有 ownedCookware", () => {
  it("空背包也有默认旧铁锅", () => {
    const own = ownedCookware([]);
    expect(own.some(c => c.id === DEFAULT_COOKWARE_ID)).toBe(true);
  });

  it("背包有蒸笼才多出蒸笼", () => {
    const own = ownedCookware([{ name: "竹编蒸笼（三层）", category: "misc" }]);
    expect(own.some(c => c.id === "zhenglong")).toBe(true);
    expect(own.some(c => c.id === "qingtongding")).toBe(false);
  });

  it("字符串物品也认名", () => {
    const own = ownedCookware(["三星堆仿青铜鼎"]);
    expect(own.some(c => c.id === "qingtongding")).toBe(true);
  });
});

describe("cooking · 材料判定 isCookingMaterial / availableMaterials", () => {
  it("tags 含食材/调味品的算材料", () => {
    expect(isCookingMaterial({ name: "某物", tags: ["食材"] })).toBe(true);
    expect(isCookingMaterial({ name: "某物", tags: ["调味品"] })).toBe(true);
    expect(isCookingMaterial({ name: "某物", tags: ["武器"] })).toBe(false);
  });

  it("名字在配方用料里也算材料（兼容尚未补 tags 的在库件）", () => {
    expect(isCookingMaterial({ name: "牦牛腱子肉" })).toBe(true); // 无 tags 但配方要用
    expect(isCookingMaterial({ name: "鱼定枪" })).toBe(false);
  });

  it("availableMaterials 按名去重计数", () => {
    const inv = [
      { name: "熊山花椒", tags: ["调味品"] },
      { name: "熊山花椒", tags: ["调味品"] },
      { name: "贡措海盐", tags: ["调味品"] },
      { name: "鱼定枪", category: "weapon" },
    ];
    const mats = availableMaterials(inv);
    expect(mats.find(m => m.name === "熊山花椒").count).toBe(2);
    expect(mats.find(m => m.name === "贡措海盐").count).toBe(1);
    expect(mats.find(m => m.name === "鱼定枪")).toBeUndefined();
  });
});

describe("cooking · 数据自洽", () => {
  it("5 种技法齐全", () => {
    expect(TECHNIQUE_IDS).toEqual(["炖", "炒", "烤", "腌", "蒸"]);
  });

  it("10 件炊具，品阶分布 白3/绿4/蓝2/紫1", () => {
    expect(COOKWARE).toHaveLength(10);
    const byQ = {};
    COOKWARE.forEach(c => { byQ[c.quality] = (byQ[c.quality] || 0) + 1; });
    expect(byQ).toEqual({ 白: 3, 绿: 4, 蓝: 2, 紫: 1 });
  });

  it("恰好一件默认锅，且至少一件能蒸", () => {
    expect(COOKWARE.filter(c => c.default)).toHaveLength(1);
    expect(COOKWARE.some(c => c.canSteam)).toBe(true);
  });

  it("配方的技法都是合法技法", () => {
    for (const r of RECIPES) expect(TECHNIQUES[r.technique]).toBeTruthy();
  });
});

describe("cooking · 自由组合保底 genericDishEffect", () => {
  const maxHp = 100;
  it("炖保底回血 12%，无 buff", () => {
    const d = genericDishEffect("炖", COOKWARE_BY_ID[DEFAULT_COOKWARE_ID], maxHp);
    expect(d.hpDelta).toBe(12);
    expect(d.buffs).toEqual([]);
  });

  it("炒保底带身法 buff", () => {
    const d = genericDishEffect("炒", COOKWARE_BY_ID[DEFAULT_COOKWARE_ID], maxHp);
    expect(d.buffs[0]).toMatchObject({ attr: "身法", val: 1 });
  });

  it("炊具加成同样生效：青铜鼎全技法 +12%", () => {
    const d = genericDishEffect("炖", COOKWARE_BY_ID.qingtongding, maxHp);
    expect(d.hpDelta).toBe(24); // 0.12 + 0.12
  });

  it("自由组合数值整体低于固定配方（想象归 AI、数值不许超纲）", () => {
    const free = genericDishEffect("炖", COOKWARE_BY_ID[DEFAULT_COOKWARE_ID], maxHp);
    const recipe = computeDish(matchRecipe(["牦牛腱子肉", "贡措海盐"], "炖"), "炖", COOKWARE_BY_ID[DEFAULT_COOKWARE_ID], maxHp);
    expect(free.hpRatio).toBeLessThan(recipe.hpRatio);
  });
});

describe("cooking · 风物志 INGREDIENT_LORE", () => {
  it("食材调味料都有风物白描（AI 出菜的想象依据）", () => {
    expect(Object.keys(INGREDIENT_LORE)).toHaveLength(31); // 设计稿 30 件 + 在库的牦牛奶酪
    for (const [name, lore] of Object.entries(INGREDIENT_LORE)) {
      expect(name.length, `${name} 名字非空`).toBeGreaterThan(0);
      expect(lore.length, `${name} 风物志非空`).toBeGreaterThan(0);
    }
  });

  it("全部配方用料都查得到风物志（小总结有料可引）", () => {
    for (const r of RECIPES) {
      for (const m of r.materials) expect(INGREDIENT_LORE[m], `${m} 应有风物志`).toBeTruthy();
    }
  });
});

describe("cooking · 库房开局家底 defaultChestStock", () => {
  it("30 种各按 count 展开，白绿×3 蓝×2", () => {
    expect(STARTER_COOKING_STOCK).toHaveLength(30);
    const stock = defaultChestStock();
    const total = STARTER_COOKING_STOCK.reduce((s, x) => s + x.count, 0);
    expect(stock).toHaveLength(total);
  });

  it("每件家底都是烹饪台认得的食材/调味料", () => {
    for (const it of defaultChestStock()) expect(isCookingMaterial(it)).toBe(true);
  });

  it("家底物件都带唯一 id（同名多件可分别存取）", () => {
    const ids = defaultChestStock().map(it => it.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
