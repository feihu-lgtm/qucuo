import { describe, expect, it, vi, afterEach } from "vitest";
import { callModelStream } from "./apiDiagnostics.js";
import { observeAi } from "./observeAi.js";
import { turnMonitor } from "./turnMonitor.js";

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
});
