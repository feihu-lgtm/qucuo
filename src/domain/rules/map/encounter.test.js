import { beforeEach, describe, expect, it } from "vitest";
import { setSeed } from "../../../utils/rng.js";
import { FACTION_NAMES } from "../../data/map/factions.js";
import { getTodaysPasserNames } from "../../data/npc/randomPassers.js";
import { getNpcFaction } from "../../data/factions/npcFactions.js";
import { buildEncounterNote, factionProfile, roadNameGuard, rollEncounter } from "./encounter.js";
import { applySquareBatch, consumeArrival, resetForDay, rollSkeleton } from "./mapSquares.js";

const NODES = ["鱼定村", "鱼定土司", "喇嘛庙", "白塔", "后山平台", "雪山派", "天都镇", "大草甸", "玉泉寨", "黑风寨",
  "贡措海", "雅江", "广汉", "锦官城", "天龙营", "雾隐寨", "蜀南唐堡"];

function rollMany(node, n, opts) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const en = rollEncounter(node, 100, opts);
    if (en) out.push(en);
  }
  return out;
}

describe("路遇接 16 家势力与过路人池", () => {
  beforeEach(() => { setSeed(20261123); resetForDay(); });

  it("各据点都能遇上人，势力只出自 16 家或散人，且每人有名有姓", () => {
    const seen = new Set();
    for (const node of NODES) {
      const hits = rollMany(node, 200);
      expect(hits.length, node).toBeGreaterThan(0);
      for (const en of hits) {
        expect([...FACTION_NAMES, "散人"]).toContain(en.factionKey);
        expect(en.passer?.name).toBeTruthy();
        expect(en.passer.faction).toBe(en.factionKey);
        seen.add(en.factionKey);
      }
    }
    for (const faction of ["三星派", "天龙教", "五仙教", "唐门", "丐帮三星分舵", "青城派", "峨眉派", "欢喜教", "百花门", "黑风寨"]) {
      expect(seen.has(faction), faction).toBe(true);
    }
  });

  it("势力腹地以本家人为主", () => {
    const hits = rollMany("天龙营", 300);
    const own = hits.filter((en) => en.factionKey === "天龙教").length;
    expect(own / hits.length).toBeGreaterThan(0.6);
  });

  it("每家都有身份池与口吻", () => {
    for (const faction of [...FACTION_NAMES, "散人"]) {
      const profile = factionProfile(faction);
      expect(profile.roamers, faction).toBeTruthy();
      expect(profile.flavor, faction).toBeTruthy();
    }
  });

  it("名字避开认识的人、角色表和今天的过路人", () => {
    const varTree = { 世界: { 已认识人物: ["甲"] }, 角色: { 乙: {} } };
    const guard = roadNameGuard({ varTree, time: 30, extraNames: ["丙"] });
    expect(guard("甲") && guard("乙") && guard("丙")).toBe(true);
    const todays = getTodaysPasserNames(30);
    expect(todays.size).toBeGreaterThan(0);
    for (const name of todays) expect(guard(name)).toBe(true);
    const before = new Set([...todays, "甲", "乙", "丙"]);
    for (const en of rollMany("大草甸", 200, { isTaken: guard })) {
      expect(before.has(en.passer.name)).toBe(false);
      expect(guard(en.passer.name)).toBe(true); // 用过即占
    }
  });

  it("同一个守卫连掷不重名，熟人逼出的重抽名也避开", () => {
    const known = new Set();
    for (let t = 0; t < 24 * 20; t += 24) for (const name of getTodaysPasserNames(t)) if (known.size < 40) known.add(name);
    const varTree = { 世界: { 已认识人物: [...known] } };
    const guard = roadNameGuard({ varTree, time: 0 });
    for (const name of getTodaysPasserNames(0, known)) expect(guard(name)).toBe(true);
    const names = rollMany("大草甸", 300, { isTaken: guard }).map((en) => en.passer?.name).filter(Boolean);
    expect(new Set(names).size).toBe(names.length);
  });

  it("提示块把系统定的名字交给 AI 照抄", () => {
    const en = rollMany("雅江", 50)[0];
    const note = buildEncounterNote(en, "雅江");
    expect(note).toContain(`"name":"${en.passer.name}"`);
    expect(note).toContain(en.faction.label);
  });

  it("预跑格子用系统定的名字和势力，到达后冲突系统认得其势力", () => {
    let sk = null;
    for (let i = 0; i < 200 && !sk?.encounter; i++) sk = rollSkeleton("天龙营", 100);
    const { passer, factionKey } = sk.encounter;
    applySquareBatch(0, [{ name: "天龙营", desc: "营寨。", encounterName: "AI乱起的名", encounterLine: "擦肩而过。" }], { 天龙营: sk });
    const { encounter } = consumeArrival("天龙营", 0);
    expect(encounter.name).toBe(passer.name);
    expect(encounter.faction).toBe(factionKey);
    const expected = factionKey === "散人" ? null : factionKey;
    expect(getNpcFaction({ name: encounter.name, faction: encounter.faction, roadPasser: true })).toBe(expected);
  });
});
