import { afterEach, describe, expect, it, vi } from "vitest";
import { API_TYPES, callModel, callModelStream, defaultConfig, listModels, testConnection } from "./apiConfig.js";
import { classifyError } from "../utils/apiErrors.js";
import { buildVertexEndpoint, vertexReasoningEffort } from "./vertexAdc.js";
import {
  isDefaultEndpoint, migrateProvider, providerApiType, PROVIDERS,
} from "./providers.js";

const responseBody = protocol => {
  if (protocol === "anthropic") return { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" };
  if (protocol === "gemini") return { candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] };
  return { choices: [{ message: { content: "ok" }, finish_reason: "stop" }] };
};

function mockFetch(provider) {
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    requests.push({ url: String(url), options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify(responseBody(provider.protocol)), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }));
  return requests;
}

function configFor(provider) {
  return {
    ...defaultConfig(),
    provider: provider.id,
    apiType: providerApiType(provider.id),
    endpoint: provider.endpoint,
    apiKey: "test-api-key",
    model: provider.models[0] || (provider.id === "custom" ? "o3-mini" : "test-model"),
    vertexModel: "google/gemini-3.7-flash",
    vertexProject: "test-project",
    vertexLocation: "global",
    maxTokens: 90000,
    qwenMaxTokens: 60000,
  };
}

function requestOptions(provider) {
  return provider.protocol === "vertex"
    ? { getVertexHeaders: async () => ({ Authorization: "Bearer vertex-access-token" }) }
    : {};
}

function expectedUrl(provider, cfg) {
  if (provider.protocol === "vertex") return buildVertexEndpoint(cfg.vertexProject, cfg.vertexLocation);
  if (provider.protocol === "gemini") {
    return `${provider.endpoint}/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  }
  return provider.endpoint;
}

function expectedTokens(provider) {
  if (provider.id === "qwen") return 60000;
  if (provider.id === "vertex") return 65535;
  return 90000;
}

function expectThinking(provider, off, high, model) {
  if (provider.thinking === "openai-effort") {
    if (provider.id === "openrouter") {
      expect(off.reasoning).toEqual({ exclude: true });
      expect(high.reasoning).toEqual({ exclude: false, effort: "high" });
    } else if (["openai", "custom"].includes(provider.id)) {
      expect(off).not.toHaveProperty("reasoning_effort");
      if (/^(?:o1|o3(?:-[\w.-]+)?|o4-mini(?:-[\w.-]+)?|gpt-5(?:[.-][\w.-]+)?|gpt-6-astra(?:-[\w.-]+)?)$/i.test(model)) {
        expect(high.reasoning_effort).toBe(model === "gpt-5.3-chat-latest" ? "medium" : "high");
      } else {
        expect(high).not.toHaveProperty("reasoning_effort");
      }
    } else {
      expect(off).not.toHaveProperty("reasoning_effort");
      expect(high.reasoning_effort).toBe("high");
    }
  } else if (provider.thinking === "qwen-enable") {
    expect(off.enable_thinking).toBe(false);
    expect(high.enable_thinking).toBe(true);
  } else if (provider.thinking === "deepseek") {
    expect(off.thinking).toEqual({ type: "disabled" });
    expect(high.thinking).toEqual({ type: "enabled" });
    expect(off).not.toHaveProperty("reasoning_effort");
    expect(high.reasoning_effort).toBe("high");
  } else if (["zhipu", "moonshot"].includes(provider.thinking)) {
    expect(off.thinking).toEqual({ type: "disabled" });
    expect(high.thinking).toEqual({ type: "enabled" });
  } else if (provider.thinking === "anthropic") {
    expect(off).not.toHaveProperty("thinking");
    expect(high.thinking).toEqual({ type: "enabled", budget_tokens: 8192 });
    expect(high).not.toHaveProperty("temperature");
  } else if (provider.thinking === "gemini") {
    expect(off.generationConfig).not.toHaveProperty("thinkingConfig");
    expect(high.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "high" });
  } else if (provider.thinking === "vertex") {
    expect(off.reasoning_effort).toBe(vertexReasoningEffort(model, "off"));
    expect(high.reasoning_effort).toBe(vertexReasoningEffort(model, "high"));
    expect(off).not.toHaveProperty("enable_thinking");
    expect(high).not.toHaveProperty("enable_thinking");
  } else {
    for (const body of [off, high]) {
      expect(body).not.toHaveProperty("reasoning_effort");
      expect(body).not.toHaveProperty("enable_thinking");
      expect(body).not.toHaveProperty("thinking");
    }
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("provider request catalog", () => {
  it.each(Object.values(PROVIDERS))("$id sends the configured endpoint, auth, token field, and thinking mapping", async provider => {
    const cfg = configFor(provider);
    const requests = mockFetch(provider);
    const options = requestOptions(provider);

    await callModel({ ...cfg, thinkingMode: "off" }, "system", [{ role: "user", content: "hello" }], options);
    await callModel({ ...cfg, thinkingMode: "high" }, "system", [{ role: "user", content: "hello" }], options);

    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe(expectedUrl(provider, cfg));
    expect(requests[1].url).toBe(expectedUrl(provider, cfg));
    const headers = requests[0].options.headers;
    if (provider.auth === "bearer") expect(headers.Authorization).toBe("Bearer test-api-key");
    if (provider.auth === "x-api-key") {
      expect(headers["x-api-key"]).toBe("test-api-key");
      expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
    }
    if (provider.auth === "query-key") expect(new URL(requests[0].url).searchParams.get("key")).toBe("test-api-key");
    if (provider.auth === "adc") expect(headers.Authorization).toBe("Bearer vertex-access-token");
    for (const [name, value] of Object.entries(provider.extraHeaders)) expect(headers[name]).toBe(value);

    const tokenPath = provider.protocol === "gemini" ? "generationConfig" : null;
    for (const request of requests) {
      const body = tokenPath ? request.body[tokenPath] : request.body;
      const field = provider.protocol === "gemini" ? "maxOutputTokens" : provider.maxTokensField;
      expect(body[field]).toBe(expectedTokens(provider));
    }
    expectThinking(provider, requests[0].body, requests[1].body, requests[0].body.model);
  });

  it("retains Qwen's override while respecting its hard cap", async () => {
    const provider = PROVIDERS.qwen;
    const requests = mockFetch(provider);
    await callModel({
      ...configFor(provider), qwenMaxTokens: 90000, maxTokens: 90000, thinkingMode: "off",
    }, "system", [{ role: "user", content: "hello" }]);
    expect(requests[0].body.max_tokens).toBe(65536);
  });

  it("honors MiniMax's SillyTavern M2-her output cap without reducing other models", async () => {
    const provider = PROVIDERS.minimax;
    const requests = mockFetch(provider);
    await callModel({
      ...configFor(provider), model: "M2-her", maxTokens: 90000, thinkingMode: "off",
    }, "system", [{ role: "user", content: "hello" }]);
    expect(requests[0].body.max_tokens).toBe(2048);
  });

  it("does not send OpenAI reasoning parameters to unsupported models", async () => {
    const requests = mockFetch(PROVIDERS.openai);
    await callModel({
      ...configFor(PROVIDERS.openai), model: "gpt-4.1", thinkingMode: "high",
    }, "system", [{ role: "user", content: "hello" }]);
    expect(requests[0].body).not.toHaveProperty("reasoning_effort");
  });

  it("explicitly disables thinking on Gemini 2.5 when off or the custom budget is zero", async () => {
    const requests = mockFetch(PROVIDERS.gemini);
    const cfg = { ...configFor(PROVIDERS.gemini), model: "gemini-2.5-flash" };
    await callModel({ ...cfg, thinkingMode: "off" }, "system", [{ role: "user", content: "hello" }]);
    await callModel({ ...cfg, thinkingMode: "custom", thinkingBudget: 0 }, "system", [{ role: "user", content: "hello" }]);
    expect(requests.map(request => request.body.generationConfig.thinkingConfig)).toEqual([
      { thinkingBudget: 0 }, { thinkingBudget: 0 },
    ]);
  });

  it("follows SillyTavern's custom KoboldCpp reasoning-effort exception", async () => {
    const requests = mockFetch(PROVIDERS.custom);
    await callModel({
      ...configFor(PROVIDERS.custom), model: "koboldcpp/test-model", thinkingMode: "high",
    }, "system", [{ role: "user", content: "hello" }]);
    expect(requests[0].body.reasoning_effort).toBe("high");
  });

  it("lists OpenAI-compatible models from the selected alternate endpoint", async () => {
    const requests = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      requests.push({ url: String(url), headers: options.headers });
      return new Response(JSON.stringify({ data: [{ id: "qwen-plus" }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }));
    const cfg = {
      ...defaultConfig(), provider: "qwen", apiType: API_TYPES.QWEN,
      endpoint: PROVIDERS.qwen.altEndpoints[0].url, apiKey: "qwen-key",
    };
    await expect(listModels(cfg)).resolves.toEqual(["qwen-plus"]);
    expect(requests[0].url).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models");
    expect(requests[0].headers.Authorization).toBe("Bearer qwen-key");
  });
});

describe("provider migration", () => {
  it("matches defaults and alternate endpoints after trimming trailing slashes", () => {
    expect(migrateProvider({ endpoint: `${PROVIDERS.qwen.endpoint}///` }).provider).toBe("qwen");
    expect(migrateProvider({ endpoint: `${PROVIDERS.moonshot.altEndpoints[0].url}/` }).provider).toBe("moonshot");
  });

  it("recognizes the legacy DeepSeek endpoint", () => {
    expect(migrateProvider({ apiType: "openai", endpoint: "https://api.deepseek.com/v1/chat/completions" }).provider)
      .toBe("deepseek");
  });

  it("prioritizes a native legacy API type over a different endpoint", () => {
    expect(migrateProvider({
      apiType: "vertex", endpoint: PROVIDERS.anthropic.endpoint, vertexProject: "legacy-project",
    })).toMatchObject({ provider: "vertex", apiType: "vertex", vertexProject: "legacy-project" });
  });

  it.each([
    ["anthropic", "anthropic"],
    ["gemini", "gemini"],
    ["vertex", "vertex"],
    ["qwen", "qwen"],
  ])("falls back to the legacy %s API type", (apiType, provider) => {
    expect(migrateProvider({ apiType, endpoint: "https://custom.example/endpoint" }).provider).toBe(provider);
  });

  it("maps the official OpenAI endpoint and preserves unmatched custom URLs", () => {
    expect(migrateProvider({ apiType: "openai", endpoint: PROVIDERS.openai.endpoint }).provider).toBe("openai");
    expect(migrateProvider({ apiType: "openai", endpoint: "https://relay.example/v1/chat/completions" }))
      .toMatchObject({ provider: "custom", apiType: "openai", endpoint: "https://relay.example/v1/chat/completions" });
  });

  it("resolves a provider and API type conflict from the configured protocol", () => {
    expect(migrateProvider({
      provider: "anthropic", apiType: "vertex", endpoint: PROVIDERS.anthropic.endpoint,
    })).toMatchObject({ provider: "vertex", apiType: "vertex" });
    expect(migrateProvider({ provider: "deepseek", apiType: "anthropic" }))
      .toMatchObject({ provider: "anthropic", apiType: "anthropic" });
    expect(isDefaultEndpoint(`${PROVIDERS.zhipu.altEndpoints[0].url}/`)).toBe(true);
    expect(isDefaultEndpoint("https://my-relay.example/v1")).toBe(false);
  });
});

describe("connection test error summaries", () => {
  const deepseekConfig = { ...configFor(PROVIDERS.deepseek), apiKey: "test-api-key" };
  const jsonResponse = (status, message) => new Response(JSON.stringify({ error: { message } }), {
    status, headers: { "Content-Type": "application/json" },
  });
  const classifyFailure = async (cfg = deepseekConfig) => {
    try {
      await testConnection(cfg);
      throw new Error("Expected the connection test to fail");
    } catch (error) {
      return classifyError(error, { connection: true, apiKey: cfg.apiKey }).connection;
    }
  };

  it.each([
    [400, `参数被拒：${"x".repeat(80)}`, "400"],
    [401, "Key 无效或没权限", "401"],
    [403, "Key 无效或没权限", "403"],
    [429, "限流或余额不足", "429"],
    [500, "厂商服务出错，稍后再试", "500"],
  ])("summarizes HTTP %i without exposing credentials", async (status, cause, code) => {
    const vendorMessage = status === 400 ? `${"x".repeat(85)}${deepseekConfig.apiKey}` : "vendor error";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, vendorMessage)));
    const summary = await classifyFailure();
    expect(summary).toMatchObject({ code, cause });
    expect(JSON.stringify(summary)).not.toContain(deepseekConfig.apiKey);
  });

  it("redacts Gemini's query key from a 404 request URL", async () => {
    const cfg = { ...configFor(PROVIDERS.gemini), apiKey: "gemini-secret-key", model: "gemini-2.5-flash" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    })));
    const summary = await classifyFailure(cfg);
    expect(summary).toMatchObject({ code: "404", cause: "地址或模型名不对" });
    expect(summary.fix).toContain("key=[REDACTED]");
    expect(JSON.stringify(summary)).not.toContain(cfg.apiKey);
  });

  it("classifies timeout and network fetch failures", async () => {
    const timeout = new Error("aborted");
    timeout.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn(async () => { throw timeout; }));
    expect(await classifyFailure()).toMatchObject({
      code: "超时", cause: "60秒没响应", fix: "检查网络或延长超时设置",
    });

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await classifyFailure()).toMatchObject({
      code: "网络", cause: "网络或浏览器被拦", fix: "可能需要 CORS 代理",
    });
  });

  it("classifies an HTML response as a web page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>login</html>", {
      status: 200, headers: { "Content-Type": "text/html" },
    })));
    expect(await classifyFailure()).toMatchObject({
      code: "HTML", cause: "地址填成了网页", fix: "检查接口地址",
    });
  });
});

describe("callModel HTTP 错误分类", () => {
  afterEach(() => vi.unstubAllGlobals());
  const cfg = { ...configFor(PROVIDERS.custom), endpoint: "https://relay.example/v1/chat/completions", streamEnabled: false };
  const failure = async (run) => {
    try { await run(); } catch (error) { return { error, ec: classifyError(error) }; }
    throw new Error("Expected the call to fail");
  };

  it("空响应体的 404 提示检查地址和模型名，不说是格式异常", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const { error, ec } = await failure(() => callModel(cfg, "sys", [{ role: "user", content: "hi" }]));
    expect(error.httpStatus).toBe(404);
    expect(error.message).not.toContain("Unexpected end of JSON input");
    expect(ec).toMatchObject({ kind: "endpoint", retryable: false });
  });

  it("流式调用的 404 也带上 HTTP 码", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const { ec } = await failure(() => callModelStream(cfg, "sys", [{ role: "user", content: "hi" }], () => {}));
    expect(ec).toMatchObject({ kind: "endpoint", retryable: false });
  });

  it("429 读出 Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"message":"Rate limit reached"}}', { status: 429, headers: { "Retry-After": "7" } })));
    const { error, ec } = await failure(() => callModel(cfg, "sys", [{ role: "user", content: "hi" }]));
    expect(error.retryAfterMs).toBe(7000);
    expect(ec).toMatchObject({ kind: "rateLimit", retryable: true });
  });

  it("200 空响应体归为空响应", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
    const { ec } = await failure(() => callModel(cfg, "sys", [{ role: "user", content: "hi" }]));
    expect(ec).toMatchObject({ kind: "empty", retryable: true });
  });

  it("流式传输中途断开归为网络错误", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"半"}}]}\n'));
        controller.error(new TypeError("network error"));
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    const { ec } = await failure(() => callModelStream(cfg, "sys", [{ role: "user", content: "hi" }], () => {}));
    expect(ec).toMatchObject({ kind: "network", retryable: true });
  });
});
