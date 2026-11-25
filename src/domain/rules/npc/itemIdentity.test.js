// WO-23D0a 赎回身份保留契约测试
import { describe, expect, it } from "vitest";
import { sellToNpcCarry, buyFromNpcCarry, resolveBuyInId } from "./npcTradeFlow.js";
import { awakenableWeapons } from "../items/itemAwaken.js";

const npc = { id: "npc_shopkeeper", name: "老板", carriedItems: [], money: 999 };
const blade = { id: "wpn_001", name: "青钢剑", category: "weapon", equipped: true, sellPrice: 50 };

describe("WO-23D0a 赎回实例身份", () => {
  it("卖出带 id 武器再购回 id 不变", () => {
    const sell = sellToNpcCarry(npc, blade, { affection: 0 });
    expect(sell.ok).toBe(true);
    expect(sell.entry.id).toBe("wpn_001"); // sell 侧本就保 id
    const inShop = { ...npc, carriedItems: sell.nextCarriedItems };
    const shelfItem = sell.nextCarriedItems[0];
    const buy = buyFromNpcCarry(inShop, shelfItem, { affection: 0, money: 999 });
    expect(buy.ok).toBe(true);
    // 入包 id 裁决：原 id 保留
    const inId = resolveBuyInId(shelfItem, []);
    expect(inId).toBe("wpn_001");
  });

  it("awakenableWeapons 赎回后重新连上 ledger", () => {
    const ledger = { wpn_001: { awakenReady: true, awakened: false } };
    const sell = sellToNpcCarry(npc, blade, {});
    const shelfItem = sell.nextCarriedItems[0];
    const inId = resolveBuyInId(shelfItem, []);
    const state = { inv: [{ ...shelfItem, id: inId, category: "weapon", equipped: true }], varTree: { 世界: { 器物谱: ledger } } };
    expect(awakenableWeapons(state)).toHaveLength(1);
  });

  it("背包撞 id 仍铸新 id 不覆盖", () => {
    const inv = [{ id: "wpn_001", name: "另一把" }];
    const out = resolveBuyInId({ id: "wpn_001", name: "青钢剑" }, inv);
    expect(out).not.toBe("wpn_001");
    expect(out).toContain("青钢剑");
  });

  it("无 id 新货铸新 id；同名两件各按 id 不串", () => {
    const fresh = resolveBuyInId({ name: "新铸剑" }, []);
    expect(fresh).toContain("新铸剑");
    expect(fresh).not.toBe("wpn_001");
    // 同名两件：买第一件按 itemKey 精确命中不拿错
    const a = { id: "wpn_a", name: "铁刀", category: "weapon", price: 10, sellable: true };
    const b = { id: "wpn_b", name: "铁刀", category: "weapon", price: 10, sellable: true };
    const shop = { ...npc, carriedItems: [a, b] };
    const buy = buyFromNpcCarry(shop, { ...b }, { money: 99 });
    expect(buy.ok).toBe(true);
    expect(buy.nextCarriedItems.map((i) => i.id)).toEqual(["wpn_a"]); // 留下的必须是 a
  });
});
