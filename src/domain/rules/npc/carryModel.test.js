// 随身交易 schema（docs/设计_NPC随身交易.md §1）：normalizeCarryEntry 归一化 + §1.2 默认推导表。
import { describe, expect, it } from "vitest";
import { normalizeCarryEntry, rollNpcCarry } from "./npcCarry.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

const ALL_OC = [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP];

describe("normalizeCarryEntry 默认推导（§1.2 表）", () => {
  it("misc → bag 档可卖 0 钟爱", () => {
    const e = normalizeCarryEntry(null, { name: "核桃糕", category: "misc", quality: "蓝" });
    expect(e.slot).toBe("bag");
    expect(e.sellable).toBe(true);
    expect(e.cherish).toBe(0);
  });

  it.each([
    ["白", 15], ["绿", 30], ["蓝", 45], ["紫", 60], ["橙", 75], ["红", 90],
  ])("装备按品阶 ×15 定钟爱：%s → %d", (quality, cherish) => {
    const e = normalizeCarryEntry(null, { name: "试剑", category: "weapon", quality });
    expect(e.slot).toBe("equipment");
    expect(e.sellable).toBe(true);
    expect(e.cherish).toBe(cherish);
  });

  it("势力信物 90 钟爱不卖", () => {
    const e = normalizeCarryEntry(null, { name: "血刀信物", category: "misc", quality: "绿" });
    expect(e.sellable).toBe(false);
    expect(e.cherish).toBe(90);
  });

  it("签名武学类名目 80 钟爱不卖", () => {
    const e = normalizeCarryEntry(null, { name: "某某剑谱", category: "misc", quality: "紫" });
    expect(e.sellable).toBe(false);
    expect(e.cherish).toBe(80);
  });

  it("随从对象（type+desc 无 category）→ mount 档 100 钟爱不卖", () => {
    const e = normalizeCarryEntry(null, { type: "机关人偶", name: "铁伯", desc: "精铁紫檀造" });
    expect(e.slot).toBe("mount");
    expect(e.sellable).toBe(false);
    expect(e.cherish).toBe(100);
  });

  it("类目缺省查名录：stealables 装备名按 CATALOG_INDEX 归档", () => {
    const e = normalizeCarryEntry(null, { name: "紫岚织锦甲", quality: "紫", desc: "软绸甲" });
    expect(e.category).toBe("armor");
    expect(e.slot).toBe("equipment");
  });

  it("名录信物/武学别的名目也不卖：弟子令、残卷", () => {
    expect(normalizeCarryEntry(null, { name: "峨眉青玉弟子令" }).sellable).toBe(false);
    expect(normalizeCarryEntry(null, { name: "欢喜残卷" }).sellable).toBe(false);
  });

  it("显式标注优先于默认推导", () => {
    const e = normalizeCarryEntry(null, { name: "核桃糕", category: "misc", slot: "equipment", cherish: 95, sellable: false });
    expect(e.slot).toBe("equipment");
    expect(e.cherish).toBe(95);
    expect(e.sellable).toBe(false);
  });
});

describe("OC 数据全部过 schema", () => {
  it.each(ALL_OC.map((a) => [a.name, a]))("%s 的 carry/follower 归一化合法", (_n, adv) => {
    for (const c of adv.carry || []) {
      const e = normalizeCarryEntry(adv, c);
      expect(["equipment", "bag", "mount"]).toContain(e.slot);
      expect(typeof e.sellable).toBe("boolean");
      expect(e.cherish).toBeGreaterThanOrEqual(0);
      expect(e.cherish).toBeLessThanOrEqual(100);
    }
    if (adv.follower) {
      const f = normalizeCarryEntry(adv, adv.follower);
      expect(f.slot).toBe("mount");
      expect(f.sellable).toBe(false);
      expect(f.cherish).toBe(100);
    }
  });

  it("全部 OC carry 已在数据层标好 slot", () => {
    for (const adv of ALL_OC) {
      for (const c of adv.carry || []) {
        expect(c.slot, `${adv.name} carry ${c.name}`).toBeTruthy();
      }
    }
  });
});

describe("元朵朵标注", () => {
  const duo = ADVENTURER_POOL_IP.find((a) => a.id === "adv_yuanduoduo");
  it("襦装 equipment 档钟爱 95，荷包/核桃糕/地契归 bag", () => {
    const robe = duo.stealables.equipment.find((e) => e.name === "元宝金冠襦装");
    const nr = normalizeCarryEntry(duo, robe);
    expect(nr.slot).toBe("equipment");
    expect(nr.cherish).toBe(95);
    for (const c of duo.carry) {
      expect(normalizeCarryEntry(duo, c).slot).toBe("bag");
    }
  });

  it("铁伯按 mount 看待不卖", () => {
    const f = normalizeCarryEntry(duo, duo.follower);
    expect(f.slot).toBe("mount");
    expect(f.sellable).toBe(false);
    expect(f.cherish).toBe(100);
  });
});
