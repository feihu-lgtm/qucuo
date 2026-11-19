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
});
