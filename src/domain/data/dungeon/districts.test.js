import { describe, expect, it } from "vitest";
import { DUNGEON_DISTRICTS, DUNGEON_DISTRICTS_ALL } from "./districts.js";
import { DUNGEON_DISTRICTS_EXTRA } from "./districtsExtra.js";
import { validateGridDungeonConfig } from "./universalSchema.js";
import { CATALOG_INDEX } from "../items/catalog.js";
import { SKILL_CATALOG } from "../kungfu/qucuoKungfu.js";

const ALL = { ...DUNGEON_DISTRICTS, ...DUNGEON_DISTRICTS_EXTRA };
const KINDS = ["fight", "event", "nsfw", "supply", "loot", "watch", "meet", "appraise", "puzzle", "checkpoint"];
const PUZZLE_TYPES = new Set(["sequenceReset", "recipeCraft", "pushPull", "timedAgility"]);
const ENV_TAGS = new Set([
  "baitaPrayerWheel", "huanjingSpore", "sanxingduiPatrol", "shuwangPhosphor", "xueshanWindchill",
  "wuxianVenom", "yajiangRope", "tianlongSeal", "tangGear", "huanxiDesire", "tusiWatch",
]);

describe("十宫配置数据", () => {
  it("十宫齐全且鱼定土司内府禁库独立挂载", () => {
    expect(Object.keys(ALL)).toHaveLength(10);
    expect(Object.keys(DUNGEON_DISTRICTS)).toHaveLength(5);
    expect(Object.keys(DUNGEON_DISTRICTS_EXTRA)).toHaveLength(5);
    expect(DUNGEON_DISTRICTS_ALL["鱼定土司内府禁库"]).toBeDefined();
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

describe("八大 13×13 地宫 Universal Schema 与真词条契约", () => {
  const GRID_DUNGEONS = Object.entries(DUNGEON_DISTRICTS_ALL).filter(([, cfg]) => cfg.gridSize === 13);

  it("八座 13×13 地宫齐全且全部通过 validateGridDungeonConfig", () => {
    expect(GRID_DUNGEONS).toHaveLength(8);
    const allErrors = GRID_DUNGEONS.flatMap(([, cfg]) => validateGridDungeonConfig(cfg));
    expect(allErrors).toEqual([]);
  });

  it("八大地宫全部具名物品存在于 CATALOG_INDEX 且品类品质严格一致", () => {
    const mismatches = [];
    const checkItem = (ctx, ref) => {
      const name = typeof ref === "string" ? ref : ref?.name;
      if (!name) return;
      const entry = CATALOG_INDEX[name];
      if (!entry) {
        mismatches.push(`${ctx}: 物品「${name}」不存在于 CATALOG_INDEX`);
        return;
      }
      if (typeof ref === "object") {
        if (ref.category && ref.category !== entry.category) {
          mismatches.push(`${ctx}: 「${name}」category写${ref.category}，catalog为${entry.category}`);
        }
        if (ref.quality && ref.quality !== entry.quality) {
          mismatches.push(`${ctx}: 「${name}」quality写${ref.quality}，catalog为${entry.quality}`);
        }
      }
    };

    for (const [key, cfg] of GRID_DUNGEONS) {
      checkItem(`${key}.recruitToken`, cfg.recruitToken);
      for (const e of [...cfg.enemies, cfg.boss]) {
        for (const c of e.carry || []) checkItem(`${key}.${e.name}.carry`, c);
      }
      for (const g of cfg.merchant?.goods || []) {
        if (!g.effect) checkItem(`${key}.merchant.${g.id}`, g);
      }
      for (const t of cfg.trades || []) {
        if (t.item) checkItem(`${key}.trade.${t.id}`, t.item);
      }
      for (const tc of cfg.trapChests || []) {
        if (tc.successItem) checkItem(`${key}.trapChest.${tc.id}`, tc.successItem);
      }
      for (const [tier, pool] of Object.entries(cfg.chestPools || {})) {
        for (const it of pool.items || []) checkItem(`${key}.chestPools.${tier}`, it);
      }
      checkItem(`${key}.divineArm.item`, { name: cfg.divineArm.itemName, category: cfg.divineArm.category, quality: cfg.divineArm.quality });
      checkItem(`${key}.divineArm.clue`, cfg.divineArm.clueItem);
      checkItem(`${key}.divineArm.fallback`, cfg.divineArm.fallbackItem);
    }

    expect(mismatches).toEqual([]);
  });

  it("八大地宫四档箱内武学均为真武学且 clearFlag / divineFlag / cardFlag 全局不重复", () => {
    const skillById = new Map();
    for (const list of Object.values(SKILL_CATALOG)) {
      if (!Array.isArray(list)) continue;
      for (const s of list) skillById.set(s.id, s);
    }

    const skillErrors = [];
    const seenClearFlags = new Set();
    const seenDivineFlags = new Set();
    const seenCardFlags = new Set();

    for (const [key, cfg] of GRID_DUNGEONS) {
      expect(seenClearFlags.has(cfg.clearFlag), `${key} 重复 clearFlag`).toBe(false);
      seenClearFlags.add(cfg.clearFlag);
      expect(seenDivineFlags.has(cfg.divineArm.flag), `${key} 重复 divine flag`).toBe(false);
      seenDivineFlags.add(cfg.divineArm.flag);
      for (const c of cfg.cards) {
        expect(seenCardFlags.has(c.flag), `${key} 重复 card flag`).toBe(false);
        seenCardFlags.add(c.flag);
      }
      for (const [tier, pool] of Object.entries(cfg.chestPools || {})) {
        for (const sk of pool.skills || []) {
          const real = skillById.get(sk.id);
          if (!real) skillErrors.push(`${key}.${tier}: 武学 id ${sk.id} 不存在`);
          else if (real.name !== sk.name) skillErrors.push(`${key}.${tier}: 武学 ${sk.id} 名称应为 ${real.name}`);
        }
      }
    }
    expect(skillErrors).toEqual([]);
  });
});
