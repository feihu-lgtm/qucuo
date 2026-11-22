import { describe, expect, it } from "vitest";
import { SKILL_CATALOG, makeSkillEntry } from "../../data/kungfu/qucuoKungfu.js";
import { deriveMoveFromSkill, deriveMovesetFromSkills, SKILL_EFFECT_KEYS } from "./npcSkillMoves.js";
import { resolveTurn } from "../combat/resolveTurn.js";
import { MOVE_TYPE } from "../combat/moveTypes.js";

const all = Object.values(SKILL_CATALOG).flat();

describe("learned catalog skills keep their combat effects", () => {
  it("烈焰拳 learned at the 武馆 still force-crits", () => {
    const entry = makeSkillEntry(all.find((skill) => skill.id === "kf_lieyan"));
    expect(deriveMoveFromSkill(entry).forceCrit).toEqual({ multiplier: 1.4 });
  });

  it("every catalog effect key reaches the derived move, including old saves without the keys", () => {
    for (const def of all) {
      const move = deriveMoveFromSkill({ ...makeSkillEntry(def), active: true });
      for (const key of SKILL_EFFECT_KEYS) if (def[key] !== undefined) expect(move[key], `${def.name}.${key}`).toEqual(def[key]);
    }
  });

  it("an entry's own value still wins over the catalog", () => {
    const def = all.find((skill) => skill.id === "kf_lieyan");
    const moves = deriveMovesetFromSkills([{ ...makeSkillEntry(def), active: true, forceCrit: { multiplier: 2 } }]);
    expect(moves.find((m) => m.sourceSkill === "烈焰拳").forceCrit).toEqual({ multiplier: 2 });
  });
});

describe("review follow-ups: learned effects actually work in combat", () => {
  const learned = (id) => deriveMoveFromSkill(makeSkillEntry(all.find((s) => s.id === id)));
  const side = (move) => ({ move, hp: [100, 100], energy: [10, 10], special: { 身法: 5 }, baseAtk: 20, equipAtk: 0, equipDef: 0, statusSlots: {} });
  const strike = { id: "s", name: "直拳", type: MOVE_TYPE.ATTACK, baseDamageMultiplier: 1, energyCost: 0 };

  it("金蚕脱壳 keeps its self cleanse", () => {
    expect(learned("kf_wx_jincan").dispelSelf).toBe(true);
  });

  it.each(["kf_emei_foguang", "kf_ting_foguang"])("%s reflects damage when it blocks an attack", (id) => {
    const guard = learned(id);
    expect(guard.doubleReflectDamage).toBe(true);
    const result = resolveTurn(side(guard), side(strike));
    expect(result.damageToB).toBeGreaterThan(0);
    const plain = resolveTurn(side({ ...guard, doubleReflectDamage: undefined }), side(strike));
    expect(result.damageToB).toBeGreaterThan(plain.damageToB);
  });
});
