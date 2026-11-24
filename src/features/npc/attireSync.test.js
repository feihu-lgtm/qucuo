// 随身交易 D 分区数据 + E 换装同步链：货架读 carriedItems（唯一 live 源），
// 装备变动即时反映到 attireExposure/npcGear（look 卡与 prompt 段同一份推导）。
import { describe, it, expect } from "vitest";
import { attireExposure, cherishHearts, normalizeCarryEntry } from "../../domain/rules/npc/npcCarry.js";
import { npcGear, deriveAppearance, npcLookCard, buildNpcLookPrompt } from "../../domain/rules/npc/npcLookBrief.js";
import { buildCarryShelf, buyFromNpcCarry } from "../../domain/rules/npc/npcTradeFlow.js";
import { giftNpc } from "./exchange.js";

const SWORD = { id: "c1", name: "青锋剑", category: "weapon", quality: "绿", slot: "equipment", sellable: true, price: 80, cherish: 20 };
const ROBE = { id: "c2", name: "素布襦装", category: "armor", quality: "白", slot: "equipment", sellable: true, price: 30, cherish: 95 };
const BUN = { id: "c3", name: "桂花糕", category: "misc", slot: "bag", sellable: true, price: 5 };
const BO = { id: "f1", name: "铁伯", type: "follower", slot: "mount", desc: "生死之交" };

const mkNpc = (items) => ({ id: "npc_1", name: "朵朵", carriedItems: items });
// OC 实例：卡面 carry/stealables 被 spread 摊在实例上（证明“这人有过装备”）
const mkOc = (items) => ({ ...mkNpc(items), carry: [ROBE], stealables: { equipment: [ROBE], sundries: [] } });
const mkState = (npc) => ({ char: { money: 200 }, inv: [{ id: "p1", name: "乌木杖", category: "weapon", quality: "绿", attack: 12 }], room: { npcs: [npc] }, varTree: {}, flags: [], questProgress: {} });

describe("货架三分区（buildCarryShelf→面板数据）", () => {
  it("按 slot 分区、挂载区只展示不卖", () => {
    const s = buildCarryShelf(mkNpc([SWORD, BUN, BO]));
    expect(s.equipment.map(e => e.name)).toContain("青锋剑");
    expect(s.bag.map(e => e.name)).toEqual(["桂花糕"]);
    expect(s.mount.map(e => e.name)).toEqual(["铁伯"]);
    expect(s.mount[0].notForSale).toBe(true);
    expect(s.mount[0].buyPrice).toBeNull();
  });
  it("cherish 密度 ♥♥♥/♥♥/♥ 与不卖标记", () => {
    expect(cherishHearts(95)).toBe("♥♥♥");
    expect(cherishHearts(60)).toBe("♥♥");
    expect(cherishHearts(20)).toBe("♥");
    expect(cherishHearts(0)).toBe("");
    const s = buildCarryShelf(mkNpc([ROBE]));
    expect(s.equipment[0].cherish).toBe(95);
    expect(s.equipment[0].notForSale).toBe(true); // 挚爱拒售
  });
});

describe("attireExposure / npcGear", () => {
  it("没有 carriedItems 的 NPC 不报暴露", () => {
    expect(attireExposure({ name: "路人" })).toBeNull();
  });
  it("披甲带兵不暴露；只剩饰物报零星；装备空报衣不蔽体", () => {
    expect(attireExposure(mkNpc([SWORD, ROBE]))).toBeNull();
    const accOnly = mkOc([{ name: "松石耳坠", category: "accessory", slot: "equipment" }, BUN]);
    expect(attireExposure(accOnly)).toBe("只剩零星饰物在身");
    expect(attireExposure(mkOc([BUN]))).toBe("衣不蔽体");
    expect(attireExposure(mkNpc([{ ...SWORD, stolen: true }]))).toBe("衣不蔽体");
  });
  it("生成即空/本就没装备的 NPC 不叫被扒", () => {
    // ensureNpcCombatData 给普通 NPC 铺的 carriedItems:[]，没穿过不叫扒空
    expect(attireExposure(mkNpc([]))).toBeNull();
    // 身上只有杂物也算
    expect(attireExposure(mkNpc([BUN]))).toBeNull();
    // 只有饰物没甲刃史同样不报
    expect(attireExposure(mkNpc([{ name: "松石耳坠", category: "accessory", slot: "equipment" }]))).toBeNull();
  });
  it("npcGear 列装备槽货、滤掉已离手件；袋装货不算装束", () => {
    expect(npcGear(mkNpc([SWORD, BUN]))).toEqual(["青锋剑"]);
    expect(npcGear(mkNpc([{ ...SWORD, sold: true }]))).toEqual([]);
    // 玩家卖给 NPC 的装备落在 bag 槽——是存货不是穿着
    const bagged = { name: "乌木杖", category: "weapon", slot: "bag", sellable: true };
    expect(npcGear(mkNpc([bagged]))).toEqual([]);
  });
  it("look 卡与 prompt 段带衣着状态", () => {
    const naked = mkOc([BUN]);
    expect(npcLookCard(naked).some(l => l.text.includes("衣不蔽体"))).toBe(true);
    expect(buildNpcLookPrompt(naked).user).toContain("衣着状态：衣不蔽体");
    expect(buildNpcLookPrompt(mkNpc([SWORD])).user).not.toContain("衣不蔽体");
  });
});

describe("换装同步链：买 / 赠", () => {
  it("买走装备槽货 → log 记脱下了、外观即时变", () => {
    // OC 被买空：条件从 carriedItems 删掉，卡面 stealables.equipment 还记着
    // 她有过襦装——attireExposure 照样报衣不蔽体。
    const npc = mkOc([SWORD, BUN]);
    const res = buyFromNpcCarry(npc, SWORD, { money: 200 });
    expect(res.ok).toBe(true);
    expect(res.logs.some(l => l.text.includes("脱下了青锋剑"))).toBe(true);
    const after = { ...npc, carriedItems: res.nextCarriedItems };
    expect(attireExposure(after)).toBe("衣不蔽体");
    expect(npcGear(after)).toEqual([]);
  });
  it("赠送装备 → 写入 carriedItems（货架/偷池都读得见）且全属性保留", () => {
    const npc = mkNpc([BUN]);
    const r = giftNpc(mkState(npc), npc, { id: "p1", name: "乌木杖", category: "weapon", quality: "绿", attack: 12 });
    expect(r.logs.some(l => l.text.includes("换上了乌木杖"))).toBe(true);
    const after = r.changes.room({ npcs: [npc] }).npcs[0];
    const worn = after.carriedItems.find(i => i.name === "乌木杖");
    expect(worn.attack).toBe(12);
    expect(worn.slot).toBe("equipment");
    const shelf = buildCarryShelf(after);
    expect(shelf.equipment.map(e => e.name)).toContain("乌木杖");
  });
});
