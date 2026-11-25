// WO-16B：系统好感账本——settle 社交 deterministic 硬结算的纯函数测试
import { describe, expect, it } from "vitest";
import { systemAffectionDelta, systemAffectionPin, hasNoAffectionTrack } from "./affection.js";

describe("systemAffectionDelta 系统好感结算", () => {
  it("基础增量落账并记日涨账", () => {
    const { delta, tree } = systemAffectionDelta({}, "才旦", 4, { charm: 5, time: 0 });
    expect(delta).toBe(4);
    expect(tree.角色.才旦.好感度).toBe(4);
    expect(tree.世界.好感日增.gained.才旦).toBe(4);
  });

  it("魅力修正：高魅力放大正增量", () => {
    const plain = systemAffectionDelta({}, "甲", 4, { charm: 5, time: 0 });
    const charming = systemAffectionDelta({}, "甲", 4, { charm: 10, time: 0 });
    expect(charming.delta).toBeGreaterThan(plain.delta);
  });

  it("range clamp：增量收窄进结算区间", () => {
    const { delta } = systemAffectionDelta({}, "甲", 99, { charm: 1, time: 0, range: [2, 4] });
    expect(delta).toBeLessThanOrEqual(4);
  });

  it("0-100 clamp：98 分只能再涨 2", () => {
    const tree = { 角色: { 甲: { 好感度: 98 } } };
    const { delta } = systemAffectionDelta(tree, "甲", 5, { charm: 5, time: 0 });
    expect(delta).toBe(2);
  });

  it("每日 +12 上限：当日已涨 11 只剩 1 点额度", () => {
    const tree = { 世界: { 好感日增: { dayStamp: 0, gained: { 甲: 11 } } } };
    const { delta, note } = systemAffectionDelta(tree, "甲", 5, { charm: 5, time: 0 });
    expect(delta).toBe(1);
    const full = systemAffectionDelta({ 世界: { 好感日增: { dayStamp: 0, gained: { 甲: 12 } } } }, "甲", 5, { charm: 5, time: 0 });
    expect(full.delta).toBe(0);
    expect(full.note).toContain("涨满");
    void note;
  });

  it("跨天重置额度", () => {
    const tree = { 世界: { 好感日增: { dayStamp: 0, gained: { 甲: 12 } } } };
    const { delta } = systemAffectionDelta(tree, "甲", 5, { charm: 5, time: 24 });
    expect(delta).toBe(5);
  });
});

describe("systemAffectionPin 邀同行钉账", () => {
  it("从无到有钉到 45", () => {
    const { tree } = systemAffectionPin({}, "墨团", 45);
    expect(tree.角色.墨团.好感度).toBe(45);
  });
  it("已超过目标不回退（幂等）", () => {
    const { delta, tree } = systemAffectionPin({ 角色: { 墨团: { 好感度: 60 } } }, "墨团", 45);
    expect(delta).toBe(0);
    expect(tree.角色.墨团.好感度).toBe(60);
  });
});

describe("hasNoAffectionTrack 无好感轨道", () => {
  it("兽类/forbidden/缄默跳过", () => {
    expect(hasNoAffectionTrack({ beast: true })).toBe(true);
    expect(hasNoAffectionTrack({ intimacy: { forbidden: true } })).toBe(true);
    expect(hasNoAffectionTrack({ cannotSpeak: true })).toBe(true);
    expect(hasNoAffectionTrack({ name: "才旦" })).toBe(false);
  });
});
