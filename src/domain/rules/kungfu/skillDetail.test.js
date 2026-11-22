import { describe, expect, it } from "vitest";
import { SKILL_CATALOG, makeSkillEntry } from "../../data/kungfu/qucuoKungfu.js";
import { deriveMoveFromSkill } from "../npc/npcSkillMoves.js";
import { skillDetail } from "./skillDetail.js";

const byId = (id) => Object.values(SKILL_CATALOG).flat().find((s) => s.id === id);

describe("skillDetail", () => {
  it("attack skill: catalog desc, multiplier, cost and its effect lines", () => {
    const entry = makeSkillEntry(byId("kf_lieyan"));
    const d = skillDetail(entry, deriveMoveFromSkill(entry));
    expect(d.desc).toBe(byId("kf_lieyan").desc);
    const rows = Object.fromEntries(d.rows.map((r) => [r.label, r.value]));
    expect(rows.类型).toBe("攻击类");
    expect(rows.威力).toBe("伤害倍率 ×1");
    expect(rows.耗气).toBe("2 点");
    expect(d.effects.length).toBeGreaterThan(0);
  });

  it("neigong shows its passive bonus", () => {
    const entry = makeSkillEntry(byId("kf_jinshen"));
    const rows = Object.fromEntries(skillDetail(entry, deriveMoveFromSkill(entry)).rows.map((r) => [r.label, r.value]));
    expect(rows.减伤).toMatch(/受伤倍率/);
    expect(rows.被动).toContain("气血上限+8");
  });

  it("fixed master move uses its own desc", () => {
    const skill = { name: "x", fixed: true, quality: "蓝", move: { type: "攻击", baseDamageMultiplier: 1.5, energyCost: 3, desc: "本招" } };
    const d = skillDetail(skill, skill.move);
    expect(d.desc).toBe("本招");
    expect(d.rows.find((r) => r.label === "火候").value).toContain("完整招式");
  });
});

describe("skillDetail passive arts", () => {
  it.each(["铁头功", "驴打滚"])("%s shows only its passive, no move cost or effects", async (name) => {
    const { STARTER_SKILLS } = await import("../../data/kungfu/starterKungfu.js");
    const def = STARTER_SKILLS.find((s) => s.name === name);
    const skill = { ...def, stage: "入门" };
    const d = skillDetail(skill, deriveMoveFromSkill(skill));
    expect(d.rows.map((r) => r.label)).not.toContain("耗气");
    expect(d.rows.map((r) => r.label)).toContain("被动");
    expect(d.effects).toEqual([]);
  });
});
