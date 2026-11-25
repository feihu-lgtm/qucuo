// WO-22B-P1 契约值守扫描器测试矩阵：
// 到期触发 / 未到期不触发 / settled 不触发 / 幂等只罚一次 / 低品阶不压信 /
// 刚烈压信 / 威望扣减 / 怨账五类合规 / pactMeta 形状 / 无期限不触发
import { describe, expect, it } from "vitest";
import { scanPactBreaches, pactWatchRule, PACT_BREACH_PRESTIGE_COST } from "./pactWatch.js";
import { applyInboundLetter } from "./inbound.js";

function makeState({ time = 100, pacts = {}, npcAttrs = {}, prestige = 20, pending = [] } = {}) {
  return {
    time,
    room: { name: "曲措乡", npcs: [] },
    varTree: {
      世界: { 契约: pacts, 威望: prestige, 来信待发: pending },
      角色: npcAttrs,
    },
    char: { name: "测试侠" },
  };
}

function pactOf(overrides = {}) {
  return {
    npc: "才旦",
    promise: "三日内送还猎刀",
    deadlineHours: 24,
    rewardHint: "十两银子",
    bindTurn: 50,
    witnesses: ["主角", "才旦"],
    ...overrides,
  };
}

function applyChanges(state, result) {
  return result.changes.varTree(state.varTree);
}

describe("WO-22B-P1 契约值守扫描器", () => {
  it("到期触发：怨账+威望扣减+breachTurn 标记+日志", () => {
    const state = makeState({ pacts: { 才旦: { pact_50_1: pactOf() } } });
    const result = scanPactBreaches(state);
    expect(result).not.toBeNull();
    const tree = applyChanges(state, result);
    // 怨账五类合规：tag 必须是「怨」且条目经 createHeartLedgerEntry 形状
    const ledger = tree.角色.才旦.心账;
    expect(ledger.length).toBe(1);
    expect(ledger[0].tag).toBe("怨");
    expect(ledger[0].summary).toContain("逾期未践");
    expect(ledger[0].id).toMatch(/^hl_/);
    // 威望扣减
    expect(tree.世界.威望).toBe(20 - PACT_BREACH_PRESTIGE_COST);
    // breachTurn 幂等标记
    expect(tree.世界.契约.才旦.pact_50_1.breachTurn).toBe(100);
    // 原文不丢
    expect(tree.世界.契约.才旦.pact_50_1.promise).toBe("三日内送还猎刀");
    expect(result.logs.length).toBe(1);
  });

  it("未到期不触发", () => {
    const state = makeState({ time: 60, pacts: { 才旦: { pact_50_1: pactOf() } } }); // 50+24=74 > 60
    expect(scanPactBreaches(state)).toBeNull();
  });

  it("settled/已了结不触发", () => {
    const state = makeState({ pacts: { 才旦: { pact_50_1: pactOf({ settled: { turn: 60 } }) } } });
    expect(scanPactBreaches(state)).toBeNull();
  });

  it("无期限契约永不触发", () => {
    const state = makeState({ pacts: { 才旦: { pact_50_1: pactOf({ deadlineHours: null }) } } });
    expect(scanPactBreaches(state)).toBeNull();
  });

  it("幂等只罚一次：breachTurn 已标不再罚", () => {
    const state = makeState({ pacts: { 才旦: { pact_50_1: pactOf({ breachTurn: 80 }) } } });
    expect(scanPactBreaches(state)).toBeNull();
  });

  it("低品阶柔性 NPC 不压信只记账", () => {
    // 才旦在 residentNpcs 里 levelCap 低（< 3）且性情不刚烈
    const state = makeState({ pacts: { 才旦: { pact_50_1: pactOf() } } });
    const result = scanPactBreaches(state);
    const tree = applyChanges(state, result);
    expect(tree.世界.来信待发 || []).toHaveLength(0);
    expect(tree.角色.才旦.心账).toHaveLength(1); // 账照记
  });

  it("刚烈性情压斥责信且 pactMeta 形状齐备", () => {
    // 梅朵：土司之女·刚烈（npcSignatureMoves 注释/adventurersIP 刚烈人设），
    // 用 varTree 注入方式确保 findNpcObject 能拿到——在场名单直接给。
    const fierceNpc = { name: "烈娘子", levelCap: 1, personality: "性格刚烈，眼里揉不得沙子。" };
    const state = makeState({ pacts: { 烈娘子: { pact_50_1: pactOf({ npc: "烈娘子" }) } } });
    state.room.npcs = [fierceNpc];
    const result = scanPactBreaches(state);
    const tree = applyChanges(state, result);
    const pending = tree.世界.来信待发;
    expect(pending).toHaveLength(1);
    expect(pending[0].pactMeta).toMatchObject({
      reason: "逾期催问",
      pactKey: "pact_50_1",
      promise: "三日内送还猎刀",
      deadlineHours: 24,
      rewardHint: "十两银子",
    });
    expect(pending[0].arriveTime).toBeGreaterThan(100);
  });

  it("高品阶（levelCap>=3）即使性情不刚烈也压信", () => {
    const boss = { name: "大当家", levelCap: 4, personality: "沉稳阴鸷。" };
    const state = makeState({ pacts: { 大当家: { pact_50_1: pactOf({ npc: "大当家" }) } } });
    state.room.npcs = [boss];
    const result = scanPactBreaches(state);
    const tree = applyChanges(state, result);
    expect(tree.世界.来信待发).toHaveLength(1);
  });

  it("信件按 id 幂等：同 pactKey 信已在途不重复压", () => {
    const fierceNpc = { name: "烈娘子", levelCap: 1, personality: "性格刚烈。" };
    const state = makeState({
      pacts: { 烈娘子: { pact_50_1: pactOf({ npc: "烈娘子" }) } },
      pending: [{ id: "letter_pact_pact_50_1", npcName: "烈娘子", arriveTime: 101, sentAt: 99 }],
    });
    state.room.npcs = [fierceNpc];
    const result = scanPactBreaches(state);
    const tree = applyChanges(state, result);
    expect(tree.世界.来信待发).toHaveLength(1); // 仍是原来那封
  });

  it("多契约同时到期：威望按桩数累计扣", () => {
    const state = makeState({
      pacts: {
        才旦: { pact_50_1: pactOf() },
        老孙: { pact_50_2: pactOf({ npc: "老孙" }) },
      },
    });
    const result = scanPactBreaches(state);
    const tree = applyChanges(state, result);
    expect(tree.世界.威望).toBe(20 - PACT_BREACH_PRESTIGE_COST * 2);
  });

  it("威望 clamp 不破 -100 下限", () => {
    const state = makeState({ prestige: -98, pacts: { 才旦: { pact_50_1: pactOf() } } });
    const tree = applyChanges(state, scanPactBreaches(state));
    expect(tree.世界.威望).toBe(-100);
  });

  it("无契约/空账返回 null", () => {
    expect(scanPactBreaches(makeState())).toBeNull();
    expect(scanPactBreaches({ time: 1, varTree: {} })).toBeNull();
  });

  it("世界规则壳：firstRun 不扫，deps 含契约账与时间分桶", () => {
    const state = makeState({ pacts: { 才旦: { pact_50_1: pactOf() } } });
    expect(pactWatchRule.run(state, { firstRun: true })).toBeNull();
    expect(pactWatchRule.run(state, { firstRun: false })).not.toBeNull();
    const deps = pactWatchRule.deps(state);
    expect(deps).toHaveLength(2);
  });

  it("applyInboundLetter 透传 pactMeta 入来信箱", () => {
    const state = makeState();
    state.varTree.世界.来信待发 = [{ id: "letter_pact_x", npcName: "才旦", arriveTime: 100, sentAt: 98, pactMeta: { reason: "逾期催问", pactKey: "pact_50_1", promise: "还刀", deadlineHours: 24, rewardHint: "" } }];
    const letter = state.varTree.世界.来信待发[0];
    const result = applyInboundLetter(state, letter, "期限已过，你好自为之。");
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界.来信箱[0].pactMeta).toMatchObject({ reason: "逾期催问", pactKey: "pact_50_1" });
  });

  it("applyInboundLetter 非契约信不带 pactMeta 字段", () => {
    const state = makeState();
    const letter = { id: "letter_in_才旦_1", npcName: "才旦", arriveTime: 100, sentAt: 98 };
    const result = applyInboundLetter(state, letter, "别来无恙？");
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界.来信箱[0].pactMeta).toBeUndefined();
  });
});
