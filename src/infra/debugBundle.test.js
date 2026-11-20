import { describe, expect, it, vi } from "vitest";
import {
  buildDebugBundle,
  downloadDebugBundle,
  getDebugBundleDownloadSize,
  getDebugBundleSize,
  MAX_DEBUG_BUNDLE_BYTES,
  redact,
} from "./debugBundle.js";

describe("debug bundle redaction", () => {
  it("drops sensitive nested keys and scrubs secrets from string values", () => {
    const apiConfig = {
      apiKey: "configured-key-123",
      endpoint: "https://private.example/v1/chat",
      model: "test-model",
    };
    const result = redact({
      nested: {
        password: "do-not-keep",
        safe: "sk-abcdefghijklmnop Bearer hidden-token configured-key-123 https://private.example/v1/chat",
      },
    }, apiConfig);

    expect(result).toEqual({
      nested: { safe: "[已拦截] [已拦截] [REDACTED] [REDACTED]" },
    });
  });

  it("scrubs secrets in nested property names and suffixes redaction collisions", () => {
    const apiKey = "cfg-value-123456";
    const endpoint = "https://private.example/v1/chat";
    const result = redact({
      nested: {
        [apiKey]: "configured",
        "sk-abcdefghijklmnop": "key pattern",
        "Bearer private-value": "entry value",
        [endpoint]: "endpoint",
        "[REDACTED]": "existing redacted key",
      },
    }, { apiKey, endpoint });

    expect(result.nested).toEqual({
      "[REDACTED]": "configured",
      "[已拦截]": "key pattern",
      "[已拦截]#2": "entry value",
      "[REDACTED]#2": "endpoint",
      "[REDACTED]#3": "existing redacted key",
    });
    const serialized = JSON.stringify(result);
    for (const secret of [apiKey, endpoint, "sk-abcdefghijklmnop", "Bearer private-value"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("does not globally scrub short configured values or a bare URL scheme", () => {
    const result = redact({
      endpoint: "/api",
      note: "Use /api over https:// for the request.",
      shortKey: "12345678",
    }, {
      endpoint: "/api",
      baseUrl: "https://",
      apiKey: "12345678",
    });

    expect(result).toEqual({
      endpoint: "/api",
      note: "Use /api over https:// for the request.",
      shortKey: "[REDACTED]",
    });
  });

  it("builds a schema-1 bundle with capped sources and safe fallbacks for throwing sources", () => {
    const bundle = buildDebugBundle({
      version: "test-version",
      createdAt: "2026-08-02T00:00:00.000Z",
      apiConfig: { apiKey: "configured-key", endpoint: "https://provider.example/v1", model: "model-x" },
      save: () => { throw new Error("save unavailable"); },
      recentLog: () => { throw new Error("log unavailable"); },
      conversation: Array.from({ length: 45 }, (_, index) => ({ role: "user", content: `message ${index}` })),
      traces: Array.from({ length: 35 }, (_, index) => ({ raw: `trace ${index}` })),
      pipelineCalls: Array.from({ length: 25 }, (_, index) => ({ seq: index })),
      errors: () => { throw new Error("error buffer unavailable"); },
    });

    expect(bundle).toMatchObject({
      schema: 1,
      version: "test-version",
      providerHost: "provider.example",
      model: "model-x",
      save: null,
      recentLog: [],
    });
    expect(bundle.conversation).toHaveLength(40);
    expect(bundle.traces).toHaveLength(30);
    expect(bundle.pipelineCalls).toHaveLength(20);
    expect(bundle.errors.map(error => error.info?.source)).toEqual(expect.arrayContaining(["errors", "save", "recentLog"]));
    expect(JSON.stringify(bundle)).not.toContain("configured-key");
    expect(JSON.stringify(bundle)).not.toContain("apiKey");
  });

  it("strips save history while retaining other save data", () => {
    const bundle = buildDebugBundle({
      save: { mapData: { room: "inner" }, log: ["saved log"], convo: [{ content: "saved conversation" }] },
      apiConfig: { model: "test", endpoint: "https://provider.example" },
      traces: [],
      pipelineCalls: [],
      errors: [],
    });

    expect(bundle.save).toEqual({ mapData: { room: "inner" } });
    expect(bundle.recentLog).toEqual(["saved log"]);
    expect(bundle.conversation).toEqual([{ content: "saved conversation" }]);
    expect(bundle.truncated.saveHistoryStripped).toBe(true);
    expect(bundle.truncated.save).toBeUndefined();
  });

  it("omits an oversized save after trimming and remains within the size cap", () => {
    const bundle = buildDebugBundle({
      save: {
        log: ["l".repeat(512 * 1024)],
        convo: [{ content: "c".repeat(512 * 1024) }],
        mapData: "m".repeat(2 * 1024 * 1024),
      },
      apiConfig: { model: "test", endpoint: "https://provider.example" },
      traces: [],
      pipelineCalls: [],
      errors: [],
    });

    expect(getDebugBundleSize(bundle)).toBeLessThanOrEqual(MAX_DEBUG_BUNDLE_BYTES);
    expect(bundle.save.log).toBeUndefined();
    expect(bundle.save).toEqual({ omitted: true, bytes: expect.any(Number) });
    expect(bundle.save.bytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(bundle.truncated).toMatchObject({
      saveHistoryStripped: true,
      save: true,
    });
    expect(bundle.truncated.overLimit).toBeUndefined();
  });

  it("exports a bundle with planted ADC credentials removed from saves, logs and prompts", async () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nsecret-key-material\n-----END RSA PRIVATE KEY-----";
    const adc = { type: "service_account", private_key: pem };
    const userAdc = { refresh_token: "1//planted-refresh", client_secret: "planted-client-secret" };
    const accessToken = "ya29.planted-access-token";
    const bundle = buildDebugBundle({
      save: { adc, userAdc, log: [{ text: "sk-planted-api-key" }] },
      traces: [],
      pipelineCalls: [{
        systemPrompt: JSON.stringify(adc),
        userMessages: [{ content: JSON.stringify(JSON.stringify(userAdc)) }],
        response: "Authorization: Bearer planted-bearer-token",
      }],
      errors: [{ message: accessToken }],
    });
    expect(bundle.redactions).toBeGreaterThanOrEqual(9);
    const standaloneRefreshToken = "1//0mock-google-refresh-token_123";
    bundle.errors.push({ message: "Bearer late-token-value" }, { message: `OAuth error: ${standaloneRefreshToken}` });
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const anchor = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });
    try {
      downloadDebugBundle(bundle);
      expect(anchor.click).toHaveBeenCalledOnce();
      const exported = await createUrl.mock.calls[0][0].text();
      for (const secret of [accessToken, "late-token-value", "planted-bearer-token", "sk-planted-api-key",
        "secret-key-material", "PRIVATE KEY-----", "private_key", "refresh_token", "client_secret", standaloneRefreshToken, ...Object.values(userAdc)]) {
        expect(exported).not.toContain(secret);
      }
      expect(exported).toContain("[已拦截]");
      expect(JSON.parse(exported).errors.at(-1).message).toBe("OAuth error: [已拦截]");
      expect(JSON.parse(exported).redactions).toBe(bundle.redactions + 2);
    } finally {
      createUrl.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("measures the pretty-printed JSON used by the download", () => {
    const bundle = { version: "test", nested: { text: "你好，江湖" } };
    const downloadedJson = JSON.stringify(bundle, null, 2);

    expect(getDebugBundleDownloadSize(bundle)).toBe(new TextEncoder().encode(downloadedJson).length);
    expect(getDebugBundleDownloadSize(bundle)).toBeGreaterThan(getDebugBundleSize(bundle));
  });

  it("drops oldest traces, then pipeline calls, then log entries to meet the byte cap", () => {
    const bundle = buildDebugBundle({
      save: null,
      apiConfig: { model: "test", endpoint: "https://provider.example" },
      recentLog: Array.from({ length: 200 }, (_, index) => `log-${index}-${"l".repeat(8000)}`),
      traces: Array.from({ length: 30 }, (_, index) => ({ raw: `trace-${index}-${"t".repeat(30000)}` })),
      pipelineCalls: Array.from({ length: 20 }, (_, index) => ({ response: `pipeline-${index}-${"p".repeat(30000)}` })),
      conversation: [],
      errors: [],
    });

    expect(getDebugBundleSize(bundle)).toBeLessThanOrEqual(MAX_DEBUG_BUNDLE_BYTES);
    expect(bundle.truncated.traces).toBe(30);
    expect(bundle.truncated.pipelineCalls).toBe(20);
    expect(bundle.truncated.logEntries).toBeGreaterThan(0);
    expect(bundle.traces).toHaveLength(0);
    expect(bundle.pipelineCalls).toHaveLength(0);
    expect(bundle.recentLog[0]).not.toContain("log-0-");
  });

  it("keeps newest-first traces and pipeline calls when size trimming removes old entries", () => {
    const traces = buildDebugBundle({
      save: null,
      apiConfig: { model: "test", endpoint: "https://provider.example" },
      recentLog: [],
      conversation: [],
      traces: Array.from({ length: 30 }, (_, index) => ({
        id: index === 0 ? "trace-newest" : index === 29 ? "trace-oldest" : `trace-${index}`,
        raw: "t".repeat(80_000),
      })),
      pipelineCalls: [],
      errors: [],
    });
    const pipelineCalls = buildDebugBundle({
      save: null,
      apiConfig: { model: "test", endpoint: "https://provider.example" },
      recentLog: [],
      conversation: [],
      traces: [],
      pipelineCalls: Array.from({ length: 20 }, (_, index) => ({
        id: index === 0 ? "pipeline-newest" : index === 19 ? "pipeline-oldest" : `pipeline-${index}`,
        response: "p".repeat(80_000),
      })),
      errors: [],
    });

    expect(traces.truncated.traces).toBeGreaterThan(0);
    expect(traces.traces[0].id).toBe("trace-newest");
    expect(traces.traces.some(trace => trace.id === "trace-oldest")).toBe(false);
    expect(pipelineCalls.truncated.pipelineCalls).toBeGreaterThan(0);
    expect(pipelineCalls.pipelineCalls[0].id).toBe("pipeline-newest");
    expect(pipelineCalls.pipelineCalls.some(call => call.id === "pipeline-oldest")).toBe(false);
  });
});
