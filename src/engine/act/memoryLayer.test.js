import { describe, it, expect } from "vitest";
import { runKnowledgeTurn } from "./memoryLayer.js";
import { registerFact } from "../../domain/rules/prompt/knowledge.js";

describe("runKnowledgeTurn 信息域在场名单", () => {
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
});
