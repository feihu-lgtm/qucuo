import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindTurnAi, createWebAi } from "../engine/ports/ai.js";
import { turnMonitor } from "./turnMonitor.js";
import { buildExtractionCfg } from "../domain/rules/prompt/extractionEngine.js";
import { hasApiKey as tavernHasCredentials } from "../engine/ports/storyteller.js";
import { hasApiKey as battleHasCredentials } from "../engine/ports/storyteller.js";
import { API_TYPES, defaultConfig, importVertexCredential, loadConfig, saveConfig } from "./apiConfig.js";
import { buildDebugBundle } from "./debugBundle.js";
import { buildVertexEndpoint, createVertexAuth, parseVertexAdc, vertexDefaultProject } from "./vertexAdc.js";

const tokenUrl = "https://oauth2.googleapis.com/token";
const authorizedUser = {
  type: "authorized_user", client_id: "test-client-id", client_secret: "test-client-secret",
  refresh_token: "test-refresh-token", quota_project_id: "test-quota-project",
  universe_domain: "googleapis.com", account: "",
};
const tokenResponse = (index = 1) => Response.json({ access_token: "ya29.mock-token-" + index, expires_in: 3600 });

describe("Vertex ADC", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signs RS256 claims with WebCrypto and exchanges the assertion", async () => {
    const { subtle } = webcrypto;
    const { privateKey, publicKey } = await subtle.generateKey({
      name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
    }, true, ["sign", "verify"]);
    const pem = Buffer.from(await subtle.exportKey("pkcs8", privateKey)).toString("base64");
    const adc = parseVertexAdc(JSON.stringify({
      type: "service_account", project_id: "test-project", client_email: "fake@example.invalid",
      private_key: "-----BEGIN PRIVATE KEY-----\n" + pem + "\n-----END PRIVATE KEY-----",
      token_uri: "https://wrong.example.invalid",
    }));
    expect(vertexDefaultProject(adc)).toBe("test-project");
    const fetch = vi.fn(async () => tokenResponse());
    const getHeaders = createVertexAuth(adc, { fetch, crypto: webcrypto, now: () => 1700000000123 });
    expect(await getHeaders()).toEqual({ Authorization: "Bearer ya29.mock-token-1" });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(tokenUrl);
    expect(options.body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const [header, payload, signature] = options.body.get("assertion").split(".");
    const decode = value => JSON.parse(Buffer.from(value, "base64url").toString());
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(payload)).toEqual({
      iss: adc.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: tokenUrl,
      iat: 1700000000, exp: 1700003600,
    });
    expect(await subtle.verify("RSASSA-PKCS1-v1_5", publicKey, Buffer.from(signature, "base64url"), Buffer.from(header + "." + payload))).toBe(true);
  });

  it("refreshes five minutes early, shares concurrent exchanges, and passes the user quota project", async () => {
    let millis = 100;
    const fetch = vi.fn(async () => tokenResponse(fetch.mock.calls.length));
    const getHeaders = createVertexAuth(authorizedUser, { fetch, now: () => millis });
    expect(vertexDefaultProject(authorizedUser)).toBe("test-quota-project");
    const first = { Authorization: "Bearer ya29.mock-token-1", "x-goog-user-project": "test-quota-project" };
    expect(await Promise.all([getHeaders(), getHeaders()])).toEqual([first, first]);
    const [url, { body }] = fetch.mock.calls[0];
    expect(url).toBe(tokenUrl);
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "refresh_token", client_id: authorizedUser.client_id, client_secret: authorizedUser.client_secret,
      refresh_token: authorizedUser.refresh_token,
    });
    millis += 3300000 - 1;
    expect(await getHeaders()).toEqual(first);
    expect(fetch).toHaveBeenCalledOnce();
    millis++;
    expect(await getHeaders()).toEqual({ ...first, Authorization: "Bearer ya29.mock-token-2" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("builds global and regional URLs and rejects invalid locations", () => {
    expect(buildVertexEndpoint("project")).toBe("https://aiplatform.googleapis.com/v1/projects/project/locations/global/endpoints/openapi/chat/completions");
    expect(buildVertexEndpoint("project", "us-central1")).toBe("https://us-central1-aiplatform.googleapis.com/v1/projects/project/locations/us-central1/endpoints/openapi/chat/completions");
    expect(() => buildVertexEndpoint("project", "example.com/path")).toThrow(/位置/);
    expect(() => buildVertexEndpoint("", "global")).toThrow(/项目/);
  });

  it("reports only scrubbed OAuth error fields", async () => {
    const fetch = vi.fn(async () => Response.json({
      error: "invalid_grant",
      error_description: `Expired ${authorizedUser.refresh_token}, ${authorizedUser.client_secret}, ya29.sample-access`,
      message: "ignored-extra-field",
    }, { status: 400 }));
    const getHeaders = createVertexAuth(authorizedUser, { fetch, now: Date.now });
    await expect(getHeaders()).rejects.toThrow(/^Vertex AI 令牌交换失败（HTTP 400）：invalid_grant：Expired \[已拦截\], \[已拦截\], \[已拦截\]$/);
  });

  it.each([false, true])("surfaces scrubbed Vertex HTTP details (stream=%s)", async stream => {
    const message = "Publisher model not found; ya29.echoed-access; test-raw-access";
    const error = { code: 404, message, status: "ignored-extra-field" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(stream ? { error } : [{ error }], { status: 404 })));
    const ai = createWebAi({ getVertexHeaders: async () => ({ Authorization: "Bearer test-raw-access" }) });
    const cfg = { ...defaultConfig(), provider: "vertex", apiType: API_TYPES.VERTEX, vertexProject: "test-project" };
    await expect(ai.chat([], { cfg, systemPrompt: "叙述", stream }))
      .rejects.toThrow(/^Vertex AI HTTP 404：Publisher model not found; \[已拦截\]; \[已拦截\]$/);
  });

  it("limits Google error details and falls back to status for non-JSON", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: { message: "x".repeat(500) } }, { status: 404 }))
      .mockResolvedValueOnce(new Response("untrusted response", { status: 502 }));
    vi.stubGlobal("fetch", fetch);
    const ai = createWebAi({ getVertexHeaders: async () => ({ Authorization: "Bearer test-token" }) });
    const cfg = { ...defaultConfig(), provider: "vertex", apiType: API_TYPES.VERTEX, vertexProject: "test-project" };
    const opts = { cfg, systemPrompt: "叙述" };
    await expect(ai.chat([], opts)).rejects.toThrow(new Error("Vertex AI HTTP 404：" + "x".repeat(199) + "…"));
    await expect(ai.chat([], opts)).rejects.toThrow(/^Vertex AI HTTP 502$/);
  });

  it.each([
    [{}, "low"],
    [{ thinkingMode: "off" }, "low"],
    [{ thinkingMode: "custom", thinkingBudget: 0 }, "low"],
    [{ thinkingMode: "low" }, "low"],
    [{ thinkingMode: "medium" }, "medium"],
    [{ thinkingMode: "high" }, "high"],
    [{ thinkingMode: "custom", thinkingBudget: 512 }, "low"],
    [{ thinkingMode: "custom", thinkingBudget: 1024 }, "medium"],
    [{ thinkingMode: "custom", thinkingBudget: 4096 }, "high"],
    [{ vertexModel: "google/gemini-3-flash-preview" }, "minimal"],
    [{ vertexModel: "google/gemini-3.5-flash" }, "minimal"],
    [{ vertexModel: "google/gemini-3.6-flash" }, "minimal"],
    [{ vertexModel: "gemini-3.1-flash-lite", thinkingMode: "custom", thinkingBudget: 0 }, "minimal"],
    [{ vertexModel: "google/gemini-3.5-flash-lite" }, "minimal"],
    [{ vertexModel: "google/gemini-3.7-flash" }, "low"],
    [{ vertexModel: "google/gemini-3.8-flash" }, "low"],
    [{ vertexModel: "google/gemini-4-hydrogen" }, "low"],
    [{ vertexModel: "google/gemini-3.1-pro-preview" }, "low"],
    [{ vertexModel: "google/future-model" }, "low"],
  ])("maps thinking settings %j to Vertex %s", async (thinking, effort) => {
    const fetch = vi.fn(async () => Response.json({ choices: [{ message: { content: "曲措" } }] }));
    vi.stubGlobal("fetch", fetch);
    const ai = createWebAi({ getVertexHeaders: async () => ({ Authorization: "Bearer test-token" }) });
    const cfg = { apiType: API_TYPES.VERTEX, vertexProject: "test-project", ...thinking };
    await ai.chat([], { cfg, systemPrompt: "叙述" });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: thinking.vertexModel || "google/gemini-3.8-flash", reasoning_effort: effort });
    expect(body).not.toHaveProperty("enable_thinking");
  });

  it.each([
    [API_TYPES.VERTEX, ["续写正文："], "续写正文："],
    [API_TYPES.VERTEX, ["叙事格式", "续写正文："], "叙事格式\n续写正文："],
    [API_TYPES.VERTEX, [""], ""],
    [API_TYPES.VERTEX, [], ""],
    [API_TYPES.OPENAI, ["续写正文："], null],
  ])("handles the assistant tail for %s with tail %j", async (apiType, tail, continuation) => {
    const fetch = vi.fn(async () => Response.json({ choices: [{ message: { content: "曲措" } }] }));
    vi.stubGlobal("fetch", fetch);
    const ai = createWebAi({ getVertexHeaders: async () => ({ Authorization: "Bearer test-token" }) });
    const provider = apiType === API_TYPES.VERTEX ? "vertex" : "custom";
    const cfg = { ...defaultConfig(), provider, apiType, vertexProject: "test-project", apiKey: "test-key" };
    const history = [{ role: "assistant", content: "上一回合" }, { role: "user", content: "探索石阶" }];
    const messages = [...history, ...tail.map(content => ({ role: "assistant", content }))];
    const original = structuredClone(messages);
    await ai.chat(messages, { cfg, systemPrompt: "叙述" });
    const expected = continuation === null ? original : [...history];
    if (continuation) expected.push({ role: "user", content: "（请直接接着下面这段继续写，不要重复）\n" + continuation });
    expect(JSON.parse(fetch.mock.calls[0][1].body).messages).toEqual([{ role: "system", content: "叙述" }, ...expected]);
    expect(messages).toEqual(original);
  });

  it("reuses the monitored JSON and streaming paths without a proxy or credential-bearing config", async () => {
    const store = new Map();
    const getItem = vi.fn(key => store.get(key) ?? null);
    vi.stubGlobal("localStorage", { getItem, setItem: (key, value) => store.set(key, value) });
    const fetch = vi.fn(async (url, options) => {
      if (url === tokenUrl) return tokenResponse();
      if (JSON.parse(options.body).stream) {
        return new Response('data: {"choices":[{"delta":{"content":"江湖"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
      }
      return Response.json({ choices: [{ message: { content: "曲措" }, finish_reason: "stop" }] });
    });
    vi.stubGlobal("fetch", fetch);
    const vertexProject = await importVertexCredential(JSON.stringify(authorizedUser));
    const vertexModel = "google/gemini-4-hydrogen";
    saveConfig({ ...defaultConfig(), provider: "vertex", apiType: API_TYPES.VERTEX, vertexProject, vertexModel, model: "openai-model", corsProxy: "https://wrong.example/" });
    const cfg = loadConfig();
    expect(tavernHasCredentials()).toBe(true);
    expect(battleHasCredentials()).toBe(true);
    const messages = [{ role: "user", content: "看看" }];
    const turn = turnMonitor.start("vertex-test", { background: true });
    const ai = bindTurnAi(createWebAi(), turn);
    const opts = { cfg, systemPrompt: "叙述", modelOptions: { maxTokens: 1000 } };
    const onChunk = vi.fn();
    try {
      expect((await ai.chat(messages, opts)).text).toBe("曲措");
      const extractionCfg = buildExtractionCfg("LOOK", { ...cfg, thinkingMode: "high" });
      expect((await ai.chat(messages, { ...opts, cfg: extractionCfg, stream: true, onChunk })).text).toBe("江湖");
    } finally {
      turnMonitor.finish(turn);
    }
    expect(onChunk).toHaveBeenCalledWith("江湖", "江湖");
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const [url, request] of fetch.mock.calls.slice(1)) {
      expect(url).toBe(buildVertexEndpoint("test-quota-project", "global"));
      expect(request.headers).toEqual({
        "Content-Type": "application/json", Authorization: "Bearer ya29.mock-token-1", "x-goog-user-project": "test-quota-project",
      });
      expect(JSON.parse(request.body)).toMatchObject({
        model: vertexModel, max_tokens: 1000, messages: [{ role: "system", content: "叙述" }, ...messages], reasoning_effort: "low",
      });
    }
    expect(turn.nodes.filter(node => node.pipeline).map(node => node.pipeline.response)).toEqual(["曲措", "江湖"]);
    expect(turn.nodes.filter(node => node.pipeline).map(node => node.pipeline.model)).toEqual([vertexModel, vertexModel]);
    expect(buildExtractionCfg("LOOK", cfg)).toMatchObject({ vertexModel, model: "openai-model" });
    expect(buildExtractionCfg("LOOK", { ...cfg, extractionModel: "google/extraction-model" }))
      .toMatchObject({ vertexModel: "google/extraction-model", model: "openai-model" });
    const privateEntry = [...store.entries()].find(([, value]) => value.includes(authorizedUser.client_secret));
    expect(privateEntry?.[0]).toBe("wuxia_mud_vertex_adc");
    expect(JSON.stringify(cfg)).not.toContain(authorizedUser.refresh_token);
    expect(JSON.stringify(turn)).not.toContain("ya29.mock-token-1");
    getItem.mockClear();
    expect(buildDebugBundle().model).toBe(vertexModel);
    expect(getItem).not.toHaveBeenCalledWith(privateEntry[0]);
  });
});
