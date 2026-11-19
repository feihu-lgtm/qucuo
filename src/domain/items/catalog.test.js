import { describe, it, expect } from "vitest";
import { CATALOG, CATALOG_INDEX, backfillItemFromCatalog, backfillInventoryFromCatalog } from "./catalog.js";

// 老档补丁：红档武器护甲补七维那次改动之后，早年存档里已经生成好的具名物品实例
// 仍旧停留在"诞生时那一刻"的 catalog 快照上（没有 sixDim/effect），需要读档时补齐。

describe("backfillItemFromCatalog", () => {
  it("给缺失 sixDim 的老实例补上 catalog 现有的 sixDim", () => {
    const named = CATALOG.find(e => e.sixDim && Object.keys(e.sixDim).length);
    expect(named, "catalog 里至少要有一件带 sixDim 的具名物品供测试").toBeTruthy();
    const staleInstance = { id: "x1", name: named.name, category: named.category, quality: named.quality, equipped: true };
    const patched = backfillItemFromCatalog(staleInstance);
    expect(patched.sixDim).toEqual(named.sixDim);
    // 其余字段（equipped 等实例状态）不受影响
    expect(patched.equipped).toBe(true);
    expect(patched.id).toBe("x1");
  });

  it("给缺失 effect 的老实例补上 catalog 现有的 effect", () => {
    const named = CATALOG.find(e => e.effect && Object.keys(e.effect).length);
    expect(named, "catalog 里至少要有一件带 effect 的具名物品供测试").toBeTruthy();
    const staleInstance = { id: "x2", name: named.name, category: named.category, quality: named.quality };
    const patched = backfillItemFromCatalog(staleInstance);
    expect(patched.effect).toEqual(named.effect);
  });

  it("不覆盖实例上已经存在的 sixDim/effect（打造/定制撞名场景）", () => {
    const named = CATALOG.find(e => e.sixDim && Object.keys(e.sixDim).length);
    const customSixDim = { 气运: 99 };
    const instance = { id: "x3", name: named.name, sixDim: customSixDim };
    const patched = backfillItemFromCatalog(instance);
    expect(patched.sixDim).toEqual(customSixDim);
  });

  it("名字对不上 catalog 的物品原样返回", () => {
    const instance = { id: "x4", name: "绝对不存在的名字·测试专用" };
    expect(backfillItemFromCatalog(instance)).toBe(instance);
  });

  it("非具名的匿名装备/纯字符串道具原样放过", () => {
    expect(backfillItemFromCatalog(null)).toBe(null);
    expect(backfillItemFromCatalog(undefined)).toBe(undefined);
    const noName = { id: "x5", category: "misc" };
    expect(backfillItemFromCatalog(noName)).toBe(noName);
  });

  it("已经带完整字段的实例视为已是最新，不触发改动（返回值 patch 为空时原样返回同一引用）", () => {
    const named = CATALOG.find(e => e.sixDim && e.effect);
    if (named) {
      const upToDate = { id: "x6", name: named.name, sixDim: { ...named.sixDim }, effect: { ...named.effect } };
      expect(backfillItemFromCatalog(upToDate)).toBe(upToDate);
    }
  });
});

describe("backfillInventoryFromCatalog", () => {
  it("整袋子补齐：红档武器护甲即便老实例没带七维，读档后也应与 catalog 一致", () => {
    const redGearWithSixDim = CATALOG.filter(e => (e.category === "weapon" || e.category === "armor") && e.quality === "红" && e.sixDim);
    expect(redGearWithSixDim.length).toBeGreaterThan(0);
    const staleInv = redGearWithSixDim.map((e, i) => ({
      id: `old_${i}`, name: e.name, category: e.category, quality: e.quality, equipped: false,
      // 模拟老存档：atk/def 等基础数值都在，唯独没有 sixDim（诞生时 catalog 还没补）
    }));
    const migrated = backfillInventoryFromCatalog(staleInv);
    for (let i = 0; i < migrated.length; i++) {
      expect(migrated[i].sixDim).toEqual(redGearWithSixDim[i].sixDim);
    }
  });

  it("混杂纯字符串道具的背包不会报错，字符串项原样保留", () => {
    const inv = ["一枚铜钱", { id: "y1", name: "不存在的名字" }];
    const migrated = backfillInventoryFromCatalog(inv);
    expect(migrated[0]).toBe("一枚铜钱");
    expect(migrated[1]).toEqual({ id: "y1", name: "不存在的名字" });
  });

  it("非数组输入原样返回，不抛错", () => {
    expect(backfillInventoryFromCatalog(null)).toBe(null);
    expect(backfillInventoryFromCatalog(undefined)).toBe(undefined);
  });
});
