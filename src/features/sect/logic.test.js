import { describe, expect, it, vi } from "vitest";
import { joinSect, leaveSect } from "./logic.js";
import { SECT_ENTRY, defectedFlag } from "../../domain/rules/character/sectEntry.js";
import { applyResult } from "../run.js";
import { gameActions, gameStore, initGameStore } from "../../store/gameStore.js";

const state = () => ({ char: { money: 150, neigong: 5 }, inv: [], flags: [], varTree: { 角色: { [SECT_ENTRY.master]: { 好感度: 30 } } } });

describe("sect logic", () => {
  it("charges tuition, grants a token and identity, marks the master known, adds +20 rep, and settles", () => {
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
    expect(tree.世界.势力声誉.雪山派).toBe(20);
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

  it("joins Qingcheng via rep >= 40 + spar trial, grants +20 rep, bamboo token and starter gear", () => {
    const s = { char: { money: 10 }, inv: [], flags: ["qingcheng_spar_first"], varTree: { 世界: { 威望: 5, 势力声誉: { 青城派: 40 } } } };
    const result = joinSect(s, "青城派");
    let tree;
    initGameStore(s);
    applyResult({ act: vi.fn(), jotNote: vi.fn(), gameActions, setVarTree: fn => { tree = fn(s.varTree); } }, result);
    expect(gameStore.getState().flags).toEqual(["qingcheng_spar_first", "青城派弟子"]);
    expect(gameStore.getState().inv.map(i => i.name)).toEqual(["青城玄门竹牌", "三清松风铁剑", "青城道袍"]);
    expect(tree.世界.势力声誉.青城派).toBe(60);
  });

  it("refuses non-joinable factions with a clear message", () => {
    expect(joinSect(state(), "鱼定土司府")).toEqual({
      logs: [{ t: "sys", text: "  鱼定土司府不设拜师堂，不占主门派名额，可通过声誉线成为客卿。" }],
    });
  });

  it("handles defect and expel by resetting rep, confiscating token, freeing sect slot and marking defected", () => {
    const s = {
      char: { money: 10 },
      inv: [{ name: "青城玄门竹牌" }, { name: "干粮" }],
      flags: ["青城派弟子"],
      varTree: { 世界: { 威望: 5, 势力声誉: { 青城派: 65 } } },
    };
    const result = leaveSect(s, "青城派");
    let tree;
    initGameStore(s);
    applyResult({ act: vi.fn(), jotNote: vi.fn(), gameActions, setVarTree: fn => { tree = fn(s.varTree); } }, result);
    expect(gameStore.getState().flags).toEqual([defectedFlag("青城派")]);
    expect(gameStore.getState().inv).toEqual([{ name: "干粮" }]);
    expect(tree.世界.势力声誉.青城派).toBe(-40);

    const expelled = leaveSect({
      char: {},
      inv: [{ name: "玄竹弟子令" }],
      flags: ["唐门弟子"],
      varTree: { 世界: { 势力声誉: { 唐门: 80 } } },
    }, "唐门", { mode: "expel" });
    let expelTree;
    initGameStore({ char: {}, inv: [{ name: "玄竹弟子令" }], flags: ["唐门弟子"], varTree: { 世界: { 势力声誉: { 唐门: 80 } } } });
    applyResult({ act: vi.fn(), jotNote: vi.fn(), gameActions, setVarTree: fn => { expelTree = fn({ 世界: { 势力声誉: { 唐门: 80 } } }); } }, expelled);
    expect(expelTree.世界.势力声誉.唐门).toBe(-70);
  });
});
