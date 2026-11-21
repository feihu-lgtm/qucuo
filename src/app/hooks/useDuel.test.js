import { describe, expect, it, vi } from "vitest";
import { createTurnStaleCheck } from "./useUndo.js";
import { openDuelAfterNarration, routeDuelInvitation } from "./useDuel.js";
import { classifyIntent, INTENT } from "../../domain/prompt/inputIntent.js";

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

describe("typed duel invitations", () => {
  const room = { npcs: [{ name: "大公鸡" }, { name: "才旦" }] };

  it("routes the typo with a selected target to the duel handler, not free action", () => {
    const handleNpcDuel = vi.fn();
    const act = vi.fn();
    expect(classifyIntent("切搓")).toEqual(INTENT.COMBAT);
    const routed = routeDuelInvitation("切搓", {
      interactMode: "action", room, activeTarget: "大公鸡", handleNpcDuel,
    });
    if (!routed) act("切搓");
    expect(routed).toBe(true);
    expect(handleNpcDuel).toHaveBeenCalledWith(room.npcs[0]);
    expect(act).not.toHaveBeenCalled();
  });

  it("routes a named NPC ahead of a different selected target", () => {
    const handleNpcDuel = vi.fn();
    expect(classifyIntent("比武")).toEqual(INTENT.COMBAT);
    expect(routeDuelInvitation("和才旦切磋", {
      interactMode: "action", room, activeTarget: "大公鸡", handleNpcDuel,
    })).toBe(true);
    expect(handleNpcDuel).toHaveBeenCalledWith(room.npcs[1]);
  });

  it("leaves a duel word with no resolvable target as a normal action", () => {
    const handleNpcDuel = vi.fn();
    expect(routeDuelInvitation("切磋", {
      interactMode: "action", room, activeTarget: null, handleNpcDuel,
    })).toBe(false);
    expect(handleNpcDuel).not.toHaveBeenCalled();
  });

  it("does not route longer combat discussion or talk-mode input", () => {
    const handleNpcDuel = vi.fn();
    expect(routeDuelInvitation("我想跟他切磋一下刀法的心得", {
      interactMode: "action", room, activeTarget: "大公鸡", handleNpcDuel,
    })).toBe(false);
    expect(routeDuelInvitation("和才旦切磋", {
      interactMode: "talk", room, activeTarget: null, handleNpcDuel,
    })).toBe(false);
    expect(routeDuelInvitation("切磋", {
      interactMode: "whisper", room, activeTarget: "大公鸡", handleNpcDuel,
    })).toBe(false);
    expect(handleNpcDuel).not.toHaveBeenCalled();
  });
});
