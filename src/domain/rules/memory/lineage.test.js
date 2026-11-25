import { describe, it, expect } from "vitest";
import { ensureProseLineage, forkLineage, headBranch, branchVisible, newBranchId } from "./lineage.js";

describe("lineage 纯函数", () => {
  it("缺谱系补建根分支（幂等：已有不动）", () => {
    const a = ensureProseLineage({});
    expect(a.created).toBe(true);
    expect(a.proseLineage[0].upTo).toBeNull();
    const b = ensureProseLineage({ proseLineage: a.proseLineage, proseSeq: 4 });
    expect(b.created).toBe(false);
    expect(b.proseSeq).toBe(4);
  });
  it("分叉：原头截断+新头+seq归零", () => {
    const lin = [{ b: "b1", upTo: null }];
    const out = forkLineage(lin, 5);
    expect(out.proseLineage[0]).toEqual({ b: "b1", upTo: 5 });
    expect(out.proseLineage[1].upTo).toBeNull();
    expect(out.proseSeq).toBe(0);
  });
  it("branchVisible：头分支按 currentTurn、非头按 upTo、无 branchId 不可见", () => {
    const lin = [{ b: "b1", upTo: 5 }, { b: "b2", upTo: null }];
    expect(branchVisible({ branchId: "b1", turn: 4 }, lin, 10)).toBe(true);
    expect(branchVisible({ branchId: "b1", turn: 6 }, lin, 10)).toBe(false); // 旧未来
    expect(branchVisible({ branchId: "b2", turn: 6 }, lin, 10)).toBe(true);
    expect(branchVisible({ branchId: "b2", turn: 11 }, lin, 10)).toBe(false); // 未来剧透
    expect(branchVisible({ turn: 1 }, lin, 10)).toBe(false); // 无 branchId
    expect(branchVisible({ branchId: "bX", turn: 1 }, lin, 10)).toBe(false); // 别的时间线
  });
  it("branchId 全局唯一格式", () => {
    expect(newBranchId()).not.toBe(newBranchId());
  });
  it("headBranch 找 upTo===null", () => {
    expect(headBranch([{ b: "a", upTo: 3 }, { b: "b", upTo: null }]).b).toBe("b");
  });
});
