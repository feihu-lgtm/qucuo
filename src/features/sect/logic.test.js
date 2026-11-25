import { describe, expect, it, vi } from "vitest";
import { bindTurnRuntime } from "../../features/turnRuntime.js";
import { getTurnContext, PHASE, turnMonitor, withTurnContext } from "../../infra/turnMonitor.js";
bindTurnRuntime({ getTurnContext, PHASE, turnMonitor, withTurnContext });
import { joinSect } from "./logic.js";
import { SECT_ENTRY } from "../../domain/rules/character/sectEntry.js";
import { applyResult } from "../run.js";
import { gameActions, gameStore, initGameStore } from "../../store/gameStore.js";

const state = () => ({
  char: { money: 150, neigong: 5 }, inv: [], flags: [],
  varTree: { 角色: { [SECT_ENTRY.master]: { 好感度: 30 } }, 世界: { 势力声誉: { [SECT_ENTRY.sect]: 40 }, 威望: 0 } },
  questProgress: Object.fromEntries((SECT_ENTRY.quests || []).map(qid => [qid, { status: "completed" }])),
});

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
    // WO-16B：拜师授业好感 deterministic 硬结算（绝学档 +6）——30 入门门槛基础上 +6
    expect(tree.角色[SECT_ENTRY.master].好感度).toBe(36);
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
