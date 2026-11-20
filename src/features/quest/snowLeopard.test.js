import { describe, expect, it, vi } from "vitest";
import { snowLeopardRule } from "./snowLeopard.js";
import { questFlagRule } from "./rules.js";
import { inviteCompanion, giftNpc, settleNpcDuel } from "../npc/logic.js";
import { SNOW_QUEST_ID, SNOW_TRUSTED, SNOW_SPIRITS, snowLeopardNote, snowLeopardHint, filterSnowModelFlags } from "../../domain/quests/snowLeopardQuest.js";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { commitModelFlags } from "../../engine/act/commitFlags.js";
import { createWorldRules } from "../../engine/worldRules.js";
import { buildQuestStageNote } from "../../engine/prompt/roundNotes.js";
import { callExtraction } from "../../domain/prompt/extractionEngine.js";
import { createExtractionState } from "../../engine/runTurn.js";
import { assemblePrompt } from "../../engine/prompt/assemblePrompt.js";

const leopard = { name: "雪豹", beast: true, companionCandidate: true };
const initial = () => ({ char: { special: { 体魄: 5, 魅力: 5 }, hp: [100, 100] }, room: { name: "鱼定村", npcs: [leopard] }, inv: [], skills: [], flags: [], questProgress: {}, varTree: {}, time: 1 });
function apply(state, result) {
  for (const [key, change] of Object.entries(result?.changes || {})) state[key] = typeof change === "function" ? change(state[key]) : change;
  return state;
}
const active = () => apply(initial(), snowLeopardRule.run(initial(), { getNow: () => 10 }));

describe("收复雪豹", () => {
  it("is first, preserves hunter second, and starts for new and locked old saves", () => {
    expect(QUCUO_QUESTS.slice(0, 2).map((q) => q.id)).toEqual([SNOW_QUEST_ID, "hunter_learn_quest"]);
    const state = active();
    expect(state.questProgress[SNOW_QUEST_ID]).toMatchObject({ status: "active", currentStageIndex: 0, startedAt: 10 });
    expect(snowLeopardRule.run(state)).toBeNull();
  });

  it("silently completes unlocked old saves without changing companions", () => {
    const state = { ...initial(), companionState: { snowLeopard: { unlocked: true, data: { name: "旧伙伴" } } } };
    const before = state.companionState;
    const result = snowLeopardRule.run(state);
    expect(result.logs).toBeUndefined();
    apply(state, result);
    expect(state.companionState).toBe(before);
    expect(state.questProgress[SNOW_QUEST_ID]).toMatchObject({ status: "completed", currentStageIndex: 2 });
    expect(snowLeopardRule.run(state)).toBeNull();
  });

  it.each(["体魄", "魅力"])("records effective %s including equipment and food, permanently", (attr) => {
    const state = active();
    state.flags = [`buff_${attr}+1_untilturn_10`];
    state.inv = [{ category: "accessory", equipped: true, sixDim: { [attr]: 1 } }];
    apply(state, snowLeopardRule.run(state));
    expect(state.flags).toContain(attr === "体魄" ? "snow_spirit_strength" : "snow_spirit_charm");
    state.inv = []; state.time = 11;
    expect(snowLeopardRule.run(state)).toBeNull();
  });

  it("records any completed village line, not unrelated or failed quests", () => {
    const state = active();
    state.questProgress.village1_lubujianbuping = { status: "failed" };
    state.questProgress.zhaxi_line = { status: "completed" };
    expect(snowLeopardRule.run(state)).toBeNull();
    state.questProgress.village1_lubujianbuping.status = "completed";
    apply(state, snowLeopardRule.run(state));
    expect(state.flags).toContain("snow_spirit_village");
  });

  it.each([true, false])("records only hostile wins, including generated NPCs (%s)", (hostile) => {
    const state = active();
    const npc = { name: "路上敌人", id: "random_123", hostile, levelCap: 1 };
    apply(state, settleNpcDuel(state, npc, { outcome: "lose", rng: () => 1 }));
    expect(state.flags).not.toContain("snow_spirit_duel");
    apply(state, settleNpcDuel(state, npc, { outcome: "win", rng: () => 1 }));
    expect(state.flags.includes("snow_spirit_duel")).toBe(hostile);
  });

  it("cures only medicine gifts, not food, wrong NPC or inactive quest", () => {
    const state = active();
    for (const item of ["老孙饭馆的糌粑", "金疮药"]) {
      state.inv = [item];
      apply(state, giftNpc(state, leopard, item));
      expect(state.flags.includes("snow_spirit_medicine")).toBe(item === "金疮药");
    }
    expect(giftNpc(initial(), leopard, "金疮药").changes.flags).toBeUndefined();
    expect(giftNpc(active(), { name: "村民" }, "金疮药").changes.flags).toBeUndefined();
    expect(giftNpc(active(), null, "金疮药").logs[0].t).toBe("err");
  });

  it("advances at five distinct spirits, not four or duplicates, then unlocks exactly once", () => {
    const state = active();
    state.flags = SNOW_SPIRITS.slice(0, 4).map((s) => s.flag);
    state.flags.push(state.flags[0]);
    expect(snowLeopardRule.run(state)).toBeNull();
    expect(inviteCompanion(state, leopard).logs[0].text).toContain("偏过头");
    state.flags.push(SNOW_SPIRITS[4].flag);
    const runner = createWorldRules([snowLeopardRule, questFlagRule], { getState: () => state, applyResult: (r) => apply(state, r) });
    runner.check();
    expect(state.flags).toContain(SNOW_TRUSTED);
    expect(state.questProgress[SNOW_QUEST_ID].currentStageIndex).toBe(1);
    apply(state, inviteCompanion(state, leopard));
    const companion = state.companionState.snowLeopard;
    expect(companion.unlocked).toBe(true);
    expect(state.questProgress[SNOW_QUEST_ID].status).toBe("completed");
    expect(inviteCompanion(state, leopard)).toEqual({});
    runner.check();
    expect(state.companionState.snowLeopard).toBe(companion);
    expect(inviteCompanion(state, null).logs[0].t).toBe("err");
  });

  it("accepts only meat and scratch AI flags while active and locally present", () => {
    const flags = [...SNOW_SPIRITS.map((s) => s.flag), SNOW_TRUSTED, "snow_leopard_invited", "snow_spirit_cheat", "other_quest"];
    const state = active();
    expect(filterSnowModelFlags(flags, state)).toEqual(["snow_spirit_meat", "snow_spirit_scratch", "other_quest"]);
    for (const other of [initial(), { ...state, room: { npcs: [] } }, { ...state, innerRoomName: "猎户小屋" }]) {
      expect(filterSnowModelFlags(flags, other)).toEqual(["other_quest"]);
    }
    const setFlags = vi.fn();
    commitModelFlags({ ...state, p: { delta: { flags_add: flags } }, setFlags });
    expect(setFlags.mock.calls[0][0]([])).toEqual(["snow_spirit_meat", "snow_spirit_scratch", "other_quest"]);
  });

  it.each(SNOW_SPIRITS)("counts $label as the fifth spirit", ({ flag }) => {
    const state = active();
    state.flags = SNOW_SPIRITS.filter((s) => s.flag !== flag).slice(0, 4).map((s) => s.flag);
    expect(snowLeopardRule.run(state)).toBeNull();
    state.flags.push(flag);
    const result = snowLeopardRule.run(state);
    expect(result.logs).toHaveLength(1);
    apply(state, result);
    apply(state, questFlagRule.run(state));
    expect(state.questProgress[SNOW_QUEST_ID].currentStageIndex).toBe(1);
    expect(snowLeopardRule.run(state)).toBeNull();
  });

  it("does not gate pearl or imported companions", () => {
    expect(inviteCompanion(initial(), { name: "珍珠" }).changes.companionState.pearl.unlocked).toBe(true);
    expect(inviteCompanion(initial(), { name: "外来客", imported: true }).changes.companionState).toBeTruthy();
  });

  it("passes quest context to gift settlements and dual-call extraction", () => {
    const state = active();
    const prompt = { ...state, dao: {}, apiCfg: {}, innerRoomName: "村口" };
    const built = assemblePrompt({ prompt }, "赠肉给雪豹", { settleNpc: "雪豹" }, [], [], [], []);
    expect(built.snowLeopardContext).toContain("snow_spirit_meat");
    const extraction = createExtractionState({ state: { room: state.room, char: state.char }, prompt }, { cmd: "替雪豹挠痒" });
    expect(snowLeopardNote(extraction)).toContain("snow_spirit_scratch");
    expect(snowLeopardHint({ ...state, cmd: "雪豹怎么了" })).toContain("替它挠痒");
    expect(snowLeopardHint({ ...state, cmd: "你好" })).toBe("");
    expect(snowLeopardHint({ ...state, cmd: "雪豹怎么了", flags: ["snow_spirit_scratch"] })).toBe("");
  });

  it("injects feeding, scratching and wound guidance only for active present leopard", async () => {
    const state = active();
    const note = buildQuestStageNote(state);
    for (const text of ["像母鸡一样蹲着", "非肉则拒吃", "前爪有陈年旧伤", "snow_spirit_meat", "snow_spirit_scratch"]) expect(note).toContain(text);
    expect(snowLeopardNote(initial())).toBe("");
    expect(snowLeopardNote({ ...state, room: { npcs: [] } })).toBe("");
    expect(snowLeopardNote({ ...state, flags: ["snow_spirit_scratch", "snow_spirit_medicine"] })).not.toContain("像母鸡");
    const chat = vi.fn().mockResolvedValue({ text: "{}" });
    await callExtraction("TALK_CASUAL", "你替雪豹挠了痒。", state, {}, null, { chat });
    expect(chat.mock.calls[0][0][0].content).toContain("snow_spirit_scratch");
  });
});
