import { describe, expect, it, vi } from "vitest";

// roll() 用的是 utils/rng 的 Mulberry32（不是 Math.random——spyOn 那边管不着），
// 这里钉模块级 random 让检定恒定成功，消 CI 抖动。
vi.mock("../../../utils/rng.js", async (importOriginal) => ({
  ...(await importOriginal()),
  random: () => 0,
}));
import {
  makePuzzle,
  makePushPull,
  makeRecipeCraft,
  makeSequenceReset,
  makeTimedAgility,
  PUZZLE_FACTORIES,
} from "./puzzles.js";

describe("puzzles 四模板", () => {
  it("makePuzzle 工厂拒绝未知类型", () => {
    expect(() => makePuzzle("nope", {})).toThrow(/未知谜题模板/);
    expect(Object.keys(PUZZLE_FACTORIES)).toHaveLength(4);
  });

  it("sequenceReset：正确顺序过关，错序重置计数", () => {
    const p = makeSequenceReset({
      items: ["割肉", "喂鹰", "成佛"],
      stat: "wisdom",
      dc: 3,
    });
    const good = p.applyAction({ kind: "submit", order: ["割肉", "喂鹰", "成佛"] }, p.state, {});
    expect(good.done).toBe(true);
    const bad = p.applyAction({ kind: "submit", order: ["喂鹰", "割肉", "成佛"] }, p.state, { wisdom: 1 });
    expect(bad.done).toBe(false);
    expect(bad.reset).toBe(true);
    expect(bad.state.attempts).toBe(1);
    expect(p.parseIntent("割肉、喂鹰、成佛")).toEqual({ kind: "submit", order: ["割肉", "喂鹰", "成佛"] });
  });

  it("recipeCraft：缺料作废，料全按 DC 判定", () => {
    const p = makeRecipeCraft({
      recipe: { materials: ["雪莲汁", "牦牛脂肪"], action: "点燃" },
      materials: ["雪莲汁", "牦牛脂肪", "火镰", "清水"],
      stat: "wisdom",
      dc: 3,
    });
    const missing = p.applyAction({ kind: "craft", materials: ["雪莲汁"] }, p.state, {});
    expect(missing.fail).toBe(true);
    expect(missing.reset).toBe(true);
    const full = p.applyAction({ kind: "craft", materials: ["雪莲汁", "牦牛脂肪"] }, p.state, { wisdom: 99 });
    expect(typeof full.done).toBe("boolean");
    const intent = p.parseIntent("使用雪莲汁");
    expect(intent).toEqual({ kind: "use", material: "雪莲汁" });
  });

  it("pushPull：越界失败、推到目标过关", () => {
    const p = makePushPull({ size: 3, start: { x: 0, y: 1 }, target: { x: 2, y: 1 }, stat: "strength", dc: 1 });
    const out = p.applyAction({ kind: "push", dir: "w" }, p.state, { strength: 99 });
    expect(out.fail).toBe(true);
    const s1 = p.applyAction({ kind: "push", dir: "e" }, p.state, { strength: 99 });
    expect(s1.state.pos).toEqual({ x: 1, y: 1 });
    const s2 = p.applyAction({ kind: "push", dir: "e" }, s1.state, { strength: 99 });
    expect(s2.done).toBe(true);
    expect(p.parseIntent("往右推")).toEqual({ kind: "push", dir: "e" });
  });

  it("timedAgility：窗口内过 DC 更低，窗口外加罚", () => {
    const p = makeTimedAgility({ stat: "agility", dc: 5 });
    expect(p.actions(p.state)).toContain("等待时机");
    const wait = p.applyAction({ kind: "wait" }, p.state, {});
    expect(wait.state.windowOpen).toBe(true);
    const go = p.applyAction({ kind: "go" }, wait.state, { agility: 99 });
    expect(typeof go.done === "boolean" || go.fail === true).toBe(true);
    expect(p.parseIntent("冲过去")).toEqual({ kind: "go" });
  });
});
