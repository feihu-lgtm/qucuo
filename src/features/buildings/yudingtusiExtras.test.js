import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getBuildingIdForInnerRoom, resolveInnerExit } from "../../domain/rules/map/innerMap.js";
import { tryInnerMove } from "../../domain/rules/map/innerMove.js";
import { buildingClosedReason } from "../../domain/rules/economy/strongholdGate.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { isQuestChoiceOpen, isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards, stageRewardPatches } from "../../domain/rules/quests/questRewards.js";
import { applyPatches } from "../../domain/rules/state/applyPatches.js";
import { playLocalQuestStage } from "../quest/logic.js";
import { buySkill } from "./skills.js";

const TS = "鱼定土司府";
const tree = (rep, favor = {}) => ({
  世界: { 势力声誉: { [TS]: rep } },
  角色: Object.fromEntries(Object.entries(favor).map(([name, value]) => [name, { 好感度: value }])),
});
const skill = (name) => SKILL_CATALOG.土司.find((entry) => entry.name === name);
const q4 = () => QUCUO_QUESTS.find((entry) => entry.id === "yudingtusi_4_gushu_wenxin");
const choice = (flag) => q4().stages[1].choices.find((entry) => entry.flag === flag);
const intoManor = (rep) => {
  const dir = ["n", "s", "e", "w"].find((d) => resolveInnerExit("鱼定土司", "府门", d) === "护卫厅");
  return tryInnerMove({ movingDir: dir, forceLayer: "inner", room: { name: "鱼定土司", npcs: [] }, innerRoomName: "府门", flags: [], varTree: tree(rep), questProgress: {}, inv: [], char: {} });
};

describe("鱼定土司府·终局补完", () => {
  it("binds the guest chest to the vault, opens at rep 40 and is flagged empty", () => {
    const chest = getBuildingsForLocation("鱼定土司").find((b) => b.id === getBuildingIdForInnerRoom("鱼定土司", "库房"));
    expect(chest).toMatchObject({ id: "chest_yudingtusi", type: "chest", emptyStock: true });
    expect(buildingClosedReason(chest, "鱼定土司", tree(39))).toMatch(/声誉 ≥ 40/);
    expect(buildingClosedReason(chest, "鱼定土司", tree(40))).toBeNull();
  });

  it("intercepts players at rep ≤ -60 at the gate and closes every manor building", () => {
    expect(intoManor(-59)).toMatchObject({ kind: "move", innerDest: "护卫厅" });
    expect(intoManor(-60)).toMatchObject({ kind: "blocked", lockedMsg: expect.stringContaining("巡捕营") });
    for (const building of getBuildingsForLocation("鱼定土司")) {
      expect(buildingClosedReason(building, "鱼定土司", tree(-60)), building.id).toBeTruthy();
    }
    expect(buildingClosedReason({ id: "x" }, "鱼定村", tree(-100))).toBeNull();
  });

  it("gates 印山镇岳掌 on 桑杰朵杰 favor 45 or the 府4 purge, 雪域不动诀 also via 格桑顿珠's true heir flag", () => {
    const st = (rep, favor, flags = []) => ({ varTree: tree(rep, favor), flags, questProgress: {} });
    expect(skillUnlockStatus(st(80, { 桑杰朵杰: 44 }), skill("印山镇岳掌")).ok).toBe(false);
    expect(skillUnlockStatus(st(80, { 桑杰朵杰: 45 }), skill("印山镇岳掌")).ok).toBe(true);
    expect(skillUnlockStatus(st(79, { 桑杰朵杰: 90 }), skill("印山镇岳掌")).ok).toBe(false);
    expect(skillUnlockStatus(st(-40, {}, ["quest_ts4_purge"]), skill("印山镇岳掌")).ok).toBe(true);
    expect(skillUnlockStatus(st(-40), skill("雪域不动诀")).ok).toBe(false);
    expect(skillUnlockStatus(st(-40, {}, ["tusi_gesang_true_heir"]), skill("雪域不动诀")).ok).toBe(true);
  });

  it("opens 府4 after 府3 with 格桑顿珠 favor 40", () => {
    const done = { yudingtusi_3_jiuqi_canyin: { status: "completed" } };
    expect(isQuestGateOpen(q4(), done, [], tree(0, { 格桑顿珠: 39 }))).toBe(false);
    expect(isQuestGateOpen(q4(), done, [], tree(0, { 格桑顿珠: 40 }))).toBe(true);
    expect(isQuestGateOpen(q4(), {}, [], tree(0, { 格桑顿珠: 90 }))).toBe(false);
  });

  it("gates the 府4 branches: 梅朵 favor 60 for the regency, 府3 burn plus rep 80 for the purge", () => {
    const ctx = (rep, favor, flags = []) => ({ varTree: tree(rep, favor), flags, questProgress: {} });
    expect(isQuestChoiceOpen(choice("quest_ts4_truth"), ctx(-100))).toBe(true);
    expect(isQuestChoiceOpen(choice("quest_ts4_regent"), ctx(0, { 梅朵: 59 }))).toBe(false);
    expect(isQuestChoiceOpen(choice("quest_ts4_regent"), ctx(0, { 梅朵: 60 }))).toBe(true);
    expect(isQuestChoiceOpen(choice("quest_ts4_purge"), ctx(100, {}, []))).toBe(false);
    expect(isQuestChoiceOpen(choice("quest_ts4_purge"), ctx(79, {}, ["quest_ts3_burn"]))).toBe(false);
    expect(isQuestChoiceOpen(choice("quest_ts4_purge"), ctx(80, {}, ["quest_ts3_burn"]))).toBe(true);
  });

  it("pays 府4 rewards at the 合稿 values and grants the matching skill flags", () => {
    const stage = q4().stages[1];
    const run = (flag) => resolveStageRewards(stage, [flag]);
    const truth = run("quest_ts4_truth");
    expect(truth.factionRep).toMatchObject({ [TS]: -40, 雪山派: 15, 喇嘛庙: 15, 玉泉寨: 15, 鱼定村: 15 });
    expect(truth.flags).toContain("tusi_gesang_true_heir");
    expect(truth.money).toBe(400);
    const purge = run("quest_ts4_purge");
    expect(purge.factionRep).toMatchObject({ [TS]: 40, 锦官城: -12 });
    expect(purge.money).toBe(1200);
    expect(run("quest_ts4_regent").flags).toContain("flag_meiduo_regent");
    for (const name of ["点钢乌木镇边矛", "巡边行走金印"]) expect(makeNamedItem(name)?.quality, name).toBe("紫");
  });

  it("lands the 府4 prestige at the 合稿 value in one write, past the AI ±15 cap", () => {
    const ambush = q4().stages[1];
    for (const [flag, delta] of [["quest_ts4_truth", 20], ["quest_ts4_regent", 20], ["quest_ts4_purge", -25]]) {
      const { state } = applyPatches({ varTree: { 世界: { 威望: 10 } }, flags: [], inv: [], char: { money: 0 } }, stageRewardPatches(resolveStageRewards(ambush, [flag])));
      expect(state.varTree.世界.威望, flag).toBe(10 + delta);
    }
  });

  it("refuses to sell manor skills by typed command once the manor is closed to the player", () => {
    const state = { room: { name: "鱼定土司" }, innerRoomName: "护卫厅", flags: ["tusi_gesang_true_heir"], varTree: tree(-60), skills: [], char: { money: 9999 } };
    const result = buySkill(state, skill("雪域不动诀"));
    expect(result.changes).toBeUndefined();
    expect(result.logs[0].text).toContain("不伺候你");
    expect(buySkill({ ...state, varTree: tree(-59) }, skill("雪域不动诀")).changes?.skills).toHaveLength(1);
  });

  it("refuses a gated branch even when typed directly", () => {
    const quest = { ...q4(), stages: [{ ...q4().stages[1], choices: [{ ...choice("quest_ts4_purge"), resolve: "none" }] }] };
    const st = { char: { money: 0 }, inv: [], skills: [], flags: [], varTree: tree(100), room: { name: "鱼定土司", npcs: [] }, innerRoomName: "护卫厅",
      questProgress: { [quest.id]: { status: "active", currentStageIndex: 0 } } };
    const result = playLocalQuestStage(st, quest, "铁腕清营·拿下格桑顿珠");
    expect(result.logs?.[0]?.text).toMatch(/条件还不满足|没有可推进/);
  });
});
