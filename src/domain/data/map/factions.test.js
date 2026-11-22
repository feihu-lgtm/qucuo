import { describe, expect, it } from "vitest";
import { FACTION } from "../factions/npcFactions.js";
import { FACTION_NAMES, FACTIONS } from "./factions.js";
import { QUCUO_MAP } from "./qucuoMap.js";

describe("FACTIONS", () => {
  it("lists the 16 factions of the design roster, matching the NPC faction tags", () => {
    expect(FACTION_NAMES).toHaveLength(16);
    expect([...FACTION_NAMES].sort()).toEqual(Object.values(FACTION).sort());
  });

  it("seats factions on real outer nodes, one faction per node", () => {
    const districts = FACTIONS.flatMap((faction) => faction.districts);
    expect(new Set(districts).size).toBe(districts.length);
    for (const district of districts) expect(QUCUO_MAP[district]).toBeTruthy();
  });

  it("registers foes both ways and only between known factions", () => {
    const byName = Object.fromEntries(FACTIONS.map((faction) => [faction.name, faction]));
    for (const faction of FACTIONS) {
      for (const foe of faction.foes) expect(byName[foe]?.foes).toContain(faction.name);
    }
  });
});
