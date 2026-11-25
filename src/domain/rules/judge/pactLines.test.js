// WO-22B-P4b 契约行/注入块测试矩阵：
// 在场未了注入 / 非在场不注入 / 已了不注入 / 违约仍注入并标注 / 最多 3 条截断 /
// 无契约零注入 / 期限剩余与逾期时辰 / flattenPacts 状态口径与旧档兼容
import { describe, expect, it } from "vitest";
import { buildPactInjectBlock, flattenPacts, pactStatusOf, pactDeadlineLine } from "./pactLines.js";

function vt(book) {
  return { 世界: { 契约: book } };
}

function pact(overrides = {}) {
  return {
    npc: "才旦", promise: "三日内送还猎刀", deadlineHours: 24,
    rewardHint: "十两银子", bindTurn: 50, place: "曲措乡", witnesses: ["主角", "才旦"],
    ...overrides,
  };
}

describe("WO-22B-P4b buildPactInjectBlock", () => {
  it("在场未了注入：含 promise/剩余时辰/酬谢", () => {
    const out = buildPactInjectBlock(vt({ 才旦: { k1: pact() } }), ["才旦"], 60);
    expect(out).toContain("@江湖契约");
    expect(out).toContain("才旦");
    expect(out).toContain("三日内送还猎刀");
    expect(out).toContain("余 7 个时辰"); // 50+24-60=14 格=7 时辰
    expect(out).toContain("十两银子");
  });

  it("非在场 NPC 不注入", () => {
    expect(buildPactInjectBlock(vt({ 才旦: { k1: pact() } }), ["老孙"], 60)).toBe("");
  });

  it("已了（settled）不注入", () => {
    const p = pact({ settled: { turn: 60 } });
    expect(buildPactInjectBlock(vt({ 才旦: { k1: p } }), ["才旦"], 60)).toBe("");
  });

  it("违约仍注入并标注已违约、逾期时辰", () => {
    const p = pact({ breachTurn: 80 });
    const out = buildPactInjectBlock(vt({ 才旦: { k1: p } }), ["才旦"], 100);
    expect(out).toContain("已违约");
    expect(out).toContain("已逾 13 个时辰"); // 100-74=26 格=13 时辰
  });

  it("最多 3 条截断并注余数", () => {
    const book = { 才旦: {} };
    for (let i = 1; i <= 5; i++) book.才旦[`k${i}`] = pact({ promise: `约定${i}`, bindTurn: 50 + i });
    const out = buildPactInjectBlock(vt(book), ["才旦"], 60);
    expect(out.match(/约定\d/g)).toHaveLength(3);
    expect(out).toContain("另有 2 桩");
  });

  it("无契约/无在场零注入", () => {
    expect(buildPactInjectBlock(vt({}), ["才旦"], 60)).toBe("");
    expect(buildPactInjectBlock(vt({ 才旦: { k1: pact() } }), [], 60)).toBe("");
    expect(buildPactInjectBlock({}, ["才旦"], 60)).toBe("");
  });

  it("无期限契约不带时辰行，无酬谢不带酬谢句", () => {
    const p = pact({ deadlineHours: null, rewardHint: "" });
    const out = buildPactInjectBlock(vt({ 才旦: { k1: p } }), ["才旦"], 60);
    expect(out).toContain("三日内送还猎刀");
    expect(out).not.toContain("时辰");
    expect(out).not.toContain("酬谢");
  });
});

describe("WO-22B-P4b flattenPacts/状态口径", () => {
  it("状态：open/settled/breached，breach 优先", () => {
    expect(pactStatusOf(pact())).toBe("open");
    expect(pactStatusOf(pact({ settled: { turn: 1 } }))).toBe("settled");
    expect(pactStatusOf(pact({ breachTurn: 1 }))).toBe("breached");
    expect(pactStatusOf(pact({ breachTurn: 1, settled: { turn: 2 } }))).toBe("breached");
  });

  it("flattenPacts 摊平带 npcName/pactKey/status，旧档缺字段不炸", () => {
    const rows = flattenPacts(vt({
      才旦: { k1: pact(), k2: { promise: "旧档约" } }, // 旧档只有 promise
      老孙: "garbage", // 非法形状
    }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ npcName: "才旦", pactKey: "k1", status: "open" });
    expect(flattenPacts({})).toEqual([]);
    expect(flattenPacts(null)).toEqual([]);
  });

  it("pactDeadlineLine 缺字段空串", () => {
    expect(pactDeadlineLine({ promise: "x" }, 100)).toBe("");
    expect(pactDeadlineLine(pact(), NaN)).toBe("");
  });
});
