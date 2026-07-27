import { describe, it, expect } from "vitest";
import { makeItem, computeEquippedStats, effectiveSpecial, mergeItemEffects, toggleEquip } from "./equipment.js";
import { makeItemSmart, makeNamedItem, CATALOG_INDEX } from "./items/catalog.js";

const mk = (spec) => makeItemSmart(spec, makeItem);

// 【实测反馈】"所有打造装备的特效都没有生效，只生效了基础攻防""加根骨加气运也没加上"。
// 根因在**生产侧**：equipment.makeItem 的解构参数只列了 { name, category, quality, desc }，
// 调用方（铸剑坊交付、金玉行、任务发放…）传进来的 effect 与 sixDim 被静默丢掉，
// 于是打造出的装备只剩 statsForQuality 给的基础攻防。
// 消费侧一直是好的：computeEquippedStats 聚合 sixDimBonus、effectiveSpecial 叠到七维、
// mergeItemEffects 叠到招式，单挑(DuelScreen)与2v2(teamUnits)两条战斗路径都接了。
// 所以这个 bug 的表现恰好是"基础攻防有、其余全无"——非常精确地对应了那一行解构。

describe("生产侧：makeItem 必须收下 effect / sixDim", () => {
  it("传了 sixDim 就要留在物品上", () => {
    const it = makeItem({ name: "定制剑", category: "weapon", quality: "紫", sixDim: { 根骨: 2, 气运: 1 } });
    expect(it.sixDim).toEqual({ 根骨: 2, 气运: 1 });
  });

  it("传了 effect 就要留在物品上", () => {
    const it = makeItem({ name: "定制剑", category: "weapon", quality: "紫", effect: { lowHpBonus: 0.15 } });
    expect(it.effect).toEqual({ lowHpBonus: 0.15 });
  });

  it("基础攻防照旧（不能为了加词条把原有的算坏）", () => {
    const it = makeItem({ name: "定制剑", category: "weapon", quality: "紫", sixDim: { 根骨: 2 } });
    expect(it.atk).toBeGreaterThan(0);
    expect(it.durability).toBeGreaterThan(0);
    expect(it.buyPrice).toBeGreaterThan(0);
  });

  it("没传就不凭空长出字段（保持对象干净）", () => {
    const it = makeItem({ name: "粗布衣", category: "armor", quality: "白" });
    expect(it.effect).toBeUndefined();
    expect(it.sixDim).toBeUndefined();
  });

  it("consumable 与 tags 同样要收下（食物 buff / 分类筛选要用）", () => {
    const it = makeItem({ name: "定制点心", category: "misc", quality: "绿", consumable: { hpRestore: 0.1 }, tags: ["食物"] });
    expect(it.consumable).toEqual({ hpRestore: 0.1 });
    expect(it.tags).toEqual(["食物"]);
  });

  it("传入的对象被拷贝，不与调用方共享引用", () => {
    const src = { 根骨: 2 };
    const it = makeItem({ name: "x", category: "weapon", quality: "紫", sixDim: src });
    src.根骨 = 99;
    expect(it.sixDim.根骨).toBe(2);
  });
});

describe("makeItemSmart：具名以 catalog 为准，但显式词条要补上", () => {
  it("命中 catalog 的具名物走 catalog 数值", () => {
    const name = Object.keys(CATALOG_INDEX)[0];
    const it = mk({ name });
    expect(it.named || it.standardIssue).toBe(true);
  });

  it("未命中 catalog 时走兜底，且词条保住", () => {
    const it = mk({ name: "绝不可能在目录里的定制剑", category: "weapon", quality: "紫", sixDim: { 气运: 2 } });
    expect(it.sixDim).toEqual({ 气运: 2 });
  });

  it("撞名时 catalog 已有的键不被覆盖，缺的才补", () => {
    // 折柳在 catalog 里带 sixDim:{身法:2}
    const zheliu = makeNamedItem("折柳");
    if (zheliu?.sixDim) {
      const it = mk({ name: "折柳", sixDim: { 身法: 99, 气运: 3 } });
      expect(it.sixDim.身法).toBe(zheliu.sixDim.身法);  // catalog 优先
      expect(it.sixDim.气运).toBe(3);                    // 缺的补上
    }
  });
});

describe("消费侧：装上之后真的生效（这一半原本就是好的）", () => {
  const forged = mk({
    name: "寒霜定制剑", category: "weapon", quality: "紫",
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.3 },
    sixDim: { 根骨: 2, 气运: 1 },
  });

  it("装上后六维加成被聚合", () => {
    const inv = [{ ...forged, equipped: true }];
    expect(computeEquippedStats(inv).sixDimBonus).toEqual({ 根骨: 2, 气运: 1 });
  });

  it("有效七维 = 基础 + 装备加成", () => {
    const inv = [{ ...forged, equipped: true }];
    const eff = effectiveSpecial({ 根骨: 5, 气运: 5, 身法: 5 }, inv);
    expect(eff.根骨).toBe(7);
    expect(eff.气运).toBe(6);
    expect(eff.身法).toBe(5);
  });

  it("特效被聚合成 equipEffects（供招式叠加）", () => {
    const inv = [{ ...forged, equipped: true }];
    expect(computeEquippedStats(inv).equipEffects.applyMarkChance).toBe(0.3);
  });

  it("卸下之后加成消失（不是一装上就永久生效）", () => {
    let inv = [{ ...forged, equipped: true }];
    expect(effectiveSpecial({ 根骨: 5 }, inv).根骨).toBe(7);
    inv = toggleEquip(inv, inv[0].id);
    expect(effectiveSpecial({ 根骨: 5 }, inv).根骨).toBe(5);
  });

  it("多件叠加（两件各 +1 气运 → +2）", () => {
    const a = { ...mk({ name: "甲", category: "accessory", quality: "紫", sixDim: { 气运: 1 } }), equipped: true, id: "a" };
    const b = { ...mk({ name: "乙", category: "accessory", quality: "紫", sixDim: { 气运: 1 } }), equipped: true, id: "b" };
    expect(computeEquippedStats([a, b]).sixDimBonus.气运).toBe(2);
  });

  it("未装备的不计入", () => {
    expect(computeEquippedStats([{ ...forged, equipped: false }]).sixDimBonus).toEqual({});
  });

  it("mergeItemEffects 脏输入不炸", () => {
    expect(() => mergeItemEffects([null, {}, { effect: null }])).not.toThrow();
  });
});
