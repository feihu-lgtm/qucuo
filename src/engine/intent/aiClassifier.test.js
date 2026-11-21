import { describe, expect, it } from "vitest";
import { createAiClassifier, IntentTruncatedError, INTENT_TRUNCATED } from "./aiClassifier.js";
import { recognizeIntent } from "../../domain/intent/recognizer.js";

const state = { room: { name: "测试镇", npcs: [{ name: "才旦" }] }, inv: [], char: { money: 150 } };
const TRUNCATED_TEXT = '```json\n{"choice":"';

function fakeAi(reply) {
  const requests = [];
  return { requests, async chat(messages, opts) { requests.push(opts); return typeof reply === "function" ? reply(messages, opts) : reply; } };
}

describe("createAiClassifier", () => {
  it("asks for JSON with thinking off and an output budget of at least 1024 tokens", async () => {
    const ai = fakeAi({ text: '{"choice":"切磋","probs":{"切磋":0.9,"其他":0.1}}', finishReason: "stop" });
    await createAiClassifier(ai, { cfg: { thinkingMode: "high", model: "gemini-2.5-flash" } }).decide("kind", { text: "切磋" }, ["切磋", "其他"]);
    const [opts] = ai.requests;
    expect(opts.maxTokens).toBeGreaterThanOrEqual(1024);
    expect(opts.temperature).toBe(0);
    expect(opts.cfg.thinkingMode).toBe("off");
    expect(opts.modelOptions).toMatchObject({ jsonOnly: true, disableThinking: true, thinkingBudget: 0, maxTokens: 1024 });
  });

  for (const finishReason of ["length", "MAX_TOKENS", "max_tokens"]) {
    it(`throws IntentTruncatedError instead of falling back when finish_reason=${finishReason}`, async () => {
      const seen = [];
      const classifier = createAiClassifier(fakeAi({ text: TRUNCATED_TEXT, finishReason }), { onResponse: (entry) => seen.push(entry) });
      const error = await classifier.decide("kind", { text: "切磋" }, ["切磋", "其他"]).catch((e) => e);
      expect(error).toBeInstanceOf(IntentTruncatedError);
      expect(error).toMatchObject({ code: INTENT_TRUNCATED, question: "kind", text: TRUNCATED_TEXT, finishReason });
      expect(seen).toEqual([expect.objectContaining({ question: "kind", text: TRUNCATED_TEXT, finishReason })]);
    });
  }

  it("reads finish_reason from a raw OpenAI-style body and from split calls", async () => {
    const classifier = createAiClassifier(fakeAi({ text: '{"parts":["给才旦', raw: { choices: [{ finish_reason: "length" }] } }));
    await expect(classifier.split({ text: "给才旦100两，再切磋" })).rejects.toMatchObject({ code: INTENT_TRUNCATED, question: "split" });
  });

  it("propagates truncation out of recognizeIntent so callers can trace it", async () => {
    const classifier = createAiClassifier(fakeAi({ text: TRUNCATED_TEXT, finishReason: "length" }));
    await expect(recognizeIntent(state, "跟才旦切磋", { classifier })).rejects.toMatchObject({ code: INTENT_TRUNCATED });
  });

  it("still treats a complete but malformed reply as a parse failure, not truncation", async () => {
    const result = await createAiClassifier(fakeAi({ text: "我觉得是切磋", finishReason: "stop" })).decide("kind", { text: "切磋" }, ["切磋", "其他"]);
    expect(result).toMatchObject({ parseFailed: true, source: "stated" });
  });
});
