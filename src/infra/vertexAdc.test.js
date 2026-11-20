import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindTurnAi, createWebAi } from "../engine/ports/ai.js";
import { turnMonitor } from "../core/turnMonitor.js";
import { buildExtractionCfg } from "../domain/prompt/extractionEngine.js";
import { hasApiKey as tavernHasCredentials } from "../domain/tavernSim/simNarrator.js";
import { hasApiKey as battleHasCredentials } from "../domain/quickBattle/battleNarration.js";
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
    const vertexModel = "google/gemini-2.5-pro";
    saveConfig({ ...defaultConfig(), apiType: API_TYPES.VERTEX, vertexProject, vertexModel, model: "openai-model", corsProxy: "https://wrong.example/" });
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
      expect((await ai.chat(messages, { ...opts, stream: true, onChunk })).text).toBe("江湖");
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
        model: vertexModel, max_tokens: 1000, messages: [{ role: "system", content: "叙述" }, ...messages],
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
