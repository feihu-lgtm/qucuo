import { describe, it, expect } from "vitest";
import { handleAppease } from "./appease.js";

function mkJ(rollVal) {
  const facts = []; const notes = [];
  let fid = 0;
  return {
    J: {
      roll: () => rollVal, facts, notes,
      nextFactId: () => `F${++fid}`,
      accept: { value: false }, lastActionOutcome: {},
    },
    facts, notes,
  };
}

describe("W-FIX2 赔罪拒收信号", () => {
  const npc = { name: "老孙", personality: "暴烈" };
  it("掷骰失败 else 分支补 lastActionOutcome.rejected", () => {
    const { J, notes } = mkJ(0.999);
    handleAppease(J, { kind: "appease", stance: "sincere" }, npc, 0, 0);
    expect(notes.join()).toContain("余怒未消");
    expect(J.lastActionOutcome.rejected).toBe(true);
    expect(J.lastActionOutcome.kind).toBe("appease");
    expect(J.lastActionOutcome.target).toBe("老孙");
  });
  it("成功不置 rejected", () => {
    const { J } = mkJ(0.0);
    handleAppease(J, { kind: "appease", stance: "sincere" }, npc, 0, 0);
    expect(J.lastActionOutcome.rejected).toBeUndefined();
  });
});
