// WO-23A 宿敌谱名册底座契约测试
import { describe, expect, it } from "vitest";
import {
  NEMESIS_FACTIONS, nemesisEntryId, findNemesisEntry,
  scarAttrOfMove, scarAttrFromBattleLog, recordNemesisDuel,
} from "./nemesisEngine.js";
import { settleNpcDuel } from "../../../features/npc/settleDuel.js";

const bandit = { name: "巴桑", faction: "黑风寨", levelCap: 2, baseRole: "头目" };

describe("nemesisEngine 名册记账", () => {
  it("玩家落败新入谱：tier1/grudge1/形状契约 entries 字典", () => {
    const out = recordNemesisDuel({}, bandit, "lose", { turn: 10 });
    const entries = out.黑风寨.entries;
    const entry = Object.values(entries)[0];
    expect(entry).toMatchObject({ name: "巴桑", faction: "黑风寨", tier: 1, grudge: 1, status: "active", firstTurn: 10, lastTurn: 10 });
    expect(entry.epithet).toBeNull();
    expect(entry.id).toBe(nemesisEntryId("黑风寨", "巴桑", 10));
  });

  it("同一场重复结算幂等：lastTurn===turn 不连升", () => {
    const r1 = recordNemesisDuel({}, bandit, "lose", { turn: 10 });
    const r2 = recordNemesisDuel(r1, bandit, "lose", { turn: 10 });
    expect(r2).toBeNull();
    expect(Object.values(r1.黑风寨.entries)[0].tier).toBe(1);
  });

  it("连败晋升到 cap4 不再升，grudge 累加", () => {
    let roster = {};
    for (const turn of [10, 12, 14, 16, 18]) {
      roster = recordNemesisDuel(roster, bandit, "lose", { turn }) || roster;
    }
    const entry = Object.values(roster.黑风寨.entries)[0];
    expect(entry.tier).toBe(4);
    expect(entry.grudge).toBe(5);
  });

  it("五势力外不入谱；无 outcome 不入谱", () => {
    expect(recordNemesisDuel({}, { name: "游侠", faction: "散人" }, "lose", { turn: 10 })).toBeNull();
    expect(recordNemesisDuel({}, bandit, "draw", { turn: 10 })).toBeNull();
    expect(recordNemesisDuel({}, bandit, null, { turn: 10 })).toBeNull();
    expect(NEMESIS_FACTIONS).toHaveLength(5);
  });

  it("玩家胜+可辨认伤痕入谱留疤；不可辨认不记不留谱", () => {
    const out = recordNemesisDuel({}, bandit, "win", { turn: 10, scarAttr: "利刃" });
    const entry = Object.values(out.黑风寨.entries)[0];
    expect(entry.scars).toHaveLength(1);
    expect(entry.scars[0]).toMatchObject({ attr: "利刃", turn: 10 });
    expect(entry.grudge).toBe(0); // 胜不结怨升级
    expect(recordNemesisDuel({}, bandit, "win", { turn: 10, scarAttr: null })).toBeNull();
  });

  it("输入 roster 不被原地改", () => {
    const before = {};
    recordNemesisDuel(before, bandit, "lose", { turn: 10 });
    expect(before.黑风寨).toBeUndefined();
  });
});

describe("伤痕五类映射", () => {
  it("点穴/火毒/寒冰/利刃/钝击关键词命中", () => {
    expect(scarAttrOfMove({ name: "点穴指" })).toBe("点穴");
    expect(scarAttrOfMove({ name: "烈焰掌" })).toBe("火毒");
    expect(scarAttrOfMove({ name: "寒冰剑气" })).toBe("寒冰"); // 寒冰先于利刃命中（优先级序）
    expect(scarAttrOfMove({ name: "霜雪掌" })).toBe("寒冰");
    expect(scarAttrOfMove({ name: "青钢剑法" })).toBe("利刃");
    expect(scarAttrOfMove({ name: "铁线拳" })).toBe("钝击");
    expect(scarAttrOfMove({ name: "吐纳功" })).toBeNull();
  });

  it("battleLog 逆序取最后一次有效伤害招式", () => {
    const log = [
      { round: 1, playerMove: { name: "青钢剑法" }, result: { damageToB: 5 } },
      { round: 2, playerMove: { name: "铁线拳" }, result: { damageToB: 8 } },
    ];
    expect(scarAttrFromBattleLog(log)).toBe("钝击");
    expect(scarAttrFromBattleLog([{ round: 1, playerMove: { name: "青钢剑法" }, result: { damageToB: 0 } }])).toBeNull();
    expect(scarAttrFromBattleLog([])).toBeNull();
  });
});

describe("settleNpcDuel 接线", () => {
  function duelState() {
    return {
      time: 20, inv: [], room: { name: "黑风寨", npcs: [] },
      char: { hp: [30, 40], money: 10, special: {} }, skills: [], flags: [],
      questProgress: {}, varTree: { 角色: {}, 世界: {} }, pot: 0,
    };
  }

  it("玩家落败五势力门人入谱写 varTree.世界.宿敌谱", () => {
    const out = settleNpcDuel(duelState(), { name: "扎西", faction: "雪山派", levelCap: 1 }, { outcome: "lose", battleLog: [] });
    expect(typeof out.changes.varTree).toBe("function");
    const vt = out.changes.varTree({ 角色: {}, 世界: {} });
    const entry = Object.values(vt.世界.宿敌谱.雪山派.entries)[0];
    expect(entry).toMatchObject({ name: "扎西", tier: 1 });
  });

  it("门派试剑榜师父（巴桑在册属黑风寨 spar）不入谱", () => {
    // 巴桑正是 heifeng_spar 试剑对手——友好师父豁免
    const out = settleNpcDuel(duelState(), bandit, { outcome: "lose", battleLog: [] });
    // 注：巴桑同时在 spar 榜——豁免优先；好感账仍写 varTree，但宿敌谱键必须不存在
    const vt = typeof out.changes.varTree === "function" ? out.changes.varTree({ 角色: {}, 世界: {} }) : null;
    expect(vt?.世界?.宿敌谱).toBeUndefined();
  });

  it("非 spar 五势力者落败入谱", () => {
    const out = settleNpcDuel(duelState(), { name: "扎西", faction: "雪山派", levelCap: 1 }, { outcome: "lose", battleLog: [] });
    const vt = out.changes.varTree({ 角色: {}, 世界: {} });
    expect(Object.values(vt.世界.宿敌谱.雪山派.entries)[0].name).toBe("扎西");
  });

  it("旧档无宿敌谱不炸+origin 结仇原委 deterministic", () => {
    const out = settleNpcDuel(duelState(), { name: "扎西", faction: "雪山派", levelCap: 1 }, { outcome: "win", battleLog: [] });
    // win 无可辨认伤痕 → 宿敌谱零账（好感账另写不在此断言）
    const vt0 = typeof out.changes.varTree === "function" ? out.changes.varTree({ 角色: {}, 世界: {} }) : null;
    expect(vt0?.世界?.宿敌谱).toBeUndefined();
    // origin 形状：首写 deterministic 拼句
    const out2 = settleNpcDuel(duelState(), { name: "扎西", faction: "雪山派", levelCap: 1 }, { outcome: "lose", battleLog: [] });
    const vt = out2.changes.varTree({ 角色: {}, 世界: {} });
    const entry = Object.values(vt.世界.宿敌谱.雪山派.entries)[0];
    expect(entry.origin).toMatchObject({ turn: 20, place: "黑风寨" });
    expect(entry.origin.summary).toBe("在黑风寨切磋落败结怨");
  });

  it("origin 首写不覆盖：后续结仇只加 grudge", () => {
    const r1 = recordNemesisDuel({}, bandit, "lose", { turn: 10, place: "鱼定村" });
    const r2 = recordNemesisDuel(r1, bandit, "lose", { turn: 14, place: "黑风寨" });
    const entry = Object.values(r2.黑风寨.entries)[0];
    expect(entry.origin).toMatchObject({ turn: 10, place: "鱼定村" });
    expect(entry.grudge).toBe(2);
    expect(entry.tier).toBe(2);
  });
});
