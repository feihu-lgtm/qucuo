import { describe, expect, it, vi } from "vitest";
import { createTurnStaleCheck } from "./useUndo.js";
import { consumeDuelRequest, openDuelAfterNarration } from "./useDuel.js";

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

describe("AI duel request consumption", () => {
  const npc = { name: "才旦" };
  const makeOptions = (overrides = {}) => ({
    opts: {}, isStale: () => false, isTalk: false, interactMode: "action",
    recognize: vi.fn(), setActiveTarget: vi.fn(), setDuelPending: vi.fn(),
    ...overrides,
  });

  it("recognizes the present NPC, selects it, and opens the confirmation bar", () => {
    const options = makeOptions();
    expect(consumeDuelRequest({ ok: true, duelRequest: npc }, options)).toBe(true);
    expect(options.recognize).toHaveBeenCalledWith(npc);
    expect(options.setActiveTarget).toHaveBeenCalledWith(npc.name);
    expect(options.setDuelPending).toHaveBeenCalledWith(npc);
  });

  it("records recognition through the feature context", () => {
    const setVarTree = vi.fn();
    const options = makeOptions({
      recognize: undefined,
      featureCtxRef: { current: { setVarTree } },
    });
    expect(consumeDuelRequest({ ok: true, duelRequest: npc }, options)).toBe(true);
    expect(setVarTree).toHaveBeenCalledWith(expect.any(Function));
  });

  it("ignores talk, whisper, stale, and settle results", () => {
    const ignored = [
      [{ ok: true, duelRequest: npc }, makeOptions({ isTalk: true })],
      [{ ok: true, duelRequest: npc }, makeOptions({ interactMode: "whisper" })],
      [{ ok: true, duelRequest: npc }, makeOptions({ isStale: () => true })],
      [{ ok: true, duelRequest: npc }, makeOptions({ opts: { settle: true } })],
      [{ ok: true, duelRequest: npc }, makeOptions({ opts: { settleKind: "duel_invite" } })],
      [{ ok: false, duelRequest: npc }, makeOptions()],
    ];
    for (const [result, options] of ignored) {
      expect(consumeDuelRequest(result, options)).toBe(false);
      expect(options.recognize).not.toHaveBeenCalled();
      expect(options.setActiveTarget).not.toHaveBeenCalled();
      expect(options.setDuelPending).not.toHaveBeenCalled();
    }
  });
});
