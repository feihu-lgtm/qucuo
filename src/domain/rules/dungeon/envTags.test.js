import { describe, it, expect } from "vitest";
import { ENV_TAG_HANDLERS } from "./envTags.js";

const room = (extra = {}) => ({ desc: "x", exits: {}, ...extra });
const rs = () => ({ seed: "test-run", envTags: {} });

describe("ENV_TAG_HANDLERS 十宫机制", () => {
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

  it("xueshanWindchill：露天积失温，避风清零", () => {
    const s = rs();
    const r = ENV_TAG_HANDLERS.xueshanWindchill.onEnter(room({ openAir: true }), s);
    expect(r.effects.statMod.全属性).toBeLessThan(0);
    ENV_TAG_HANDLERS.xueshanWindchill.onEnter(room({ shelter: true }), s);
    expect(s.envTags.chill.level).toBe(0);
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

  it("tangGear：破坏总齿轮后陷阱 DC 下降", () => {
    const s = rs();
    const r = ENV_TAG_HANDLERS.tangGear.onAction({ type: "sabotage", target: "gear" }, s);
    expect(r.effects.trapDcBonus).toBe(-15);
    expect(ENV_TAG_HANDLERS.tangGear.tick(s).effects.trapDcBonus).toBe(-15);
  });

  it("huanxiDesire：滞留与媚术累积到顶判负", () => {
    const s = rs();
    for (let i = 0; i < 30; i++) ENV_TAG_HANDLERS.huanxiDesire.tick(s); // +2/tick → 60
    expect(s.envTags.desire.value).toBe(60);
    const r1 = ENV_TAG_HANDLERS.huanxiDesire.onAction({ type: "charmHit" }, s); // +25 → 85
    expect(r1.effects.defeat).toBeUndefined();
    const r2 = ENV_TAG_HANDLERS.huanxiDesire.onAction({ type: "seduced" }, s); // +25 → 100
    expect(r2.effects.defeat).toBe(true);
  });
});
