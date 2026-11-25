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
    // 与 roundNotes 同口径：needsGiver 的任务即便有地点锚点，giver 不在场也不候选
    const noGiver = questAdvanceCandidates({ ...BASE, room: { name: "鱼定村", npcs: [] } });
    expect(noGiver.some((c) => c.flag === "q_test_open")).toBe(false);
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
  it("非 choices 叙事阶段任何模式都候选；completed/locked 不候选", () => {
    const at3 = { ...BASE, questProgress: activeAt(3) };
    expect(questAdvanceCandidates(at3).some((c) => c.flag === "q_test_free")).toBe(true);
    const done = { ...BASE, questProgress: { q_test: { status: "completed" } } };
    expect(questAdvanceCandidates(done).length).toBe(0);
  });
});
