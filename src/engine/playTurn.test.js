import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE, turnMonitor } from "../core/turnMonitor.js";
import { commitRound } from "./act/commitRound.js";
import { runTurn } from "./runTurn.js";
import { playTurn } from "./playTurn.js";

vi.mock("./act/commitRound.js", () => ({ commitRound: vi.fn() }));
vi.mock("./runTurn.js", () => ({ runTurn: vi.fn() }));

function makeContext(overrides = {}) {
  return {
    apiCfg: { bookkeepEnabled: true },
    ai: { chat: vi.fn() },
    commitDeps: () => ({}),
    _trace: turnMonitor.start("测试行动"),
    ...overrides,
  };
}

describe("playTurn background bookkeep", () => {
  beforeEach(() => {
    runTurn.mockReset();
    commitRound.mockReset();
    commitRound.mockReturnValue({});
  });

  afterEach(() => turnMonitor.clear());

  it("calls the injected hook once after a successful commit", async () => {
    const turn = { narrativeText: "少侠走进鱼定村。" };
    const bookkeep = vi.fn();
    const ctx = makeContext({ bookkeep });
    runTurn.mockResolvedValue(turn);

    const result = await playTurn(ctx, "进村");

    expect(result).toMatchObject({ ok: true, turn });
    expect(bookkeep).toHaveBeenCalledTimes(1);
    expect(bookkeep.mock.calls[0][0]).toMatchObject({ ctx: { ai: ctx.ai }, turn, opts: {} });
    expect(bookkeep.mock.calls[0][0].trace.phase).toBe(PHASE.DONE);
  });

  it("does not call the hook for stale or failed turns", async () => {
    const bookkeep = vi.fn();
    runTurn.mockResolvedValueOnce({ stale: true });
    const stale = await playTurn(makeContext({ bookkeep }), "过期行动");
    expect(stale.stale).toBe(true);

    runTurn.mockRejectedValueOnce(new Error("turn failed"));
    const failed = await playTurn(makeContext({ bookkeep }), "失败行动");
    expect(failed.ok).toBe(false);
    expect(bookkeep).not.toHaveBeenCalled();
  });

  it("does not wait for a pending background hook", async () => {
    const bookkeep = vi.fn(() => new Promise(() => {}));
    runTurn.mockResolvedValue({ narrativeText: "少侠走进鱼定村。" });
    let timeout;
    const result = await Promise.race([
      playTurn(makeContext({ bookkeep }), "进村"),
      new Promise((resolve) => { timeout = setTimeout(() => resolve("timeout"), 250); }),
    ]);
    clearTimeout(timeout);

    expect(result).not.toBe("timeout");
    expect(result.ok).toBe(true);
    expect(bookkeep).toHaveBeenCalledTimes(1);
  });
});
