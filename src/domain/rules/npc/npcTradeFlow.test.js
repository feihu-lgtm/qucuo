// 随身交易·C 通路单测：钟爱价档/割爱放行/sellCoef 分档/三态互斥/买卖落账。
import { describe, it, expect } from "vitest";
import {
  affectionOf, sellCoefOf, quoteBuy, quoteSell,
  buildCarryShelf, flattenShelf, buyFromNpcCarry, sellToNpcCarry, applyTradeToNpcState,
} from "./npcTradeFlow.js";
import { applyTradeToCarriedItems } from "./npcTrade.js";

const NPC = {
  id: "n_duo", name: "元朵朵",
  carriedItems: [
    { id: "n_duo_ci0", name: "元宝金冠襦装", category: "armor", quality: "橙", slot: "equipment", cherish: 95, price: 888 },
    { id: "n_duo_ci1", name: "沉甸甸的碎银荷包", category: "accessory", quality: "绿", slot: "bag", price: 40 },
    { id: "n_duo_ci2", name: "紫檀木齿轮", category: "misc", quality: "蓝", slot: "bag", price: 30, cherish: 60 },
    { id: "n_duo_m0", name: "铁伯", type: "机关人偶", slot: "mount" },
  ],
};

describe("货架换源：slot 分区 + 归宿过滤", () => {
  it("按 equipment/bag/mount 分区；stolen/dropped 不上架", () => {
    const npc = { ...NPC, carriedItems: [...NPC.carriedItems, { id: "s1", name: "赃物", category: "misc", quality: "白", stolen: true }] };
    const s = buildCarryShelf(npc, 0);
    expect(s.equipment.map(i => i.name)).toEqual(["元宝金冠襦装"]);
    expect(s.bag.map(i => i.name)).toEqual(["沉甸甸的碎银荷包", "紫檀木齿轮"]);
    expect(s.mount.map(i => i.name)).toEqual(["铁伯"]);
    expect(flattenShelf(s).some(i => i.name === "赃物")).toBe(false);
  });
});

describe("钟爱价档（quoteBuy）", () => {
  it("普通件底价；中钟爱 3 倍；挚爱默认拒售", () => {
    const bag = normalize2(NPC.carriedItems[1]);
    expect(quoteBuy(bag, 0)).toEqual({ mode: "normal", price: 40 });
    const mid = normalize2(NPC.carriedItems[2]); // cherish 60
    expect(quoteBuy(mid, 0)).toEqual({ mode: "cherish", price: 90 });
    const bel = normalize2(NPC.carriedItems[0]); // cherish 95
    expect(quoteBuy(bel, 0)).toEqual({ mode: "beloved", price: null });
  });

  it("割爱放行：好感≥60 且挚爱 → 2 倍价", () => {
    const bel = normalize2(NPC.carriedItems[0]);
    expect(quoteBuy(bel, 60)).toEqual({ mode: "geai", price: 1776 });
    expect(quoteBuy(bel, 59)).toEqual({ mode: "beloved", price: null });
  });

  it("mount 与 sellable=false 只展示不可买", () => {
    const mount = normalize2(NPC.carriedItems[3]);
    expect(quoteBuy(mount, 100)).toEqual({ mode: "mount", price: null });
    // 信物 cherish=90 落挚爱档——好感不够拒售，够 60 可以割爱
    const trophy = { name: "掌门信物令旗", category: "misc", quality: "白" };
    expect(quoteBuy(normalize2(trophy), 0).mode).toBe("beloved");
    const lowCherish = { name: "某物", category: "misc", quality: "白", sellable: false, cherish: 10 };
    expect(quoteBuy(normalize2(lowCherish), 0).mode).toBe("notForSale");
  });
});

describe("sellCoef 分档", () => {
  it("朵朵 2.5 / 奸商 0.7 / 普通 1.0 / 好感≥80 +0.3", () => {
    expect(sellCoefOf({ name: "元朵朵" }, 0)).toBe(2.5);
    expect(sellCoefOf({ name: "奸商贾", tradeStyle: "讨价还价，雁过拔毛" }, 0)).toBe(0.7);
    expect(sellCoefOf({ name: "路人甲" }, 0)).toBe(1.0);
    expect(sellCoefOf({ name: "路人甲" }, 80)).toBeCloseTo(1.3);
    expect(sellCoefOf({ name: "元朵朵" }, 80)).toBeCloseTo(2.8);
  });

  it("quoteSell 按系数取整，0 价不收", () => {
    expect(quoteSell({ name: "元朵朵" }, { name: "白刀", sellPrice: 10 }, 0)).toBe(25);
    expect(quoteSell({ name: "路人甲" }, { name: "白刀", sellPrice: 10 }, 0)).toBe(10);
    expect(quoteSell({ name: "路人甲" }, { name: "废", sellPrice: 0 }, 0)).toBe(0);
  });
});

describe("买入结算 buyFromNpcCarry", () => {
  it("平价买入：付钱、划掉条目、sold 落账", () => {
    const res = buyFromNpcCarry(NPC, { name: "沉甸甸的碎银荷包" }, { money: 100 });
    expect(res.ok).toBe(true);
    expect(res.price).toBe(40);
    expect(res.nextCarriedItems.map(i => i.name)).not.toContain("沉甸甸的碎银荷包");
    expect(res.nextCarriedItems).toHaveLength(3);
    expect(res.tradeDelta.sold.name).toBe("沉甸甸的碎银荷包");
  });

  it("挚爱拒售 → 好感 60 割爱 2 倍放行 + 特殊日志", () => {
    const refuse = buyFromNpcCarry(NPC, { name: "元宝金冠襦装" }, { money: 9999, affection: 0 });
    expect(refuse.ok).toBe(false);
    expect(refuse.logs[0].text).toContain("挚爱");
    const geai = buyFromNpcCarry(NPC, { name: "元宝金冠襦装" }, { money: 9999, affection: 60 });
    expect(geai.ok).toBe(true);
    expect(geai.price).toBe(1776);
    expect(geai.logs[0].text).toContain("割爱");
  });

  it("mount 与没钱都买不成；stolen 件互斥不能再卖", () => {
    expect(buyFromNpcCarry(NPC, { name: "铁伯" }, { money: 9999 }).ok).toBe(false);
    expect(buyFromNpcCarry(NPC, { name: "沉甸甸的碎银荷包" }, { money: 10 }).ok).toBe(false);
    const stolenNpc = { ...NPC, carriedItems: NPC.carriedItems.map(i => i.name === "沉甸甸的碎银荷包" ? { ...i, stolen: true } : i) };
    expect(buyFromNpcCarry(stolenNpc, { name: "沉甸甸的碎银荷包" }, { money: 100 }).ok).toBe(false);
  });
});

describe("卖出结算 sellToNpcCarry + 台账", () => {
  it("卖货入对方 bag、bought 落账、下回可被 steal/drop", () => {
    const res = sellToNpcCarry(NPC, { id: "p1", name: "铁剑", sellPrice: 20 }, { affection: 0 });
    expect(res.ok).toBe(true);
    expect(res.price).toBe(50); // 朵朵 2.5
    const bag = res.nextCarriedItems.at(-1);
    expect(bag.slot).toBe("bag");
    expect(bag.stolen).toBe(false);
    expect(res.tradeDelta.bought.name).toBe("铁剑");
    // 转手价=实收价，堵死同一件货低买高卖刷银子
    expect(bag.price).toBe(50);
    // 台账写进 npcState，固化叠加后仍能被偷（stolen:false 在位）
    const npcState = applyTradeToNpcState({}, NPC, res.tradeDelta);
    const back = applyTradeToCarriedItems(NPC.carriedItems, npcState.n_duo.trade);
    expect(back.some(i => i.name === "铁剑" && !i.stolen)).toBe(true);
  });

  it("买卖 roundtrip：买走后 sold 落账，固化出场不再出", () => {
    const buy = buyFromNpcCarry(NPC, { name: "沉甸甸的碎银荷包" }, { money: 100 });
    const npcState = applyTradeToNpcState({}, NPC, buy.tradeDelta);
    const back = applyTradeToCarriedItems(NPC.carriedItems, npcState.n_duo.trade);
    expect(back.map(i => i.name)).not.toContain("沉甸甸的碎银荷包");
    // 老档无 trade 字段兜底：空台账原样返回
    expect(applyTradeToCarriedItems(NPC.carriedItems, undefined)).toBe(NPC.carriedItems);
  });
});

describe("affectionOf", () => {
  it("读 varTree.角色[名].好感度，缺省 0", () => {
    expect(affectionOf({ 角色: { 元朵朵: { 好感度: 70 } } }, "元朵朵")).toBe(70);
    expect(affectionOf({}, "元朵朵")).toBe(0);
  });
});

// normalizeCarryEntry 的薄包装（真实数据层签名带 npc）
import { normalizeCarryEntry } from "./npcCarry.js";
const normalize2 = (entry) => normalizeCarryEntry(NPC, entry);
