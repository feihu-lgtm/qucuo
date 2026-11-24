import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  definePrompt, getPromptDef, getPromptOverrides, listPromptDefs,
  resetPromptOverrides, resetPromptRegistryForTest, setPromptOverride, subscribePromptOverrides,
} from "./registry.js";
import { buildPrompt, estimatePromptTokens } from "./buildPrompt.js";

describe("prompt registry & buildPrompt", () => {
  beforeEach(() => {
    resetPromptRegistryForTest();
  });

  it("overwrites definitions with the same id and validates kind", () => {
    definePrompt("block", "a", { slot: "sys", text: "旧文案" });
    definePrompt("block", "a", { slot: "sys", text: "新文案" });
    definePrompt("call", "c", { defaultMaxTokens: 200, blocks: ["a"] });

    expect(getPromptDef("block", "a").text).toBe("新文案");
    expect(listPromptDefs("block")).toHaveLength(1);
    expect(buildPrompt("c").system).toBe("新文案");
    expect(() => definePrompt("other", "x", {})).toThrow("Unknown prompt registry kind");
  });

  it("evaluates when gates and excludes unlit blocks", () => {
    definePrompt("block", "always", { slot: "sys", text: "常驻" });
    definePrompt("block", "cond", { slot: "sys", when: (ctx) => ctx.showCond, text: "条件块" });
    definePrompt("block", "custom", {
      slot: "sys",
      when: () => ({ lit: false, reason: "未解锁" }),
      text: "隐藏块",
    });
    definePrompt("call", "c", { join: "|", blocks: ["always", "cond", "custom"] });

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
    definePrompt("block", "s1", { slot: "sys", text: "人物：@who 缺失：@不存在A" });
    definePrompt("block", "u1", {
      slot: "user",
      text: (ctx, render) => render("线索：@cue/@不存在B/@不存在A", { cue: ctx.cue }),
    });
    definePrompt("call", "c", { blocks: ["s1", "u1"] });

    const built = buildPrompt("c", { who: "才旦", cue: "寻刀", trace });
    expect(built.system).toBe("人物：才旦 缺失：");
    expect(built.messages).toEqual([{ role: "user", content: "线索：寻刀//" }]);
    expect(built.missingRefs).toEqual(["不存在A", "不存在B"]);
    expect(trace).toHaveBeenCalledTimes(2);
    expect(trace).toHaveBeenNthCalledWith(1, ["不存在A"]);
    expect(trace).toHaveBeenNthCalledWith(2, ["不存在B", "不存在A"]);
  });

  it("applies overrides without mutating global registry", () => {
    definePrompt("block", "s1", { slot: "sys", text: "原文：@name" });
    definePrompt("call", "c", { blocks: ["s1"] });

    const overridden = buildPrompt("c", { name: "少侠" }, {
      overrides: { s1: { text: "覆盖：@name" } },
    });
    expect(overridden.system).toBe("覆盖：少侠");
    expect(buildPrompt("c", { name: "少侠" }).system).toBe("原文：少侠");
  });

  it("respects call.blocks order and join rule without trimming", () => {
    definePrompt("block", "b1", { slot: "sys", text: " 首段 " });
    definePrompt("block", "b2", { slot: "sys", text: "尾段\n" });
    definePrompt("block", "u1", { slot: "user", text: "问A" });
    definePrompt("block", "u2", { slot: "user", text: "问B" });
    definePrompt("call", "defaultJoin", { blocks: ["b2", "u1", "b1", "u2"] });
    definePrompt("call", "customJoin", { join: "\n", blocks: ["b1", "b2", "u1", "u2"] });

    const d = buildPrompt("defaultJoin");
    expect(d.system).toBe("尾段\n 首段 ");
    expect(d.messages).toEqual([{ role: "user", content: "问A问B" }]);

    const c = buildPrompt("customJoin");
    expect(c.system).toBe(" 首段 \n尾段\n");
    expect(c.messages).toEqual([{ role: "user", content: "问A\n问B" }]);
  });

  it("prepends call.history messages before user block without mutating source history", () => {
    definePrompt("block", "h.sys", { slot: "sys", text: "多轮系统" });
    definePrompt("block", "h.user", { slot: "user", text: (ctx) => ctx.say || "" });
    definePrompt("call", "multiTurn", {
      history: (ctx) => ctx.history,
      blocks: ["h.sys", "h.user"],
    });
    definePrompt("call", "historyOnly", {
      history: (ctx) => ctx.history,
      blocks: ["h.sys"],
    });

    const history = [
      { role: "assistant", content: "你要买管控的药？" },
      { role: "user", content: "我有急用。" },
    ];
    const withUser = buildPrompt("multiTurn", { history, say: "账本的事我也知道。" });
    expect(withUser.messages).toEqual([
      { role: "assistant", content: "你要买管控的药？" },
      { role: "user", content: "我有急用。" },
      { role: "user", content: "账本的事我也知道。" },
    ]);
    expect(history).toHaveLength(2);

    const noUser = buildPrompt("historyOnly", { history });
    expect(noUser.messages).toEqual(history);

    const emptyUser = buildPrompt("multiTurn", { history, say: "" });
    expect(emptyUser.messages).toEqual(history);

    const noHistory = buildPrompt("multiTurn", { say: "单轮开场" });
    expect(noHistory.messages).toEqual([{ role: "user", content: "单轮开场" }]);
  });

  it("supports 6-slot assembly, slots breakdown, and token estimation", () => {
    definePrompt("block", "s.sys", { slot: "sys", text: "世界设定" });
    definePrompt("block", "s.note", { slot: "authorsNote", text: "作者注" });
    definePrompt("block", "s.hist", { slot: "history", text: "旧回合" });
    definePrompt("block", "s.inchat", { slot: "inChat", text: "当前状态" });
    definePrompt("block", "s.user", { slot: "user", text: "玩家行动" });
    definePrompt("block", "s.prefill", { slot: "prefill", text: "{" });
    definePrompt("call", "sixSlot", {
      blocks: ["s.sys", "s.note", "s.hist", "s.inchat", "s.user", "s.prefill"],
    });

    const built = buildPrompt("sixSlot");
    expect(built.system).toBe("世界设定\n\n作者注");
    expect(built.messages).toEqual([
      { role: "user", content: "旧回合" },
      { role: "user", content: "当前状态" },
      { role: "user", content: "玩家行动" },
      { role: "assistant", content: "{" },
    ]);
    expect(built.slots).toEqual({
      sys: "世界设定",
      authorsNote: "作者注",
      history: "旧回合",
      inChat: "当前状态",
      user: "玩家行动",
      prefill: "{",
    });
    expect(built.tokenEstimate).toBeGreaterThan(0);
    expect(estimatePromptTokens([{ content: "中文" }], [{ content: "abcd" }])).toBe(4);
  });

  it("applies global control overrides (blue/green/off) and protects engine blocks", () => {
    definePrompt("block", "gated", { slot: "sys", when: (ctx) => ctx.hit, text: "绿灯正文" });
    definePrompt("block", "hard", { slot: "sys", editable: "engine", text: "引擎铁律" });
    definePrompt("call", "c", { join: "|", blocks: ["gated", "hard"] });

    setPromptOverride("gated", { mode: "blue", text: "强制常驻" });
    setPromptOverride("hard", { mode: "off" });
    expect(getPromptOverrides().gated).toEqual({ mode: "blue", text: "强制常驻" });

    const builtBlue = buildPrompt("c", { hit: false });
    expect(builtBlue.system).toBe("强制常驻|引擎铁律");
    expect(builtBlue.blocks.map((b) => [b.id, b.lit, b.reason])).toEqual([
      ["gated", true, "总控台蓝灯"],
      ["hard", true, "蓝灯常驻"],
    ]);

    setPromptOverride("gated", { mode: "off" });
    expect(buildPrompt("c", { hit: true }).system).toBe("引擎铁律");

    setPromptOverride("gated", { mode: "green", text: null });
    expect(buildPrompt("c", { hit: true }).system).toBe("绿灯正文|引擎铁律");
    expect(buildPrompt("c", { hit: false }).system).toBe("引擎铁律");

    resetPromptOverrides();
    expect(getPromptOverrides()).toEqual({});
  });

  it("ignores mode: off on the sole sys block of a call while allowing off when multiple sys blocks exist", () => {
    definePrompt("block", "sole.sys", { slot: "sys", text: "唯一系统规则" });
    definePrompt("block", "sole.user", { slot: "user", text: "用户输入" });
    definePrompt("call", "soleCall", { blocks: ["sole.sys", "sole.user"] });

    setPromptOverride("sole.sys", { mode: "off", text: "覆盖但不可灭" });
    const builtSole = buildPrompt("soleCall");
    expect(builtSole.system).toBe("覆盖但不可灭");
    expect(builtSole.blocks[0]).toMatchObject({ id: "sole.sys", lit: true, reason: "唯一系统块不可关闭" });

    definePrompt("block", "extra.sys", { slot: "sys", text: "第二个系统块" });
    definePrompt("call", "multiSysCall", { join: "|", blocks: ["sole.sys", "extra.sys"] });
    const builtMulti = buildPrompt("multiSysCall");
    expect(builtMulti.system).toBe("第二个系统块");
    expect(builtMulti.blocks[0]).toMatchObject({ id: "sole.sys", lit: false, reason: "总控台关闭" });
  });

  it("rebases on persisted localStorage overrides before writing and syncs storage events", () => {
    const store = new Map();
    const listeners = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    });
    vi.stubGlobal("window", {
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener: (type, fn) => {
        listeners.get(type)?.delete(fn);
      },
    });

    const notified = [];
    const unsub = subscribePromptOverrides(() => notified.push(getPromptOverrides()));
    try {
      setPromptOverride("blockA", { mode: "blue" });
      // 模拟另一个标签页在 localStorage 中写入了 blockB，同时保留 blockA
      const fromOtherTab = {
        version: 1,
        overrides: { blockA: { mode: "blue" }, blockB: { mode: "off", text: "另一页设置" } },
      };
      store.set("qucuo_prompt_overrides_v1", JSON.stringify(fromOtherTab));

      const afterLocalWrite = setPromptOverride("blockC", { mode: "off" });
      expect(afterLocalWrite).toEqual({
        blockA: { mode: "blue" },
        blockB: { mode: "off", text: "另一页设置" },
        blockC: { mode: "off" },
      });

      // 模拟跨标签页 storage 事件触发同步
      store.set("qucuo_prompt_overrides_v1", JSON.stringify({
        version: 1,
        overrides: { blockRemote: { text: "远程修改" } },
      }));
      for (const fn of listeners.get("storage") || []) {
        fn({ key: "qucuo_prompt_overrides_v1" });
      }
      expect(getPromptOverrides()).toEqual({ blockRemote: { text: "远程修改" } });
      expect(notified.at(-1)).toEqual({ blockRemote: { text: "远程修改" } });
    } finally {
      unsub();
      resetPromptOverrides();
      vi.unstubAllGlobals();
    }
  });
});
