import { describe, expect, it, vi } from "vitest";
import { applyResult } from "./run.js";

describe("applyResult", () => {
  it("routes varTree changes through the context setter", () => {
    const setVarTree = vi.fn();
    const varTree = { 世界: { 已认识人物: ["师父"] } };

    applyResult({ setVarTree }, { changes: { varTree } });

    expect(setVarTree).toHaveBeenCalledWith(varTree);
  });

  it("passes varTree updaters through to merge against the latest state", () => {
    let varTree = { 世界: { 本日移动次数: 1 } };
    const ctx = {
      setVarTree: (update) => {
        varTree = typeof update === "function" ? update(varTree) : update;
      },
    };

    applyResult(ctx, {
      changes: {
        varTree: (prev) => ({
          ...prev,
          世界: { ...prev.世界, 已认识人物: ["师父"] },
        }),
      },
    });

    expect(varTree).toEqual({
      世界: { 本日移动次数: 1, 已认识人物: ["师父"] },
    });
  });

  it("forwards feature settlement options while keeping settlement enabled", () => {
    const act = vi.fn();

    applyResult({ act }, {
      settle: "拜师父为师",
      settleOptions: { settleNpc: "师父", settleKind: "learn_skill" },
    });

    expect(act).toHaveBeenCalledWith("拜师父为师", [], {
      settleNpc: "师父",
      settleKind: "learn_skill",
      settle: true,
      keepUndo: true,
    });
  });

  it("allows a feature result to suppress its settlement turn", () => {
    const act = vi.fn();

    applyResult({ act }, {
      settle: "委托失败",
      settleOptions: { settle: false },
    });

    expect(act).toHaveBeenCalledWith("委托失败", [], { settle: false, keepUndo: true });
  });

  it("forwards square operations to the optional context port", () => {
    const applySquareOps = vi.fn();
    const squareOps = [{ op: "consume", key: "雅江", day: 0 }];

    applyResult({ applySquareOps }, { squareOps });

    expect(applySquareOps).toHaveBeenCalledWith(squareOps);
  });
});
