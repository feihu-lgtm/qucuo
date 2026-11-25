import { describe, expect, it } from "vitest";
// S5 测试：计量口径修正——TRANSFER 双向投影/名字归一/world 类目/feature 路由豁免/
// 修为 single_only 根因复现（结论：签发侧，judge 调息修习只签 potDelta 不签 expDelta）
import { emptyCategories, projectFacts, featureRoutedCats } from "./shadowTaxonomy.js";
import { compareCategories } from "./shadowCompare.js";
import { diffSnapshots } from "./shadowDiff.js";
import { judgeTurn } from "../../../domain/rules/judge/judgeTurn.js";
import { createRng } from "../../../utils/rng.js";

describe("S5 TRANSFER_ITEM 双向投影与归一", () => {
  it("give 玩家失去记 rm、steal 玩家获得记 add，与单调用 items_rm/items_add 同口径", () => {
    const give = projectFacts([{ op: "TRANSFER_ITEM", itemId: "food1", itemName: "干粮", from: "player", to: "掌柜" }]);
    expect(give.inv.rm).toEqual(["干粮"]);
    expect(give.inv.add).toEqual([]);
    const steal = projectFacts([{ op: "TRANSFER_ITEM", itemId: "pot1", itemName: "茶壶", from: "掌柜", to: "player" }]);
    expect(steal.inv.add).toEqual(["茶壶"]);
    expect(steal.inv.rm).toEqual([]);
  });
  it("id/名字归一：判官签 id+名字、单调用 inv 条目同物不同 id 不误报", () => {
    const pre = { inv: [], flags: [], varTree: {}, room: { npcs: [] } };
    const post = { ...pre, inv: [{ id: "instance-xyz", name: "茶壶" }] };
    const diff = diffSnapshots(pre, post);
    expect(diff.categories.inv.add).toEqual(["茶壶"]); // 名字优先
    const proj = projectFacts([{ op: "TRANSFER_ITEM", itemId: "pot1", itemName: "茶壶", from: "掌柜", to: "player" }]);
    const res = compareCategories(diff, proj);
    expect(res.verdicts.inv.verdict).toBe("match"); // id 不同（pot1 vs instance-xyz）不误报
  });
});

describe("S5 world 类目（varTree.世界 数值 leaf）", () => {
  it("威望 diff 进 world 类目，单边记 single_only", () => {
    const pre = { inv: [], flags: [], varTree: { 世界: { 威望: 0 } }, room: { npcs: [] } };
    const post = { inv: [], flags: [], varTree: { 世界: { 威望: -2 } }, room: { npcs: [] } };
    const diff = diffSnapshots(pre, post);
    expect(diff.categories.world).toEqual({ 威望: -2 });
    const res = compareCategories(diff, emptyCategories());
    expect(res.verdicts.world.verdict).toBe("single_only"); // 判官不签威望→如实漏判可见，不再盲区
  });
  it("非数值 leaf（对象/数组账本）不进 world 类目", () => {
    const pre = { inv: [], flags: [], varTree: { 世界: {} }, room: { npcs: [] } };
    const post = { inv: [], flags: [], varTree: { 世界: { 调息账: ["rest_1"], 容器: { 某地: {} } } }, room: { npcs: [] } };
    expect(diffSnapshots(pre, post).categories.world).toEqual({});
  });
});

describe("S5 feature 路由类目豁免", () => {
  it("equip/use_item/take/invite 映射对应类目", () => {
    expect(featureRoutedCats([{ kind: "equip" }])).toEqual(["inv"]);
    expect(featureRoutedCats([{ kind: "use_item" }])).toEqual(["inv", "vitals"]);
    expect(featureRoutedCats([{ kind: "take" }])).toEqual(["inv"]);
    expect(featureRoutedCats([{ kind: "invite" }])).toEqual(["affection"]);
    expect(featureRoutedCats([{ kind: "talk" }])).toEqual([]);
  });
  it("use_item 回合 inv/vitals 标 excluded 不参与比较", () => {
    const diff = {
      categories: { ...emptyCategories(), inv: { add: [], rm: ["干粮"] }, vitals: { hp: 5, money: 0 } },
      excluded: ["npcs"],
    };
    const res = compareCategories(diff, emptyCategories(), { featureRoutedCats: ["inv", "vitals"] });
    expect(res.verdicts.inv.verdict).toBe("excluded");
    expect(res.verdicts.vitals.verdict).toBe("excluded");
    expect(res.hasGap).toBe(false);
  });
});

describe("S5 修为 single_only 根因复现（结论：签发侧）", () => {
  it("判官调息/修习只签 potDelta 不签 expDelta——exp sub 恒 single_only", () => {
    // 复现 #525 回合 11/12：单调用模型 delta.exp+2/pot+1 落账，判官签发什么？
    const base = {
      turn: 51, day: 3, place: "曲措客栈",
      npcs: [], varTree: { 角色: {}, 世界: {} }, inv: [], entries: [], talkOnly: false,
      char: { hp: [90, 100], special: { 体魄: 5 }, money: 100 },
    };
    for (const outcome of ["调息", "修习"]) {
      const rng = createRng(7);
      const v = judgeTurn(base, {
        read: "", refIds: [],
        actions: [{ kind: "free_act", target: "无", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome, risk: "无", confidence: 0.9, text: "打坐" }],
        proposals: [],
      }, { rng: rng.random });
      const cultFacts = (v?.facts || []).filter((f) => f.op === "PROGRESS_CULTIVATION");
      expect(cultFacts.length).toBeGreaterThan(0);
      // 根因钉死：签发侧事实只有 potDelta——expDelta 从来不签。
      // 投影层 projectFacts 对 expDelta/potDelta 的映射都在（shadowTaxonomy L70），
      // 所以「修为仅单调用记账」是签发侧设计口径（修习按 tier 定 pot），不是投影缺映射。
      for (const f of cultFacts) {
        expect(f.expDelta).toBeUndefined();
        expect(Number.isFinite(f.potDelta)).toBe(true);
      }
      // 投影后 pot 有、exp 无——diff 侧 exp+2 对 proj exp 0 即 sub 级 single_only
      const proj = projectFacts(v.facts);
      expect(proj.cultivation.pot).toBeGreaterThan(0);
      expect(proj.cultivation.exp).toBe(0);
    }
  });
});

describe("S5 Review 三修", () => {
  it("带前提的条件动作不按 feature 路由豁免（live router 跳过不执行）", () => {
    expect(featureRoutedCats([{ kind: "use_item", condition: "遇敌" }])).toEqual([]);
    expect(featureRoutedCats([{ kind: "use_item", condition: "无" }])).toEqual(["inv", "vitals"]);
    expect(featureRoutedCats([{ kind: "use_item" }])).toEqual(["inv", "vitals"]);
  });
  it("契约违约系统扣威望按 breachTurn 归因剔除，不算判官漏判", () => {
    const pre = { inv: [], flags: [], varTree: { 世界: { 威望: 10, 契约: { 掌柜: { p1: { promise: "x" } } } } }, room: { npcs: [] } };
    const post = { inv: [], flags: [], varTree: { 世界: { 威望: 5, 契约: { 掌柜: { p1: { promise: "x", breachTurn: 51 } } } } }, room: { npcs: [] } };
    const diff = diffSnapshots(pre, post);
    expect(diff.categories.world).toEqual({}); // -5 全部由违约系统归因，无残差
    // 违约 -5 + 模型写 -2 并存时残差保留
    const post2 = { inv: [], flags: [], varTree: { 世界: { 威望: 3, 契约: { 掌柜: { p1: { promise: "x", breachTurn: 51 } } } } }, room: { npcs: [] } };
    expect(diffSnapshots(pre, post2).categories.world).toEqual({ 威望: -2 });
  });
});
