import { describe, it, expect } from "vitest";
import { recruitNemesis } from "./recruitNemesis.js";

function entry(overrides = {}) {
  return {
    id: "heifeng_麻三", name: "麻三", faction: "黑风寨", tier: 1, baseRole: "喽啰",
    epithet: null, scars: [], grudge: 1, status: "active", firstTurn: 3, lastTurn: 3, ...overrides,
  };
}
function heartLedger(pairs) {
  return pairs.map(([tag, summary], i) => ({ id: `hl_${i}`, tag, summary, turn: 1 }));
}
function stateWith(e, ledger) {
  return {
    time: 10,
    companionState: {},
    varTree: {
      世界: { 宿敌谱: { [e.faction]: { entries: { [e.id]: e } } } },
      ...(ledger ? { 角色: { [e.name]: { 心账: ledger } } } : {}),
    },
  };
}
const GOOD = heartLedger([["恩", "救过他"], ["恩", "还过钱"], ["怨", "切磋赢他"]]);

describe("WO-23C4 recruitNemesis（deterministic 闭环+幂等）", () => {
  it("成功：status→recruited、companionState 转入、追杀令落账、tier/grudge 不动", () => {
    const e = entry();
    const st = stateWith(e, GOOD);
    const res = recruitNemesis(st, { faction: e.faction, entryId: e.id });
    expect(res.changes).toBeTruthy();
    const cs = res.changes.companionState({});
    const keys = Object.keys(cs);
    expect(keys).toHaveLength(1);
    expect(cs[keys[0]].unlocked).toBe(true);
    expect(cs[keys[0]].data.name).toBe("麻三");
    expect(cs[keys[0]].data.brief).toContain("弃暗投明");
    const vt = res.changes.varTree(st.varTree);
    const w = vt.世界.宿敌谱[e.faction].entries[e.id];
    expect(w.status).toBe("recruited");
    expect(w.tier).toBe(1);
    expect(w.grudge).toBe(1);
    expect(vt.世界.追杀令).toHaveLength(1);
    expect(vt.世界.追杀令[0]).toMatchObject({ faction: "黑风寨", entryId: e.id, name: "麻三", turn: 10 });
    expect(vt.世界.追杀令[0].note).toContain("追杀");
    expect(res.logs.length).toBeGreaterThanOrEqual(2);
  });
  it("幂等：已 recruited 重复点击无 changes 不重复落账", () => {
    const e = entry({ status: "recruited" });
    const res = recruitNemesis(stateWith(e, GOOD), { faction: e.faction, entryId: e.id });
    expect(res.changes).toBeUndefined();
    expect(res.logs[0].text).toContain("麾下");
  });
  it("写入层再核：apply 时状态已翻非 active 不动账", () => {
    const e = entry();
    const st = stateWith(e, GOOD);
    const res = recruitNemesis(st, { faction: e.faction, entryId: e.id });
    // 模拟写入时目标已被他路改 settled——updater 返回原树
    const mutated = stateWith(entry({ status: "settled" }), GOOD).varTree;
    expect(res.changes.varTree(mutated)).toBe(mutated);
  });
  it("不合格只出日志不落账：恩不大于怨/tier>2/无心账/查无此人", () => {
    const e = entry();
    expect(recruitNemesis(stateWith(e, heartLedger([["怨", "结怨深"]])), { faction: e.faction, entryId: e.id }).changes).toBeUndefined();
    expect(recruitNemesis(stateWith(e, heartLedger([["怨", "结怨深"]])), { faction: e.faction, entryId: e.id }).logs[0].text).toContain("怨大于恩");
    expect(recruitNemesis(stateWith(entry({ tier: 3 }), GOOD), { faction: e.faction, entryId: e.id }).logs[0].text).toContain("位阶太高");
    expect(recruitNemesis(stateWith(e, null), { faction: e.faction, entryId: e.id }).logs[0].text).toContain("无恩义往来");
    expect(recruitNemesis(stateWith(e, GOOD), { faction: "雪山派", entryId: "x" }).logs[0].text).toContain("查无此人");
  });
  it("原势力声誉 deterministic -10、写入再核不重复扣", () => {
    const e = entry();
    const st = stateWith(e, GOOD);
    st.varTree.世界.势力声誉 = { 黑风寨: 30 };
    const res = recruitNemesis(st, { faction: e.faction, entryId: e.id });
    const vt = res.changes.varTree(st.varTree);
    expect(vt.世界.势力声誉.黑风寨).toBe(20);
    // 写入时状态已翻（重复收服）→ 返回原树，声誉不重复扣
    const mutated = stateWith(entry({ status: "recruited" }), GOOD).varTree;
    mutated.世界.势力声誉 = { 黑风寨: 20 };
    expect(res.changes.varTree(mutated)).toBe(mutated);
  });
  it("当前房间同名世界版 NPC 撤下、他人不误伤", () => {
    const e = entry();
    const st = stateWith(e, GOOD);
    const res = recruitNemesis(st, { faction: e.faction, entryId: e.id });
    const room = { name: "黑风寨", npcs: [{ name: "麻三", id: "x" }, { name: "旁人" }] };
    const next = res.changes.room(room);
    expect(next.npcs.map((n) => n.name)).toEqual(["旁人"]);
  });
  it("无专属招式的宿敌入队后 moveset 兜底非空（出战位能上阵）", () => {
    const e = entry();
    const res = recruitNemesis(stateWith(e, GOOD), { faction: e.faction, entryId: e.id });
    const cs = res.changes.companionState({});
    const data = cs[Object.keys(cs)[0]].data;
    expect(Array.isArray(data.moveset)).toBe(true);
    expect(data.moveset.length).toBeGreaterThan(0);
  });
  it("坏账不炸", () => {
    expect(() => recruitNemesis({ varTree: null }, { faction: "x", entryId: "y" })).not.toThrow();
    expect(() => recruitNemesis({}, {})).not.toThrow();
  });
});
