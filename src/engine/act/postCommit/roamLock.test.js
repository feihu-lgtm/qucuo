import { describe, expect, it } from "vitest";
import { writeRoamLocks } from "./roamLock.js";

const apply = (out, prev) => out.changes.varTree(prev);

describe("W-ROAM 十回合交互驻足锁", () => {
  const present = new Set(["老孙", "元朵朵", "兰姐"]);

  it("听意单/回应/点名/软结算四源合并，在场者写 time+10", () => {
    const out = writeRoamLocks({
      intakeTargets: ["老孙"], respondedNpcs: ["元朵朵"], derivedRespondedNpcs: ["元朵朵"],
      activeTarget: null, talkTarget: null, settleNpc: "兰姐",
      presentNames: present, time: 5,
    });
    const tree = apply(out, { 世界: {} });
    expect(tree.世界.驻足锁).toEqual({ 老孙: 15, 元朵朵: 15, 兰姐: 15 });
  });

  it("不在场/「无」/空值不钉；无交互且无过期键时原样返回（不多写）", () => {
    const prev = { 世界: { 驻足锁: { 老孙: 20 } } };
    const out = writeRoamLocks({
      intakeTargets: ["路人甲", "无"], respondedNpcs: [], derivedRespondedNpcs: null,
      activeTarget: null, talkTarget: "", settleNpc: null,
      presentNames: present, time: 5,
    });
    expect(apply(out, prev)).toBe(prev);
  });

  it("过期键（unlockAt <= currentTurn）顺手清理防膨胀", () => {
    const prev = { 世界: { 驻足锁: { 老孙: 4, 元朵朵: 20 } } };
    const out = writeRoamLocks({
      intakeTargets: [], respondedNpcs: [], derivedRespondedNpcs: [],
      activeTarget: null, talkTarget: null, settleNpc: null,
      presentNames: present, time: 5,
    });
    const tree = apply(out, prev);
    expect(tree.世界.驻足锁).toEqual({ 元朵朵: 20 });
  });

  it("再次交互刷新到最新 time+10", () => {
    const prev = { 世界: { 驻足锁: { 老孙: 12 } } };
    const out = writeRoamLocks({
      intakeTargets: ["老孙"], respondedNpcs: [], derivedRespondedNpcs: [],
      activeTarget: null, talkTarget: null, settleNpc: null,
      presentNames: present, time: 8,
    });
    expect(apply(out, prev).世界.驻足锁.老孙).toBe(18);
  });
});
