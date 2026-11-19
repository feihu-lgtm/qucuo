import { describe, expect, it } from "vitest";
import { commissionForge, craftJade, settleGambleStone } from "./logic.js";

const state = (overrides = {}) => ({
  char: { money: 500, special: { 气运: 5 } },
  inv: [{ id: "jade-1", name: "玉料", quality: "绿", jadeSpec: { qualityCap: "绿", tierLabel: "淡豆绿糯种" } }],
  flags: [],
  time: 8,
  ...overrides,
});

describe("crafting feature logic", () => {
  it("buys and keeps a gamble stone", () => {
    expect(settleGambleStone(state(), { type: "buy", price: 100 }).changes.char.money).toBe(400);
    expect(settleGambleStone(state(), { type: "keep", stone: { jadeTier: 2, quality: "绿", changKou: "鹰曲新场" } }).changes.inv).toHaveLength(2);
  });

  it("refuses invalid gamble stone transactions", () => {
    expect(settleGambleStone(state(), { type: "buy", price: -1 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(settleGambleStone(state({ char: { money: 1 } }), { type: "buy", price: 100 })).toEqual({ logs: [] });
    expect(settleGambleStone(state(), { type: "keep" })).toEqual({ logs: [] });
  });

  it("queues forge and jade work while charging or consuming inputs", () => {
    const chosen = { name: "青锋", category: "weapon", effect: {}, sixDim: {} };
    expect(commissionForge(state(), { chosen, luck: 5, cost: 100 }).changes.char.money).toBe(400);
    expect(craftJade(state(), { chosen, jadeItemId: "jade-1" }).changes.inv).toEqual([]);
    expect(craftJade(state(), { chosen, jadeItemId: "missing" })).toEqual({ logs: [{ t: "err", text: "  找不到要用的玉料，先去赌石开一块料收进行囊。" }] });
  });
});
