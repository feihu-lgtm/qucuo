import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createAiClassifier } from "../../src/engine/intent/aiClassifier.js";
import { createRuleMockAi } from "./mockAi.mjs";
import { runEval, toMarkdown, percentile } from "./harness.mjs";
import { parseArgs } from "../intentEval.mjs";
import { withRetry, statusOf } from "./retry.mjs";
import { buildVertexEvalBody, vertexFallbacks } from "./vertexChat.mjs";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8"));

describe("intentEval", () => {
  it("has ≥60 labelled Chinese lines across every category", () => {
    expect(fixtures.lines.length).toBeGreaterThanOrEqual(60);
    const categories = new Set(fixtures.lines.map((line) => line.category));
    expect([...categories].sort()).toEqual(["ambiguous", "chitchat", "compound", "refusal", "single"]);
    expect(fixtures.lines.some((line) => line.text === "我不想切磋")).toBe(true);
  });

  it("runs end-to-end on the mock AI and reports the requested metrics", async () => {
    const report = await runEval({ fixtures, classifier: createAiClassifier(createRuleMockAi()) });
    expect(report.total).toBe(fixtures.lines.length);
    expect(report.errors).toBe(0);
    expect(report.thresholds.map((t) => t.threshold)).toEqual([0.7, 0.8, 0.9]);
    expect(report.compound.splitAccuracy).toBeGreaterThan(0.5);
    expect(report.overallAccuracy).toBeGreaterThan(0.6);
    expect(Object.keys(report.perKind)).toEqual(expect.arrayContaining(["赠送", "切磋", "移动"]));
    expect(report.latencyMs).toHaveProperty("p95");
    expect(toMarkdown(report)).toContain("阈值覆盖率");
  });

  it("parses real-provider flags without touching credentials", () => {
    const args = parseArgs(["--provider", "vertex", "--project", "p1", "--model", "gemini-2.5-flash", "--adc", "/tmp/adc.json"], {});
    expect(args).toMatchObject({ provider: "vertex", project: "p1", model: "gemini-2.5-flash", adc: "/tmp/adc.json", location: "global" });
    expect(parseArgs([], {}).provider).toBe("mock");
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
  });

  it("parses rate-limit flags", () => {
    const args = parseArgs(["--concurrency", "4", "--delay", "250", "--retries", "2", "--max-tokens", "200"], {});
    expect(args).toMatchObject({ concurrency: 4, delay: 250, retries: 2, maxTokens: 1024 });
    expect(parseArgs([], {})).toMatchObject({ concurrency: 1, delay: 0, retries: 4, maxTokens: 1024 });
  });

  it("records truncation as an explicit error and persists raw responses", async () => {
    const ai = { async chat() { return { text: '```json\n{"choice":"', finishReason: "length" }; } };
    const report = await runEval({ fixtures, limit: 3, createClassifier: (onResponse) => createAiClassifier(ai, { onResponse }) });
    expect(report.errors).toBe(3);
    expect(report.errorsByType).toEqual({ INTENT_TRUNCATED: 3 });
    expect(report.results[0]).toMatchObject({ errorType: "INTENT_TRUNCATED", correct: false });
    expect(report.results[0].raw[0]).toMatchObject({ text: '```json\n{"choice":"', finishReason: "length" });
    expect(toMarkdown(report)).toContain("INTENT_TRUNCATED 3");
  });

  it("keeps fixture order under concurrency and paces request starts with --delay", async () => {
    const sleeps = [];
    let clock = 0;
    const report = await runEval({
      fixtures, limit: 6, concurrency: 3, delayMs: 100, classifier: createAiClassifier(createRuleMockAi()),
      now: () => clock, sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    });
    expect(report.results.map((r) => r.id)).toEqual(fixtures.lines.slice(0, 6).map((l) => l.id));
    expect(sleeps.length).toBeGreaterThan(0);
  });

  it("retries 429 with backoff and gives up on other errors", async () => {
    const waits = [];
    let calls = 0;
    const flaky = { async chat() { calls++; if (calls < 3) throw Object.assign(new Error("Vertex AI HTTP 429"), calls === 2 ? { retryAfterMs: 5000 } : {}); return { text: "ok" }; } };
    const ai = withRetry(flaky, { baseDelayMs: 100, jitter: () => 0, sleep: async (ms) => waits.push(ms) });
    expect(await ai.chat([], {})).toEqual({ text: "ok" });
    expect(waits).toEqual([100, 5000]);
    const broken = withRetry({ async chat() { throw new Error("Vertex AI HTTP 403"); } }, { sleep: async () => {} });
    await expect(broken.chat([], {})).rejects.toThrow("403");
    expect(statusOf({ status: 503 })).toBe(503);
  });

  it("builds the Vertex body with thinking off, JSON mode and ≥1024 tokens, with 400 fallbacks", () => {
    const body = buildVertexEvalBody("google/gemini-2.5-flash", [{ role: "user", content: "hi" }], { systemPrompt: "sys", modelOptions: { maxTokens: 200 } });
    expect(body).toMatchObject({ max_tokens: 1024, temperature: 0, response_format: { type: "json_object" } });
    expect(body.extra_body.google.thinking_config.thinking_budget).toBe(0);
    expect(body).not.toHaveProperty("reasoning_effort");
    const chain = vertexFallbacks(body);
    expect(chain[0]).toMatchObject({ logprobs: true });
    expect(chain.at(-2)).not.toHaveProperty("response_format");
    expect(chain.at(-2).extra_body).toEqual(body.extra_body);
    expect(chain.at(-1)).not.toHaveProperty("extra_body");
    expect(chain.at(-1).reasoning_effort).toBeTruthy();
    expect(chain.at(-1).reasoning_effort).not.toBe("none");
  });
});
