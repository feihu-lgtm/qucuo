import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAi, createMockAi, createRecordingAi, createReplayAi } from "./ai.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI ports", () => {
  it("returns mock replies in order and fails when exhausted", async () => {
    const ai = createMockAi(["first", { text: "second" }]);

    await expect(ai.chat([])).resolves.toEqual({ text: "first" });
    await expect(ai.chat([])).resolves.toEqual({ text: "second" });
    await expect(ai.chat([])).rejects.toThrow("Mock AI replies exhausted");
  });

  it("replays recorded response entries in order", async () => {
    const ai = createReplayAi([
      { request: { messages: [] }, response: { text: "replayed" } },
    ]);

    await expect(ai.chat([])).resolves.toEqual({ text: "replayed" });
    await expect(ai.chat([])).rejects.toThrow("Replay AI entries exhausted");
  });

  it("calls an OpenAI-compatible endpoint without exposing the key in its errors", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "reply" }, finish_reason: "stop" }] }),
    }));
    vi.stubGlobal("fetch", fetch);
    const ai = createHttpAi({ baseUrl: "https://api.example.test", apiKey: "do-not-record", model: "test" });

    await expect(ai.chat([{ role: "user", content: "hello" }])).resolves.toEqual({
      text: "reply",
      finishReason: "stop",
    });
    expect(fetch.mock.calls[0][0]).toBe("https://api.example.test/chat/completions");
    expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe("test");
  });

  it("keeps the HTTP status on vendor error messages so callers can retry 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "Resource exhausted for key" } }) })));
    const ai = createHttpAi({ baseUrl: "https://api.example.test", apiKey: "key", model: "test" });
    await expect(ai.chat([], {})).rejects.toMatchObject({ status: 429, message: "Resource exhausted for [redacted]" });
  });

  it("maps modelOptions sampling values like the web callModel adapter", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "reply" }, finish_reason: "stop" }] }),
    }));
    vi.stubGlobal("fetch", fetch);
    const ai = createHttpAi({ baseUrl: "https://api.example.test", apiKey: "key", model: "fallback" });

    await ai.chat([], {
      cfg: { model: "configured", maxTokens: 100, temperature: 0.2, topP: 0.3, frequencyPenalty: 0.4, presencePenalty: 0.5 },
      modelOptions: { maxTokens: 500, temperature: 0.6, topP: 0.7, frequencyPenalty: 0.8, presencePenalty: 0.9 },
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: "configured",
      max_tokens: 500,
      temperature: 0.6,
      top_p: 0.7,
      frequency_penalty: 0.8,
      presence_penalty: 0.9,
    });
  });

  it("records requests and responses without recording API configuration", async () => {
    const record = vi.fn();
    const response = { text: "reply", finishReason: "length", usage: { outputTokens: 24 } };
    const ai = createRecordingAi(createMockAi([response]), record);

    await ai.chat([{ role: "user", content: "hello" }], {
      systemPrompt: "system",
      cfg: { apiKey: "secret" },
    });

    expect(record).toHaveBeenCalledWith({
      request: { systemPrompt: "system", messages: [{ role: "user", content: "hello" }] },
      response,
    });
    const replay = createReplayAi([record.mock.calls[0][0]]);
    await expect(replay.chat([])).resolves.toEqual(response);
  });
});
