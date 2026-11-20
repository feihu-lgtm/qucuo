import { afterEach, describe, expect, it, vi } from "vitest";
import { API_TYPES, callModel, defaultConfig, listModels } from "./apiConfig.js";
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

  it("keeps provider as canonical and synchronizes the legacy API type", () => {
    expect(migrateProvider({ provider: "deepseek", apiType: "anthropic" })).toMatchObject({
      provider: "deepseek", apiType: "openai",
    });
    expect(isDefaultEndpoint(`${PROVIDERS.zhipu.altEndpoints[0].url}/`)).toBe(true);
    expect(isDefaultEndpoint("https://my-relay.example/v1")).toBe(false);
  });
});
