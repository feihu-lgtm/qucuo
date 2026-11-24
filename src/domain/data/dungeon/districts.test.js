import { describe, expect, it } from "vitest";
import { DUNGEON_DISTRICTS } from "./districts.js";
import { DUNGEON_DISTRICTS_EXTRA } from "./districtsExtra.js";

const ALL = { ...DUNGEON_DISTRICTS, ...DUNGEON_DISTRICTS_EXTRA };
const KINDS = ["fight", "event", "nsfw", "supply", "loot", "watch", "meet", "appraise", "puzzle", "checkpoint"];
const PUZZLE_TYPES = new Set(["sequenceReset", "recipeCraft", "pushPull", "timedAgility"]);
const ENV_TAGS = new Set([
  "baitaPrayerWheel", "huanjingSpore", "sanxingduiPatrol", "shuwangPhosphor", "xueshanWindchill",
  "wuxianVenom", "yajiangRope", "tianlongSeal", "tangGear", "huanxiDesire",
]);

describe("十宫配置数据", () => {
  it("十宫齐全", () => {
    expect(Object.keys(ALL)).toHaveLength(10);
    expect(Object.keys(DUNGEON_DISTRICTS)).toHaveLength(5);
    expect(Object.keys(DUNGEON_DISTRICTS_EXTRA)).toHaveLength(5);
  });

  it.each(Object.entries(ALL))("%s 字段齐整且十类落位齐全", (name, d) => {
    expect(d.anchor).toBeTruthy();
    expect(ENV_TAGS.has(d.envTag)).toBe(true);
    expect(d.prefixPool.length).toBeGreaterThanOrEqual(4);
    expect(d.suffixPool.length).toBeGreaterThanOrEqual(4);
    expect(d.descPool.length).toBeGreaterThan(0);
    expect(PUZZLE_TYPES.has(d.puzzle.type)).toBe(true);
    expect(d.boss.name).toBeTruthy();
    expect(d.adventurerFactions.length).toBeGreaterThan(0);
    const kinds = d.eventSeeds.map((e) => e.kind);
    for (const k of KINDS) expect(kinds, `${name} 缺 ${k}`).toContain(k);
  });

  it("envTag 十宫不重复", () => {
    const tags = Object.values(ALL).map((d) => d.envTag);
    expect(new Set(tags).size).toBe(10);
  });
});
