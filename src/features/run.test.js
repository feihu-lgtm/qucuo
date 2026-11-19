import { describe, expect, it, vi } from "vitest";
import { applyResult } from "./run.js";

describe("applyResult", () => {
  it("routes varTree changes through the context setter", () => {
    const setVarTree = vi.fn();
    const varTree = { 世界: { 已认识人物: ["师父"] } };

    applyResult({ setVarTree }, { changes: { varTree } });

    expect(setVarTree).toHaveBeenCalledWith(varTree);
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
    });
  });
});
