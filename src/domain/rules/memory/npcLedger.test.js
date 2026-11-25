import { describe, expect, it } from "vitest";
import {
  getLedger, ledgerToPatches, LEDGER_MAX_LINES, LEDGER_LINE_MAX,
  HEART_LEDGER_TAGS, normalizeLedgerEntries, createHeartLedgerEntry,
  heartLedgerToPatches, groupHeartLedgerByTag,
} from "./npcLedger.js";
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

describe("WO-21A 心账兼容层（normalizeLedgerEntries 与五类写校验）", () => {
  it("旧值映射 谊→恩、隙→怨、和→见，保留无 chunkId 旧账与未知旧类目不崩", () => {
    const entries = normalizeLedgerEntries([
      { turn: 3, kind: "谊", reason: "替他解围", witnesses: ["主角", "才旦"] },
      { turn: 4, kind: "隙", reason: "出手伤人" },
      { turn: 5, kind: "和", reason: "赔罪言和" },
      { turn: 6, kind: "旧怪谈", reason: "早期手写类目" },
      { id: "h5", tag: "诺", summary: "答应帮他找羊", chunkId: "b1_7_2", turn: 7, place: "大草甸" },
      null,
      123,
    ]);
    expect(entries.map((e) => [e.tag, e.isKnownTag, e.legacyTag, e.chunkId, e.summary])).toEqual([
      ["恩", true, "谊", null, "替他解围"],
      ["怨", true, "隙", null, "出手伤人"],
      ["见", true, "和", null, "赔罪言和"],
      ["旧怪谈", false, null, null, "早期手写类目"],
      ["诺", true, null, "b1_7_2", "答应帮他找羊"],
    ]);
    expect(entries[4]).toMatchObject({ id: "h5", tag: "诺", summary: "答应帮他找羊", chunkId: "b1_7_2", turn: 7, place: "大草甸" });

    const grouped = groupHeartLedgerByTag(entries);
    expect(Object.keys(grouped.groups)).toEqual([...HEART_LEDGER_TAGS]);
    expect(grouped.groups.恩).toHaveLength(1);
    expect(grouped.groups.怨).toHaveLength(1);
    expect(grouped.groups.见).toHaveLength(1);
    expect(grouped.groups.诺).toHaveLength(1);
    expect(grouped.unknown).toHaveLength(1);
  });

  it("新写口只允许 恩/怨/欠/诺/见 五类，拒绝旧类目（谊/隙/和）与未知类目", () => {
    for (const badTag of ["谊", "隙", "和", "未知", "", null]) {
      expect(createHeartLedgerEntry({ tag: badTag, summary: "测试" })).toBeNull();
      expect(heartLedgerToPatches({ 角色: {} }, "才旦", { tag: badTag, summary: "测试" })).toEqual([]);
    }
    const okPatch = heartLedgerToPatches({ 角色: {} }, "才旦", {
      tag: "欠", summary: "借了一柄猎刀", chunkId: "b1_8_1", turn: 8, place: "鱼定村",
    });
    expect(okPatch).toHaveLength(1);
    const next = applyPatches({ varTree: { 角色: {} } }, okPatch).state.varTree;
    expect(next.角色.才旦.心账).toHaveLength(1);
    expect(next.角色.才旦.心账[0]).toMatchObject({
      tag: "欠", summary: "借了一柄猎刀", chunkId: "b1_8_1", turn: 8, place: "鱼定村",
    });
  });
});

describe("normalizeLedgerEntries witnesses 透传", () => {
  it("对象条目 witnesses 数组保留，缺省/非数组归空", () => {
    const out = normalizeLedgerEntries([
      { kind: "谊", reason: "赠礼", turn: 3, witnesses: ["主角", "张三"] },
      { kind: "恩", reason: "无见证" },
      { kind: "隙", reason: "坏witnesses", witnesses: "主角" },
    ]);
    expect(out[0].witnesses).toEqual(["主角", "张三"]);
    expect(out[1].witnesses).toEqual([]);
    expect(out[2].witnesses).toEqual([]);
  });
});
