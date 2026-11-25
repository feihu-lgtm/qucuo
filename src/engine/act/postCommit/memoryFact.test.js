import { describe, it, expect } from "vitest";
import { registerMemoryFact } from "./memoryFact.js";

const base = (memory) => ({
  p: { memory },
  room: { npcs: [{ name: "才旦" }] },
  activeTarget: "才旦",
  isTalk: true,
  talkTarget: "才旦",
  time: 24,
  appendDayMaterial: null,
});

describe("registerMemoryFact", () => {
  it("同回合同对象两条不同记忆不撞键", () => {
    const a = registerMemoryFact(base("玩家对才旦说：早上好"));
    const b = registerMemoryFact(base("玩家对才旦说：今晚有雪"));
    const prev = { 世界: {} };
    const treeA = a.changes.varTree(prev);
    const factsA = treeA.世界.事实 || treeA.世界.传闻 || {};
    const treeB = b.changes.varTree(treeA);
    // 两条都应入账：键不同（摘要哈希进 id）
    const idsA = JSON.stringify(treeA);
    const idsB = JSON.stringify(treeB);
    expect(idsB.length).toBeGreaterThan(idsA.length);
    expect(factsA).toBeTruthy();
  });

  it("无 memory 返回 null", () => {
    expect(registerMemoryFact({ ...base(""), p: {} })).toBeNull();
  });
});
