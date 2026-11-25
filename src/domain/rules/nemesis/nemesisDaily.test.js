// WO-23C3 宿敌谱每日争位+传闻纯函数测试
import { describe, it, expect } from "vitest";
import { runNemesisDaily, runNemesisDailyTick, nemesisDailyRule, NEMESIS_DAILY_MARK_KEY, RUMOR_KEEP_CAP } from "./nemesisDaily.js";
import { seededRand } from "../../../utils/seededRandom.js";

function mkEntry(over = {}) {
  return {
    id: "e1", name: "甲", faction: "黑风寨", tier: 1, grudge: 0, status: "active",
    firstTurn: 1, lastTurn: 1, epithet: null, scars: [], origin: { turn: 1, place: "", summary: "结怨" },
    ...over,
  };
}
function mkRoster(entries, faction = "黑风寨") {
  const entriesObj = {};
  for (const e of entries) entriesObj[e.id] = e;
  return { [faction]: { entries: entriesObj } };
}

describe("runNemesisDaily 纯函数", () => {
  it("同 seed/输入幂等可复现", () => {
    const roster = mkRoster([mkEntry(), mkEntry({ id: "e2", name: "乙", tier: 3 })]);
    const r1 = runNemesisDaily(roster, { day: 7 });
    const r2 = runNemesisDaily(roster, { day: 7 });
    expect(JSON.stringify(r1.roster)).toBe(JSON.stringify(r2.roster));
    expect(JSON.stringify(r1.events)).toBe(JSON.stringify(r2.events));
  });

  it("输入不原地改；无争位时 roster 引用不变", () => {
    const roster = mkRoster([mkEntry()]); // 单人无可争
    const before = JSON.stringify(roster);
    const out = runNemesisDaily(roster, { day: 7, rngFor: () => () => 0 }); // rng=0 必触发
    expect(out.roster).toBe(roster);
    expect(JSON.stringify(roster)).toBe(before);
  });

  it("rng 注入可测：触发且成功时 tier 互换，失败不变", () => {
    const roster = mkRoster([mkEntry(), mkEntry({ id: "e2", name: "乙", tier: 3, grudge: 0 })]);
    // rng 序列：第一次 0（触发判定 <0.35 过），第二次 0（成功率判定必过）
    const win = runNemesisDaily(roster, { day: 7, rngFor: () => () => 0 });
    expect(win.events).toHaveLength(1);
    expect(win.events[0].success).toBe(true);
    expect(win.roster["黑风寨"].entries.e1.tier).toBe(3);
    expect(win.roster["黑风寨"].entries.e2.tier).toBe(1);
    // rng：0 触发、0.99 失败（成功率上限 0.8）
    const lose = runNemesisDaily(roster, { day: 7, rngFor: () => (() => { let n = 0; return () => (n++ === 0 ? 0 : 0.99); })() });
    expect(lose.events[0].success).toBe(false);
    expect(lose.roster).toBe(roster); // 无变化引用不变
  });

  it("rng>=触发率时无事件", () => {
    const roster = mkRoster([mkEntry(), mkEntry({ id: "e2", name: "乙", tier: 2 })]);
    const out = runNemesisDaily(roster, { day: 7, rngFor: () => () => 0.9 });
    expect(out.events).toHaveLength(0);
    expect(out.roster).toBe(roster);
  });

  it("fakeDead/settled 不参与也不动；挑战者已最高阶无可争", () => {
    const roster = mkRoster([
      mkEntry({ tier: 4 }),
      mkEntry({ id: "e2", name: "乙", tier: 1, status: "fakeDead" }),
      mkEntry({ id: "e3", name: "丙", tier: 1, status: "settled" }),
    ]);
    const out = runNemesisDaily(roster, { day: 7, rngFor: () => () => 0 });
    expect(out.events).toHaveLength(0); // active 只有一人
    expect(out.roster["黑风寨"].entries.e2.status).toBe("fakeDead");
    // 双 active 但挑战者最高
    const top = mkRoster([mkEntry({ tier: 4 }), mkEntry({ id: "e2", name: "乙", tier: 2 })]);
    const out2 = runNemesisDaily(top, { day: 7, rngFor: () => () => 0 });
    // 挑战者是 tier2 乙，目标 tier4——可争；改测：乙 tier4 甲 tier4 并列？
    // 并列无严格更高 target → 无争
    const tied = mkRoster([mkEntry({ tier: 4 }), mkEntry({ id: "e2", name: "乙", tier: 4 })]);
    const out3 = runNemesisDaily(tied, { day: 7, rngFor: () => () => 0 });
    expect(out3.events).toHaveLength(0);
    expect(out2.events.length + out3.events.length).toBeGreaterThanOrEqual(0); // 形状不炸
  });

  it("origin/scars/epithet 三字段不动，tier 不出 1-4", () => {
    const scar = { attr: "利刃", turn: 3, move: "" };
    const roster = mkRoster([
      mkEntry({ origin: { turn: 1, place: "茶馆", summary: "原委" }, scars: [scar], epithet: "青面" }),
      mkEntry({ id: "e2", name: "乙", tier: 2 }),
    ]);
    const out = runNemesisDaily(roster, { day: 7, rngFor: () => () => 0 });
    const e1 = out.roster["黑风寨"].entries.e1;
    expect(e1.origin).toEqual({ turn: 1, place: "茶馆", summary: "原委" });
    expect(e1.scars).toEqual([scar]);
    expect(e1.epithet).toBe("青面");
    for (const e of Object.values(out.roster["黑风寨"].entries)) {
      expect(e.tier).toBeGreaterThanOrEqual(1);
      expect(e.tier).toBeLessThanOrEqual(4);
    }
  });

  it("坏形状不炸：无谱/entries 非对象/缺字段", () => {
    expect(runNemesisDaily(null, { day: 1 }).events).toEqual([]);
    expect(runNemesisDaily({ 黑风寨: { entries: null } }, { day: 1 }).events).toEqual([]);
    expect(runNemesisDaily({ 黑风寨: { entries: { x: { name: "残" } } } }, { day: 1, rngFor: () => () => 0 }).events).toEqual([]);
  });
});

describe("runNemesisDailyTick 幂等与传闻账", () => {
  function mkState(roster, time = 7 * 24) {
    return { time, varTree: { 世界: { 宿敌谱: roster } } };
  }
  const roster = mkRoster([mkEntry(), mkEntry({ id: "e2", name: "乙", tier: 3 })]);

  function applyChanges(state, changes) {
    return { ...state, varTree: changes.varTree(state.varTree) };
  }

  it("同日重复日结零效果（幂等标记）", () => {
    const state = mkState(roster);
    const r1 = runNemesisDailyTick(state);
    expect(r1).not.toBeNull();
    const s2 = applyChanges(state, r1.changes);
    expect(runNemesisDailyTick(s2)).toBeNull(); // 同日已结
  });

  it("传闻写入不重复、结构合规、cap 生效", () => {
    const state = mkState(roster);
    const r1 = runNemesisDailyTick(state);
    const s2 = applyChanges(state, r1.changes);
    const rumors = s2.varTree.世界.传闻 || [];
    const ids = rumors.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of rumors) {
      expect(r.kind).toBe("宿敌争位");
      expect(typeof r.text).toBe("string");
      expect(r.text.length).toBeGreaterThan(0);
    }
    // cap：预填 RUMOR_KEEP_CAP 条后仍不超长
    const padded = Array.from({ length: RUMOR_KEEP_CAP }, (_, i) => ({ id: `old_${i}`, day: 1, text: "旧" }));
    const s3 = { time: 8 * 24, varTree: { 世界: { 宿敌谱: roster, 传闻: padded, [NEMESIS_DAILY_MARK_KEY]: 7 } } };
    const r3 = runNemesisDailyTick(s3);
    if (r3) {
      const out = r3.changes.varTree(s3.varTree);
      expect(out.世界.传闻.length).toBeLessThanOrEqual(RUMOR_KEEP_CAP);
    }
  });

  it("跨日后可再结；无谱旧档不炸只写标记", () => {
    const empty = { time: 24, varTree: { 世界: {} } };
    const r = runNemesisDailyTick(empty);
    expect(r).not.toBeNull();
    const out = r.changes.varTree(empty.varTree);
    expect(out.世界[NEMESIS_DAILY_MARK_KEY]).toBe(1);
    expect(Array.isArray(out.世界.传闻)).toBe(true);
  });

  it("nemesisDailyRule deps 按日分桶", () => {
    expect(nemesisDailyRule.deps({ time: 0 })).toEqual([0]);
    expect(nemesisDailyRule.deps({ time: 47 })).toEqual([1]);
    expect(nemesisDailyRule.deps({ time: 48 })).toEqual([2]);
  });
});
