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

  it("带礼赔罪成功签出 TRANSFER_ITEM 且失败/敷衍不扣物", () => {
    const { J, facts } = mkJ(0.0);
    J.inv = [{ id: "wine1", name: "烧刀子", category: "misc", quality: "白", weight: 1 }];
    handleAppease(J, { kind: "appease", stance: "sincere", itemId: "wine1", item: "烧刀子" }, npc, 0, 0);
    expect(facts.find((f) => f.op === "TRANSFER_ITEM")).toMatchObject({
      itemId: "wine1", itemName: "烧刀子", from: "player", to: "老孙",
    });

    const denied = mkJ(0.999);
    denied.J.inv = [{ id: "wine1", name: "烧刀子", category: "misc", quality: "白", weight: 1 }];
    handleAppease(denied.J, { kind: "appease", stance: "sincere", itemId: "wine1", item: "烧刀子" }, npc, 0, 0);
    expect(denied.facts).toHaveLength(0);
  });
});
