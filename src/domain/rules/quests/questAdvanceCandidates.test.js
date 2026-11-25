import { describe, expect, it } from "vitest";
import { questAdvanceCandidates } from "./questAdvanceCandidates.js";

const QUEST = {
  id: "q_test", title: "考验", giver: "老孙",
  stages: [
    { description: "去鱼定村找老孙开场", completionFlag: "q_test_open", requireLocation: { district: "鱼定村" } },
    { description: "把糌粑交给巴桑", completionFlag: "q_test_deliver", deliver: { to: "巴桑", item: "糌粑" } },
    { description: "抉择一步", completionFlag: ["q_test_a", "q_test_b"], choices: [
      { flag: "q_test_a", label: "甲", resolve: "auto" }, { flag: "q_test_b", label: "乙", resolve: "auto" }] },
    { description: "自由叙事步", completionFlag: "q_test_free" },
  ],
};
const COMBAT_QUEST = {
  id: "q_combat", title: "打考", giver: "老孙",
  stages: [{ description: "开打", completionFlag: "q_combat_win", choices: [
    { flag: "q_combat_win", label: "打", resolve: "combat", combatNpc: { name: "匪" } }] }],
};
const BASE = {
  questProgress: {}, flags: [], varTree: {}, char: {},
  room: { name: "鱼定村", npcs: [{ name: "老孙" }] }, inv: [],
  innerRoomName: null, questTriggerMode: "prompt", quests: [QUEST, COMBAT_QUEST],
};
const activeAt = (idx) => ({ q_test: { status: "active", currentStageIndex: idx } });

describe("questAdvanceCandidates 候选生成", () => {
  it("未开启任务：giver 在场+地点锚点正确→首阶段候选", () => {
    const out = questAdvanceCandidates(BASE);
    expect(out.some((c) => c.flag === "q_test_open" && c.questId === "q_test")).toBe(true);
    expect(out[0].title).toBe("考验");
  });
  it("未开启任务：giver 不在场且阶段无锚点以外通道→无候选；地点不符→无候选", () => {
    // 与任务面板同源：requireLocation 锚定阶段只看地点不看 giver——
    // giver 不在场玩家也要能撞上该撞的事（旧 needsGiver 口径与面板矛盾，已修）
    const noGiver = questAdvanceCandidates({ ...BASE, room: { name: "鱼定村", npcs: [] } });
    expect(noGiver.some((c) => c.flag === "q_test_open")).toBe(true);
    const wrongPlace = questAdvanceCandidates({ ...BASE, room: { name: "喇嘛庙", npcs: [{ name: "老孙" }] } });
    expect(wrongPlace.some((c) => c.flag === "q_test_open")).toBe(false);
  });
  it("deliver 阶段：收件人不在场/交付物不在包→无候选；齐备→候选", () => {
    const base = { ...BASE, questProgress: activeAt(1) };
    expect(questAdvanceCandidates(base).some((c) => c.flag === "q_test_deliver")).toBe(false);
    const recipientOnly = { ...base, room: { name: "鱼定村", npcs: [{ name: "巴桑" }] } };
    expect(questAdvanceCandidates(recipientOnly).some((c) => c.flag === "q_test_deliver")).toBe(false);
    const ready = { ...recipientOnly, inv: [{ name: "糌粑" }] };
    expect(questAdvanceCandidates(ready).some((c) => c.flag === "q_test_deliver")).toBe(true);
  });
  it("choices 阶段 prompt 模式不候选；script 模式非全战斗候选；全战斗永远不候选", () => {
    const at2 = { ...BASE, questProgress: activeAt(2) };
    expect(questAdvanceCandidates(at2).length).toBe(0);
    const script = { ...at2, questTriggerMode: "script" };
    const out = questAdvanceCandidates(script);
    expect(out.map((c) => c.flag).sort()).toEqual(["q_test_a", "q_test_b"]);
    const combatScript = { ...BASE, questProgress: { q_combat: { status: "active", currentStageIndex: 0 } }, questTriggerMode: "script", quests: [COMBAT_QUEST] };
    expect(questAdvanceCandidates(combatScript).length).toBe(0);
  });

  it("混合分支：combat 抉择旗永不进候选，非战斗分支可候选", () => {
    const MIXED = {
      id: "q_mix", title: "混考", giver: "老孙",
      stages: [{ description: "打或谈", completionFlag: ["q_mix_fight", "q_mix_talk"], choices: [
        { flag: "q_mix_fight", label: "打", resolve: "combat", combatNpc: { name: "匪" } },
        { flag: "q_mix_talk", label: "谈", resolve: "auto" }] }],
    };
    const base = { ...BASE, questProgress: { q_mix: { status: "active", currentStageIndex: 0 } }, questTriggerMode: "script", quests: [MIXED] };
    const out = questAdvanceCandidates(base);
    expect(out.some((c) => c.flag === "q_mix_talk")).toBe(true);
    expect(out.some((c) => c.flag === "q_mix_fight")).toBe(false);
  });
  it("首阶段 deliver：收件人在场（giver 不在）也算「这里」——面板同口径", () => {
    const DELIVER_FIRST = {
      id: "q_df", title: "送糌粑", giver: "才旦",
      stages: [{ description: "把糌粑交给老孙", completionFlag: "q_df_done", deliver: { to: "老孙", item: "糌粑" } }],
    };
    // 未开启、才旦不在场、老孙在饭馆、糌粑在包——应出候选（script 通道不再白跑）
    const base = { ...BASE,
      room: { name: "鱼定村", npcs: [{ name: "老孙" }] },
      inv: [{ name: "糌粑" }], quests: [DELIVER_FIRST], questTriggerMode: "script" };
    const out = questAdvanceCandidates(base);
    expect(out.some((c) => c.flag === "q_df_done")).toBe(true);
    // 收件人也不在：无候选
    const noOne = { ...base, room: { name: "鱼定村", npcs: [] } };
    expect(questAdvanceCandidates(noOne).length).toBe(0);
  });

  it("分支前提未开：requiresFlags 未满足的 choice 旗不进候选", () => {
    const GATE_CHOICE = {
      id: "q_gate", title: "门考", giver: "老孙",
      stages: [{ description: "分支", completionFlag: ["q_gate_token", "q_gate_plain"], choices: [
        { flag: "q_gate_token", label: "令牌路", resolve: "auto", requiresFlags: ["q_prereq_done"] },
        { flag: "q_gate_plain", label: "平凡路", resolve: "auto" }] }],
    };
    const base = { ...BASE, questProgress: { q_gate: { status: "active", currentStageIndex: 0 } }, questTriggerMode: "script", quests: [GATE_CHOICE], flags: [] };
    const out = questAdvanceCandidates(base);
    expect(out.some((c) => c.flag === "q_gate_token")).toBe(false);
    expect(out.some((c) => c.flag === "q_gate_plain")).toBe(true);
    // 前提满足后两支都开
    const opened = { ...base, flags: ["q_prereq_done"] };
    expect(questAdvanceCandidates(opened).some((c) => c.flag === "q_gate_token")).toBe(true);
  });

  it("非 choices 叙事阶段任何模式都候选；completed/locked 不候选", () => {
    const at3 = { ...BASE, questProgress: activeAt(3) };
    expect(questAdvanceCandidates(at3).some((c) => c.flag === "q_test_free")).toBe(true);
    const done = { ...BASE, questProgress: { q_test: { status: "completed" } } };
    expect(questAdvanceCandidates(done).length).toBe(0);
  });
});
