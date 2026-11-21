import { beforeEach, describe, expect, it, vi } from "vitest";
import { define, getDef, listDefs, resetRegistryForTest } from "./registry.js";
import { buildPrompt } from "./buildPrompt.js";

describe("prompt registry & buildPrompt", () => {
  beforeEach(() => {
    resetRegistryForTest();
  });

  it("overwrites definitions with the same id and validates kind", () => {
    define("block", "a", { slot: "sys", text: "旧文案" });
    define("block", "a", { slot: "sys", text: "新文案" });
    define("call", "c", { defaultMaxTokens: 200, blocks: ["a"] });

    expect(getDef("block", "a").text).toBe("新文案");
    expect(listDefs("block")).toHaveLength(1);
    expect(buildPrompt("c").system).toBe("新文案");
    expect(() => define("other", "x", {})).toThrow("Unknown prompt registry kind");
  });

  it("evaluates when gates and excludes unlit blocks", () => {
    define("block", "always", { slot: "sys", text: "常驻" });
    define("block", "cond", { slot: "sys", when: (ctx) => ctx.showCond, text: "条件块" });
    define("block", "custom", {
      slot: "sys",
      when: () => ({ lit: false, reason: "未解锁" }),
      text: "隐藏块",
    });
    define("call", "c", { join: "|", blocks: ["always", "cond", "custom"] });

    const off = buildPrompt("c", { showCond: false });
    expect(off.system).toBe("常驻");
    expect(off.blocks.map((b) => [b.id, b.lit, b.reason])).toEqual([
      ["always", true, "蓝灯常驻"],
      ["cond", false, "条件未命中"],
      ["custom", false, "未解锁"],
    ]);

    const on = buildPrompt("c", { showCond: true });
    expect(on.system).toBe("常驻|条件块");
  });

  it("supports function text with render and collects missingRefs + forwards trace", () => {
    const trace = vi.fn();
    define("block", "s1", { slot: "sys", text: "人物：@who 缺失：@不存在A" });
    define("block", "u1", {
      slot: "user",
      text: (ctx, render) => render("线索：@cue/@不存在B/@不存在A", { cue: ctx.cue }),
    });
    define("call", "c", { blocks: ["s1", "u1"] });

    const built = buildPrompt("c", { who: "才旦", cue: "寻刀", trace });
    expect(built.system).toBe("人物：才旦 缺失：");
    expect(built.messages).toEqual([{ role: "user", content: "线索：寻刀//" }]);
    expect(built.missingRefs).toEqual(["不存在A", "不存在B"]);
    expect(trace).toHaveBeenCalledTimes(2);
    expect(trace).toHaveBeenNthCalledWith(1, ["不存在A"]);
    expect(trace).toHaveBeenNthCalledWith(2, ["不存在B", "不存在A"]);
  });

  it("applies overrides without mutating global registry", () => {
    define("block", "s1", { slot: "sys", text: "原文：@name" });
    define("call", "c", { blocks: ["s1"] });

    const overridden = buildPrompt("c", { name: "少侠" }, {
      overrides: { s1: { text: "覆盖：@name" } },
    });
    expect(overridden.system).toBe("覆盖：少侠");
    expect(buildPrompt("c", { name: "少侠" }).system).toBe("原文：少侠");
  });

  it("respects call.blocks order and join rule without trimming", () => {
    define("block", "b1", { slot: "sys", text: " 首段 " });
    define("block", "b2", { slot: "sys", text: "尾段\n" });
    define("block", "u1", { slot: "user", text: "问A" });
    define("block", "u2", { slot: "user", text: "问B" });
    define("call", "defaultJoin", { blocks: ["b2", "u1", "b1", "u2"] });
    define("call", "customJoin", { join: "\n", blocks: ["b1", "b2", "u1", "u2"] });

    const d = buildPrompt("defaultJoin");
    expect(d.system).toBe("尾段\n 首段 ");
    expect(d.messages).toEqual([{ role: "user", content: "问A问B" }]);

    const c = buildPrompt("customJoin");
    expect(c.system).toBe(" 首段 \n尾段\n");
    expect(c.messages).toEqual([{ role: "user", content: "问A\n问B" }]);
  });
});
