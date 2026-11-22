import { describe, expect, it } from "vitest";
import { getRandomPassers } from "./randomPassers.js";
import { NPC_POOL } from "./npcPool.js";
import { getAllResidentNpcNames } from "./residentNpcs.js";
import { QUCUO_MAP } from "../map/qucuoMap.js";
import { FACTIONS } from "../map/factions.js";
import { getNpcFaction } from "../factions/npcFactions.js";
import { residentNpcRule } from "../../rules/npc/rules.js";

const NODES = Object.keys(QUCUO_MAP).filter((name) => !["第三新东京市", "心灵之海"].includes(name));
const FACTION_NAMES = new Set([...FACTIONS.map((f) => f.name), "散人"]);
const importedRegistry = { getImportedForDistrict: () => [], getImportedResidentNames: () => [] };

describe("random passers", () => {
  it("spawns people at every real map node, stable within a day and changing across days", () => {
    const reserved = new Set([...getAllResidentNpcNames(), ...NPC_POOL.map((npc) => npc.name)]);
    for (const node of NODES) {
      const week = Array.from({ length: 7 }, (_, day) => getRandomPassers(node, day * 24 + 9));
      expect(week.flat().length, node).toBeGreaterThan(0);
      expect(getRandomPassers(node, 9 + 5)).toEqual(week[0]);
      for (const passer of week.flat()) {
        expect(FACTION_NAMES.has(passer.faction), passer.faction).toBe(true);
        expect(reserved.has(passer.name), passer.name).toBe(false);
      }
    }
    const names = (day) => getRandomPassers("天都镇", day * 24).map((p) => p.name).join();
    expect(new Set([0, 1, 2, 3, 4].map(names)).size).toBeGreaterThan(1);
    expect(getRandomPassers("心灵之海", 0)).toEqual([]);
  });

  it("injects today's passers with combat data and faction, and clears yesterday's", () => {
    const state = (time, npcs = []) => ({
      char: { special: { 气运: 5 } }, companionState: {}, flags: [], importedVer: 0, questProgress: {},
      room: { name: "雅江", npcs }, time,
    });
    const day0 = state(9);
    const npcs0 = residentNpcRule.run(day0, { importedRegistry }).changes.room(day0.room).npcs;
    const passers0 = npcs0.filter((npc) => npc.randomPasser === 0);
    expect(passers0.length).toBeGreaterThan(0);
    expect(passers0.every((npc) => npc.moveset && npc.combatStats && npc.brief && npc.innerRoom)).toBe(true);
    const sect = passers0.find((npc) => npc.faction !== "散人");
    if (sect) expect(getNpcFaction(sect)).toBe(sect.faction);
    const day1 = state(24 + 9, npcs0);
    const npcs1 = residentNpcRule.run(day1, { importedRegistry }).changes.room(day1.room).npcs;
    expect(npcs1.some((npc) => npc.randomPasser === 0)).toBe(false);
    expect(npcs1.some((npc) => npc.randomPasser === 1)).toBe(true);
  });

  it("never reuses a name the player already knows or an imported card uses", () => {
    const today = getRandomPassers("雅江", 9);
    const taken = today[0].name;
    expect(getRandomPassers("雅江", 9, new Set([taken])).some((p) => p.name === taken)).toBe(false);
    const all = Object.keys(QUCUO_MAP).flatMap((node) => getRandomPassers(node, 9).map((p) => p.name));
    expect(new Set(all).size).toBe(all.length);
  });

  it("rebuilds today's passer instead of keeping yesterday's namesake, and lets imported cards win", () => {
    const name = getRandomPassers("雅江", 24 + 9)[0].name;
    const yesterday = {
      name, randomPasser: 0, faction: "唐门", brief: "昨天的人", innerRoom: "旧处",
      moveset: [], carriedItems: [], special: {}, combatStats: {},
    };
    const state = {
      char: { special: { 气运: 5 } }, companionState: {}, flags: [], importedVer: 0, questProgress: {},
      room: { name: "雅江", npcs: [yesterday] }, time: 24 + 9,
    };
    const npcs = residentNpcRule.run(state, { importedRegistry }).changes.room(state.room).npcs;
    const rebuilt = npcs.filter((npc) => npc.name === name);
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].randomPasser).toBe(1);
    expect(rebuilt[0].brief).not.toBe("昨天的人");

    const withCard = {
      getImportedForDistrict: () => [{ name, brief: "导入的角色卡", imported: true }],
      getImportedResidentNames: () => [name],
    };
    const fresh = { ...state, room: { name: "雅江", npcs: [] } };
    const npcs2 = residentNpcRule.run(fresh, { importedRegistry: withCard }).changes.room(fresh.room).npcs;
    const same = npcs2.filter((npc) => npc.name === name);
    expect(same).toHaveLength(1);
    expect(same[0].imported).toBe(true);
    expect(same[0].randomPasser).toBeUndefined();
  });

  it("keeps today's roster stable after the player gets to know a passer", () => {
    const base = {
      char: { special: { 气运: 5 } }, companionState: {}, flags: [], importedVer: 0, questProgress: {}, time: 9,
    };
    const first = residentNpcRule.run({ ...base, room: { name: "雅江", npcs: [] } }, { importedRegistry })
      .changes.room({ name: "雅江", npcs: [] }).npcs;
    const met = first.find((npc) => npc.randomPasser === 0).name;
    const again = { ...base, varTree: { 世界: { 已认识人物: [met] }, 角色: { [met]: { 好感度: 10 } } }, room: { name: "雅江", npcs: first } };
    const npcs = residentNpcRule.run(again, { importedRegistry })?.changes.room(again.room).npcs ?? first;
    expect(npcs.filter((npc) => npc.randomPasser === 0).map((npc) => npc.name))
      .toEqual(first.filter((npc) => npc.randomPasser === 0).map((npc) => npc.name));
  });
});
