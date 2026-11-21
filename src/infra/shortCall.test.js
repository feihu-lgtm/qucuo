import { describe, expect, it } from "vitest";
import { applyShortCallOpenAI, applyThinkingOpenAI } from "./providers.js";
import * as vertex from "./vertexAdc.js";

const VERTEX = { id: "vertex", thinking: "vertex" };

describe("applyShortCallOpenAI", () => {
  it("replaces reasoning_effort with thinking_budget 0 for Gemini 2.5 Flash on Vertex", () => {
    const body = { model: "google/gemini-2.5-flash" };
    applyThinkingOpenAI(body, { thinkingMode: "off" }, VERTEX, vertex, { disableThinking: true, jsonOnly: true });
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body.extra_body).toEqual({ google: { thinking_config: { thinking_budget: 0, include_thoughts: false } } });
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("uses the minimum budget for 2.5 Pro and keeps the catalog effort for other models", () => {
    const pro = { model: "google/gemini-2.5-pro" };
    applyShortCallOpenAI(pro, VERTEX, { disableThinking: true });
    expect(pro.extra_body.google.thinking_config.thinking_budget).toBe(128);
    const g3 = { model: "google/gemini-3-flash-preview" };
    applyThinkingOpenAI(g3, { thinkingMode: "off" }, VERTEX, vertex, { disableThinking: true });
    expect(g3).toEqual({ model: "google/gemini-3-flash-preview", reasoning_effort: "minimal" });
  });

  it("leaves normal calls and unsupported JSON-mode providers untouched", () => {
    const body = { model: "google/gemini-2.5-flash" };
    applyThinkingOpenAI(body, { thinkingMode: "off" }, VERTEX, vertex);
    expect(body.reasoning_effort).toBe(vertex.vertexReasoningEffort("gemini-2.5-flash", "off"));
    const qwen = { model: "qwen-plus" };
    applyShortCallOpenAI(qwen, { id: "qwen", thinking: "qwen-enable" }, { disableThinking: true, jsonOnly: true });
    expect(qwen).toEqual({ model: "qwen-plus" });
  });
});
