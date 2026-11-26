import { describe, it, expect } from "vitest";
import { handleLearn } from "./learn.js";

function mkJ(rollVal) {
  const facts = [];
  const warrants = [];
  const notes = [];
  let fid = 0;
  let wid = 0;
  return {
    J: {
      envelope: { char: { money: 0 } },
      roll: () => rollVal,
      turn: 1, day: 1, place: "x",
      budget: { allowSkillBestow: false, tier: "T0", maxPointBudget: 0 },
      facts, warrants, notes,
      nextFactId: () => `F${++fid}`,
      nextWarrantId: () => `W${++wid}`,
      accept: { value: false },
      lastActionOutcome: {},
    },
    facts, notes,
  };
}

describe("F5 learn 拒传潜能保底", () => {
  const npc = { name: "才旦", personality: "稳重" };
  it("拒传（roll 高）仍签 PROGRESS_CULTIVATION potDelta 1", () => {
    const { J, facts, notes } = mkJ(0.999);
    handleLearn(J, { kind: "learn" }, npc, 0, 0);
    expect(notes.join()).toContain("不肯传授");
    const pot = facts.find((f) => f.op === "PROGRESS_CULTIVATION");
    expect(pot).toBeTruthy();
    expect(pot.potDelta).toBe(1);
    expect(J.lastActionOutcome.rejected).toBe(true);
  });
  it("愿意教但 tier 不足降点拨仍是 potDelta 2（既有口径不变）", () => {
    const { J, facts } = mkJ(0.0);
    handleLearn(J, { kind: "learn" }, npc, 0, 0);
    expect(facts.find((f) => f.op === "PROGRESS_CULTIVATION")?.potDelta).toBe(2);
  });
});
