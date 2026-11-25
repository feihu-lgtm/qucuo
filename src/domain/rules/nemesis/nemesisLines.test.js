// WO-23B 宿敌谱确定性文本行测试
import { describe, it, expect } from "vitest";
import { flattenNemeses, buildNemesisInjectBlock, nemesisGrudgeLine, nemesisStatusLine } from "./nemesisLines.js";

function mkEntry(over = {}) {
  return {
    id: "e1", name: "赫连铸", faction: "雪山派", tier: 3, baseRole: "执剑弟子",
    epithet: null, tauntLine: null, rumorSnippet: null,
    scars: [{ kind: "利刃", note: "左肩", turn: 10 }],
    grudge: 4, status: "active", firstTurn: 5, lastTurn: 12,
    ...over,
  };
}

function mkTree(entries, faction = "雪山派") {
  return { 世界: { 宿敌谱: { [faction]: { entries } } } };
}

describe("flattenNemeses", () => {
  it("旧档无宿敌谱/坏形状不炸返回空", () => {
    expect(flattenNemeses({})).toEqual([]);
    expect(flattenNemeses({ 世界: {} })).toEqual([]);
    expect(flattenNemeses({ 世界: { 宿敌谱: null } })).toEqual([]);
    expect(flattenNemeses({ 世界: { 宿敌谱: { 雪山派: { entries: null } } } })).toEqual([]);
    expect(flattenNemeses({ 世界: { 宿敌谱: { 雪山派: { entries: { e1: null, e2: { noName: 1 } } } } } })).toEqual([]);
  });
  it("摊平带 faction 回退/tier-grudge 兜底/非法 scar 过滤", () => {
    const rows = flattenNemeses(mkTree({
      e1: mkEntry({ faction: "", scars: [{ kind: "利刃", note: "x", turn: 1 }, { kind: "妖法", note: "非法", turn: 2 }, null] }),
    }));
    expect(rows).toHaveLength(1);
    expect(rows[0].faction).toBe("雪山派"); // entry.faction 空回退分组键
    expect(rows[0].scars).toHaveLength(1); // 非法 kind/null 滤除
    expect(rows[0].tier).toBe(3);
  });
  it("UI 分组口径：多势力分开摊平", () => {
    const tree = {
      世界: { 宿敌谱: {
        雪山派: { entries: { e1: mkEntry() } },
        雾隐寨: { entries: { e2: mkEntry({ id: "e2", name: "雾隐刀客", faction: "雾隐寨" }) } },
      } },
    };
    const rows = flattenNemeses(tree);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.faction))).toEqual(new Set(["雪山派", "雾隐寨"]));
  });
});

describe("buildNemesisInjectBlock", () => {
  it("无谱零注入；无在场名册零注入", () => {
    expect(buildNemesisInjectBlock({}, ["赫连铸"])).toBe("");
    expect(buildNemesisInjectBlock(mkTree({ e1: mkEntry() }), [])).toBe("");
    expect(buildNemesisInjectBlock(mkTree({ e1: mkEntry() }), null)).toBe("");
  });
  it("在场才注入——不在场谱中人物不入", () => {
    const block = buildNemesisInjectBlock(mkTree({ e1: mkEntry() }), ["老孙"]);
    expect(block).toBe("");
    const hit = buildNemesisInjectBlock(mkTree({ e1: mkEntry() }), ["赫连铸", "老孙"]);
    expect(hit).toContain("赫连铸");
    expect(hit).toContain("@宿敌谱");
  });
  it("fakeDead/settled 等非 active 不入注入", () => {
    for (const status of ["fakeDead", "settled", "captured"]) {
      expect(buildNemesisInjectBlock(mkTree({ e1: mkEntry({ status }) }), ["赫连铸"])).toBe("");
    }
  });
  it("cap 3 超出截断注人数", () => {
    const entries = {};
    for (let i = 1; i <= 5; i++) entries[`e${i}`] = mkEntry({ id: `e${i}`, name: `仇${i}`, grudge: i });
    const block = buildNemesisInjectBlock(mkTree(entries), ["仇1", "仇2", "仇3", "仇4", "仇5"]);
    const lines = block.split("\n");
    expect(lines).toHaveLength(5); // 表头 + 3 条 + 截断注
    expect(lines.filter((l) => /^仇\d：/.test(l))).toHaveLength(3);
    expect(block).toContain("另有 2 名宿敌在场");
  });
  it("行含势力/tier/绰号缺省/旧伤最多 2 条/结仇强度", () => {
    const e = mkEntry({
      epithet: "寒潭孤剑",
      scars: [
        { kind: "利刃", note: "左肩", turn: 1 },
        { kind: "火毒", note: "右臂", turn: 2 },
        { kind: "点穴", note: "膻中", turn: 3 },
      ],
      grudge: 5,
    });
    const block = buildNemesisInjectBlock(mkTree({ e1: e }), ["赫连铸"]);
    expect(block).toContain("雪山派·第3阶");
    expect(block).toContain("寒潭孤剑");
    expect(block).not.toContain("利刃伤"); // slice(-2) 只带最新两条
    expect(block).toContain("火毒伤");
    expect(block).toContain("点穴伤");
    expect(block).toContain("不共戴天");
    // 无绰号缺省
    const bare = buildNemesisInjectBlock(mkTree({ e1: mkEntry({ epithet: null, grudge: 0 }) }), ["赫连铸"]);
    expect(bare).toContain("尚无绰号");
    expect(bare).not.toContain("小有嫌隙"); // grudge 0 不提
  });
  it("结仇原委：有 origin 注入截 18 字，无 origin 不炸不带", () => {
    const withOrigin = mkEntry({ origin: { turn: 3, place: "雪山派", summary: "你当众折了他的剑叫他颜面扫地从此再也在江湖上抬不起头来" } });
    const block = buildNemesisInjectBlock(mkTree({ e1: withOrigin }), ["赫连铸"]);
    expect(block).toContain("结仇原委：你当众折了他的剑叫他颜面扫地从此"); // 18 字截断
    expect(block).not.toContain("再难抬头");
    const bare = buildNemesisInjectBlock(mkTree({ e1: mkEntry() }), ["赫连铸"]);
    expect(bare).not.toContain("结仇原委");
    // 坏形状 origin 不炸
    expect(flattenNemeses(mkTree({ e1: mkEntry({ origin: "bad" }) }))[0].origin).toBeNull();
  });
  it("缺 id 的条目丢弃", () => {
    const noId = mkEntry(); delete noId.id;
    expect(flattenNemeses(mkTree({ e1: noId }))).toEqual([]);
  });
});

describe("状态/强度行", () => {
  it("nemesisStatusLine active 空串，fakeDead/settled 标注", () => {
    expect(nemesisStatusLine({ status: "active" })).toBe("");
    expect(nemesisStatusLine({ status: "fakeDead" })).toBe("（已故）"); // 玩家面板绝不泄「假死」
    expect(nemesisStatusLine({ status: "fakeDead" })).not.toContain("假死");
    expect(nemesisStatusLine({ status: "settled" })).toBe("（已了结）");
  });
  it("nemesisGrudgeLine 分档", () => {
    expect(nemesisGrudgeLine(0)).toBe("");
    expect(nemesisGrudgeLine(1)).toBe("小有嫌隙");
    expect(nemesisGrudgeLine(3)).toBe("结怨已深");
    expect(nemesisGrudgeLine(7)).toBe("不共戴天");
  });
});
