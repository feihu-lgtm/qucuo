import { describe, it, expect } from "vitest";
import { nemesisRecruitEligibility, appendHuntedOrder } from "./recruitCheck.js";
import { flattenNemeses } from "./nemesisLines.js";

function entry(overrides = {}) {
  return {
    id: "heifeng_麻三", name: "麻三", faction: "黑风寨", tier: 1, baseRole: "喽啰",
    epithet: null, scars: [], grudge: 1, status: "active", firstTurn: 3, lastTurn: 3, ...overrides,
  };
}
function heartLedger(pairs) {
  return pairs.map(([tag, summary], i) => ({ id: `hl_${i}`, tag, summary, turn: 1 }));
}
function varTreeWith(e, ledger) {
  return {
    世界: { 宿敌谱: { [e.faction]: { entries: { [e.id]: e } } } },
    ...(ledger ? { 角色: { [e.name]: { 心账: ledger } } } : {}),
  };
}

describe("WO-23C4 nemesisRecruitEligibility（恩>怨按条数计数）", () => {
  it("合格：active+tier<=2+恩条数>怨条数", () => {
    const e = entry();
    const r = nemesisRecruitEligibility(varTreeWith(e, heartLedger([["恩", "救过他"], ["怨", "打伤他"], ["恩", "还过钱"]])), e);
    expect(r.ok).toBe(true);
    expect(r.en).toBe(2);
    expect(r.yuan).toBe(1);
  });
  it("拒：tier>2/非active/无心账/恩不大于怨/恩怨持平", () => {
    const ledger = heartLedger([["恩", "救过他"], ["怨", "打伤他"], ["怨", "辱过他"]]);
    expect(nemesisRecruitEligibility(varTreeWith(entry({ tier: 3 }), ledger), entry({ tier: 3 })).reason).toBe("tier_too_high");
    expect(nemesisRecruitEligibility(varTreeWith(entry({ status: "settled" }), ledger), entry({ status: "settled" })).reason).toBe("not_active");
    expect(nemesisRecruitEligibility(varTreeWith(entry(), null), entry()).reason).toBe("no_ledger");
    expect(nemesisRecruitEligibility(varTreeWith(entry(), ledger), entry()).reason).toBe("grudge_not_outweighed");
    // 持平也不算恩大于怨
    expect(nemesisRecruitEligibility(varTreeWith(entry(), heartLedger([["恩", "a"], ["怨", "b"]])), entry()).reason).toBe("grudge_not_outweighed");
  });
  it("旧档兼容：谊→恩/隙→怨迁移计数；字符串条目算见不计权重；欠诺见不计权重", () => {
    const legacy = [{ kind: "谊", reason: "旧谊" }, { kind: "隙", reason: "旧隙" }, { kind: "谊", reason: "再助" }, "一面之缘"];
    const e = entry();
    const r = nemesisRecruitEligibility(varTreeWith(e, legacy), e);
    expect(r.ok).toBe(true);
    expect(r.en).toBe(2);
    expect(r.yuan).toBe(1);
    // 欠/诺/见再多也不抬权重
    const neutral = heartLedger([["欠", "欠他人情"], ["诺", "约过酒"], ["见", "见过"]]);
    expect(nemesisRecruitEligibility(varTreeWith(entry(), neutral), entry()).ok).toBe(false);
  });
  it("fakeDead 拒、坏形状不炸", () => {
    expect(nemesisRecruitEligibility({}, null).ok).toBe(false);
    expect(nemesisRecruitEligibility(varTreeWith(entry({ status: "fakeDead" }), heartLedger([["恩", "x"]])), entry({ status: "fakeDead" })).ok).toBe(false);
    expect(() => nemesisRecruitEligibility(null, undefined)).not.toThrow();
  });
  it("recruited 状态：flatten 保留原状（面板文案「已收服」的断言在 ui/format/nemesisLines.test.js）", () => {
    const e = entry({ status: "recruited" });
    const flat = flattenNemeses(varTreeWith(e, null));
    expect(flat[0].status).toBe("recruited");
  });
  it("appendHuntedOrder：dedupe by entryId、cap20、坏形状不炸", () => {
    const once = appendHuntedOrder([], { faction: "黑风寨", entryId: "heifeng_麻三", name: "麻三", turn: 1, note: "x" });
    expect(appendHuntedOrder(once, { faction: "黑风寨", entryId: "heifeng_麻三", name: "麻三", turn: 2, note: "x" })).toHaveLength(1);
    expect(appendHuntedOrder(once, { faction: "雪山派", entryId: "xueshan_甲", name: "甲", turn: 2, note: "y" })).toHaveLength(2);
    let arr = [];
    for (let i = 0; i < 25; i += 1) arr = appendHuntedOrder(arr, { entryId: `e${i}`, faction: "f", name: "n", turn: i, note: "z" });
    expect(arr).toHaveLength(20);
    expect(() => appendHuntedOrder("not-array", null)).not.toThrow();
    expect(appendHuntedOrder(undefined, { entryId: "a" })).toHaveLength(1);
  });
});
