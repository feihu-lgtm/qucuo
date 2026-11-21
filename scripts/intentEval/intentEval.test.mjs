import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createAiClassifier } from "../../src/engine/intent/aiClassifier.js";
import { createRuleMockAi } from "./mockAi.mjs";
import { runEval, toMarkdown, percentile } from "./harness.mjs";
import { parseArgs } from "../intentEval.mjs";

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
});
