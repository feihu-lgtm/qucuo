import { describe, expect, it } from "vitest";
import {
  buildDebugBundle,
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
      nested: { safe: "[REDACTED] [REDACTED] [REDACTED] [REDACTED]" },
    });
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
