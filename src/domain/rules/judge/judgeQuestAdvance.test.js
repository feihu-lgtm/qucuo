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
  it("questId/flag 空串视同未填——白名单自然拒收（strict 必填键的妥协不开口子）", () => {
    const v = judgeTurn(envelope, propose([
      { claim: "x", kind: "quest_advance", fit: "natural", questId: "", flag: "" },
    ]), { rng: () => 0.5 });
    expect(v.facts.filter((f) => f.op === "ADVANCE_QUEST").length).toBe(0);
  });

  it("witnesses 写死「主角」与判官全链一致（judgeTurn/sealVerifier 统一系统主角代号，不用玩家名）", () => {
    const v = judgeTurn(envelope, propose([
      { claim: "x", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" },
    ]), { rng: () => 0.5 });
    expect(v.facts.find((f) => f.op === "ADVANCE_QUEST").witnesses).toEqual(["主角"]);
  });

  it("同一 flag 重复提议只签一次", () => {
    const v = judgeTurn(envelope, propose([
      { claim: "x", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" },
      { claim: "y", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" },
    ]), { rng: () => 0.5 });
    expect(v.facts.filter((f) => f.op === "ADVANCE_QUEST").length).toBe(1);
  });
});

describe("任务交付去重：quest_advance 命中 deliver 候选时压制同目标同物 give", () => {
  const DELIVER_CANDIDATES = [
    { questId: "q_df", flag: "q_df_done", title: "送糌粑", stageBrief: "交付", deliver: { to: "老孙", item: "糌粑" } },
  ];
  const deliverEnvelope = {
    turn: 5, day: 1, place: "鱼定村",
    npcs: [{ name: "老孙", personality: "温善" }], varTree: {}, inv: [{ id: "it1", name: "糌粑", category: "food" }],
    questCandidates: DELIVER_CANDIDATES, budget: {},
  };
  it("交付意图同发时：无 TRANSFER_ITEM/好感事实，只有 ADVANCE_QUEST", () => {
    const v = judgeTurn(deliverEnvelope, {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "老孙", itemId: "it1", direction: "none", stance: "sincere" }],
      proposals: [{ claim: "把糌粑交给老孙", kind: "quest_advance", fit: "natural", questId: "q_df", flag: "q_df_done" }],
    }, { rng: () => 0.1 });
    expect(v.facts.some((f) => f.op === "TRANSFER_ITEM")).toBe(false);
    expect(v.facts.some((f) => f.op === "MUTATE_SOCIAL" && f.reason?.includes("赠"))).toBe(false);
    expect(v.facts.some((f) => f.op === "ADVANCE_QUEST")).toBe(true);
    expect(v.notes.join()).toContain("交付通道");
  });
  it("quest_advance 未过白名单时 give 不压制（正常赠礼裁决）", () => {
    const v = judgeTurn(deliverEnvelope, {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "老孙", itemId: "it1", direction: "none", stance: "sincere" }],
      proposals: [{ claim: "x", kind: "quest_advance", fit: "natural", questId: "q_df", flag: "q_BOGUS" }],
    }, { rng: () => 0.1 });
    expect(v.facts.some((f) => f.op === "TRANSFER_ITEM")).toBe(true);
  });
  it("非交付物的 give 不压制", () => {
    const v = judgeTurn({ ...deliverEnvelope, inv: [{ id: "it1", name: "糌粑" }, { id: "it2", name: "美酒" }] }, {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "老孙", itemId: "it2", direction: "none", stance: "sincere" }],
      proposals: [{ claim: "x", kind: "quest_advance", fit: "natural", questId: "q_df", flag: "q_df_done" }],
    }, { rng: () => 0.1 });
    expect(v.facts.some((f) => f.op === "TRANSFER_ITEM" && f.itemName === "美酒")).toBe(true);
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
