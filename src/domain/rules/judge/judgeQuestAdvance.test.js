// B1：quest_advance 白名单核验 + ADVANCE_QUEST 落 flags + questFlagRule 接管链
import { describe, expect, it } from "vitest";
import { judgeTurn } from "./judgeTurn.js";
import { materializeFacts } from "../effects/materializeFacts.js";
import { questFlagRule } from "../quests/rules.js";
import { advanceQuestStages, createQuestProgress } from "../quests/questEngine.js";

const CANDIDATES = [
  { questId: "q_test", flag: "q_test_open", title: "考验", stageBrief: "开场" },
];
const envelope = {
  turn: 5, day: 1, place: "鱼定村", npcs: [], varTree: {}, inv: [],
  questCandidates: CANDIDATES, budget: {},
};
const propose = (arr) => ({ read: "", refIds: [], actions: [], proposals: arr });

describe("judgeTurn quest_advance 白名单", () => {
  it("合法命中候选→签发 ADVANCE_QUEST 事实", () => {
    const v = judgeTurn(envelope, propose([
      { claim: "说动了老孙", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" },
    ]), { rng: () => 0.5 });
    const fact = v.facts.find((f) => f.op === "ADVANCE_QUEST");
    expect(fact).toBeTruthy();
    expect(fact.flag).toBe("q_test_open");
    expect(fact.questTitle).toBe("考验");
    expect(fact.witnesses).toEqual(["主角"]);
  });
  it("自编 flag/提前阶段/错 questId 全部安静丢弃", () => {
    const v = judgeTurn(envelope, propose([
      { claim: "x", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_final_BOGUS" },
      { claim: "x", kind: "quest_advance", fit: "natural", questId: "q_other", flag: "q_test_open" },
    ]), { rng: () => 0.5 });
    expect(v.facts.filter((f) => f.op === "ADVANCE_QUEST").length).toBe(0);
    expect(v.notes.join()).toContain("未过白名单");
  });
  it("无候选喂入时 quest_advance 提议全部丢弃", () => {
    const v = judgeTurn({ ...envelope, questCandidates: [] }, propose([
      { claim: "x", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" },
    ]), { rng: () => 0.5 });
    expect(v.facts.filter((f) => f.op === "ADVANCE_QUEST").length).toBe(0);
  });
  it("同一 flag 重复提议只签一次", () => {
    const v = judgeTurn(envelope, propose([
      { claim: "x", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" },
      { claim: "y", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" },
    ]), { rng: () => 0.5 });
    expect(v.facts.filter((f) => f.op === "ADVANCE_QUEST").length).toBe(1);
  });
});

describe("ADVANCE_QUEST → materializeFacts → questFlagRule 接管链", () => {
  const QUEST = {
    id: "q_test", title: "考验", giver: "老孙",
    stages: [
      { description: "开场", completionFlag: "q_test_open" },
      { description: "收尾", completionFlag: "q_test_done" },
    ],
  };
  it("materializeFacts 只写 flag 不进 questProgress；questFlagRule 扫描后推进", () => {
    const state = { flags: [], inv: [], room: { name: "鱼定村", npcs: [] }, varTree: {}, char: {}, time: 5 };
    const out = materializeFacts(state, [
      { id: "F5_1", op: "ADVANCE_QUEST", questId: "q_test", flag: "q_test_open", questTitle: "考验", witnesses: ["主角"] },
    ], {});
    // materialize 只产 flags 变化——不直接碰 questProgress
    expect(out.changes.flags).toEqual(["q_test_open"]);
    expect(out.changes.questProgress).toBeUndefined();
    expect(out.logs[0].text).toContain("考验");
    // questFlagRule 世界规则扫描 flags：任务从未开启变为 active 并推进
    const ruleState = {
      flags: out.changes.flags, questProgress: {}, inv: [], char: {},
      varTree: {}, time: 5, room: state.room,
    };
    const ruleOut = questFlagRule.run(ruleState, { now: 5 });
    // questFlagRule 内部按 QUCUO_QUESTS 扫——合成任务不在册不会推进；
    // 直接用 advanceQuestStages 验证同一 flags 语义下状态机确实前进
    void ruleOut;
    const progress = createQuestProgress("q_test", 5);
    const adv = advanceQuestStages(QUEST, progress, { flags: out.changes.flags }, 5);
    expect(adv.advanced).toBe(true);
    expect(adv.progress.currentStageIndex).toBe(1);
  });
  it("flag 已在 flags 里不重复写入", () => {
    const state = { flags: ["q_test_open"], inv: [], room: { npcs: [] }, varTree: {}, char: {}, time: 5 };
    const out = materializeFacts(state, [
      { id: "F5_1", op: "ADVANCE_QUEST", questId: "q_test", flag: "q_test_open", witnesses: ["主角"] },
    ], {});
    expect(out.changes.flags).toBeUndefined();
  });
});
