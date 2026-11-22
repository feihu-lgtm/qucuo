import { describe, expect, it } from "vitest";
import { resolveTurn } from "./resolveTurn.js";
import {
  BEATS,
  counterStatusKind,
  isCounterStatusMove,
  judgeTypeMatchup,
  MATCHUP_TABLE,
  MOVE_TYPE,
  resolveMatchupRule,
} from "./moveTypes.js";

const side = (name, type, effects = {}, stats = {}) => ({
  move: {
    id: name,
    name,
    type,
    baseDamageMultiplier: type === MOVE_TYPE.ATTACK ? 1 : 0.5,
    ...effects,
  },
  hp: [100, 100],
  energy: [10, 10],
  special: { 身法: 5, ...stats },
  baseAtk: 20,
  equipAtk: 0,
  equipDef: 0,
  statusSlots: {},
});

describe("table-driven move matchup rules", () => {
  it("covers every type pair and expresses the settled rules", () => {
    const types = Object.values(MOVE_TYPE);
    for (const typeA of types) {
      expect(Object.keys(MATCHUP_TABLE[typeA]).sort()).toEqual([...types].sort());
    }
    expect(MATCHUP_TABLE[MOVE_TYPE.ATTACK][MOVE_TYPE.STATUS]).toMatchObject({ winner: "A", resolve: "interrupt" });
    expect(MATCHUP_TABLE[MOVE_TYPE.ATTACK][MOVE_TYPE.DEFENSE]).toMatchObject({ winner: "B", resolve: "block" });
    expect(MATCHUP_TABLE[MOVE_TYPE.ATTACK][MOVE_TYPE.ATTACK]).toMatchObject({ winner: "tie", resolve: "collide-speed" });
    expect(MATCHUP_TABLE[MOVE_TYPE.DEFENSE][MOVE_TYPE.STATUS]).toMatchObject({ winner: "B", resolve: "each" });
    expect(MATCHUP_TABLE[MOVE_TYPE.DEFENSE][MOVE_TYPE.DEFENSE]).toMatchObject({ winner: "tie", resolve: "standoff" });
    expect(MATCHUP_TABLE[MOVE_TYPE.STATUS][MOVE_TYPE.STATUS]).toMatchObject({ winner: "tie", resolve: "each" });
    expect(BEATS).toEqual({
      [MOVE_TYPE.ATTACK]: MOVE_TYPE.STATUS,
      [MOVE_TYPE.DEFENSE]: MOVE_TYPE.ATTACK,
      [MOVE_TYPE.STATUS]: MOVE_TYPE.DEFENSE,
    });
    expect(judgeTypeMatchup(MOVE_TYPE.STATUS, MOVE_TYPE.DEFENSE)).toBe("A");
  });

  it("selects reflect and control overrides for counter-class status moves", () => {
    const attack = side("拳", MOVE_TYPE.ATTACK).move;
    const reflect = side("反劲诀", MOVE_TYPE.STATUS, { doubleReflectDamage: true }).move;
    const control = side("点穴指", MOVE_TYPE.STATUS, { applyStatus: "麻穴" }).move;

    expect(resolveMatchupRule(attack, reflect)).toMatchObject({ winner: "B", resolve: "counterStatus", counterKind: "reflect" });
    expect(resolveMatchupRule(attack, control)).toMatchObject({ winner: "tie", resolve: "counterStatus", counterKind: "control" });
    expect(resolveMatchupRule(attack, side("回气", MOVE_TYPE.STATUS).move)).toMatchObject({ winner: "A", resolve: "interrupt", counterKind: null });
  });
});

describe("counter status move classification", () => {
  it("derives reflect and control kinds from move flags and status categories", () => {
    expect(counterStatusKind(side("天惊诀", "状态", { doubleReflectDamage: true }).move)).toBe("reflect");
    expect(isCounterStatusMove(side("麻穴指", "状态", { applyStatus: "麻穴" }).move)).toBe(true);
    expect(isCounterStatusMove(side("惑心步", "状态", { confuseChance: 0.5 }).move)).toBe(true);
    expect(isCounterStatusMove(side("回气", "状态", { energyRestore: 5 }).move)).toBe(false);
    expect(isCounterStatusMove(side("连环腿", "攻击", { applyStatus: "麻穴" }).move)).toBe(false);
  });
});

describe("attack and counter-status resolution", () => {
  it("interrupts an ordinary status move and suppresses its healing", () => {
    const result = resolveTurn(
      side("碎岩击", MOVE_TYPE.ATTACK),
      side("运功疗伤", MOVE_TYPE.STATUS, { hpRestore: 0.2, applyStatus: "淬毒" }),
    );

    expect(result).toMatchObject({
      interruptedB: true,
      statusAppliedToA: null,
      hpRestoreB: 0,
      counterStatus: null,
    });
    expect(result.damageToB).toBeGreaterThan(0);
  });

  it("keeps a potion-style item heal when the drinker is interrupted", () => {
    const result = resolveTurn(
      side("碎岩击", MOVE_TYPE.ATTACK),
      side("服药", MOVE_TYPE.STATUS, { fromItem: true, hpRestore: 0.2 }),
    );

    expect(result.interruptedB).toBe(true);
    expect(result.damageToB).toBeGreaterThan(0);
    expect(result.hpRestoreB).toBe(20);
  });

  it("lets a reflect status win, block the attack, apply status, and return reflected damage", () => {
    const result = resolveTurn(
      side("直拳", MOVE_TYPE.ATTACK),
      side("天惊诀", MOVE_TYPE.STATUS, { doubleReflectDamage: true, confuseChance: 1 }),
    );

    expect(result).toMatchObject({
      counterStatus: "reflect",
      matchup: "B",
      damageToB: 0,
      statusAppliedToA: "气乱",
      reflectedA: true,
      cancelledA: true,
    });
    expect(result.damageToA).toBeGreaterThan(0);
    expect(result.notes.join("")).toContain("护体反劲截住直拳");
  });

  it("applies the attack multiplier only once when reflecting", () => {
    const reflect = side("天惊诀", MOVE_TYPE.STATUS, { doubleReflectDamage: true });
    const attack = side("一剑西来", MOVE_TYPE.ATTACK, { baseDamageMultiplier: 2.2 });
    const counter = resolveTurn(attack, reflect);
    const statusBeatDefense = resolveTurn(
      reflect,
      side("一剑西来", MOVE_TYPE.DEFENSE, { baseDamageMultiplier: 2.2 }),
    );

    expect(counter.damageToA).toBe(88);
    expect(statusBeatDefense.damageToB).toBe(88);
  });

  it("lets a faster control status cancel the attack and land its control", () => {
    const result = resolveTurn(
      side("陈尧天拳", MOVE_TYPE.ATTACK, {}, { 身法: 2 }),
      side("麻穴指", MOVE_TYPE.STATUS, { applyStatus: { name: "麻穴", chance: 1 } }, { 身法: 8 }),
    );

    expect(result).toMatchObject({
      counterStatus: "control",
      matchup: "B",
      speedWinner: "B",
      damageToA: 0,
      damageToB: 0,
      statusAppliedToA: "麻穴",
      cancelledA: true,
    });
    expect(result.notes.join("")).toContain("抢先点中陈尧天拳");
  });

  it("lets a slower control status be interrupted by the attack without healing", () => {
    const result = resolveTurn(
      side("陈尧天拳", MOVE_TYPE.ATTACK, {}, { 身法: 8 }),
      side("疗伤点穴", MOVE_TYPE.STATUS, {
        applyStatus: { name: "麻穴", chance: 1 },
        hpRestore: 0.2,
      }, { 身法: 2 }),
    );

    expect(result).toMatchObject({
      counterStatus: null,
      matchup: "A",
      speedWinner: "A",
      interruptedB: true,
      hpRestoreB: 0,
      statusAppliedToA: null,
    });
    expect(result.damageToB).toBeGreaterThan(0);
    expect(result.notes.join("")).toContain("正面打断");
  });
});

describe("unchanged move matchups", () => {
  it("allows both status moves and their healing to take effect", () => {
    const result = resolveTurn(
      side("麻穴指", MOVE_TYPE.STATUS, { applyStatus: { name: "麻穴", chance: 1 }, hpRestore: 0.1 }),
      side("乱心诀", MOVE_TYPE.STATUS, { applyStatus: { name: "气乱", chance: 1 }, hpRestore: 0.2 }),
    );

    expect(result.statusAppliedToB).toBe("麻穴");
    expect(result.statusAppliedToA).toBe("气乱");
    expect(result.hpRestoreA).toBe(10);
    expect(result.hpRestoreB).toBe(20);
  });

  it("keeps defense-versus-defense as a no-damage stand-off", () => {
    const result = resolveTurn(
      side("铁布衫", MOVE_TYPE.DEFENSE),
      side("磐石桩", MOVE_TYPE.DEFENSE),
    );

    expect(result.matchup).toBe("tie");
    expect(result.damageToA).toBe(0);
    expect(result.damageToB).toBe(0);
    expect(result.notes.join("")).toContain("僵持不下");
  });

  it("keeps attack speed and first-kill behavior", () => {
    const result = resolveTurn(
      side("快拳", MOVE_TYPE.ATTACK, { forceFirst: true, baseDamageMultiplier: 10 }),
      side("重拳", MOVE_TYPE.ATTACK, { baseDamageMultiplier: 1 }),
    );

    expect(result.speedWinner).toBe("A");
    expect(result.damageToB).toBeGreaterThanOrEqual(100);
    expect(result.damageToA).toBe(0);
    expect(result.notes.join("")).toContain("一击制敌");
  });
});
