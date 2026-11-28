import { describe, expect, it, vi, afterEach } from "vitest";
import { callModelStream } from "./apiDiagnostics.js";
import { observeAi } from "./observeAi.js";
import { turnMonitor } from "./turnMonitor.js";
import { pipelineTabs, formatUsageTab } from "./actionTrace.js";

function sseResponse(events) {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return {
    ok: true,
    headers: { get: () => "text/event-stream" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
  };
}

const geminiCfg = {
  provider: "gemini",
  apiType: "gemini",
  apiKey: "test-key",
  model: "gemini-2.5-flash",
};

afterEach(() => vi.unstubAllGlobals());

describe("callModelStream Gemini 原生 SSE", () => {
  it("请求 streamGenerateContent?alt=sse 并逐段回调增量文本，末帧读 usageMetadata", async () => {
    const urls = [];
    vi.stubGlobal("fetch", async (url) => {
      urls.push(String(url));
      return sseResponse([
        { candidates: [{ content: { parts: [{ text: "雪山" }] } }] },
        { candidates: [{ content: { parts: [{ text: "派" }] } }] },
        {
          candidates: [{ content: { parts: [{ text: "到了。" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 9, cachedContentTokenCount: 80 },
        },
      ]);
    });
    const chunks = [];
    const result = await callModelStream(geminiCfg, "系统", [{ role: "user", content: "你好" }],
      (delta, full) => chunks.push([delta, full]));

    expect(urls[0]).toContain("gemini-2.5-flash:streamGenerateContent");
    expect(urls[0]).toContain("alt=sse");
    expect(urls[0]).toContain("key=test-key");
    expect(chunks).toEqual([["雪山", "雪山"], ["派", "雪山派"], ["到了。", "雪山派到了。"]]);
    expect(result.text).toBe("雪山派到了。");
    expect(result.finishReason).toBe("STOP");
    expect(result.usage?.cachedContentTokenCount).toBe(80);
  });

  it("系统提示通过原生 systemInstruction 下发（与非流式 Gemini 一致）", async () => {
    const bodies = [];
    vi.stubGlobal("fetch", async (_url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return sseResponse([{ candidates: [{ content: { parts: [{ text: "好" }] } }] }]);
    });
    await callModelStream(geminiCfg, "你是系统", [{ role: "user", content: "问" }], () => {});
    expect(bodies[0].systemInstruction).toEqual({ parts: [{ text: "你是系统" }] });
    expect(bodies[0].contents[0].role).toBe("user");
    expect(bodies[0].contents[0].parts[0].text).toBe("问");
  });
});

describe("Anthropic 提示词缓存与流式参数对齐", () => {
  const anthropicCfg = {
    provider: "anthropic",
    apiType: "anthropic",
    apiKey: "ant-key",
    model: "claude-sonnet-4-5",
  };

  it("system 末块与冻结 [前情提要] 带 ephemeral cache_control，且 opus-4-8 流式不传采样参数", async () => {
    const bodies = [];
    vi.stubGlobal("fetch", async (_url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return sseResponse([{ type: "content_block_delta", delta: { text: "行" } }]);
    });
    const sys = [
      { role: "system", tavernBlock: "main", content: "引擎身份" },
      { role: "system", tavernBlock: "worldInfoAfter", content: "规则底座" },
    ];
    const msgs = [
      { role: "user", content: "[前情提要]\n旧事一条\n\n[近期前情]\n近事\n\n[最近对话]\n[玩家] 问" },
      { role: "user", content: "[状态] ..." },
      { role: "assistant", content: "{" },
    ];
    await callModelStream({ ...anthropicCfg, model: "claude-opus-4-8", topP: 0.9, topK: 40 }, sys, msgs, () => {});
    const b = bodies[0];
    expect(b.system).toHaveLength(2);
    expect(b.system[0].cache_control).toBeUndefined();
    expect(b.system[1].cache_control).toEqual({ type: "ephemeral" });
    expect(b.messages[0].content).toEqual([
      { type: "text", text: "[前情提要]\n旧事一条", cache_control: { type: "ephemeral" } },
      { type: "text", text: "\n\n[近期前情]\n近事\n\n[最近对话]\n[玩家] 问" },
    ]);
    expect(b.temperature).toBeUndefined();
    expect(b.top_p).toBeUndefined();
    expect(b.top_k).toBeUndefined();
  });
});

describe("observeAi 缓存命中归一化", () => {
  it.each([
    [{ prompt_tokens_details: { cached_tokens: 11 } }, 11],
    [{ cache_read_input_tokens: 22 }, 22],
    [{ cachedContentTokenCount: 33 }, 33],
    [undefined, 0],
  ])("usage=%o → cachedTokens=%i", async (usage, want) => {
    await observeAi([], { cfg: { apiType: "gemini" }, systemPrompt: "s" },
      async () => ({ text: "t", finishReason: "stop", usage }));
    const tree = turnMonitor.getTrees()[0];
    const node = tree.nodes.find((n) => n.kind === "ai");
    expect(node.pipeline.cachedTokens).toBe(want);
  });

  it("cachedTokens 出现在 TraceViewer 渲染用的 pipelineTabs 文本里", async () => {
    await observeAi([], { cfg: { apiType: "gemini" }, systemPrompt: "s" },
      async () => ({ text: "t", finishReason: "stop",
        usage: { promptTokenCount: 200, candidatesTokenCount: 9, cachedContentTokenCount: 80 } }));
    const tree = turnMonitor.getTrees()[0];
    const node = tree.nodes.find((n) => n.kind === "ai");
    const tabs = pipelineTabs(node.pipeline);
    expect(tabs["用量"]).toContain("前缀缓存命中 tokens: 80");
    expect(tabs["用量"]).toContain("缓存命中率: 40%");
    expect(tabs["用量"]).toContain("输入 tokens: 200");
  });
});

describe("formatUsageTab", () => {
  it("OpenAI/Anthropic/Gemini 三家字段名都能取到输入输出", () => {
    expect(formatUsageTab({ usage: { prompt_tokens: 10, completion_tokens: 3 }, cachedTokens: 0 }))
      .toContain("输入 tokens: 10");
    expect(formatUsageTab({ usage: { input_tokens: 20, output_tokens: 4 } }))
      .toContain("输出 tokens: 4");
    expect(formatUsageTab({ usage: { promptTokenCount: 30, candidatesTokenCount: 5 } }))
      .toContain("输入 tokens: 30");
  });

  it("无 usage 且无 cachedTokens 时不显示用量页", () => {
    expect(formatUsageTab({})).toBeUndefined();
    expect(pipelineTabs({ systemPrompt: "s", userMessages: [], response: "x" })["用量"]).toBeUndefined();
  });
});

describe("readSSE idle 超时", () => {
  const streamFrom = (chunks) => new ReadableStream({
    async start(controller) {
      for (const [text, delay] of chunks) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        controller.enqueue(new TextEncoder().encode(text));
      }
      controller.close();
    },
  });
  const sseRes = (chunks) => ({ ok: true, headers: { get: () => "text/event-stream" }, body: streamFrom(chunks) });

  it("首个 chunk 迟迟不到（headers 后 body 卡住）→ idle 超时", async () => {
    const { readSSE } = await import("./apiSse.js");
    await expect(readSSE(sseRes([["data: {}\n\n", 120]]), () => {}, { idleTimeoutMs: 40 }))
      .rejects.toMatchObject({ code: "timeout" });
  });

  it("中途断流（chunk 间隔超 idle）→ idle 超时", async () => {
    const { readSSE } = await import("./apiSse.js");
    const events = [];
    await expect(readSSE(sseRes([['data: {"a":1}\n\n', 0], ['data: {"b":2}\n\n', 120]]),
      (e) => events.push(e), { idleTimeoutMs: 40 })).rejects.toMatchObject({ code: "timeout" });
    expect(events).toEqual([{ a: 1 }]); // 已到达的事件照常解析
  });

  it("持续有字不误杀：间隔小于 idle 的长正文完整读完", async () => {
    const { readSSE } = await import("./apiSse.js");
    const events = [];
    await readSSE(sseRes([
      ['data: {"a":1}\n\n', 0], ['data: {"b":2}\n\n', 20], ['data: {"c":3}\n\n', 20],
    ]), (e) => events.push(e), { idleTimeoutMs: 60 });
    expect(events).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });
});

describe("W-FIX3 首包看门狗随用户超时缩放（协调裁决方案 c）", () => {
  it("默认 60s 超时 → 18000ms 下限", async () => {
    const { firstByteWatchdogMs } = await import("./apiDiagnostics.js");
    // getRequestTimeout 出厂 60000：max(18000, 20000)=20000 → min(60000, 20000)=20000
    expect(firstByteWatchdogMs()).toBe(Math.min(60000, Math.max(18000, Math.floor(60000 / 3))));
  });
  it("缩放式数学口径：短超时按比例缩、长超时 18s 起步不超用户上限", () => {
    const scale = (t) => Math.min(t, Math.max(18000, Math.floor(t / 3)));
    expect(scale(60000)).toBe(20000); // 默认档：1/3 比例超 18s 下限
    expect(scale(30000)).toBe(18000); // 短超时：18s 下限兜底但仍 ≤ 用户上限
    expect(scale(120000)).toBe(40000); // 长超时：慢思考模型首 token 合法晚到不误杀
    expect(scale(15000)).toBe(15000); // 超短超时永不超用户上限
  });
});
