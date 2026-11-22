import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getResidentNpcs } from "../../domain/data/npc/residentNpcs.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { isInnerExitUnlocked, INNER_MAP } from "../../domain/rules/map/innerMap.js";
import { parseLocalCommand } from "../../engine/localCommands.js";

const LAMA_QUESTS = QUCUO_QUESTS.filter((quest) => quest.id.startsWith("lamamiao_"));
const find = (id) => QUCUO_QUESTS.find((quest) => quest.id === id);
const resident = (district, name) => getResidentNpcs(district).find((npc) => npc.name === name);
const apply = (state, result) => ({ ...state, ...Object.fromEntries(Object.entries(result.changes || {}).map(
  ([key, value]) => [key, typeof value === "function" ? value(state[key]) : value],
)) });
const advance = (state, id, choice = "") => apply(state, parseLocalCommand(`推进任务 ${id} ${choice}`.trim(), state, { surface: "cli" }).result);
const base = (innerRoomName, npcs, extra = {}) => ({
  char: { money: 100, special: { 智谋: 10 } },
  room: { name: "喇嘛庙", npcs: npcs.map((npc) => ({ ...npc, id: `pool_${npc.id}` })) },
  innerRoomName, inv: [], skills: [], flags: [], questProgress: {}, varTree: {}, time: 1, ...extra,
});

describe("喇嘛庙任务线", () => {
  it("registers 寺1～寺5 and 药1/塔1/斋1 with 喇嘛庙 gates no higher than 100", () => {
    expect(LAMA_QUESTS.map((quest) => quest.title)).toEqual([
      "寺1·香火暗影", "寺2·残卷与旧灰", "寺3·雪泥鸿爪", "寺4·地宫问心", "寺5·钟鸣三十年",
      "药1·风雪采药行", "塔1·绕塔之人", "斋1·灶下余温",
    ]);
    for (const quest of LAMA_QUESTS) {
      const gates = Object.values(quest.requiresFactionRep || {});
      expect(gates.length, quest.id).toBeGreaterThan(0);
      for (const gate of gates) expect(gate, quest.id).toBeLessThanOrEqual(100);
      if (quest.requiresPrestige != null) expect(quest.requiresPrestige).toBeLessThanOrEqual(100);
    }
    expect(find("lamamiao_5_zhongmingsanshinian").requiresFactionRep).toEqual({ 喇嘛庙: 80 });
  });

  it("gives every quest a giver who lives in 喇嘛庙 or 白塔", () => {
    for (const quest of LAMA_QUESTS) {
      expect(resident("喇嘛庙", quest.giver) || resident("白塔", quest.giver), quest.id).toBeTruthy();
    }
  });

  it("寺1 is 洛桑's introduction at 山门, gated by rep and chained into 寺2", () => {
    const luosang = resident("喇嘛庙", "洛桑");
    const start = base("山门", [luosang]);
    const quest = find("lamamiao_1_xianghuoanying");
    expect(getLocalQuestStage(quest, start)?.id).toBe("intercept");
    expect(getLocalQuestStage(quest, { ...start, varTree: { 世界: { 势力声誉: { 喇嘛庙: -1 } } } })).toBeNull();
    const stopped = { ...advance(start, quest.id, "凭威望震慑"), innerRoomName: "大殿" };
    const done = advance(stopped, quest.id, "当众揭穿，交罗布桑处理");
    expect(done.questProgress[quest.id].status).toBe("completed");
    expect(done.char.money).toBe(160);
    expect(done.inv.map((item) => item.name)).toContain("藏红花平安袋");
    expect(done.flags).toEqual(expect.arrayContaining(["lama_introduced", "flag_lama_exposed_rice"]));
    expect(done.varTree.世界.势力声誉).toMatchObject({ 喇嘛庙: 15, 鱼定土司府: -8, 鱼定村: 3 });

    const ciren = resident("喇嘛庙", "次仁");
    const next = find("lamamiao_2_canjuanjiuhui");
    expect(getLocalQuestStage(next, { ...base("藏经阁", [ciren]), varTree: done.varTree })).toBeNull();
    expect(getLocalQuestStage(next, { ...base("藏经阁", [ciren]), varTree: done.varTree, questProgress: done.questProgress })?.id).toBe("ashes");
  });

  it("寺3 hands over the key that opens 白塔地宫", () => {
    const reward = find("lamamiao_3_xuenihongzhua").stages.at(-1).onReach;
    expect(reward).toMatchObject({ money: 150, factionRep: { 喇嘛庙: 25, 雪山派: 15 } });
    expect(isInnerExitUnlocked(INNER_MAP.白塔.rooms.白塔地宫.unlockCondition, { flags: reward.flags })).toBe(true);
  });

  it("斋1 opens 荤食地下室 as soon as 丹巴 confesses", () => {
    const danba = resident("喇嘛庙", "丹巴");
    const quest = find("lamamiao_side_3_dixiayaorou");
    const state = base("素斋", [danba], { varTree: { 世界: { 势力声誉: { 喇嘛庙: 10 } } } });
    expect(getLocalQuestStage(quest, base("素斋", [danba]))).toBeNull();
    const after = advance(state, quest.id);
    expect(isInnerExitUnlocked(INNER_MAP.喇嘛庙.rooms.荤食地下室.unlockCondition, { flags: after.flags })).toBe(true);
  });
});
