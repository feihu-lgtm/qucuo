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
});
