import { describe, expect, it } from "vitest";
import { factionAmbushRule, pickAmbusher } from "./ambush.js";

const state = (rep, time = 0, flags = []) => ({
  room: { name: "大草甸", npcs: [] },
  varTree: { 世界: { 势力声誉: rep != null ? { 唐门: rep } : {} } },
  time, flags,
});

describe("faction ambush rule", () => {
  it("never ambushes above the -60 threshold", () => {
    expect(factionAmbushRule.run(state(-59))).toBeNull();
    expect(pickAmbusher(state(-59), () => 0)).toBeNull();
  });

  it("forces a duel with the squad member when rep ≤ -60 and the roll hits", () => {
    const hit = pickAmbusher(state(-80), () => 0);
    expect(hit.npc).toMatchObject({ name: "唐门暗弩手", faction: "唐门", levelCap: 3 });
    expect(hit.npc.moveset?.length).toBeGreaterThan(0);
    const result = factionAmbushRule.run(state(-80, 100));
    expect(result.forcedDuelNpc.name).toBe("唐门暗弩手");
    expect(result.logs[0].text).toContain("暗杀组");
  });

  it("ambushes defectors even above the rep line", () => {
    expect(pickAmbusher(state(-40, 0, ["叛出:唐门"]), () => 0)).not.toBeNull();
  });

  it("passes on a missed roll", () => {
    expect(pickAmbusher(state(-80), () => 0.99)).toBeNull();
  });
});
