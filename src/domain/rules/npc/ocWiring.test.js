// OC 落地通路测试：游走池抽中 OC / 店铺库存命中 catalog / 偷窃产出 stealables。
import { describe, expect, it } from "vitest";
import { ocWanderersAt, getRandomPassers } from "../../data/npc/randomPassers.js";
import { buildOcShopInventory } from "../../data/shops/qucuoShops.js";
import { rollNpcCarry } from "./npcCarry.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";
import { ensureNpcCombatData } from "./npcGeneration.js";

const OC_NAMES = new Set([...ADVENTURER_POOL, ...ADVENTURER_POOL_IP].map((a) => a.name));

describe("OC 游走池", () => {
  it("够多天内全图总能抽到 OC，且归属势力就近", () => {
    const seen = new Map();
    for (let day = 0; day < 60 && seen.size < 3; day++) {
      for (const node of ["锦官城", "广汉", "天都镇", "锦官城", "玉泉寨", "大草甸"]) {
        for (const oc of ocWanderersAt(node, day)) {
          seen.set(oc.name, { node, adv: oc.ocAdventurer });
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    for (const name of seen.keys()) expect(OC_NAMES.has(name)).toBe(true);
  });

  it("同日同节点结果确定，OC 混进当日过路人名单", () => {
    let found = null;
    outer: for (let day = 0; day < 90; day++) {
      for (const node of ["锦官城", "广汉", "天都镇", "大草甸", "玉泉寨", "雅江", "雾隐寨"]) {
        if (ocWanderersAt(node, day).length) { found = { node, day }; break outer; }
      }
    }
    expect(found).toBeTruthy();
    const again = ocWanderersAt(found.node, found.day);
    expect(again).toEqual(ocWanderersAt(found.node, found.day));
    const passers = getRandomPassers(found.node, found.day * 24);
    expect(passers.some((p) => p.ocAdventurer === again[0].ocAdventurer)).toBe(true);
  });
});

describe("OC 店铺", () => {
  it("朵朵万事屋可交易，真品名走 catalog 具名货", () => {
    const inv = buildOcShopInventory("元朵朵");
    expect(inv).toBeTruthy();
    expect(inv.shopName).toBe("朵朵万事屋");
    expect(inv.items.length).toBeGreaterThan(0);
    for (const it of inv.items) expect(it.name).toBeTruthy();
    // 找一个货品名命中 catalog 的 OC 校验具名货路径
    let hit = false;
    for (const adv of [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP]) {
      for (const g of adv.shop?.goods || []) {
        const n = typeof g === "string" ? g : g?.name;
        if (n && CATALOG_INDEX[n]) {
          const inv2 = buildOcShopInventory(adv.name);
          const stocked = inv2.items.find((i) => i.name === n);
          expect(stocked).toBeTruthy();
          hit = true;
        }
      }
    }
    expect(hit).toBe(true);
  });

  it("未入册的货也上架（misc 白档带 desc），无 shop 的 NPC 返回 null", () => {
    const inv = buildOcShopInventory("元朵朵");
    const fake = inv.items.find((i) => i.name === "纯金苍蝇拍");
    expect(fake).toBeTruthy();
    expect(fake.category).toBe("misc");
    expect(fake.desc).toBeTruthy();
    expect(buildOcShopInventory("不存在的摊主")).toBeNull();
  });
});

describe("OC stealables 偷窃通路", () => {
  it("OC 随身物 = carry 真词条 + stealables 装备/杂物", () => {
    const npc = { id: "oc_test", name: "元朵朵", district: "锦官城", ocAdventurer: "adv_yuanduoduo" };
    const items = rollNpcCarry(npc, { levelCap: 1 });
    const names = items.map((i) => i.name);
    expect(names).toContain("元宝金冠襦装");      // equipment 橙档
    expect(names).toContain("作废契约书");          // sundries
    expect(names).toContain("紫檀木齿轮");
    expect(names).toContain("沉甸甸的碎银荷包");    // carry 真词条
    for (const it of items) expect(it.stolen).toBe(false);
  });

  it("装备按名归档：兵刃归 weapon、衣甲归 armor", () => {
    const items = rollNpcCarry({ id: "t", name: "吕仙儿", npcRef: "adv_lvxianer" }, {});
    const spear = items.find((i) => i.name.includes("枪"));
    expect(spear?.category).toBe("weapon");
    const robe = rollNpcCarry({ id: "t2", name: "元朵朵", ocAdventurer: "adv_yuanduoduo" }, {}).find((i) => i.name === "元宝金冠襦装");
    expect(robe?.category).toBe("armor");
  });

  it("驻场/出场 OC（带 carry 数据卡）也能被摸到 stealables", () => {
    const oc = { id: "oc_res", name: "元朵朵", ocAdventurer: "adv_yuanduoduo", carry: [{ name: "沉甸甸的碎银荷包" }], levelCap: 1 };
    const fixed = ensureNpcCombatData(oc, {});
    const names = (fixed.carriedItems || []).map((i) => i.name);
    expect(names).toContain("元宝金冠襦装");
    expect(names).toContain("作废契约书");
  });

  it("同名驻场 NPC 保留自己的 carry，不被 OC 数据顶掉", () => {
    const resident = { id: "r1", name: "元朵朵", carry: [{ name: "沉甸甸的碎银荷包" }], levelCap: 1 };
    const fixed = ensureNpcCombatData(resident, {});
    const names = (fixed.carriedItems || []).map((i) => i.name);
    expect(names).toEqual(["沉甸甸的碎银荷包"]);
  });

  it("首饰归 accessory 不归 weapon", () => {
    const items = rollNpcCarry({ id: "t3", name: "越祈", npcRef: "adv_yueqi" }, {});
    const jewelry = items.filter((i) => i.category === "weapon");
    // 越祈身上不该有首饰被误判成兵刃
    for (const it of items) {
      if (/镯|环|坠|簪|佩|链/.test(it.name)) expect(it.category).not.toBe("weapon");
    }
  });

  it("非 OC 走原随机池不受影响", () => {
    const npc = { id: "t1", name: "周小满", role: "讨饭帮众", faction: "丐帮三星分舵", district: "广汉" };
    const items = rollNpcCarry(npc, { levelCap: 2 });
    expect(items.length).toBeGreaterThan(0);
  });
});
