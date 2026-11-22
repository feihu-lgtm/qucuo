import { describe, expect, it } from "vitest";
import { joinSect, leaveSect } from "./logic.js";
import { FACTION_ENTRIES, checkFactionEntry, defectedFlag } from "../../domain/rules/character/factionEntry.js";
import { SECT_ENTRY } from "../../domain/rules/character/sectEntry.js";
import { isSkillBreakthroughLocked, skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { breakthroughSkill } from "../cultivation/logic.js";

const qc = FACTION_ENTRIES.青城派;
const member = () => ({
  flags: [qc.flag], inv: [{ name: qc.token }, { name: "干粮" }],
  varTree: { 世界: { 势力声誉: { 青城派: 60 } } },
});

describe("leaveSect", () => {
  it("defects: rep -40, token taken, flag swapped for 叛出 mark", () => {
    const s = member();
    const r = leaveSect(s, "青城派");
    expect(r.changes.inv(s.inv)).toEqual([{ name: "干粮" }]);
    expect(r.changes.flags(s.flags)).toEqual([defectedFlag("青城派")]);
    expect(r.changes.varTree(s.varTree).世界.势力声誉.青城派).toBe(-40);
    expect(r.settleOptions.settleNpc).toBe(qc.master);
  });

  it("expel resets rep to -70 and defaults to the current sect", () => {
    const s = member();
    expect(leaveSect(s, undefined, { mode: "expel" }).changes.varTree(s.varTree).世界.势力声誉.青城派).toBe(-70);
  });

  it("refuses when not a member", () => {
    expect(leaveSect({ flags: [] }, "青城派").changes).toBeUndefined();
  });

  it("closes the gate for good after defecting", () => {
    const flags = [defectedFlag("青城派"), qc.trial.flag];
    const status = checkFactionEntry(qc, { varTree: { 世界: { 势力声誉: { 青城派: 90 }, 威望: 10 } }, flags });
    expect(status.eligible).toBe(false);
    expect(status.missing).toContain("defected");
    const snow = { flags: [defectedFlag(SECT_ENTRY.sect)], char: { money: 999, neigong: 99 }, varTree: { 角色: { [SECT_ENTRY.master]: { 好感度: 99 } } } };
    expect(joinSect(snow).changes).toBeUndefined();
  });

  it("locks high-tier sect skills for learning and breakthrough, keeps low-tier ones", () => {
    const state = { flags: [defectedFlag("青城派")], varTree: { 世界: { 势力声誉: { 青城派: 100 } } }, pot: 999 };
    const high = { id: "x", name: "高阶", stage: "入门", unlock: { faction: "青城派", rep: 40 } };
    const low = { id: "y", name: "低阶", stage: "入门", unlock: { faction: "青城派", rep: 15 } };
    expect(skillUnlockStatus(state, high).ok).toBe(false);
    expect(skillUnlockStatus(state, low).ok).toBe(true);
    expect(isSkillBreakthroughLocked(state, high).locked).toBe(true);
    expect(isSkillBreakthroughLocked(state, low).locked).toBe(false);
    const r = breakthroughSkill({ ...state, skills: [high] }, "x");
    expect(r.changes).toBeUndefined();
    expect(r.logs[0].text).toContain("叛出青城派");
  });
});
