import { describe, expect, it } from "vitest";
import { SKILL_CATALOG, makeSkillEntry } from "../../data/kungfu/qucuoKungfu.js";
import { deriveMoveFromSkill, deriveMovesetFromSkills, SKILL_EFFECT_KEYS } from "./npcSkillMoves.js";

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
