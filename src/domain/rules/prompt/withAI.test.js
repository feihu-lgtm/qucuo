import { beforeEach, describe, expect, it, vi } from "vitest";
import { definePrompt, resetPromptRegistryForTest } from "./registry.js";
import { createMockAi } from "../../../engine/ports/ai.js";
import { withAI } from "../../../engine/ports/withAI.js";

describe("withAI", () => {
  beforeEach(() => {
    resetPromptRegistryForTest();
    definePrompt("block", "t.sys", { slot: "sys", text: "系统：@role" });
    definePrompt("block", "t.user", { slot: "user", text: "来信：@body" });
    definePrompt("call", "t.call", {
      label: "测试调用",
      tokenLimitKey: "testLimit",
      defaultMaxTokens: 500,
      join: "",
      blocks: ["t.sys", "t.user"],
    });
  });

  it("passes systemPrompt, messages, maxTokens and callLabel to ai.chat", async () => {
    const onRequest = vi.fn();
    const ai = createMockAi([{ text: "回信正文", finishReason: "stop" }], { onRequest });
    const apiCfg = { model: "m1" };

    const res = await withAI("t.call", { role: "才旦", body: "安好？" }, { ai, apiCfg });

    expect(onRequest).toHaveBeenCalledWith(
      [{ role: "user", content: "来信：安好？" }],
      {
        cfg: apiCfg,
        systemPrompt: "系统：才旦",
        modelOptions: { maxTokens: 500, callLabel: "测试调用" },
      },
    );
    expect(res.ok).toBe(true);
    expect(res.text).toBe("回信正文");
    expect(res.data).toBe("回信正文");
    expect(res.finishReason).toBe("stop");
    expect(res.promptMeta.maxTokens).toBe(500);
  });

  it("prefers apiCfg.callTokenLimits[tokenLimitKey] over defaultMaxTokens", async () => {
    const onRequest = vi.fn();
    const ai = createMockAi(["ok"], { onRequest });

    await withAI(
      "t.call",
      { role: "才旦", body: "hi" },
      { ai, apiCfg: { callTokenLimits: { testLimit: 1800 } } },
    );

    expect(onRequest.mock.calls[0][1].modelOptions.maxTokens).toBe(1800);
  });

  it("falls back to call.offline when vet fails", async () => {
    definePrompt("call", "t.vetted", {
      label: "校验调用",
      defaultMaxTokens: 100,
      blocks: ["t.sys", "t.user"],
      vet: (text) => (text.startsWith("OK:") ? { ok: true, value: text.slice(3) } : { ok: false, reason: "bad_format" }),
      offline: (ctx, reason) => `兜底:${ctx.role}:${reason}`,
    });
    const ai = createMockAi(["不合格式"]);

    const res = await withAI("t.vetted", { role: "才旦", body: "hi" }, { ai, apiCfg: {} });

    expect(res.ok).toBe(false);
    expect(res.text).toBe("不合格式");
    expect(res.data).toBe("兜底:才旦:bad_format");
  });

  it("rethrows original error by default and returns error object when throwOnError is false", async () => {
    const boom = new Error("upstream failed");
    const failingAi = { chat: vi.fn(async () => { throw boom; }) };

    await expect(
      withAI("t.call", { role: "才旦", body: "hi" }, { ai: failingAi, apiCfg: {} }),
    ).rejects.toBe(boom);

    const res = await withAI(
      "t.call",
      { role: "才旦", body: "hi" },
      { ai: failingAi, apiCfg: {}, throwOnError: false },
    );
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(res.error).toBe(boom);
  });

  it("forces thinkingMode off and strips thinking tags for tier=flavor calls", async () => {
    definePrompt("call", "t.flavor", {
      label: "短润色",
      tier: "flavor",
      defaultMaxTokens: (ctx) => ctx.limit ?? 300,
      blocks: ["t.sys", "t.user"],
    });
    const onRequest = vi.fn();
    const ai = createMockAi(["<thinking>内省</thinking> 正文一行。"], { onRequest });

    const res = await withAI("t.flavor", { role: "才旦", body: "安好", limit: 220 }, {
      ai,
      apiCfg: { thinkingMode: "high" },
    });

    expect(onRequest.mock.calls[0][1].cfg.thinkingMode).toBe("off");
    expect(onRequest.mock.calls[0][1].modelOptions.maxTokens).toBe(220);
    expect(res.ok).toBe(true);
    expect(res.text).toBe("正文一行。");
  });

  it("discards response when isStale returns true and forwards stream/onChunk options", async () => {
    const onRequest = vi.fn();
    const onChunk = vi.fn();
    let stale = false;
    const ai = createMockAi(["迟到回复"], {
      onRequest: (...args) => {
        stale = true;
        onRequest(...args);
      },
    });

    const res = await withAI("t.call", { role: "才旦", body: "hi" }, {
      ai,
      apiCfg: {},
      stream: true,
      onChunk,
      isStale: () => stale,
    });

    expect(onRequest.mock.calls[0][1]).toMatchObject({ stream: true, onChunk });
    expect(res.ok).toBe(false);
    expect(res.text).toBe("");
    expect(res.data).toBeNull();
  });
});
