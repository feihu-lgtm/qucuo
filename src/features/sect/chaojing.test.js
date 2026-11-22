import { describe, expect, it } from "vitest";
import { chaojingStatus, doChaojing } from "./chaojing.js";
import { checkFactionEntry, FACTION_ENTRIES } from "../../domain/rules/character/factionEntry.js";

const state = (extra = {}) => ({ char: { gender: "男" }, flags: [], time: 30, ...extra });
const run = (s) => {
  const r = doChaojing(s);
  return { ...s, flags: r.changes ? r.changes.flags(s.flags) : s.flags, time: r.changes?.time ?? s.time, r };
};
const emeiReady = { 世界: { 势力声誉: { 峨眉派: 40 }, 威望: 0 } };

describe("峨眉男弟子抄经三日", () => {
  it("male players must copy sutras on three separate days before joining", () => {
    const blocked = checkFactionEntry(FACTION_ENTRIES.峨眉派, { varTree: emeiReady, flags: [], char: { gender: "男" } });
    expect(blocked.missing).toEqual(["rite"]);

    let s = run(state());
    expect(s.r.changes.time).toBe(33);
    expect(chaojingStatus(s)).toMatchObject({ count: 1, today: true, done: false });
    expect(doChaojing(s).changes).toBeUndefined();

    s = run({ ...s, time: 54 });
    s = run({ ...s, time: 78 });
    expect(chaojingStatus(s)).toMatchObject({ count: 3, done: true });
    expect(s.flags.filter((f) => f.startsWith("emei_chaojing_day_"))).toHaveLength(1);
    expect(doChaojing({ ...s, time: 200 }).changes).toBeUndefined();
    expect(checkFactionEntry(FACTION_ENTRIES.峨眉派, { varTree: emeiReady, flags: s.flags, char: s.char }).eligible).toBe(true);
  });

  it("female players and existing disciples skip the rite", () => {
    const female = { gender: "女" };
    expect(checkFactionEntry(FACTION_ENTRIES.峨眉派, { varTree: emeiReady, flags: [], char: female }).eligible).toBe(true);
    expect(doChaojing(state({ char: female })).changes).toBeUndefined();
    expect(chaojingStatus(state({ flags: ["峨眉派弟子"] })).needed).toBe(false);
    expect(checkFactionEntry(FACTION_ENTRIES.青城派, { varTree: emeiReady, flags: [], char: { gender: "男" } }).missing).not.toContain("rite");
  });
});
