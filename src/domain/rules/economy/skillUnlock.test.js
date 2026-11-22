import { describe, expect, it } from "vitest";
import { SKILL_CATALOG } from "../../data/kungfu/qucuoKungfu.js";
import { FACTION_NAMES } from "../../data/map/factions.js";
import { skillUnlockStatus } from "./skillUnlock.js";

const at = (rep) => ({ flags: [], questProgress: {}, varTree: { 世界: { 势力声誉: { 青城派: rep } } } });
const learnable = (rep) => SKILL_CATALOG.青城.filter((skill) => skillUnlockStatus(at(rep), skill).ok).map((skill) => skill.name);
const UNGATED = ["青城玄门气", "都江古堰势", "梯云纵", "青灵功"];

describe("skillUnlockStatus", () => {
  it("opens Qingcheng skills at the design reputation tiers", () => {
    expect(learnable(-1)).toEqual(UNGATED);
    expect(learnable(0)).toEqual(expect.arrayContaining(["青城剑法", "玄门小周天"]));
    expect(learnable(14)).not.toContain("清风步");
    expect(learnable(15)).toEqual(expect.arrayContaining(["清风步", "松风剑法"]));
    expect(learnable(39)).not.toContain("离堆分水息");
    expect(learnable(40)).toEqual(expect.arrayContaining(["离堆分水息", "听桥·分水"]));
  });

  it("keeps membership-only skills locked until joining exists", () => {
    expect(learnable(100)).not.toContain("一字电剑");
    expect(learnable(100)).not.toContain("紫阳神功");
  });

  it("only counts the skill's own faction", () => {
    const other = { varTree: { 世界: { 势力声誉: { 唐门: 100 } } } };
    expect(skillUnlockStatus(other, SKILL_CATALOG.青城.find((skill) => skill.name === "清风步")).ok).toBe(false);
  });

  it("names a known faction on every reputation gate", () => {
    for (const skill of Object.values(SKILL_CATALOG).flat()) {
      const unlock = skill.unlock;
      if (unlock && (unlock.member || unlock.rep != null || unlock.guestRep != null)) {
        expect(FACTION_NAMES, skill.name).toContain(unlock.faction);
      }
    }
  });
});
