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

  it("waits for a streaming entry to finish before inserting", async () => {
    let log = [...tagBackfill([{ t: "sys", text: "  事实" }], "k"), { t: "desc", text: "  ▌", streaming: true }];
    let calls = 0;
    const setLog = (fn) => {
      if (++calls === 2) log = log.map((entry) => ({ ...entry, streaming: false }));
      log = fn(log);
    };
    const ok = await backfillInBackground("k", { ask: async () => "描写", parse: (text) => [text], setLog, retryMs: 0 });
    expect(ok).toBe(true);
    expect(calls).toBe(2);
    expect(log.map((entry) => entry.text.trim())).toEqual(["事实", "描写", "▌"]);
  });

  it("inserts anyway once retries run out", async () => {
    let log = [...tagBackfill([{ t: "sys", text: "  事实" }], "k"), { t: "desc", text: "  ▌", streaming: true }];
    const setLog = vi.fn((fn) => { log = fn(log); });
    const ok = await backfillInBackground("k", { ask: async () => "描写", parse: (text) => [text], setLog, retryMs: 0, maxTries: 3 });
    expect(ok).toBe(true);
    expect(setLog).toHaveBeenCalledTimes(4);
    expect(log.map((entry) => entry.text.trim())).toEqual(["事实", "描写", "▌"]);
  });

  it("ignores stale streaming rows before the fact lines", async () => {
    let log = [{ t: "desc", text: "  ▌", streaming: true }, ...tagBackfill([{ t: "sys", text: "  事实" }], "k")];
    const setLog = vi.fn((fn) => { log = fn(log); });
    const ok = await backfillInBackground("k", { ask: async () => "描写", parse: (text) => [text], setLog, retryMs: 0 });
    expect(ok).toBe(true);
    expect(setLog).toHaveBeenCalledTimes(1);
    expect(log.map((entry) => entry.text.trim())).toEqual(["▌", "事实", "描写"]);
  });

  it("makes distinct keys", () => {
    expect(newBackfillKey("duel")).toMatch(/^duel-/);
    expect(newBackfillKey()).not.toBe(newBackfillKey());
  });
});
