import { describe, it, expect } from "vitest";
import { receiptActionResult } from "./logic.js";
import { consumeItem } from "../items/logic.js";

// changes 键的契约：fn(当前值) → 新值（updateField 内部已折好 write 指令）
function applyChange(changes, key, base) {
  const u = changes[key];
  return typeof u === "function" ? u(base) : u;
}

const mkInv = () => ([
  { id: "it_old111", name: "熊油膏", category: "misc", quality: "绿", consumable: { hpRestore: 0.2 } },
  { id: "it_new222", name: "熊油膏", category: "misc", quality: "绿", consumable: { hpRestore: 0.2 } },
  { id: "it_old333", name: "铁剑", category: "weapon", quality: "白", atk: 7, equipped: true },
  { id: "it_new444", name: "铁剑", category: "weapon", quality: "紫", atk: 33, equipped: false },
]);

const baseState = () => ({
  inv: mkInv(),
  skills: [
    { id: "sk_a", name: "断崖一剑", moveType: "攻击", active: false },
    { id: "sk_b", name: "横扫千军", moveType: "攻击", active: true },
    { id: "sk_c", name: "听雪", moveType: "防御", active: true },
  ],
  char: { hp: [50, 100] },
  time: 10,
  flags: [],
});

describe("receiptActionResult 结构化落账动作", () => {
  it("equip 按 id 精确寻址：同名两件只动新件", () => {
    const res = receiptActionResult(baseState(), { type: "effectReceipt", op: "equip", kind: "grant_item", factId: "F1_1", itemId: "it_new444", name: "铁剑" });
    expect(res).toBeTruthy();
    const next = applyChange(res.changes, "inv", mkInv());
    const newSword = next.find(i => i.id === "it_new444");
    const oldSword = next.find(i => i.id === "it_old333");
    expect(newSword.equipped).toBe(true);   // 新件被佩挂
    expect(oldSword.equipped).toBe(true);   // 旧件不受影响（toggleEquip 不动其他件）
  });

  it("consume 按 id 精确吃新件，同名旧件留下", () => {
    const st = baseState();
    const res = receiptActionResult(st, { type: "effectReceipt", op: "consume", kind: "grant_item", factId: "F1_2", itemId: "it_new222", name: "熊油膏" });
    expect(res).toBeTruthy();
    const next = applyChange(res.changes, "inv", mkInv());
    expect(next.some(i => i.id === "it_new222")).toBe(false); // 新件被吃
    expect(next.some(i => i.id === "it_old111")).toBe(true);  // 旧件还在
  });

  it("consumeItem 本体：无 id 时退回按名第一件（旧契约不变）", () => {
    const st = baseState();
    const res = consumeItem(st, { name: "熊油膏", consumable: { hpRestore: 0.2 } });
    const nextInv = res.changes.inv(st.inv);
    expect(nextInv.some(i => i.id === "it_old111")).toBe(false); // 按名吃第一件
    expect(nextInv.some(i => i.id === "it_new222")).toBe(true);
  });

  it("activate 按 id 上阵目标并卸同类，防御类不连坐", () => {
    const st = baseState();
    const res = receiptActionResult(st, { type: "effectReceipt", op: "activate", kind: "bestow_skill", factId: "F1_3", skillId: "sk_a", name: "断崖一剑" });
    const next = applyChange(res.changes, "skills", st.skills);
    expect(next.find(s => s.id === "sk_a").active).toBe(true);
    expect(next.find(s => s.id === "sk_b").active).toBe(false); // 同攻击类被卸
    expect(next.find(s => s.id === "sk_c").active).toBe(true);  // 防御类不动
  });

  it("确定性路径不读 intentRecognition：state 无识别开关字段也照常生效", () => {
    // baseState  deliberately 不含任何 intentRecognitionEnabled 字段
    const res = receiptActionResult(baseState(), { type: "effectReceipt", op: "equip", kind: "grant_item", factId: "F1_4", itemId: "it_new444" });
    expect(res).toBeTruthy();
    expect(res.changes.inv).toBeTypeOf("function");
  });

  it("寻址落空/非法输入返回 null，不产生任何写", () => {
    expect(receiptActionResult(baseState(), null)).toBeNull();
    expect(receiptActionResult(baseState(), { type: "effectReceipt", op: "equip", itemId: "it_ghost" })).toBeNull();
    expect(receiptActionResult(baseState(), { type: "effectReceipt", op: "activate", skillId: "sk_ghost" })).toBeNull();
    expect(receiptActionResult(baseState(), { type: "other", op: "equip" })).toBeNull();
  });

  it("viewPact 返回 null（有意例外：调用方回退文本指令）", () => {
    expect(receiptActionResult(baseState(), { type: "effectReceipt", op: "viewPact", kind: "pact", factId: "F1_5" })).toBeNull();
  });
});
