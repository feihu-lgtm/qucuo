import { describe, expect, it } from "vitest";
import { enterContest, inviteCompanion, nightTogether, placeBet, pendingMidnightEvent, resolveMidnightYield } from "./logic.js";
import { contestFlag, companionFlag, nightDoneFlag, MIDNIGHT_FLAG, FESTIVAL_CONTESTS } from "../../domain/data/festival/festivalData.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";

const day = 8;
const baseState = (over = {}) => ({
  time: day * 24 + 8, // 上午 8 时，跑马开场中
  char: { name: "主角", special: { 身法: 9, 体魄: 9, 气运: 9, 智谋: 9 }, money: 100 },
  inv: [], flags: [], varTree: {}, questProgress: {}, skills: [],
  ...over,
});
const applyChange = (state, key, change) =>
  typeof change === "function" ? change(state[key] ?? undefined) : change;

describe("跑马大会·参赛", () => {
  it("时辰不对不开场", () => {
    const r = enterContest(baseState({ time: day * 24 + 14 }), "saima");
    expect(r.changes).toBeUndefined();
    expect(r.logs[0].text).toContain("未开场");
  });

  it("参赛记分 + 每日一次 flag", () => {
    const state = baseState();
    const r = enterContest(state, "saima");
    const flags = applyChange(state, "flags", r.changes.flags);
    expect(flags).toContain(contestFlag("saima", "enter", day));
    // 时辰由结算段统一推，feature 不再自带 time 增量
    expect(r.changes.time).toBeUndefined();
    expect(enterContest({ ...state, flags }, "saima").changes).toBeUndefined();
  });

  it("高分夺魁：paoma_saima 完成、夺魁旗落下", () => {
    const state = baseState(); // 90 起评 + 浮动，稳超梅朵 78
    const r = enterContest(state, "saima");
    expect(r.settle).toBe(FESTIVAL_CONTESTS.saima.winSettle);
    const flags = applyChange(state, "flags", r.changes.flags);
    expect(flags).toContain("paoma_saima_win");
    const qp = applyChange(state, "questProgress", r.changes.questProgress);
    expect(qp.paoma_saima.status).toBe("completed");
  });
});

describe("跑马大会·下注", () => {
  it("当场开奖、扣钱、记 flag；没钱不能押", () => {
    const state = baseState();
    const r = placeBet(state, "saima", "梅朵", 30);
    expect(r.changes.char.money).not.toBe(100);
    const flags = applyChange(state, "flags", r.changes.flags);
    expect(flags).toContain(contestFlag("saima", "bet", day));
    expect(placeBet(baseState({ char: { ...state.char, money: 5 } }), "saima", "梅朵", 30).changes).toBeUndefined();
    expect(placeBet(state, "saima", "梅朵", 60).changes).toBeUndefined();
    expect(placeBet({ ...state, flags }, "saima", "丹增", 10).changes).toBeUndefined();
  });
});

describe("跑马大会·同游与夜话", () => {
  const withFavor = (favor) => baseState({ varTree: { 角色: { 梅朵: { 好感度: favor } } } });

  it("好感 60 才邀得动，一天一人", () => {
    expect(inviteCompanion(withFavor(50), "梅朵").changes).toBeUndefined();
    const state = withFavor(70);
    const r = inviteCompanion(state, "梅朵");
    const flags = applyChange(state, "flags", r.changes.flags);
    expect(flags).toContain(companionFlag("梅朵", day));
    const varTree = applyChange(state, "varTree", r.changes.varTree);
    expect(varTree.角色.梅朵.好感度).toBe(75);
    // 同日不可再邀别人
    expect(inviteCompanion({ ...state, flags, varTree }, "才旦").changes).toBeUndefined();
  });

  it("夜话：须同游过 + 戌亥时 + 固定文本 + 好感+10", () => {
    const state = withFavor(70);
    const invited = inviteCompanion(state, "梅朵");
    const flags = applyChange(state, "flags", invited.changes.flags);
    const night = { ...state, flags, time: day * 24 + 20 };
    const r = nightTogether(night, "梅朵");
    expect(r.logs[0].t).toBe("narrator");
    expect(r.logs[0].text).toContain("马厩");
    const varTree = applyChange(night, "varTree", r.changes.varTree);
    expect(varTree.角色.梅朵.好感度).toBe(80);
    const flags2 = applyChange(night, "flags", r.changes.flags);
    expect(flags2).toContain(nightDoneFlag("梅朵", day));
    // 没同游不能夜话
    expect(nightTogether(baseState({ time: day * 24 + 20 }), "梅朵").changes).toBeUndefined();
    // 白日不能夜话
    expect(nightTogether(baseState({ flags }), "梅朵").changes).toBeUndefined();
  });
});

describe("跑马大会·子夜之变", () => {
  it("只在子时触发、一生一次、避让走 yield 分支", () => {
    expect(pendingMidnightEvent(baseState())).toBeNull();
    const night = baseState({ time: day * 24 + 23 });
    const ev = pendingMidnightEvent(night);
    expect(ev).toBeTruthy();
    expect(ev.choices.some((c) => c.kind === "combat")).toBe(true);
    // 已办过不再触发
    expect(pendingMidnightEvent({ ...night, flags: [MIDNIGHT_FLAG] })).toBeNull();
    // 任务已完成也不再触发
    expect(pendingMidnightEvent({ ...night, questProgress: { paoma_ziye: { status: "completed" } } })).toBeNull();

    const r = resolveMidnightYield(night);
    const flags = applyChange(night, "flags", r.changes.flags);
    expect(flags).toContain(MIDNIGHT_FLAG);
    expect(flags).toContain("paoma_ziye_yield");
    const qp = applyChange(night, "questProgress", r.changes.questProgress);
    expect(qp.paoma_ziye.status).toBe("completed");
    // 威望 -8 落 varTree
    const varTree = applyChange(night, "varTree", r.changes.varTree);
    expect(varTree.世界.威望).toBe(-8);
    expect(resolveMidnightYield({ ...night, flags }).changes).toBeUndefined();
  });
});
