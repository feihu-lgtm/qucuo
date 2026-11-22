import { describe, expect, it } from "vitest";
import { applyEndOfTurnStatus, resolveTurn } from "./resolveTurn.js";
import { MOVE_TYPE } from "./moveTypes.js";
import { applyStatus, dispelControlDrain } from "./statusEffects.js";

const side = (move, statusSlots = {}) => ({
  move: { id: move.name, baseDamageMultiplier: 0, ...move },
  hp: [100, 100],
  energy: [10, 10],
  special: { 身法: 5 },
  baseAtk: 20,
  equipAtk: 0,
  equipDef: 0,
  statusSlots,
});

const antidote = { name: "服「冰魄解蛊散」", type: MOVE_TYPE.STATUS, fromItem: true, energyCost: 0, hpRestore: 0.2, dispelSelf: true };
const selfCleanse = { name: "运功自解", type: MOVE_TYPE.STATUS, energyCost: 2, dispelSelf: true };
const strike = { name: "直拳", type: MOVE_TYPE.ATTACK, baseDamageMultiplier: 1 };
const guard = { name: "格挡", type: MOVE_TYPE.DEFENSE };

describe("dispelSelf", () => {
  it("an antidote cleanses poison even when the drinker is hit, so the poison does not tick", () => {
    const poisoned = applyStatus({}, "淬毒");
    const result = resolveTurn(side(antidote, poisoned), side(strike));
    expect(result.dispelSelfA).toBe(true);
    expect(result.dispelMarksA).toBe(false);
    const slots = dispelControlDrain(poisoned);
    expect(slots.drain).toBeNull();
    const tick = applyEndOfTurnStatus({ statusSlots: slots, hp: [80, 100] }, { statusSlots: {}, hp: [100, 100] });
    expect(tick.statusDamageA).toBe(0);
  });

  it("a full-cleanse antidote also clears marks", () => {
    const result = resolveTurn(side({ ...antidote, dispelMarks: true }), side(strike));
    expect(result).toMatchObject({ dispelSelfA: true, dispelMarksA: true });
  });

  it("a cleansing move works unless an attack interrupts it", () => {
    expect(resolveTurn(side(selfCleanse), side(guard)).dispelSelfA).toBe(true);
    expect(resolveTurn(side(selfCleanse), side(strike)).dispelSelfA).toBe(false);
    expect(resolveTurn(side(guard), side(selfCleanse)).dispelSelfB).toBe(true);
  });
});
