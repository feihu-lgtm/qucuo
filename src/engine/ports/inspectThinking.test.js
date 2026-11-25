import { describe, expect, it } from "vitest";
import { withAI } from "./withAI.js";
import "./storyteller.js";
import { definePrompt } from "../../domain/rules/prompt/registry.js";

function createMockChatAi(replyText) {
  const calls = [];
  return {
    calls,
    ai: {
      isConfigured: () => true,
      async chat(messages, opts) {
        calls.push({ messages, opts });
        return { text: replyText, finishReason: "stop" };
      },
      async chatStream() {
        throw new Error("unexpected stream");
      },
    },
  };
}

describe("端详与短调用防截断回归", () => {
  it("tier=flavor 默认传 disableThinking=true 与 thinkingBudget=0 并剥除多种思考标签", async () => {
    const id = "test.flavor.regression";
    definePrompt("call", id, {
      label: "测试端详润色",
      tier: "flavor",
      system: "你是说书人。",
      user: "描写此人。",
      defaultMaxTokens: 2000,
    });
    const { ai, calls } = createMockChatAi(
      "<think>隐藏推理</think><thinking>内部推敲</thinking>眉目疏朗，青衫微旧。<think>未闭合尾标签"
    );
    const res = await withAI(id, {}, { ai, apiCfg: { thinkingMode: "high", maxTokens: 4000 } });
    expect(calls[0].opts.cfg.thinkingMode).toBe("off");
    expect(calls[0].opts.modelOptions.disableThinking).toBe(true);
    expect(calls[0].opts.modelOptions.thinkingBudget).toBe(0);
    expect(calls[0].opts.modelOptions.maxTokens).toBe(2000);
    expect(res.text).toBe("眉目疏朗，青衫微旧。");
  });

  it("modelOptions.disableThinking=true 同样剥除残留 <think> 标签", async () => {
    const id = "test.inspect.regression";
    definePrompt("call", id, {
      label: "查看端详测试",
      resolveCfg: (apiCfg) => apiCfg,
      system: "系统",
      user: "用户",
    });
    const { ai } = createMockChatAi("<think>思考片段\n</think>古剑三尺，锷有微霜。");
    const res = await withAI(id, {}, {
      ai,
      apiCfg: { thinkingMode: "off" },
      modelOptions: { disableThinking: true, thinkingBudget: 0 },
    });
    expect(res.text).toBe("古剑三尺，锷有微霜。");
  });

  it("storyteller.flavor 默认 maxTokens 提升至 2000 防止思考后一字断截", async () => {
    const { ai, calls } = createMockChatAi("完整端详描写。");
    const res = await withAI(
      "storyteller.flavor",
      { sys: "sys", user: "usr", callLabel: "端详描写" },
      { ai, apiCfg: { maxTokens: 4000, thinkingMode: "high" } },
    );
    expect(calls[0].opts.modelOptions.maxTokens).toBe(2000);
    expect(calls[0].opts.modelOptions.disableThinking).toBe(true);
    expect(calls[0].opts.cfg.thinkingMode).toBe("off");
    expect(res.text).toBe("完整端详描写。");
  });
});
