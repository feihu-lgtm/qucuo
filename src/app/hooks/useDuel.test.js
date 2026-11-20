import { describe, expect, it, vi } from "vitest";
import { createTurnStaleCheck } from "./useUndo.js";
import { openDuelAfterNarration } from "./useDuel.js";

describe("duel narration rollback", () => {
  it("does not open the duel banner when rollback invalidates the response", async () => {
    let releaseNarration;
    const narration = new Promise((resolve) => { releaseNarration = resolve; });
    const turnGenerationRef = { current: 0 };
    const isStale = createTurnStaleCheck(turnGenerationRef);
    const setDuelPending = vi.fn();
    const pending = openDuelAfterNarration({
      act: () => narration,
      setDuelPending,
      isStale,
    }, { name: "守门人" });

    turnGenerationRef.current += 1;
    releaseNarration();
    await expect(pending).resolves.toBe(false);
    expect(setDuelPending).not.toHaveBeenCalled();
  });
});
