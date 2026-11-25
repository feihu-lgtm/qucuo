// WO-23D0b 台账实例优先于模板重抽
import { describe, expect, it } from "vitest";
import { applyTradeToCarriedItems } from "./npcTrade.js";
import { sellToNpcCarry, buyFromNpcCarry } from "./npcTradeFlow.js";

const npc = { id: "npc_wander", name: "行商", carriedItems: [], money: 999 };
// 出场固化模板：重抽同 id（`${npc.id}_ci${i}` 口径）——模板无铭文
const templateBlade = { id: "npc_wander_ci0", name: "青钢剑", category: "weapon", price: 60, slot: "bag" };
const playerBlade = { ...templateBlade, sellPrice: 50, inscription: "寒锋三尺随主行" };

describe("WO-23D0b 实例快照不被模板顶掉", () => {
  it("卖出带铭文物品→离场重抽模板→进场台账实例优先（同 id 同铭文）", () => {
    // 玩家卖出带铭文实例 → 台账 bought
    const sell = sellToNpcCarry(npc, playerBlade, {});
    expect(sell.ok).toBe(true);
    expect(sell.entry.inscription).toBe("寒锋三尺随主行");
    // 离场再进场：出场固化重抽模板含同 id 货 + 台账叠加
    const regen = [templateBlade, { id: "npc_wander_ci1", name: "布鞋", slot: "bag" }];
    const trade = { sold: {}, bought: [sell.entry] };
    const out = applyTradeToCarriedItems(regen, trade);
    const copies = out.filter((i) => i.id === "npc_wander_ci0");
    expect(copies).toHaveLength(1); // 同 id 只留一件
    expect(copies[0].inscription).toBe("寒锋三尺随主行"); // 是台账实例不是模板
    // 购回链路同 id 同铭文
    const shopNpc = { ...npc, carriedItems: out };
    const buy = buyFromNpcCarry(shopNpc, copies[0], { money: 999 });
    expect(buy.ok).toBe(true);
    expect(buy.entry.id).toBe("npc_wander_ci0");
  });

  it("无台账模板货照常上架", () => {
    const out = applyTradeToCarriedItems([templateBlade], null);
    expect(out).toHaveLength(1);
    expect(out[0].inscription).toBeUndefined();
    const out2 = applyTradeToCarriedItems([templateBlade], { sold: {}, bought: [] });
    expect(out2).toHaveLength(1);
  });

  it("同名两件不串：异 id 同名各自留存", () => {
    const other = { id: "npc_wander_ci9", name: "青钢剑", slot: "bag", price: 60 };
    const sell = sellToNpcCarry(npc, playerBlade, {});
    const out = applyTradeToCarriedItems([templateBlade, other], { sold: {}, bought: [sell.entry] });
    expect(out.filter((i) => i.name === "青钢剑")).toHaveLength(2);
    expect(out.some((i) => i.id === "npc_wander_ci9")).toBe(true);
    expect(out.find((i) => i.id === "npc_wander_ci0").inscription).toBe("寒锋三尺随主行");
  });

  it("stolen/dropped 模板不被 bought 压掉（归宿互斥优先）", () => {
    const stolenTemplate = { ...templateBlade, stolen: true };
    const sell = sellToNpcCarry(npc, playerBlade, {});
    const out = applyTradeToCarriedItems([stolenTemplate], { sold: {}, bought: [sell.entry] });
    // 模板已被偷（归宿已定）保留原位；台账实例同 id 被 present 去重——极端撞车保归宿
    expect(out.some((i) => i.stolen)).toBe(true);
  });
});
