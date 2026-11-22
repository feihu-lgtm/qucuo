import { describe, expect, it } from "vitest";
import { isAtQuestPlace, parseQuestPlace, questPlaceProblem } from "./questPlace.js";
import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";

describe("任务地点写法：据点·内层房间", () => {
  it("按第一个「·」切开，内层名本身带「·」也能认", () => {
    expect(parseQuestPlace("白塔·白塔地宫")).toEqual({ district: "白塔", inner: "白塔地宫" });
    expect(parseQuestPlace("鱼定村·村口·广场")).toEqual({ district: "鱼定村", inner: "村口·广场" });
  });

  it("据点和内层房间都对上才算到了", () => {
    expect(isAtQuestPlace("鱼定土司·库房", "鱼定土司", "库房")).toBe(true);
    expect(isAtQuestPlace("鱼定土司·库房", "鱼定土司", "府门")).toBe(false);
    expect(isAtQuestPlace("鱼定土司·库房", "鱼定村", "库房")).toBe(false);
  });

  it("全部任务数据的地点都写到了真实存在的内层房间", () => {
    const problems = [];
    for (const quest of QUCUO_QUESTS) {
      for (const stage of quest.stages || []) {
        const collects = Array.isArray(stage.collect) ? stage.collect : stage.collect ? [stage.collect] : [];
        for (const at of [stage.at, ...collects.map((c) => c.at)].filter((v) => v !== undefined)) {
          const problem = questPlaceProblem(at);
          if (problem) problems.push(`${quest.id}/${stage.id}：${problem}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("人物刷新也要落到内层", () => {
  it("有内层地图的据点，每个驻场人物都落在真实存在的内层房间", async () => {
    const { RESIDENT_NPCS } = await import("../../data/npc/residentNpcs.js");
    const { getInnerRoom, getResidentRoomForNpc, hasInnerMap } = await import("../map/innerMap.js");
    const problems = [];
    for (const [district, list] of Object.entries(RESIDENT_NPCS)) {
      if (!hasInnerMap(district)) continue;
      for (const npc of list) {
        const home = getResidentRoomForNpc(district, npc.name);
        if (!home) problems.push(`${district}·${npc.name}：没有内层落点`);
        else if (!getInnerRoom(district, home)) problems.push(`${district}·${npc.name}：房间「${home}」不存在`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("护送任务的收货地点写到内层", async () => {
    const { ESCORT_QUESTS } = await import("../../data/quests/escortQuests.js");
    expect(ESCORT_QUESTS.map((q) => questPlaceProblem(q.targetLocation)).filter(Boolean)).toEqual([]);
  });
});
