import { describe, it, expect } from "vitest";
import { applyNpcTradeDelta, applyTradeToCarriedItems, npcTradeOf, EMPTY_TRADE } from "./npcTrade.js";
import { ensureNpcCombatData } from "./npcGeneration.js";
import { buildSnapshot } from "../../../infra/saves.js";

const BASE_NPC = {
  id: "n_test", name: "测道人", levelCap: 0,
  special: { 体魄: 5, 根骨: 5, 臂力: 5, 身法: 5, 悟性: 5, 定力: 5, 魅力: 5, 福缘: 5 },
  carry: [
    { name: "钢刀", category: "weapon", quality: "白" },
    { name: "核桃糕", category: "misc", quality: "白" },
    { name: "旧铜镜", category: "misc", quality: "白" },
  ],
};

const names = (items) => items.map(i => i.name);

describe("applyNpcTradeDelta：买卖记账合并", () => {
  it("老档/首笔：空入参按空集兜底，sold 记账成立", () => {
    const t = applyNpcTradeDelta(undefined, { sold: { id: "n_test_ci0" } });
    expect(t).toEqual({ sold: { n_test_ci0: true }, bought: [] });
  });

  it("sold/bought 各一记、累加合并、不改写入参", () => {
    const t0 = { sold: {}, bought: [] };
    const t1 = applyNpcTradeDelta(t0, { sold: { id: "n_test_ci0", name: "钢刀" } });
    const t2 = applyNpcTradeDelta(t1, { bought: { id: "loot_1", name: "羊皮袄" } });
    expect(t1.sold.n_test_ci0).toBe(true);
    expect(t2.sold.n_test_ci0).toBe(true);
    expect(t2.bought).toHaveLength(1);
    expect(t2.bought[0].name).toBe("羊皮袄");
    expect(t0).toEqual({ sold: {}, bought: [] }); // 纯函数，入参原样
  });

  it("无 id 的条目按 name 记归属；sold 会把 bought 里同一件摘除", () => {
    let t = applyNpcTradeDelta(EMPTY_TRADE, { bought: { name: "羊皮袄" } });
    t = applyNpcTradeDelta(t, { sold: { name: "羊皮袄" } });
    expect(t.sold["羊皮袄"]).toBe(true);
    expect(t.bought).toHaveLength(0);
  });

  it("bought 按身份去重，且买回来清掉 sold 标", () => {
    let t = applyNpcTradeDelta(EMPTY_TRADE, { sold: { name: "钢刀" } });
    t = applyNpcTradeDelta(t, { bought: { name: "钢刀" } });
    t = applyNpcTradeDelta(t, { bought: { name: "钢刀" } });
    expect(t.sold["钢刀"]).toBeUndefined();
    expect(t.bought).toHaveLength(1);
  });
});

describe("applyTradeToCarriedItems：出场固化叠加", () => {
  const carried = [
    { id: "n_ci0", name: "钢刀", stolen: false },
    { id: "n_ci1", name: "核桃糕", stolen: true },
    { id: "n_ci2", name: "旧铜镜", stolen: false },
  ];

  it("无 trade 记录时原样返回（老档兜底空集）", () => {
    expect(applyTradeToCarriedItems(carried, undefined)).toBe(carried);
    expect(applyTradeToCarriedItems(carried, EMPTY_TRADE)).toBe(carried);
  });

  it("sold 剔除未落袋的货；bought 按身份补回、不重复", () => {
    const out = applyTradeToCarriedItems(carried, {
      sold: { n_ci0: true },
      bought: [{ id: "nb_1", name: "羊皮袄" }, { id: "n_ci2", name: "旧铜镜" }],
    });
    expect(names(out)).toEqual(["核桃糕", "旧铜镜", "羊皮袄"]);
    expect(out.find(i => i.name === "羊皮袄").stolen).toBe(false);
  });

  it("sold 与 stolen 互斥：已偷走的货不被 sold 标记改判", () => {
    const out = applyTradeToCarriedItems(carried, { sold: { n_ci1: true } });
    const stolen = out.find(i => i.id === "n_ci1");
    expect(stolen.stolen).toBe(true);
  });
});

describe("ensureNpcCombatData 出场固化叠加 trade delta", () => {
  it("sold 项不进货架、bought 项补进行囊（只认 options.trade）", () => {
    const trade = { sold: { n_test_ci0: true }, bought: [{ id: "nb_9", name: "羊皮袄" }] };
    const a = ensureNpcCombatData({ ...BASE_NPC }, { luck: 5, trade });
    expect(names(a.carriedItems)).toEqual(["核桃糕", "旧铜镜", "羊皮袄"]);
    // npc 本体的 trade 字段不生效：npc 可能整段来自提取模型，AI 补的 trade
    // 不能让随身物凭空增减（台账只能走 options，由系统侧 npcState 传入）。
    const b = ensureNpcCombatData({ ...BASE_NPC, trade }, { luck: 5 });
    expect(names(b.carriedItems)).toEqual(["钢刀", "核桃糕", "旧铜镜"]);
  });

  it("npcTradeOf 按 id 优先取台账，id 缺了按 name 退", () => {
    const npcState = { n_test: { trade: { sold: { i1: true }, bought: [] } }, 刀客甲: { trade: { sold: {}, bought: [{ id: "b2" }] } } };
    expect(npcTradeOf(npcState, { id: "n_test", name: "无关名" }).sold.i1).toBe(true);
    expect(npcTradeOf(npcState, { name: "刀客甲" }).bought[0].id).toBe("b2");
    expect(npcTradeOf(npcState, { id: "没见过的", name: "谁" })).toBeNull();
    expect(npcTradeOf(null, { id: "n_test" })).toBeNull();
  });

  it("无 trade 时 carry 原样固化，行为不变", () => {
    const n = ensureNpcCombatData({ ...BASE_NPC }, { luck: 5 });
    expect(names(n.carriedItems)).toEqual(["钢刀", "核桃糕", "旧铜镜"]);
  });
});

describe("存档序列化 roundtrip 含 npcState.trade", () => {
  const snap = buildSnapshot({
    preset: { id: "p", name: "测" },
    room: { name: "鱼定村" }, char: {}, dao: [], skills: [], inv: [], log: [],
    convo: [], exp: 0, pot: 0, flags: [], mapData: {}, time: 6, narrator: {},
    varTree: {}, questProgress: {}, npcState: { n_test: { trade: { sold: { i1: true }, bought: [{ id: "b1" }] } } },
  });
  it("buildSnapshot 落盘 npcState，JSON roundtrip 不丢", () => {
    const back = JSON.parse(JSON.stringify(snap));
    expect(back.npcState.n_test.trade.sold.i1).toBe(true);
    expect(back.npcState.n_test.trade.bought[0].id).toBe("b1");
  });
  it("老档无 npcState 按空集兜底", () => {
    const old = buildSnapshot({
      preset: { id: "p", name: "测" }, room: { name: "鱼定村" }, char: {}, dao: [],
      skills: [], inv: [], log: [], convo: [], exp: 0, pot: 0, flags: [], mapData: {},
      time: 6, narrator: {}, varTree: {}, questProgress: {},
    });
    expect(old.npcState).toEqual({});
  });
});
