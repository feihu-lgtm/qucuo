import { describe, expect, it } from "vitest";
import { getRngState, setRngState, setSeed } from "../../core/rng.js";
import { commissionForge, craftJade, settleGambleStone } from "./logic.js";

const state = (overrides = {}) => ({
  char: { money: 500, special: { 气运: 5 } },
  inv: [{ id: "jade-1", name: "玉料", quality: "绿", jadeSpec: { qualityCap: "绿", tierLabel: "淡豆绿糯种" } }],
  flags: [],
  time: 8,
  ...overrides,
});

function withSeed(seed, run) {
  const previous = getRngState();
  setSeed(seed);
  try {
    return run();
  } finally {
    setRngState(previous);
  }
}

describe("crafting feature logic", () => {
  it("buys and keeps a gamble stone", () => {
    expect(settleGambleStone(state(), { type: "buy", price: 100 }).changes.char.money).toBe(400);
    const first = withSeed(42, () => settleGambleStone(state(), { type: "keep", stone: { jadeTier: 2, quality: "绿", changKou: "鹰曲新场" } }));
    const second = withSeed(42, () => settleGambleStone(state(), { type: "keep", stone: { jadeTier: 2, quality: "绿", changKou: "鹰曲新场" } }));
    expect(first.changes.inv).toHaveLength(2);
    expect(first.changes.inv[1].id).toBe(second.changes.inv[1].id);
  });

  it("sells or forges gamble stone and preserves each settlement option", () => {
    const sold = settleGambleStone(state(), { type: "sell", price: 25, bidderName: "温掌柜" });
    expect(sold.changes.char.money).toBe(525);
    expect(sold.settleOptions).toEqual({ settleNpc: "温掌柜" });
    const forged = settleGambleStone(state(), { type: "forge", result: { result: "success", quality: "紫" } });
    expect(forged.changes.char.money).toBe(300);
    expect(forged.settleOptions).toEqual({ settleNpc: "温掌柜" });
    const failedForge = settleGambleStone(state(), { type: "forge", result: { result: "cracked" } });
    expect(failedForge.changes.char.money).toBe(300);
    expect(failedForge.settleOptions).toEqual({ settle: false });
  });

  it("refuses invalid, unaffordable, or incomplete gamble stone transactions", () => {
    expect(settleGambleStone(state(), { type: "buy", price: -1 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(settleGambleStone(state({ char: { money: 1 } }), { type: "buy", price: 100 })).toEqual({ logs: [] });
    expect(settleGambleStone(state(), { type: "keep" })).toEqual({ logs: [] });
    expect(settleGambleStone(state(), { type: "sell", price: 0 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(settleGambleStone(state({ char: { money: 1 } }), { type: "forge", result: { result: "success" } })).toEqual({ logs: [] });
    expect(settleGambleStone(state(), { type: "forge" })).toEqual({ logs: [] });
  });

  it("queues forge and jade work while charging or consuming inputs", () => {
    const chosen = { name: "青锋", category: "weapon", effect: {}, sixDim: {} };
    expect(commissionForge(state(), { chosen, luck: 5, cost: 100 }).changes.char.money).toBe(400);
    expect(craftJade(state(), { chosen, jadeItemId: "jade-1" }).changes.inv).toEqual([]);
    expect(craftJade(state(), { chosen, jadeItemId: "missing" })).toEqual({ logs: [{ t: "err", text: "  找不到要用的玉料，先去赌石开一块料收进行囊。" }] });
    expect(commissionForge(state(), { chosen, luck: 5, cost: 0 })).toEqual({ logs: [{ t: "err", text: "  数额无效" }] });
    expect(commissionForge(state({ char: { money: 1 } }), { chosen, luck: 5, cost: 100 })).toEqual({ logs: [] });
    expect(commissionForge(state(), { luck: 5, cost: 100 })).toEqual({ logs: [] });
    expect(craftJade(state(), { jadeItemId: "jade-1" })).toEqual({ logs: [] });
  });
});
