import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getResidentNpcs } from "../../domain/data/npc/residentNpcs.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { questGateReqs } from "../../domain/rules/quests/questEngine.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { settleNpcDuel } from "../npc/settleDuel.js";

const id = "emei_1_xichengshiyao";
const quest = QUCUO_QUESTS.find((entry) => entry.id === id);
const giver = getResidentNpcs("锦官城").find((npc) => npc.name === quest.giver);
const setup = () => ({
  char: { money: 100, special: { 智谋: 10 } },
  room: { name: "锦官城", npcs: [{ ...giver, id: `pool_${giver.id}` }] },
  innerRoomName: "慈济佛堂",
  inv: [], skills: [], flags: [], questProgress: {}, varTree: {}, time: 1,
});
const apply = (state, result) => ({ ...state, ...Object.fromEntries(Object.entries(result.changes || {}).map(
  ([key, value]) => [key, typeof value === "function" ? value(state[key]) : value],
)) });
const advance = (state, choice = "") => apply(state, parseLocalCommand(`推进任务 ${id} ${choice}`, state, { surface: "cli" }).result);
const atTemple = () => ({ ...advance(setup()), innerRoomName: "城西破庙" });
const won = () => {
  const state = atTemple();
  const npc = { id: "foe", name: "天龙教外围眼线", questBranchFlag: "quest_emei1_fight" };
  const options = { pendingQuestBranch: { questId: id, flag: npc.questBranchFlag, mode: "combat" }, rng: () => 1 };
  return { ...apply(state, settleNpcDuel(state, npc, { ...options, outcome: "win" })), innerRoomName: "慈济佛堂" };
};

describe("峨1·西城施药", () => {
  it("starts with 了因师太 in 慈济佛堂 only", () => {
    expect(getLocalQuestStage(quest, setup())?.id).toBe("vigil");
    expect(getLocalQuestStage(quest, { ...setup(), innerRoomName: "听竹轩" })).toBeNull();
    expect(getLocalQuestStage(quest, { ...setup(), room: { name: "锦官城", npcs: [] } })).toBeNull();
    expect(getLocalQuestStage(quest, { ...setup(), varTree: { 世界: { 势力声誉: { 峨眉派: -1 } } } })).toBeNull();
    expect(getLocalQuestStage(quest, { ...setup(), varTree: { 世界: { 威望: -20 } } })).toBeNull();
    expect(getLocalQuestStage(quest, { ...setup(), varTree: { 世界: { 威望: -19 } } })?.id).toBe("vigil");
    expect(questGateReqs(quest, { 世界: { 威望: -20 } }).map((r) => [r.label, r.ok])).toEqual([["峨眉派声誉 ≥ 0", true], ["威望 ≥ -19", false]]);
  });

  it("needs a win at 城西破庙 before the report", () => {
    const state = atTemple();
    expect(state.questProgress[id].currentStageIndex).toBe(1);
    expect(advance({ ...state, innerRoomName: "城门" })).toEqual({ ...state, innerRoomName: "城门" });
    const after = won();
    expect(after.questProgress[id].currentStageIndex).toBe(2);
    expect(after.inv.map((item) => item.name)).toContain("曲措旧田契残页");
  });

  it("official branch rewards 锦官城 and the deed hint; reputation ripples through applyFactionRep", () => {
    const done = advance(won(), "交官府法办");
    expect(done.questProgress[id].status).toBe("completed");
    expect(done.char.money).toBe(180);
    expect(done.inv.filter((item) => item.name === "清心避瘴散")).toHaveLength(3);
    expect(done.flags).toContain("flag_emei_tusi_deed_hint");
    expect(done.varTree.世界.势力声誉).toMatchObject({ 峨眉派: 15, 青城派: 3, 丐帮三星分舵: 3, 天龙教: -8, 锦官城: 5, 五仙教: -8 });
  });

  it("cripple branch gives prestige instead", () => {
    const done = advance(won(), "废武逐出城");
    expect(done.varTree.世界.威望).toBe(3);
    expect(done.flags).not.toContain("flag_emei_tusi_deed_hint");
    expect(done.varTree.世界.势力声誉.锦官城).toBeUndefined();
  });
});
