import { describe, expect, it, vi } from "vitest";
import { snowLeopardRule } from "../features/quest/snowLeopard.js";
import { questFlagRule } from "../domain/rules/quests/rules.js";
import { giftNpc, settleNpcDuel } from "../features/npc/logic.js";
import { inviteCompanion } from "../features/npc/inviteCompanion.js";
import { SNOW_QUEST_ID, SNOW_TRUSTED, SNOW_SPIRITS, snowLeopardNote, snowLeopardHint, filterSnowModelFlags } from "../domain/rules/quests/snowLeopardQuest.js";
import { QUCUO_QUESTS } from "../domain/data/quests/qucuoQuests.js";
import { commitModelFlags } from "../engine/act/commitFlags.js";
import { createWorldRules } from "../engine/worldRules.js";
import { buildQuestStageNote } from "../engine/prompt/roundNotes.js";
import { createExtractionState } from "../engine/runTurn.js";
import { assemblePrompt } from "../engine/prompt/assemblePrompt.js";

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

  it.each(["黑风寨山贼", "熊山野兽", "unknown", undefined])("uses the explicit encounter bandit tag, not a name heuristic (%s)", (tag) => {
    const state = active();
    const npc = { name: "拦路山贼", id: "generated_42", tag, levelCap: 1 };
    apply(state, settleNpcDuel(state, npc, { outcome: "lose", rng: () => 1 }));
    expect(state.flags).not.toContain("snow_spirit_duel");
    apply(state, settleNpcDuel(state, npc, { outcome: "win", rng: () => 1 }));
    expect(state.flags.includes("snow_spirit_duel")).toBe(tag === "黑风寨山贼");
  });

  it("cures only medicine gifts, not food, wrong NPC or inactive quest", () => {
    const state = active();
    for (const item of ["老孙饭馆的糌粑", "金疮药"]) {
      state.inv = [item];
      apply(state, giftNpc(state, leopard, item));
      expect(state.flags.includes("snow_spirit_medicine")).toBe(item === "金疮药");
    }
    expect(giftNpc({ ...initial(), inv: ["金疮药"] }, leopard, "金疮药").changes.flags).toBeUndefined();
    expect(giftNpc({ ...active(), inv: ["金疮药"] }, { name: "村民" }, "金疮药").changes.flags).toBeUndefined();
    expect(giftNpc(active(), null, "金疮药").logs[0].t).toBe("err");
  });

  it.each([
    { name: "another room", room: { name: "大草甸", npcs: [] } },
    { name: "another inner room", innerRoomName: "猎户小屋" },
    { name: "empty room", room: { name: "鱼定村", npcs: [] } },
  ])("rejects remote treatment and AI credit in $name despite retained targeting", (remote) => {
    const state = { ...active(), ...remote, settleNpc: "雪豹", activeTarget: "雪豹", cmd: "给雪豹喂肉、挠痒、治伤", inv: ["金疮药"] };
    expect(snowLeopardNote(state)).toBe("");
    expect(filterSnowModelFlags(["snow_spirit_meat", "snow_spirit_scratch"], state)).toEqual([]);
    apply(state, giftNpc(state, leopard, "金疮药"));
    expect(state.flags).not.toContain("snow_spirit_medicine");
    const setFlags = vi.fn();
    commitModelFlags({ ...state, p: { delta: { flags_add: ["snow_spirit_meat", "snow_spirit_scratch"] } }, setFlags });
    expect(setFlags).not.toHaveBeenCalled();
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
    // WO-16C-snow：全部 snow 旗系统确权——模型输出一律剥除，任何场景都不放行
    expect(filterSnowModelFlags(flags, state)).toEqual(["other_quest"]);
    for (const other of [initial(), { ...state, room: { npcs: [] } }, { ...state, innerRoomName: "猎户小屋" }]) {
      expect(filterSnowModelFlags(flags, other)).toEqual(["other_quest"]);
    }
    // 纯函数化后 commitModelFlags 返回 { changes: { flags } } 由 commitRound 落盘
    const out = commitModelFlags({ ...state, p: { delta: { flags_add: flags } } });
    expect(out.changes.flags([])).toEqual(["other_quest"]);
  });

  it.each([0, 123])("uses the injected invitation clock %s exactly once", (now) => {
    const state = active();
    state.flags.push(SNOW_TRUSTED);
    const ctx = { getNow: vi.fn(() => now) };
    apply(state, inviteCompanion(state, leopard, ctx));
    expect(state.questProgress[SNOW_QUEST_ID].completedAt).toBe(now);
    expect(inviteCompanion(state, leopard, ctx)).toEqual({});
    expect(ctx.getNow).toHaveBeenCalledTimes(1);
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
    const built = assemblePrompt({ prompt }, "赠肉给雪豹", { settleNpc: "雪豹", settleKind: "gift" }, [], [], [], []);
    // WO-16C：赠礼提示改为「系统已结算」口径，仍点名肉食旗标说明归属
    expect(built.snowLeopardContext).toContain("snow_spirit_meat");
    expect(built.snowLeopardContext).toContain("系统结算");
    const extraction = createExtractionState({ state: { room: state.room, char: state.char }, prompt }, { cmd: "替雪豹挠痒" });
    // 自由行动提示不再让 AI 写旗——改为全部系统结算声明
    expect(snowLeopardNote(extraction)).toContain("系统确定性结算");
    expect(snowLeopardNote(extraction)).not.toContain("在delta.flags_add加入");
    expect(snowLeopardHint({ ...state, cmd: "雪豹怎么了" })).toContain("替它挠痒");
    expect(snowLeopardHint({ ...state, cmd: "你好" })).toBe("");
    expect(snowLeopardHint({ ...state, cmd: "雪豹怎么了", flags: ["snow_spirit_scratch"] })).toBe("");
  });

  it("injects feeding, scratching and wound guidance only for active present leopard", async () => {
    const state = active();
    const note = buildQuestStageNote(state);
    for (const text of ["像母鸡一样蹲着", "前爪有陈年旧伤", "系统确定性结算"]) expect(note).toContain(text);
    expect(snowLeopardNote(initial())).toBe("");
    expect(snowLeopardNote({ ...state, room: { npcs: [] } })).toBe("");
    expect(snowLeopardNote({ ...state, flags: ["snow_spirit_scratch", "snow_spirit_medicine"] })).not.toContain("像母鸡");
  });


});

describe("和出战伙伴本人打是 1v1", () => {
  it("duelAlly 对手是出战伙伴时不拉它并肩，对别人照旧 2v2", async () => {
    const { duelAlly, unlockSnowLeopard } = await import("../domain/rules/companion/companion.js");
    const companionState = unlockSnowLeopard({});
    const data = companionState.snowLeopard.data;
    expect(duelAlly(companionState, { name: "拦路山贼" })?.key).toBe("snowLeopard");
    expect(duelAlly(companionState, { name: "雪豹" })).toBeNull();
    expect(duelAlly(companionState, { ...data, brief: "x" })).toBeNull();
    expect(duelAlly({}, { name: "拦路山贼" })).toBeNull();
  });

  it("赢了出战伙伴本人不算并肩破敌", async () => {
    const { unlockSnowLeopard } = await import("../domain/rules/companion/companion.js");
    const state = { ...initial(), companionState: unlockSnowLeopard({}) };
    const self = settleNpcDuel(state, { ...state.companionState.snowLeopard.data }, { outcome: "win", rng: () => 1 });
    expect((self.logs || []).some((l) => l.text.includes("并肩破敌"))).toBe(false);
    const other = settleNpcDuel(state, { name: "拦路山贼", levelCap: 1 }, { outcome: "win", rng: () => 1 });
    expect((other.logs || []).some((l) => l.text.includes("并肩破敌"))).toBe(true);
  });

  it("切磋界面按 duelLineup 选团战还是 1v1", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../ui/panels/GlobalOverlays.jsx", import.meta.url), "utf8");
    expect(src).toContain("duelLineup(companionState, duelingNpc)");
    expect(src).toContain("lineup.team ? (");
  });

  it("并肩破敌好感记给真正上场的伙伴，不再写死雪豹；铁伯这类 mute 随从不涨", async () => {
    const { unlockImportedCompanion, unlockFollowerCompanion } = await import("../domain/rules/companion/companion.js");
    const { ADVENTURER_POOL_IP } = await import("../domain/data/dungeon/adventurersIP.js");
    const { TEAMWORK_GAIN } = await import("../domain/rules/combat/duelSettleMath.js");
    const duoduo = ADVENTURER_POOL_IP.find((a) => a.name === "元朵朵");
    const companionState = unlockFollowerCompanion(unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1 }), duoduo);
    const state = { ...initial(), companionState };
    const res = settleNpcDuel(state, { name: "拦路山贼", levelCap: 1 }, { outcome: "win", rng: () => 1 });
    const texts = (res.logs || []).map((l) => l.text).filter((t) => t.includes("并肩破敌"));
    expect(texts).toEqual([`  💗 与元朵朵并肩破敌，默契渐深，好感 +${TEAMWORK_GAIN}`]);
    const next = apply({ ...state }, res);
    // 初见好感底值由 markNpcAsKnown 给，这里只断言确实涨了并肩的这一笔
    expect(next.varTree.角色.元朵朵.好感度).toBeGreaterThanOrEqual(TEAMWORK_GAIN);
    expect(next.varTree.角色?.雪豹).toBeUndefined();
    expect(next.varTree.角色?.铁伯).toBeUndefined();
  });
});
