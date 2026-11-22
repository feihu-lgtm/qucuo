import { describe, expect, it } from "vitest";
import { getLedger, ledgerToPatches, LEDGER_MAX_LINES, LEDGER_LINE_MAX } from "./npcLedger.js";
import { applyPatches } from "../state/applyPatches.js";

const applyLedgerUpdate = (tree, name, lines, turn) =>
  applyPatches({ varTree: tree }, ledgerToPatches(tree, name, lines, turn)).state.varTree;

describe("npcLedger 人物旧账", () => {
  it("旧存档没有旧账字段也能读（空账本）", () => {
    expect(getLedger({ 角色: { 才旦: { 好感度: 30 } } }, "才旦"))
      .toEqual({ lines: [], updatedTurn: 0 });
    expect(getLedger({}, "才旦")).toEqual({ lines: [], updatedTurn: 0 });
    expect(getLedger(null, "才旦")).toEqual({ lines: [], updatedTurn: 0 });
  });

  it("追加新账并写回合数，旧 NPC 其他字段不动", () => {
    const tree = { 角色: { 才旦: { 好感度: 30 } }, 世界: { 日总结: [] } };
    const next = applyLedgerUpdate(tree, "才旦", ["少侠替才旦寻回猎刀"], 12);
    expect(getLedger(next, "才旦")).toEqual({ lines: ["少侠替才旦寻回猎刀"], updatedTurn: 12 });
    expect(next.角色.才旦.好感度).toBe(30);
    expect(next.世界).toBe(tree.世界);
    // 原树不被改
    expect(tree.角色.才旦.旧账).toBeUndefined();
  });

  it("去空、去重、每条截到 40 字", () => {
    const long = "一".repeat(LEDGER_LINE_MAX + 10);
    const next = applyLedgerUpdate({ 角色: {} }, "才旦", ["", "  ", "少侠欠才旦一个人情", "少侠欠才旦一个人情", long], 5);
    expect(getLedger(next, "才旦").lines).toEqual([
      "少侠欠才旦一个人情",
      long.slice(0, LEDGER_LINE_MAX),
    ]);
  });

  it("账满 5 条后最旧的先滚", () => {
    let tree = { 角色: {} };
    tree = applyLedgerUpdate(tree, "才旦", ["账一", "账二", "账三", "账四", "账五"], 10);
    tree = applyLedgerUpdate(tree, "才旦", ["账六"], 11);
    const { lines } = getLedger(tree, "才旦");
    expect(lines).toHaveLength(LEDGER_MAX_LINES);
    expect(lines[0]).toBe("账二");
    expect(lines[4]).toBe("账六");
  });

  it("读到的脏数据（非对象/非数组）不炸", () => {
    expect(getLedger({ 角色: { 才旦: { 旧账: "烂账" } } }, "才旦").lines).toEqual([]);
    expect(getLedger({ 角色: { 才旦: { 旧账: { lines: "不是数组", updatedTurn: "x" } } } }, "才旦"))
      .toEqual({ lines: [], updatedTurn: 0 });
  });
});
