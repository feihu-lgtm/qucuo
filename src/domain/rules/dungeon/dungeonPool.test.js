import { describe, it, expect } from "vitest";
import { pickDungeonAdventurers, genAdventurerEncounter } from "./dungeonPool.js";
import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";
import { seededRand } from "../../../utils/seededRandom.js";

const FULL = [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP];
const DISTRICT_KEY = Object.keys(DUNGEON_DISTRICTS_ALL)[0];
const rng = (seed) => seededRand(0, `t|${seed}`);
const hit = (adv, factions) => factions.some((f) => adv.faction.includes(f) || f.includes(adv.faction));

describe("pickDungeonAdventurers", () => {
  it("同 seed 可重放，不重复", () => {
    const a = pickDungeonAdventurers(DISTRICT_KEY, 5, rng("x"));
    const b = pickDungeonAdventurers(DISTRICT_KEY, 5, rng("x"));
    expect(a).toEqual(b);
    const ids = a.map((p) => p.adventurer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("faction 命中者权重×3——多次抽样命中率显著高于随机", () => {
    const factions = DUNGEON_DISTRICTS_ALL[DISTRICT_KEY].adventurerFactions;
    const expectedRate = FULL.filter((a) => hit(a, factions)).length / FULL.length;
    let hits = 0, total = 0;
    for (let i = 0; i < 60; i++) {
      for (const p of pickDungeonAdventurers(DISTRICT_KEY, 6, rng(`s${i}`))) {
        total += 1;
        if (hit(p.adventurer, factions)) hits += 1;
      }
    }
    expect(hits / total).toBeGreaterThan(expectedRate);
  });

  it("身份只产三种且 roomRole 对得上", () => {
    const legal = { roamer: "any", treasureGuard: "isTreasure", hiddenHireable: "hidden" };
    for (let i = 0; i < 40; i++) {
      for (const p of pickDungeonAdventurers(DISTRICT_KEY, 8, rng(`r${i}`))) {
        expect(legal).toHaveProperty(p.identity);
        expect(p.roomRole).toBe(legal[p.identity]);
      }
    }
  });

  it("每宫都能抽出人（n=3）", () => {
    for (const key of Object.keys(DUNGEON_DISTRICTS_ALL)) {
      expect(pickDungeonAdventurers(key, 3, rng("k")).length).toBe(3);
    }
  });
});

describe("genAdventurerEncounter", () => {
  const adv = ADVENTURER_POOL[0];
  it("三种身份骨架：确定性 + options 齐 {label,check,dc,effect}", () => {
    for (const identity of ["roamer", "treasureGuard", "hiddenHireable"]) {
      const a = genAdventurerEncounter(adv, identity, "seed1");
      expect(a).toEqual(genAdventurerEncounter(adv, identity, "seed1"));
      expect(a.npcRef).toBe(adv.id);
      expect(a.triggerLines.length).toBeGreaterThan(0);
      for (const o of a.options) {
        expect(o).toHaveProperty("label");
        expect(o).toHaveProperty("check");
        expect(o).toHaveProperty("dc");
        expect(o).toHaveProperty("effect");
      }
    }
  });

  it("roamer snatch 落在 25-35%", () => {
    for (let i = 0; i < 30; i++) {
      const enc = genAdventurerEncounter(ADVENTURER_POOL[i % ADVENTURER_POOL.length], "roamer", `s${i}`);
      const snatch = enc.options.find((o) => o.effect.snatch !== undefined).effect.snatch;
      expect(snatch).toBeGreaterThanOrEqual(0.25);
      expect(snatch).toBeLessThanOrEqual(0.35);
    }
  });

  it("hiddenHireable 产出 recruitHook", () => {
    const enc = genAdventurerEncounter(ADVENTURER_POOL_IP[0], "hiddenHireable", "seed9");
    expect(enc.options.some((o) => o.effect.recruitHook === true)).toBe(true);
  });
});
