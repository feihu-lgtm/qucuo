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

  it("records requests and responses without recording API configuration", async () => {
    const record = vi.fn();
    const ai = createRecordingAi(createMockAi(["reply"]), record);

    await ai.chat([{ role: "user", content: "hello" }], {
      systemPrompt: "system",
      cfg: { apiKey: "secret" },
    });

    expect(record).toHaveBeenCalledWith({
      request: { systemPrompt: "system", messages: [{ role: "user", content: "hello" }] },
      response: { text: "reply" },
    });
  });
});
