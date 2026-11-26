import { describe, it, expect } from "vitest";
import { handleLearn } from "./learn.js";

function mkJ(rollVal, varTree = {}) {
  const facts = [];
  const warrants = [];
  const notes = [];
  let fid = 0; let wid = 0;
  return {
    J: {
      envelope: { char: { money: 0 }, varTree },
      roll: () => rollVal,
      turn: 10, day: 1, place: "x",
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

describe("W-FIX2 求教拒传防刷", () => {
  it("非习武之人（无任何可授招式）零事实拒传+定点 notes", () => {
    const { J, facts, notes } = mkJ(0.0);
    handleLearn(J, { kind: "learn" }, { name: "老账房", personality: "精明" }, 0, 0);
    expect(facts).toHaveLength(0);
    expect(notes.join()).toContain("并非习武授业之人，无从指点武艺");
    expect(J.lastActionOutcome.rejected).toBe(true);
  });
  it("unlearnable 标记零事实", () => {
    const { J, facts } = mkJ(0.0);
    handleLearn(J, { kind: "learn" }, { name: "虎王", unlearnable: true, moves: [{ name: "扑" }] }, 0, 0);
    expect(facts).toHaveLength(0);
  });
  it("Review 修：moveset 装招的 NPC 不误判非习武（才旦形）", () => {
    const { J, facts, notes } = mkJ(0.999);
    handleLearn(J, { kind: "learn" }, { name: "才旦", personality: "豪爽", moveset: { 攻击: { name: "猎叉刺" } } }, 0, 0);
    expect(notes.join()).not.toContain("并非习武授业之人");
    expect(notes.join()).toContain("不肯传授");
  });

  it("习武之人检定未过：零潜能拒传", () => {
    const { J, facts, notes } = mkJ(0.999);
    handleLearn(J, { kind: "learn" }, { name: "才旦", personality: "豪爽", moves: [{ name: "猎叉刺" }] }, 0, 0);
    expect(notes.join()).toContain("不肯传授");
    expect(facts.filter((f) => f.op === "PROGRESS_CULTIVATION")).toHaveLength(0);
  });
  it("检定通过但 T0：点拨 potDelta 2 + 同时辰幂等锁", () => {
    const npc = { name: "才旦", personality: "豪爽", moves: [{ name: "猎叉刺" }] };
    const { J, facts } = mkJ(0.0);
    handleLearn(J, { kind: "learn" }, npc, 0, 0);
    const pot = facts.find((f) => f.op === "PROGRESS_CULTIVATION");
    expect(pot?.potDelta).toBe(2);
    expect(pot?.restKey).toBe("learnPot_才旦_5");
    // 同辰已有锁账 → 不再签
    const vt = { 世界: { 调息账: ["learnPot_才旦_5"] } };
    const r2 = mkJ(0.0, vt);
    handleLearn(r2.J, { kind: "learn" }, npc, 0, 0);
    expect(r2.facts.filter((f) => f.op === "PROGRESS_CULTIVATION")).toHaveLength(0);
    expect(r2.notes.join()).toContain("再求也无新进益");
  });
});
