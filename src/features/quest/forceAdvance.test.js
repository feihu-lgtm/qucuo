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

describe("forceAdvanceQuest · deliver/collect 实物闸", () => {
  const deliverQuest = {
    id: "deliver_quest",
    stages: [
      { completionFlag: "s1_delivered", deliver: { item: "糌粑", to: "老孙" }, onReach: { money: 5 } },
      { completionFlag: "s2_done", onReach: {} },
    ],
  };
  const base = {
    flags: [], questProgress: {}, char: {}, varTree: {},
    room: { name: "x", npcs: [{ name: "老孙" }] }, inv: [{ name: "糌粑" }],
  };

  it("物在包里、收件人在场才推进，交付件从背包扣一件", () => {
    const result = forceAdvanceQuest(base, deliverQuest, "s1_delivered");
    expect(result.changes.questProgress({}).deliver_quest.currentStageIndex).toBe(1);
    expect(result.changes.inv(base.inv)).toEqual([]);
  });

  it("空手或收件人不在场一律拒收", () => {
    expect(forceAdvanceQuest({ ...base, inv: [] }, deliverQuest, "s1_delivered").changes).toEqual({});
    expect(forceAdvanceQuest(
      { ...base, room: { name: "x", npcs: [{ name: "才旦" }] } },
      deliverQuest, "s1_delivered",
    ).changes).toEqual({});
  });

  it("收件人在据点花名册但不在当前内层房间也拒收（老孙绑定老孙饭馆）", () => {
    const atOtherRoom = { ...base, room: { name: "鱼定村", npcs: [{ name: "老孙" }] }, innerRoomName: "才旦家" };
    expect(forceAdvanceQuest(atOtherRoom, deliverQuest, "s1_delivered").changes).toEqual({});
    const atHisRoom = { ...atOtherRoom, innerRoomName: "老孙饭馆" };
    expect(forceAdvanceQuest(atHisRoom, deliverQuest, "s1_delivered").changes.questProgress({}).deliver_quest.currentStageIndex).toBe(1);
  });

  it("deliver.keep 标记的剧情还回件不扣背包", () => {
    const keepQuest = {
      id: "keep_quest",
      stages: [{ completionFlag: "k_done", deliver: { item: "霜天月", to: "何雨谢", keep: true }, onReach: {} }],
    };
    const keepBase = { ...base, inv: [{ name: "霜天月" }], room: { name: "x", npcs: [{ name: "何雨谢" }] } };
    const result = forceAdvanceQuest(keepBase, keepQuest, "k_done");
    expect(result.changes.questProgress({}).keep_quest.status).toBe("completed");
    expect(result.changes.inv?.(keepBase.inv) ?? keepBase.inv).toEqual([{ name: "霜天月" }]);
  });

  it("collect 阶段要采集物已在包里才放行", () => {
    const collectQuest = {
      id: "collect_quest",
      stages: [{ completionFlag: "c_done", collect: { item: "油布包", at: "鱼定村·村口" }, onReach: {} }],
    };
    expect(forceAdvanceQuest({ ...base, inv: [] }, collectQuest, "c_done").changes).toEqual({});
    const ok = forceAdvanceQuest({ ...base, inv: [{ name: "油布包" }] }, collectQuest, "c_done");
    expect(ok.changes.questProgress({}).collect_quest.status).toBe("completed");
  });
});
