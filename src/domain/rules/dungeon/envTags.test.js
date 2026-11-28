import { describe, it, expect } from "vitest";
import { ENV_TAG_HANDLERS } from "./envTags.js";

const room = (extra = {}) => ({ desc: "x", exits: {}, ...extra });
const rs = () => ({ seed: "test-run", envTags: {} });

describe("ENV_TAG_HANDLERS 名册七宫机制", () => {
  it("baitaPrayerWheel：失败后下房遇敌率抬高", () => {
    const s = rs();
    ENV_TAG_HANDLERS.baitaPrayerWheel.onAction({ type: "checkFailed", result: "fail" }, s);
    const r = ENV_TAG_HANDLERS.baitaPrayerWheel.onEnter(room(), s);
    expect(r.effects.encounterRateBonus).toBeGreaterThan(0);
    // 只在下一房生效一次
    expect(ENV_TAG_HANDLERS.baitaPrayerWheel.onEnter(room(), s).effects.encounterRateBonus).toBeUndefined();
  });

  it("huanjingSpore：深入叠感知降，检查点清零", () => {
    const s = rs();
    const r1 = ENV_TAG_HANDLERS.huanjingSpore.onEnter(room(), s);
    const r2 = ENV_TAG_HANDLERS.huanjingSpore.onEnter(room(), s);
    expect(r2.effects.statMod.感知).toBeLessThan(r1.effects.statMod.感知);
    ENV_TAG_HANDLERS.huanjingSpore.onEnter(room({ isCheckpoint: true }), s);
    expect(s.envTags.spore.level).toBe(0);
  });

  it("sanxingduiPatrol：第三步出潜行检定", () => {
    const s = rs();
    expect(ENV_TAG_HANDLERS.sanxingduiPatrol.tick(s).effects.check).toBeUndefined();
    expect(ENV_TAG_HANDLERS.sanxingduiPatrol.tick(s).effects.check).toBeUndefined();
    const r = ENV_TAG_HANDLERS.sanxingduiPatrol.tick(s);
    expect(r.effects.check.stat).toBe("隐蔽");
    expect(r.effects.check.onFail.damagePct).toBeGreaterThan(0);
  });

  it("shuwangPhosphor：受击叠命中降", () => {
    const s = rs();
    ENV_TAG_HANDLERS.shuwangPhosphor.onAction({ type: "hitTaken" }, s);
    const r = ENV_TAG_HANDLERS.shuwangPhosphor.onAction({ type: "hitTaken" }, s);
    expect(r.effects.statMod.命中).toBe(-10);
  });


  it("wuxianVenom：战区激活后每回合出体质检定", () => {
    const s = rs();
    expect(ENV_TAG_HANDLERS.wuxianVenom.tick(s).effects.check).toBeUndefined(); // 未进战区不发作
    ENV_TAG_HANDLERS.wuxianVenom.onEnter(room({ inCombatZone: true }), s);
    const r = ENV_TAG_HANDLERS.wuxianVenom.tick(s);
    expect(r.effects.check.stat).toBe("体质");
  });

  it("yajiangRope：u/d 移动返回检定，失败跌半血落底层", () => {
    const s = rs();
    const r = ENV_TAG_HANDLERS.yajiangRope.onAction({ type: "move", dir: "d" }, s);
    expect(r.effects.check.stat).toContain("身法");
    expect(r.effects.check.onFail.damagePct).toBe(0.5);
    expect(r.effects.check.onFail.teleport).toBe("bottom");
    expect(ENV_TAG_HANDLERS.yajiangRope.onAction({ type: "move", dir: "e" }, s).effects.check).toBeUndefined();
  });

  it("tianlongSeal：同 seed 封同指令，违规扣当前 50% 血", () => {
    const s = rs();
    ENV_TAG_HANDLERS.tianlongSeal.onEnter(room({ envTag: "tianlongSeal" }), s);
    const sealed = s.envTags.seal.cmd;
    expect(typeof sealed).toBe("string");
    const r = ENV_TAG_HANDLERS.tianlongSeal.onAction({ cmd: sealed }, s);
    expect(r.effects.damagePct).toBe(0.5);
    expect(ENV_TAG_HANDLERS.tianlongSeal.onAction({ cmd: "攻击x" }, s).effects.damagePct).toBeUndefined();
  });



  it("tusiWatch：失败/战败抬高更锣警戒与下房遇敌率，检查点清零", () => {
    const s = rs();
    ENV_TAG_HANDLERS.tusiWatch.onAction({ result: "fail" }, s);
    expect(s.envTags.tusiWatch.alert).toBe(1);
    const enter = ENV_TAG_HANDLERS.tusiWatch.onEnter(room(), s);
    expect(enter.effects.encounterRateBonus).toBeGreaterThan(0);
    ENV_TAG_HANDLERS.tusiWatch.onEnter(room({ isCheckpoint: true }), s);
    expect(s.envTags.tusiWatch.alert).toBe(0);
  });
});
