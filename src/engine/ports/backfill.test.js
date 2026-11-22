import { describe, expect, it, vi } from "vitest";
import { backfillInBackground, newBackfillKey } from "./backfill.js";
import { tagBackfill } from "../../domain/rules/log/backfill.js";

describe("backfillInBackground", () => {
  const run = (overrides) => {
    let log = tagBackfill([{ t: "sys", text: "  事实" }], "k");
    const setLog = vi.fn((fn) => { log = fn(log); });
    const opts = { ask: async () => "描写", parse: (text) => [text], setLog, ...overrides };
    return backfillInBackground("k", opts).then((ok) => ({ ok, log, setLog }));
  };

  it("inserts the parsed lines", async () => {
    const { ok, log } = await run();
    expect(ok).toBe(true);
    expect(log.map((entry) => entry.text.trim())).toEqual(["事实", "描写"]);
  });

  it("does nothing without an API, on failure, or on unparsable text", async () => {
    for (const overrides of [
      { canAsk: () => false },
      { ask: async () => null },
      { ask: async () => { throw new Error("boom"); } },
      { parse: () => null },
    ]) {
      const { ok, setLog } = await run(overrides);
      expect(ok).toBe(false);
      expect(setLog).not.toHaveBeenCalled();
    }
  });

  it("makes distinct keys", () => {
    expect(newBackfillKey("duel")).toMatch(/^duel-/);
    expect(newBackfillKey()).not.toBe(newBackfillKey());
  });
});
