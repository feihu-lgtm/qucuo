import { describe, expect, it, vi } from "vitest";
import { gameActions, gameStore, initGameStore } from "../store/gameStore.js";
import { applyResult } from "./run.js";

describe("applyResult", () => {
  it("routes varTree changes through the context setter", () => {
    const setVarTree = vi.fn();
    const varTree = { 世界: { 已认识人物: ["师父"] } };

    applyResult({ setVarTree }, { changes: { varTree } });

    expect(setVarTree).toHaveBeenCalledWith(varTree);
  });

  it("passes varTree updaters through to merge against the latest state", () => {
    let varTree = { 世界: { 本日移动次数: 1 } };
    const ctx = {
      setVarTree: (update) => {
        varTree = typeof update === "function" ? update(varTree) : update;
      },
    };

    applyResult(ctx, {
      changes: {
        varTree: (prev) => ({
          ...prev,
          世界: { ...prev.世界, 已认识人物: ["师父"] },
        }),
      },
    });

    expect(varTree).toEqual({
      世界: { 本日移动次数: 1, 已认识人物: ["师父"] },
    });
  });

  it("forwards feature settlement options while keeping settlement enabled", () => {
    const act = vi.fn();

    applyResult({ act }, {
      settle: "拜师父为师",
      settleOptions: { settleNpc: "师父", settleKind: "learn_skill" },
    });

    expect(act).toHaveBeenCalledWith("拜师父为师", [], {
      settleNpc: "师父",
      settleKind: "learn_skill",
      settle: true,
      keepUndo: true,
    });
  });

  it("allows a feature result to suppress its settlement turn", () => {
    const act = vi.fn();

    applyResult({ act }, {
      settle: "委托失败",
      settleOptions: { settle: false },
    });

    expect(act).toHaveBeenCalledWith("委托失败", [], { settle: false, keepUndo: true });
  });

  it("forwards square operations to the optional context port", () => {
    const applySquareOps = vi.fn();
    const squareOps = [{ op: "consume", key: "雅江", day: 0 }];

    applyResult({ applySquareOps }, { squareOps });

    expect(applySquareOps).toHaveBeenCalledWith(squareOps);
  });

  // 契约：changes 里每个键按 `set首字母大写` 分发到 gameActions，落进 gameStore。
  it.each([
    ["flags", ["flag_a"]],
    ["inv", ["铁剑"]],
    ["char", { name: "行旅", hp: 80 }],
    ["questProgress", { q1: { stage: 2 } }],
    ["room", { name: "鱼定村", npcs: [] }],
    ["time", 7],
    ["convo", [{ role: "user", content: "hi" }]],
  ])("routes changes.%s through its gameActions setter", (key, value) => {
    initGameStore({ flags: [], inv: [], char: {}, questProgress: {}, room: {}, time: 1, convo: [] });

    applyResult({ gameActions }, { changes: { [key]: value } });

    expect(gameStore.getState()[key]).toEqual(value);
  });

  // 契约：未登记的 changes 键直接抛错，不静默吞掉写不进状态的脏数据。
  it("throws on an unregistered state key", () => {
    initGameStore({});

    expect(() => applyResult({ gameActions }, { changes: { notAStateKey: 1 } }))
      .toThrow("Unknown game state key: notAStateKey");
  });

  // 契约：changes.varTree 必须走 ctx.setVarTree，没有就抛错（不能落到 gameActions.setVarTree 的隐式路径）。
  it("requires ctx.setVarTree for varTree changes", () => {
    initGameStore({});

    expect(() => applyResult({ gameActions }, { changes: { varTree: {} } }))
      .toThrow("Feature result changes.varTree requires ctx.setVarTree");
  });

  // 契约：result 为函数时直接执行（feature 自己结算），不进 changes 分发。
  it("invokes a function result directly and returns its value", () => {
    const action = vi.fn(() => 42);

    const applied = applyResult({}, action);

    expect(action).toHaveBeenCalledOnce();
    expect(applied).toBe(42);
  });

  // 契约：logs/note/fact 分别走 addLog/jotNote/setVarTree+registerFact。
  it("dispatches logs, note and fact to their context ports", () => {
    const addLog = vi.fn();
    const jotNote = vi.fn();
    const setVarTree = vi.fn();
    const logs = [{ t: "sys", text: "  一条系统提示" }];

    applyResult({ addLog, jotNote, setVarTree }, {
      logs,
      note: { text: "记下了一笔", source: "dumb" },
      fact: { key: "世界.旧账", value: "欠酒钱", currentTurn: 3 },
    });

    expect(addLog).toHaveBeenCalledWith(logs);
    expect(jotNote).toHaveBeenCalledWith({ text: "记下了一笔", source: "dumb" });
    expect(setVarTree).toHaveBeenCalledWith(expect.any(Function));
  });

  // 契约：settle 不带 ctx.act 时不调用（守 settle 的旁路回回合通道）。
  it("does not settle without ctx.act", () => {
    expect(() => applyResult({}, { settle: "拜师父为师" })).not.toThrow();
  });
});
