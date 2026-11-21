import { describe, expect, it, vi } from "vitest";
import { createTurnStaleCheck } from "./useUndo.js";
import { openDuelAfterNarration } from "./useDuel.js";

describe("duel narration rollback", () => {
  it("uses the duel invitation settle without allowing the fight to start", async () => {
    const npc = { name: "才旦" };
    const act = vi.fn().mockResolvedValue(undefined);
    const setDuelPending = vi.fn();
    await expect(openDuelAfterNarration({
      act,
      setDuelPending,
      isStale: () => false,
    }, npc)).resolves.toBe(true);
    expect(act).toHaveBeenCalledWith("向才旦抱拳邀战，请他切磋一番", [], {
      keepUndo: true, settle: true, settleKind: "duel_invite", settleNpc: npc,
    });
    expect(setDuelPending).toHaveBeenCalledWith(npc);
  });

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
