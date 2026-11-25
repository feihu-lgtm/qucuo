import { describe, expect, it } from "vitest";
import { createAiClassifier, IntentTruncatedError, INTENT_TRUNCATED } from "./aiClassifier.js";
import { recognizeIntent } from "../../domain/rules/intent/recognizer.js";

const state = { room: { name: "测试镇", npcs: [{ name: "才旦" }] }, inv: [], char: { money: 150 } };
const TRUNCATED_TEXT = '```json\n{"actions":[{"text":"';
const VARS = { text: "跟才旦切磋", hints: "", kinds: ["切磋", "其他"], targets: ["才旦"], directions: ["北"], giftItems: [], useItems: [], pickupItems: [], equipItems: [] };

function fakeAi(reply) {
  const requests = [];
  return { requests, async chat(messages, opts) { requests.push({ messages, ...opts }); return typeof reply === "function" ? reply(messages, opts) : reply; } };
}

const GOOD = '{"actions":[{"text":"跟才旦切磋","kind":"切磋","target":"才旦","item":"无","direction":"无","condition":"无","confidence":0.97}]}';

describe("createAiClassifier", () => {
  it("asks for JSON with thinking off and an output budget of at least 1024 tokens", async () => {
    const ai = fakeAi({ text: GOOD, finishReason: "stop" });
    await createAiClassifier(ai, { cfg: { thinkingMode: "high", model: "gemini-2.5-flash" } }).recognize(VARS);
    const [opts] = ai.requests;
    expect(opts.maxTokens).toBeGreaterThanOrEqual(1024);
    expect(opts.temperature).toBe(0);
    expect(opts.cfg.thinkingMode).toBe("off");
    expect(opts.modelOptions).toMatchObject({ jsonOnly: true, disableThinking: true, thinkingBudget: 0, maxTokens: 1024 });
    expect(opts.modelOptions).not.toHaveProperty("logprobs");
  });

  it("sends exactly one request per recognition, with all candidate lists in the prompt", async () => {
    const ai = fakeAi({ text: GOOD, finishReason: "stop" });
    const result = await recognizeIntent(state, "跟才旦切磋", { classifier: createAiClassifier(ai) });
    expect(ai.requests).toHaveLength(1);
    expect(JSON.stringify(ai.requests[0].messages)).toContain("在场人物：「才旦」");
    expect(result.actions[0]).toMatchObject({ kind: "切磋", target: "才旦", confidence: 0.97 });
  });

  for (const finishReason of ["length", "MAX_TOKENS", "max_tokens"]) {
    it(`throws IntentTruncatedError instead of falling back when finish_reason=${finishReason}`, async () => {
      const seen = [];
      const classifier = createAiClassifier(fakeAi({ text: TRUNCATED_TEXT, finishReason }), { onResponse: (entry) => seen.push(entry) });
      const error = await classifier.recognize(VARS).catch((e) => e);
      expect(error).toBeInstanceOf(IntentTruncatedError);
      expect(error).toMatchObject({ code: INTENT_TRUNCATED, question: "recognize", text: TRUNCATED_TEXT, finishReason });
      expect(seen).toEqual([expect.objectContaining({ question: "recognize", text: TRUNCATED_TEXT, finishReason })]);
    });
  }

  it("reads finish_reason from a raw OpenAI-style body", async () => {
    const classifier = createAiClassifier(fakeAi({ text: '{"actions":[{"text":"给才旦', raw: { choices: [{ finish_reason: "length" }] } }));
    await expect(classifier.recognize(VARS)).rejects.toMatchObject({ code: INTENT_TRUNCATED });
  });

  it("propagates truncation out of recognizeIntent so callers can trace it", async () => {
    const classifier = createAiClassifier(fakeAi({ text: TRUNCATED_TEXT, finishReason: "length" }));
    await expect(recognizeIntent(state, "跟才旦切磋", { classifier })).rejects.toMatchObject({ code: INTENT_TRUNCATED });
  });

  it("treats a complete but malformed reply as empty actions (free-action fallback), not truncation", async () => {
    const result = await createAiClassifier(fakeAi({ text: "我觉得是切磋", finishReason: "stop" })).recognize(VARS);
    expect(result).toEqual({ actions: [], parseFailed: true });
  });
});

describe("intent.classify 原生 schema（WO-03）", () => {
  it("schema 透传进 modelOptions，锁死 condition 枚举与八键形状", async () => {
    const ai = fakeAi({ text: GOOD, finishReason: "stop" });
    await createAiClassifier(ai, { cfg: { model: "gemini-2.5-flash" } }).recognize(VARS);
    const [opts] = ai.requests;
    const schema = opts.modelOptions?.schema;
    expect(schema?.name).toBe("intent_classify");
    const item = schema.schema.properties.actions.items;
    expect(item.required).toEqual(["text", "kind", "target", "item", "direction", "condition", "condition_text", "confidence"]);
    expect(item.properties.condition.enum).toEqual(["遇敌", "到达", "被拒", "其他", "无"]);
    expect(item.additionalProperties).toBe(false);
  });

  it("schema 原生通路：合法 JSON 直取 res.data", async () => {
    const full = '{"actions":[{"text":"跟才旦切磋","kind":"切磋","target":"才旦","item":"无","direction":"无","condition":"无","condition_text":"","confidence":0.97}]}';
    const result = await createAiClassifier(fakeAi({ text: full, finishReason: "stop" })).recognize(VARS);
    expect(result.actions[0]).toMatchObject({ kind: "切磋", target: "才旦" });
    expect(result.parseFailed).toBeUndefined();
  });

  it("兜底通路：散文裹着 JSON（schema 校验失败）时手工截取救回", async () => {
    const wrapped = '我想想……{"actions":[{"text":"跟才旦切磋","kind":"切磋","target":"才旦","item":"无","direction":"无","condition":"无","confidence":0.9}]}';
    const result = await createAiClassifier(fakeAi({ text: wrapped, finishReason: "stop" })).recognize(VARS);
    expect(result.actions[0]).toMatchObject({ kind: "切磋", target: "才旦" });
  });
});
