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

  it("系统提示拼进首条 user 消息（与非流式 Gemini 一致）", async () => {
    const bodies = [];
    vi.stubGlobal("fetch", async (_url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return sseResponse([{ candidates: [{ content: { parts: [{ text: "好" }] } }] }]);
    });
    await callModelStream(geminiCfg, "你是系统", [{ role: "user", content: "问" }], () => {});
    expect(bodies[0].contents[0].role).toBe("user");
    expect(bodies[0].contents[0].parts[0].text).toBe("你是系统\n\n问");
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
