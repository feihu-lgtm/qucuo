import { describe, it, expect } from "vitest";
import { pickDungeonAdventurers, genAdventurerEncounter, calcAdventurerDiveProb, rollDungeonDiveSquad } from "./dungeonPool.js";
import { genDungeonMap } from "./genMap.js";
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

describe("calcAdventurerDiveProb / rollDungeonDiveSquad（~8人下本模型）", () => {
  it("同门派与高贪欲倾向者概率显著高于冷门低匹配者且在 [0.02, 0.35] 内", () => {
    const cfg = DUNGEON_DISTRICTS_ALL["白塔地宫"];
    const hitAdv = { faction: "雪山派", stealBias: 0.8, levelCap: 2 };
    const missAdv = { faction: "无关门派", stealBias: 0.1, levelCap: 5 };
    const pHit = calcAdventurerDiveProb(hitAdv, cfg);
    const pMiss = calcAdventurerDiveProb(missAdv, cfg);
    expect(pHit).toBeGreaterThan(pMiss);
    expect(pHit).toBeLessThanOrEqual(0.35);
    expect(pMiss).toBeGreaterThanOrEqual(0.02);
  });

  it("rollDungeonDiveSquad 抽取 7-9 人（目标 8 人）、无重复、排除已入队角色且合法落位", () => {
    const cfg = DUNGEON_DISTRICTS_ALL["白塔地宫"];
    const map = genDungeonMap("squad-map", cfg);
    const excluded = [ADVENTURER_POOL[0].name, ADVENTURER_POOL[1].name];
    const squadA = rollDungeonDiveSquad("白塔地宫", "sq-1", {
      targetCount: 8,
      excludedNames: excluded,
      mapRooms: map.rooms,
      anchor: map.anchor,
      bossRoom: map.bossRoom,
    });
    const squadB = rollDungeonDiveSquad("白塔地宫", "sq-1", {
      targetCount: 8,
      excludedNames: excluded,
      mapRooms: map.rooms,
      anchor: map.anchor,
      bossRoom: map.bossRoom,
    });
    expect(squadA).toEqual(squadB);
    expect(squadA.length).toBeGreaterThanOrEqual(7);
    expect(squadA.length).toBeLessThanOrEqual(9);
    expect(new Set(squadA.map((a) => a.advId)).size).toBe(squadA.length);
    for (const member of squadA) {
      expect(excluded).not.toContain(member.name);
      expect(map.rooms[member.currentRoom]).toBeDefined();
      expect(member.currentRoom).not.toBe(map.anchor);
      expect(member.currentRoom).not.toBe(map.bossRoom);
    }
  });
});
