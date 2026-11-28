import { describe, it, expect, vi, beforeEach } from "vitest";
import { runKnowledgeTurn, evolveKnowledgeSync, backfillFactSummaries, _resetSummaryCircuitBreaker } from "./memoryLayer.js";
import { registerFact, buildInfoDomainBlock } from "../../domain/rules/prompt/knowledge.js";

describe("runKnowledgeTurn 信息域在场名单", () => {
  beforeEach(() => _resetSummaryCircuitBreaker());

  it("信息域只列喂给 AI 的在场者，不列据点里别的内层房间的人", async () => {
    let vt = registerFact({}, { id: "f1", 摘要: "井边丢了一只木桶", 知晓者: [{ name: "甲" }] }, 0);
    vt = registerFact(vt, { id: "f2", 摘要: "后山有人夜行", 知晓者: [{ name: "丙" }] }, 0);
    const { infoDomainBlock } = await runKnowledgeTurn({
      varTreeLatest: vt,
      roomNpcNames: ["甲", "乙", "丙"],
      infoDomainNpcNames: ["甲", "乙"],
      time: 1,
      apiCfg: null,
      flags: {},
      ai: {},
      rng: () => 0.99,
    });
    expect(infoDomainBlock).toContain("井边丢了一只木桶");
    expect(infoDomainBlock).not.toContain("丙");
    expect(infoDomainBlock).toContain("其余在场人物一律不知情");
    expect(infoDomainBlock).not.toMatch(/乙/);
  });

  it("没传 infoDomainNpcNames 时沿用据点名单", async () => {
    const vt = registerFact({}, { id: "f2", 摘要: "后山有人夜行", 知晓者: [{ name: "丙" }] }, 0);
    const { infoDomainBlock } = await runKnowledgeTurn({
      varTreeLatest: vt, roomNpcNames: ["丙"], time: 1, apiCfg: null, flags: {}, ai: {},
    });
    expect(infoDomainBlock).toContain("知情者 丙");
  });

  it("buildInfoDomainBlock 跳过未补摘要的事实，不注入待定占位词", () => {
    const vt = registerFact({}, { id: "f_empty", 摘要: "", 知晓者: [{ name: "甲" }] }, 0);
    expect(buildInfoDomainBlock(vt, ["甲"])).toBe("");
    const sync = evolveKnowledgeSync({
      varTreeLatest: vt, roomNpcNames: ["甲"], time: 1, rng: () => 0.99,
    });
    expect(sync.pendingFids).toEqual(["f_empty"]);
    expect(sync.infoDomainBlock).toBe("");
  });

  it("backfillFactSummaries 异步补全并受连续失败 5 次熔断保护", async () => {
    let tree = registerFact({}, { id: "f_async", 摘要: "", 知晓者: [{ name: "甲" }] }, 0);
    const failAi = { chat: vi.fn(async () => { throw new Error("down"); }) };
    for (let i = 0; i < 6; i++) {
      await backfillFactSummaries({
        pendingFids: ["f_async"],
        getVarTree: () => tree,
        setVarTree: (fn) => { tree = fn(tree); },
        apiCfg: {},
        flags: [],
        ai: failAi,
      });
    }
    // 第 6 次命中熔断，不再发第 6 次请求
    expect(failAi.chat).toHaveBeenCalledTimes(5);
    expect(tree.世界.知识领域.事实.f_async.摘要).toBe("");

    _resetSummaryCircuitBreaker();
    const okAi = { chat: vi.fn(async () => ({ text: "井边丢了只旧木桶" })) };
    await backfillFactSummaries({
      pendingFids: ["f_async"],
      getVarTree: () => tree,
      setVarTree: (fn) => { tree = fn(tree); },
      apiCfg: {},
      flags: [],
      ai: okAi,
    });
    expect(tree.世界.知识领域.事实.f_async.摘要).toBe("井边丢了只旧木桶");
  });
});
