import { describe, expect, it } from "vitest";
import {
  buildDuelReportRounds,
  connectorFamily,
  formatDuelDisplayLine,
  selectUnused,
} from "../duelReport.js";
import {
  CONNECTOR_FAMILIES,
  CONNECTORS,
  DUEL_EFFECT_FAMILIES,
  DUEL_HP_BANDS,
  DUEL_MOVE_TYPES,
  EFFECT_POOLS,
  MUTUAL_CONTACTS,
  OPENING_POOLS,
  REACTION_POOLS,
  STANDOFF_FRAGMENTS,
} from "./index.js";

const renderTemplate = (template) => template
  .replaceAll("{actor}", "陈尧天")
  .replaceAll("{target}", "才旦")
  .replaceAll("{move}", "野球拳")
  .replaceAll("{targetMove}", "铁布衫")
  .replace(/@round\.result\.[A-Za-z0-9_.]+/g, "麻穴");

const stripPlaceholders = (template) => template
  .replace(/\{[^}]+\}/g, "")
  .replace(/@round\.result\.[A-Za-z0-9_.]+/g, "");

function reportRound(round, typeA = "攻击", typeB = "攻击") {
  return {
    round,
    playerMove: { name: "野球拳", type: typeA },
    npcMove: { name: "铁布衫", type: typeB },
    result: {
      nameA: "陈尧天",
      nameB: "才旦",
      speedWinner: "A",
      damageToA: 0,
      damageToB: 0,
      statusDamageA: 0,
      statusDamageB: 0,
      hpRestoreA: 0,
      hpRestoreB: 0,
      dodgeSuccessA: false,
      dodgeSuccessB: false,
      interruptedA: false,
      interruptedB: false,
      cancelledA: false,
      cancelledB: false,
      reflectedA: false,
      reflectedB: false,
      counterStatus: null,
      statusAppliedToA: null,
      statusAppliedToB: null,
      markAppliedToA: null,
      markAppliedToB: null,
      statusSlotsAfterA: {},
      statusSlotsAfterB: {},
      hpAfterA: [90, 100],
      hpAfterB: [90, 100],
      hpBandA: "healthy",
      hpBandB: "healthy",
    },
  };
}

describe("duel phrase pools and composition", () => {
  it("has at least 950 unique opening, effect, and reaction fragments", () => {
    const openings = Object.values(OPENING_POOLS).flat();
    const effects = Object.values(EFFECT_POOLS).flat();
    const reactions = Object.values(REACTION_POOLS).flatMap((families) => Object.values(families).flat());

    expect(openings).toHaveLength(1071);
    expect(effects).toHaveLength(1000);
    expect(reactions).toHaveLength(960);
    for (const pool of [openings, effects, reactions]) {
      expect(pool.length).toBeGreaterThanOrEqual(950);
      const stripped = pool.map(stripPlaceholders);
      expect(new Set(stripped).size).toBe(stripped.length);
    }
  });

  it("provides a non-empty cell for every selector family and band", () => {
    for (const type of DUEL_MOVE_TYPES) expect(OPENING_POOLS[type].length).toBeGreaterThan(0);
    for (const family of DUEL_EFFECT_FAMILIES) expect(EFFECT_POOLS[family].length).toBeGreaterThan(0);
    for (const family of Object.values(REACTION_POOLS)) {
      for (const band of DUEL_HP_BANDS) expect(family[band].length).toBeGreaterThan(0);
    }
    for (const pool of Object.values(CONNECTOR_FAMILIES)) expect(pool.length).toBeGreaterThan(0);
    expect(CONNECTORS).toHaveLength(200);
    expect(MUTUAL_CONTACTS).toHaveLength(150);
    expect(STANDOFF_FRAGMENTS).toHaveLength(60);
  });

  it("uses only registered fragment placeholders", () => {
    const templates = [
      ...Object.values(OPENING_POOLS).flat(),
      ...Object.values(EFFECT_POOLS).flat(),
      ...Object.values(REACTION_POOLS).flatMap((families) => Object.values(families).flat()),
      ...CONNECTORS,
      ...MUTUAL_CONTACTS,
      ...STANDOFF_FRAGMENTS,
    ];
    const known = new Set([
      "actor", "target", "move", "targetMove",
      "round.result.statusAppliedToA", "round.result.statusAppliedToB",
      "round.result.markAppliedToA", "round.result.markAppliedToB",
      "round.result.hpRestoreA", "round.result.hpRestoreB",
      "round.result.statusDamageA", "round.result.statusDamageB",
    ]);

    for (const template of templates) {
      const placeholders = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      const refs = [...template.matchAll(/@([A-Za-z0-9_.]+)/g)].map((match) => match[1]);
      expect(placeholders.every((name) => known.has(name))).toBe(true);
      expect(refs.every((path) => known.has(path))).toBe(true);
      expect(template).not.toMatch(/[，。！？；：、]$/);
      expect(template.startsWith("，")).toBe(false);
      expect(template).not.toContain("未未");
      expect(template).not.toContain("反劲反卷");
    }
    expect(new Set(CONNECTORS).size).toBe(200);
    expect(new Set(MUTUAL_CONTACTS).size).toBe(150);
    expect(new Set(STANDOFF_FRAGMENTS).size).toBe(60);
  });

  it("has a connector for every ordered effect-family pair and composes clean clauses", () => {
    for (const first of DUEL_EFFECT_FAMILIES) {
      for (const second of DUEL_EFFECT_FAMILIES) {
        const connectorPool = CONNECTOR_FAMILIES[connectorFamily(first, second)];
        expect(connectorPool.length, `${first}/${second}`).toBeGreaterThan(0);
        const openingA = renderTemplate(OPENING_POOLS.攻击[0]);
        const effectA = renderTemplate(EFFECT_POOLS[first][0]);
        const reactionA = renderTemplate(REACTION_POOLS.damaged.healthy[0]);
        const openingB = renderTemplate(OPENING_POOLS.状态[0]);
        const effectB = renderTemplate(EFFECT_POOLS[second][0]);
        const reactionB = renderTemplate(REACTION_POOLS.controlled.hurt[0]);
        const line = `${openingA}，${effectA}，${reactionA}，${connectorPool[0]}，${openingB}，${effectB}，${reactionB}`;

        expect(line).not.toContain("，，");
        expect(line.startsWith("的")).toBe(false);
        expect(line.split("，").every((clause) => clause.trim().length > 0)).toBe(true);
        expect(line).not.toMatch(/[，。！？；：、]$/);
      }
    }
  });

  it("orders halves by speed, reflect counter, and interruption flags", () => {
    const speed = reportRound(1, "攻击", "攻击");
    speed.result.speedWinner = "B";
    expect(formatDuelDisplayLine(speed).startsWith("才旦")).toBe(true);

    const reflect = reportRound(2, "攻击", "状态");
    reflect.playerMove.name = "一剑西来";
    reflect.npcMove.doubleReflectDamage = true;
    reflect.result.speedWinner = null;
    reflect.result.counterStatus = "reflect";
    reflect.result.reflectedA = true;
    reflect.result.cancelledA = true;
    expect(formatDuelDisplayLine(reflect).startsWith("才旦")).toBe(true);

    const interrupted = reportRound(3, "攻击", "状态");
    interrupted.result.speedWinner = null;
    interrupted.result.interruptedB = true;
    expect(formatDuelDisplayLine(interrupted).startsWith("陈尧天")).toBe(true);

    const statusWins = reportRound(4, "防御", "状态");
    statusWins.result.statusAppliedToA = "麻穴";
    statusWins.result.speedWinner = null;
    expect(formatDuelDisplayLine(statusWins).startsWith("才旦")).toBe(true);

    const standoff = formatDuelDisplayLine(reportRound(5, "防御", "防御"));
    expect(STANDOFF_FRAGMENTS.some((fragment) => standoff.includes(fragment))).toBe(true);
  });

  it("attributes reflect damage to the reflected attack rather than a false status hit", () => {
    const entry = reportRound(1, "攻击", "状态");
    entry.npcMove.doubleReflectDamage = true;
    entry.result.counterStatus = "reflect";
    entry.result.reflectedA = true;
    entry.result.cancelledA = true;
    entry.result.damageToA = 8;
    const line = formatDuelDisplayLine(entry);

    expect(line).toContain("反劲");
    expect(EFFECT_POOLS.reflectCounter.some((fragment) => line.includes(fragment.replace("{target}", "陈尧天")))).toBe(true);
    expect(line).not.toMatch(/劲力[^，]*陈尧天/);
  });

  it("renders status, heal, damage, and DoT values from engine round fields", () => {
    const status = reportRound(1, "状态", "攻击");
    status.result.statusAppliedToB = "麻穴";
    status.result.statusSlotsAfterB = { 麻穴: { duration: 2 } };
    expect(formatDuelDisplayLine(status)).toContain("麻穴");
    expect(formatDuelDisplayLine(status)).toContain("\"duration\":2");

    const heal = reportRound(2, "状态", "攻击");
    heal.result.hpRestoreA = 12;
    expect(formatDuelDisplayLine(heal)).toContain("+12");

    const damage = reportRound(3, "攻击", "攻击");
    damage.result.damageToB = 9;
    expect(formatDuelDisplayLine(damage)).toContain("才旦 −9");

    const dot = reportRound(4, "状态", "攻击");
    dot.result.statusDamageA = 4;
    expect(formatDuelDisplayLine(dot)).toContain("持续伤害 4");
  });

  it("renders 2,000 deterministic rounds without empty clauses or grammar artifacts", () => {
    const scenarios = [
      { a: "攻击", b: "攻击", result: { damageToA: 5, damageToB: 4 } },
      { a: "攻击", b: "防御", result: { damageToA: 4 } },
      { a: "状态", b: "攻击", result: { interruptedA: true, damageToA: 3 } },
      { a: "状态", b: "攻击", result: { counterStatus: "control", interruptedA: true, cancelledA: true } },
      { a: "攻击", b: "状态", result: { counterStatus: "reflect", reflectedA: true, cancelledA: true, damageToA: 8 } },
      { a: "状态", b: "防御", result: { statusAppliedToB: "麻穴" } },
      { a: "状态", b: "攻击", result: { counterStatus: "control", speedWinner: "A", cancelledB: true, statusAppliedToB: "麻穴" } },
      { a: "攻击", b: "攻击", result: { statusAppliedToB: "淬毒" } },
      { a: "状态", b: "攻击", result: { hpRestoreA: 8 } },
      { a: "攻击", b: "攻击", result: { statusDamageA: 3 } },
      { a: "攻击", b: "攻击", result: { dodgeSuccessA: true } },
      { a: "防御", b: "防御", result: {} },
    ];

    for (let index = 0; index < 2000; index += 1) {
      const scenario = scenarios[index % scenarios.length];
      const entry = reportRound(index + 1, scenario.a, scenario.b);
      Object.assign(entry.result, scenario.result);
      const line = formatDuelDisplayLine(entry, { round: index + 1 });

      expect(line).not.toContain("，，");
      expect(line.startsWith("的")).toBe(false);
      expect(line.split("，").every((clause) => clause.trim().length > 0)).toBe(true);
      expect(line).not.toMatch(/\{[^}]+\}|@round\.|undefined|null|NaN/);
      expect(line).not.toContain("未未");
      expect(line).not.toContain("反劲反卷");
    }
  });

  it("never reuses an opening between fighters or rounds in one duel", () => {
    const used = new Map();
    const pool = OPENING_POOLS.攻击;
    const select = (round) => [
      selectUnused(pool, "opening:攻击", round, used),
      selectUnused(pool, "opening:攻击", round, used),
    ];
    const expected = [select("1"), select("2")];
    expect(new Set(expected.flat()).size).toBe(4);
    expect(selectUnused(pool, "opening:攻击", "1", new Map())).toBe(expected[0][0]);

    const reports = buildDuelReportRounds([reportRound(1), reportRound(2)]);
    for (const [index, round] of reports.entries()) {
      const first = expected[index][0].replaceAll("{actor}", "陈尧天").replaceAll("{move}", "野球拳");
      const second = expected[index][1].replaceAll("{actor}", "才旦").replaceAll("{move}", "铁布衫");
      expect(round.text).toContain(first);
      expect(round.text).toContain(second);
    }

    const damagedRounds = [1, 2].map((round) => {
      const entry = reportRound(round);
      entry.result.damageToB = 5;
      return entry;
    });
    const rendered = buildDuelReportRounds(damagedRounds);
    const selected = (pool, line) => pool.find((fragment) => line.includes(fragment.replaceAll("{target}", "才旦")));
    const hits = rendered.map(({ text }) => selected(EFFECT_POOLS.hit, text));
    const reactions = rendered.map(({ text }) => selected(REACTION_POOLS.damaged.healthy, text));
    expect(hits.every(Boolean)).toBe(true);
    expect(new Set(hits).size).toBe(2);
    expect(reactions.every(Boolean)).toBe(true);
    expect(new Set(reactions).size).toBe(2);

    const crossPoolUsed = new Map();
    const sharedPhrase = selectUnused(["共用片段"], "opening:攻击", 1, crossPoolUsed);
    expect(selectUnused([sharedPhrase], "effect:hit", 1, crossPoolUsed)).toBe(sharedPhrase);
  });
});
