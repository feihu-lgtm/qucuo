import { describe, expect, it } from "vitest";
import { factionAmbushRule, pickAmbusher } from "./ambush.js";

const state = (rep, time = 0) => ({
  room: { name: "大草甸", npcs: [] },
  varTree: { 世界: { 势力声誉: rep != null ? { 唐门: rep } : {} } },
  time,
});

describe("faction ambush rule", () => {
  it("never ambushes above the -60 threshold", () => {
    expect(factionAmbushRule.run(state(-59))).toBeNull();
    expect(pickAmbusher(state(-59), () => 0)).toBeNull();
  });

  it("forces a duel with the squad member when rep ≤ -60 and the roll hits", () => {
    const hit = pickAmbusher(state(-80), () => 0);
    expect(hit.npc).toMatchObject({ name: "唐门暗弩手", faction: "唐门", levelCap: 3 });
    const result = factionAmbushRule.run(state(-80, 100));
    expect(result.forcedDuelNpc.name).toBe("唐门暗弩手");
    expect(result.logs[0].text).toContain("暗杀组");
  });

  it("passes on a missed roll", () => {
    expect(pickAmbusher(state(-80), () => 0.99)).toBeNull();
  });
});
