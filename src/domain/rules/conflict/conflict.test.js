import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRngState, setRngState, setSeed } from "../../../utils/rng.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { NPC_POOL, toRoomNpc } from "../../data/npc/npcPool.js";
import { BASE_TENSION, FACTION, getNpcFaction, tensionKey } from "../../data/factions/npcFactions.js";
import { buildRoomNpcWithCombat } from "../npc/rules.js";
import { adjustTension, decayTension, getTension } from "./tension.js";
import { resolveNpcConflict } from "./npcAutoBattle.js";

let saved;
beforeEach(() => { saved = getRngState(); });
afterEach(() => { setRngState(saved); });

const content = [...Object.values(RESIDENT_NPCS).flat(), ...NPC_POOL];
const npc = (name) => {
  return buildRoomNpcWithCombat(content.find((n) => n.name === name));
};

describe("npcFactions", () => {
  it("recognizes room NPCs without inheriting factions by name", () => {
    const basang = content.find((n) => n.name === "巴桑");
    const lanjie = content.find((n) => n.name === "兰姐");
    expect(getNpcFaction(basang)).toBe(FACTION.HEIFENG);
    expect(getNpcFaction(toRoomNpc(basang))).toBe(FACTION.HEIFENG);
    expect(getNpcFaction(toRoomNpc(lanjie))).toBe(FACTION.BAIHUA);
    expect(getNpcFaction({ ...basang, imported: true })).toBeNull();
    expect(getNpcFaction({ id: "custom_basang", name: "巴桑" })).toBeNull();
  });

  it("tension pairs use known factions and stay within 0-100", () => {
    const factions = new Set(Object.values(FACTION));
    for (const [key, value] of Object.entries(BASE_TENSION)) {
      for (const f of key.split("|")) expect(factions.has(f)).toBe(true);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe("tension", () => {
  it("is symmetric and falls back to base", () => {
    expect(getTension({}, FACTION.TUSI, FACTION.HEIFENG)).toBe(60);
    expect(getTension({}, FACTION.HEIFENG, FACTION.TUSI)).toBe(60);
    expect(getTension({}, FACTION.TUSI, FACTION.TUSI)).toBe(0);
  });

  it("adjusts with clamp and drops entries that return to base", () => {
    const up = adjustTension({}, FACTION.TUSI, FACTION.HEIFENG, 50);
    expect(up[tensionKey(FACTION.TUSI, FACTION.HEIFENG)]).toBe(100);
    expect(adjustTension(up, FACTION.HEIFENG, FACTION.TUSI, -40)).toEqual({});
  });

  it("decays toward base each day", () => {
    const key = tensionKey(FACTION.YUDING, FACTION.YUQUAN);
    expect(decayTension({ [key]: 10 }, 3)).toEqual({ [key]: 4 });
    expect(decayTension({ [key]: 10 }, 10)).toEqual({});
  });
});

describe("resolveNpcConflict", () => {
  it("replays a fixed 1v1 without changing participants or the gameplay RNG", () => {
    setSeed(42);
    const args = { sideA: [npc("巴桑")], sideB: [npc("格桑顿珠")], seed: 7 };
    const unchanged = structuredClone(args);
    const { log, ...result } = resolveNpcConflict(args);
    // 数值随 2026-11-28 克制链温和修正重钉：signature 状态招 40% 抗击打后，
    // 状态型角色不再出手即死，战局拖长翻盘属意内变化（专属大招有出场机会）。
    expect(result).toEqual({
      winner: "A",
      rounds: 20,
      injuries: [
        { id: "pool_resident_gesangdunzhu", name: "格桑顿珠", severity: "轻伤" },
      ],
      deaths: [],
      finalHp: { pool_resident_basang: [893, 1245], pool_resident_gesangdunzhu: [70, 1165] },
    });
    setSeed(11);
    expect(resolveNpcConflict(args)).toEqual({ ...result, log });
    expect(getRngState()).toBe(11);
    expect(args).toEqual(unchanged);
  });

  it("allows only explicitly eligible minions to die in a lethal 2v2", () => {
    setSeed(42);
    const args = { sideA: [npc("厉天行"), npc("巴桑")], sideB: [npc("血刀门徒·初七"), npc("格桑顿珠")], seed: 7 };
    const [minion, named] = args.sideB;
    const lethal = resolveNpcConflict({ ...args, lethal: "minions" });
    expect(lethal).toMatchObject({ winner: "A", rounds: 3 }); // 克制链修正后重钉（2026-11-28）
    expect(lethal.deaths).toEqual([{ id: minion.id, name: minion.name }]);
    expect(lethal.injuries).toContainEqual({ id: named.id, name: named.name, severity: "重伤" });
    const nonlethal = resolveNpcConflict(args);
    expect(nonlethal.deaths).toEqual([]);
    expect(nonlethal.injuries).toContainEqual({ id: minion.id, name: minion.name, severity: "重伤" });
  });

  it("rejects empty teams and duplicated participants", () => {
    const basang = npc("巴桑");
    expect(() => resolveNpcConflict({ sideA: [], sideB: [basang], seed: 7 })).toThrow(RangeError);
    expect(() => resolveNpcConflict({ sideA: [basang], sideB: [basang], seed: 7 })).toThrow(TypeError);
  });
});
