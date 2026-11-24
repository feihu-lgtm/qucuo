import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPromptRegistryForTest } from "../../../domain/rules/prompt/registry.js";
import { createMockAi } from "../ai.js";
import { callCardModel, callWithRetry } from "./scanCalls.js";

describe("cardScan scanCalls via withAI", () => {
  beforeEach(() => {
    resetPromptRegistryForTest();
  });

  it("routes callCardModel through withAI and forwards temperature/jsonOnly", async () => {
    const onRequest = vi.fn();
    const ai = createMockAi([{ text: '{"ok":true}', finishReason: "stop" }], { onRequest });
    const apiCfg = { model: "m-card" };

    const res = await callCardModel(
      apiCfg,
      "系统提示",
      "用户内容",
      { maxTokens: 1200, temperature: 0.4, jsonOnly: true, callLabel: "测试扫卡" },
      ai,
    );

    expect(res).toEqual({ text: '{"ok":true}', finishReason: "stop" });
    expect(onRequest).toHaveBeenCalledWith(
      [{ role: "user", content: "用户内容" }],
      {
        cfg: apiCfg,
        systemPrompt: "系统提示",
        modelOptions: {
          temperature: 0.4,
          jsonOnly: true,
          maxTokens: 1200,
          callLabel: "测试扫卡",
        },
      },
    );
  });

  it("adapts an injected callModel callback in callWithRetry", async () => {
    const callModel = vi.fn(async () => ({ text: '{"条目":[]}', finishReason: "stop" }));
    const out = await callWithRetry(
      callModel,
      { model: "m" },
      { stage: 1, system: "S", user: "U" },
      {},
      { signal: { aborted: false } },
    );

    expect(out).toEqual({ 条目: [] });
    expect(callModel).toHaveBeenCalledOnce();
  });
});
