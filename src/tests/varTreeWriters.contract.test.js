// varTree 六个写入器的契约测试——写入已收口 applyPatches，此处把旧 API
// 适配成「生成器 → applyPatches/commitPatches」，断言现状行为不变。
// 每个 it 注释第一行就是该行为契约；只断言现状，不改实现。

import { describe, expect, it } from "vitest";
import { applyWrite, set, add } from "../domain/rules/state/applyWrite.js";
import { applyPatches, commitPatches } from "../domain/rules/state/applyPatches.js";
import { applyMvuCommands } from "../domain/rules/prompt/mvu.js";
import { ledgerToPatches, LEDGER_LINE_MAX, LEDGER_MAX_LINES } from "../domain/rules/memory/npcLedger.js";
import { bookkeepToPatches } from "../domain/rules/memory/bookkeep.js";
import { stageRewardPatches } from "../domain/rules/quests/questRewards.js";

const applyLedgerUpdate = (tree, name, lines, turn) =>
  applyPatches({ varTree: tree }, ledgerToPatches(tree, name, lines, turn)).state.varTree;
const applyBookkeep = (tree, result, turn) =>
  applyPatches({ varTree: tree }, bookkeepToPatches(tree, result, turn)).state.varTree;
const applyStageRewards = (rewards, setters, now) =>
  commitPatches(setters, stageRewardPatches(rewards, now));

const tree = (chars = {}, world = {}) => ({ 角色: chars, 世界: world });
const state = (varTree) => ({ varTree });

describe("applyWrite：单条指令 → {state, finalValue, actualDelta, log, logs} 或 {state, reason}", () => {
  it("set/add 写已声明字段，返回新 state、finalValue 与该指令的等价 patch 形态", () => {
    // 契约：等价 patch = { path, finalValue }；调用方只需按 path 写 finalValue 即等价。
    const s0 = state(tree({ 侠客: { 好感度: 60 } }));
    const r = applyWrite(s0, set("角色.侠客.好感度", 80));
    expect(r.reason).toBeUndefined();
    expect(r.state.varTree.角色.侠客.好感度).toBe(80);
    expect(r.finalValue).toBe(80);
    expect(r.log).toBe("varTree.角色.侠客.好感度→80");
    const a = applyWrite(s0, add("世界.威望", 5));
    expect(a.finalValue).toBeDefined();
    expect(a.actualDelta).toBe(5);
    expect(a.log).toMatch(/世界\.威望\+5→/);
  });

  it("数值越界按字段边界 clamp，finalValue 是 clamp 后的值", () => {
    // 契约：好感度 clamp 到字段声明区间（0~100）。
    const s0 = state(tree({ 侠客: { 好感度: 98 } }));
    expect(applyWrite(s0, set("角色.侠客.好感度", 150)).finalValue).toBe(100);
    expect(applyWrite(s0, add("世界.威望", 999)).finalValue).toBeLessThanOrEqual(100);
  });

  it("add 在目标缺失时以字段默认值（或 options.defaultValue）为底", () => {
    // 契约：add 缺 base 时用 defaultValue ?? field.default ?? 0。
    const s0 = state(tree({}));
    const r = applyWrite(s0, add("角色.侠客.好感度", 3), { defaultValue: 10 });
    expect(r.state.varTree.角色.侠客.好感度).toBe(13);
    expect(applyWrite(s0, add("世界.威望", 2)).state.varTree.世界.威望).toBeDefined();
  });

  it("拒绝：空路径、危险键、未声明字段、未知动词、非数字 add", () => {
    // 契约：拒绝形态 = { state(原样), reason: 字符串 }，不产出写入。
    const s0 = state(tree({}));
    expect(applyWrite(s0, set("", 1)).reason).toBeDefined();
    expect(applyWrite(s0, set("角色.x.__proto__", 1)).reason).toContain("无效路径");
    // 「角色.**」有通配字段声明所以不收任何子路径——未声明路径要用真正的未知根。
    expect(applyWrite(s0, set("meta.deep.x", 1)).reason).toContain("字段未声明或不可写");
    expect(applyWrite(s0, { op: "del", path: "角色.x.好感度", value: 1 }).reason).toContain("不支持的写入动词");
    expect(applyWrite(s0, add("世界.威望", "五")).reason).toContain("必须是数字");
    // 拒绝时 state 是同一个引用（未动）
    expect(applyWrite(s0, set("", 1)).state).toBe(s0);
  });

  it("mvu 来源追加白名单校验：根必须 角色/世界/主角，保护路径拒绝", () => {
    // 契约：source:"mvu" 时走额外门禁；普通调用不走。
    const s0 = state(tree({}));
    expect(applyWrite(s0, set("meta.x", 1), { source: "mvu" }).reason).toContain("白名单");
    expect(applyWrite(s0, set("世界.旁白.进度", 1), { source: "mvu" }).reason).toBeDefined();
    // 同一路径非 mvu 来源仍可能因"未声明字段"被拒，但理由不同——这里只看 mvu 门禁生效
    expect(applyWrite(s0, set("角色.x.好感度", 1), { source: "mvu" }).reason).toBeUndefined();
  });

  it("不可变：返回新对象，输入 state/varTree 不被改写", () => {
    const vt = tree({ 侠客: { 好感度: 60 } });
    const s0 = state(vt);
    const r = applyWrite(s0, set("角色.侠客.好感度", 80));
    expect(s0.varTree.角色.侠客.好感度).toBe(60);
    expect(r.state.varTree).not.toBe(vt);
  });

  it("数组字段（flags 式）经 set 整体替换；hp 必须是两元数组", () => {
    const s0 = { flags: ["a"], varTree: tree({}), char: { hp: [9, 40] } };
    expect(applyWrite(s0, set("flags", ["b"])).state.flags).toEqual(["b"]);
    expect(applyWrite(s0, set("char.hp", 40)).reason).toBeDefined();
    expect(applyWrite(s0, set("char.hp", [1, 2, 3])).reason).toContain("两个有限数字");
  });
});

describe("applyMvuCommands：指令队列 → {tree, applied, rejected, logs}", () => {
  it("顺序应用；拒绝的进 rejected 带 reason，通过的进 applied 带 finalValue/actualDelta", () => {
    // 契约：等价 patch 集 = applied[] 中每条 {path, finalValue}。
    const { tree: t, applied, rejected } = applyMvuCommands(tree({ 侠客: { 好感度: 60 } }), [
      add("角色.侠客.好感度", 5),
      set("主角.别名", "青衣"),
      set("不合法根.x", 1),
    ]);
    expect(t.角色.侠客.好感度).toBe(65);
    expect(t.主角.别名).toBe("青衣");
    expect(applied).toHaveLength(2);
    expect(applied[0].finalValue).toBe(65);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeDefined();
  });

  it("输入 varTree 深拷贝后操作：原对象不被改写", () => {
    const vt = tree({ 侠客: { 好感度: 60 } });
    applyMvuCommands(vt, [add("角色.侠客.好感度", 5)]);
    expect(vt.角色.侠客.好感度).toBe(60);
  });

  it("非幂等：同一 add 指令传两次就加两次；set 则幂等", () => {
    // 契约：调用方若要幂等必须自己保证指令不重放。
    const vt = tree({ 侠客: { 好感度: 60 } }, { 威望: 0 });
    expect(applyMvuCommands(vt, [add("世界.威望", 5), add("世界.威望", 5)]).tree.世界.威望).toBe(10);
    expect(applyMvuCommands(vt, [set("角色.侠客.好感度", 64), set("角色.侠客.好感度", 64)]).tree.角色.侠客.好感度).toBe(64);
  });

  it("普通叙事回合的好感度增量以回合开始值为基准合计限幅，不按条累加", () => {
    // 契约：同一调用 = 同一回合，多条好感 add 合计不超 ±perTurn(5)。
    const vt = tree({ 侠客: { 好感度: 60 } });
    const { tree: t, rejected } = applyMvuCommands(vt, [add("角色.侠客.好感度", 5), add("角色.侠客.好感度", 5)]);
    expect(t.角色.侠客.好感度).toBe(65);
    expect(rejected).toHaveLength(1);
  });

  it("好感度正增量受当日上限制约，跨回合共享同一本日账", () => {
    // 契约：世界.好感日增 账本跨调用累计，当日涨满 daily(12) 后截断。
    const vt = tree({ 侠客: { 好感度: 80 } }, { 好感日增: { dayStamp: 1, gained: { 侠客: 10 } } });
    const { tree: t, applied } = applyMvuCommands(vt, [add("角色.侠客.好感度", 5)], { time: 25 });
    expect(t.世界.好感日增.dayStamp).toBe(1);
    expect(applied[0].actualDelta).toBe(2); // 当日只剩 2 点
    expect(t.世界.好感日增.gained.侠客).toBe(12);
  });
});

describe("ledgerToPatches+applyPatches：往 角色.<名>.旧账 追加新账", () => {
  it("等价 patch：set(角色.<名>.旧账, {lines, updatedTurn})；去重/去空/截 40 字/只留最新 5 条", () => {
    const t = applyLedgerUpdate(tree(), "侠客", ["  欠少侠一顿酒  ", "x".repeat(50), "欠少侠一顿酒"], 7);
    expect(t.角色.侠客.旧账).toEqual({ lines: ["欠少侠一顿酒", "x".repeat(LEDGER_LINE_MAX)], updatedTurn: 7 });
  });

  it("超过上限按 FIFO 滚出最旧条目，保留最新 LEDGER_MAX_LINES 条", () => {
    let t = applyLedgerUpdate(tree(), "侠客", ["a", "b", "c", "d"], 1);
    t = applyLedgerUpdate(t, "侠客", ["e", "f"], 2);
    expect(t.角色.侠客.旧账.lines).toEqual(["b", "c", "d", "e", "f"]);
    expect(t.角色.侠客.旧账.lines).toHaveLength(LEDGER_MAX_LINES);
  });

  it("空 newLines 仍写账本并刷新 updatedTurn（现状怪癖：无新账也更新时间戳）", () => {
    // 契约：newLines=[] → lines 不变但 updatedTurn 被刷新——「能退化成纯 patch」也含这条。
    const t = applyLedgerUpdate(tree({ 侠客: { 旧账: { lines: ["a"], updatedTurn: 1 } } }), "侠客", [], 9);
    expect(t.角色.侠客.旧账).toEqual({ lines: ["a"], updatedTurn: 9 });
  });

  it("非数组/坏输入容错；不改原 varTree", () => {
    const vt = tree({ 侠客: { 旧账: { lines: ["a"], updatedTurn: 1 } } });
    const t = applyLedgerUpdate(vt, "侠客", null, 2);
    expect(vt.角色.侠客.旧账.updatedTurn).toBe(1);
    expect(t).not.toBe(vt);
    expect(applyLedgerUpdate(undefined, "侠客", ["a"], 2).角色.侠客.旧账.lines).toEqual(["a"]);
  });
});

describe("bookkeepToPatches+applyPatches：记账结果 → 各人物旧账追加", () => {
  it("只消费 result.ledger；memory 不落库；每人等价一条 applyLedgerUpdate", () => {
    const t = applyBookkeep(tree({}), {
      memory: "这句不该出现在 varTree",
      ledger: { 侠客: ["认了少侠这个朋友"], 路人: ["见过一面"] },
    }, 12);
    expect(t.角色.侠客.旧账).toEqual({ lines: ["认了少侠这个朋友"], updatedTurn: 12 });
    expect(t.角色.路人.旧账.lines).toEqual(["见过一面"]);
    expect(JSON.stringify(t)).not.toContain("这句不该出现在 varTree");
  });

  it("result 缺失/空/无 ledger 时原样返回（含 null）", () => {
    const vt = tree({ 侠客: { 旧账: { lines: ["a"], updatedTurn: 1 } } });
    expect(applyBookkeep(vt, null, 2)).toBe(vt);
    expect(applyBookkeep(vt, { memory: "x" }, 2)).toBe(vt);
    expect(applyBookkeep(undefined, { ledger: { a: ["l"] } }, 2).角色.a.旧账.lines).toEqual(["l"]);
  });
});

describe("stageRewardPatches+commitPatches：任务 stage 奖励 → setInv/setChar/setVarTree/setFlags", () => {
  function harness(base) {
    const s = { ...base };
    const calls = {};
    const setters = {};
    for (const k of ["setInv", "setChar", "setVarTree", "setFlags"]) {
      const path = k[3].toLowerCase() + k.slice(4);
      setters[k] = (updater) => { calls[k] = (calls[k] || 0) + 1; s[path] = typeof updater === "function" ? updater(s[path]) : updater; };
    }
    return { s, setters, calls };
  }
  const base = () => ({ inv: ["药丸"], char: { money: 30 }, varTree: tree({}), flags: ["old"] });

  it("items：追加 {...,id:quest_reward_<now>_<i>,equipped:false}", () => {
    const { s, setters } = harness(base());
    applyStageRewards({ items: [{ name: "玉佩" }, { id: "fixed", name: "令牌" }], favorability: {}, favorabilitySet: {} }, setters, 25);
    expect(s.inv.map(i => i.name || i)).toEqual(["药丸", "玉佩", "令牌"]);
    expect(s.inv[1]).toMatchObject({ id: "quest_reward_25_0", equipped: false });
    expect(s.inv[2].id).toBe("fixed");
  });

  it("现状怪癖：rewards 缺 favorability/favorabilitySet 键时直接 TypeError（须走 mergeRewardParts 全形态）", () => {
    // 契约：stageRewardPatches 不是防御式的——它假定输入来自 resolveStageRewards/mergeRewardParts，
    // 裸传 { items:[...] } 会在 favorability 条目化时抛 TypeError（生成期抛，无半提交）。
    const { setters } = harness(base());
    expect(() => applyStageRewards({ items: [{ name: "玉佩" }] }, setters)).toThrow(TypeError);
  });

  it("money 走 add(char.money)，等价 patch = char.money+=N", () => {
    const { s, setters } = harness(base());
    applyStageRewards({ money: -7, favorability: {}, favorabilitySet: {} }, setters);
    expect(s.char.money).toBe(23);
  });

  it("favorability 相对增减（缺档默认 10 起、clamp 0~100）；favorabilitySet 绝对赋值", () => {
    const { s, setters } = harness(base());
    applyStageRewards({ favorability: { 侠客: 3 }, favorabilitySet: { 师父: 0 }, items: [] }, setters);
    expect(s.varTree.角色.侠客.好感度).toBe(13);
    expect(s.varTree.角色.师父.好感度).toBe(0);
    const { s: s2, setters: st2 } = harness({ ...base(), varTree: tree({ 侠客: { 好感度: 99 } }) });
    applyStageRewards({ favorability: { 侠客: 50 }, favorabilitySet: {} }, st2);
    expect(s2.varTree.角色.侠客.好感度).toBe(100);
  });

  it("reputation → 世界.威望 按原值增减（不吃 AI 单次限幅，clamp -100~100）；flags → 并集去重", () => {
    const { s, setters } = harness(base());
    applyStageRewards({ reputation: 50, flags: ["new", "old", "new"], favorability: {}, favorabilitySet: {} }, setters);
    expect(s.varTree.世界.威望).toBe(50);
    expect(s.flags).toEqual(["old", "new"]);
  });

  it("rewards 为 null 时不调任何 setter（全形态空对象等价不动作）", () => {
    const { setters, calls } = harness(base());
    applyStageRewards(null, setters);
    applyStageRewards({ items: [], favorability: {}, favorabilitySet: {}, flags: [] }, setters);
    expect(calls).toEqual({});
  });
});
