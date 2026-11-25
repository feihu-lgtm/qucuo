import { describe, expect, it } from "vitest";
import { judgeTurn } from "./judgeTurn.js";

const base = (over = {}) => ({
  turn: 5, day: 1, place: "鱼定村",
  npcs: [{ name: "才旦", personality: "精明", carriedItems: [{ id: "i1", name: "钱袋" }] }],
  varTree: { 角色: {} }, inv: [], entries: [],
  char: { hp: [80, 100], money: 50, special: { 身法: 6, 智谋: 6, 体魄: 5 } },
  ...over,
});
const act = (a) => ({ read: "", refIds: [], actions: [a], proposals: [] });
const fa = (outcome, risk = "无", text = "") => ({ kind: "free_act", target: "无", outcome, risk, text, stance: "casual" });

describe("WO-16F-F1 free_act 按表签发", () => {
  it("伤损：高风险 -25%maxHp，检定成功减半", () => {
    const v1 = judgeTurn(base(), act(fa("伤损", "高")), { rng: () => 0.99 });
    const f1 = v1.facts.find((f) => f.op === "CHANGE_VITALS_SILVER");
    // rng 0.99：身法 6+5.94≥6 减半 → -25/2=-13（round）
    expect(f1.hpDelta).toBe(-13);
    const weak = base(); weak.char.special = { 身法: 0, 智谋: 0, 体魄: 0 };
    const v2 = judgeTurn(weak, act(fa("伤损", "高")), { rng: () => 0 });
    expect(v2.facts.find((f) => f.op === "CHANGE_VITALS_SILVER").hpDelta).toBe(-25);
    const v3 = judgeTurn(weak, act(fa("伤损", "低")), { rng: () => 0 });
    expect(v3.facts[0].hpDelta).toBe(-5);
  });
  it("得财：fit 合规才签，tier 定区间；无 proposal 不签", () => {
    const withProp = { read: "", refIds: [], actions: [fa("得财")], proposals: [{ kind: "free_act", fit: "natural" }] };
    const v = judgeTurn(base(), withProp, { rng: () => 0 });
    const f = v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(f.moneyDelta).toBeGreaterThanOrEqual(2); // 默认 T0 2-10
    expect(f.moneyDelta).toBeLessThanOrEqual(10);
    const none = judgeTurn(base(), act(fa("得财")), { rng: () => 0 });
    expect(none.facts.find((x) => x.moneyDelta)).toBeUndefined();
  });
  it("破费：写明数额才签且不超现有银两；没写不签", () => {
    const v = judgeTurn(base(), act(fa("破费", "无", "掏出 30 两请客")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-30);
    const over = judgeTurn(base(), act(fa("破费", "无", "豪掷 999 两")), { rng: () => 0.5 });
    expect(over.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-50);
    const noAmt = judgeTurn(base(), act(fa("破费", "无", "随便花点")), { rng: () => 0.5 });
    expect(noAmt.facts.length).toBe(0);
  });
  it("调息：hp+10%maxHp 且 pot+1；同时辰幂等", () => {
    const v = judgeTurn(base(), act(fa("调息")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").hpDelta).toBe(10);
    expect(v.facts.find((x) => x.op === "PROGRESS_CULTIVATION").potDelta).toBe(1);
    // turn5 watch=2：rest_2 已记账则跳过
    const again = judgeTurn(base({ varTree: { 角色: {}, 世界: { 调息账: ["rest_2"] } }), act(fa("调息")), { rng: () => 0.5 });
    expect(again.facts.length).toBe(0);
  });
  it("修习：按 tier 签 potDelta", () => {
    const v = judgeTurn(base(), act(fa("修习")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "PROGRESS_CULTIVATION").potDelta).toBe(1); // T0=1
  });
  it("受寒中毒：按文本分流寒/毒/并列/不明四种", () => {
    const cold = judgeTurn(base(), act(fa("受寒中毒", "无", "夜里受了风寒")), { rng: () => 0.5 });
    expect(cold.facts.filter((x) => x.op === "APPLY_CONDITION").map((x) => x.attr)).toEqual(["身法"]);
    const poison = judgeTurn(base(), act(fa("受寒中毒", "无", "误食毒蘑菇")), { rng: () => 0.5 });
    expect(poison.facts.filter((x) => x.op === "APPLY_CONDITION").map((x) => x.attr)).toEqual(["体魄"]);
    const both = judgeTurn(base(), act(fa("受寒中毒", "无", "寒毒入体")), { rng: () => 0.5 });
    expect(both.facts.filter((x) => x.op === "APPLY_CONDITION").length).toBe(2);
    const unclear = judgeTurn(base(), act(fa("受寒中毒")), { rng: () => 0.5 });
    expect(unclear.facts.length).toBe(0);
    expect(unclear.notes.join()).toContain("寒热毒型不明");
  });
  it("醉酒：智谋-1×6", () => {
    const v = judgeTurn(base(), act(fa("醉酒")), { rng: () => 0.5 });
    const f = v.facts.find((x) => x.op === "APPLY_CONDITION");
    expect(f.attr).toBe("智谋"); expect(f.durationTurns).toBe(6); expect(f.negative).toBe(true);
  });
  it("服用/无/其他不签；talkOnly 不签", () => {
    expect(judgeTurn(base(), act(fa("服用")), { rng: () => 0.5 }).facts.length).toBe(0);
    expect(judgeTurn(base(), act(fa("无")), { rng: () => 0.5 }).facts.length).toBe(0);
    const tk = judgeTurn(base({ talkOnly: true }), act(fa("修习")), { rng: () => 0.5 });
    expect(tk.facts.length).toBe(0);
  });
});

describe("WO-16F-F1 steal 按表裁定", () => {
  const steal = { kind: "steal", target: "才旦", stance: "casual" };
  it("成功且目标有物：TRANSFER_ITEM npc→player", () => {
    // 身法6+智谋6+rng×6 ≥ 4+精明2+0=6：rng 0 时 12≥6 必成
    const v = judgeTurn(base(), act(steal), { rng: () => 0 });
    const f = v.facts.find((x) => x.op === "TRANSFER_ITEM");
    expect(f.from).toBe("才旦"); expect(f.to).toBe("player"); expect(f.itemName).toBe("钱袋");
  });
  it("失败：MUTATE_SOCIAL 怨 -6 + 生气标记", () => {
    // 低属性+多人警觉：身法0智谋0 rng0 → 0 < 4+2+2
    const hard = base({ npcs: [
      { name: "才旦", personality: "精明多疑", carriedItems: [{ name: "钱袋" }] },
      { name: "八云" }, { name: "路人" },
    ] });
    hard.char.special = { 身法: 0, 智谋: 0 };
    const v = judgeTurn(hard, act(steal), { rng: () => 0 });
    const f = v.facts.find((x) => x.op === "MUTATE_SOCIAL");
    expect(f.affectionDelta).toBe(-6); expect(f.ledgerKind).toBe("怨");
    expect(f.anger.active).toBe(true);
  });
  it("目标无物/不在场不签；talkOnly 不签", () => {
    const noCarry = base({ npcs: [{ name: "才旦", personality: "" }] });
    const v = judgeTurn(noCarry, act(steal), { rng: () => 0.99 });
    expect(v.facts.find((x) => x.op === "TRANSFER_ITEM")).toBeUndefined();
    const absent = judgeTurn(base(), act({ ...steal, target: "不在场" }), { rng: () => 0.99 });
    expect(absent.facts.length).toBe(0);
    const tk = judgeTurn(base({ talkOnly: true }), act(steal), { rng: () => 0.99 });
    expect(tk.facts.length).toBe(0);
  });
});
