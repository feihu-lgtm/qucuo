import { describe, expect, it } from "vitest";
import { nemesisStatusLine } from "./nemesisLines.js";

// 从 domain/rules/nemesis 的两个测试随函数迁来（路线图 U4-2），断言原样保留。
describe("宿敌状态行", () => {
  it("nemesisStatusLine active 空串，fakeDead/settled 标注", () => {
    expect(nemesisStatusLine({ status: "active" })).toBe("");
    expect(nemesisStatusLine({ status: "fakeDead" })).toBe("（已故）"); // 玩家面板绝不泄「假死」
    expect(nemesisStatusLine({ status: "fakeDead" })).not.toContain("假死");
    expect(nemesisStatusLine({ status: "settled" })).toBe("（已了结）");
  });
  it("recruited 状态展示：面板「已收服」", () => {
    expect(nemesisStatusLine({ status: "recruited" })).toBe("（已收服）");
  });
});
