// WO-16D PR-D1 影子对账测试
import { describe, expect, it, beforeEach } from "vitest";
import { resolveShadowJudgeEnabled, runShadowJudge, shadowAggregates, _resetShadowAggregates } from "./shadowJudge.js";
import { diffSnapshots } from "./shadowDiff.js";
import { compareCategories } from "./shadowCompare.js";
import { projectFacts } from "./shadowTaxonomy.js";
import { INTIMATE_TICKET_NAME } from "../../../domain/rules/npc/goldenEgg.js";
import { vi } from "vitest";
import { judgeTurn } from "../../../domain/rules/judge/judgeTurn.js";

vi.mock("../../../domain/rules/judge/judgeTurn.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, judgeTurn: vi.fn(actual.judgeTurn) };
});

const cfg = (over = {}) => ({ extractionEnabled: false, shadowJudgeEnabled: true, ...over });

describe("开关派生", () => {
  it("显式存储值优先：true/false 都按存储", () => {
    expect(resolveShadowJudgeEnabled({ shadowJudgeEnabled: true })).toBe(true);
    expect(resolveShadowJudgeEnabled({ shadowJudgeEnabled: false })).toBe(false);
  });
  it("未显式设置时按环境派生：dev 开、test/production 关（vitest MODE=test 即关）", () => {
    expect(resolveShadowJudgeEnabled({})).toBe(false); // vitest MODE=test
    expect(resolveShadowJudgeEnabled(null)).toBe(false);
  });
});

describe("diff 归因排除", () => {
  const pre = {
    inv: [{ id: "a", name: "羊肉" }], flags: [],
    varTree: { 角色: { 甲: { 好感度: 10 } } }, room: { npcs: [] },
  };
  it("模型写纳入：物品增减/旗标/好感差", () => {
    const post = {
      inv: [{ id: "a", name: "羊肉" }, { id: "b", name: "牛肉干" }], flags: ["q1"],
      varTree: { 角色: { 甲: { 好感度: 15 } } }, room: { npcs: [] },
    };
    const { categories } = diffSnapshots(pre, post);
    expect(categories.inv.add).toEqual(["b"]);
    expect(categories.flags.add).toEqual(["q1"]);
    expect(categories.affection).toEqual({ 甲: 5 });
  });
  it("首识播种排除：pre 不存在的 npc 好感基线不进 diff", () => {
    const post = { ...pre, varTree: { 角色: { 甲: { 好感度: 10 }, 乙: { 好感度: 10 } } } };
    expect(diffSnapshots(pre, post).categories.affection).toEqual({});
  });
  it("焚卡消费排除：女眷一次卡 rm 不计入", () => {
    const preT = { ...pre, inv: [...pre.inv, { id: "t1", name: INTIMATE_TICKET_NAME }] };
    const { categories } = diffSnapshots(preT, pre);
    expect(categories.inv.rm).toEqual([]);
  });
  it("room.npcs 恒 excluded（系统改写链不可归因），时间/移动不在类目字段", () => {
    const post = { ...pre, room: { npcs: [{ name: "丙" }] } };
    const r = diffSnapshots(pre, post, { moved: true });
    expect(r.excluded).toContain("npcs");
    expect(r.categories.npcs.add).toEqual([]);
  });
});

describe("compare 判定", () => {
  const base = (d, p, excluded = []) => compareCategories({ categories: d, excluded }, p);
  it("一致：双空与同内容都 match 无 gap", () => {
    const d = { inv: { add: ["b"], rm: [] }, flags: { add: [] }, affection: {}, npcs: { add: [], rm: [] } };
    expect(base(d, { ...d, flags: { add: [] } }).hasGap).toBe(false);
  });
  it("single_only：diff 有 facts 无（判官漏判）", () => {
    const d = { inv: { add: ["b"], rm: [] }, flags: { add: [] }, affection: {}, npcs: { add: [], rm: [] } };
    const p = { inv: { add: [], rm: [] }, flags: { add: [] }, affection: {}, npcs: { add: [], rm: [] } };
    const r = base(d, p);
    expect(r.verdicts.inv.verdict).toBe("single_only");
    expect(r.hasGap).toBe(true);
  });
  it("judge_only：facts 有 diff 无（判官会判单调用没落）", () => {
    const d = { inv: { add: [], rm: [] }, flags: { add: [] }, affection: {}, npcs: { add: [], rm: [] } };
    const p = { inv: { add: ["b"], rm: [] }, flags: { add: [] }, affection: {}, npcs: { add: [], rm: [] } };
    const r = base(d, p);
    expect(r.verdicts.inv.verdict).toBe("judge_only");
    expect(r.judgeExtra).toBe(true);
    expect(r.hasGap).toBe(false);
  });
  it("excluded 类目不参与 gap", () => {
    const d = { inv: { add: ["b"], rm: [] }, flags: { add: [] }, affection: {}, npcs: { add: ["x"], rm: [] } };
    const p = { inv: { add: ["b"], rm: [] }, flags: { add: [] }, affection: {}, npcs: { add: [], rm: [] } };
    expect(base(d, p, ["npcs"]).hasGap).toBe(false);
  });
});

describe("projectFacts 投影", () => {
  it("GRANT_ITEM/MUTATE_SOCIAL/ADVANCE_QUEST 落对应类目，conditional 不计", () => {
    const proj = projectFacts([
      { op: "GRANT_ITEM", itemName: "羊肉", to: "player" },
      { op: "MUTATE_SOCIAL", npc: "甲", delta: 3 },
      { op: "ADVANCE_QUEST", flag: "q1" },
      { op: "GRANT_ITEM", itemName: "券物", conditional: true },
    ]);
    expect(proj.inv.add).toEqual(["羊肉"]);
    expect(proj.affection).toEqual({ 甲: 3 });
    // 判官真实字段是 affectionDelta 不是 delta
    expect(projectFacts([{ op: "MUTATE_SOCIAL", npc: "乙", affectionDelta: 5 }]).affection).toEqual({ 乙: 5 });
    expect(proj.flags.add).toEqual(["q1"]);
  });
});

describe("影子 rng 隔离", () => {
  it("影子判定不推进游戏共享随机流", async () => {
    const { getRngState } = await import("../../../utils/rng.js");
    const before = getRngState();
    const base = {
      cmd: "测试", apiCfg: { extractionEnabled: false, shadowJudgeEnabled: true },
      preState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "x" }, char: {}, turn: 1 },
      postState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "x" }, turn: 1 },
      ai: { chat: async () => ({ text: "{}" }) },
    };
    await runShadowJudge(base);
    expect(getRngState()).toBe(before);
  });
});

describe("runShadowJudge 执行器门禁", () => {
  beforeEach(() => _resetShadowAggregates());
  const base = {
    cmd: "捡起地上的刀",
    preState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "鱼定村" }, char: {}, turn: 1 },
    postState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "鱼定村" }, turn: 1 },
    ai: { chat: async () => ({ text: "{}" }) },
  };
  it("开关关/双调用模式不跑", async () => {
    expect(await runShadowJudge({ ...base, apiCfg: cfg({ shadowJudgeEnabled: false }) })).toBeNull();
    expect(await runShadowJudge({ ...base, apiCfg: cfg({ extractionEnabled: true }) })).toBeNull();
  });
  it("stale/epoch 后结果丢弃不进聚合", async () => {
    const r = await runShadowJudge({ ...base, apiCfg: cfg(), isStale: () => true });
    expect(r).toBeNull();
    expect(shadowAggregates().turns).toBe(0);
    const r2 = await runShadowJudge({ ...base, apiCfg: cfg(), epochGuard: () => true });
    expect(r2).toBeNull();
    expect(shadowAggregates().turns).toBe(0);
  });
  it("异常静默不抛出不阻塞", async () => {
    let threw = false;
    try {
      await runShadowJudge({ ...base, apiCfg: cfg(), ai: { chat: async () => { throw new Error("boom"); } } });
    } catch { threw = true; }
    expect(threw).toBe(false);
    // 损坏的状态快照同样静默
    try {
      await runShadowJudge({ ...base, apiCfg: cfg(), preState: null, postState: null });
    } catch { threw = true; }
    expect(threw).toBe(false);
  });
});

describe("影子时间口径（WO-16E 二审）", () => {
  beforeEach(() => { _resetShadowAggregates(); judgeTurn.mockClear?.(); });
  it("非搭话 commit 后 time+1，影子判官仍吃回合前 turn", async () => {
    const base = {
      cmd: "翻箱倒柜", apiCfg: { extractionEnabled: false, shadowJudgeEnabled: true },
      preState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "x" }, char: {}, turn: 48 },
      postState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "x" }, turn: 49 },
      ai: { chat: async () => ({ text: "{}" }) },
    };
    await runShadowJudge(base);
    expect(judgeTurn).toHaveBeenCalled();
    const envelope = judgeTurn.mock.calls[0][0];
    expect(envelope.turn).toBe(48); // 回合前，不是 commit 后 49
    expect(envelope.day).toBe(Math.floor(48 / 24) + 1);
  });
});

describe("WO-16G 影子喂料同源", () => {
  it("shadow 调用 buildIntakeUserContent 传与 runTurn 同一组喂料参数名", async () => {
    const { buildIntakeUserContent } = await import("../../turn/intakeTurn.js");
    const intakeTurn = await import("../../turn/intakeTurn.js");
    const spy = vi.spyOn(intakeTurn, "buildIntakeUserContent");
    const base = {
      cmd: "测试", apiCfg: { extractionEnabled: false, shadowJudgeEnabled: true },
      preState: {
        inv: [{ id: "it_1", name: "青稞酒" }], flags: ["f1"], varTree: {},
        room: { npcs: [], name: "鱼定村", items: [] }, char: {}, turn: 1,
        questProgress: {}, innerRoomName: "广场",
      },
      postState: { inv: [], flags: [], varTree: {}, room: { npcs: [], name: "鱼定村" }, turn: 1 },
      ai: { chat: async () => ({ text: "{}" }) },
    };
    await runShadowJudge(base);
    expect(spy).toHaveBeenCalled();
    const arg = spy.mock.calls[0][0];
    // 与 runTurn 同一组参数名——同源口径钉住，缺一个都是对账失真
    for (const key of ["room", "innerRoomName", "questProgress", "flags", "inv", "char", "varTree"]) {
      expect(arg).toHaveProperty(key);
    }
    expect(arg.inv).toEqual([{ id: "it_1", name: "青稞酒" }]);
    spy.mockRestore();
    void buildIntakeUserContent;
  });
});
