import { describe, expect, it } from "vitest";
import { settleNpcDuel } from "./logic.js";
import { deferredIntentReceipt } from "../../domain/rules/judge/deferredIntents.js";

const makeState = (angerState) => ({
  char: { name: "少侠", hp: [60, 60], special: { 气运: 5 }, money: 100 },
  room: { name: "鱼定村", npcs: [], items: [] },
  varTree: { 角色: { 师父: { 好感度: 40, ...(angerState ? { 生气状态: angerState } : {}) } }, 世界: {} },
  inv: [], flags: [], skills: [], pot: 0, questProgress: {}, time: 0,
});

const activeAnger = { active: true, turnsLeft: 2, reason: "偷窃被察觉" };

describe("气头上切磋定案", () => {
  it("pissed NPC 切磋获胜后怒气清除（resolvedBy combat），不再升级为强制恶斗", () => {
    const result = settleNpcDuel(makeState(activeAnger), { name: "师父", levelCap: 1 }, { outcome: "win", battleLog: [] });
    const tree = typeof result.changes.varTree === "function" ? result.changes.varTree(makeState(activeAnger).varTree) : result.changes.varTree;
    expect(tree.角色.师父.生气状态.active).toBe(false);
    expect(tree.角色.师父.生气状态.resolvedBy).toBe("combat");
    expect(result.logs.some((l) => /恶气也撒了出去/.test(l.text))).toBe(true);
  });

  it("pissed NPC 切磋落败后怒气同样清除（打过即消，不论胜负）", () => {
    const result = settleNpcDuel(makeState(activeAnger), { name: "师父", levelCap: 1 }, { outcome: "lose", battleLog: [] });
    const tree = typeof result.changes.varTree === "function" ? result.changes.varTree(makeState(activeAnger).varTree) : result.changes.varTree;
    expect(tree.角色.师父.生气状态.active).toBe(false);
  });

  it("无怒气 NPC 切磋后不动生气状态（原流程不变）", () => {
    const result = settleNpcDuel(makeState(null), { name: "师父", levelCap: 1 }, { outcome: "win", battleLog: [] });
    const tree = typeof result.changes.varTree === "function" ? result.changes.varTree(makeState(null).varTree) : result.changes.varTree;
    expect(tree.角色.师父.生气状态).toBeUndefined();
    expect(result.logs.some((l) => /恶气也撒了出去/.test(l.text))).toBe(false);
  });

  it("判官链意向回执：angry 时约束正文写挑衅激怒方向，不得写心平气和应下", () => {
    const angry = deferredIntentReceipt({ kind: "duel", target: "师父" }, { angry: true });
    expect(angry).toContain("挑衅");
    expect(angry).toContain("气头上");
    expect(angry).not.toContain("抱拳邀战——");
    const calm = deferredIntentReceipt({ kind: "duel", target: "师父" });
    expect(calm).toContain("抱拳邀战");
  });
});
