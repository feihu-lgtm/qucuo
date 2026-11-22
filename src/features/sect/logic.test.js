import { describe, expect, it, vi } from "vitest";
import { joinSect } from "./logic.js";
import { SECT_ENTRY } from "../../domain/rules/character/sectEntry.js";
import { applyResult } from "../run.js";
import { gameActions, gameStore, initGameStore } from "../../store/gameStore.js";

const state = () => ({ char: { money: 150, neigong: 5 }, inv: [], flags: [], varTree: { 角色: { [SECT_ENTRY.master]: { 好感度: 30 } } } });

describe("sect logic", () => {
  it("charges tuition, grants a token and identity, marks the master known, and settles", () => {
    const s = state();
    const before = structuredClone(s);
    const result = joinSect(s);
    const act = vi.fn();
    const jotNote = vi.fn();
    let tree;
    initGameStore(s);
    applyResult({ act, jotNote, gameActions, setVarTree: fn => { tree = fn(s.varTree); } }, result);
    expect(gameStore.getState()).toMatchObject({ char: { money: 50, neigong: 5 }, flags: [SECT_ENTRY.flag] });
    expect(gameStore.getState().inv).toEqual([result.logs[1].item]);
    expect(result.logs[1].item).toMatchObject({ name: SECT_ENTRY.keyName, quality: "绿", category: "misc" });
    expect(tree.世界.已认识人物).toContain(SECT_ENTRY.master);
    expect(tree.角色[SECT_ENTRY.master].好感度).toBe(30);
    expect(result.logs.map(l => l.t)).toEqual(["sys", "loot"]);
    expect(jotNote).toHaveBeenCalledWith(result.note);
    expect(act).toHaveBeenCalledWith(result.settle, [], {
      settle: true, settleNpc: SECT_ENTRY.master, settleKind: "learn_skill", keepUndo: true,
      learnInfo: { isMaster: true, moveBrief: "雪山派门规与弟子身份", totalPrice: SECT_ENTRY.tuition, beast: false },
    });
    expect(s).toEqual(before);
  });

  it.each(["affection", "neigong", "money", "already", "empty"])("refuses %s without side effects", reason => {
    const s = state();
    if (reason === "affection") s.varTree.角色[SECT_ENTRY.master].好感度 = 29;
    if (reason === "neigong") s.char.neigong = 4;
    if (reason === "money") s.char.money = 99;
    if (reason === "already") s.flags = [SECT_ENTRY.flag];
    if (reason === "empty") { s.varTree = {}; s.char = {}; }
    expect(joinSect(s)).toEqual({ logs: [{ t: "sys", text: "  你还不够格拜入雪山派。" }] });
  });
});

// ── 天龙教点将台：声誉+内功门槛，拜入发玄铁弟子令并按合稿 +20 天龙教声誉 ──
import { SECT_ENTRIES } from "../../domain/rules/character/sectEntry.js";

const TIANLONG_BUILDING = { id: "sect_entry_tianlong", sect: "天龙教" };
const tianlongState = (rep = 40, neigong = 15) => ({
  char: { money: 200, neigong }, inv: [], flags: [],
  varTree: { 世界: { 势力声誉: { 天龙教: rep } }, 角色: {} },
});

describe("tianlong sect entry", () => {
  it("rep 与内功达标：发天龙教弟子 flag + 令牌 + 声誉 +20", () => {
    const s = tianlongState();
    const result = joinSect(s, TIANLONG_BUILDING);
    expect(result.changes.flags([])).toEqual([SECT_ENTRIES.天龙教.flag]);
    const tree = result.changes.varTree(s.varTree);
    expect(tree.世界.势力声誉.天龙教).toBe(60);
    expect(tree.世界.已认识人物).toContain("石重岳");
    expect(result.logs[1].item).toMatchObject({ name: "天龙弟子令" });
    expect(result.settleOptions.settleNpc).toBe("石重岳");
  });

  it.each([["rep不足", () => tianlongState(39)], ["内功不足", () => tianlongState(40, 14)], ["已是弟子", () => ({ ...tianlongState(), flags: ["天龙教弟子"] })]])(
    "拒绝拜入：%s", (_label, makeState) => {
      const s = makeState();
      expect(joinSect(s, TIANLONG_BUILDING).logs[0].text).toMatch(/不够格拜入天龙教/);
    },
  );
});
