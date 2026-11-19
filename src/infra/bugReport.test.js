import { afterEach, describe, expect, it, vi } from "vitest";
import { submitBugReport } from "./bugReport.js";

describe("submitBugReport debug bundle payload", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("nests the bundle in the existing game_state JSON column", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitBugReport({
      playerNote: "test",
      gameState: { room: "曲措乡" },
      debugBundle: { schema: 1, version: "test" },
      version: "test",
    });

    expect(result).toEqual({ ok: true });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/bug_reports");
    expect(Object.keys(JSON.parse(request.body))).toEqual([
      "player_note", "game_state", "conversation", "version", "user_agent",
    ]);
    expect(JSON.parse(request.body).game_state).toEqual({
      room: "曲措乡",
      debugBundle: { schema: 1, version: "test" },
    });
  });

  it("redacts configured secrets from player notes and submitted free-text fields", async () => {
    const apiKey = "cfg-value-123456";
    const endpoint = "https://private.example/v1/chat";
    const secretText = `note ${apiKey} sk-abcdefghijklmnop Bearer private-token ${endpoint}`;
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(JSON.stringify({ apiKey, endpoint })),
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue([{ id: 12 }]),
      })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitBugReport({
      playerNote: secretText,
      gameState: { note: secretText },
      conversation: [{ entries: [{ text: secretText }] }],
      pipelineLog: [{
        seq: 1,
        callLabel: "test",
        systemPrompt: secretText,
        userMessages: [{ role: "user", content: secretText }],
        response: secretText,
        success: true,
        model: "test",
      }],
      version: "test",
    });

    expect(result).toEqual({ ok: true });
    const uploaded = fetchMock.mock.calls.map(([, request]) => JSON.parse(request.body));
    const serialized = JSON.stringify(uploaded);
    for (const secret of [apiKey, endpoint, "sk-abcdefghijklmnop", "Bearer private-token"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(uploaded[0].player_note).toContain("[REDACTED]");
    expect(uploaded[1][0].system_prompt).toContain("[REDACTED]");
    expect(uploaded[1][0].user_message).toContain("[REDACTED]");
    expect(uploaded[1][0].response).toContain("[REDACTED]");
  });
});
