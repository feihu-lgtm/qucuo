import { describe, expect, it } from "vitest";
import { forceAdvanceQuest, playLocalQuestStage } from "./logic.js";

const quest = {
  id: "test_quest",
  stages: [{ completionFlag: "stage_done", onReach: { money: 10, flags: ["reward_flag"] } }],
};

describe("forceAdvanceQuest", () => {
  it("advances the matching stage and applies its rewards", () => {
    const result = forceAdvanceQuest({
      flags: [],
      questProgress: {},
      char: { money: 5 },
      inv: [],
      varTree: {},
    }, quest, "stage_done");

    expect(result.changes.flags([])).toEqual(["stage_done", "reward_flag"]);
    expect(result.changes.questProgress({}).test_quest.status).toBe("completed");
    expect(result.changes.char({ money: 5 }).money).toBe(15);
  });

  it("does not advance when the supplied flag does not match", () => {
    const result = forceAdvanceQuest({
      flags: [],
      questProgress: {},
      char: {},
      inv: [],
      varTree: {},
    }, quest, "wrong_flag");

    // 新契约：不属于当前阶段 completionFlag 的 flag 整个拒收（不进 flags、不建进度）——
    // 否则提前塞进靠后阶段的 flag 会留在 flags 里，轮到那步时被白捡完成。
    expect(result.changes).toEqual({});
  });
});

describe("playLocalQuestStage · requiresMoney 门槛", () => {
  const payQuest = {
    id: "pay_quest",
    localOnly: true,
    stages: [{
      completionFlag: ["paid", "fought"],
      choices: [
        { flag: "paid", label: "垫银了税", resolve: "none", requiresMoney: 30 },
        { flag: "fought", label: "动手赶差", resolve: "combat", combatNpc: { name: "差役", levelCap: 3 } },
      ],
      onReach: { money: 5 },
    }],
  };
  const base = { flags: [], questProgress: {}, char: { money: 0 }, inv: [], varTree: {}, room: { name: "x" } };

  it("银两不足时付费分支不推进", () => {
    const result = playLocalQuestStage({ ...base, char: { money: 10 } }, payQuest, "垫银了税");
    expect(result.changes).toBeUndefined();
    expect(result.logs[0].text).toContain("银两不足");
  });

  it("银两足够时付费分支正常推进", () => {
    const result = playLocalQuestStage({ ...base, char: { money: 35 } }, payQuest, "垫银了税");
    expect(result.changes.flags([])).toContain("paid");
  });
});

describe("forceAdvanceQuest · 非 localOnly 兜底校验", () => {
  const repQuest = {
    id: "rep_quest",
    requiresFactionRep: { 玉泉寨: 10 },
    stages: [{ completionFlag: "rep_done", onReach: { money: 5 } }],
  };
  const base = { flags: [], questProgress: {}, char: {}, inv: [] };

  it("声誉门槛没过时拒收 flag、不建进度", () => {
    const result = forceAdvanceQuest({ ...base, varTree: {} }, repQuest, "rep_done");
    expect(result.changes).toEqual({});
  });

  it("声誉达标才放行", () => {
    const result = forceAdvanceQuest(
      { ...base, varTree: { 世界: { 势力声誉: { 玉泉寨: 12 } } } },
      repQuest, "rep_done");
    expect(result.changes.questProgress({}).rep_quest.status).toBe("completed");
  });

  it("已完结的任务再喂 flag 也拒收", () => {
    const result = forceAdvanceQuest(
      { ...base, varTree: { 世界: { 势力声誉: { 玉泉寨: 12 } } }, questProgress: { rep_quest: { status: "completed" } } },
      repQuest, "rep_done");
    expect(result.changes).toEqual({});
  });

  it("靠后阶段的 flag 不能提前塞进 flags", () => {
    const two = {
      id: "two_stage",
      stages: [
        { completionFlag: "s1_done", onReach: {} },
        { completionFlag: "s2_done", onReach: {} },
      ],
    };
    const result = forceAdvanceQuest({ ...base, varTree: {} }, two, "s2_done");
    expect(result.changes).toEqual({});
  });
});
